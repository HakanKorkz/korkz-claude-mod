import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AltAjan, Dal, Erisim, Git, Limit, LimitDurumu, Plugins, Tools, Usage, Worktree } from '../types'

// Eski sürümün açtığı yan panel; açık kaldıysa kapatılır.
const ESKI_PANEL = 'oturum-maliyeti'

const EMPTY: Usage = {
  usd: null,
  contextTokens: null,
  contextWindow: null,
  contextPercent: null,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  turns: 0,
  limits: [],
}

const usage = atom({ plugin: 'oturum-maliyeti', key: 'usage' } as const, EMPTY)
const tools = atom({ plugin: 'oturum-maliyeti', key: 'tools' } as const, {
  calls: {},
  running: {},
  errors: 0,
} as Tools)
const plugins = atom({ plugin: 'oturum-maliyeti', key: 'plugins' } as const, {
  active: [],
  calls: {},
  running: {},
  thisTurn: [],
} as Plugins)
const isHidden = atom({ plugin: 'oturum-maliyeti', key: 'isHidden' } as const, false)
const model = atom({ plugin: 'oturum-maliyeti', key: 'model' } as const, null as string | null)
const modelOptions = atom({ plugin: 'oturum-maliyeti', key: 'modelOptions' } as const, [] as string[])
const isModelMenuOpen = atom({ plugin: 'oturum-maliyeti', key: 'isModelMenuOpen' } as const, false)
const projeModeli = atom({ plugin: 'oturum-maliyeti', key: 'projeModeli' } as const, null as string | null)
const git = atom({ plugin: 'oturum-maliyeti', key: 'git' } as const, null as Git | null)
const gitMenu = atom({ plugin: 'oturum-maliyeti', key: 'gitMenu' } as const, null as 'dal' | 'worktree' | null)
const dallar = atom({ plugin: 'oturum-maliyeti', key: 'dallar' } as const, [] as Dal[])
const worktreeler = atom({ plugin: 'oturum-maliyeti', key: 'worktreeler' } as const, [] as Worktree[])
const ajanlar = atom({ plugin: 'oturum-maliyeti', key: 'ajanlar' } as const, [] as AltAjan[])
const saat = atom({ plugin: 'oturum-maliyeti', key: 'saat' } as const, 0)
const limitDurumu = atom({ plugin: 'oturum-maliyeti', key: 'limitDurumu' } as const, { at: 0, kaynak: null, yenileniyor: false } as LimitDurumu)
const erisim = atom({ plugin: 'oturum-maliyeti', key: 'erisim' } as const, {} as Record<string, Erisim>)

// `claude-opus-5-5[1m]` → `Opus 5.5 (1M)`; tarih ekleri (`-20251001`) atılır.
export const modelAdi = (id: string) => {
  const uzun = /\[1m\]$/i.test(id)
  const [aile = id, ...surum] = id
    .replace(/\[1m\]$/i, '')
    .replace(/^claude-/, '')
    .split('-')
    .filter(p => !/^\d{8}$/.test(p))
  const ad = `${aile.charAt(0).toUpperCase()}${aile.slice(1)}${surum.length > 0 ? ` ${surum.join('.')}` : ''}`

  return uzun ? `${ad} (1M)` : ad
}

const uzunMu = (x: string) => /\[1m\]$/i.test(x)
const aileOf = (x: string) => x.replace(/\[1m\]$/i, '').replace(/^claude-/, '').split('-')[0] ?? x

// Model isteği tam kimlik ister; kısa adların bilinen karşılıkları. Oturumda
// görülen daha yeni kimlikler (`$.session.model()`) bunların yerine geçer.
const BILINEN_KIMLIK: Record<string, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
  fable: 'claude-fable-5-1',
}

// `sonnet[1m]` → `claude-sonnet-5-5[1m]`; bilinmeyen kısa adda undefined.
export const kimlikCoz = (secenek: string, ogrenilen: Record<string, string> = {}) => {
  if (secenek.startsWith('claude-')) return secenek
  const aile = aileOf(secenek)
  const id = ogrenilen[aile] ?? BILINEN_KIMLIK[aile]
  if (id === undefined) return undefined

  return uzunMu(secenek) ? `${id}[1m]` : id
}

// Menüde gösterilen seçenekler: `default` ve kimliği çözülebilen modeller.
// `best` ve `opusplan` adım adım model değişimiyle anlatılamaz.
export const menuSecenekleri = (secenekler: readonly string[]) =>
  secenekler.filter(s => s === 'default' || (s !== 'best' && s !== 'opusplan' && kimlikCoz(s) !== undefined))

export const secenekAdi = (s: string, genel: string | null = null) =>
  s === 'default' ? `Genel ayar${genel === null ? '' : ` (${modelAdi(genel)})`}` : modelAdi(kimlikCoz(s) ?? s).replace(/ [\d.]+( \(1M\))?$/, '$1')

const ERISIM_SURESI = 12 * 3_600_000

type ErisimKaydi = Record<string, { durum: 'var' | 'yok'; at: number }>

// Bu projede seçili modelin tam kimliği; turn.step her istekte bunu kullanır.
let projeKimligi: string | undefined
let kok = ''

async function ogrenilenler($: EngineInterface) {
  return ((await $.store.get('modelKimlikleri').catch(() => undefined)) ?? {}) as Record<string, string>
}

async function modelYenile($: EngineInterface) {
  const [id, satir] = await Promise.all([
    $.session.model().catch(() => null),
    $.config.list().then(r => r.find(x => x.key === 'model')).catch(() => undefined),
  ])
  await update($, model, () => id)
  if (id !== null && id.startsWith('claude-')) {
    const o = await ogrenilenler($)
    const temiz = id.replace(/\[1m\]$/i, '')
    if (o[aileOf(id)] !== temiz) await $.store.set('modelKimlikleri', { ...o, [aileOf(id)]: temiz }).catch(() => undefined)
  }
  if (satir?.options !== undefined) {
    await update($, modelOptions, () => menuSecenekleri(satir.options ?? []))
  }
}

async function projeYukle($: EngineInterface) {
  kok = await $.session.root().catch(() => '')
  const harita = ((await $.store.get('projeModelleri').catch(() => undefined)) ?? {}) as Record<string, string>
  const secim = harita[kok] ?? null
  await update($, projeModeli, () => secim)
  projeKimligi = secim === null ? undefined : kimlikCoz(secim, await ogrenilenler($))
}

async function projeModeliYaz($: EngineInterface, secim: string | null) {
  const harita = ((await $.store.get('projeModelleri').catch(() => undefined)) ?? {}) as Record<string, string>
  const { [kok]: _, ...diger } = harita
  await $.store.set('projeModelleri', secim === null ? diger : { ...diger, [kok]: secim }).catch(() => undefined)
  await update($, projeModeli, () => secim)
  projeKimligi = secim === null ? undefined : kimlikCoz(secim, await ogrenilenler($))
}

// Her modele 1 token'lık bir istek: yanıt veren planda var. Başka bir model
// yanıt verirken 429/403/404 alan planda yok (Fable gibi kredi isteyenler 429 döner).
async function erisimDenetle($: EngineInterface) {
  const secenekler = (await read($, modelOptions)).filter(s => s !== 'default')
  const kayit = ((await $.store.get('erisim')) ?? {}) as ErisimKaydi
  const simdi = await $.clock.now()
  const taze = (s: string) => kayit[s] !== undefined && simdi - (kayit[s]?.at ?? 0) < ERISIM_SURESI
  const bakilacak = secenekler.filter(s => !taze(s))
  const gorunen = (): Record<string, Erisim> =>
    Object.fromEntries(secenekler.filter(taze).map(s => [s, kayit[s]?.durum ?? 'var']))
  await update($, erisim, () => ({ ...gorunen(), ...Object.fromEntries(bakilacak.map(s => [s, 'bakiliyor' as const])) }))
  if (bakilacak.length === 0) return

  const o = await ogrenilenler($)
  const sonuclar = await Promise.all(
    bakilacak.map(async s => {
      const id = kimlikCoz(s, o)
      const r = id === undefined ? undefined : await $.model.complete({ model: id, prompt: 'ok', maxTokens: 1 }).catch(() => undefined)
      return [s, r] as const
    }),
  )
  const yanitlayan = (r: (typeof sonuclar)[number][1]) => r !== undefined && (r.isAnswered || r.reason === 'empty-reply')
  const biriCalisiyor = sonuclar.some(([, r]) => yanitlayan(r)) || secenekler.some(s => taze(s) && kayit[s]?.durum === 'var')
  const yeni: ErisimKaydi = { ...kayit }
  for (const [s, r] of sonuclar) {
    if (yanitlayan(r)) {
      yeni[s] = { durum: 'var', at: simdi }
    } else if (r !== undefined && !r.isAnswered && r.reason === 'api-error' && (r.status === 403 || r.status === 404 || (r.status === 429 && biriCalisiyor))) {
      yeni[s] = { durum: 'yok', at: simdi }
    }
  }
  await $.store.set('erisim', yeni)
  await update($, erisim, () =>
    Object.fromEntries(secenekler.flatMap(s => (yeni[s] !== undefined && simdi - (yeni[s]?.at ?? 0) < ERISIM_SURESI ? [[s, yeni[s]?.durum ?? 'var']] : []))),
  )
}

const klasorAdi = (yol: string) => yol.replace(/\/+$/, '').split('/').pop() ?? yol

// `git rev-parse --abbrev-ref HEAD --show-toplevel --git-dir --git-common-dir` çıktısı.
// Bağlı bir worktree'nin git-dir'i ana deponun `.git/worktrees/<ad>` klasörüdür.
export const gitCoz = (cikti: string, kisaCommit: string | null = null): Git | null => {
  const [dal, ust, gitDir, ortak] = cikti.split('\n').map(s => s.trim())
  if (!dal || !ust || !gitDir || !ortak) return null
  const anaKok = ortak.replace(/\/\.git\/?$/, '')

  return {
    branch: dal === 'HEAD' ? null : dal,
    commit: dal === 'HEAD' ? kisaCommit : null,
    tree: klasorAdi(ust),
    isWorktree: gitDir !== ortak,
    repo: klasorAdi(anaKok === ortak ? klasorAdi(ortak) : anaKok),
  }
}

async function gitYenile($: EngineInterface) {
  const r = await $.process
    .run(['git', 'rev-parse', '--abbrev-ref', 'HEAD', '--path-format=absolute', '--show-toplevel', '--git-dir', '--git-common-dir'], { timeoutMs: 5_000 })
    .catch(() => undefined)
  let sonuc: Git | null = null
  if (r?.exitCode === 0) {
    const ayrik = r.stdout.startsWith('HEAD\n')
    const kisa = ayrik
      ? await $.process.run(['git', 'rev-parse', '--short', 'HEAD'], { timeoutMs: 5_000 }).then(x => x.stdout.trim() || null).catch(() => null)
      : null
    sonuc = gitCoz(r.stdout, kisa)
  }
  const eski = await read($, git)
  if (JSON.stringify(eski) !== JSON.stringify(sonuc)) await update($, git, () => sonuc)
}

// `git for-each-ref --format=%(refname:short)%09%(worktreepath)` çıktısı; bu
// çalışma ağacında açık dalın worktree'si sayılmaz.
export const dallariCoz = (cikti: string, buAgac: string): Dal[] =>
  cikti
    .split('\n')
    .map(s => s.split('\t'))
    .filter(([ad]) => ad !== undefined && ad.trim() !== '')
    .map(([ad = '', yol = '']) => ({ ad: ad.trim(), worktree: yol.trim() !== '' && yol.trim() !== buAgac ? yol.trim() : null }))

// `git worktree list --porcelain` çıktısı; ilk kayıt ana çalışma ağacıdır.
export const worktreeleriCoz = (cikti: string): Worktree[] =>
  cikti
    .split(/\n\s*\n/)
    .map(blok => blok.split('\n'))
    .flatMap((satirlar, i) => {
      const yol = satirlar.find(s => s.startsWith('worktree '))?.slice('worktree '.length).trim()
      if (yol === undefined || satirlar.some(s => s === 'bare')) return []
      const dal = satirlar.find(s => s.startsWith('branch '))?.slice('branch '.length).replace(/^refs\/heads\//, '').trim() ?? null
      return [{ yol, ad: klasorAdi(yol), dal, ana: i === 0 }]
    })

// Şeritten yapılan geçiş Claude'a bir sonraki mesajda söylenir.
let bekleyenNot: string | undefined
// Bu oturumda EnterWorktree ile bir worktree'ye girildi mi; ana ağaca dönüş ExitWorktree ile.
let worktreeyeGirildi = false

async function git$($: EngineInterface, argv: string[]) {
  return $.process.run(['git', ...argv], { timeoutMs: 15_000 }).catch(() => undefined)
}

async function gitListeleriYenile($: EngineInterface) {
  const [ust, refs, wt] = await Promise.all([
    git$($, ['rev-parse', '--show-toplevel']),
    git$($, ['for-each-ref', '--sort=-committerdate', '--count=15', '--format=%(refname:short)%09%(worktreepath)', 'refs/heads']),
    git$($, ['worktree', 'list', '--porcelain']),
  ])
  const buAgac = ust?.stdout.trim() ?? ''
  await update($, dallar, () => (refs?.exitCode === 0 ? dallariCoz(refs.stdout, buAgac) : []))
  await update($, worktreeler, () => (wt?.exitCode === 0 ? worktreeleriCoz(wt.stdout) : []))
}

async function gitMenuAc($: EngineInterface, tur: 'dal' | 'worktree') {
  await update($, isModelMenuOpen, () => false)
  const acik = await update($, gitMenu, m => (m === tur ? null : tur))
  if (acik !== null) await gitListeleriYenile($)
}

async function dalaGec($: EngineInterface, ad: string) {
  await update($, gitMenu, () => null)
  const r = await git$($, ['switch', ad])
  if (r === undefined || r.exitCode !== 0) {
    const neden = (r?.stderr ?? '').split('\n').find(s => s.trim() !== '')?.replace(/^[^\s:]{1,15}: /, '') ?? 'git çalışmadı'
    $.ui.toast(`⎇ ${ad} dalına geçilemedi: ${neden}`)
    return
  }
  await gitYenile($)
  bekleyenNot = `Kullanıcı şeritten "${ad}" dalına geçti (git switch). Dosyalar bu dala göre değişmiş olabilir.`
  $.ui.toast(`⎇ ${ad} dalına geçildi`)
}

async function worktreeyeGec($: EngineInterface, w: Worktree) {
  await update($, gitMenu, () => null)
  const cikis = w.ana && worktreeyeGirildi
  const r = cikis
    ? await $.tool.call({ tool: 'ExitWorktree', action: 'keep' }).catch((h: unknown) => ({ deny: String(h) }))
    : await $.tool.call({ tool: 'EnterWorktree', path: w.yol }).catch((h: unknown) => ({ deny: String(h) }))
  if (r.deny !== undefined || r.isError === true) {
    $.ui.toast(`🌳 ${w.ad} worktree'sine geçilmedi${r.deny !== undefined ? '' : `: ${(r.text ?? '').replace(/<\/?tool_use_error>/g, '').slice(0, 120)}`}`)
    return
  }
  worktreeyeGirildi = !w.ana
  await gitYenile($)
  await projeYukle($)
  bekleyenNot = `Kullanıcı şeritten ${w.ana ? 'ana çalışma ağacına' : `"${w.ad}" worktree'sine`} geçti (${w.yol}${w.dal === null ? '' : `, dal ${w.dal}`}). Oturumun çalışma klasörü artık orası.`
  $.ui.toast(`${w.ana ? '📁' : '🌳'} ${w.ad} ${w.ana ? 'ana çalışma ağacına' : "worktree'sine"} geçildi`)
}

// `65_000` → `1 dk 5 sn`
export const sureYaz = (ms: number) => {
  const sn = Math.max(0, Math.round(ms / 1000))
  return sn >= 60 ? `${Math.floor(sn / 60)} dk ${sn % 60} sn` : `${sn} sn`
}

const ajanGuncelle = ($: EngineInterface, id: string, fn: (a: AltAjan) => AltAjan) =>
  update($, ajanlar, list => list.map(a => (a.id === id ? fn(a) : a)))

// Kaydı olmayan bir ajan (forked skill gibi agent.spawn'sız döngüler) ilk görüldüğünde eklenir.
async function ajanBul($: EngineInterface, id: string) {
  if ((await read($, ajanlar)).some(a => a.id === id)) return
  const bilgi = (await $.agent.list().catch(() => [])).find(a => a.id === id)
  const simdi = await $.clock.now()
  await update($, ajanlar, list =>
    list.some(a => a.id === id)
      ? list
      : [...list, {
          id,
          tur: bilgi?.type ?? 'ajan',
          aciklama: bilgi?.description ?? '',
          model: null,
          durum: 'calisiyor' as const,
          basladi: simdi,
          bitti: null,
          arac: 0,
          sonArac: null,
          token: 0,
          ustId: bilgi?.parentId ?? null,
        }],
  )
}

async function menuyuAc($: EngineInterface) {
  await update($, gitMenu, () => null)
  const acik = await update($, isModelMenuOpen, a => !a)
  if (acik) await erisimDenetle($)
}

async function modeleGec($: EngineInterface, secenek: string) {
  await update($, isModelMenuOpen, () => false)
  if ((await read($, erisim))[secenek] === 'yok') {
    $.ui.toast(`🔒 ${secenekAdi(secenek)} planına dahil değil`)
    return
  }
  const u = await read($, usage)
  if (secenek !== 'default' && !uzunMu(secenek) && (u.contextTokens ?? 0) > 190_000) {
    $.ui.toast(`Bağlam 200K'yı aşıyor: önce /compact yap ya da ${secenekAdi(secenek)} (1M) seç`)
    return
  }
  await projeModeliYaz($, secenek === 'default' ? null : secenek)
  const genel = await read($, model)
  $.ui.toast(
    secenek === 'default'
      ? `🤖 Bu proje genel modeli kullanıyor${genel === null ? '' : ` (${modelAdi(genel)})`}`
      : `🤖 Bu projede: ${modelAdi(projeKimligi ?? secenek)}`,
  )
}

const sayi = (n: number) => n.toLocaleString('tr-TR')
const kisa = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`
const cubuk = (yuzde: number, genislik: number) => {
  const dolu = Math.round((Math.min(100, Math.max(0, yuzde)) / 100) * genislik)
  return '█'.repeat(dolu) + '░'.repeat(genislik - dolu)
}

const LIMIT_ADI: Record<string, string> = {
  five_hour: '5 saatlik',
  seven_day: 'Haftalık',
  spend_limit: 'Harcama',
}
const saatYaz = (d: Date) => d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

// `bugün 19:59`, `yarın 14:54`, daha ilerisi için `Sal 09:00`; takvim gününe göre.
export const goreliTarih = (ms: number, now: number) => {
  const d = new Date(ms)
  const gun = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const fark = Math.round((gun(d) - gun(new Date(now))) / 86_400_000)
  const on = fark === 0 ? 'bugün' : fark === 1 ? 'yarın' : d.toLocaleDateString('tr-TR', { weekday: 'short' })
  return `${on} ${saatYaz(d)}`
}

// `6 sa 15 dk sonra`, `1 gün 3 sa sonra`
export const kalanYaz = (ms: number) => {
  const dk = Math.max(0, Math.floor(ms / 60_000))
  if (dk < 60) return `${dk} dk sonra`
  const sa = Math.floor(dk / 60)
  if (sa < 24) return `${sa} sa${dk % 60 > 0 ? ` ${dk % 60} dk` : ''} sonra`
  return `${Math.floor(sa / 24)} gün${sa % 24 > 0 ? ` ${sa % 24} sa` : ''} sonra`
}

const sifirlanma = (iso: string | undefined, kind: string, now: number) => {
  if (iso === undefined) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // 5 saatlik pencere hep bugüne yakındır: yalnızca saat; diğerleri göreli tarih.
  return kind === 'five_hour' && goreliTarih(d.getTime(), now).startsWith('bugün')
    ? ` ↻${saatYaz(d)}`
    : ` ↻${goreliTarih(d.getTime(), now)}`
}
// `mcp__context7__query-docs` → `context7`; MCP olmayan araçta undefined.
const sunucu = (tool: string) => (tool.startsWith('mcp__') ? tool.split('__')[1] : undefined)
const sunucuAdi = (s: string) => s.replace(/^claude_ai_/, 'claude.ai ').replace(/^plugin_[^_]+_/, '')
const ekle = (r: Record<string, number>, k: string, n: number) => {
  const v = (r[k] ?? 0) + n
  const { [k]: _, ...rest } = r
  return v > 0 ? { ...rest, [k]: v } : rest
}
const topla = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

const PENCERE_MS: Record<string, number> = { seven_day: 7 * 24 * 3_600_000 }
// Pencerenin başından beri ortalama kullanım hızıyla %100'e ulaşılacak an.
const bitisTahmini = (l: Limit, now: number): number | undefined => {
  const pencere = PENCERE_MS[l.kind]
  const reset = l.resetsAt === undefined ? NaN : new Date(l.resetsAt).getTime()
  if (pencere === undefined || Number.isNaN(reset) || l.percentUsed <= 0) return undefined
  const gecen = now - (reset - pencere)
  if (gecen < 3_600_000) return undefined
  if (l.percentUsed >= 100) return now

  return Math.round(now + ((100 - l.percentUsed) / l.percentUsed) * gecen)
}
// Ayarlardaki açık plugin'ler: `{ "design@marketplace": true }` → `design`.
async function pluginYenile($: EngineInterface) {
  const { enabledPlugins } = await $.settings.read().catch(() => ({ enabledPlugins: undefined }))
  const acik =
    enabledPlugins !== null && typeof enabledPlugins === 'object'
      ? Object.entries(enabledPlugins as Record<string, unknown>)
          .filter(([, v]) => v === true)
          .map(([k]) => k.split('@')[0] ?? k)
      : []
  await update($, plugins, p => ({ ...p, active: [...new Set(acik)].sort() }))
}

// Bir araç çağrısının hangi plugin'den geldiği: plugin MCP sunucusu
// (`mcp__plugin_<ad>_<sunucu>__araç`), `<ad>:skill` ya da `<ad>:ajan`.
const pluginBul = (tool: string, girdi: Record<string, unknown>, acik: readonly string[]) => {
  const s = sunucu(tool)
  if (s !== undefined && s.startsWith('plugin_')) {
    const ad = acik.find(p => s.startsWith(`plugin_${p.replace(/[^A-Za-z0-9-]/g, '_')}_`))
    return ad ?? s.slice('plugin_'.length).split('_')[0]
  }
  const ad = tool === 'Skill' ? girdi.skill : tool === 'Agent' ? girdi.subagent_type : undefined
  return typeof ad === 'string' && ad.includes(':') ? ad.split(':')[0] : undefined
}
const turaEkle = (list: readonly string[], ad: string) => (list.includes(ad) ? [...list] : [...list, ad])

const limitler = (list: readonly Limit[], now: number): Limit[] =>
  list.map(l => ({
    kind: l.kind,
    percentUsed: l.percentUsed,
    resetsAt: l.resetsAt,
    bitis: bitisTahmini(l, now),
  }))


const AYLAR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// `/usage`'ın sıfırlanma zamanı: `Oct 24, 7:59pm (Europe/Istanbul)` ya da `7:59pm`,
// bu makinenin saat diliminde; geçmişte kalırsa bir sonraki gün ya da yıl.
export const sifirlanmaCoz = (metin: string, now: number): string | undefined => {
  const m = metin
    .replace(/\(.*?\)/g, '')
    .trim()
    .match(/^(?:([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (m === null) return undefined
  const [, ay, gun, saatS = '0', dk = '0', ogle = 'am'] = m
  let saat = Number(saatS) % 12
  if (ogle.toLowerCase() === 'pm') saat += 12
  const simdi = new Date(now)
  if (ay !== undefined && gun !== undefined) {
    const ayNo = AYLAR.indexOf(ay.toLowerCase())
    if (ayNo < 0) return undefined
    const d = new Date(simdi.getFullYear(), ayNo, Number(gun), saat, Number(dk))
    if (d.getTime() < now - 2 * 86_400_000) d.setFullYear(d.getFullYear() + 1)
    return d.toISOString()
  }
  const d = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate(), saat, Number(dk))
  if (d.getTime() < now) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

// `/usage` çıktısındaki 5 saatlik ve haftalık satırlar.
export const usageCoz = (metin: string, now: number): Limit[] => {
  const satirlar: [string, RegExp][] = [
    ['five_hour', /^Current session:\s*([\d.]+)% used(?:\s*·\s*resets\s+(.+?))?\s*$/im],
    ['seven_day', /^Current week \(all models\):\s*([\d.]+)% used(?:\s*·\s*resets\s+(.+?))?\s*$/im],
  ]
  return satirlar.flatMap(([kind, desen]) => {
    const m = metin.match(desen)
    if (m === null || m[1] === undefined) return []
    return [{ kind, percentUsed: Number(m[1]), resetsAt: m[2] === undefined ? undefined : sifirlanmaCoz(m[2], now) }]
  })
}

// Bu makinedeki tüm oturumlar en taze limitleri modun ortak deposunda paylaşır.
let limitZamani = 0

async function limitYaz($: EngineInterface, liste: readonly Limit[], at: number, kaynak: 'oturum' | 'paylasim' | 'usage') {
  const simdi = await $.clock.now()
  const ham = liste.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt }))
  await update($, usage, u => {
    const yeni = limitler(ham, simdi)
    // /usage'ın göstermediği türler (harcama limiti gibi) korunur.
    return { ...u, limits: [...yeni, ...u.limits.filter(l => !yeni.some(y => y.kind === l.kind))] }
  })
  limitZamani = at
  await update($, limitDurumu, d => ({ ...d, at, kaynak }))
  if (kaynak !== 'paylasim') {
    await $.store.set('sonLimitler', { at, limits: ham }).catch(() => undefined)
  }
}

async function paylasimOku($: EngineInterface) {
  const kayit = (await $.store.get('sonLimitler').catch(() => undefined)) as { at?: number; limits?: Limit[] } | undefined
  if (kayit?.at !== undefined && Array.isArray(kayit.limits) && kayit.at > limitZamani && kayit.limits.length > 0) {
    await limitYaz($, kayit.limits, kayit.at, 'paylasim')
  }
}

// `/usage` sizin oturumunuzda bir ayarlar ekranı açar; bu yüzden ayrı, görünmez bir
// `claude -p` sürecinde çalıştırılır: model isteği yok, sohbete satır düşmez.
const USAGE_ARGV = ['claude', '-p', '/usage', '--strict-mcp-config', '--no-session-persistence']
const OTOMATIK_ARALIK = 5 * 60_000
const ETKIN_SURE = 30 * 60_000

// Son kullanıcı etkinliği; boşta bekleyen oturum otomatik yenileme yapmaz.
let sonEtkinlik = 0

async function usageCek($: EngineInterface) {
  const simdi = await $.clock.now()
  // Aynı anda tek oturum: kilit bir dakika geçerli.
  await $.store.set('usageKilit', simdi).catch(() => undefined)
  const r = await $.process.run(USAGE_ARGV, { timeoutMs: 60_000, stdin: '' }).catch(() => undefined)
  const liste = r?.exitCode === 0 ? usageCoz(r.stdout, await $.clock.now()) : []
  if (liste.length > 0) await limitYaz($, liste, await $.clock.now(), 'usage')
  return liste.length > 0
}

async function usageYenile($: EngineInterface) {
  if ((await read($, limitDurumu)).yenileniyor) return
  await update($, limitDurumu, d => ({ ...d, yenileniyor: true }))
  try {
    if (!(await usageCek($))) $.ui.toast('Limitler okunamadı (claude -p /usage çalışmadı)')
  } finally {
    await update($, limitDurumu, d => ({ ...d, yenileniyor: false }))
  }
}

async function otomatikYenile($: EngineInterface) {
  const simdi = await $.clock.now()
  if (simdi - sonEtkinlik > ETKIN_SURE || (await read($, limitDurumu)).yenileniyor) return
  const kilit = (await $.store.get('usageKilit').catch(() => undefined)) as number | undefined
  if (simdi - limitZamani < OTOMATIK_ARALIK || (kilit !== undefined && simdi - kilit < 60_000)) return
  await usageYenile($)
}

const once = (ms: number) =>
  ms < 60_000 ? 'şimdi' : ms < 3_600_000 ? `${Math.floor(ms / 60_000)} dk önce` : `${Math.floor(ms / 3_600_000)} sa önce`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'maliyet',
      description: 'Token ve maliyet şeridini gösterir ya da gizler',
    })
    await $.ui.close({ id: ESKI_PANEL })
    await update($, tools, t => ({ ...t, running: {} }))
    await pluginYenile($)
    await update($, plugins, p => ({ ...p, running: {}, thisTurn: [] }))
    await update($, isModelMenuOpen, () => false)
    await update($, gitMenu, () => null)
    await update($, ajanlar, () => [])
    // Çalışan bir ajan varken süreler her saniye ilerlesin.
    $.clock.every(1000, () => {
      void read($, ajanlar)
        .then(list => (list.some(a => a.durum === 'calisiyor') ? $.clock.now().then(n => update($, saat, () => n)) : undefined))
        .catch(() => undefined)
    })
    await modelYenile($)
    await projeYukle($)
    await gitYenile($)
    const now = await $.session.usage()
    const simdi = await $.clock.now()
    await update($, usage, u => ({
      ...u,
      usd: now.cost?.usd ?? u.usd,
      contextTokens: now.context.tokens ?? u.contextTokens,
      contextWindow: now.context.window,
      contextPercent: now.context.percent ?? u.contextPercent,
    }))
    if (now.rateLimits.length > 0) await limitYaz($, now.rateLimits, simdi, 'oturum')
    sonEtkinlik = simdi
    await paylasimOku($)
    // Başka bir oturumun ölçtüğü daha taze limitler 30 saniyede bir alınır.
    $.clock.every(30_000, () => {
      void paylasimOku($)
        .then(() => otomatikYenile($))
        .then(() => $.clock.now())
        .then(n => update($, saat, () => n))
        .catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'maliyet' }, async $ => {
    const hidden = await update($, isHidden, h => !h)

    return { text: hidden ? 'Maliyet şeridi gizlendi.' : 'Maliyet şeridi gösteriliyor.' }
  })

  // /model ya da /config ile model seçen kullanıcı onu ister: projenin seçimi kalkar.
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const r = await next(e)
    await modelYenile($)
    if (e.args.trim() !== '' && (await read($, projeModeli)) !== null) {
      await projeModeliYaz($, null)
      $.ui.toast('🤖 Bu projenin şeritten seçilen modeli kaldırıldı; /model ile seçilen geçerli')
    }
    return r
  }).catch(($, e, next) => next(e))

  on('config.set', { key: 'model' }, async ($, e, next) => {
    const r = await next(e)
    await modelYenile($)
    if (r.deny === undefined && (await read($, projeModeli)) !== null) {
      await projeModeliYaz($, null)
    }
    return r
  }).catch(($, e, next) => next(e))

  // Bu projede seçili model ana döngünün her isteğinde kullanılır; alt ajanlar kendi modelinde kalır.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.agentId !== undefined) {
      const id = r.agentId
      const simdi = await $.clock.now()
      await update($, ajanlar, list => [
        ...list.filter(a => a.id !== id),
        {
          id,
          tur: e.subagentType || 'general-purpose',
          aciklama: e.description,
          model: r.model,
          durum: 'calisiyor' as const,
          basladi: simdi,
          bitti: null,
          arac: 0,
          sonArac: null,
          token: 0,
          ustId: e.parentAgentId ?? null,
        },
      ])
      await update($, saat, () => simdi)
    }
    return r
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      const id = e.agentId
      await ajanBul($, id).catch(() => undefined)
      await ajanGuncelle($, id, a => ({ ...a, model: e.model, durum: 'calisiyor', bitti: null })).catch(() => undefined)
    }
    if (e.agentId === undefined && projeKimligi !== undefined && e.model !== projeKimligi) {
      return yield* next({ ...e, model: projeKimligi })
    }
    return yield* next(e)
  })

  on('session.measure', async ($, e, next) => {
    const simdi = await $.clock.now()
    await update($, usage, u => ({
      ...u,
      usd: e.cost?.usd ?? u.usd,
      contextTokens: e.context.tokens ?? u.contextTokens,
      contextWindow: e.context.window,
      contextPercent: e.context.percent ?? u.contextPercent,
    }))
    if (e.rateLimits.length > 0) await limitYaz($, e.rateLimits, simdi, 'oturum')

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    sonEtkinlik = await $.clock.now().catch(() => sonEtkinlik)
    if (e.command === undefined) {
      await update($, plugins, p => ({ ...p, thisTurn: [] }))
      // Yeni bir istekte biten ajanlar listeden çıkar; çalışanlar kalır.
      if ((e.origin?.kind ?? 'composer') === 'composer') {
        await update($, ajanlar, list => list.filter(a => a.durum === 'calisiyor'))
      }
    }
    if (e.command === undefined && bekleyenNot !== undefined) {
      const not = bekleyenNot
      bekleyenNot = undefined
      return next({ ...e, context: [...(e.context ?? []), not] })
    }

    return next(e)
  })

  // Slash komutuyla çağrılan plugin skill'leri; Skill aracıyla gelenler tool.call'da sayılır.
  let skillAraci = 0
  on('skill.prompt', async ($, e, next) => {
    const ad = e.pluginName
    if (ad !== undefined && skillAraci === 0) {
      await update($, plugins, p => ({ ...p, calls: ekle(p.calls, ad, 1), thisTurn: turaEkle(p.thisTurn, ad) }))
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await update($, tools, t => ({ ...t, running: ekle(t.running, e.tool, 1) }))
    const ajanId = e.agentId
    if (ajanId !== undefined) await ajanGuncelle($, ajanId, a => ({ ...a, sonArac: e.tool }))
    const plugin = pluginBul(e.tool, e as unknown as Record<string, unknown>, (await read($, plugins)).active)
    if (e.tool === 'Skill') skillAraci += 1
    if (plugin !== undefined) {
      await update($, plugins, p => ({
        ...p,
        running: ekle(p.running, plugin, 1),
        thisTurn: turaEkle(p.thisTurn, plugin),
      }))
    }
    let hata = true
    try {
      const ran = await next(e)
      hata = ran.deny !== undefined || ran.isError === true
      return ran
    } finally {
      await update($, tools, t => ({
        ...t,
        running: ekle(t.running, e.tool, -1),
        calls: ekle(t.calls, e.tool, 1),
        errors: t.errors + (hata ? 1 : 0),
      }))
      if (e.tool === 'Skill') skillAraci -= 1
      if (ajanId !== undefined) await ajanGuncelle($, ajanId, a => ({ ...a, arac: a.arac + 1, sonArac: null }))
      // Dal ya da worktree değiştiren araçlardan sonra şerit hemen güncellensin.
      if (e.tool === 'Bash' || e.tool === 'EnterWorktree' || e.tool === 'ExitWorktree') await gitYenile($)
      if (plugin !== undefined) {
        await update($, plugins, p => ({
          ...p,
          running: ekle(p.running, plugin, -1),
          calls: ekle(p.calls, plugin, 1),
        }))
      }
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      const simdi = await $.clock.now()
      const t = e.usage
      const harcanan = t === undefined ? 0 : t.input_tokens + t.output_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
      await ajanGuncelle($, id, a => ({
        ...a,
        durum: e.isAborted ? 'durdu' : e.reason === 'error' ? 'hata' : 'bitti',
        bitti: simdi,
        sonArac: null,
        token: a.token + harcanan,
      }))
    }
    if (e.agentId === undefined) {
      await pluginYenile($)
      await modelYenile($)
      await gitYenile($)
    }
    const t = e.usage
    if (e.agentId === undefined && t !== undefined) {
      await update($, usage, u => ({
        ...u,
        inputTokens: u.inputTokens + t.input_tokens,
        outputTokens: u.outputTokens + t.output_tokens,
        cacheReadTokens: u.cacheReadTokens + t.cache_read_input_tokens,
        cacheWriteTokens: u.cacheWriteTokens + t.cache_creation_input_tokens,
        turns: u.turns + 1,
      }))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const u = await read($, usage)
    const id = await read($, model)
    const secenekler = await read($, modelOptions)
    const menuAcik = await read($, isModelMenuOpen)
    const toplam = u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens
    const barGenislik = Math.max(10, Math.min(40, e.props.bodyColumns - 50))

    const proje = await read($, projeModeli)
    const durumlar = await read($, erisim)
    const etkin = proje === null ? id : (kimlikCoz(proje) ?? proje)
    const projeAdi = kok.split('/').filter(Boolean).pop() ?? 'bu proje'
    const g = await read($, git)
    const acikGit = await read($, gitMenu)
    const modelSatiri = (
      <Box key="model" flexDirection="row">
        <Text>🤖 </Text>
        <Button key="model-sec" onPress={() => menuyuAc($)}>
          <Text bold>{etkin === null ? 'Model' : modelAdi(etkin)}</Text>
          {proje === null ? '' : ' 📌'} {menuAcik ? '▴' : '▾'}
        </Button>
        {menuAcik ? (
          <Text dimColor>  seçim yalnızca {projeAdi} için geçerli · 🔒 planına dahil değil</Text>
        ) : proje === null ? null : (
          <Text dimColor>  {projeAdi} için seçildi</Text>
        )}
        {g === null || menuAcik ? null : (
          <Box key="git" flexDirection="row">
            <Text>   </Text>
            <Button key="git-dal" onPress={() => gitMenuAc($, 'dal')}>
              <Text color="magenta">⎇ {g.branch ?? `ayrık HEAD ${g.commit ?? ''}`.trim()}</Text> {acikGit === 'dal' ? '▴' : '▾'}
            </Button>
            <Text>  </Text>
            <Button key="git-worktree" onPress={() => gitMenuAc($, 'worktree')}>
              {g.isWorktree ? <Text color="cyan">🌳 {g.tree}</Text> : <Text>📁 {g.tree}</Text>}{' '}
              {acikGit === 'worktree' ? '▴' : '▾'}
            </Button>
            <Text dimColor>  {g.isWorktree ? `worktree · ${g.repo}` : 'ana çalışma ağacı'}</Text>
          </Box>
        )}
      </Box>
    )
    const modelMenusu = menuAcik && secenekler.length > 0 ? (
      <Box key="model-menu" flexDirection="row" flexWrap="wrap" paddingLeft={3}>
        {secenekler.map(s => {
          const secili = proje === null ? s === 'default' : s === proje
          const durum = durumlar[s]
          const isim = secenekAdi(s, id)
          return (
            <Box key={s} marginRight={2}>
              <Button key={`model:${s}`} plain onPress={() => (secili ? update($, isModelMenuOpen, () => false) : modeleGec($, s))}>
                {durum === 'yok' ? (
                  <Text dimColor>🔒 {isim}</Text>
                ) : durum === 'bakiliyor' ? (
                  <Text dimColor>… {isim}</Text>
                ) : (
                  <Text color={secili ? 'green' : undefined} bold={secili}>
                    {secili ? '● ' : '○ '}
                    {isim}
                  </Text>
                )}
              </Button>
            </Box>
          )
        })}
      </Box>
    ) : null

    const dalListesi = await read($, dallar)
    const agaclar = await read($, worktreeler)
    const gitMenusu = g === null || acikGit === null ? null : acikGit === 'dal' ? (
      <Box key="git-menu" flexDirection="row" flexWrap="wrap" paddingLeft={3}>
        {dalListesi.length === 0 ? <Text dimColor>dal bulunamadı</Text> : null}
        {dalListesi.map(d => {
          const secili = d.ad === g.branch
          const agac = d.worktree === null ? undefined : agaclar.find(w => w.yol === d.worktree)
          return (
            <Box key={d.ad} marginRight={2}>
              <Button
                key={`dal:${d.ad}`}
                plain
                onPress={() =>
                  secili
                    ? update($, gitMenu, () => null)
                    : agac !== undefined
                      ? worktreeyeGec($, agac)
                      : dalaGec($, d.ad)
                }
              >
                {d.worktree !== null ? (
                  <Text dimColor>🌳 {d.ad}</Text>
                ) : (
                  <Text color={secili ? 'green' : undefined} bold={secili}>
                    {secili ? '● ' : '○ '}
                    {d.ad}
                  </Text>
                )}
              </Button>
            </Box>
          )
        })}
        <Text dimColor>🌳 başka bir worktree'de açık: tıklayınca oraya geçilir</Text>
      </Box>
    ) : (
      <Box key="git-menu" flexDirection="row" flexWrap="wrap" paddingLeft={3}>
        {agaclar.map(w => {
          const secili = w.ad === g.tree
          return (
            <Box key={w.yol} marginRight={2}>
              <Button key={`worktree:${w.yol}`} plain onPress={() => (secili ? update($, gitMenu, () => null) : worktreeyeGec($, w))}>
                <Text color={secili ? 'green' : undefined} bold={secili}>
                  {secili ? '● ' : '○ '}
                  {w.ana ? '📁' : '🌳'} {w.ad}
                </Text>
                <Text dimColor> {w.dal ?? 'ayrık'}</Text>
              </Button>
            </Box>
          )
        })}
        {agaclar.length <= 1 ? <Text dimColor>başka worktree yok (git worktree add ile oluşturulur)</Text> : null}
      </Box>
    )

    const satirlar = [
      modelSatiri,
      ...(modelMenusu === null ? [] : [modelMenusu]),
      ...(gitMenusu === null ? [] : [gitMenusu]),
      <Text key="ozet">
        <Text bold>💰 {u.usd === null ? '—' : `$${u.usd.toFixed(4)}`}</Text>
        {'   '}Bağlam {cubuk(u.contextPercent ?? 0, barGenislik)}{' '}
        {u.contextPercent === null ? '—' : `%${u.contextPercent}`}
        {u.contextTokens === null || u.contextWindow === null
          ? ''
          : ` (${kisa(u.contextTokens)} / ${kisa(u.contextWindow)})`}
      </Text>,
      <Text key="token" dimColor>
        Tur {sayi(u.turns)} · Girdi {kisa(u.inputTokens)} · Çıktı {kisa(u.outputTokens)} · Cache
        okuma {kisa(u.cacheReadTokens)} · Cache yazma {kisa(u.cacheWriteTokens)} · Toplam{' '}
        {sayi(toplam)}
      </Text>,
    ]

    const a = await read($, tools)
    const toplamCagri = topla(a.calls)
    const calisan = topla(a.running)
    if (toplamCagri > 0 || calisan > 0) {
      const yerel: Record<string, number> = {}
      for (const [k, v] of Object.entries(a.calls)) if (sunucu(k) === undefined) yerel[k] = v
      const enCok = Object.entries(yerel).sort((x, y) => y[1] - x[1]).slice(0, 6)
      const mcpToplam = Object.entries(a.calls).filter(([k]) => sunucu(k) !== undefined).reduce((n, [, v]) => n + v, 0)
      const calisanlar = Object.keys(a.running).map(k => sunucu(k) === undefined ? k : sunucuAdi(sunucu(k) ?? k))
      satirlar.push(
        <Text key="arac">
          🔧 {enCok.map(([k, v]) => `${k} ${v}`).join(' · ')}
          {mcpToplam > 0 ? ` · MCP ${mcpToplam}` : ''}
          <Text dimColor>
            {'  '}(toplam {toplamCagri}
            {a.errors > 0 ? `, ${a.errors} hata` : ''})
          </Text>
          {calisan > 0 ? <Text color="cyan">  ⟳ {calisanlar.join(', ')}</Text> : ''}
        </Text>,
      )
    }

    const pl = await read($, plugins)
    // Yalnızca bu oturumda kullanılan ya da şu an çalışan plugin'ler.
    const gorunen = [...new Set([...Object.keys(pl.calls), ...Object.keys(pl.running), ...pl.thisTurn])]
    if (gorunen.length > 0) {
      const sira = (ad: string) =>
        (pl.running[ad] ?? 0) > 0 ? 0 : pl.thisTurn.includes(ad) ? 1 : 2
      gorunen.sort((x, y) => sira(x) - sira(y) || x.localeCompare(y))
      satirlar.push(
        <Text key="plugin">
          🧩 Plugin{' '}
          {gorunen.map((ad, i) => {
            const durum = sira(ad)
            return (
              <Text key={ad}>
                {i > 0 ? ' · ' : ''}
                <Text color={durum === 0 ? 'cyan' : durum === 1 ? 'magenta' : 'green'}>
                  {durum === 0 ? '⟳' : durum === 1 ? '▶' : '●'}
                </Text>{' '}
                {durum <= 1 ? <Text bold>{ad}</Text> : ad}
                <Text dimColor> {pl.calls[ad] ?? 0}</Text>
              </Text>
            )
          })}
        </Text>,
      )
    }

    // Yalnızca bu oturumda çağrılan ya da şu an çalışan MCP sunucuları.
    const sunucuCagri: Record<string, number> = {}
    for (const [k, v] of Object.entries(a.calls)) {
      const s = sunucu(k)
      if (s !== undefined) sunucuCagri[s] = (sunucuCagri[s] ?? 0) + v
    }
    const aktif = new Set(Object.keys(a.running).map(sunucu).filter(s => s !== undefined))
    const kullanilan = [...new Set([...Object.keys(sunucuCagri), ...aktif])].sort(
      (x, y) => Number(aktif.has(y)) - Number(aktif.has(x)) || x.localeCompare(y),
    )
    const ajanListesi = await read($, ajanlar)
    if (ajanListesi.length > 0) {
      // `saat` okunur ki zamanlayıcı her saniye yeniden çizdirsin; süre gerçek saatten.
      await read($, saat)
      const simdi = await $.clock.now()
      const calisan = ajanListesi.filter(a => a.durum === 'calisiyor').length
      const derinlik = (a: AltAjan): number => {
        let d = 0
        let ust = a.ustId
        while (ust !== null && d < 3) {
          d += 1
          ust = ajanListesi.find(x => x.id === ust)?.ustId ?? null
        }
        return d
      }
      const gorunen = [...ajanListesi.filter(a => a.durum === 'calisiyor'), ...ajanListesi.filter(a => a.durum !== 'calisiyor').reverse()].slice(0, 6)
      satirlar.push(
        <Box key="ajanlar" flexDirection="column">
          <Text>
            👥 Alt ajanlar{' '}
            {calisan > 0 ? <Text color="cyan">{calisan} çalışıyor</Text> : <Text dimColor>hepsi bitti</Text>}
            {ajanListesi.length - calisan > 0 ? <Text dimColor> · {ajanListesi.length - calisan} bitti</Text> : ''}
          </Text>
          {gorunen.map(a => {
            const aktif = a.durum === 'calisiyor'
            const isaret = aktif ? '⟳' : a.durum === 'bitti' ? '✓' : a.durum === 'hata' ? '✗' : '■'
            const renk = aktif ? 'cyan' : a.durum === 'bitti' ? 'green' : a.durum === 'hata' ? 'red' : 'yellow'
            return (
              <Text key={a.id} dimColor={!aktif}>
                {'   '}{'  '.repeat(derinlik(a))}
                <Text color={renk}>{isaret}</Text> <Text bold={aktif}>{a.tur}</Text>
                {a.model === null ? '' : <Text color="magenta"> {modelAdi(a.model)}</Text>}
                {a.aciklama === '' ? '' : ` · ${a.aciklama}`}
                <Text dimColor>
                  {' · '}{sureYaz((a.bitti ?? simdi) - a.basladi)} · {a.arac} araç
                  {a.token > 0 ? ` · ${kisa(a.token)} token` : ''}
                </Text>
                {aktif && a.sonArac !== null ? <Text color="cyan"> ▸ {a.sonArac}</Text> : ''}
              </Text>
            )
          })}
          {ajanListesi.length > gorunen.length ? <Text dimColor>{'   '}+{ajanListesi.length - gorunen.length} ajan daha</Text> : null}
        </Box>,
      )
    }

    if (kullanilan.length > 0) {
      satirlar.push(
        <Text key="mcp">
          🔌 MCP{' '}
          {kullanilan.map((s, i) => (
            <Text key={s}>
              {i > 0 ? ' · ' : ''}
              <Text color={aktif.has(s) ? 'cyan' : 'green'}>
                {aktif.has(s) ? '⟳' : '●'}
              </Text>{' '}
              {sunucuAdi(s)}
              <Text dimColor> {sunucuCagri[s] ?? 0}</Text>
            </Text>
          ))}
        </Text>,
      )
    }

    const ld = await read($, limitDurumu)
    await read($, saat)
    const limitSimdi = await $.clock.now().catch(() => ld.at)
    const yenileDugmesi = (
      <Button key="limit-yenile" plain onPress={() => usageYenile($)}>
        <Text color="cyan">{ld.yenileniyor ? ' … yenileniyor' : ' ↻'}</Text>
      </Button>
    )
    if (u.limits.length > 0) {
      const limitBar = Math.max(6, Math.min(20, Math.floor((e.props.bodyColumns - 70) / 2)))
      satirlar.push(
        <Box key="limit" flexDirection="row">
          <Text>
            {u.limits.map((l, i) => (
              <Text key={l.kind}>
                {i > 0 ? '   ' : ''}
                {LIMIT_ADI[l.kind] ?? l.kind}{' '}
                <Text color={l.percentUsed >= 90 ? 'red' : l.percentUsed >= 70 ? 'yellow' : 'green'}>
                  {cubuk(l.percentUsed, limitBar)} %{l.percentUsed}
                </Text>
                <Text dimColor>{sifirlanma(l.resetsAt, l.kind, limitSimdi)}</Text>
                {l.bitis === undefined ? (
                  ''
                ) : l.resetsAt !== undefined && l.bitis >= new Date(l.resetsAt).getTime() ? (
                  <Text color="green"> · bu hızla yetişir</Text>
                ) : (
                  <Text color={l.percentUsed >= 70 ? 'red' : 'yellow'}> · tahmini bitiş {goreliTarih(l.bitis, limitSimdi)} ({kalanYaz(l.bitis - limitSimdi)})</Text>
                )}
              </Text>
            ))}
            {ld.at > 0 ? <Text dimColor>   {once(limitSimdi - ld.at)}</Text> : ''}
          </Text>
          {yenileDugmesi}
        </Box>,
      )
    } else {
      satirlar.push(
        <Box key="limit" flexDirection="row">
          <Text dimColor>Limitler henüz bilinmiyor</Text>
          {yenileDugmesi}
        </Box>,
      )
    }

    return (
      <Box
        key="maliyet"
        flexDirection="column"
        borderStyle="round"
        borderDimColor
        paddingX={1}
      >
        {satirlar}
      </Box>
    )
  })
}

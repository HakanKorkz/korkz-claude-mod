import type { EngineInterface, Register } from 'claude-code'

type Ayarlar = {
  /** Bu süreden uzun süren bir iş bitince haber verilir (saniye). */
  esik: number
  ses: boolean
  /** Hiç haber verme (toast hariç). */
  sessiz: boolean
  /** Etkin pencere bu terminalse ses ve bildirim verme. */
  odak: boolean
}

const VARSAYILAN: Ayarlar = { esik: 60, ses: true, sessiz: false, odak: false }

const SES = '/usr/share/sounds/freedesktop/stereo'

// Onay bekleyen bildirimler; idle_prompt iş bitti bildirimiyle çakışır.
const ONAY_TURLERI = new Set(['permission_prompt', 'elicitation_dialog'])

type SesTuru = 'bitti' | 'hata' | 'onay'

const SESLER: Record<SesTuru, { oga: string; canberra: string; mac: string }> = {
  bitti: { oga: 'complete', canberra: 'complete', mac: 'Glass' },
  hata: { oga: 'dialog-warning', canberra: 'dialog-warning', mac: 'Basso' },
  onay: { oga: 'message-new-instant', canberra: 'message-new-instant', mac: 'Ping' },
}

export const sure = (sn: number) =>
  sn >= 60 ? `${Math.floor(sn / 60)} dk ${sn % 60} sn` : `${sn} sn`

// Claude'un cevabının ilk anlamlı satırı, markdown işaretleri olmadan.
export const ozet = (cevap: string, uzunluk = 90) => {
  const satir = cevap
    .split('\n')
    .map(s => s.replace(/^[\s#>*\-+|`]+|[*_`]+/g, '').trim())
    .find(s => s.length > 0)
  if (satir === undefined) return ''

  return satir.length > uzunluk ? `${satir.slice(0, uzunluk - 1)}…` : satir
}

export const ayarlariOku = (deger: unknown): Ayarlar => ({
  ...VARSAYILAN,
  ...(typeof deger === 'object' && deger !== null ? (deger as Partial<Ayarlar>) : {}),
})

// `/is-bitti` argümanını ayarlara uygular; anlaşılmazsa undefined.
export const komutuUygula = (a: Ayarlar, args: string): Ayarlar | undefined => {
  const [ilk = '', ikinci = ''] = args.trim().toLowerCase().split(/\s+/)
  const acik = ikinci === 'aç' || ikinci === 'ac' || ikinci === 'on'
  const kapali = ikinci === 'kapat' || ikinci === 'off'

  if (/^\d+$/.test(ilk)) return { ...a, esik: Number(ilk) }
  if (ilk === 'sustur' || ilk === 'sessiz') return { ...a, sessiz: true }
  if (ilk === 'aç' || ilk === 'ac') return { ...a, sessiz: false }
  if (ilk === 'ses' && (acik || kapali)) return { ...a, ses: acik }
  if (ilk === 'odak' && (acik || kapali)) return { ...a, odak: acik }
  if (ilk === 'sıfırla' || ilk === 'sifirla') return { ...VARSAYILAN }

  return undefined
}

const durumMetni = (a: Ayarlar) =>
  [
    a.sessiz ? 'is-bitti susturuldu.' : `is-bitti: ${sure(a.esik)} üstü işlerde haber veriyor.`,
    `Ses: ${a.ses ? 'açık' : 'kapalı'} · Odaktayken sus: ${a.odak ? 'açık' : 'kapalı'}`,
    'Kullanım: /is-bitti 30 · sustur · aç · ses aç|kapat · odak aç|kapat · sıfırla',
  ].join('\n')

// Sırayla dener, ilk çalışan komutta durur; hiçbiri çalışmazsa false.
async function ilkCalisan($: EngineInterface, komutlar: readonly (readonly string[])[]) {
  for (const argv of komutlar) {
    const r = await $.process.run(argv, { timeoutMs: 10_000 }).catch(() => undefined)
    if (r?.exitCode === 0) return true
  }
  return false
}

async function sesCal($: EngineInterface, tur: SesTuru) {
  const s = SESLER[tur]
  return ilkCalisan($, [
    ['paplay', `${SES}/${s.oga}.oga`],
    ['pw-play', `${SES}/${s.oga}.oga`],
    ['canberra-gtk-play', '-i', s.canberra],
    ['afplay', `/System/Library/Sounds/${s.mac}.aiff`],
  ])
}

async function bildir($: EngineInterface, baslik: string, mesaj: string, tur: SesTuru) {
  const ikon = tur === 'bitti' ? 'dialog-information' : 'dialog-warning'
  const gonderildi = await ilkCalisan($, [
    ['notify-send', '-a', 'Claude Code', '-i', ikon, baslik, mesaj],
    ['osascript', '-e', `display notification ${JSON.stringify(mesaj)} with title ${JSON.stringify(baslik)}`],
  ])
  if (!gonderildi) {
    await $.ui.notify(mesaj, { title: baslik }).catch(() => undefined)
  }
}

// Etkin pencerenin süreci bu oturumun atalarından biriyse kullanıcı terminale bakıyordur.
// Yalnızca X11/XWayland pencerelerinde çalışır; anlaşılmazsa "bakmıyor" sayılır.
async function terminaleBakiyor($: EngineInterface) {
  const r = await $.process
    .run(['sh', '-c', 'w=$(xdotool getactivewindow getwindowpid) || exit 1; p=$PPID; while [ "$p" -gt 1 ]; do [ "$p" = "$w" ] && exit 0; p=$(ps -o ppid= -p "$p" | tr -d " "); done; exit 1'], { timeoutMs: 3_000 })
    .catch(() => undefined)
  return r?.exitCode === 0
}

let proje = ''
// Kullanıcının son prompt'u gönderdiği an; arka plan işleri turu bölse de süre buradan ölçülür.
let baslangic: number | undefined
let sonOnay = -Infinity

async function ayarlar($: EngineInterface) {
  return ayarlariOku(await $.store.get('ayarlar'))
}

async function haberVer($: EngineInterface, tur: SesTuru, mesaj: string, ek = '') {
  const a = await ayarlar($)
  $.ui.toast(`${tur === 'bitti' ? '✅' : tur === 'hata' ? '⚠️' : '⏳'} ${mesaj}`)
  if (a.sessiz || (a.odak && (await terminaleBakiyor($)))) return

  const baslik = proje === '' ? 'Claude Code' : `Claude Code · ${proje}`
  await Promise.all([
    a.ses ? sesCal($, tur) : Promise.resolve(false),
    bildir($, baslik, ek === '' ? mesaj : `${mesaj}\n${ek}`, tur),
  ])
}

async function onayBekliyor($: EngineInterface, mesaj: string) {
  const simdi = await $.clock.now()
  // Aynı onay için hem araç hem bildirim olayı gelebilir.
  if (simdi - sonOnay < 5_000) return
  sonOnay = simdi
  await haberVer($, 'onay', mesaj)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'is-bitti',
      description: 'İş bitti bildirimlerinin ayarları',
      argumentHint: '[saniye | sustur | aç | ses aç|kapat | odak aç|kapat | sıfırla]',
      immediate: true,
    })
    const kok = await $.session.root().catch(() => '')
    proje = kok.split('/').filter(Boolean).pop() ?? ''

    return next(e)
  })

  on('command.run', { command: 'is-bitti' }, async ($, e) => {
    const eski = await ayarlar($)
    if (e.args.trim() === '') return { text: durumMetni(eski) }

    const yeni = komutuUygula(eski, e.args)
    if (yeni === undefined) return { text: `Anlaşılmadı: "${e.args}"\n${durumMetni(eski)}` }
    await $.store.set('ayarlar', yeni)

    return { text: durumMetni(yeni) }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command === undefined) baslangic = await $.clock.now()

    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.Notification', async ($, e, next) => {
    const r = await next(e)
    if (e.agent_id === undefined && ONAY_TURLERI.has(e.notification_type)) {
      await onayBekliyor($, 'Claude onay bekliyor')
    }
    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if (e.agentId === undefined) {
      await onayBekliyor($, 'Claude bir soru soruyor').catch(() => undefined)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    if (e.isAborted) {
      baslangic = undefined
      return ran
    }

    const simdi = await $.clock.now()
    const sn = Math.round(Math.max(e.durationMs, baslangic === undefined ? 0 : simdi - baslangic) / 1000)
    const a = await ayarlar($)
    if (sn < a.esik) return ran

    baslangic = undefined
    const hata = e.reason === 'error'
    await haberVer($, hata ? 'hata' : 'bitti', hata ? `İş hatayla bitti (${sure(sn)})` : `İş bitti (${sure(sn)})`, ozet(e.answer))

    return ran
  })
}

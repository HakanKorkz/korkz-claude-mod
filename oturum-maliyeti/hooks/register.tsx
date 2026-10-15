import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Tools, Usage } from '../types'

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
  mcpServers: [],
} as Tools)
const isHidden = atom({ plugin: 'oturum-maliyeti', key: 'isHidden' } as const, false)

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
const sifirlanma = (iso: string | undefined, kind: string) => {
  if (iso === undefined) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const saat = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return kind === 'five_hour'
    ? ` ↻${saat}`
    : ` ↻${d.toLocaleDateString('tr-TR', { weekday: 'short' })} ${saat}`
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

// Araçları görünen MCP sunucularını bağlı sayar.
async function mcpYenile($: EngineInterface) {
  const list = await $.tool.list()
  const servers = [...new Set(list.filter(t => t.mcp).map(t => sunucu(t.name)).filter(s => s !== undefined))]
  await update($, tools, t => ({ ...t, mcpServers: servers.sort() }))
}

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
const tarih = (ms: number) => {
  const d = new Date(ms)
  return `${d.toLocaleDateString('tr-TR', { weekday: 'short' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}
const limitler = (list: readonly Limit[], now: number): Limit[] =>
  list.map(l => ({
    kind: l.kind,
    percentUsed: l.percentUsed,
    resetsAt: l.resetsAt,
    bitis: bitisTahmini(l, now),
  }))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'maliyet',
      description: 'Token ve maliyet şeridini gösterir ya da gizler',
    })
    await $.ui.close({ id: ESKI_PANEL })
    await update($, tools, t => ({ ...t, running: {} }))
    await mcpYenile($)
    const now = await $.session.usage()
    const simdi = await $.clock.now()
    await update($, usage, u => ({
      ...u,
      usd: now.cost?.usd ?? u.usd,
      contextTokens: now.context.tokens ?? u.contextTokens,
      contextWindow: now.context.window,
      contextPercent: now.context.percent ?? u.contextPercent,
      limits: now.rateLimits.length > 0 ? limitler(now.rateLimits, simdi) : u.limits,
    }))

    return next(e)
  })

  on('command.run', { command: 'maliyet' }, async $ => {
    const hidden = await update($, isHidden, h => !h)

    return { text: hidden ? 'Maliyet şeridi gizlendi.' : 'Maliyet şeridi gösteriliyor.' }
  })

  on('session.measure', async ($, e, next) => {
    const simdi = await $.clock.now()
    await update($, usage, u => ({
      ...u,
      usd: e.cost?.usd ?? u.usd,
      contextTokens: e.context.tokens ?? u.contextTokens,
      contextWindow: e.context.window,
      contextPercent: e.context.percent ?? u.contextPercent,
      limits: e.rateLimits.length > 0 ? limitler(e.rateLimits, simdi) : u.limits,
    }))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await update($, tools, t => ({ ...t, running: ekle(t.running, e.tool, 1) }))
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
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await mcpYenile($)
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

    const { Box, Text } = $.ui.resolve(e)
    const u = await read($, usage)
    const toplam = u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens
    const barGenislik = Math.max(10, Math.min(40, e.props.bodyColumns - 50))

    const satirlar = [
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

    if (a.mcpServers.length > 0) {
      const sunucuCagri: Record<string, number> = {}
      for (const [k, v] of Object.entries(a.calls)) {
        const s = sunucu(k)
        if (s !== undefined) sunucuCagri[s] = (sunucuCagri[s] ?? 0) + v
      }
      const aktif = new Set(Object.keys(a.running).map(sunucu).filter(s => s !== undefined))
      satirlar.push(
        <Text key="mcp">
          🔌 MCP{' '}
          {a.mcpServers.map((s, i) => (
            <Text key={s}>
              {i > 0 ? ' · ' : ''}
              <Text color={aktif.has(s) ? 'cyan' : (sunucuCagri[s] ?? 0) > 0 ? 'green' : 'gray'}>
                {aktif.has(s) ? '⟳' : '●'}
              </Text>{' '}
              {sunucuAdi(s)}
              <Text dimColor> {sunucuCagri[s] ?? 0}</Text>
            </Text>
          ))}
        </Text>,
      )
    }

    if (u.limits.length > 0) {
      const limitBar = Math.max(6, Math.min(20, Math.floor((e.props.bodyColumns - 60) / 2)))
      satirlar.push(
        <Text key="limit">
          {u.limits.map((l, i) => (
            <Text key={l.kind}>
              {i > 0 ? '   ' : ''}
              {LIMIT_ADI[l.kind] ?? l.kind}{' '}
              <Text color={l.percentUsed >= 90 ? 'red' : l.percentUsed >= 70 ? 'yellow' : 'green'}>
                {cubuk(l.percentUsed, limitBar)} %{l.percentUsed}
              </Text>
              <Text dimColor>{sifirlanma(l.resetsAt, l.kind)}</Text>
              {l.bitis === undefined ? (
                ''
              ) : l.resetsAt !== undefined && l.bitis >= new Date(l.resetsAt).getTime() ? (
                <Text color="green"> · bu hızla yetişir</Text>
              ) : (
                <Text color={l.percentUsed >= 70 ? 'red' : 'yellow'}> · tahmini bitiş {tarih(l.bitis)}</Text>
              )}
            </Text>
          ))}
        </Text>,
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

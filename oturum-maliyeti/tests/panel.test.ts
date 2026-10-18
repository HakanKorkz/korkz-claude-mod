import { expect, mock, test } from 'claude-code/testing'
import { gitCoz, kimlikCoz, menuSecenekleri, modelAdi, secenekAdi } from '../hooks/register'

test('şerit tur tokenlarını ve maliyeti gösterir', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-15T06:00:00Z') })
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('tool.list', () => ({ value: [
    { name: 'Bash', description: '', mcp: false },
    { name: 'mcp__context7__query-docs', description: '', mcp: true },
    { name: 'mcp__claude_ai_Gmail__create_draft', description: '', mcp: true },
  ] }) as never)
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await $.tool.call({ tool: 'mcp__context7__query-docs', libraryId: 'x', query: 'y' } as never)
  await $.turn.complete({
    answer: '', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer',
    usage: { model: 'm', input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  })
  await $.session.measure({ context: { tokens: 50_000, window: 200_000, percent: 25 }, rateLimits: [{ kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-15T14:30:00Z' }, { kind: 'seven_day', percentUsed: 92, resetsAt: '2026-10-19T06:00:00Z' }], cost: { usd: 0.1234 }, changed: ['cost', 'rateLimits'] })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 }, viewport: { rows: 40, columns: 125 } } as never)
    expect(await ui.find({ type: 'Text', text: /\$0\.1234/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /%25/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Tur 1 ·/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /5 saatlik .*%23\.5 ↻17:30/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Haftalık .*%92 ↻Pzt 09:00 · tahmini bitiş Per 15:15/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /🔧 Bash 2 · MCP 1 .*toplam 3/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /🔌 MCP ● context7 1$/ })).toBeDefined()
    await ui.unmount()
  }

  await $.command.run({ command: 'maliyet', args: '' } as never)
  const gizli = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } } as never)
  expect(await gizli.find({ type: 'Text', text: /Bağlam/ })).toBeUndefined()
  await gizli.unmount()
})

test('haftalık limit bu hızla yetişecekse söyler', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-15T06:00:00Z') })
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({ context: { window: 200_000 }, rateLimits: [{ kind: 'seven_day', percentUsed: 20, resetsAt: '2026-10-19T06:00:00Z' }], changed: ['rateLimits'] })
  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } } as never)
  expect(await ui.find({ type: 'Text', text: /Haftalık .*%20 ↻Pzt 09:00 · bu hızla yetişir/ })).toBeDefined()
  await ui.unmount()
})

test('açık plugin\'leri ve kullanılanı gösterir', async ($, on) => {
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('settings.read', () => ({ value: { enabledPlugins: { 'design@resmi': true, 'context7@resmi': true, 'stitch@resmi': true, 'kapali@x': false } } }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't0', reason: 'answer' })
  await $.tool.call({ tool: 'mcp__plugin_context7_context7__query-docs', libraryId: 'x', query: 'y' } as never)
  await $.tool.call({ tool: 'Skill', skill: 'design:ux-copy' } as never)
  await $.tool.call({ tool: 'Skill', skill: 'design:design-critique' } as never)

  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 160 } } as never)
  const satir = (await ui.findAll({ type: 'Text', text: /🧩 Plugin/ }))[0]?.text ?? ''
  expect(satir).toMatch(/▶ context7 1 · ▶ design 2/)
  expect(satir).not.toContain('kapali')
  expect(satir).not.toContain('stitch')
  await ui.unmount()
})

test('model seçimi yalnızca bu projede geçerli, plana dahil olmayan kilitli', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-15T06:00:00Z') })
  let kok = '/home/k/projeB'
  const store = new Map<string, unknown>()
  const toasts: string[] = []
  const denenen: string[] = []
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('session.model', () => ({ value: 'claude-opus-5-5' }) as never)
  on('session.root', () => ({ value: kok }) as never)
  on('session.usage', () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }) as never)
  on('store.get', ($, e) => ({ value: store.get((e as unknown as { key: string }).key) }) as never)
  on('store.set', ($, e) => {
    const { key, value } = e as unknown as { key: string; value: unknown }
    store.set(key, value)
    return { value: undefined } as never
  })
  on('config.list', () => ({ value: [{ key: 'model', label: 'Model', kind: 'choice', value: 'opus', options: ['default', 'sonnet', 'opus', 'fable', 'best', 'opus[1m]', 'opusplan'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false }] }) as never)
  on('model.complete', ($, e) => {
    const m = (e as unknown as { model: string }).model
    denenen.push(m)
    return { value: m.includes('fable')
      ? { isAnswered: false, reason: 'api-error', status: 429, error: 'rate_limit', usage: {} }
      : { isAnswered: true, text: 'ok', usage: {} } } as never
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('session.start', () => ({ cwd: kok }) as never)
  const gidenler: string[] = []
  on('turn.step', async function* ($, e) {
    gidenler.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  await $.session.start({ source: 'startup', cwd: kok } as never)

  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 140 } } as never)
  expect(await ui.find({ type: 'Text', text: /^Opus 5\.5$/ })).toBeDefined()

  await ui.press({ key: 'model-sec' })
  expect(denenen.sort()).toEqual(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5-5[1m]', 'claude-sonnet-5-5'])
  expect(await ui.find({ type: 'Text', text: /● Genel ayar \(Opus 5\.5\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🔒 Fable/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /○ Opus \(1M\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Opus plan|En iyi/ })).toBeUndefined()

  // Kilitli model seçilmez.
  await ui.press({ key: 'model:fable' })
  expect(toasts.at(-1)).toContain('planına dahil değil')

  await ui.press({ key: 'model-sec' })
  await ui.press({ key: 'model:sonnet' })
  expect(toasts.at(-1)).toBe('🤖 Bu projede: Sonnet 5.5')
  expect(store.get('projeModelleri')).toEqual({ '/home/k/projeB': 'sonnet' })
  expect(await ui.find({ type: 'Text', text: /^Sonnet 5\.5$/ })).toBeDefined()
  await ui.unmount()

  // Ana döngünün istekleri seçilen modelle gider, alt ajanlarınki değişmez.
  const adim = (agentId?: string) => ({ turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of $.turn.step(adim())) { /* akış */ }
  for await (const _ of $.turn.step(adim('alt'))) { /* akış */ }
  expect(gidenler).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5'])

  // Başka bir projede seçim yok, genel model kullanılır.
  kok = '/home/k/projeA'
  await $.session.start({ source: 'startup', cwd: kok } as never)
  gidenler.length = 0
  for await (const _ of $.turn.step(adim())) { /* akış */ }
  expect(gidenler).toEqual(['claude-opus-5-5'])
})

test('model adları ve kimlikleri', () => {
  expect(modelAdi('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelAdi('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(modelAdi('claude-fable-5-1[1m]')).toBe('Fable 5.1 (1M)')
  expect(kimlikCoz('sonnet[1m]')).toBe('claude-sonnet-5-5[1m]')
  expect(kimlikCoz('opus', { opus: 'claude-opus-6-0' })).toBe('claude-opus-6-0')
  expect(kimlikCoz('bilinmeyen')).toBeUndefined()
  expect(secenekAdi('opus[1m]')).toBe('Opus (1M)')
  expect(menuSecenekleri(['default', 'best', 'haiku', 'opusplan'])).toEqual(['default', 'haiku'])
})

test('git çıktısından dal ve worktree', () => {
  expect(gitCoz('main\n/p/claude-mods\n/p/claude-mods/.git\n/p/claude-mods/.git\n')).toEqual({
    branch: 'main', commit: null, tree: 'claude-mods', isWorktree: false, repo: 'claude-mods',
  })
  expect(gitCoz('ozellik\n/w/ozellik-wt\n/p/claude-mods/.git/worktrees/ozellik-wt\n/p/claude-mods/.git\n')).toEqual({
    branch: 'ozellik', commit: null, tree: 'ozellik-wt', isWorktree: true, repo: 'claude-mods',
  })
  expect(gitCoz('HEAD\n/p/x\n/p/x/.git\n/p/x/.git\n', 'abc1234')?.commit).toBe('abc1234')
  expect(gitCoz('')).toBeNull()
})

test('şerit dalı ve worktree\'yi gösterir, Bash sonrası yeniler', async ($, on) => {
  let cikti = 'main\n/p/claude-mods\n/p/claude-mods/.git\n/p/claude-mods/.git\n'
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('session.model', () => ({ value: 'claude-opus-5-5' }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: cikti, stderr: '' } }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })

  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 140 } } as never)
  expect(await ui.find({ type: 'Text', text: /⎇ main/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /📁 claude-mods \(ana çalışma ağacı\)/ })).toBeDefined()

  cikti = 'ozellik\n/w/ozellik-wt\n/p/claude-mods/.git/worktrees/ozellik-wt\n/p/claude-mods/.git\n'
  await $.tool.call({ tool: 'Bash', command: 'cd /w/ozellik-wt' })
  expect(await ui.find({ type: 'Text', text: /⎇ ozellik/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🌳 ozellik-wt/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /worktree · claude-mods/ })).toBeDefined()
  await ui.unmount()
})

import { expect, mock, test } from 'claude-code/testing'
import { dallariCoz, gitCoz, kimlikCoz, menuSecenekleri, modelAdi, secenekAdi, sifirlanmaCoz, usageCoz, worktreeleriCoz } from '../hooks/register'

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
  expect(await ui.find({ type: 'Text', text: /📁 claude-mods/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ana çalışma ağacı/ })).toBeDefined()

  cikti = 'ozellik\n/w/ozellik-wt\n/p/claude-mods/.git/worktrees/ozellik-wt\n/p/claude-mods/.git\n'
  await $.tool.call({ tool: 'Bash', command: 'cd /w/ozellik-wt' })
  expect(await ui.find({ type: 'Text', text: /⎇ ozellik/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🌳 ozellik-wt/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /worktree · claude-mods/ })).toBeDefined()
  await ui.unmount()
})

const WT_LISTE = 'worktree /p/claude-mods\nHEAD aaa\nbranch refs/heads/main\n\nworktree /w/ozellik-wt\nHEAD bbb\nbranch refs/heads/ozellik\n\nworktree /w/ayrik\nHEAD ccc\ndetached\n'

test('dal ve worktree listeleri', () => {
  expect(dallariCoz('main\t/p/claude-mods\nozellik\t/w/ozellik-wt\ndiger\t\n', '/p/claude-mods')).toEqual([
    { ad: 'main', worktree: null },
    { ad: 'ozellik', worktree: '/w/ozellik-wt' },
    { ad: 'diger', worktree: null },
  ])
  expect(worktreeleriCoz(WT_LISTE)).toEqual([
    { yol: '/p/claude-mods', ad: 'claude-mods', dal: 'main', ana: true },
    { yol: '/w/ozellik-wt', ad: 'ozellik-wt', dal: 'ozellik', ana: false },
    { yol: '/w/ayrik', ad: 'ayrik', dal: null, ana: false },
  ])
})

test('şeritten dala ve worktree\'ye geçilir, Claude\'a not düşülür', async ($, on) => {
  let dal = 'main'
  let agac = '/p/claude-mods'
  const komutlar: string[][] = []
  const toasts: string[] = []
  const araclar: unknown[] = []
  let gelenBaglam: readonly string[] = []
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('session.model', () => ({ value: 'claude-opus-5-5' }) as never)
  on('process.run', ($, e) => {
    const argv = [...(e as unknown as { argv: string[] }).argv]
    komutlar.push(argv)
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } }) as never
    if (argv.includes('--git-common-dir')) {
      const gd = agac === '/p/claude-mods' ? '/p/claude-mods/.git' : `/p/claude-mods/.git/worktrees/${agac.split('/').pop()}`
      return ok(`${dal}\n${agac}\n${gd}\n/p/claude-mods/.git\n`)
    }
    if (argv[1] === 'rev-parse') return ok(`${agac}\n`)
    if (argv[1] === 'for-each-ref') return ok('main\t/p/claude-mods\ndiger\t\nozellik\t/w/ozellik-wt\n')
    if (argv[1] === 'worktree') return ok(WT_LISTE)
    if (argv[1] === 'switch') {
      if (argv[2] === 'bozuk') return { value: { exitCode: 128, stdout: '', stderr: 'fatal: invalid reference: bozuk\n' } } as never
      dal = argv[2] ?? dal
      return ok('')
    }
    return ok('')
  })
  on('tool.call', ($, e) => {
    araclar.push(e)
    if (e.tool === 'EnterWorktree') agac = (e as unknown as { path: string }).path
    if (e.tool === 'EnterWorktree') dal = 'ozellik'
    return { result: {}, text: 'ok' } as never
  })
  on('prompt.submit', ($, e) => { gelenBaglam = e.context ?? []; return { text: e.text } })
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })

  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 160 } } as never)

  await ui.press({ key: 'git-dal' })
  expect(await ui.find({ type: 'Text', text: /● main/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /○ diger/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🌳 ozellik/ })).toBeDefined()

  await ui.press({ key: 'dal:diger' })
  expect(komutlar.some(a => a.join(' ') === 'git switch diger')).toBe(true)
  expect(toasts.at(-1)).toBe('⎇ diger dalına geçildi')
  expect(await ui.find({ type: 'Text', text: /⎇ diger/ })).toBeDefined()

  await $.prompt.submit({ text: 'devam' } as never)
  expect(gelenBaglam.join(' ')).toContain('"diger" dalına geçti')
  await $.prompt.submit({ text: 'sonraki' } as never)
  expect(gelenBaglam.length).toBe(0)

  // Başka worktree'de açık dala tıklamak o worktree'ye geçirir.
  await ui.press({ key: 'git-dal' })
  await ui.press({ key: 'dal:ozellik' })
  expect(araclar.at(-1)).toMatchObject({ tool: 'EnterWorktree', path: '/w/ozellik-wt' })
  expect(toasts.at(-1)).toBe("🌳 ozellik-wt worktree'sine geçildi")
  expect(await ui.find({ type: 'Text', text: /🌳 ozellik-wt/ })).toBeDefined()

  // Ana çalışma ağacına dönüş ExitWorktree ile.
  await ui.press({ key: 'git-worktree' })
  expect(await ui.find({ type: 'Text', text: /● 🌳 ozellik-wt/ })).toBeDefined()
  await ui.press({ key: 'worktree:/p/claude-mods' })
  expect(araclar.at(-1)).toMatchObject({ tool: 'ExitWorktree', action: 'keep' })
  await ui.unmount()
})

test('dal değişmezse git hatası gösterilir', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    if (argv[1] === 'switch') return { value: { exitCode: 1, stdout: '', stderr: 'error: Your local changes would be overwritten by checkout\n' } } as never
    if (argv.includes('--git-common-dir')) return { value: { exitCode: 0, stdout: 'main\n/p/x\n/p/x/.git\n/p/x/.git\n', stderr: '' } } as never
    return { value: { exitCode: 0, stdout: argv[1] === 'for-each-ref' ? 'main\t/p/x\nbaska\t\n' : '', stderr: '' } } as never
  })
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 160 } } as never)
  await ui.press({ key: 'git-dal' })
  await ui.press({ key: 'dal:baska' })
  expect(toasts.at(-1)).toBe('⎇ baska dalına geçilemedi: Your local changes would be overwritten by checkout')
  expect(await ui.find({ type: 'Text', text: /⎇ main/ })).toBeDefined()
  await ui.unmount()
})

test('alt ajanlar: tür, model, görev, süre, araç ve durum', async ($, on) => {
  const saat = mock.clock(on, { now: Date.parse('2026-10-24T10:00:00Z') })
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('agent.spawn', ($, e) => ({ model: e.subagentType === 'Explore' ? 'claude-haiku-5-5' : 'claude-opus-5-5', agentId: e.subagentType === 'Explore' ? 'a1' : 'a2' }))
  on('agent.list', () => ({ value: [] }) as never)
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', ($, e) => ({ text: e.text }))

  const spawn = (subagentType: string, description: string) =>
    $.agent.spawn({ prompt: 'x', description, subagentType, provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5' } as never)
  await spawn('Explore', 'dosyaları ara')
  await spawn('general-purpose', 'testleri düzelt')

  // a2 alt istekte Sonnet'e geçer, a1 bir Grep çalıştırırken görülür.
  for await (const _ of $.turn.step({ turnId: 't2', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'a2' })) { /* akış */ }
  await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/x', agentId: 'a1' } as never)
  await saat.advance(65_000)

  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 30, bodyColumns: 160 } } as never)
  expect(await ui.find({ type: 'Text', text: /👥 Alt ajanlar 2 çalışıyor/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /⟳ Explore Haiku 5\.5 · dosyaları ara · 1 dk 5 sn · 2 araç/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /⟳ general-purpose Sonnet 5\.5 · testleri düzelt/ })).toBeDefined()

  await $.turn.complete({
    answer: 'bulundu', durationMs: 65_000, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1',
    usage: { model: 'claude-haiku-5-5', input_tokens: 9000, output_tokens: 1000, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 },
  })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't2', reason: 'error', agentId: 'a2' })
  expect(await ui.find({ type: 'Text', text: /👥 Alt ajanlar hepsi bitti · 2 bitti/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /✓ Explore .*12\.0K token/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /✗ general-purpose/ })).toBeDefined()

  // Kullanıcının yeni mesajında biten ajanlar listeden kalkar.
  await $.prompt.submit({ text: 'devam' } as never)
  expect(await ui.find({ type: 'Text', text: /Alt ajanlar/ })).toBeUndefined()
  await ui.unmount()
})

const USAGE_METNI = `You are currently using your subscription to power your Claude Code usage

Current session: 37% used · resets Oct 24, 7:59pm (Europe/Istanbul)
Current week (all models): 84% used · resets Oct 25, 3:59pm (Europe/Istanbul)

What's contributing to your limits usage?`

test('/usage metni okunur', () => {
  const simdi = new Date(2026, 9, 24, 15, 0).getTime()
  const l = usageCoz(USAGE_METNI, simdi)
  expect(l.map(x => [x.kind, x.percentUsed])).toEqual([['five_hour', 37], ['seven_day', 84]])
  expect(new Date(l[0]?.resetsAt ?? '').getHours()).toBe(19)
  expect(new Date(l[1]?.resetsAt ?? '').getDate()).toBe(25)
  // Tarihsiz saat geçmişte kalırsa ertesi gün.
  expect(new Date(sifirlanmaCoz('2:00pm', simdi) ?? '').getDate()).toBe(25)
  expect(sifirlanmaCoz('yarın', simdi)).toBeUndefined()
  expect(usageCoz('başka bir metin', simdi)).toEqual([])
})

test('başka oturumun limitleri paylaşılır, ↻ ile /usage çekilir', async ($, on) => {
  const saat = mock.clock(on, { now: new Date(2026, 9, 24, 15, 0).getTime() })
  const store = new Map<string, unknown>()
  let usageCagri = 0
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, { key: 'bos' }) as never })
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.usage', () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }) as never)
  on('session.start', () => ({ cwd: '/p' }) as never)
  on('store.get', ($, e) => ({ value: store.get((e as unknown as { key: string }).key) }) as never)
  on('store.set', ($, e) => {
    const { key, value } = e as unknown as { key: string; value: unknown }
    store.set(key, value)
    return { value: undefined } as never
  })
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    if (argv.includes('/usage')) usageCagri += 1
    return { value: { exitCode: 0, stdout: argv.includes('/usage') ? USAGE_METNI : '', stderr: '' } } as never
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.start({ source: 'startup', cwd: '/p' } as never)

  const ui = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 160 } } as never)
  expect(await ui.find({ type: 'Text', text: /Limitler henüz bilinmiyor/ })).toBeDefined()

  // Bu oturum ölçer: değer depoya yazılır.
  await $.session.measure({ context: { window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 32, resetsAt: '2026-10-24T16:59:00Z' }], changed: ['rateLimits'] })
  expect((store.get('sonLimitler') as { limits: { percentUsed: number }[] }).limits[0]?.percentUsed).toBe(32)
  expect(await ui.find({ type: 'Text', text: /5 saatlik .*%32/ })).toBeDefined()

  // Başka bir oturum daha taze bir değer yazar; 30 sn içinde buraya gelir.
  await saat.advance(60_000)
  store.set('sonLimitler', { at: new Date(2026, 9, 24, 15, 1).getTime(), limits: [{ kind: 'five_hour', percentUsed: 35, resetsAt: '2026-10-24T16:59:00Z' }] })
  await saat.advance(30_000)
  expect(await ui.find({ type: 'Text', text: /5 saatlik .*%35/ })).toBeDefined()

  // ↻ /usage'ı ayrı bir claude -p sürecinde çalıştırır, haftalık da gelir.
  await ui.press({ key: 'limit-yenile' })
  expect(usageCagri).toBe(1)
  expect(await ui.find({ type: 'Text', text: /5 saatlik .*%37/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Haftalık .*%84/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /şimdi/ })).toBeDefined()
  await ui.unmount()
})

test('limitler 5 dakikadan eskiyse kendiliğinden yenilenir, boştaki oturum yenilemez', async ($, on) => {
  const saat = mock.clock(on, { now: new Date(2026, 9, 24, 15, 0).getTime() })
  const store = new Map<string, unknown>()
  let usageCagri = 0
  on('ui.close', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.usage', () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }) as never)
  on('session.start', () => ({ cwd: '/p' }) as never)
  on('store.get', ($, e) => ({ value: store.get((e as unknown as { key: string }).key) }) as never)
  on('store.set', ($, e) => {
    const { key, value } = e as unknown as { key: string; value: unknown }
    store.set(key, value)
    return { value: undefined } as never
  })
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    if (argv.includes('/usage')) usageCagri += 1
    return { value: { exitCode: 0, stdout: argv.includes('/usage') ? USAGE_METNI : '', stderr: '' } } as never
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start({ source: 'startup', cwd: '/p' } as never)

  // Limit hiç bilinmiyor: ilk 30 saniyelik turda çekilir.
  await saat.advance(30_000)
  expect(usageCagri).toBe(1)
  // 5 dakika dolmadan tekrar çekilmez.
  await saat.advance(4 * 60_000)
  expect(usageCagri).toBe(1)
  await saat.advance(90_000)
  expect(usageCagri).toBe(2)

  // 30 dakika etkinlik yoksa durur; yeni mesajla yeniden başlar.
  await saat.advance(35 * 60_000)
  const bosta = usageCagri
  await saat.advance(10 * 60_000)
  expect(usageCagri).toBe(bosta)
  await $.prompt.submit({ text: 'devam' } as never)
  await saat.advance(30_000)
  expect(usageCagri).toBe(bosta + 1)
})

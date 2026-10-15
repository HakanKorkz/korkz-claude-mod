import { expect, test } from 'claude-code/testing'

test('şerit tur tokenlarını ve maliyeti gösterir', async ($, on) => {
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
    expect(await ui.find({ type: 'Text', text: /Haftalık .*%92 ↻Pzt 09:00/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /🔧 Bash 2 · MCP 1 .*toplam 3/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /🔌 MCP ● claude\.ai Gmail 0 · ● context7 1/ })).toBeDefined()
    await ui.unmount()
  }

  await $.command.run({ command: 'maliyet', args: '' } as never)
  const gizli = await $.ui.mount({ plugin: 'oturum-maliyeti', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } } as never)
  expect(await gizli.find({ type: 'Text', text: /Bağlam/ })).toBeUndefined()
  await gizli.unmount()
})

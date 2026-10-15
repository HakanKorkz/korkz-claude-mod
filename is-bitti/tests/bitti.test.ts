import { expect, test } from 'claude-code/testing'

const tur = (durationMs: number, agentId?: string) => ({
  answer: 'tamam', durationMs, isAborted: false, turnId: 't', reason: 'answer' as const, agentId,
})

test('uzun tur bitince toast gösterir, kısa turda göstermez', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-channel' } }) as never)
  on('turn.complete', () => ({ text: '' }))

  await $.turn.complete(tur(5_000))
  expect(toasts.length).toBe(0)
  await $.turn.complete(tur(90_000, 'alt-ajan'))
  expect(toasts.length).toBe(0)
  await $.turn.complete(tur(90_000))
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('1 dk 30 sn')
})

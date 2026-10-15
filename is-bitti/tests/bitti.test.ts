import { expect, test } from 'claude-code/testing'

const tur = (durationMs: number, agentId?: string, reason: 'answer' | 'error' = 'answer') => ({
  answer: 'tamam', durationMs, isAborted: false, turnId: 't', reason, agentId,
})

test('uzun tur bitince toast, ses ve bildirim; kısa turda hiçbiri', async ($, on) => {
  const toasts: string[] = []
  const komutlar: string[][] = []
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-channel' } }) as never)
  on('process.run', ($, e) => {
    komutlar.push([...(e as unknown as { argv: string[] }).argv])
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('turn.complete', () => ({ text: '' }))

  await $.turn.complete(tur(5_000))
  await $.turn.complete(tur(90_000, 'alt-ajan'))
  expect(toasts.length).toBe(0)
  expect(komutlar.length).toBe(0)

  await $.turn.complete(tur(90_000))
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('1 dk 30 sn')
  expect(komutlar.some(a => a[0] === 'paplay' && a[1]?.endsWith('complete.oga'))).toBe(true)
  expect(komutlar.some(a => a[0] === 'notify-send' && a.includes('İş bitti (1 dk 30 sn)'))).toBe(true)
})

test('paplay yoksa sıradaki oynatıcıyı dener, hata turunda uyarı sesi çalar', async ($, on) => {
  const komutlar: string[][] = []
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-channel' } }) as never)
  on('process.run', ($, e) => {
    const argv = [...(e as unknown as { argv: string[] }).argv]
    komutlar.push(argv)
    return { value: { exitCode: argv[0] === 'paplay' ? 1 : 0, stdout: '', stderr: '' } } as never
  })
  on('turn.complete', () => ({ text: '' }))

  await $.turn.complete(tur(120_000, undefined, 'error'))
  expect(komutlar.some(a => a[0] === 'pw-play' && a[1]?.endsWith('dialog-warning.oga'))).toBe(true)
})

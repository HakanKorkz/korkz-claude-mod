import { expect, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'
import { komutuUygula, ayarlariOku, ozet } from '../hooks/register'

const tur = (durationMs: number, agentId?: string, reason: 'answer' | 'error' = 'answer', answer = 'tamam') => ({
  answer, durationMs, isAborted: false, turnId: 't', reason, agentId,
})

type On = Parameters<TestBody>[1]

// Motorun altını taklit eder: toast, bildirim, süreç, saat ve kalıcı ayarlar.
function kur(on: On, cikis: (argv: string[]) => number = () => 0) {
  const kayit = { toasts: [] as string[], komutlar: [] as string[][], saat: 0, store: new Map<string, unknown>() }
  on('ui.toast', ($, e) => { kayit.toasts.push(e.text); return { value: undefined } as never })
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-channel' } }) as never)
  on('process.run', ($, e) => {
    const argv = [...(e as unknown as { argv: string[] }).argv]
    kayit.komutlar.push(argv)
    return { value: { exitCode: cikis(argv), stdout: '', stderr: '' } } as never
  })
  on('clock.now', () => ({ value: kayit.saat }) as never)
  on('store.get', ($, e) => ({ value: kayit.store.get((e as unknown as { key: string }).key) }) as never)
  on('store.set', ($, e) => {
    const { key, value } = e as unknown as { key: string; value: unknown }
    kayit.store.set(key, value)
    return { value: undefined } as never
  })
  on('session.root', () => ({ value: '/home/k/projeler/claude-mods' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('classic.Notification', () => ({}))
  on('session.start', () => ({ cwd: '/home/k/projeler/claude-mods' }) as never)
  return kayit
}

const komut = ($: Engine, args: string) =>
  $.command.run({ command: 'is-bitti', args } as never) as Promise<{ text?: string }>

test('uzun tur bitince toast, ses ve proje adlı bildirim; kısa turda hiçbiri', async ($, on) => {
  const k = kur(on)
  await $.session.start({ source: 'startup', cwd: '/home/k/projeler/claude-mods' } as never)

  await $.turn.complete(tur(5_000))
  await $.turn.complete(tur(90_000, 'alt-ajan'))
  expect(k.toasts.length).toBe(0)
  expect(k.komutlar.length).toBe(0)

  await $.turn.complete(tur(90_000, undefined, 'answer', '## **Testler geçti**, 3 dosya değişti\nayrıntı'))
  expect(k.toasts[0]).toContain('1 dk 30 sn')
  expect(k.komutlar.some(a => a[0] === 'paplay' && a[1]?.endsWith('complete.oga'))).toBe(true)
  const bildirim = k.komutlar.find(a => a[0] === 'notify-send')
  expect(bildirim).toContain('Claude Code · claude-mods')
  expect(bildirim?.at(-1)).toBe('İş bitti (1 dk 30 sn)\nTestler geçti, 3 dosya değişti')
})

test('süre prompt gönderildiği andan ölçülür: arka plana bölünen iş de haber verir', async ($, on) => {
  const k = kur(on)
  k.saat = 1_000_000
  await $.prompt.submit({ text: 'testleri çalıştır' } as never)
  k.saat += 10_000
  await $.turn.complete(tur(10_000))
  expect(k.toasts.length).toBe(0)

  // Arka plan işinin bildirimi yeni bir prompt gibi gelir ama sayacı sıfırlamaz.
  k.saat += 65_000
  await $.prompt.submit({ text: '<task-notification>', origin: { kind: 'task-notification' } } as never)
  await $.turn.complete(tur(3_000))
  expect(k.toasts[0]).toContain('1 dk 15 sn')

  // Haber verildikten sonra aynı prompt'un devam turları yeniden ötmez.
  k.saat += 5_000
  await $.turn.complete(tur(2_000))
  expect(k.toasts.length).toBe(1)
})

test('paplay yoksa sıradaki oynatıcıyı dener, hata turunda uyarı sesi çalar', async ($, on) => {
  const k = kur(on, argv => (argv[0] === 'paplay' ? 1 : 0))
  await $.turn.complete(tur(120_000, undefined, 'error'))
  expect(k.komutlar.some(a => a[0] === 'pw-play' && a[1]?.endsWith('dialog-warning.oga'))).toBe(true)
})

test('izin istendiğinde ve soru sorulduğunda onay bekliyor uyarısı, tekrarsız', async ($, on) => {
  const k = kur(on)
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: {}, text: 'ok' }) as never)

  await $.classic.Notification({ message: 'Claude needs your permission', notification_type: 'permission_prompt' })
  expect(k.toasts[0]).toContain('onay bekliyor')
  expect(k.komutlar.some(a => a[0] === 'paplay' && a[1]?.endsWith('message-new-instant.oga'))).toBe(true)

  // 5 sn içinde ikinci uyarı yok.
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  expect(k.toasts.length).toBe(1)

  k.saat += 10_000
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  expect(k.toasts[1]).toContain('soru soruyor')

  k.saat += 10_000
  await $.classic.Notification({ message: 'idle', notification_type: 'idle_prompt' })
  expect(k.toasts.length).toBe(2)
})

test('/is-bitti eşiği değiştirir, susturur ve sesi kapatır', async ($, on) => {
  const k = kur(on)
  expect((await komut($, '')).text).toContain('1 dk 0 sn')

  await komut($, '30')
  await $.turn.complete(tur(40_000))
  expect(k.toasts.length).toBe(1)

  await komut($, 'ses kapat')
  k.komutlar.length = 0
  await $.turn.complete(tur(40_000))
  expect(k.komutlar.some(a => a[0] === 'paplay')).toBe(false)
  expect(k.komutlar.some(a => a[0] === 'notify-send')).toBe(true)

  await komut($, 'sustur')
  k.komutlar.length = 0
  await $.turn.complete(tur(40_000))
  expect(k.komutlar.length).toBe(0)
  expect(k.toasts.length).toBe(3)

  expect((await komut($, 'saçma')).text).toContain('Anlaşılmadı')
})

test('odak açıkken terminale bakılıyorsa ses ve bildirim yok', async ($, on) => {
  const k = kur(on)
  await komut($, 'odak aç')
  await $.turn.complete(tur(90_000))
  expect(k.komutlar.some(a => a[0] === 'sh')).toBe(true)
  expect(k.komutlar.some(a => a[0] === 'paplay' || a[0] === 'notify-send')).toBe(false)
  expect(k.toasts.length).toBe(1)
})

test('yardımcılar', () => {
  expect(ozet('\n\n> **Bitti:** her şey `yolunda`')).toBe('Bitti: her şey yolunda')
  expect(ozet('a'.repeat(200)).length).toBe(90)
  expect(ayarlariOku(undefined).esik).toBe(60)
  expect(komutuUygula(ayarlariOku(undefined), 'odak aç')?.odak).toBe(true)
  expect(komutuUygula(ayarlariOku({ esik: 5 }), 'sıfırla')?.esik).toBe(60)
})

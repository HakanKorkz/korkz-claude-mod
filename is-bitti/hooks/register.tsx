import type { EngineInterface, Register } from 'claude-code'

// Bu süreden uzun süren bir tur bitince haber verilir.
const ESIK_SN = 60

const SES = '/usr/share/sounds/freedesktop/stereo'

const sure = (sn: number) =>
  sn >= 60 ? `${Math.floor(sn / 60)} dk ${sn % 60} sn` : `${sn} sn`

// Sırayla dener, ilk çalışan komutta durur; hiçbiri çalışmazsa false.
async function ilkCalisan($: EngineInterface, komutlar: readonly (readonly string[])[]) {
  for (const argv of komutlar) {
    const r = await $.process.run(argv, { timeoutMs: 10_000 }).catch(() => undefined)
    if (r?.exitCode === 0) return true
  }
  return false
}

async function sesCal($: EngineInterface, hata: boolean) {
  const dosya = `${SES}/${hata ? 'dialog-warning' : 'complete'}.oga`
  return ilkCalisan($, [
    ['paplay', dosya],
    ['pw-play', dosya],
    ['canberra-gtk-play', '-i', hata ? 'dialog-warning' : 'complete'],
    ['afplay', `/System/Library/Sounds/${hata ? 'Basso' : 'Glass'}.aiff`],
  ])
}

async function bildir($: EngineInterface, mesaj: string, hata: boolean) {
  const gonderildi = await ilkCalisan($, [
    ['notify-send', '-a', 'Claude Code', '-i', hata ? 'dialog-warning' : 'dialog-information', 'Claude Code', mesaj],
    ['osascript', '-e', `display notification "${mesaj}" with title "Claude Code"`],
  ])
  if (!gonderildi) {
    await $.ui.notify(mesaj, { title: 'Claude Code' }).catch(() => undefined)
  }
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    const sn = Math.round(e.durationMs / 1000)

    if (e.agentId !== undefined || e.isAborted || sn < ESIK_SN) {
      return ran
    }

    const hata = e.reason === 'error'
    const mesaj = hata ? `İş hatayla bitti (${sure(sn)})` : `İş bitti (${sure(sn)})`
    $.ui.toast(`${hata ? '⚠️' : '✅'} ${mesaj}`)
    await Promise.all([sesCal($, hata), bildir($, mesaj, hata)])

    return ran
  })
}

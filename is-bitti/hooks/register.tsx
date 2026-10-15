import type { Register } from 'claude-code'

// Bu süreden uzun süren bir tur bitince haber verilir.
const ESIK_SN = 60

const sure = (sn: number) =>
  sn >= 60 ? `${Math.floor(sn / 60)} dk ${sn % 60} sn` : `${sn} sn`

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    const sn = Math.round(e.durationMs / 1000)

    if (e.agentId !== undefined || e.isAborted || sn < ESIK_SN) {
      return ran
    }

    const mesaj =
      e.reason === 'error' ? `İş hatayla bitti (${sure(sn)})` : `İş bitti (${sure(sn)})`
    $.ui.toast(`✅ ${mesaj}`)
    // Masaüstü bildirimi; kanal yoksa sessizce geçer.
    await $.ui.notify(mesaj, { title: 'Claude Code' }).catch(() => undefined)

    return ran
  })
}

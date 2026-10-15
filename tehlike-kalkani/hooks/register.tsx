import type { Register } from 'claude-code'

type Kural = { ad: string; desen: RegExp }

export const KURALLAR: readonly Kural[] = [
  { ad: 'kök ya da ev dizinini silme', desen: /\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+(-\S+\s+)*("|')?(\/|~|\$HOME|\/\*|\*)("|')?(\s|$)/ },
  { ad: 'rm --no-preserve-root', desen: /--no-preserve-root/ },
  { ad: 'disk biçimlendirme', desen: /\bmkfs(\.\w+)?\b/ },
  { ad: 'diske ham yazma', desen: /\bdd\b[^|;&]*\bof=\/dev\/(sd|nvme|hd|vd|mmcblk)/ },
  { ad: 'diske yönlendirme', desen: />\s*\/dev\/(sd|nvme|hd|vd|mmcblk)/ },
  { ad: 'fork bomb', desen: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/ },
  { ad: 'herkese tam yetki (777) kökten', desen: /\bchmod\s+(-R\s+)?777\s+\/(\s|$)/ },
  { ad: 'kökün sahibini değiştirme', desen: /\bchown\s+-R\s+\S+\s+\/(\s|$)/ },
  { ad: 'internetten indirip doğrudan çalıştırma', desen: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/ },
  { ad: 'zorla git push', desen: /\bgit\s+push\b.*(\s--force\b|\s-f\b)/ },
  { ad: 'git reset --hard', desen: /\bgit\s+reset\s+--hard\b/ },
  { ad: 'git clean -fd', desen: /\bgit\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d|\bgit\s+clean\s+-[a-zA-Z]*d[a-zA-Z]*f/ },
  { ad: 'sistemi kapatma / yeniden başlatma', desen: /\b(shutdown|reboot|poweroff|halt)\b/ },
  { ad: 'veritabanı silme', desen: /\bDROP\s+(DATABASE|SCHEMA)\b/i },
  { ad: 'Laravel veritabanını sıfırlama', desen: /\bartisan\s+(migrate:fresh|migrate:reset|db:wipe)\b/ },
]

export const tehlike = (komut: string): Kural | undefined =>
  KURALLAR.find(k => k.desen.test(komut))

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const kural = tehlike(e.command)
    if (kural === undefined) {
      return next(e)
    }
    $.ui.toast(`🛡 Engellendi: ${kural.ad}`)

    return {
      deny: `${$.plugin.name}: Bu komut engellendi (${kural.ad}). Gerçekten gerekiyorsa kullanıcıdan komutu kendisinin çalıştırmasını iste.`,
    }
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: koruma çalışırken hata oluştu.` },
  )
}

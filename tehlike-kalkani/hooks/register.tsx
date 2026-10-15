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

// Metni komut olarak çalıştıranlar: bunların yazıları da taranır.
const CALISTIRAN = /\b(ba|z|da|k)?sh\b|\beval\b|\bssh\b|\bxargs\b|\bsource\b|\bmysql\b|\bmariadb\b|\bpsql\b|\bsqlite3\b|\bpython3?\b|\bnode\b|\bperl\b|\bruby\b|\bphp\b/

// Heredoc gövdelerini ve boşluk içeren tırnaklı yazıları çıkarır (README, commit
// mesajı, echo metni); `rm -rf "/"` gibi tek kelimelik tırnaklar yerinde kalır.
const yazilariAt = (komut: string) => {
  const govdesiz = komut.replace(
    /^([^\n]*<<-?\s*(['"]?)(\w+)\2[^\n]*)\n[\s\S]*?\n[ \t]*\3[ \t]*(?=\n|$)/gm,
    (tum, baslik: string) => (CALISTIRAN.test(baslik) ? tum : baslik),
  )

  return CALISTIRAN.test(govdesiz)
    ? govdesiz
    : govdesiz.replace(/'[^']*\s[^']*'|"(?:[^"\\]|\\.)*\s(?:[^"\\]|\\.)*"/g, "''")
}

export const tehlike = (komut: string): Kural | undefined => {
  const taranan = yazilariAt(komut)

  return KURALLAR.find(k => k.desen.test(taranan))
}

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

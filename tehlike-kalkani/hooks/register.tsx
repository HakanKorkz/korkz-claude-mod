import type { Register } from 'claude-code'

/** `engel` hiç çalıştırmaz; `sor` kullanıcının (auto modda sınıflandırıcının) onayına düşer. */
type Seviye = 'engel' | 'sor'

type Kural = { ad: string; desen: RegExp; seviye: Seviye }

export const KURALLAR: readonly Kural[] = [
  { ad: 'kök ya da ev dizinini silme', seviye: 'engel', desen: /\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+(-\S+\s+)*("|')?(\/|~|\$HOME|\/\*|\*)("|')?(\s|$)/ },
  { ad: 'rm --no-preserve-root', seviye: 'engel', desen: /--no-preserve-root/ },
  { ad: 'disk biçimlendirme', seviye: 'engel', desen: /\bmkfs(\.\w+)?\b/ },
  { ad: 'diske ham yazma', seviye: 'engel', desen: /\bdd\b[^|;&]*\bof=\/dev\/(sd|nvme|hd|vd|mmcblk)/ },
  { ad: 'diske yönlendirme', seviye: 'engel', desen: />\s*\/dev\/(sd|nvme|hd|vd|mmcblk)/ },
  { ad: 'fork bomb', seviye: 'engel', desen: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/ },
  { ad: 'herkese tam yetki (777) kökten', seviye: 'engel', desen: /\bchmod\s+(-R\s+)?(0?777|a\+rwx)\s+\/(\s|$)/ },
  { ad: 'kökün sahibini değiştirme', seviye: 'engel', desen: /\bchown\s+-R\s+\S+\s+\/(\s|$)/ },
  { ad: 'internetten indirip doğrudan çalıştırma', seviye: 'engel', desen: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/ },
  { ad: 'sistemi kapatma / yeniden başlatma', seviye: 'engel', desen: /\b(shutdown|reboot|poweroff|halt)\b/ },
  { ad: 'veritabanı silme', seviye: 'engel', desen: /\bDROP\s+(DATABASE|SCHEMA)\b/i },
  { ad: 'zorla git push', seviye: 'sor', desen: /\bgit\s+push\b.*(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/ },
  { ad: 'git reset --hard', seviye: 'sor', desen: /\bgit\s+reset\s+--hard\b/ },
  { ad: 'git clean -fd', seviye: 'sor', desen: /\bgit\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d|\bgit\s+clean\s+-[a-zA-Z]*d[a-zA-Z]*f/ },
  { ad: 'herkese tam yetki (777) toplu', seviye: 'sor', desen: /\bchmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+(0?777|a\+rwx)|(0?777|a\+rwx)\s+-R)\b/ },
  { ad: 'Docker temizliği', seviye: 'sor', desen: /\bdocker\s+((system|volume|image|container|builder)\s+prune\b|volume\s+rm\b)/ },
  { ad: 'tablo silme / boşaltma', seviye: 'sor', desen: /\b(DROP\s+TABLE|TRUNCATE(\s+TABLE)?\s+[`"\w])/i },
  { ad: 'Laravel veritabanını sıfırlama', seviye: 'sor', desen: /\bartisan\s+(migrate:fresh|migrate:reset|migrate:refresh|db:wipe)\b/ },
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

export const tehlike = (komut: string, seviye?: Seviye): Kural | undefined => {
  const taranan = yazilariAt(komut)

  return KURALLAR.find(k => (seviye === undefined || k.seviye === seviye) && k.desen.test(taranan))
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const kural = tehlike(e.command, 'engel')
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

  // İzin kuralları komuta izin verse bile onay ister; daha sıkı bir karar (deny) olduğu gibi kalır.
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const komut = (e.input as { command?: unknown }).command
    const kural = typeof komut === 'string' ? tehlike(komut, 'sor') : undefined
    const karar = await next(e)
    if (kural === undefined || karar.decision === 'deny') {
      return karar
    }

    return { ...karar, decision: 'ask', reason: `🛡 ${kural.ad}: emin misiniz?` }
  }).catch(() => ({ decision: 'ask', reason: 'tehlike-kalkani: koruma çalışırken hata oluştu.' }))
}

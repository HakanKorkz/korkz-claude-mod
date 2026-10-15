import type { EngineInterface, Register } from 'claude-code'

// Gizli dosyalar: .env, anahtarlar, sertifika depoları, bulut kimlik bilgileri.
const GIZLI_AD = /^(\.env(\..+)?|.+\.(pem|key|p12|pfx|jks|keystore)|id_(rsa|dsa|ecdsa|ed25519)|credentials(\.json)?|\.netrc|\.pgpass|auth\.json|service-account.*\.json)$/i
// Örnek ve şablon dosyaları paylaşılmak içindir.
const ORNEK = /\.(example|sample|dist|template|defaults?|pub)$/i

export const gizliMi = (yol: string) => {
  const ad = yol.replace(/["']/g, '').split('/').pop() ?? ''

  return GIZLI_AD.test(ad) && !ORNEK.test(ad)
}

type Anahtar = { ad: string; desen: RegExp }

export const ANAHTARLAR: readonly Anahtar[] = [
  { ad: 'özel anahtar', desen: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { ad: 'AWS erişim anahtarı', desen: /\bAKIA[0-9A-Z]{16}\b/ },
  { ad: 'Anthropic API anahtarı', desen: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { ad: 'OpenAI API anahtarı', desen: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/ },
  { ad: 'GitHub token', desen: /\bgh[pousr]_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{40,}/ },
  { ad: 'Slack token', desen: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { ad: 'Google API anahtarı', desen: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { ad: 'Stripe canlı anahtarı', desen: /\b[sr]k_live_[0-9a-zA-Z]{20,}/ },
  { ad: 'Laravel APP_KEY', desen: /APP_KEY=base64:[A-Za-z0-9+/=]{30,}/ },
  { ad: 'parola / gizli değer', desen: /\b(password|passwd|secret|api_?key|access_?token)\b["']?\s*[:=]>?\s*["'][^"'\s]{12,}["']/i },
]

// Diff'te eklenen satırlarda anahtara benzeyen ilk şey.
export const anahtarBul = (diff: string): Anahtar | undefined => {
  const eklenen = diff
    .split('\n')
    .filter(s => s.startsWith('+') && !s.startsWith('+++'))
    .join('\n')

  return ANAHTARLAR.find(a => a.desen.test(eklenen))
}

// Boşluk içeren tırnaklı yazılar (commit mesajı, echo metni) komut sayılmaz.
const yazilariAt = (komut: string) =>
  komut.replace(/'[^']*\s[^']*'|"(?:[^"\\]|\\.)*\s(?:[^"\\]|\\.)*"/g, "''")

const OKUYAN = /(^|[\s;&|(])(cat|less|more|head|tail|grep|rg|ag|awk|sed|bat|xxd|od|strings|base64|nl|tac|source|\.|scp|rsync|curl)(\s|$)/
const GIT_ADD = /\bgit\s+add\b/
const GIT_COMMIT = /\bgit\s+(-C\s+\S+\s+)?commit\b/

// Bash komutunun gizli bir dosyayı okuyup okumadığı ya da git'e eklediği.
export const bashGizli = (komut: string): string | undefined => {
  const temiz = yazilariAt(komut)
  const dosya = temiz.split(/[\s;&|<>()]+/).find(gizliMi)
  if (dosya === undefined) return undefined
  if (GIT_ADD.test(temiz)) return `${dosya} git'e eklenemez`
  // `cp .env.example .env` gizli dosyaya yazar; yalnızca kaynağı gizli olan cp okur.
  for (const [, kaynak] of temiz.matchAll(/\bcp\s+(?:-\S+\s+)*(\S+)/g)) {
    if (kaynak !== undefined && gizliMi(kaynak)) return `${kaynak} okunamaz`
  }
  if (OKUYAN.test(temiz)) return `${dosya} okunamaz`

  return undefined
}

async function commitIncele($: EngineInterface, komut: string): Promise<{ deny?: string; ask?: string }> {
  const hepsi = /\scommit\b.*\s(-[a-zA-Z]*a[a-zA-Z]*|--all)\b/.test(komut)
  const diffArg = hepsi ? ['git', 'diff', 'HEAD'] : ['git', 'diff', '--cached']
  const [adlar, diff] = await Promise.all([
    $.process.run([...diffArg, '--name-only'], { timeoutMs: 10_000 }),
    $.process.run(diffArg, { timeoutMs: 10_000 }),
  ])
  const dosya = adlar.stdout.split('\n').find(s => s.trim() !== '' && gizliMi(s.trim()))
  if (dosya !== undefined) {
    return { deny: `gizli-koruma: commit'te gizli dosya var (${dosya.trim()}). \`git restore --staged ${dosya.trim()}\` ile çıkarıp .gitignore'a ekle.` }
  }
  const anahtar = anahtarBul(diff.stdout)
  if (anahtar !== undefined) {
    return { ask: `🔑 Diff'te ${anahtar.ad} gibi görünen bir şey var. Yine de commit edilsin mi?` }
  }

  return {}
}

export const register: Register = on => {
  on('tool.call', ($, e, next) => {
    if ((e.tool === 'Read' || e.tool === 'Edit') && gizliMi(e.file_path)) {
      $.ui.toast(`🔒 Gizli dosya korundu: ${e.file_path.split('/').pop()}`)
      return {
        deny: `gizli-koruma: ${e.file_path} gizli bilgi içerebilir, okunamaz. Gerekirse kullanıcıdan ilgili değeri (gizli olmayan kısmını) kendisinin söylemesini ya da .env.example'a bakmayı iste.`,
      }
    }
    if (e.tool === 'Bash') {
      const neden = bashGizli(e.command)
      if (neden !== undefined) {
        $.ui.toast(`🔒 Gizli dosya korundu: ${neden}`)
        return { deny: `gizli-koruma: ${neden}. Gerçekten gerekiyorsa kullanıcıdan komutu kendisinin çalıştırmasını iste.` }
      }
    }

    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'gizli-koruma: koruma çalışırken hata oluştu.' }))

  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const karar = await next(e)
    const komut = (e.input as { command?: unknown }).command
    if (karar.decision === 'deny' || typeof komut !== 'string' || !GIT_COMMIT.test(yazilariAt(komut))) {
      return karar
    }
    const sonuc = await commitIncele($, komut)
    if (sonuc.deny !== undefined) return { decision: 'deny', reason: sonuc.deny }
    if (sonuc.ask !== undefined) return { ...karar, decision: 'ask', reason: sonuc.ask }

    return karar
  }).catch(($, e, next) => next(e))
}

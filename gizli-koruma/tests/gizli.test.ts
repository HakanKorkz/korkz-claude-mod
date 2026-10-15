import { expect, test } from 'claude-code/testing'
import { anahtarBul, bashGizli, gizliMi } from '../hooks/register'

// Gerçek anahtar biçimleri parça parça kurulur ki bu dosya kendi kontrolüne takılmasın.
const AWS = 'AKIA' + 'Q'.repeat(16)
const GH = 'ghp' + '_' + 'a'.repeat(36)
const OZEL = '-----BEGIN ' + 'RSA PRIVATE KEY-----'

test('gizli dosya adları', () => {
  for (const y of ['.env', '~/.claude/.credentials.json', '/proje/.env.production', 'storage/oauth-private.key', '~/.ssh/id_ed25519', 'cert.pem', '"/x/.env"', 'auth.json']) {
    expect(gizliMi(y)).toBe(true)
  }
  for (const y of ['.env.example', 'id_ed25519.pub', 'environment.ts', 'src/env.ts', 'package.json', 'keys.ts']) {
    expect(gizliMi(y)).toBe(false)
  }
})

test('Bash: gizli dosyayı okuma ve git add engellenir, kurulum adımları geçer', () => {
  for (const k of ['cat .env', 'grep DB_ .env', 'git add .env', 'git add -f config/.env.local', 'cp .env /tmp/x', 'source .env && echo $DB', 'head -3 ~/.ssh/id_rsa']) {
    expect(bashGizli(k)).toBeDefined()
  }
  for (const k of ['cp .env.example .env', 'cp .env.example .env && php artisan key:generate', 'ls -la .env', 'git add src/app.ts', 'git commit -m "cat .env artık engelleniyor"', 'cat .env.example']) {
    expect(bashGizli(k)).toBeUndefined()
  }
})

test('diff taraması yalnızca eklenen satırlara bakar', () => {
  expect(anahtarBul(`+++ b/x\n+const k = '${AWS}'`)?.ad).toBe('AWS erişim anahtarı')
  expect(anahtarBul(`+token: ${GH}`)?.ad).toBe('GitHub token')
  expect(anahtarBul(`+${OZEL}`)?.ad).toBe('özel anahtar')
  expect(anahtarBul('+  "pass' + 'word": "Cok-Gizli-Parola-123"')?.ad).toBe('parola / gizli değer')
  expect(anahtarBul(`-const k = '${AWS}'`)).toBeUndefined()
  expect(anahtarBul(`+password: env('DB_PASSWORD')`)).toBeUndefined()
})

test('Read ve Bash çağrıları engellenir, diğerleri geçer', async ($, on) => {
  let ran = 0
  on('ui.toast', () => ({ value: undefined }) as never)
  on('tool.call', () => {
    ran += 1
    return { result: {}, text: 'ok' } as never
  })

  expect((await $.tool.call({ tool: 'Read', file_path: '/p/.env' } as never)).deny).toContain('okunamaz')
  expect((await $.tool.call({ tool: 'Bash', command: 'cat .env' } as never)).deny).toContain('gizli-koruma')
  expect(ran).toBe(0)
  expect((await $.tool.call({ tool: 'Read', file_path: '/p/.env.example' } as never)).deny).toBeUndefined()
  expect(ran).toBe(1)
})

test('commit: gizli dosya reddedilir, anahtar onaya düşer, temiz diff geçer', async ($, on) => {
  let adlar = ''
  let diff = ''
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    return { value: { exitCode: 0, stdout: argv.includes('--name-only') ? adlar : diff, stderr: '' } } as never
  })
  on('tool.check', () => ({ decision: 'allow' }))
  const check = () => $.tool.check({ tool: 'Bash', input: { command: 'git commit -m "x y"' } })

  adlar = 'src/a.ts\n.env\n'
  expect((await check()).decision).toBe('deny')

  adlar = 'src/a.ts\n'
  diff = `+const k = '${AWS}'`
  const r = await check()
  expect(r.decision).toBe('ask')
  expect(r.reason).toContain('AWS')

  diff = '+const x = 1'
  expect((await check()).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })).decision).toBe('allow')
})

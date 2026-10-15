import type { EngineInterface, Register } from 'claude-code'

type Bicimlendirici = { ad: string; uzantilar: RegExp; arac: string; argv: (dosya: string) => string[] }

// Yalnızca projeye kurulu araçlar kullanılır; npx gibi indiren yollar yok.
export const BICIMLENDIRICILER: readonly Bicimlendirici[] = [
  { ad: 'pint', uzantilar: /\.php$/i, arac: 'vendor/bin/pint', argv: d => ['vendor/bin/pint', '-q', d] },
  {
    ad: 'prettier',
    uzantilar: /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|vue|css|scss)$/i,
    arac: 'node_modules/.bin/prettier',
    argv: d => ['node_modules/.bin/prettier', '--write', '--log-level', 'warn', d],
  },
]

export const bicimlendiriciBul = (dosya: string) => BICIMLENDIRICILER.find(b => b.uzantilar.test(dosya))

// Dosyanın klasöründen yukarı çıkıp aracın kurulu olduğu proje kökünü bulur.
export const ustKlasorler = (dosya: string) => {
  const parcalar = dosya.split('/').slice(0, -1)
  const sonuc: string[] = []
  for (let i = parcalar.length; i > 0; i--) {
    sonuc.push(parcalar.slice(0, i).join('/') || '/')
  }
  return sonuc
}

async function kokBul($: EngineInterface, dosya: string, arac: string) {
  for (const klasor of ustKlasorler(dosya)) {
    if (await $.fs.exists(`${klasor}/${arac}`)) return klasor
  }
  return undefined
}

async function acikMi($: EngineInterface) {
  return (await $.store.get('kapali')) !== true
}

async function bicimlendir($: EngineInterface, dosya: string): Promise<string | undefined> {
  const b = bicimlendiriciBul(dosya)
  if (b === undefined || !(await acikMi($))) return undefined
  const kok = await kokBul($, dosya, b.arac)
  if (kok === undefined) return undefined

  const r = await $.process.run(b.argv(dosya), { cwd: kok, timeoutMs: 30_000 })
  if (r.exitCode !== 0) {
    $.ui.toast(`oto-format: ${b.ad} hata verdi (${dosya.split('/').pop()})`)
    return undefined
  }

  return b.ad
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'oto-format', description: 'Otomatik biçimlendirmeyi açar ya da kapatır', immediate: true })

    return next(e)
  })

  on('command.run', { command: 'oto-format' }, async $ => {
    const acik = !(await acikMi($))
    await $.store.set('kapali', !acik)

    return { text: acik ? 'oto-format açık: pint ve prettier düzenlemelerden sonra çalışır.' : 'oto-format kapalı.' }
  })

  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if ((e.tool !== 'Edit' && e.tool !== 'Write') || r.deny !== undefined || r.isError === true) {
      return r
    }

    const arac = await bicimlendir($, e.file_path).catch(() => undefined)
    if (arac === undefined) return r

    return {
      ...r,
      context: [
        ...(r.context ?? []),
        `oto-format: ${e.file_path} ${arac} ile biçimlendirildi; içeriği değişmiş olabilir, yeniden düzenlemeden önce tekrar oku.`,
      ],
    }
  }).catch(($, e, next) => next(e))
}

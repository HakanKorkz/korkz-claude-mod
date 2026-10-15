import type { Register } from 'claude-code'

const TALIMAT = {
  id: 'turkce-cevap:dil',
  text: [
    '# Yanıt dili',
    'Kullanıcıya her zaman Türkçe yanıt ver; kullanıcı başka bir dilde yazsa bile.',
    'Kod, komutlar, dosya yolları, tanımlayıcılar ve teknik terimler orijinal hâlinde kalsın.',
    'Kod içi yorumlar ve commit mesajları için projenin mevcut dilini izle.',
  ].join('\n'),
  scope: 'session',
} as const

// Her prompt'un yanına, kullanıcının görmediği bir hatırlatma olarak eklenir:
// uzun oturumlarda system prompt'taki talimat unutulup İngilizceye kayılmasın.
export const HATIRLATMA =
  'Hatırlatma: Bu yanıtı ve bu turdaki tüm ara mesajları Türkçe yaz; araç çıktıları İngilizce olsa bile. Kod, komut ve teknik terimler orijinal kalabilir.'

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)

    return {
      sections: [...sections.filter(s => s.id !== TALIMAT.id), TALIMAT],
    }
  })

  on('prompt.submit', ($, e, next) =>
    e.command !== undefined
      ? next(e)
      : next({ ...e, context: [...(e.context ?? []).filter(c => c !== HATIRLATMA), HATIRLATMA] }),
  )
}

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

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)

    return {
      sections: [...sections.filter(s => s.id !== TALIMAT.id), TALIMAT],
    }
  })
}

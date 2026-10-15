import { expect, test } from 'claude-code/testing'

test('system prompt sonuna Türkçe talimatı ekler', async ($, on) => {
  on('prompt.compose', () => ({
    sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' as const }],
  }))
  const { sections } = await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
  const last = sections[sections.length - 1]
  expect(sections.length).toBe(2)
  expect(last?.id).toBe('turkce-cevap:dil')
  expect(last?.scope).toBe('session')
  expect(last?.text).toContain('Türkçe')
})

test('her prompt’a görünmeyen Türkçe hatırlatma ekler', async ($, on) => {
  on('prompt.submit', ($, e) => ({ text: e.text, context: e.context }))
  const r = await $.prompt.submit({ text: 'fix the bug please', wait: false } as never)
  expect(r.drop).toBeUndefined()
  expect(r.text).toBe('fix the bug please')
  expect(r.context?.length).toBe(1)
  expect(r.context?.[0]).toContain('Türkçe')
})

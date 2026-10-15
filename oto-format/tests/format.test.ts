import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { bicimlendiriciBul, ustKlasorler } from '../hooks/register'

type On = Parameters<TestBody>[1]

function kur(on: On, kurulu: string[], cikis = 0) {
  const k = { komutlar: [] as { argv: string[]; cwd?: string }[], store: new Map<string, unknown>() }
  on('fs.exists', ($, e) => ({ value: kurulu.includes((e as unknown as { path: string }).path) }) as never)
  on('process.run', ($, e) => {
    const { argv, init } = e as unknown as { argv: string[]; init?: { cwd?: string } }
    k.komutlar.push({ argv: [...argv], cwd: init?.cwd })
    return { value: { exitCode: cikis, stdout: '', stderr: '' } } as never
  })
  on('store.get', ($, e) => ({ value: k.store.get((e as unknown as { key: string }).key) }) as never)
  on('store.set', ($, e) => {
    const { key, value } = e as unknown as { key: string; value: unknown }
    k.store.set(key, value)
    return { value: undefined } as never
  })
  on('ui.toast', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  return k
}

test('yardımcılar', () => {
  expect(bicimlendiriciBul('a/B.php')?.ad).toBe('pint')
  expect(bicimlendiriciBul('a/b.tsx')?.ad).toBe('prettier')
  expect(bicimlendiriciBul('a/b.md')).toBeUndefined()
  expect(ustKlasorler('/p/app/Models/User.php')).toEqual(['/p/app/Models', '/p/app', '/p', '/'])
})

test('PHP düzenlemesinden sonra proje kökünde pint çalışır ve model uyarılır', async ($, on) => {
  const k = kur(on, ['/p/vendor/bin/pint'])
  const r = await $.tool.call({ tool: 'Edit', file_path: '/p/app/Models/User.php', old_string: 'a', new_string: 'b' } as never)
  expect(k.komutlar[0]).toEqual({ argv: ['vendor/bin/pint', '-q', '/p/app/Models/User.php'], cwd: '/p' })
  expect(r.context?.[0]).toContain('pint ile biçimlendirildi')
})

test('TS dosyası prettier ile; araç kurulu değilse hiçbir şey çalışmaz', async ($, on) => {
  const k = kur(on, ['/w/node_modules/.bin/prettier'])
  await $.tool.call({ tool: 'Write', file_path: '/w/src/a.ts', content: 'x' } as never)
  expect(k.komutlar[0]?.argv[0]).toBe('node_modules/.bin/prettier')

  const r = await $.tool.call({ tool: 'Write', file_path: '/baska/b.php', content: 'x' } as never)
  expect(k.komutlar.length).toBe(1)
  expect(r.context).toBeUndefined()
})

test('/oto-format kapatınca çalışmaz; Read gibi araçlara dokunmaz', async ($, on) => {
  const k = kur(on, ['/p/vendor/bin/pint'])
  on('command.register', () => ({ value: undefined }) as never)
  await $.command.run({ command: 'oto-format', args: '' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/p/a.php', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/p/a.php' } as never)
  expect(k.komutlar.length).toBe(0)
})

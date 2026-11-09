#!/usr/bin/env node
// Compares the types of src/api/contracts.ts with the OpenAPI document of the running back-end.
//
//   node scripts/check-openapi.mjs [url]       (default: http://localhost:3000/api/v3/api-docs)
//
// How: the document goes through openapi-typescript, which writes the back's types; then tsc checks,
// for every interface that has a schema of the same name:
//   1. the SAME FIELDS: a field on one side only fails the check (that is the drift that breaks screens);
//   2. field TYPES: what the front declares must be assignable to what the back declares (nullability
//      ignored, because the document does not say which fields may be null). Reported as a warning.
// Names present on one side only are listed, not failed: request/response wrappers like Paged* and the
// endpoints the back has not merged yet are expected there.
//
// openapi-typescript needs TypeScript 5 and the project uses 7, so it runs through npx with its own
// TypeScript, away from package.json.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OPENAPI_TYPESCRIPT = 'openapi-typescript@7.13.0'
const TYPESCRIPT_5 = 'typescript@5.9.3'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contractsPath = join(root, 'src/api/contracts.ts')
const url = process.argv[2] ?? 'http://localhost:3000/api/v3/api-docs'
const work = mkdtempSync(join(tmpdir(), 'openapi-check-'))

const response = await fetch(url)
if (!response.ok) {
  console.error(`GET ${url} answered ${response.status}`)
  process.exit(2)
}
const doc = await response.json()
const schemas = Object.keys(doc.components?.schemas ?? {})
if (schemas.length === 0) {
  console.error(`${url} has no components.schemas: is that the OpenAPI document?`)
  process.exit(2)
}
writeFileSync(join(work, 'api-docs.json'), JSON.stringify(doc))

const generated = spawnSync(
  'npx',
  [
    '--yes',
    '-p',
    OPENAPI_TYPESCRIPT,
    '-p',
    TYPESCRIPT_5,
    'openapi-typescript',
    join(work, 'api-docs.json'),
    '-o',
    join(work, 'schema.d.ts'),
  ],
  { stdio: ['ignore', 'inherit', 'inherit'], cwd: work },
)
if (generated.status !== 0) {
  console.error('openapi-typescript failed')
  process.exit(2)
}

// Interfaces of the contract that are not generic (Page<T> has no schema of its own).
const contracts = readFileSync(contractsPath, 'utf8')
const mine = [...contracts.matchAll(/^export interface (\w+)(<[^{]*)? (?:extends [^{]+)?\{/gm)]
  .filter((match) => !match[2])
  .map((match) => match[1])
const shared = mine.filter((name) => schemas.includes(name))

const header = `import type { components } from './schema'
import type * as Front from ${JSON.stringify(contractsPath.replace(/\.ts$/, ''))}
type Back<N extends keyof components['schemas']> = components['schemas'][N]
`
const keysCheck = `${header}
type SameFields<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [never, never]
  ? true
  : { front_only: Exclude<keyof A, keyof B>; back_only: Exclude<keyof B, keyof A> }
${shared.map((name, i) => `export const keys${i}: SameFields<Front.${name}, Back<'${name}'>> = true // ${name}`).join('\n')}
`
const typesCheck = `${header}
type Plain<T> = { [K in keyof T]-?: NonNullable<T[K]> }
type Assignable<A, B> = [Plain<A>] extends [Plain<B>] ? true : false
${shared.map((name, i) => `export const types${i}: Assignable<Front.${name}, Back<'${name}'>> = true // ${name}`).join('\n')}
`
writeFileSync(join(work, 'keys.check.ts'), keysCheck)
writeFileSync(join(work, 'types.check.ts'), typesCheck)

const tscArgs = [
  '--noEmit',
  '--strict',
  '--skipLibCheck',
  '--target',
  'es2023',
  '--module',
  'esnext',
  '--moduleResolution',
  'bundler',
]
const tsc = join(root, 'node_modules/.bin/tsc')
// From the temporary directory: with a tsconfig.json in the cwd, tsc refuses files on the command line.
const run = (file) =>
  spawnSync(tsc, [...tscArgs, join(work, file)], { encoding: 'utf8', cwd: work })

const only = (list, other) => list.filter((name) => !other.includes(name))
console.log(
  `\nContract: ${mine.length} interfaces; back: ${schemas.length} schemas; compared: ${shared.length}`,
)
console.log(
  `Only in the front (${only(mine, schemas).length}): ${only(mine, schemas).join(', ') || '-'}`,
)
console.log(
  `Only in the back  (${only(schemas, mine).length}): ${only(schemas, mine).join(', ') || '-'}`,
)

let failed = false

const keys = run('keys.check.ts')
if (keys.status !== 0) {
  failed = true
  console.error('\n✗ Fields that exist on one side only:')
  for (const line of keys.stdout.split('\n').filter((l) => /error TS/.test(l))) {
    // keys.check.ts(12,14): error TS2322: Type '["x", never]' is not assignable to type 'true'.
    const at = /\((\d+),\d+\)/.exec(line)
    const name = at ? keysCheck.split('\n')[Number(at[1]) - 1]?.split('// ')[1] : undefined
    const diff = /not assignable to type '(.*)'\.\s*$/.exec(line)?.[1]
    console.error(`  ${name ?? line}: ${diff ?? line}`)
  }
}

const types = run('types.check.ts')
if (types.status !== 0) {
  console.warn('\n! Fields whose type differs (warning, not a failure):')
  for (const line of types.stdout.split('\n').filter((l) => /error TS/.test(l))) {
    const at = /\((\d+),\d+\)/.exec(line)
    const name = at ? typesCheck.split('\n')[Number(at[1]) - 1]?.split('// ')[1] : undefined
    console.warn(`  ${name ?? line}`)
  }
  console.warn(`  (details: ${join(work, 'types.check.ts')})`)
}

if (failed) process.exit(1)
console.log('\n✓ Every compared interface has the same fields as the back.')

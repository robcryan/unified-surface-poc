#!/usr/bin/env node
/**
 * Dependency licence gate.
 *
 * This project is intended to be released as open source, so every dependency
 * has to be permissively licensed. Anything copyleft or source-available is a
 * hard failure — those terms can reach into the code that links against them.
 *
 * Run with `npm run licenses`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const MODULES = join(ROOT, 'node_modules')

/** Licences that are fine to ship in a permissively licensed product. */
const ALLOWED = [
  'MIT', 'ISC', 'BSD', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0',
  'Unlicense', 'CC0-1.0', 'CC-BY-4.0', 'Python-2.0', 'BlueOak-1.0.0',
  'WTFPL', 'Zlib', 'MIT-0',
]

/** Hard failures — copyleft or source-available. */
const BLOCKED = [
  'AGPL', 'SSPL', 'BUSL', 'BSL', 'Elastic', 'Commons-Clause', 'CC-BY-NC',
  'CC-BY-SA', 'JSON', 'RPL', 'OSL', 'EUPL',
]

/** Weak copyleft — legal should look, but does not necessarily block. */
const REVIEW = ['GPL-2.0', 'GPL-3.0', 'LGPL', 'MPL-2.0', 'CDDL', 'EPL']

function normalise(license) {
  if (!license) return 'UNKNOWN'
  if (typeof license === 'string') return license
  if (typeof license === 'object' && license.type) return license.type
  if (Array.isArray(license)) return license.map(normalise).join(' OR ')
  return 'UNKNOWN'
}

function classify(raw) {
  const value = normalise(raw)
  const upper = value.toUpperCase()
  // Check blocked first — "AGPL-3.0" also contains "GPL".
  for (const b of BLOCKED) if (upper.includes(b.toUpperCase())) return ['BLOCKED', value]
  for (const r of REVIEW) if (upper.includes(r.toUpperCase())) return ['REVIEW', value]
  // Strip SPDX expression syntax before matching the allowlist.
  const parts = value.replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/i)
  if (parts.some((p) => ALLOWED.includes(p.trim()))) return ['OK', value]
  return ['UNKNOWN', value]
}

function* packageDirs(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name === '.bin' || entry.name === '.cache') continue
    if (entry.name.startsWith('@')) {
      yield* packageDirs(join(dir, entry.name))
      continue
    }
    const pkgPath = join(dir, entry.name, 'package.json')
    if (existsSync(pkgPath)) yield pkgPath
  }
}

const results = { OK: [], REVIEW: [], BLOCKED: [], UNKNOWN: [] }

for (const pkgPath of packageDirs(MODULES)) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    continue
  }
  if (!pkg.name || !pkg.version) continue
  const [verdict, value] = classify(pkg.license ?? pkg.licenses)
  results[verdict].push(`${pkg.name}@${pkg.version} — ${value}`)
}

const total = Object.values(results).reduce((a, b) => a + b.length, 0)

console.log(`Scanned ${total} installed packages.\n`)
console.log(`  permissive : ${results.OK.length}`)
console.log(`  review     : ${results.REVIEW.length}`)
console.log(`  blocked    : ${results.BLOCKED.length}`)
console.log(`  unknown    : ${results.UNKNOWN.length}\n`)

for (const key of ['BLOCKED', 'REVIEW', 'UNKNOWN']) {
  if (!results[key].length) continue
  console.log(`${key}:`)
  for (const line of results[key].sort()) console.log(`  ${line}`)
  console.log('')
}

if (results.BLOCKED.length) {
  console.error('FAIL — copyleft or source-available dependencies present.')
  process.exit(1)
}
console.log('PASS — no copyleft or source-available dependencies.')

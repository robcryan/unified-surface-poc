import { sealData } from 'iron-session'

const PASSWORD = 'prototype-only-session-secret-change-me-32+'
const COOKIE = 'unified_surface_session'
const BASE = 'http://localhost:3000'

const PERSONAS = [
  ['Learner (Aisha Bello)', 'usr_lrn_0003'],
  ['Teacher (Priya Raghunathan)', 'usr_priya'],
  ['Specialist (Andre Whitfield)', 'usr_andre'],
  ['Administrator (Lena Torres)', 'usr_lena'],
  ['Guardian (Carmen Ramirez)', 'usr_carmen'],
]

async function cookieFor(userId) {
  const sealed = await sealData({ userId }, { password: PASSWORD, ttl: 0 })
  return `${COOKIE}=${sealed}`
}

function findIssues(html) {
  const issues = []
  if (/Application error|Internal Server Error|__NEXT_ERROR/.test(html)) {
    issues.push('server error in page')
  }
  // The fatalist test: no tile should render visibly empty.
  const emptyTiles = [...html.matchAll(/<div class="flex-1 p-4"><\/div>/g)].length
  if (emptyTiles) issues.push(`${emptyTiles} empty tile bodies`)
  if (/NaN/.test(html)) issues.push('NaN rendered')
  if (/undefined</.test(html)) issues.push('literal "undefined" rendered')
  return issues
}

let failures = 0

for (const [label, userId] of PERSONAS) {
  const cookie = await cookieFor(userId)
  const res = await fetch(BASE + '/', { headers: { cookie }, redirect: 'manual' })
  const html = await res.text()

  // Count rendered tiles by their heading element.
  const tiles = [...html.matchAll(/text-\[13px\] font-semibold tracking-tight text-ink">/g)]
    .length
  const issues = findIssues(html)
  if (res.status !== 200 || tiles === 0 || issues.length) failures++

  console.log(
    `${res.status === 200 && tiles > 0 && !issues.length ? 'PASS' : 'FAIL'}  ${label.padEnd(30)} status=${res.status} tiles=${tiles}${issues.length ? '  issues=' + issues.join('; ') : ''}`,
  )
}

// Scope enforcement: the guardian must not reach a learner outside their family.
const guardianCookie = await cookieFor('usr_carmen')
const outOfScope = await fetch(BASE + '/learner/lrn_0001', {
  headers: { cookie: guardianCookie },
  redirect: 'manual',
})
const outHtml = await outOfScope.text()
const blocked = /outside your access/.test(outHtml)
console.log(
  `${blocked ? 'PASS' : 'FAIL'}  Guardian blocked from lrn_0001   status=${outOfScope.status}`,
)
if (!blocked) failures++

// In-scope learner must render.
const inScope = await fetch(BASE + '/learner/lrn_0002', {
  headers: { cookie: guardianCookie },
  redirect: 'manual',
})
const inHtml = await inScope.text()
const ok = inScope.status === 200 && /Access record/.test(inHtml)
console.log(`${ok ? 'PASS' : 'FAIL'}  Guardian sees own learner        status=${inScope.status}`)
if (!ok) failures++

// Signed-out request must be redirected to the sign-in screen.
const anon = await fetch(BASE + '/', { redirect: 'manual' })
const redirected = anon.status === 307 || anon.status === 302
console.log(`${redirected ? 'PASS' : 'FAIL'}  Signed-out redirected to /login  status=${anon.status}`)
if (!redirected) failures++

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)

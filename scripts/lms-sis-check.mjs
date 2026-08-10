/**
 * Proves the interface actually *operates* the two source systems:
 * grade in the LMS gradebook, enrol/withdraw in the SIS roster, and confirm
 * each change persists and propagates.
 */
import { chromium } from 'playwright'
import { sealData } from 'iron-session'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const PASSWORD = 'prototype-only-session-secret-change-me-32+'
const SHOTS = 'scripts/.shots'
mkdirSync(SHOTS, { recursive: true })

let failures = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

const browser = await chromium.launch()
async function pageFor(userId) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await ctx.addCookies([
    {
      name: 'unified_surface_session',
      value: await sealData({ userId }, { password: PASSWORD, ttl: 0 }),
      domain: 'localhost',
      path: '/',
    },
  ])
  return { ctx, page: await ctx.newPage() }
}

// ── Teacher: navigate from a tile into the section workspace ─────────────────
const { ctx, page } = await pageFor('usr_priya')
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page
  .waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 20000 })
  .catch(() => {})

const sectionLink = page.locator('a[href^="/section/"]').first()
check((await sectionLink.count()) > 0, 'dashboard tile links into a section')
await sectionLink.click()
await page.waitForURL(/\/section\//, { timeout: 15000 })
await page.waitForLoadState('networkidle')
const sectionUrl = page.url()
console.log(`      section: ${sectionUrl}`)

// ── SIS: roster ──────────────────────────────────────────────────────────────
await page.goto(sectionUrl.split('?')[0] + '?tab=roster', { waitUntil: 'networkidle' })
const enrolledHeading = () =>
  page.locator('h3', { hasText: /^Enrolled/ }).first().textContent()
const before = await enrolledHeading()
const beforeN = Number(before.match(/\d+/)[0])
check(beforeN > 0, 'roster lists enrolled learners', `${beforeN} enrolled`)

// Enrol someone new.
await page.getByPlaceholder('Search by name or state ID…').fill('an')
await page.waitForTimeout(1200)
const enrolBtn = page.getByRole('button', { name: 'Enrol', exact: true }).first()
const hasCandidate = (await enrolBtn.count()) > 0
check(hasCandidate, 'search returns enrollable learners')

let enrolledName = null
if (hasCandidate) {
  enrolledName = await enrolBtn
    .locator('xpath=../span')
    .first()
    .textContent()
    .catch(() => null)
  await enrolBtn.click()
  await page.waitForTimeout(2500)
  await page.waitForLoadState('networkidle')
  const afterN = Number((await enrolledHeading()).match(/\d+/)[0])
  check(afterN === beforeN + 1, 'enrolling adds the learner to the roster', `${beforeN} -> ${afterN}`)
  await page.screenshot({ path: `${SHOTS}/sis-roster.png`, fullPage: true })
}

// ── LMS: gradebook ───────────────────────────────────────────────────────────
await page.goto(sectionUrl.split('?')[0] + '?tab=gradebook', { waitUntil: 'networkidle' })
const rows = await page.locator('tbody tr').count()
check(rows === beforeN + (hasCandidate ? 1 : 0), 'gradebook shows the updated roster', `${rows} rows`)

const cells = page.locator('tbody input[aria-label^="Score for"]')
check((await cells.count()) > 0, 'gradebook cells are editable', `${await cells.count()} cells`)

// Grade the first learner's first assignment, then verify the course grade moves.
const firstRowGrade = () => page.locator('tbody tr').first().locator('td').nth(1).textContent()
const gradeBefore = await firstRowGrade()
const target = cells.first()
// Pick a score that differs from whatever a previous run left behind,
// otherwise "no change" is the correct outcome and the assertion is meaningless.
const existing = Number((await target.inputValue()) || '0')
const NEW_SCORE = String(existing === 42 ? 64 : 42)
await target.fill(NEW_SCORE)
await target.press('Enter')
await page.waitForTimeout(2000)
const gradeAfter = await firstRowGrade()
check(
  gradeBefore.trim() !== gradeAfter.trim(),
  'scoring recomputes the course grade',
  `${gradeBefore.trim()} -> ${gradeAfter.trim()} (wrote ${NEW_SCORE})`,
)

// Persist across reload.
await page.reload({ waitUntil: 'networkidle' })
const persisted = await page.locator('tbody input[aria-label^="Score for"]').first().inputValue()
check(persisted === NEW_SCORE, 'score persists across reload', `value="${persisted}"`)
await page.screenshot({ path: `${SHOTS}/lms-gradebook.png`, fullPage: true })

// ── Clean up: withdraw the learner we added ──────────────────────────────────
if (hasCandidate) {
  await page.goto(sectionUrl.split('?')[0] + '?tab=roster', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Withdraw' }).last().click()
  await page.waitForTimeout(2200)
  await page.waitForLoadState('networkidle')
  const finalN = Number((await enrolledHeading()).match(/\d+/)[0])
  check(finalN === beforeN, 'withdrawing removes them again', `-> ${finalN}`)
}

await ctx.close()

// ── Authorization ────────────────────────────────────────────────────────────
const sectionPath = new URL(sectionUrl).pathname
const { ctx: c2, page: p2 } = await pageFor('usr_andre') // specialist
await p2.goto(BASE + sectionPath, { waitUntil: 'networkidle' })
const readOnly = await p2.getByText('read only').count()
const editable = await p2.locator('input[aria-label^="Score for"]').count()
check(readOnly > 0 && editable === 0, 'specialist gets read-only gradebook', `readOnlyBadge=${readOnly} inputs=${editable}`)
await c2.close()

const { ctx: c3, page: p3 } = await pageFor('usr_carmen') // guardian
const res = await p3.goto(BASE + sectionPath, { waitUntil: 'networkidle' })
const blocked = /outside your access/.test(await p3.content())
check(blocked, 'guardian is blocked from the section', `status=${res.status()}`)
await c3.close()

const real = errors.filter((e) => !/favicon|ERR_NETWORK_CHANGED|Download the React/i.test(e))
check(real.length === 0, 'no console or page errors', real.slice(0, 2).join(' | '))

await browser.close()
console.log(`\nScreenshots in ${SHOTS}/`)
process.exit(failures ? 1 : 0)

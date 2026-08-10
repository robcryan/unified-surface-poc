/**
 * End-to-end check of the tile surface in a real browser.
 *
 * Exercises the thing the product is actually for: pick a tile from the
 * catalog, move it, resize it, remove it, and confirm every change survives a
 * reload. An HTTP-status smoke test cannot tell you any of this.
 */
import { chromium } from 'playwright'
import { sealData } from 'iron-session'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const PASSWORD = 'prototype-only-session-secret-change-me-32+'
const SHOTS = 'scripts/.shots'
const USER = process.argv[2] ?? 'usr_andre'
mkdirSync(SHOTS, { recursive: true })

let failures = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await ctx.addCookies([
  {
    name: 'unified_surface_session',
    value: await sealData({ userId: USER }, { password: PASSWORD, ttl: 0 }),
    domain: 'localhost',
    path: '/',
  },
])
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const titles = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('main section > header h2')].map((h) => h.textContent),
  )

async function settle() {
  await page.waitForLoadState('networkidle')
  await page
    .waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 20000 })
    .catch(() => {})
}

// Warm, then start from the role default.
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await settle()
if (await page.getByRole('button', { name: 'Reset to default' }).count()) {
  await page.getByRole('button', { name: 'Reset to default' }).click()
  await page.waitForTimeout(1500)
  await settle()
}

const start = await titles()
console.log(`start: ${start.join(' | ')}\n`)

// ── 1. Catalog ───────────────────────────────────────────────────────────────
await page.getByRole('button', { name: '+ Add tile' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${SHOTS}/catalog.png`, fullPage: true })

// Scoped to catalog cards — `has-text` is case-insensitive and would otherwise
// also match the "+ Add tile" toolbar button.
const addable = page.locator('button:has(span:text-is("+ add"))')
const addableCount = await addable.count()
check(addableCount > 0, 'catalog offers tiles to add', `count=${addableCount}`)

const groups = await page.evaluate(() =>
  [...document.querySelectorAll('span')]
    .map((s) => s.textContent?.trim())
    .filter((t) => ['SIS', 'LMS', 'Early Intervention', 'Course Content', 'Cross-system'].includes(t)),
)
check(new Set(groups).size >= 3, 'catalog grouped by source system', [...new Set(groups)].join(', '))

// ── 2. Add ───────────────────────────────────────────────────────────────────
const newTitle = await addable.first().locator("span.truncate").first().textContent()
await addable.first().click()
await page.waitForTimeout(2500)
await settle()
const afterAdd = await titles()
check(afterAdd.includes(newTitle.trim()), `added "${newTitle.trim()}" from catalog`, `${start.length} -> ${afterAdd.length} tiles`)

// ── 3. Resize ────────────────────────────────────────────────────────────────
if (!(await page.getByRole('button', { name: 'Done' }).count())) {
  await page.getByRole('button', { name: 'Customize view' }).click()
  await page.waitForTimeout(300)
}
const firstWrap = page.locator('main .grid > div').first()
const spanBefore = await firstWrap.getAttribute('class')
await page.locator('button[aria-label^="Resize "]').first().click()
await page.waitForTimeout(800)
const spanAfter = await firstWrap.getAttribute('class')
check(spanBefore !== spanAfter, 'resize changes tile width', `${spanBefore?.match(/lg:col-span-\d+/)} -> ${spanAfter?.match(/lg:col-span-\d+/)}`)

// ── 4. Move ──────────────────────────────────────────────────────────────────
const orderBefore = await titles()
const handle = page.locator('button[aria-label^="Move "]').first()
const hb = await handle.boundingBox()
const target = await page.locator('main .grid > div').nth(2).boundingBox()
if (hb && target) {
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + 30, hb.y + 30, { steps: 6 })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(1000)
}
const orderAfter = await titles()
check(JSON.stringify(orderBefore) !== JSON.stringify(orderAfter), 'drag reorders tiles')

// ── 5. Remove ────────────────────────────────────────────────────────────────
const removeBtns = page.locator('button[aria-label^="Remove "]')
const removedLabel = await removeBtns.first().getAttribute('aria-label')
const removedType = removedLabel.replace('Remove ', '')
await removeBtns.first().click()
await page.waitForTimeout(900)
const afterRemove = await titles()
check(afterRemove.length === orderAfter.length - 1, `removed a tile (${removedType})`, `${orderAfter.length} -> ${afterRemove.length}`)

// ── 6. Persistence across reload ─────────────────────────────────────────────
await page.reload({ waitUntil: 'networkidle' })
await settle()
const afterReload = await titles()
check(
  JSON.stringify(afterReload) === JSON.stringify(afterRemove),
  'layout survives a reload',
  `${afterReload.join(' | ')}`,
)
await page.screenshot({ path: `${SHOTS}/customized.png`, fullPage: true })

// ── 7. Restore to role default ───────────────────────────────────────────────
await page.getByRole('button', { name: 'Reset to default' }).click()
await page.waitForTimeout(1800)
await settle()
const afterReset = await titles()
check(
  JSON.stringify(afterReset) === JSON.stringify(start),
  'reset restores the role default',
  afterReset.join(' | '),
)

const real = errors.filter((e) => !/favicon|Download the React/i.test(e))
check(real.length === 0, 'no console or page errors', real.slice(0, 2).join(' | '))

await browser.close()
console.log(`\nScreenshots in ${SHOTS}/`)
process.exit(failures ? 1 : 0)

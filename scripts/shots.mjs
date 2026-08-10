/**
 * Screenshot every persona, warm, without mutating any stored layout.
 * Usage: node scripts/shots.mjs
 */
import { chromium } from 'playwright'
import { sealData } from 'iron-session'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const PASSWORD = 'prototype-only-session-secret-change-me-32+'
const OUT = 'scripts/.shots'
mkdirSync(OUT, { recursive: true })

const PERSONAS = [
  ['learner', 'usr_lrn_0003'],
  ['teacher', 'usr_priya'],
  ['specialist', 'usr_andre'],
  ['administrator', 'usr_lena'],
  ['guardian', 'usr_carmen'],
]

const browser = await chromium.launch()

for (const [name, userId] of PERSONAS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const sealed = await sealData({ userId }, { password: PASSWORD, ttl: 0 })
  await ctx.addCookies([
    { name: 'unified_surface_session', value: sealed, domain: 'localhost', path: '/' },
  ])
  const page = await ctx.newPage()

  // Warm the route first so the dev compiler isn't in the picture.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  // Wait for skeletons to clear.
  await page
    .waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 15000 })
    .catch(() => console.log(`  ! ${name}: skeletons still present after 15s`))
  await page.waitForTimeout(500)

  await page.screenshot({ path: `${OUT}/persona-${name}.png`, fullPage: true })
  const tiles = await page.locator('section').count()
  const links = await page.locator('a[href^="/learner/"]').count()
  console.log(`${name.padEnd(14)} tiles=${tiles} drill-down-links=${links}`)
  await ctx.close()
}

await browser.close()
console.log(`\nWrote screenshots to ${OUT}/`)

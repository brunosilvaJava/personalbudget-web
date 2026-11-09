// Renders the PWA icons (PNG) from the wallet mark of public/favicon.svg.
//
//   npm run icons                              (Playwright's own Chromium: npx playwright install chromium)
//   CHROME_PATH=/usr/bin/google-chrome npm run icons
//
// The PNGs are committed; run this only when the mark or the green changes.
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const GREEN = '#16a34a'
// The mark as drawn in favicon.svg (32x32 box), without its rounded square.
const MARK = `<path d="M8 11.5A2.5 2.5 0 0 1 10.5 9H22a1 1 0 0 1 1 1v2h-12.5a1 1 0 0 0 0 2H24a1 1 0 0 1 1 1v7.5A2.5 2.5 0 0 1 22.5 25h-12A2.5 2.5 0 0 1 8 22.5z" fill="#fff"/><circle cx="21" cy="19.5" r="1.6" fill="${GREEN}"/>`

/** @param {{ rounded: boolean, scale: number }} options */
function svg({ rounded, scale }) {
  // The mark is centered on (16.5, 17): scale it around that point, then put it on the middle.
  const mark = `<g transform="translate(16 16) scale(${scale}) translate(-16.5 -17)">${MARK}</g>`
  const background = rounded
    ? `<rect width="32" height="32" rx="7" fill="${GREEN}"/>`
    : `<rect width="32" height="32" fill="${GREEN}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">${background}${mark}</svg>`
}

const ICONS = [
  // "any": rounded, the mark filling most of the square
  { file: 'public/icons/icon-192.png', size: 192, rounded: true, scale: 1.2 },
  { file: 'public/icons/icon-512.png', size: 512, rounded: true, scale: 1.2 },
  // "maskable": full bleed, the mark inside the central 80% (the launcher crops the rest)
  { file: 'public/icons/icon-maskable-512.png', size: 512, rounded: false, scale: 0.95 },
  // iOS rounds the corners itself
  { file: 'public/apple-touch-icon.png', size: 180, rounded: false, scale: 1.05 },
]

mkdirSync('public/icons', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
try {
  const page = await browser.newPage()
  for (const { file, size, rounded, scale } of ICONS) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg({ rounded, scale })}</body></html>`,
    )
    await page.screenshot({ path: file, omitBackground: true })
    console.log(file)
  }
} finally {
  await browser.close()
}

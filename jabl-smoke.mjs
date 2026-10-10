import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto('http://127.0.0.1:43127/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Dump header buttons
const headerInfo = await page.evaluate(() => {
  const header = document.querySelector('header');
  const buttons = [...document.querySelectorAll('header button, header [role="button"]')].map(b => ({
    label: b.getAttribute('aria-label') || b.textContent?.trim().slice(0,40),
    tag: b.tagName,
    disabled: b.disabled,
    rect: b.getBoundingClientRect().toJSON(),
  }));
  const themeBtn = document.querySelector('button[aria-label="Toggle theme"]');
  const paletteBtn = document.querySelector('button[aria-label="Theme settings"]');
  const explorerButtons = [...document.querySelectorAll('button')].filter(b => /Customer\.cls|hello\.p|samples/.test(b.textContent||''));
  return {
    htmlDark: document.documentElement.classList.contains('dark'),
    dataTheme: document.querySelector('[data-theme]')?.getAttribute('data-theme'),
    headerButtons: buttons,
    hasTheme: !!themeBtn,
    hasPalette: !!paletteBtn,
    explorer: explorerButtons.map(b => ({ text: b.textContent?.trim(), rect: b.getBoundingClientRect().toJSON() })),
    status: document.querySelector('header span.truncate, header .text-muted-foreground')?.textContent,
  };
});
console.log('BEFORE', JSON.stringify(headerInfo, null, 2));

// Click theme toggle
const theme = page.locator('button[aria-label="Toggle theme"]');
console.log('theme count', await theme.count());
if (await theme.count()) {
  await theme.click({ force: true });
  await page.waitForTimeout(500);
}
const afterTheme = await page.evaluate(() => ({
  htmlDark: document.documentElement.classList.contains('dark'),
  dataTheme: document.querySelector('[data-theme]')?.getAttribute('data-theme'),
  iconTitle: document.querySelector('button[aria-label="Toggle theme"]')?.getAttribute('title'),
  localStorage: localStorage.getItem('jabl-theme'),
}));
console.log('AFTER THEME', afterTheme);

// Click palette
const palette = page.locator('button[aria-label="Theme settings"]');
if (await palette.count()) {
  await palette.click({ force: true });
  await page.waitForTimeout(500);
}
const dialog = await page.evaluate(() => ({
  dialogText: document.body.innerText.includes('Theme settings'),
  openDialogs: [...document.querySelectorAll('[data-slot="dialog-content"], [role="dialog"]')].map(d => d.textContent?.slice(0,80)),
}));
console.log('DIALOG', dialog);

// Open Customer.cls
const customer = page.locator('button', { hasText: 'Customer.cls' });
console.log('customer count', await customer.count());
if (await customer.count()) {
  await customer.first().click({ force: true });
  await page.waitForTimeout(800);
}
const tabs = await page.evaluate(() => ({
  tabTexts: [...document.querySelectorAll('button')].filter(b => /\.(p|cls|i|df)\b/.test(b.textContent||'') && b.closest('[class*="border-b"]')).map(b => b.textContent?.trim()),
  // broader: look near editor tabs area
  allTabLike: [...document.querySelectorAll('.truncate, button')].map(b => b.textContent?.trim()).filter(t => t && /\.(p|cls|i|df)/.test(t)).slice(0, 20),
  status: [...document.querySelectorAll('header span')].map(s => s.textContent).join(' | '),
}));
console.log('TABS', tabs);

console.log('LOGS:\n' + logs.slice(-40).join('\n'));
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/playwright-after-clicks.png', fullPage: true });
await browser.close();

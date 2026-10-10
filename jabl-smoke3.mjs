import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:43127/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Theme toggle
await page.getByRole('button', { name: 'Toggle theme' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/08-theme-light.png' });
const light = await page.evaluate(() => ({
  dark: document.documentElement.classList.contains('dark'),
  theme: document.querySelector('[data-theme]')?.getAttribute('data-theme'),
}));
console.log('light', light);

// Theme settings
await page.getByRole('button', { name: 'Theme settings' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/09-theme-settings.png' });
await page.getByRole('button', { name: 'Done' }).click();
await page.waitForTimeout(300);

// Back to dark for screenshots
await page.getByRole('button', { name: 'Toggle theme' }).click();
await page.waitForTimeout(300);

// Open Customer.cls via in-page click
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'Customer.cls');
  btn?.click();
});
await page.waitForTimeout(800);
const afterOpen = await page.evaluate(() => {
  const monaco = document.querySelector('.monaco-editor');
  const textarea = document.querySelector('.monaco-editor textarea');
  return {
    status: [...document.querySelectorAll('header span')].map(s => s.textContent).join(' | '),
    tabTitles: [...document.querySelectorAll('button[title]')].map(b => b.getAttribute('title')),
    monacoValue: textarea?.value?.slice(0, 120) || null,
    hasMonaco: !!monaco,
  };
});
console.log('afterOpen', afterOpen);
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/10-customer-cls-open.png' });

// Open customer-query.p
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'customer-query.p');
  btn?.click();
});
await page.waitForTimeout(600);
const tabs = await page.evaluate(() => ({
  status: [...document.querySelectorAll('header span')].map(s => s.textContent).join(' | '),
  titles: [...document.querySelectorAll('button[title]')].map(b => b.getAttribute('title')),
}));
console.log('tabs', tabs);
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/11-multi-tabs.png' });

await browser.close();

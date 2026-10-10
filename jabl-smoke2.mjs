import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));

await page.goto('http://127.0.0.1:43127/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Instrument: wrap openFile via React fiber is hard; instead click and inspect DOM thoroughly
const before = await page.evaluate(() => {
  const files = [...document.querySelectorAll('button')].filter(b => /\.(p|cls|i|df)$/.test((b.textContent||'').trim()));
  return files.map(b => ({ text: (b.textContent||'').trim(), html: b.outerHTML.slice(0,200), rect: b.getBoundingClientRect().toJSON() }));
});
console.log('FILE BUTTONS', JSON.stringify(before, null, 2));

const cust = page.locator('button', { hasText: /^Customer\.cls/ });
console.log('count', await cust.count());
await cust.first().click({ force: true });
await page.waitForTimeout(1000);

const after = await page.evaluate(() => {
  // Find tab strip - buttons next to close icons in editor area
  const headerStatus = [...document.querySelectorAll('header span')].map(s => s.textContent);
  const tabBar = document.querySelector('.flex.h-9, [class*="h-9"]');
  return {
    headerStatus,
    bodyHasCustomer: document.body.innerText.includes('CLASS samples.Customer'),
    bodyHasHello: document.body.innerText.includes('Hello World'),
    activeTabCandidates: [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(t => /\.(p|cls)/.test(t)),
  };
});
console.log('AFTER CLICK', JSON.stringify(after, null, 2));

// Try calling store directly if we can find it
const storeTest = await page.evaluate(async () => {
  // Click via dispatchEvent on the Customer.cls button
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'Customer.cls' || (b.textContent||'').includes('Customer.cls'));
  if (!btn) return { error: 'no btn' };
  btn.click();
  await new Promise(r => setTimeout(r, 500));
  return {
    status: [...document.querySelectorAll('header span')].map(s => s.textContent).join(' || '),
    hasClass: document.body.innerText.includes('CLASS samples.Customer'),
  };
});
console.log('DIRECT CLICK', storeTest);

await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/playwright-file-open.png' });
await browser.close();

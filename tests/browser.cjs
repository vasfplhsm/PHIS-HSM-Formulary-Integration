const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const data = require('../extension/data/formulary.json');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer(async (req, res) => {
    const file = {'/': 'index.html', '/demo.js': 'demo.js', '/demo.css': 'demo.css'}[req.url];
    if (!file) { res.writeHead(404).end(); return; }
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'};
    res.setHeader('Content-Type', types[path.extname(file)]);
    res.end(await fs.readFile(path.join(root, 'demo', file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin);
    await page.evaluate(({data, origin}) => {
      window.chrome = {
        storage: {local: {get: async () => ({sites: [origin]})}},
        runtime: {sendMessage: async () => data}
      };
    }, {data, origin});
    await page.addScriptTag({path: path.join(root, 'extension/matcher.js')});
    await page.addScriptTag({path: path.join(root, 'extension/content.js')});
    await page.addStyleTag({path: path.join(root, 'extension/content.css')});
    const panel = page.locator('#hsm-formulary-root section');
    await page.locator('#hsm-formulary-root').waitFor({state: 'attached'});
    const drugs = page.locator('#rows tr > td:nth-child(2)');
    for (let index = 0; index < 8; index++) {
      const cell = drugs.nth(index);
      assert.equal(await cell.getAttribute('tabindex'), '0');
      await cell.locator('.name').hover();
      await panel.waitFor({state: 'visible', timeout: 5000});
      const text = await panel.innerText();
      assert.match(text, /Indication/);
      assert.match(text, /Dosage reference/);
      if (index === 4) {
        assert.match(text, /Possible reference — confirm product/);
        assert.match(text, /omits “Sublingual”/);
        assert.doesNotMatch(text, /Listed in HSM formulary/);
      } else assert.match(text, /Listed in HSM formulary/);
      if (index === 5) assert.match(text, /Trimetazidine 35mg MR Tablet/);
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.y + bounds.height <= 801, `Popup within viewport for row ${index}`);
      // Cursor can move from the medication into the popup and stay there.
      await panel.getByRole('heading', {name: 'Indication', exact: true}).hover();
      await page.waitForTimeout(550);
      assert.equal(await panel.isVisible(), true);
      await page.keyboard.press('Escape');
      await panel.waitFor({state: 'hidden'});
    }
    // A name in the Remarks column must not activate a medication popup.
    await page.locator('#rows tr').first().locator('td').nth(6).evaluate(el => { el.textContent = 'Perindopril 4 mg Tablet'; });
    await page.locator('#rows tr').first().locator('td').nth(6).hover();
    assert.equal(await panel.isVisible(), false);
    // Newly appended rows become keyboard-focusable without reloading.
    await page.getByRole('button', {name: 'Simulate prescription update'}).click();
    const dynamic = drugs.last();
    await page.waitForFunction(() => document.querySelector('#rows tr:last-child td:nth-child(2)').tabIndex === 0);
    await dynamic.focus();
    await panel.waitFor({state: 'visible', timeout: 5000});
    assert.match(await panel.innerText(), /gastrointestinal bleed/);
    // Reusing a ZK row for a different drug must dismiss the old reference.
    await dynamic.locator('.name').evaluate(el => { el.textContent = 'Unknown medicine 999 mg Tablet'; });
    await panel.waitFor({state: 'hidden'});
    await page.waitForFunction(() => !document.querySelector('#rows tr:last-child td:nth-child(2)').hasAttribute('tabindex'));
    await dynamic.hover();
    assert.equal(await panel.isVisible(), false);
    // Wrong ports and unregistered origins must not activate detection.
    const denied = await browser.newPage();
    await denied.goto(origin);
    await denied.evaluate(() => { window.chrome = {storage: {local: {get: async () => ({sites: ['http://127.0.0.1:1']})}}}; });
    await denied.addScriptTag({path: path.join(root, 'extension/content.js')});
    assert.equal(await denied.locator('#hsm-formulary-root').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: eight medication labels with wrapping/icons; route warning; hover persistence; popup bounds; Escape; column scoping; dynamic keyboard focus; stale reference dismissal; origin restriction. Extension APIs mocked.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

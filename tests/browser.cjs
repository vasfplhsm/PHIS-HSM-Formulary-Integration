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
    await page.addScriptTag({path: path.join(root, 'extension/checks.js')});
    await page.addScriptTag({path: path.join(root, 'extension/prescription.js')});
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
      if (index === 4) {
        assert.equal(await panel.getByRole('heading', {name: /^Dosage reference$/i}).count(), 0);
        assert.match(await panel.innerText(), /omits “Sublingual”/);
        assert.equal(await panel.locator('.medication-title').textContent(), 'Glyceryl Trinitrate 0.5 mg Tablet');
        await panel.getByRole('button', {name: 'View reference for Glyceryl Trinitrate 0.5mg Sublingual Tablet', exact: true}).click();
      }
      const text = await panel.innerText();
      assert.match(text, /Indication/i);
      assert.match(text, /Dosage reference/i);
      if (index === 4) {
        assert.match(text, /Selected reference — verify product/);
        assert.match(text, /omits “Sublingual”/);
        assert.doesNotMatch(text, /Listed in HSM formulary/);
        assert.equal(await panel.locator('.medication-title').textContent(), 'Glyceryl Trinitrate 0.5mg Sublingual Tablet');
      } else assert.match(text, /Listed in HSM formulary/);
      if (index === 5) assert.match(text, /Trimetazidine 35mg MR Tablet/);
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.y + bounds.height <= 801, `Popup within viewport for row ${index}`);
      // Cursor can move from the medication into the popup and stay there.
      await panel.getByRole('heading', {name: /^Indication$/i}).hover();
      await page.waitForTimeout(550);
      assert.equal(await panel.isVisible(), true);
      if (index === 0 && process.env.PHIS_SCREENSHOT_DIR) {
        await fs.mkdir(process.env.PHIS_SCREENSHOT_DIR, {recursive: true});
        await page.screenshot({path: path.join(process.env.PHIS_SCREENSHOT_DIR, 'medication-popup.png')});
      }
      if (index === 0) {
        const details = panel.locator('details').first();
        assert.equal(await details.locator('.details-content').isVisible(), false);
        await details.locator('summary').click();
        await details.getByRole('heading', {name: /Prescriber category/i}).waitFor({state: 'visible'});
        assert.equal(await details.getAttribute('open') !== null, true);
        const titleBefore = await panel.locator('.medication-title').boundingBox();
        await panel.hover({position: {x: 25, y: bounds.height - 35}});
        await page.mouse.wheel(0, 1200);
        await page.waitForFunction(() => {
          const panel = document.querySelector('#hsm-formulary-root').shadowRoot.querySelector('section');
          return panel.scrollTop >= panel.scrollHeight - panel.clientHeight - 1;
        });
        const titleAfter = await panel.locator('.medication-title').boundingBox();
        assert.ok(Math.abs(titleAfter.y - titleBefore.y) < 1, 'Medication title remains fixed while the content scrolls');
        assert.equal(await panel.locator('.medication-title').textContent(), 'Bisoprolol Fumarate 2.5 mg Tablet');
        if (process.env.PHIS_SCREENSHOT_DIR) {
          await page.screenshot({path: path.join(process.env.PHIS_SCREENSHOT_DIR, 'medication-popup-scrolled.png')});
        }
        await panel.getByRole('button', {name: 'Close', exact: true}).click();
        await panel.waitFor({state: 'hidden'});
      }
      await page.keyboard.press('Escape');
      await panel.waitFor({state: 'hidden'});
    }
    // Fallbacks show choices without clinical details, and never persist a selection.
    await page.evaluate(() => appendMedication('Metformni 500mg tablet'));
    const imperfect = drugs.last();
    await imperfect.hover();
    await panel.waitFor({state: 'visible'});
    assert.equal(await panel.locator('.suggestion-card').count(), 2);
    assert.equal(await panel.getByRole('heading', {name: /^Dosage reference$/i}).count(), 0);
    assert.equal(await panel.getByRole('heading', {name: /^Indication$/i}).count(), 0);
    assert.match(await panel.innerText(), /Release type is omitted/);
    if (process.env.PHIS_SCREENSHOT_DIR) {
      await page.screenshot({path: path.join(process.env.PHIS_SCREENSHOT_DIR, 'possible-matches.png')});
    }
    const immediate = panel.getByRole('button', {name: 'View reference for Metformin HCl 500 mg Tablet', exact: true});
    await immediate.focus();
    await page.keyboard.press('Enter');
    await panel.getByRole('heading', {name: /^Dosage reference$/i}).waitFor({state: 'visible'});
    assert.equal(await panel.locator('.medication-title').textContent(), 'Metformin HCl 500 mg Tablet');
    assert.equal(await panel.locator('.product-group').count(), 1);
    assert.match(await panel.innerText(), /PHIS label: Metformni 500mg tablet/);
    assert.match(await panel.innerText(), /Selected reference — verify product/);
    await page.waitForTimeout(550);
    assert.equal(await panel.isVisible(), true, 'Keyboard selection keeps the reference open');
    await panel.getByRole('button', {name: 'Back to possible matches', exact: false}).click();
    assert.equal(await panel.getByRole('heading', {name: /^Dosage reference$/i}).count(), 0);
    await panel.getByRole('button', {name: 'View reference for Metformin HCl 500 mg Extended Release Tablet', exact: true}).click();
    assert.equal(await panel.locator('.medication-title').textContent(), 'Metformin HCl 500 mg Extended Release Tablet');
    await page.keyboard.press('Escape');
    await imperfect.hover();
    await panel.waitFor({state: 'visible'});
    assert.equal(await panel.getByRole('heading', {name: /^Dosage reference$/i}).count(), 0, 'Selections are not reused automatically');
    await panel.getByRole('button', {name: 'None of these — close', exact: true}).click();
    await panel.waitFor({state: 'hidden'});
    await page.evaluate(() => appendMedication('metform'));
    await drugs.last().hover();
    await panel.waitFor({state: 'visible'});
    assert.match(await panel.innerText(), /Strength is not specified/);
    assert.match(await panel.innerText(), /Dosage form is not specified/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => appendMedication('Dexilant'));
    await drugs.last().hover();
    await panel.waitFor({state: 'visible'});
    assert.match(await panel.innerText(), /Multiple formulary matches/);
    assert.equal(await panel.getByRole('heading', {name: /^Dosage reference$/i}).count(), 0);
    await panel.getByRole('button', {name: 'View reference for Dexlansoprazole 60mg Delayed Release Capsule', exact: true}).click();
    assert.equal(await panel.locator('.medication-title').textContent(), 'Dexlansoprazole 60mg Delayed Release Capsule');
    await page.keyboard.press('Escape');
    await page.evaluate(() => appendMedication('Bisoprolol 25 mg Tab'));
    await drugs.last().hover();
    assert.equal(await panel.isVisible(), false, 'A conflicting strength cannot open a suggested reference');
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
    console.log('PASS: screenshot labels; candidate selection with keyboard and mouse; details hidden before selection; missing-detail warnings; ambiguous brands; back/dismissal; nonpersistent choices; sticky scrolling; dynamic rows; origin and column restrictions. Extension APIs mocked.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

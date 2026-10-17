const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const manifest = require('../extension/manifest.json');
const root = path.resolve(__dirname, '..');

(async () => {
  const files = {'/': 'settings.html', '/settings.html': 'settings.html', '/settings.css': 'settings.css', '/settings.js': 'settings.js', '/csv.js': 'csv.js', '/matcher.js': 'matcher.js', '/checks.js': 'checks.js', '/data/formulary.json': 'data/formulary.json'};
  const server = http.createServer(async (req, res) => {
    const file = files[req.url];
    if (!file) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'}[path.extname(file)]);
    res.end(await fs.readFile(path.join(root, 'extension', file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
    const page = await browser.newPage({viewport: {width: 440, height: 800}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(version => {
      window.__state = {};
      window.__requests = []; window.__removed = []; window.__grant = true;
      window.chrome = {
        runtime: {getManifest: () => ({version})},
        storage: {local: {
          get: async () => structuredClone(window.__state),
          set: async values => Object.assign(window.__state, structuredClone(values)),
          remove: async key => { delete window.__state[key]; }
        }},
        permissions: {
          request: async permission => { window.__requests.push(permission); return window.__grant; },
          remove: async permission => { window.__removed.push(permission); return true; }
        }
      };
    }, manifest.version);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => document.getElementById('record-count').textContent === '1,025');
    assert.equal(await page.locator('#version').textContent(), 'v' + manifest.version);
    assert.equal(await page.locator('#empty-sites').isVisible(), true);
    assert.equal(await page.locator('#reset').isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Popup has no horizontal overflow');

    await page.evaluate(() => { window.__grant = false; });
    await page.getByLabel('Hospital address').fill('http://10.138.118.11:8080');
    await page.getByRole('button', {name: 'Enable site'}).click();
    await page.locator('#status.error').waitFor();
    assert.equal(await page.locator('.site-row').count(), 0);
    await page.evaluate(() => { window.__grant = true; });
    await page.getByRole('button', {name: 'Enable site'}).click();
    await page.waitForFunction(() => document.querySelectorAll('.site-row').length === 1);
    assert.equal(await page.locator('#status.error').count(), 0);
    await page.getByLabel('Hospital address').fill('10.138.118.11:8081');
    await page.getByRole('button', {name: 'Enable site'}).click();
    await page.waitForFunction(() => document.querySelectorAll('.site-row').length === 2);
    await page.getByRole('button', {name: 'Remove 10.138.118.11:8080', exact: true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.site-row').length === 1);
    assert.equal(await page.evaluate(() => window.__removed.length), 0, 'Removing a port preserves permissions shared by another registered origin');
    await page.getByRole('button', {name: 'Remove 10.138.118.11:8081', exact: true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.site-row').length === 0);
    assert.deepEqual(await page.evaluate(() => window.__removed), [{origins: ['http://10.138.118.11/*']}]);

    assert.equal(await page.locator('#rules-summary').textContent(), 'No interaction rules loaded');
    await page.locator('#broad-groups').uncheck();
    await page.waitForFunction(() => window.__state.broadGroups === false);
    await page.locator('#broad-groups').check();
    const rules = {schemaVersion: 1, name: 'SYNTHETIC TEST ONLY', version: '1', review: {status: 'approved', by: 'Test reviewer', organisation: 'Test organisation', date: '2026-01-01'}, source: {title: 'Synthetic fixture', url: 'https://example.test/fixture'}, products: [{name: 'Perindopril 4 mg Tablet', ingredients: ['test-a'], classes: ['Synthetic class']}, {name: 'Bisoprolol Fumarate 2.5 mg Tablet', ingredients: ['test-b'], classes: ['Synthetic class']}], rules: [{id: 'synthetic', ingredients: ['test-a','test-b'], severity: 'major', summary: 'Synthetic test effect; not clinical data.', action: 'Synthetic test action.', source: {title: 'Synthetic fixture', url: 'https://example.test/fixture'}}]};
    const draft = structuredClone(rules); draft.review.status = 'draft';
    await page.locator('#rules-file').setInputFiles({name: 'draft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draft))});
    await page.locator('#status.error').waitFor();
    assert.equal(await page.locator('#rules-summary').textContent(), 'No interaction rules loaded');
    await page.locator('#rules-file').setInputFiles({name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(rules))});
    await page.waitForFunction(() => document.getElementById('rules-summary').textContent.includes('1 local interaction rules'));
    assert.match(await page.locator('#rules-meta').textContent(), /Test reviewer/);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Download blank template'}).click();
    const download = await downloadPromise;
    const template = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(template.review.status, 'draft'); assert.deepEqual(template.rules, []);

    await page.locator('#csv').setInputFiles({name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('Missing,Columns\n1,2')});
    await page.locator('#status.error').waitFor();
    assert.equal(await page.locator('#record-count').textContent(), '1,025', 'Invalid CSV preserves reference');
    await page.locator('#csv').setInputFiles({name: 'reference.csv', mimeType: 'text/csv', buffer: Buffer.from('Data updated:,20/07/2026,\nGeneric Name,Indication,Dosage\nDemo 10 mg Tablet,Demo indication,Demo reference dosage')});
    await page.waitForFunction(() => document.getElementById('record-count').textContent === '1');
    assert.equal(await page.locator('#source-label').textContent(), 'Your imported reference');
    assert.equal(await page.locator('#updated-date').textContent(), '20 Jul 2026');
    assert.equal(await page.locator('#rules-summary').textContent(), 'Rules inactive for this formulary');
    await page.getByRole('button', {name: 'Restore bundled formulary'}).click();
    await page.waitForFunction(() => document.getElementById('record-count').textContent === '1,025');

    await page.getByRole('button', {name: 'Remove rules', exact: true}).click();
    await page.waitForFunction(() => document.getElementById('rules-summary').textContent === 'No interaction rules loaded');
    await page.getByLabel('Hospital address').fill('http://phis.phishsm.moh.gov.my:8080');
    await page.getByRole('button', {name: 'Enable site'}).click();
    await page.waitForFunction(() => document.querySelectorAll('.site-row').length === 1);
    // Capture the actual HTML/CSS with test API bindings, rather than a separate visual mock.
    if (process.env.PHIS_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.PHIS_SCREENSHOT_DIR, {recursive: true});
      await page.locator('#status').evaluate(el => { el.hidden = true; });
      await page.screenshot({path: path.join(process.env.PHIS_SCREENSHOT_DIR, 'settings.png'), fullPage: true});
    }
    await page.setViewportSize({width: 320, height: 720});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Small settings view has no horizontal overflow');
    await page.setViewportSize({width: 1100, height: 900});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Full options page has no horizontal overflow');
    assert.deepEqual(errors, []);
    console.log('PASS: responsive settings; permission denial and registration; shared-host removal; CSV rejection/import/restore; metadata and source status. Extension APIs mocked.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

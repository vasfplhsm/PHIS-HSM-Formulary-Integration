const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const http = require('node:http');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
  let server;
  try {
    let page = await browser.newPage({viewport: {width: 1867, height: 1040}});
    const errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {if (/^https?:/.test(request.url())) network.push(request.url());});
    server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://127.0.0.1').pathname;if(pathname!=='/OPEN-DEMO.html'&&!/^\/(demo|extension)\//.test(pathname))throw Error('Not found');const filename=path.resolve(root,'.'+pathname);if(!filename.startsWith(root+path.sep))throw Error('Not found');const body=await fs.readFile(filename);res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(filename)]||'application/octet-stream');res.end(body);}catch(_){res.writeHead(404).end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    let fileVerified=true;
    try {await page.goto(pathToFileURL(path.join(root,'OPEN-DEMO.html')).href);}
    catch(error){if(!error.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw error;fileVerified=false;console.log('SKIP direct file navigation: managed Chromium policy blocks file:// pages. Testing the same self-contained HTML over loopback HTTP.');await page.close();page=await browser.newPage({viewport:{width:1867,height:1040}});page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});await page.goto(origin+'/OPEN-DEMO.html');}
    await page.waitForSelector('html[data-preview-ready="true"]', {state: 'attached'});
    assert.match(await page.locator('#preview-status').textContent(), /Ready/);
    assert.equal(await page.locator('#rows tr').count(), 8);
    const panel = page.locator('#hsm-formulary-root section');
    const marked = severity => page.locator(`#rows [data-hsm-alert="${severity}"]`);
    async function scenario(id) {
      await page.locator('#scenario').selectOption(id);
      if (id === 'no-rules') await page.waitForURL(/case=no-rules/);
      await page.waitForSelector('html[data-preview-ready="true"]', {state: 'attached'});
      await page.evaluate(async () => { await PhisPrescription.ready; });
      await page.waitForFunction(() => Array.from(document.querySelectorAll('tbody tr:not([hidden]) td[data-medication]')).every(cell => PhisPrescription.forCell(cell)));
    }
    async function flags(serious, review = null) {
      await page.waitForFunction(({serious, review}) => document.querySelectorAll('#rows [data-hsm-alert="serious"]').length === serious && (review === null || document.querySelectorAll('#rows [data-hsm-alert="review"]').length === review), {serious, review});
    }
    await page.getByRole('button', {name: 'Run quick engine checks'}).click();
    assert.equal(await page.locator('#results .pass').count(), 8);
    assert.equal(await page.locator('#results .fail').count(), 0);
    await page.locator('#quick-results summary').click();
    if (process.env.PHIS_SCREENSHOT_DIR) {await fs.mkdir(process.env.PHIS_SCREENSHOT_DIR, {recursive:true}); await page.screenshot({path:path.join(process.env.PHIS_SCREENSHOT_DIR,'phis-dummy.png')});}
    await scenario('major'); await flags(2);
    await page.locator('#rows [data-hsm-owned="alert-badge"]').first().click();
    await panel.waitFor({state:'visible'});
    assert.match(await panel.innerText(), /SIMULATED MAJOR ALERT 1/);
    assert.match(await panel.innerText(), /No clinical review or clinical evidence/);
    assert.match(await panel.innerText(), /LOCAL DEMO/);
    assert.match(await panel.locator('.badges').innerText(), /Fictional demo product/);
    assert.doesNotMatch(await panel.locator('.badges').innerText(), /Listed in HSM formulary/);
    const title = panel.locator('.medication-title'); const before = await title.boundingBox();
    await panel.hover({position:{x:30,y:450}}); await page.mouse.wheel(0,1500);
    await page.waitForFunction(()=>document.querySelector('#hsm-formulary-root').shadowRoot.querySelector('section').scrollTop>50);
    assert.ok(Math.abs((await title.boundingBox()).y-before.y)<1,'Sticky title remains visible in long demo reference');
    await panel.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('checkbox',{name:'Select DEMO Beta 5 mg Tablet',exact:true}).check();
    await page.getByRole('button',{name:'Hide selected',exact:true}).click(); await flags(0);
    await page.getByRole('button',{name:'Restore hidden',exact:true}).click(); await flags(2);
    await page.getByRole('button',{name:'Remove selected',exact:true}).click(); await flags(0);
    await page.getByRole('button',{name:'Reset scenario',exact:true}).click(); await flags(2);
    await page.getByRole('checkbox',{name:'Select DEMO Beta 5 mg Tablet',exact:true}).check();
    await page.locator('#drug-input').fill('Empagliflozin 25 mg Tablet');
    await page.getByRole('button',{name:'Change selected name',exact:true}).click(); await flags(0);
    await scenario('major-two'); await flags(2);
    await scenario('contraindicated'); await flags(2);
    await page.locator('#rows [data-hsm-owned="alert-badge"]').first().click();
    assert.match(await panel.innerText(),/SIMULATED CONTRAINDICATED ALERT/);
    await page.keyboard.press('Escape');
    await scenario('multiple'); await flags(4);
    await page.locator('#rows [data-hsm-owned="alert-badge"]').first().click();
    assert.match(await panel.locator('.reference-block').first().textContent(),/Contraindicated/i);
    if(process.env.PHIS_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.PHIS_SCREENSHOT_DIR,'phis-dummy-alerts.png')});
    await page.keyboard.press('Escape');
    await scenario('moderate'); await flags(0,2);
    await scenario('group'); await flags(0,2);
    await scenario('imperfect'); await flags(0,0);
    await page.locator('#rows .name').first().hover(); await panel.waitFor({state:'visible'});
    assert.equal(await panel.getByRole('heading',{name:/^Dosage reference$/i}).count(),0);
    await panel.getByRole('button',{name:'View reference for Metformin HCl 500 mg Tablet',exact:true}).click();
    assert.equal(await panel.getByRole('heading',{name:/^Dosage reference$/i}).count(),1);
    assert.equal(await marked('serious').count(),0);
    await page.keyboard.press('Escape');
    await scenario('brand');
    await page.locator('#rows .name').first().hover(); await panel.waitFor({state:'visible'});
    assert.equal(await panel.locator('.suggestion-card').count(),2);
    await page.keyboard.press('Escape');
    await scenario('unknown'); await flags(0,0);
    await page.locator('#rows .name').first().hover(); assert.equal(await panel.isVisible(),false);
    await scenario('separate'); await flags(0,0);
    assert.equal(await page.locator('#secondary [data-hsm-alert]').count(),0);
    assert.equal(await page.locator('[data-hsm-owned="coverage"]').count(),2);
    await scenario('no-rules'); await flags(0,0);
    assert.match(await page.locator('[data-hsm-owned="coverage"]').first().textContent(),/No interaction rules loaded/);
    assert.equal(await page.locator('input[aria-label="Dummy queue number"]').inputValue(),'DEMO 1001');
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download demo rules'}).click();
    const downloaded=await downloadPromise; const demoRules=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
    assert.equal(demoRules.review.status,'demo'); assert.equal(demoRules.purpose,'synthetic-demo');
    assert.deepEqual(network.filter(url=>!url.startsWith(origin+'/')),[],'Standalone preview must not request internet resources');
    assert.deepEqual(errors,[]);

    // The generated settings sandbox uses the actual settings UI and normal validation.
    const settings=await browser.newPage({viewport:{width:440,height:900}});
    const settingsErrors=[];settings.on('pageerror',e=>settingsErrors.push(e.message));
    await settings.goto(fileVerified?pathToFileURL(path.join(root,'demo/settings-preview.html')).href:origin+'/demo/settings-preview.html');
    await settings.waitForFunction(()=>document.getElementById('record-count').textContent==='1,025');
    await settings.getByLabel('Hospital address').fill('http://dummy-hospital.invalid:8080');
    await settings.getByRole('button',{name:'Enable site'}).click();
    await settings.waitForFunction(()=>document.querySelectorAll('.site-row').length===1);
    await settings.locator('#rules-file').setInputFiles({name:'DEMO-ONLY.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(demoRules))});
    await settings.locator('#status.error').waitFor();assert.match(await settings.locator('#status').textContent(),/Demo fixtures cannot be imported/);
    await settings.locator('#csv').setInputFiles({name:'test.csv',mimeType:'text/csv',buffer:Buffer.from('Generic Name,Indication,Dosage\nSandbox medicine,Test indication,Test reference')});
    await settings.waitForFunction(()=>document.getElementById('record-count').textContent==='1');
    await settings.getByRole('button',{name:'Restore bundled formulary'}).click();
    await settings.waitForFunction(()=>document.getElementById('record-count').textContent==='1,025');
    await settings.reload();await settings.waitForFunction(()=>document.getElementById('record-count').textContent==='1,025');
    assert.equal(await settings.locator('.site-row').count(),0,'Sandbox settings are never persisted');assert.deepEqual(settingsErrors,[]);
    await settings.close();

    // File and loopback are permitted; an ordinary hospital origin cannot opt into demo rules.
    const gate=await browser.newPage();
    await gate.route('http://hospital.invalid/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html data-phis-demo="true"><body><table><tr><th>Drug Name</th><th>Order Detail</th></tr><tr><td>DEMO Alpha 10 mg Tablet</td><td>Test</td></tr><tr><td>DEMO Beta 5 mg Tablet</td><td>Test</td></tr></table></body></html>'}));
    await gate.goto('http://hospital.invalid/');
    const records=await page.evaluate(()=>PhisDemoBackend.data.records);
    await gate.evaluate(({records,demoRules})=>{window.chrome={storage:{local:{get:async()=>({sites:[location.origin]})}},runtime:{sendMessage:async msg=>msg.type==='formulary'?{records,updated:'Test'}:{ruleset:demoRules,demoMode:true}}}},{records,demoRules});
    for(const file of ['matcher.js','checks.js','prescription.js'])await gate.addScriptTag({path:path.join(root,'extension',file)});
    await gate.evaluate(()=>PhisPrescription.ready);
    assert.equal(await gate.locator('[data-hsm-alert="serious"]').count(),0);
    assert.match(await gate.locator('[data-hsm-owned="coverage"]').textContent(),/Demo fixtures cannot be imported/);await gate.close();

    const online=await browser.newPage();await online.goto(`http://127.0.0.1:${server.address().port}/demo/index.html?case=major`);
    await online.waitForSelector('html[data-preview-ready="true"]',{state:'attached'});
    assert.equal(await online.locator('#rows [data-hsm-alert="serious"]').count(),2);await online.close();
    const installed=await browser.newPage();await installed.goto(origin+'/OPEN-DEMO.html?preview=off');
    assert.match(await installed.locator('#preview-status').textContent(),/Installed-extension mode/);
    assert.equal(await installed.evaluate(()=>!!window.PhisDemoBackend||!!window.PhisPrescription||!!window.PhisMatcher),false);
    assert.equal(await installed.locator('#hsm-formulary-root').count(),0);await installed.close();
    console.log('PASS: self-contained HTML; 12 presets; two major pairs and contraindicated/moderate fixtures; sticky scroll; candidate selection; hide/remove/edit/reset; separate tables; no-rules state; 8 quick checks; settings CSV/import rejection/reset; demo-origin gate; localhost preview; installed mode excludes simulated APIs. No clinical data asserted.');
  } finally {await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});

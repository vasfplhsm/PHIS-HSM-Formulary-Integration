const $ = id => document.getElementById(id);
const originPattern = site => { const url = new URL(site); return url.protocol + '//' + url.hostname + '/*'; };
const siteIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8m-4-4v4"/></svg>';
const removeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg>';

function report(message, error = false) {
  $('status').textContent = message instanceof Error ? message.message : String(message);
  $('status').classList.toggle('error', error);
  $('status').hidden = false;
}
function formatDate(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value || '');
  if (!match) return value || 'Unknown';
  const date = new Date(Date.UTC(+match[3], +match[2] - 1, +match[1]));
  if (date.getUTCDate() !== +match[1] || date.getUTCMonth() !== +match[2] - 1) return value;
  return new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(date);
}

async function render() {
  const {sites = [], formulary, ruleset, broadGroups} = await chrome.storage.local.get(['sites', 'formulary', 'ruleset', 'broadGroups']);
  $('sites').replaceChildren();
  $('empty-sites').hidden = sites.length > 0;
  $('site-count').textContent = `${sites.length} ${sites.length === 1 ? 'site' : 'sites'}`;
  for (const site of sites) {
    const url = new URL(site), row = document.createElement('li');
    row.className = 'site-row';
    const symbol = document.createElement('span'); symbol.className = 'site-symbol'; symbol.innerHTML = siteIcon;
    const text = document.createElement('span'); text.className = 'site-text';
    const name = document.createElement('strong'); name.textContent = url.host;
    const detail = document.createElement('small'); detail.textContent = `${url.protocol === 'https:' ? 'HTTPS' : 'HTTP'} · Site enabled`;
    text.append(name, detail);
    const remove = document.createElement('button');
    remove.className = 'remove-site'; remove.type = 'button'; remove.title = `Remove ${url.host}`;
    remove.setAttribute('aria-label', `Remove ${url.host}`); remove.innerHTML = removeIcon;
    remove.onclick = async () => {
      remove.disabled = true;
      try {
        const current = await chrome.storage.local.get('sites');
        const remaining = (current.sites || []).filter(s => s !== site);
        await chrome.storage.local.set({sites: remaining});
        // Browser permissions apply to the host, so keep shared-host origins working.
        if (!remaining.some(s => originPattern(s) === originPattern(site))) {
          await chrome.permissions.remove({origins: [originPattern(site)]});
        }
        report('Site removed. Refresh its PHIS tab to finish disconnecting.');
        await render();
      } catch (error) { report(error, true); remove.disabled = false; }
    };
    row.append(symbol, text, remove); $('sites').append(row);
  }
  const data = formulary || await (await fetch('data/formulary.json')).json();
  $('record-count').textContent = new Intl.NumberFormat('en-GB').format(data.records.length);
  $('updated-date').textContent = formatDate(data.updated);
  $('source-label').textContent = formulary ? 'Your imported reference' : 'Bundled HSM reference';
  $('reset').disabled = !formulary;
  $('broad-groups').checked = broadGroups !== false;
  $('group-coverage').textContent = `${data.records.filter(record => record.subPharmacology?.trim()).length}/${data.records.length} formulary entries include a sub-pharmacology group. Broad pharmacology alone is not used.`;
  $('rules-clear').disabled = !ruleset;
  $('rules-summary').parentElement.classList.remove('error');
  if (ruleset) {
    try {
      const checked = PhisChecks.validateRuleset(ruleset, data.records);
      $('rules-summary').textContent = `${checked.rules.length} local interaction rules · ${checked.products.length} mapped products`;
      $('rules-meta').textContent = `${checked.name} · ${checked.version}. Review declared by ${checked.review.by}, ${checked.review.organisation}, ${checked.review.date}. Coverage is limited to mapped products and listed rules; no alert does not establish safety.`;
    } catch (error) {
      $('rules-summary').textContent = 'Rules inactive for this formulary';
      $('rules-meta').textContent = error.message;
      $('rules-summary').parentElement.classList.add('error');
    }
  } else {
    $('rules-summary').textContent = 'No interaction rules loaded';
    $('rules-meta').textContent = 'Drug interactions are not checked until reviewed rules are imported.';
  }
}

$('site-form').onsubmit = async event => {
  event.preventDefault();
  try {
    const input = $('site').value.trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : 'http://' + input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hostname.includes('*')) {
      throw new Error('Enter a hospital address using HTTP or HTTPS, without credentials or wildcards.');
    }
    const site = url.origin;
    const granted = await chrome.permissions.request({origins: [originPattern(site)]});
    if (!granted) throw new Error('Site access was not granted. Try again and allow access to enable this site.');
    const {sites = []} = await chrome.storage.local.get('sites');
    await chrome.storage.local.set({sites: [...new Set([...sites, site])]});
    $('site').value = '';
    report('Site connected. Refresh PHIS, then hover a medication.');
    await render();
  } catch (error) { report(error, true); }
};
$('csv').onchange = async () => {
  try {
    const file = $('csv').files[0];
    if (!file) return;
    const data = PhisCsv.importCsv(await file.text());
    await chrome.storage.local.set({formulary: data});
    report(`Imported ${new Intl.NumberFormat('en-GB').format(data.records.length)} medications. Refresh PHIS to use the update.`);
    await render();
  } catch (error) { report(error, true); }
  finally { $('csv').value = ''; }
};
$('reset').onclick = async () => {
  try {
    await chrome.storage.local.remove('formulary');
    report('Bundled formulary restored. Refresh PHIS to use it.');
    await render();
  } catch (error) { report(error, true); }
};
$('version').textContent = 'v' + chrome.runtime.getManifest().version;
render().catch(error => report(error, true));

$('broad-groups').onchange = async () => {
  try { await chrome.storage.local.set({broadGroups: $('broad-groups').checked}); report('Group review setting saved. Refresh PHIS to apply it.'); }
  catch (error) { report(error, true); }
};
$('rules-file').onchange = async () => {
  try {
    const file = $('rules-file').files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) throw new Error('Rules file exceeds the 5 MB limit.');
    const {formulary} = await chrome.storage.local.get('formulary');
    const data = formulary || await (await fetch('data/formulary.json')).json();
    const ruleset = PhisChecks.validateRuleset(JSON.parse(await file.text()), data.records);
    await chrome.storage.local.set({ruleset});
    report('Reviewed rules imported. Refresh PHIS to activate them.');
    await render();
  } catch (error) { report(error, true); }
  finally { $('rules-file').value = ''; }
};
$('rules-clear').onclick = async () => {
  try { await chrome.storage.local.remove('ruleset'); report('Rules removed. Refresh PHIS to stop using them.'); await render(); }
  catch (error) { report(error, true); }
};
$('rules-template').onclick = () => {
  const template = {schemaVersion: 1, name: 'Hospital prescription review rules', version: '1', review: {status: 'draft', by: '', organisation: '', date: ''}, source: {title: '', url: ''}, products: [], rules: []};
  const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], {type: 'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'HSM-rules-draft.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

(function () {
  const $ = id => document.getElementById(id);
  const fixtures = PhisDemoFixtures;
  const params = new URLSearchParams(location.search);
  let current = fixtures.scenarios[params.get('case')] ? params.get('case') : 'original';
  const builtIn = !!window.PhisDemoBackend;
  $('build-version').textContent = 'v' + PhisDemoBuild.version;
  for (const [id, scenario] of Object.entries(fixtures.scenarios)) {const option = document.createElement('option'); option.value = id; option.textContent = scenario.label; $('scenario').append(option);}
  $('scenario').value = current;
  $('preview-mode').value = params.get('preview') === 'off' ? 'extension' : 'builtin';
  function selected() {return Array.from(document.querySelectorAll('tbody tr')).filter(row => row.querySelector('[data-select]')?.checked);}
  function count() {const rows = Array.from(document.querySelectorAll('tbody tr')); $('medication-count').textContent = `${rows.filter(row => !row.hidden).length} visible / ${rows.length} dummy medications`;}
  function appendMedication(label, target = 'rows') {
    const row = document.createElement('tr');
    const cell = document.createElement('td'), select = document.createElement('input'); select.type = 'checkbox'; select.dataset.select = 'true'; select.setAttribute('aria-label', 'Select ' + label); cell.append(select); row.append(cell);
    select.onchange = () => row.classList.toggle('row-selected', select.checked);
    const drug = document.createElement('td'); drug.dataset.medication = 'true';
    const name = document.createElement('span'); name.className = 'name z-label'; name.textContent = label;
    const icons = document.createElement('div'); icons.className = 'icons';
    for (let i = 0; i < 3; i++) {const button = document.createElement('button'); button.type = 'button'; button.textContent = 'ⓘ'; button.setAttribute('aria-label', 'Dummy PHIS medication information'); button.onclick = event => {event.stopPropagation(); $('lab-message').textContent = 'Dummy PHIS icon clicked. Hover the medication or extension alert badge to inspect the reference.';}; icons.append(button);}
    const warning = document.createElement('span'); warning.className = 'warning-icon'; warning.setAttribute('aria-hidden', 'true'); warning.textContent = '⚠';
    const info = document.createElement('span'); info.className = 'info-icon'; info.setAttribute('aria-hidden', 'true'); info.textContent = 'i'; icons.append(warning, info); drug.append(name, icons); row.append(drug);
    const values = ['TEST ORDER — no dosing instruction', '30 units (dummy)', '0 (dummy)', '0', '0 · POMs', '30 units (dummy)', '30 (dummy)', 'Demo remarks', 'Detail (dummy)', '—', 'Dr Demo', 'Prepared (DEMO)', ''];
    values.forEach((value, index) => {const item = document.createElement('td'); item.textContent = value; if ([2,3,4,7,8].includes(index)) item.className = 'blue-text'; if (index === 0) {const note = document.createElement('div'); note.className = 'order-note'; note.textContent = '01/01/2030 · Fictional test order'; item.append(note);} if (index === values.length - 1) {const check = document.createElement('input'); check.type = 'checkbox'; check.setAttribute('aria-label', 'Mark dummy order complete'); item.append(check);} row.append(item);});
    $(target).append(row); count(); return row;
  }
  globalThis.appendMedication = appendMedication;
  function render(id) {
    const scenario = fixtures.scenarios[id]; current = id;
    $('rows').replaceChildren(); $('secondary-rows').replaceChildren(); $('secondary').hidden = !scenario.secondary;
    scenario.names.forEach(name => appendMedication(name)); scenario.secondary?.forEach(name => appendMedication(name, 'secondary-rows'));
    $('expected').textContent = scenario.expect + (builtIn ? ' Simulated rules are confined to this preview.' : ' Installed-extension mode uses your own rules and reference data.');
    $('select-all').checked = false; count();
  }
  render(current);
  function navigate(values) {const url = new URL(location.href); for (const [key, value] of Object.entries(values)) value === null ? url.searchParams.delete(key) : url.searchParams.set(key, value); location.href = url.href;}
  $('scenario').onchange = () => {
    const next = $('scenario').value;
    if (!!fixtures.scenarios[next].rulesOff !== !!fixtures.scenarios[current].rulesOff) {navigate({case: next}); return;}
    render(next); const url = new URL(location.href); url.searchParams.set('case', next); try {history.replaceState(null, '', url.href);} catch (_) { /* file URLs still work without history updates */ }
  };
  $('preview-mode').onchange = () => navigate({preview: $('preview-mode').value === 'extension' ? 'off' : null, case: 'original'});
  $('reset').onclick = () => {render(current); $('lab-message').textContent = 'Scenario reset. The checker will refresh the dummy rows.';};
  $('select-all').onchange = () => {for (const row of document.querySelectorAll('tbody tr')) {const check = row.querySelector('[data-select]'); check.checked = $('select-all').checked; row.classList.toggle('row-selected', check.checked);}};
  $('add').onclick = () => appendMedication($('drug-input').value.trim() || 'Esomeprazole 40 mg Injection');
  $('edit').onclick = () => {const name = $('drug-input').value.trim(); if (!name || !selected().length) {$('lab-message').textContent = 'Enter a test label and select at least one row first.'; return;} for (const row of selected()) {row.querySelector('.name').textContent = name; row.querySelector('[data-select]').setAttribute('aria-label', 'Select ' + name);} $('lab-message').textContent = 'Dummy label changed. Watch the old alerts clear or update.';};
  $('hide').onclick = () => {selected().forEach(row => {row.hidden = true;}); count();};
  $('restore').onclick = () => {document.querySelectorAll('tbody tr').forEach(row => {row.hidden = false;}); count();};
  $('remove').onclick = () => {selected().forEach(row => row.remove()); count();};
  $('imperfect').onclick = () => ['Metformni 500mg tablet', 'Bisoprolol 2.5 mg Tab', 'metform'].forEach(name => appendMedication(name));
  document.querySelectorAll('[data-action]').forEach(button => {button.onclick = () => {$('lab-message').textContent = `Dummy ${button.dataset.action}: this is a local training screen. No invoice, label, release, or dispensing transaction is sent.`;};});
  const options = [...PhisDemoFormulary.records, ...fixtures.records].map(record => {const option = document.createElement('option'); option.value = record.name; return option;}); $('medication-options').append(...options);
  $('export-rules').onclick = () => {const url = URL.createObjectURL(new Blob([JSON.stringify(fixtures.ruleset, null, 2)], {type: 'application/json'})); const a = document.createElement('a'); a.href = url; a.download = 'DEMO-ONLY-interactions.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); $('lab-message').textContent = 'Demo fixture downloaded. Its status is DEMO, not approved; the normal clinical rules importer must reject it.';};
  $('quick-checks').onclick = async () => {
    $('results').replaceChildren(); $('quick-results').open = true;
    if (!builtIn || !window.PhisChecks || !window.PhisMatcher) {$('results').textContent = 'Start built-in preview first.'; return;}
    const lookup = PhisMatcher.createMatcher(PhisDemoBackend.data.records);
    const checked = PhisChecks.validateRuleset(fixtures.ruleset, PhisDemoBackend.data.records, {allowDemo: true});
    const find = name => PhisDemoBackend.data.records.find(record => record.name === name);
    const a = find('DEMO Alpha 10 mg Tablet'), b = find('DEMO Beta 5 mg Tablet');
    const checks = [
      ['Exact generic matching', () => lookup('Perindopril 4 mg Tablet').kind === 'generic'],
      ['Imperfect name produces choices', () => lookup('Metformni 500mg tablet').kind === 'possible'],
      ['Conflicting strength is excluded', () => lookup('Bisoprolol 25 mg Tab').kind === 'none'],
      ['Ambiguous brand retains both strengths', () => lookup('Dexilant').records.length === 2],
      ['Synthetic major pair is detected', () => PhisChecks.analyze([{id:0,record:a},{id:1,record:b}], checked).alerts.some(alert => alert.severity === 'major')],
      ['Removing one partner clears the pair', () => PhisChecks.analyze([{id:0,record:a}], checked).alerts.length === 0],
      ['Normal clinical importer rejects demo rules', () => {try {PhisChecks.validateRuleset(fixtures.ruleset, PhisDemoBackend.data.records); return false;} catch (_) {return true;}}],
      ['No rules means zero interaction rules', () => PhisChecks.analyze([{id:0,record:a},{id:1,record:b}], null).rulesCount === 0]
    ];
    for (const [name, run] of checks) {const li = document.createElement('li'); let passed = false; try {passed = run();} catch (_) {} li.className = passed ? 'pass' : 'fail'; li.textContent = (passed ? 'PASS · ' : 'FAIL · ') + name; $('results').append(li);}
  };
})();

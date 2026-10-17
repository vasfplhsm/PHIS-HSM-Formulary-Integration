(async () => {
  const {sites = []} = await chrome.storage.local.get('sites');
  if (!sites.includes(location.origin) || window.__hsmFormulary) return;
  window.__hsmFormulary = true;
  const data = await chrome.runtime.sendMessage({type: 'formulary'});
  if (!data) return;
  await window.PhisPrescription?.ready;
  const lookup = PhisMatcher.createMatcher(data.records);
  const cellSelector = 'td,[role="cell"],.z-listcell,[data-medication]';
  const ignoredSelector = 'button,input,select,textarea,script,style,svg,img,[role="button"],[aria-hidden="true"],[hidden],.z-icon,.z-image';
  const host = document.createElement('div');
  host.id = 'hsm-formulary-root';
  host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({mode: 'open'});
  const icons = {
    brand: '<rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" stroke="none"/><rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" stroke="none" opacity=".5"/><rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" stroke="none" opacity=".5"/><rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" stroke="none"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    indication: '<path d="M12 20s-8-4.8-8-10a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 5.2-8 10-8 10Z"/><path d="M7 12h3l1-3 2 6 1-3h3"/>',
    dosage: '<path d="m9 15 6-6M5 19a5.7 5.7 0 0 1 0-8l6-6a5.7 5.7 0 0 1 8 8l-6 6a5.7 5.7 0 0 1-8 0Z"/>',
    warning: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>',
    arrow: '<path d="m8 5 7 7-7 7"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2V5Zm0 13a2 2 0 0 1 2-2h13M8 7h7m-7 4h5"/>'
  };
  const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
  shadow.innerHTML = `<style>
    :host{position:fixed;z-index:2147483647;pointer-events:none;color-scheme:light}
    *{box-sizing:border-box}svg{width:17px;height:17px;flex-shrink:0}
    .panel{pointer-events:auto;font:13px/1.65 "Segoe UI",system-ui,-apple-system,sans-serif;color:#254840;background:#fff;border:1px solid #dbe6db;border-radius:18px;box-shadow:0 18px 60px #173b3026,0 4px 12px #173b3010;overflow:auto;overscroll-behavior:contain;width:420px;max-width:calc(100vw - 16px);scrollbar-width:thin;scrollbar-color:#c7d8ca transparent}
    .panel[hidden]{display:none}
    .sticky-header{position:sticky;top:0;z-index:1;background:#fff;box-shadow:0 3px 8px #173b3007}
    .topbar{display:flex;align-items:center;gap:9px;padding:14px 19px;background:#f8faf5;border-bottom:1px solid #e8eee3}
    .mark{display:grid;place-items:center;width:29px;height:29px;border-radius:9px;background:#186c59;color:#edffef}.mark svg{width:21px;height:21px}
    .topbar strong{display:block;font-size:11px;font-weight:650;letter-spacing:.1px;color:#37654e}.topbar small{display:block;font-size:9px;line-height:1.5;color:#708462;letter-spacing:.25px}
    .close{display:grid;place-items:center;margin-left:auto;align-self:flex-start;width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:#8ba089;cursor:pointer}.close:hover{background:#eaf0e4;color:#335f45}.close svg{width:14px;height:14px}button:focus-visible,summary:focus-visible{outline:3px solid #7db69e;outline-offset:2px}
    .title-block{padding:18px 21px 14px;border-bottom:1px solid #edf1e8}.panel-body{padding:17px 21px 10px}.medication-title{font-size:21px;line-height:1.35;letter-spacing:-.6px;font-weight:650;color:#173e33;margin:0 0 11px;overflow-wrap:anywhere}
    .badges{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:0}.badge{display:inline-flex;gap:5px;align-items:center;font-size:9px;font-weight:650;line-height:1.6;padding:4px 7px;border-radius:5px;background:#eaf5ea;color:#387045;letter-spacing:.1px}.badge svg{width:12px;height:12px}.badge.amber{background:#fff2d8;color:#9b6b19}.stock-note{font-size:9px;color:#77866c}
    .brand-line{display:flex;gap:7px;align-items:baseline;padding-bottom:16px;margin-bottom:17px;border-bottom:1px solid #edf1e8}.brand-line span{font-size:9px;color:#97a28b;text-transform:uppercase;letter-spacing:1px;font-weight:600}.brand-line strong{font-size:12px;color:#657b56;font-weight:500;overflow-wrap:anywhere}
    .reference-block{margin:0 0 18px}.field-heading{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;color:#607e52;margin:0 0 8px}.field-heading svg{width:15px;height:15px;color:#87a17b}.field-value{font-size:13px;line-height:1.8;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#3f584b}
    .reference-block.dosage{background:#f1f7ee;border:1px solid #e4eedf;border-radius:11px;padding:14px 15px;margin-left:-1px;margin-right:-1px}.dosage .field-heading{color:#4f7d45}.dosage .field-heading svg{color:#6a9861}.dosage .field-value{color:#395f35}
    .reference-block.warning{background:#fff8e9;border:1px solid #f2e3c2;border-radius:11px;padding:13px 14px}.warning .field-heading{color:#9a7636}.warning .field-heading svg{color:#b18b42}.warning .field-value{color:#806237;font-size:12px}
    .reference-block.serious{background:#fff1f2;border:1px solid #edc1c5;border-radius:11px;padding:13px 14px}.serious .field-heading,.serious .field-heading svg{color:#a42f39}.serious .field-value{color:#8c3540;font-size:12px}
    .badge.red{background:#fff0f1;color:#a42f39}
    .product-group+.product-group{border-top:1px solid #e5ecdf;padding-top:20px;margin-top:20px}
    .suggestion-list{display:grid;gap:11px;margin-bottom:15px}.suggestion-card{border:1px solid #e0e8d9;border-radius:12px;padding:14px;background:#fcfdf9}.suggestion-name{font-size:14px;font-weight:600;line-height:1.5;color:#315741;margin:0 0 5px;overflow-wrap:anywhere}.suggestion-brand,.suggestion-reason{font-size:11px;color:#728267;line-height:1.6;margin:4px 0}.suggestion-warnings{font-size:11px;line-height:1.65;color:#956b27;margin:8px 0;padding-left:17px}.choice-button{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px 12px;margin-top:12px;background:#edf5e8;color:#386245;border:1px solid #d4e4cd;border-radius:8px;font:600 11px/1.5 "Segoe UI",system-ui,sans-serif;cursor:pointer}.choice-button:hover{background:#dfeeda}.choice-button svg{width:12px;height:12px}.back-button,.none-button{border:0;background:none;color:#617d53;font:500 11px/1.6 "Segoe UI",system-ui,sans-serif;cursor:pointer;padding:5px 0;margin:0 0 14px;text-align:left}.back-button:hover,.none-button:hover{text-decoration:underline}.detected-label{font-size:10px;line-height:1.6;color:#748468;margin:8px 0 0;overflow-wrap:anywhere}.suggestion-count{font-size:10px;color:#7d8d70;margin:0 0 12px}
    .details{border-top:1px solid #e8eee2;margin:0 0 8px;padding-top:2px}.details summary{display:flex;align-items:center;gap:7px;cursor:pointer;color:#748b64;font-size:11px;font-weight:600;list-style:none;padding:12px 0}.details summary::-webkit-details-marker{display:none}.details summary svg{width:11px;height:11px;transition:transform .15s}.details[open] summary svg{transform:rotate(90deg)}.details-content{padding:3px 0 0}.details-content .reference-block{margin-bottom:12px}.details-content .field-heading{font-size:9px;letter-spacing:.6px}.details-content .field-value{font-size:12px}
    .panel-footer{display:flex;gap:8px;align-items:flex-start;background:#fafbf7;border-top:1px solid #e9eee3;padding:13px 21px 15px;color:#8c9c7c}.panel-footer>svg{width:14px;height:14px;margin-top:2px}.panel-footer strong{display:block;font-size:10px;line-height:1.6;font-weight:500;color:#647d54}.panel-footer p{font-size:9px;line-height:1.6;margin:4px 0 0;color:#718064}
    @media(prefers-reduced-motion:reduce){*{transition:none!important}}
  </style>
  <section class="panel" hidden role="dialog" aria-label="Hospital formulary reference">
    <header class="sticky-header"><div class="topbar"><span class="mark">${icon('brand')}</span><div><strong>HSM Formulary</strong><small>Medication reference</small></div><button class="close" aria-label="Close">${icon('close')}</button></div><div class="title-block"></div></header>
    <div class="panel-body"></div>
    <footer class="panel-footer">${icon('book')}<div><strong class="source-date"></strong><p class="screening-status"></p><p>Reference guidance; confirm suitability for this patient. Stock availability is not checked.</p></div></footer>
  </section>`;
  document.documentElement.append(host);
  const panel = shadow.querySelector('section'), body = shadow.querySelector('.panel-body');
  const titleBlock = shadow.querySelector('.title-block');
  shadow.querySelector('.source-date').textContent = `HSM formulary · Updated ${data.updated}`;
  let timer, activeCell;
  function close() { panel.hidden = true; activeCell = null; }
  function updateScreeningStatus(cell) {
    const screening = window.PhisPrescription?.forCell(cell);
    shadow.querySelector('.screening-status').textContent = screening ? screening.status + ' ' + screening.coverage : 'Prescription scope is not recognised. Drug interactions are not checked here.';
  }
  document.addEventListener('hsm-screening-updated', event => {
    if (!activeCell) return;
    if (Array.isArray(event.detail?.affectedCells) && event.detail.affectedCells.includes(activeCell)) close();
    else updateScreeningStatus(activeCell);
  });
  function deferClose() { clearTimeout(timer); timer = setTimeout(close, 450); }
  shadow.querySelector('button').onclick = close;
  shadow.addEventListener('toggle', () => { if (activeCell) place(activeCell); }, true);
  document.addEventListener('hsm-open-reference', event => {
    const cell = medicationCell(event.target);
    if (cell) show(cell, {force: true});
  });

  function field(title, value, {parent = body, tone = '', symbol = ''} = {}) {
    if (!value) return;
    const block = document.createElement('div'); block.className = 'reference-block ' + tone;
    const heading = document.createElement('h4'), paragraph = document.createElement('p');
    heading.className = 'field-heading';
    if (symbol) heading.innerHTML = icon(symbol);
    const label = document.createElement('span'); label.textContent = title; heading.append(label);
    paragraph.className = 'field-value'; paragraph.textContent = value;
    block.append(heading, paragraph); parent.append(block);
  }

  function extractText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (!(node instanceof Element) || node.matches(ignoredSelector)) return '';
    return Array.from(node.childNodes, extractText).join(' ');
  }

  function medicationCell(element) {
    if (!(element instanceof Element) || host.contains(element)) return null;
    const cell = element.closest(cellSelector) || element.closest('.z-label');
    if (!cell) return null;
    // When the table exposes headers, only inspect its Drug Name column.
    const table = cell.closest('table');
    if (table && cell instanceof HTMLTableCellElement) {
      const header = Array.from(table.rows).find(row => Array.from(row.cells).some(c =>
        /^(drug name|medication name|medication)$/.test(c.textContent.trim().toLowerCase())));
      if (header) {
        const index = Array.from(header.cells).findIndex(c => /^(drug name|medication name|medication)$/.test(c.textContent.trim().toLowerCase()));
        if (cell.cellIndex !== index) return null;
      }
    }
    return cell;
  }

  function resultFor(cell) {
    const text = extractText(cell).trim();
    if (!text || text.length > 350) return {records: []};
    return lookup(text);
  }

  function place(cell) {
    const box = cell.getBoundingClientRect(), gap = 8;
    const width = panel.offsetWidth;
    if (box.right + width + gap * 2 <= window.innerWidth || box.left >= width + gap * 2) {
      panel.style.maxHeight = Math.min(560, window.innerHeight - gap * 2) + 'px';
      host.style.left = (box.right + width + gap * 2 <= window.innerWidth ? box.right + gap : box.left - width - gap) + 'px';
      host.style.top = Math.max(gap, Math.min(box.top, window.innerHeight - panel.offsetHeight - gap)) + 'px';
      return;
    }
    const below = window.innerHeight - box.bottom - gap * 2;
    const above = box.top - gap * 2;
    panel.style.maxHeight = Math.max(0, Math.min(window.innerHeight - gap * 2, Math.max(below, above))) + 'px';
    host.style.left = Math.max(gap, Math.min(box.left, window.innerWidth - panel.offsetWidth - gap)) + 'px';
    host.style.top = (below >= Math.min(panel.scrollHeight, 320) || below >= above)
      ? Math.max(gap, box.bottom + gap) + 'px'
      : Math.max(gap, box.top - panel.offsetHeight - gap) + 'px';
  }

  function show(cell, {selected = null, force = false} = {}) {
    const result = resultFor(cell);
    if (!result.records.length) { close(); return; }
    if (selected && !result.records.includes(selected)) { close(); return; }
    clearTimeout(timer);
    if (activeCell === cell && !panel.hidden && !force) return;
    activeCell = cell;
    const detectedText = extractText(cell).trim().replace(/\s+/g, ' ');
    const needsChoice = ['possible', 'candidate'].includes(result.kind) || result.records.length > 1;
    const waitingForChoice = needsChoice && !selected;
    body.replaceChildren();
    titleBlock.replaceChildren();
    const title = document.createElement('h3');
    title.className = 'medication-title';
    title.textContent = selected ? selected.name : needsChoice ? detectedText : result.records[0].name;
    titleBlock.append(title);
    const badges = document.createElement('div'); badges.className = 'badges';
    const needsConfirmation = needsChoice;
    const badge = document.createElement('span'); badge.className = 'badge' + (needsConfirmation ? ' amber' : '');
    badge.innerHTML = icon(needsConfirmation ? 'warning' : 'check');
    const badgeText = document.createElement('span'); badgeText.textContent = selected ? 'Selected reference — verify product' :
      result.kind === 'possible' ? 'Possible matches — choose a product' : result.kind === 'candidate' ? 'Possible reference — confirm product' :
      result.records.length > 1 ? 'Multiple formulary matches' : 'Listed in HSM formulary';
    badge.append(badgeText); badges.append(badge);
    if (!needsChoice) {
      const note = document.createElement('span'); note.className = 'stock-note'; note.textContent = 'Stock not checked'; badges.append(note);
    }
    titleBlock.append(badges);
    const screening = window.PhisPrescription?.forCell(cell);
    updateScreeningStatus(cell);
    if (screening?.alerts.length) {
      const serious = screening.alerts.some(alert => ['major', 'contraindicated'].includes(alert.severity));
      const screeningBadge = document.createElement('span'); screeningBadge.className = 'badge ' + (serious ? 'red' : 'amber');
      screeningBadge.textContent = serious ? 'Interaction alert' : 'Prescription review flag'; badges.append(screeningBadge);
      for (const alert of screening.alerts) {
        const serious = ['major', 'contraindicated'].includes(alert.severity);
        const review = alert.review ? `\nRuleset: ${alert.ruleset}\nReview declared by ${alert.review.by}, ${alert.review.organisation}, ${alert.review.date}.` : '';
        field(alert.title, `${alert.medicines.join(' + ')}\n${alert.summary}\n${alert.action}\nSource: ${alert.source.title}${alert.source.url ? '\n' + alert.source.url : ''}${review}`, {tone: serious ? 'serious' : 'warning', symbol: 'warning'});
      }
    }
    function validCell() {
      return activeCell === cell && cell.isConnected && extractText(cell).trim().replace(/\s+/g, ' ') === detectedText;
    }
    if (selected) {
      const detected = document.createElement('p'); detected.className = 'detected-label'; detected.textContent = 'PHIS label: ' + detectedText; titleBlock.append(detected);
      const back = document.createElement('button'); back.type = 'button'; back.className = 'back-button'; back.textContent = '← Back to possible matches';
      back.onclick = () => {
        if (!validCell()) { close(); return; }
        show(cell, {force: true});
        body.querySelector('.choice-button')?.focus({preventScroll: true});
      }; body.append(back);
      const suggestion = result.suggestions?.find(item => item.record === selected);
      const reason = result.reason || 'You selected one of multiple records. Verify the product against the PHIS prescription.';
      field('Confirm against the prescription', [reason, ...(suggestion?.warnings || [])].join('\n'), {tone: 'warning', symbol: 'warning'});
    } else if (needsChoice) {
      field('Possible matches', result.reason || 'This label matches multiple records. Choose the correct generic name, strength, route, and formulation.', {tone: 'warning', symbol: 'warning'});
      if (result.total > result.records.length) {
        const count = document.createElement('p'); count.className = 'suggestion-count'; count.textContent = `Showing ${result.records.length} of ${result.total} suggestions. Check the full formulary if your product is missing.`; body.append(count);
      }
      const list = document.createElement('div'); list.className = 'suggestion-list';
      for (const record of result.records) {
        const item = document.createElement('article'); item.className = 'suggestion-card';
        const name = document.createElement('h4'); name.className = 'suggestion-name'; name.textContent = record.name; item.append(name);
        if (record.brand) { const brand = document.createElement('p'); brand.className = 'suggestion-brand'; brand.textContent = record.brand; item.append(brand); }
        const suggestion = result.suggestions?.find(entry => entry.record === record);
        if (suggestion) {
          const reason = document.createElement('p'); reason.className = 'suggestion-reason'; reason.textContent = suggestion.reason; item.append(reason);
          if (suggestion.warnings.length) {
            const warnings = document.createElement('ul'); warnings.className = 'suggestion-warnings';
            for (const value of suggestion.warnings) { const warning = document.createElement('li'); warning.textContent = value; warnings.append(warning); }
            item.append(warnings);
          }
        }
        const choose = document.createElement('button'); choose.type = 'button'; choose.className = 'choice-button';
        choose.setAttribute('aria-label', 'View reference for ' + record.name); choose.textContent = 'View reference'; choose.insertAdjacentHTML('beforeend', icon('arrow'));
        choose.onclick = () => {
          if (!validCell()) { close(); return; }
          show(cell, {selected: record, force: true});
          body.querySelector('.back-button')?.focus({preventScroll: true});
        };
        item.append(choose); list.append(item);
      }
      body.append(list);
      const none = document.createElement('button'); none.type = 'button'; none.className = 'none-button'; none.textContent = 'None of these — close'; none.onclick = close; body.append(none);
    }
    for (const record of waitingForChoice ? [] : selected ? [selected] : result.records) {
      const group = document.createElement('article'); group.className = 'product-group'; body.append(group);
      if (needsChoice) field('Formulary product', record.name, {parent: group});
      if (record.brand) {
        const brand = document.createElement('div'); brand.className = 'brand-line';
        const label = document.createElement('span'); label.textContent = 'Brand';
        const name = document.createElement('strong'); name.textContent = record.brand; brand.append(label, name); group.append(brand);
      }
      field('Indication', record.indication || 'Not provided in formulary', {parent: group, symbol: 'indication'});
      field('Dosage reference', record.dosage || 'Not provided in formulary', {parent: group, tone: 'dosage', symbol: 'dosage'});
      field('Prescribing restriction', record.restriction, {parent: group, tone: 'warning', symbol: 'warning'});
      const metadata = [
        ['Prescriber category', record.prescriber],
        ['Department / remarks', record.remarks],
        ['Quota / UKK', [record.quota, record.ukk].filter(Boolean).join(' · ')]
      ].filter(([, value]) => value);
      if (metadata.length) {
        const details = document.createElement('details'); details.className = 'details';
        const summary = document.createElement('summary'); summary.innerHTML = icon('arrow');
        summary.append(document.createTextNode('Prescribing details'));
        const content = document.createElement('div'); content.className = 'details-content';
        for (const [label, value] of metadata) field(label, value, {parent: content});
        details.append(summary, content); group.append(details);
      }
    }
    panel.hidden = false;
    panel.scrollTop = 0;
    place(cell);
  }

  document.addEventListener('mouseover', event => {
    const cell = medicationCell(event.target);
    if (cell) show(cell);
  });
  document.addEventListener('focusin', event => {
    const cell = medicationCell(event.target);
    if (cell) show(cell);
  });
  document.addEventListener('mouseout', event => {
    const cell = medicationCell(event.target);
    if (cell && !cell.contains(event.relatedTarget)) deferClose();
  });
  document.addEventListener('focusout', event => {
    const cell = medicationCell(event.target);
    if (cell && !cell.contains(event.relatedTarget)) deferClose();
  });
  host.addEventListener('mouseenter', () => clearTimeout(timer));
  host.addEventListener('mouseleave', deferClose);
  host.addEventListener('focusin', () => clearTimeout(timer));
  host.addEventListener('focusout', event => { if (!host.contains(event.relatedTarget)) deferClose(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  window.addEventListener('resize', close);
  document.addEventListener('scroll', event => {
    if (event.composedPath().includes(host) || !activeCell) return;
    const box = activeCell.getBoundingClientRect();
    if (activeCell.isConnected && box.bottom > 0 && box.top < window.innerHeight) place(activeCell);
    else close();
  }, true);

  // Enable keyboard focus for recognised cells, including newly rendered ZK rows.
  const addedTabStops = new WeakSet();
  function scan(root) {
    const cells = new Set();
    if (root instanceof Element) {
      const closest = medicationCell(root);
      if (closest) cells.add(closest);
    }
    if (root.querySelectorAll) for (const element of root.querySelectorAll(cellSelector + ',.z-label')) {
      const cell = medicationCell(element);
      if (cell) cells.add(cell);
    }
    for (const cell of cells) {
      const matched = resultFor(cell).records.length > 0;
      if (matched && !cell.hasAttribute('tabindex')) {
        cell.tabIndex = 0;
        addedTabStops.add(cell);
      } else if (!matched && addedTabStops.has(cell)) {
        cell.removeAttribute('tabindex');
        addedTabStops.delete(cell);
      }
    }
  }
  scan(document);
  const pending = new Set();
  let scheduled = false;
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (activeCell && (mutation.target === activeCell || activeCell.contains(mutation.target) || !activeCell.isConnected)) close();
      pending.add(mutation.target.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target);
    }
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        for (const node of pending) if (node && node.isConnected) scan(node);
        pending.clear();
      });
    }
  });
  observer.observe(document.body || document.documentElement, {subtree: true, childList: true, characterData: true});
})();

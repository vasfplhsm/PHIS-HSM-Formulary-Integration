(async () => {
  const {sites = []} = await chrome.storage.local.get('sites');
  if (!sites.includes(location.origin) || window.__hsmFormulary) return;
  window.__hsmFormulary = true;
  const data = await chrome.runtime.sendMessage({type: 'formulary'});
  if (!data) return;
  const lookup = PhisMatcher.createMatcher(data.records);
  const cellSelector = 'td,[role="cell"],.z-listcell,[data-medication]';
  const ignoredSelector = 'button,input,select,textarea,script,style,svg,img,[role="button"],[aria-hidden="true"],[hidden],.z-icon,.z-image';
  const host = document.createElement('div');
  host.id = 'hsm-formulary-root';
  host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>
    :host{position:fixed;z-index:2147483647;pointer-events:none}
    section{box-sizing:border-box;pointer-events:auto;font:14px/1.5 system-ui;color:#172c3e;background:white;border:1px solid #bbc9d4;border-radius:10px;box-shadow:0 8px 32px #0003;padding:16px;overflow:auto;width:380px;max-width:calc(100vw - 16px)}
    h3{font-size:17px;margin:0 28px 8px 0}h4{margin:12px 0 3px;color:#096d70}p{margin:0;white-space:pre-wrap}
    button{float:right;cursor:pointer;font-size:18px;background:none;border:0;padding:0 5px;color:#526574}
    section[hidden]{display:none}.warning{background:#fff1ce;border-left:3px solid #ad7200;padding:8px;margin:8px 0}
  </style><section hidden role="dialog" aria-label="Hospital formulary reference"><button aria-label="Close">×</button><div></div></section>`;
  document.documentElement.append(host);
  const panel = shadow.querySelector('section'), body = shadow.querySelector('div');
  let timer, activeCell;
  function close() { panel.hidden = true; activeCell = null; }
  function deferClose() { clearTimeout(timer); timer = setTimeout(close, 450); }
  shadow.querySelector('button').onclick = close;

  function field(title, value, warning = false) {
    if (!value) return;
    const heading = document.createElement('h4'), paragraph = document.createElement('p');
    heading.textContent = title;
    paragraph.textContent = value;
    if (warning) paragraph.className = 'warning';
    body.append(heading, paragraph);
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

  function show(cell) {
    const result = resultFor(cell);
    if (!result.records.length) { close(); return; }
    clearTimeout(timer);
    if (activeCell === cell && !panel.hidden) return;
    activeCell = cell;
    body.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = result.kind === 'candidate' ? 'Possible reference — confirm product' :
      result.records.length > 1 ? 'Multiple formulary matches' : result.records[0].name;
    body.append(title);
    if (result.kind === 'candidate') field('Confirmation required', result.reason, true);
    else field('Status', 'Listed in HSM formulary • Stock availability not checked');
    if (result.records.length > 1) field('Choose the correct product', 'This label matches multiple records. Confirm the strength and formulation.', true);
    for (const record of result.records) {
      if (result.kind === 'candidate' || result.records.length > 1) field('Formulary product', record.name);
      field('Brand', record.brand);
      field('Indication', record.indication || 'Not provided in formulary');
      field('Dosage reference', record.dosage || 'Not provided in formulary');
      field('Prescribing restriction', record.restriction);
      field('Prescriber category', record.prescriber);
      field('Department / remarks', record.remarks);
      field('Quota / UKK', [record.quota, record.ukk].filter(Boolean).join(' • '));
    }
    field('Source', `HSM formulary • Updated ${data.updated}\nReference guidance; confirm suitability for this patient. Interactions are not checked.`);
    panel.hidden = false;
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

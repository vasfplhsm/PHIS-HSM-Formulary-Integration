(async () => {
  const api = {forCell: () => null};
  let ready;
  api.ready = new Promise(resolve => { ready = resolve; });
  window.PhisPrescription = api;
  try {
    const {sites = []} = await chrome.storage.local.get('sites');
    if (!sites.includes(location.origin)) return;
    const [data, config] = await Promise.all([chrome.runtime.sendMessage({type: 'formulary'}), chrome.runtime.sendMessage({type: 'checksConfig'})]);
    const lookup = PhisMatcher.createMatcher(data.records), summaries = new WeakMap();
    let ruleset = null, rulesError = '';
    const demoAllowed = config?.demoMode === true && document.documentElement.dataset.phisDemo === 'true' &&
      (location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
    if (config?.ruleset) {
      try { ruleset = PhisChecks.validateRuleset(config.ruleset, data.records, {allowDemo: demoAllowed}); }
      catch (error) { rulesError = error.message; }
    }
    const ignored = 'button,input,select,textarea,script,style,svg,img,[role="button"],[aria-hidden="true"],[hidden],.z-icon,.z-image,[data-hsm-owned]';
    function label(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (!(node instanceof Element) || node.matches(ignored)) return '';
      return Array.from(node.childNodes, label).join(' ');
    }
    function visible(element) {
      return !element.closest('[hidden],[aria-hidden="true"]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    }
    const headerName = cell => cell.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
    const headers = new Set(['drug name', 'medication name', 'medication']);
    const annotated = new Set(), bars = new Map();
    let previousLive = new Set();
    api.forCell = cell => summaries.get(cell) || null;
    function refresh() {
      const live = new Set();
      const affectedCells = new Set();
      let changed = false;
      for (const table of document.querySelectorAll('table')) {
        if (!visible(table)) continue;
        const header = Array.from(table.rows).find(row => Array.from(row.cells).some(cell => headers.has(headerName(cell))));
        if (!header || !Array.from(header.cells).some(cell => ['order detail', 'order details'].includes(headerName(cell)))) continue;
        // Require both prescription columns; never combine separate tables.
        const column = Array.from(header.cells).findIndex(cell => headers.has(headerName(cell)));
        const cells = Array.from(table.rows).filter(row => row !== header && row.closest('table') === table && visible(row)).map(row => row.cells[column]).filter(cell => cell && cell.tagName === 'TD' && visible(cell));
        if (!cells.length) continue;
        const rows = cells.map((cell, id) => {
          const result = lookup(label(cell).trim());
          return {id, record: ['generic', 'brand'].includes(result.kind) && result.records.length === 1 ? result.records[0] : null};
        });
        const result = PhisChecks.analyze(rows, ruleset, {broadGroups: config?.broadGroups !== false, updated: data.updated});
        const status = (ruleset?.purpose === 'synthetic-demo' ? 'DEMO ONLY — synthetic interaction fixtures. ' : '') +
          (result.rulesCount ? `${result.rulesCount} local interaction rules · ${result.unmappedRows}/${result.totalRows} rows not mapped. Rule coverage is limited; no alert does not establish safety.` : 'No interaction rules loaded: drug interactions are not checked.');
        const coverage = `${result.resolvedRows}/${result.totalRows} rows recognised; ${result.missingGroups} recognised rows have no formulary group. This rendered table only; hidden/other medicines and order status are not assessed. Confirm this is the active prescription.`;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i], alerts = result.alerts.filter(alert => alert.rows.includes(i));
          const summary = {alerts, status: rulesError ? 'Interaction rules are inactive: ' + rulesError : status, coverage, resolved: !!rows[i].record};
          if (JSON.stringify(summaries.get(cell)?.alerts || []) !== JSON.stringify(alerts)) affectedCells.add(cell);
          if (JSON.stringify(summaries.get(cell)) !== JSON.stringify(summary)) changed = true;
          summaries.set(cell, summary);
          live.add(cell);
          const severity = alerts.some(alert => ['major', 'contraindicated'].includes(alert.severity)) ? 'serious' : alerts.length ? 'review' : '';
          const badgeText = severity === 'serious' ? 'Interaction alert' : alerts.some(alert => alert.type === 'interaction') ? 'Interaction review' : 'Group / ingredient review';
          let badge = cell.querySelector(':scope > [data-hsm-owned="alert-badge"]');
          if (severity) {
            if (cell.dataset.hsmAlert !== severity) cell.dataset.hsmAlert = severity;
            if (!badge) {
              badge = document.createElement('button'); badge.type = 'button'; badge.dataset.hsmOwned = 'alert-badge';
              badge.onclick = event => { event.preventDefault(); event.stopPropagation(); cell.dispatchEvent(new CustomEvent('hsm-open-reference', {bubbles: true})); };
              cell.append(badge);
            }
            if (badge.textContent !== badgeText) badge.textContent = badgeText;
            const description = alerts.map(alert => alert.title + ': ' + alert.medicines.join(' + ')).join('\n');
            if (badge.title !== description) badge.title = description;
            annotated.add(cell);
          } else {
            cell.removeAttribute('data-hsm-alert'); badge?.remove(); annotated.delete(cell);
          }
        }
        let bar = bars.get(table);
        if (!bar || !bar.isConnected) { bar = document.createElement('p'); bar.dataset.hsmOwned = 'coverage'; bar.setAttribute('role', 'status'); table.before(bar); bars.set(table, bar); }
        const summary = `HSM prescription review · ${result.alerts.length} flags. ${rulesError ? 'Interaction rules inactive: ' + rulesError : status} ${coverage}`;
        if (bar.textContent !== summary) bar.textContent = summary;
      }
      for (const cell of annotated) if (!live.has(cell)) { cell.removeAttribute('data-hsm-alert'); cell.querySelector(':scope > [data-hsm-owned="alert-badge"]')?.remove(); annotated.delete(cell); summaries.delete(cell); }
      for (const [table, bar] of bars) if (!table.isConnected || !visible(table) || !Array.from(table.rows).some(row => Array.from(row.cells).some(cell => live.has(cell)))) { bar.remove(); bars.delete(table); }
      // Remove coverage retained for rows that became unrecognised or left this table.
      api.forCell = cell => live.has(cell) ? summaries.get(cell) : null;
      for (const cell of previousLive) if (!live.has(cell)) affectedCells.add(cell);
      previousLive = live;
      if (changed || affectedCells.size) document.dispatchEvent(new CustomEvent('hsm-screening-updated', {detail: {affectedCells: [...affectedCells]}}));
    }
    let timer;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 80); };
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => {
        const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (element?.closest('[data-hsm-owned],#hsm-formulary-root')) return false;
        if (mutation.type === 'childList' && [...mutation.addedNodes, ...mutation.removedNodes].length && [...mutation.addedNodes, ...mutation.removedNodes].every(node => node instanceof Element && node.hasAttribute('data-hsm-owned'))) return false;
        return true;
      })) schedule();
    });
    observer.observe(document.body || document.documentElement, {childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'style', 'class']});
    refresh();
  } catch (error) { api.error = error.message; }
  finally { ready(); }
})();

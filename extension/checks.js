(function (root) {
  const key = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const nameKey = value => root.PhisMatcher.normalize(value);
  const rank = {contraindicated: 0, major: 1, moderate: 2, minor: 3, review: 4};
  const validated = new WeakSet();
  function text(value, label, max = 2000) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(label + ' is missing or invalid.');
    return value.trim();
  }
  function source(value, label) {
    const title = text(value?.title, label + ' source title');
    const url = new URL(text(value?.url, label + ' source URL'));
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error(label + ' requires an HTTPS source URL without credentials.');
    return {title, url: url.href};
  }
  function list(value, label, allowEmpty = false) {
    if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.length > 50) throw new Error(label + ' must be a list.');
    const values = value.map(item => text(item, label, 150));
    if (new Set(values.map(key)).size !== values.length) throw new Error(label + ' contains duplicates.');
    return values;
  }
  function validateRuleset(raw, records) {
    if (!raw || raw.schemaVersion !== 1) throw new Error('Unsupported ruleset schema; expected schemaVersion 1.');
    if (raw.review?.status !== 'approved') throw new Error('This ruleset is a draft. A clinical reviewer must approve its content before import.');
    const review = {status: 'approved', by: text(raw.review.by, 'Reviewer', 200), organisation: text(raw.review.organisation, 'Reviewing organisation', 200), date: text(raw.review.date, 'Review date', 10)};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(review.date) || !Number.isFinite(Date.parse(review.date)) || new Date(review.date).toISOString().slice(0, 10) !== review.date) throw new Error('Review date must be a valid YYYY-MM-DD date.');
    if (!Array.isArray(raw.products) || !raw.products.length || raw.products.length > 10000) throw new Error('Products must contain 1–10,000 reviewed formulary mappings.');
    if (!Array.isArray(raw.rules) || raw.rules.length > 20000) throw new Error('Rules must be a list with at most 20,000 entries.');
    const known = new Map();
    for (const record of records) { const k = nameKey(record.name); known.set(k, (known.get(k) || 0) + 1); }
    const used = new Set(), ingredients = new Set();
    const products = raw.products.map((product, i) => {
      const name = text(product.name, 'Product name', 500), k = nameKey(name);
      if (known.get(k) !== 1) throw new Error(`Product ${i + 1} must uniquely match a full generic name in the active formulary: ${name}`);
      if (used.has(k)) throw new Error('Duplicate product mapping: ' + name);
      used.add(k);
      const ids = list(product.ingredients, 'Product ingredients').map(key);
      ids.forEach(id => ingredients.add(id));
      return {name, ingredients: ids, classes: list(product.classes, 'Product classes', true)};
    });
    const ruleIds = new Set();
    const rules = raw.rules.map(rule => {
      const id = text(rule.id, 'Rule ID', 150);
      if (ruleIds.has(id)) throw new Error('Duplicate rule ID: ' + id);
      ruleIds.add(id);
      const pair = list(rule.ingredients, 'Rule ingredients').map(key);
      if (pair.length !== 2 || pair.some(id => !ingredients.has(id))) throw new Error('Each interaction must reference two distinct mapped ingredients.');
      if (!['contraindicated', 'major', 'moderate', 'minor'].includes(rule.severity)) throw new Error('Rule severity is invalid.');
      return {id, ingredients: pair, severity: rule.severity, summary: text(rule.summary, 'Rule clinical effect'), action: text(rule.action, 'Rule recommended action'), source: source(rule.source, 'Rule')};
    });
    const result = {schemaVersion: 1, name: text(raw.name, 'Ruleset name', 200), version: text(raw.version, 'Ruleset version', 100), review, source: source(raw.source, 'Ruleset'), products, rules};
    validated.add(result);
    return result;
  }
  function analyze(rows, ruleset, {broadGroups = true, updated = 'unknown'} = {}) {
    if (ruleset && !validated.has(ruleset)) throw new Error('Validate the ruleset against the active formulary before screening.');
    const mappings = new Map((ruleset?.products || []).map(product => [nameKey(product.name), product]));
    const pairKey = pair => JSON.stringify([...pair].sort());
    const ruleIndex = new Map();
    for (const rule of ruleset?.rules || []) { const k = pairKey(rule.ingredients); if (!ruleIndex.has(k)) ruleIndex.set(k, []); ruleIndex.get(k).push(rule); }
    const resolved = rows.filter(row => row.record), alerts = [];
    const shared = (left, right) => left.filter(value => right.some(other => key(value) === key(other)));
    function add(a, b, alert) { alerts.push({...alert, rows: [a.id, b.id], medicines: [a.record.name, b.record.name]}); }
    for (let i = 0; i < resolved.length; i++) for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i], b = resolved[j], ma = mappings.get(nameKey(a.record.name)), mb = mappings.get(nameKey(b.record.name));
      const commonIngredients = ma && mb ? shared(ma.ingredients, mb.ingredients) : [];
      const commonClasses = ma && mb ? shared(ma.classes, mb.classes) : [];
      if (commonIngredients.length) add(a, b, {type: 'ingredient-review', severity: 'review', title: 'Shared mapped ingredient — review', summary: 'Both products contain: ' + commonIngredients.join(', ') + '. Check the intended regimen and total dose.', action: 'Review the prescription; this flag does not establish inappropriate duplication.', source: ruleset.source});
      else if (commonClasses.length) add(a, b, {type: 'class-review', severity: 'review', title: 'Shared reviewed class — review', summary: 'Both products are mapped to: ' + commonClasses.join(', ') + '.', action: 'Check treatment intent. Medicines in the same class are not automatically inappropriate together.', source: ruleset.source});
      else if (broadGroups && !(ma?.classes.length && mb?.classes.length) && key(a.record.pharmacology) && key(a.record.subPharmacology) && key(a.record.pharmacology) === key(b.record.pharmacology) && key(a.record.subPharmacology) === key(b.record.subPharmacology)) {
        add(a, b, {type: 'formulary-group', severity: 'review', title: 'Shared formulary group — review', summary: 'Both medicines are listed under ' + a.record.subPharmacology + '. This is a broad formulary category, not a confirmed therapeutic duplication or interaction.', action: 'Review treatment intent; the combination may be intentional.', source: {title: 'HSM formulary · Updated ' + updated, url: ''}});
      }
      if (!ma || !mb) continue;
      const matching = new Set();
      for (const left of ma.ingredients) for (const right of mb.ingredients) for (const rule of ruleIndex.get(pairKey([left, right])) || []) matching.add(rule);
      for (const rule of matching) {
        add(a, b, {type: 'interaction', severity: rule.severity, title: rule.severity === 'contraindicated' ? 'Contraindicated combination — review' : rule.severity[0].toUpperCase() + rule.severity.slice(1) + ' interaction — review', summary: rule.summary, action: rule.action, source: rule.source, ruleId: rule.id, ruleset: ruleset.name + ' · ' + ruleset.version, review: ruleset.review});
      }
    }
    alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return {alerts, totalRows: rows.length, resolvedRows: resolved.length, unmappedRows: rows.length - resolved.filter(row => mappings.has(nameKey(row.record.name))).length, missingGroups: resolved.filter(row => !key(row.record.subPharmacology)).length, rulesCount: ruleset?.rules.length || 0};
  }
  const api = {validateRuleset, analyze, rank};
  root.PhisChecks = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

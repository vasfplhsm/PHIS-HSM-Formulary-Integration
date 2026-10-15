(function (root) {
  function normalize(text) {
    return String(text).toLowerCase()
      .replace(/(\d)\s*(mcg|mg|g|ml|%)/g, '$1 $2')
      .replace(/[^a-z0-9%./]+/g, ' ')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\bmodified release\b/g, 'mr')
      .replace(/\bsustained release\b/g, 'sr')
      .replace(/\bextended release\b/g, 'er')
      .replace(/\bdelayed release\b/g, 'dr')
      .replace(/\bcontrolled release\b/g, 'cr')
      .replace(/\bprolonged release\b/g, 'pr')
      .replace(/\bimmediate release\b/g, 'ir')
      .replace(/\benteric coated\b/g, 'ec')
      .replace(/\b(tab|tabs|cap|caps|inj|hcl)\./g, '$1')
      .trim().replace(/\s+/g, ' ');
  }

  const aliases = [{
    label: 'Glyceryl Trinitrate 0.5 mg Tablet',
    reference: 'Glyceryl Trinitrate 0.5mg Sublingual Tablet',
    reason: 'The PHIS label omits “Sublingual”. Confirm the route and product before using this reference.'
  }];
  const forms = new Map([
    ['tablet', 'tablet'], ['tablets', 'tablet'], ['tab', 'tablet'], ['tabs', 'tablet'],
    ['capsule', 'capsule'], ['capsules', 'capsule'], ['cap', 'capsule'], ['caps', 'capsule'],
    ['injection', 'injection'], ['inj', 'injection'], ['syrup', 'syrup'], ['syr', 'syrup'],
    ['cream', 'cream'], ['ointment', 'ointment'], ['oint', 'ointment'], ['solution', 'solution'], ['soln', 'solution'],
    ['suspension', 'suspension'], ['susp', 'suspension'], ['drops', 'drops'], ['drop', 'drops'],
    ['inhaler', 'inhaler'], ['spray', 'spray'], ['powder', 'powder'], ['patch', 'patch'],
    ['suppository', 'suppository'], ['pessary', 'pessary'], ['gel', 'gel'], ['lotion', 'lotion'],
    ['emulsion', 'emulsion'], ['lozenge', 'lozenge'], ['granules', 'granules']
  ]);
  const routes = new Map([
    ['sublingual', 'sublingual'], ['sl', 'sublingual'], ['oral', 'oral'],
    ['intravenous', 'intravenous'], ['iv', 'intravenous'], ['intramuscular', 'intramuscular'], ['im', 'intramuscular'],
    ['subcutaneous', 'subcutaneous'], ['sc', 'subcutaneous'], ['ophthalmic', 'eye'], ['eye', 'eye'],
    ['otic', 'ear'], ['ear', 'ear'], ['rectal', 'rectal'], ['vaginal', 'vaginal'],
    ['topical', 'topical'], ['inhalation', 'inhalation']
  ]);
  const releases = new Set(['mr', 'sr', 'er', 'xr', 'xl', 'cr', 'dr', 'pr', 'ir', 'ec']);
  const salts = new Set(['hcl', 'hydrochloride', 'fumarate', 'trihydrate', 'dihydrate', 'monohydrate', 'hydrate',
    'maleate', 'besylate', 'besilate', 'sodium', 'potassium', 'calcium', 'magnesium', 'succinate', 'tartrate',
    'mesylate', 'mesilate', 'phosphate', 'acetate', 'citrate', 'sulphate', 'sulfate', 'bromide', 'chloride', 'arginine']);
  // Mineral/electrolyte words may identify entire active ingredients, so they
  // must remain part of the name even though they can also occur as salt words.
  const optionalSalts = new Set([...salts].filter(word => ![
    'sodium', 'potassium', 'calcium', 'magnesium', 'phosphate', 'acetate', 'citrate', 'sulphate', 'sulfate', 'bromide', 'chloride'
  ].includes(word)));
  const descriptors = new Set(['and', 'with', 'for', 'of', 'as', 'film', 'coated', 'solvent', 'anhydrous']);
  const number = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const unit = '(?:mcg|mg|g|ml|l|mmol|iu|units?|%)(?![a-z])';
  const quantity = new RegExp(number + '\\s*' + unit + '(?:/(?:' + number + '\\s*)?' + unit + ')?', 'g');
  const unique = values => [...new Set(values)];

  function profile(label) {
    const text = normalize(label), strengths = [];
    const remainder = text.replace(quantity, value => { strengths.push(value.replace(/\s/g, '')); return ' '; });
    const bareNumbers = remainder.match(/\d+(?:\.\d+)?/g) || [];
    const words = remainder.replace(/\d+(?:\.\d+)?/g, ' ').split(/\s+/).filter(Boolean);
    const names = words.filter(word => !forms.has(word) && !routes.has(word) && !releases.has(word) && !descriptors.has(word) && /^[a-z]+$/.test(word));
    const core = names.filter(word => !optionalSalts.has(word));
    return {
      strengths: unique(strengths), bareNumbers: unique(bareNumbers), core: core.length ? core : names,
      salts: names.filter(word => salts.has(word)),
      forms: unique(words.filter(word => forms.has(word)).map(word => forms.get(word))),
      routes: unique(words.filter(word => routes.has(word)).map(word => routes.get(word))),
      releases: unique(words.filter(word => releases.has(word)))
    };
  }

  // Damerau-Levenshtein allows a single adjacent transposition in a medication word.
  // Numeric strength, route, formulation, and release markers never use this comparison.
  function distance(a, b) {
    const matrix = Array.from({length: a.length + 1}, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
    return matrix[a.length][b.length];
  }

  function wordScore(query, reference) {
    if (query === reference) return 1;
    if (query.length < 5 || reference.length < 5 || query[0] !== reference[0]) return 0;
    if (reference.startsWith(query) && query.length / reference.length >= 0.5) return 0.8;
    const limit = Math.min(2, Math.floor(Math.max(query.length, reference.length) * 0.2));
    if (Math.abs(query.length - reference.length) > limit) return 0;
    const edits = distance(query, reference);
    return edits <= limit ? 1 - edits / Math.max(query.length, reference.length) : 0;
  }
  function nameScore(query, reference) {
    // Every remaining name word must be accounted for on both sides. Missing salt
    // words can be suggested, but missing/extra active ingredient words cannot.
    if (!query.length || query.length !== reference.length) return 0;
    const used = new Set();
    let sum = 0;
    for (const word of query) {
      let best = 0, index = -1;
      reference.forEach((value, i) => {
        const score = used.has(i) ? 0 : wordScore(word, value);
        if (score > best) { best = score; index = i; }
      });
      if (!best) return 0;
      used.add(index); sum += best;
    }
    return sum / query.length;
  }

  function compatibility(query, reference, identity) {
    if (query.strengths.some(value => !reference.strengths.includes(value))) return null;
    if (query.forms.some(value => !reference.forms.includes(value))) return null;
    if (query.releases.length && (query.releases.length !== reference.releases.length || query.releases.some(value => !reference.releases.includes(value)))) return null;
    if (query.routes.length && reference.routes.length && query.routes.some(value => !reference.routes.includes(value))) return null;
    if (query.salts.some(value => !reference.salts.includes(value))) return null;
    const allowedNumbers = unique([...identity.bareNumbers, ...reference.bareNumbers]);
    if (query.bareNumbers.some(value => !allowedNumbers.includes(value))) return null;
    const warnings = [];
    if (!query.strengths.length && reference.strengths.length) warnings.push('Strength is not specified with units in the PHIS label.');
    if (query.strengths.length && query.strengths.length !== reference.strengths.length) warnings.push('The formulary label lists additional strengths. Confirm the full product.');
    if (!query.forms.length && reference.forms.length) warnings.push('Dosage form is not specified in the PHIS label.');
    if (!query.releases.length && reference.releases.length) warnings.push('Release type is omitted from the PHIS label.');
    if (!query.routes.length && reference.routes.length) warnings.push('Route is omitted from the PHIS label.');
    if (query.routes.length && !reference.routes.length) warnings.push('The formulary product name does not specify a route. Confirm it.');
    return warnings;
  }

  function createMatcher(records) {
    const generic = new Map(), brands = new Map(), entries = [], cache = new Map();
    function add(index, label, record) {
      const key = normalize(label);
      if (!key) return;
      if (!index.has(key)) index.set(key, []);
      if (!index.get(key).includes(record)) index.get(key).push(record);
    }
    for (const record of records) {
      add(generic, record.name, record);
      const reference = profile(record.name);
      entries.push({record, reference, identity: reference, type: 'generic'});
      for (const label of unique([record.brand || '', ...(record.brand || '').split(/[\n;|]/)])) {
        if (!label.trim()) continue;
        add(brands, label, record);
        entries.push({record, reference, identity: profile(label), type: 'brand'});
      }
    }
    function suggest(text) {
      const query = profile(text);
      if (!query.core.length || query.core.length > 8 || !query.core.some(word => word.length >= 5)) return {kind: 'none', records: []};
      const best = new Map();
      for (const entry of entries) {
        const score = nameScore(query.core, entry.identity.core);
        if (!score) continue;
        const warnings = compatibility(query, entry.reference, entry.identity);
        if (!warnings) continue;
        const reason = score === 1 ? 'The name is incomplete or uses a different label.' : 'Similar spelling or shortened name. Confirm the medication identity.';
        const suggestion = {record: entry.record, reason, warnings, score: score - warnings.length * 0.01};
        if (!best.has(entry.record) || best.get(entry.record).score < suggestion.score) best.set(entry.record, suggestion);
      }
      const ranked = [...best.values()].sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name));
      if (!ranked.length) return {kind: 'none', records: []};
      const suggestions = ranked.slice(0, 5).map(({score, ...item}) => item);
      return {kind: 'possible', records: suggestions.map(item => item.record), suggestions, total: ranked.length,
        reason: 'These are name suggestions, not confirmed matches. Check the generic name, strength, route, and formulation before selecting a reference.'};
    }
    return function lookup(text) {
      const key = normalize(text);
      if (generic.has(key)) return {kind: 'generic', records: generic.get(key)};
      if (brands.has(key)) return {kind: 'brand', records: brands.get(key)};
      if (!key || key.length > 350) return {kind: 'none', records: []};
      for (const alias of aliases) {
        if (key === normalize(alias.label) && generic.has(normalize(alias.reference))) {
          return {kind: 'candidate', records: generic.get(normalize(alias.reference)), reason: alias.reason};
        }
      }
      if (!cache.has(key)) {
        if (cache.size >= 256) cache.delete(cache.keys().next().value);
        cache.set(key, suggest(key));
      }
      return cache.get(key);
    };
  }

  // Unconfirmed suggestions are deliberately absent from the confirmed-match API.
  function match(text, records) {
    const result = createMatcher(records)(text);
    return ['generic', 'brand'].includes(result.kind) ? result.records : [];
  }
  const api = {normalize, createMatcher, match};
  root.PhisMatcher = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

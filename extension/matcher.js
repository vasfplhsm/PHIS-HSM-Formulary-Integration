(function (root) {
  function normalize(text) {
    return String(text).toLowerCase()
      .replace(/(\d)\s*(mg|mcg|g|ml|%)/g, '$1 $2')
      .replace(/[^a-z0-9%./]+/g, ' ')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\bmodified release\b/g, 'mr')
      .replace(/\bsustained release\b/g, 'sr')
      .replace(/\bextended release\b/g, 'er')
      .trim().replace(/\s+/g, ' ');
  }

  // These are reference candidates, not silent route substitutions.
  const candidates = [{
    label: 'Glyceryl Trinitrate 0.5 mg Tablet',
    reference: 'Glyceryl Trinitrate 0.5mg Sublingual Tablet',
    reason: 'The PHIS label omits “Sublingual”. Confirm the route and product before using this reference.'
  }];

  function createMatcher(records) {
    const generic = new Map(), brands = new Map();
    function add(index, label, record) {
      const key = normalize(label);
      if (!key) return;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(record);
    }
    for (const record of records) {
      add(generic, record.name, record);
      if (record.brand) add(brands, record.brand, record);
    }
    return function lookup(text) {
      const key = normalize(text);
      if (generic.has(key)) return {kind: 'generic', records: generic.get(key)};
      if (brands.has(key)) return {kind: 'brand', records: brands.get(key)};
      for (const candidate of candidates) {
        if (key === normalize(candidate.label) && generic.has(normalize(candidate.reference))) {
          return {kind: 'candidate', records: generic.get(normalize(candidate.reference)), reason: candidate.reason};
        }
      }
      return {kind: 'none', records: []};
    };
  }

  // Keep the simple API for callers that only need confirmed generic/brand matches.
  function match(text, records) {
    const result = createMatcher(records)(text);
    return result.kind === 'candidate' ? [] : result.records;
  }
  const api = {normalize, createMatcher, match};
  root.PhisMatcher = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);

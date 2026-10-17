/* In-memory browser API bindings used only by the standalone dummy/preview. */
(function () {
  const local = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  if (!local || document.documentElement.dataset.phisDemo !== 'true' || params.get('preview') === 'off') return;
  const scenario = PhisDemoFixtures.scenarios[params.get('case')] || PhisDemoFixtures.scenarios.original;
  const settings = document.documentElement.dataset.phisDemoView === 'settings';
  const data = {...PhisDemoFormulary, demoOnly: true, records: settings ? PhisDemoFormulary.records : [...PhisDemoFormulary.records, ...PhisDemoFixtures.records]};
  const state = {
    sites: settings ? [] : [location.origin], broadGroups: params.get('groups') !== 'off',
    ruleset: (scenario.rulesOff || params.get('rules') === 'off') ? undefined : PhisDemoFixtures.ruleset
  };
  // The settings sandbox starts with no clinical rules. Its import uses normal validation.
  if (settings) delete state.ruleset;
  const listeners = [];
  globalThis.PhisDemoBackend = {state, data};
  const clone = value => structuredClone(value);
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({version: PhisDemoBuild.version}),
      sendMessage: async message => {
        if (message.type === 'formulary') return clone(state.formulary || data);
        if (message.type === 'checksConfig') return clone({ruleset: state.ruleset, broadGroups: state.broadGroups, demoMode: true});
        return null;
      }
    },
    storage: {
      local: {
        get: async keys => {
          const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(state);
          return clone(Object.fromEntries(names.filter(key => key in state).map(key => [key, state[key]])));
        },
        set: async values => {const changes = {}; for (const [name, value] of Object.entries(values)) {changes[name] = {oldValue: state[name], newValue: value}; state[name] = clone(value);} listeners.forEach(fn => fn(changes, 'local'));},
        remove: async key => {delete state[key];}
      },
      onChanged: {addListener: fn => listeners.push(fn)}
    },
    permissions: {request: async () => true, remove: async () => true}
  };
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, options) => {
    if (typeof input === 'string' && input === 'data/formulary.json') return Promise.resolve(new Response(JSON.stringify(data), {headers: {'Content-Type': 'application/json'}}));
    return originalFetch(input, options);
  };
})();

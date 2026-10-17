/* Fictional UI fixtures. No clinical interaction database or review is represented. */
(function () {
  const fictional = [
    ['DEMO Alpha 10 mg Tablet', 'demo-alpha'],
    ['DEMO Beta 5 mg Tablet', 'demo-beta'],
    ['DEMO Gamma 20 mg Capsule', 'demo-gamma'],
    ['DEMO Delta 2 mg Tablet', 'demo-delta']
  ];
  const records = fictional.map(([name], i) => ({
    name, demoOnly: true, brand: 'DEMO ONLY — fictional medicine', prescriber: 'Training only', pharmacology: 'Synthetic demo', subPharmacology: 'Demo class ' + (i + 1),
    indication: Array.from({length: 7}, (_, n) => `Demo reference section ${n + 1}. This fictional text exists to test scrolling and the sticky medication title. It contains no clinical indication or treatment advice.`).join('\n\n'),
    dosage: 'NO CLINICAL DOSAGE. Synthetic product for interface testing only.', restriction: 'Do not use this fictional reference or simulated alert to make treatment decisions.', remarks: 'Local PHIS dummy', quota: '', ukk: '', category: 'Demo only'
  }));
  const source = {title: 'Synthetic UI test fixture — NOT clinical evidence', url: 'https://example.invalid/phis-demo'};
  const ruleset = {
    schemaVersion: 1, purpose: 'synthetic-demo', name: 'DEMO ONLY — simulated interaction fixtures', version: '1',
    review: {status: 'demo', by: 'No clinical reviewer — UI fixture', organisation: 'Local PHIS dummy', date: '2026-01-01'}, source,
    products: fictional.map(([name, ingredient], i) => ({name, ingredients: [ingredient], classes: ['Demo class ' + (i + 1)]})),
    rules: [
      {id: 'demo-major-one', ingredients: ['demo-alpha', 'demo-beta'], severity: 'major', summary: 'SIMULATED MAJOR ALERT 1. This fictional pair tests red names, paired alerts, and the explanation panel; it does not establish a real drug interaction.', action: 'DEMO ACTION: remove or hide DEMO Beta and verify that the red flags clear. Do not use this fixture as clinical advice.', source},
      {id: 'demo-major-two', ingredients: ['demo-gamma', 'demo-delta'], severity: 'major', summary: 'SIMULATED MAJOR ALERT 2. A second independent fictional pair tests detection of more than one major interaction.', action: 'DEMO ACTION: remove either fictional medicine to clear this pair.', source},
      {id: 'demo-contraindicated', ingredients: ['demo-alpha', 'demo-delta'], severity: 'contraindicated', summary: 'SIMULATED CONTRAINDICATED ALERT. This fixture tests severity ordering and sticky warnings, not a clinical contraindication.', action: 'DEMO ACTION: inspect the paired names and source, then remove one member and check the update.', source},
      {id: 'demo-moderate', ingredients: ['demo-beta', 'demo-gamma'], severity: 'moderate', summary: 'SIMULATED MODERATE ALERT. This fixture should be amber rather than red.', action: 'DEMO ACTION: compare the amber badge with the major-alert presets.', source}
    ]
  };
  const original = ['Bisoprolol Fumarate 2.5 mg Tablet', 'Perindopril 4 mg Tablet', 'Empagliflozin 25 mg Tablet', 'Isosorbide-5-Mononitrate 60 mg SR Tablet', 'Glyceryl Trinitrate 0.5 mg Tablet', 'Trimetazidine 35 mg MODIFIED RELEASE Tablet', 'Acetylsalicylic Acid 100 mg, Glycine 45 mg Tablet', 'Dexlansoprazole 30 mg Delayed Release Capsule'];
  const a = fictional.map(([name]) => name);
  const scenarios = {
    original: {label: 'Original PHIS screen', names: original, expect: 'Hover a real formulary label. Expect amber shared-group review flags; the Glyceryl label needs route confirmation.'},
    major: {label: 'Major interaction 1 · DEMO ONLY', names: [a[0], a[1], original[2]], expect: 'DEMO Alpha and DEMO Beta should be red. Click Interaction alert for the simulated major explanation.'},
    'major-two': {label: 'Major interaction 2 · DEMO ONLY', names: [a[2], a[3]], expect: 'A second fictional pair should produce two red medication names.'},
    contraindicated: {label: 'Contraindicated pair · DEMO ONLY', names: [a[0], a[3]], expect: 'Both fictional names should be red; the explanation should show a simulated contraindicated rule.'},
    multiple: {label: 'Multiple severities · DEMO ONLY', names: a, expect: 'Expect three red pair rules and one amber moderate rule. Contraindicated alerts should appear first.'},
    moderate: {label: 'Moderate interaction · DEMO ONLY', names: [a[1], a[2]], expect: 'Expect amber interaction-review badges, with no red names.'},
    group: {label: 'Shared formulary group', names: [original[0], original[1], original[2]], expect: 'Bisoprolol and Perindopril share a broad CSV group. Expect amber review, not a confirmed interaction.'},
    imperfect: {label: 'Imperfect names / missing details', names: ['Metformni 500mg tablet', 'Bisoprolol 2.5 mg Tab', 'metform', original[4]], expect: 'Expect candidate choices and missing-detail warnings. Clinical details stay hidden until you select a reference; these rows are excluded from interaction screening.'},
    brand: {label: 'Brand names / ambiguous strength', names: ['Dexilant', 'Jardiance'], expect: 'Dexilant needs a strength choice. Jardiance should resolve to the single mapped formulary product.'},
    unknown: {label: 'Unrecognised medicines', names: ['Unknown medicine 999 mg Tablet', 'Unlisted test syrup'], expect: 'Expect unrecognised coverage, no invented reference, and no all-clear.'},
    'no-rules': {label: 'No interaction rules loaded', names: [a[0], a[1]], rulesOff: true, expect: 'No red pair flags. The coverage message must explicitly say drug interactions are not checked.'},
    separate: {label: 'Separate prescriptions / no cross-check', names: [a[0]], secondary: [a[1]], expect: 'One fictional partner is in each table. There must be no cross-table interaction alert.'}
  };
  globalThis.PhisDemoFixtures = {records, ruleset, scenarios};
})();

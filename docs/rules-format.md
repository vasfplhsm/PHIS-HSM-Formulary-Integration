# Reviewed prescription rules

No clinical interaction database is bundled. Until reviewed rules are imported, the extension explicitly says **drug interactions are not checked**. CSV group flags are a separate, broad review aid.

Use the extension's **Prescription checks → Download blank template** to create a JSON draft. Your clinical team must supply product mappings and sourced rules, review the contents, and complete the review metadata. The application checks file structure and references; it cannot verify a reviewer's identity, hospital approval, source content, licensing, clinical accuracy, or currency.

## Required format

- `schemaVersion`: number `1`.
- `name`, `version`: identify the local ruleset.
- `review`: `status` must be `approved`, with nonempty `by` and `organisation`, and a valid `date` in `YYYY-MM-DD` format. Drafts cannot be activated.
- `source`: `{ "title": "reference title", "url": "https://..." }` for the reviewed ingredient/class mappings. HTTPS source URLs cannot contain credentials. The extension displays citations and does not fetch them.
- `products`: full generic product names from the active formulary, each with `ingredients` (nonempty unique IDs) and `classes` (an array, possibly empty). Each name must resolve uniquely; unknown or duplicate names reject the file. Brand and fuzzy labels are not product-map keys.
- `rules`: an array, possibly empty for a class-mapping-only dataset. Each rule needs a unique `id`, exactly two distinct mapped ingredient IDs, `severity` (`contraindicated`, `major`, `moderate`, or `minor`), `summary` (clinical effect), `action` (review recommendation), and its own `source` object.

Ingredient IDs are defined by the reviewing team and matched without regard to letter case. Use consistent IDs across products that contain the same ingredient. Map combination products to every relevant ingredient. Assign specific, reviewed class names instead of simply copying broad formulary categories. Different reviewed classes suppress a broad CSV-group flag for that pair.

The engine does not evaluate prescribed dose, route-dependent conditions, indication, age, pregnancy, renal function, lab results, timing, order status, or medicines outside the detected table. Product mappings include the full formulation label, but ingredient IDs may span formulations. The reviewing team must constrain mapping/rule scope appropriately and explain any clinical conditions in the cited rule text. No alert establishes patient-specific safety or a treatment recommendation.

## Non-clinical structure example

The following illustrates the schema using fictional medicines and test URLs. **It is not clinical interaction data and cannot be imported against the real HSM formulary.** The review remains a draft on purpose.

```json
{
  "schemaVersion": 1,
  "name": "Fictional structure example — not clinical data",
  "version": "1",
  "review": {"status": "draft", "by": "", "organisation": "", "date": ""},
  "source": {"title": "Fictional reference", "url": "https://example.test/reference"},
  "products": [
    {"name": "Example Alpha 10 mg Tablet", "ingredients": ["example-alpha"], "classes": ["Example class"]},
    {"name": "Example Beta 5 mg Tablet", "ingredients": ["example-beta"], "classes": ["Example class"]}
  ],
  "rules": [{
    "id": "example-pair",
    "ingredients": ["example-alpha", "example-beta"],
    "severity": "major",
    "summary": "Fictional test effect — not medical guidance.",
    "action": "Fictional test action — not medical guidance.",
    "source": {"title": "Fictional example", "url": "https://example.test/rule"}
  }]
}
```

## Import and coverage

Import through **Prescription checks → Import reviewed rules**, then refresh PHIS. Files larger than 5 MB are rejected. Invalid imports leave the existing rules untouched. A later formulary change can invalidate product mappings; the rules then remain stored but inactive until corrected or removed. No partial activation is attempted.

Screening requires **Drug Name** (or Medication Name/Medication) and **Order Detail** headers in the same rendered HTML table. Separate tables are never combined. Only one unambiguous exact generic/brand match is eligible per row. Possible matches, ambiguous brands, hidden rows, and unrecognised medicines are not guessed into clinical rules. A temporary selection in the reference popup does not confirm a product for screening. The table's status reports recognised and unmapped rows, missing groups, rule count, and limited scope. It never gives an all-clear.

Amber flags mean a shared CSV group, a reviewed class/ingredient review, or a moderate/minor interaction rule. Red text/badges require a loaded rule explicitly labelled major or contraindicated. Each explanation includes the affected pair, source, and action; interaction explanations also show the declared reviewer and ruleset version.

To test software behavior, run `node --test tests/checks.test.cjs` and `node tests/prescription-browser.cjs`. Their medicines and interaction rules are fictional test fixtures. Passing these checks validates software behavior, not clinical content or live PHIS integration.

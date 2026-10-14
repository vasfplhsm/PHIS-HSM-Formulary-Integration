# HSM PHIS Formulary extension

Edge/Chrome Manifest V3 prototype. Bundles 1,025 entries from the supplied HSM CSV, recorded update date 16/07/2026. All reference processing and CSV imports stay in the browser. No analytics or remote clinical requests.

## Install in Edge

1. Extract the downloadable ZIP.
2. Open `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the `extension` folder.
3. Open the extension toolbar popup. Enter your full PHIS site address, for example `http://phis.phishsm.moh.gov.my:8080` or `http://10.138.118.11:8080`, and choose **Enable site**. Approve the browser's site permission.
4. Reload PHIS and hover a medication name. Keyboard focus also opens the popup when the medication cell is focusable. Escape closes it.

Chrome uses `chrome://extensions` with the same steps. Addresses are configurable; nothing automatically grants access to the hospital examples. Browser host permissions cover the hostname; the content script additionally checks the exact registered origin, including port. Removing a hostname permission may affect other configured origins on that same hostname; re-enable those sites if needed.

## Demo and checks

Run `python -m http.server 8080 --directory demo` from this repository. Register `http://localhost:8080` in the extension and reload the demo. Hover Dexlansoprazole; use **Simulate prescription update** to test a newly added row.

Run `node --test tests/formulary.test.cjs`. Optional browser regression: with Playwright and Chromium installed, run `node tests/browser.cjs` while the demo server is running. That browser test mocks extension APIs and verifies actual rendering, hover, keyboard focus, closing, and dynamic rows; it does not verify installed extension permissions.

## CSV updates

Use the popup to import a CSV. The parser locates the `Generic Name` header after any metadata, supports quoted multiline fields, and requires `Indication` and `Dosage` columns. Invalid files are rejected before replacing the active reference. Reload PHIS after import or restore. The original CSV is not modified.

## Current boundaries

Detection uses generic table cells and ZK label/list-cell classes. Real PHIS DOM integration is pending a sanitised outerHTML sample. Exact normalised generic names and full brand labels are supported; ambiguous brands show every matching record. Strength and release type are not discarded. Unknown medications receive no popup; absence of a popup is not proof that a medication is absent from the formulary. Additional icons or text inside cells may prevent matching and need adjustment after DOM inspection.

Formulary listing does not indicate stock. Dosage is source reference text, not a patient-specific recommendation. No drug interaction checking is implemented. The dataset and clinical presentation require pharmacist review before clinical use. The extension does not alter prescriptions.

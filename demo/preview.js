(async function () {
  const status = document.getElementById('preview-status');
  if (!window.PhisDemoBackend) {
    status.textContent = 'Installed-extension mode: ' + (location.protocol === 'file:' ?
      'serve this folder through a local HTTP server first, then enable that local address in the extension and refresh.' :
      'enable this site in the extension, then refresh.') + ' Synthetic demo rules are unavailable in this mode.';
    return;
  }
  try {
    if (!window.PhisDemoBundled) {
      const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '../extension/content.css'; document.head.append(style);
      for (const file of ['matcher.js', 'checks.js', 'prescription.js', 'content.js']) {
        await new Promise((resolve, reject) => {const script = document.createElement('script'); script.src = '../extension/' + file; script.onload = resolve; script.onerror = () => reject(new Error('Could not load ' + file)); document.body.append(script);});
      }
    }
    await PhisPrescription.ready;
    if (PhisPrescription.error) throw new Error(PhisPrescription.error);
    if (!document.getElementById('hsm-formulary-root')) await new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {if (document.getElementById('hsm-formulary-root')) {observer.disconnect(); clearTimeout(timeout); resolve();}});
      observer.observe(document.documentElement, {childList: true});
      const timeout = setTimeout(() => {observer.disconnect(); reject(new Error('Popup did not initialise.'));}, 5000);
    });
    status.textContent = 'Ready · built-in extension preview · in-memory test data · no browser permissions granted';
    document.documentElement.dataset.previewReady = 'true';
  } catch (error) {
    status.textContent = 'Preview could not start: ' + error.message;
    document.documentElement.dataset.previewError = 'true';
  }
})();

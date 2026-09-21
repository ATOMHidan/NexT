/* Runs before styles/paint, including on the isolated 2FA page. */
(function () {
  'use strict';
  const key = 'soyo-theme';
  const root = document.documentElement;
  // Apply saved reading dimensions before the first article paint.
  try {
    const reading = JSON.parse(localStorage.getItem('soyo-reading-settings')) || {};
    const size = {small:'15px', normal:'16px', large:'18px'}[reading.size];
    if (size) root.style.setProperty('--reader-size', size);
    if (reading.spacing === 'relaxed') root.style.setProperty('--reader-spacing', '2.2');
  } catch {}
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';
  let preference = 'system';
  try { preference = valid(localStorage.getItem(key)); } catch {}
  function apply() {
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.style.colorScheme = root.dataset.theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.removeAttribute('media');
      meta.content = root.dataset.theme === 'dark' ? '#101c16' : '#edf4ed';
    });
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
  }
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = valid(event.newValue); apply(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.addEventListener('change', () => {
        preference = valid(select.value);
        try { localStorage.setItem(key, preference); } catch {}
        apply();
      });
    });
  });
})();

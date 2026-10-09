/* Runs before styles/paint, including on the isolated 2FA page. */
(function () {
  'use strict';
  const key = 'soyo-theme';
  const root = document.documentElement;
  const homeDefaults = {welcome:'full', density:'comfortable', profile:'show', music:'show', mainOrder:'welcome', sideOrder:'profile'};
  const homeChoices = {welcome:['full','brief'],density:['comfortable','compact'],profile:['show','hide'],music:['show','hide'],mainOrder:['welcome','posts'],sideOrder:['profile','music']};
  let home = {...homeDefaults};
  function setHome(value, save) {
    for (const name of Object.keys(homeDefaults)) {
      home[name] = homeChoices[name].includes(value?.[name]) ? value[name] : homeDefaults[name];
      root.setAttribute('data-home-' + name.toLowerCase(),home[name]);
    }
    if(save) { try { localStorage.setItem('soyo-home-layout',JSON.stringify(home)); } catch {} }
    if(home.music==='hide' && document.querySelector('.main-inner.index')) document.querySelector('.local-music-audio')?.pause();
    document.dispatchEvent(new CustomEvent('home-layout-change'));
  }
  try { setHome(JSON.parse(localStorage.getItem('soyo-home-layout')),false); } catch { setHome(null,false); }
  window.SoyoHomeLayout={get:()=>({...home}),set:value=>setHome(value,true),reset:()=>setHome(null,true)};
  window.addEventListener('storage',event=>{if(event.key==='soyo-home-layout'||event.key===null){try{setHome(JSON.parse(event.newValue),false);}catch{setHome(null,false);}}});
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';
  let preference = 'system';
  const paletteKey = 'soyo-palette';
  const validPalette = value => ['green', 'blue', 'purple', 'apricot'].includes(value) ? value : 'green';
  let palette = 'green';
  try { preference = valid(localStorage.getItem(key)); } catch {}
  try { palette = validPalette(localStorage.getItem(paletteKey)); } catch {}
  function apply() {
    root.dataset.palette = palette;
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.style.colorScheme = root.dataset.theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.removeAttribute('media');
      meta.content = palette === 'green' ? (root.dataset.theme === 'dark' ? '#101c16' : '#edf4ed') : (root.dataset.theme === 'dark' ? '#191b1e' : '#f3f4f6');
    });
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
    document.querySelectorAll('button[data-palette]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === palette)));
  }
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = valid(event.newValue); apply(); }
    if (event.key === paletteKey || event.key === null) { palette = validPalette(event.newValue); apply(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('button[data-palette]').forEach(button => button.addEventListener('click', () => {
      if (palette === validPalette(button.dataset.palette)) return;
      palette = validPalette(button.dataset.palette);
      try { localStorage.setItem(paletteKey, palette); } catch {}
      apply();
    }));
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.addEventListener('change', () => {
        preference = valid(select.value);
        try { localStorage.setItem(key, preference); } catch {}
        apply();
      });
    });
  });
})();

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
  const customKey = 'soyo-custom-palette';
  const roles = ['surface','container','low','primary','on-primary','tonal','on-tonal','secondary','secondary-container','on-secondary-container','tertiary','tertiary-container','on-tertiary-container','text','muted','outline'];
  const readCustom = value => {
    try {
      const v = typeof value === 'string' ? JSON.parse(value) : value;
      if (v?.v !== 1 || !Number.isInteger(v.hue) || v.hue < 0 || v.hue > 359 || !['soft','balanced','vivid'].includes(v.level)) return null;
      if (![v.light,v.dark].every(colors => Array.isArray(colors) && colors.length === roles.length && colors.every(c => /^#[0-9a-f]{6}$/i.test(c)))) return null;
      return {v:1,hue:v.hue,level:v.level,light:v.light.slice(),dark:v.dark.slice()};
    } catch { return null; }
  };
  let custom = null;
  const coverKey = 'soyo-cover-style';
  const validCover = value => ['geometry', 'landscape'].includes(value) ? value : 'geometry';
  let coverStyle = 'geometry';
  try { preference = valid(localStorage.getItem(key)); } catch {}
  try { palette = validPalette(localStorage.getItem(paletteKey)); } catch {}
  try { custom = readCustom(localStorage.getItem(customKey)); } catch {}
  try { coverStyle = validCover(localStorage.getItem(coverKey)); } catch {}
  function apply() {
    root.dataset.coverStyle = coverStyle;
    root.dataset.palette = custom ? 'custom' : palette;
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.style.colorScheme = root.dataset.theme;
    roles.forEach((role, i) => {
      if (custom) root.style.setProperty('--md-' + role, custom[root.dataset.theme][i]);
      else root.style.removeProperty('--md-' + role);
    });
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.removeAttribute('media');
      meta.content = custom ? custom[root.dataset.theme][0] : palette === 'green' ? (root.dataset.theme === 'dark' ? '#101c16' : '#edf4ed') : (root.dataset.theme === 'dark' ? '#191b1e' : '#f3f4f6');
    });
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
    document.dispatchEvent(new CustomEvent('soyo-appearance-change'));
  }
  window.SoyoAppearance = {
    roles,
    get: () => ({mode:preference,palette:custom ? 'custom' : palette,custom:custom ? readCustom(custom) : null,coverStyle}),
    setCoverStyle(value) { coverStyle = validCover(value); try { localStorage.setItem(coverKey, coverStyle); } catch {} apply(); },
    setMode(value) { preference = valid(value); try { localStorage.setItem(key, preference); } catch {} apply(); },
    setCustom(value) {
      const next = readCustom(value); if (!next) return false;
      custom = next; palette = 'green';
      try { localStorage.setItem(customKey,JSON.stringify(custom)); localStorage.setItem(paletteKey,'green'); } catch {}
      apply(); return true;
    },
    reset() {
      custom = null; palette = 'green';
      try { localStorage.removeItem(customKey); localStorage.setItem(paletteKey,'green'); } catch {}
      apply();
    }
  };
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (![key,paletteKey,customKey,coverKey,null].includes(event.key)) return;
    try {
      preference = valid(localStorage.getItem(key)); palette = validPalette(localStorage.getItem(paletteKey)); custom = readCustom(localStorage.getItem(customKey));
      coverStyle = validCover(localStorage.getItem(coverKey));
    } catch {}
    apply();
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

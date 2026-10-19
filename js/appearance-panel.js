(function () {
  'use strict';
  const panel = document.getElementById('appearance-panel');
  const appearance = window.SoyoAppearance;
  const trigger = document.querySelector('[data-appearance-open]');
  if (!panel || !appearance || !trigger) return;
  const hue = panel.querySelector('#appearance-hue');
  const output = panel.querySelector('#appearance-hue-value');
  const status = panel.querySelector('[data-appearance-status]');
  const levels = [...panel.querySelectorAll('[data-level]')];
  const samples = [...panel.querySelectorAll('[data-sample]')];
  const cards = [...panel.querySelectorAll('[data-appearance-preset]')];
  const selection = panel.querySelector('[data-appearance-selection]');
  const customOptions = panel.querySelector('[data-appearance-custom]');
  const engineStatus = panel.querySelector('[data-appearance-engine-status]');
  let presets = [];
  try { presets = JSON.parse(panel.querySelector('#appearance-presets')?.textContent || '[]'); } catch { /* Free adjustment remains available. */ }
  const baseHues = {green:164,blue:250,purple:305,apricot:60};
  let enginePromise, frame = 0, drag = false, swatchMode;
  function notice(text) { status.textContent = text; status.hidden = !text; position(); }
  function engineNotice(text) {
    if (engineStatus) { engineStatus.textContent = text; engineStatus.hidden = !text; }
    position();
  }
  function colors(sample, values) {
    appearance.roles.forEach((name,index)=>sample.style.setProperty('--sample-'+name,values[index]));
  }
  const selectedPreset = custom => custom && presets.find(preset =>
    preset.colors.hue === custom.hue && preset.colors.level === custom.level &&
    ['light', 'dark'].every(mode => preset.colors[mode].every((color, i) => color === custom[mode][i])));
  function cancelDrag() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    drag = false;
  }
  function sync() {
    const state = appearance.get();
    const custom = state.custom;
    const selected = selectedPreset(custom);
    const label = state.palette === 'green' ? '默认绿色' : selected?.name || '自定义配色';
    trigger.querySelector('[data-appearance-current]').textContent = state.palette === 'green' ? '默认' : selected?.name || '自定义';
    if (selection) selection.textContent = '当前：' + label;
    cards.forEach(card => {
      card.setAttribute('aria-pressed', String(card.dataset.appearancePreset === selected?.id));
      if (panel.open && swatchMode !== document.documentElement.dataset.theme) {
        const preset = presets.find(p => p.id === card.dataset.appearancePreset);
        if (preset) appearance.roles.forEach((name, i) => card.style.setProperty('--preset-' + name, preset.colors[document.documentElement.dataset.theme][i]));
      }
    });
    if (panel.open) swatchMode = document.documentElement.dataset.theme;
    panel.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    if (!drag) hue.value = custom?.hue ?? baseHues[state.palette] ?? 164;
    const level = custom?.level || 'balanced';
    levels.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.level===level)));
    output.textContent = state.palette==='green' ? '默认绿色' : hue.value + '°';
    hue.setAttribute('aria-valuetext', output.textContent);
    if (!panel.open) return;
    if (!custom && !window.SoyoPaletteEngine) {
      samples.forEach(sample => appearance.roles.forEach(name => sample.style.removeProperty('--sample-' + name)));
      return;
    }
    const preview = custom || (state.palette==='green' ? window.SoyoPaletteEngine.defaults : window.SoyoPaletteEngine.generate(+hue.value,level));
    samples.forEach(sample=>colors(sample,preview[sample.dataset.sample]));
  }
  function loadEngine() {
    if (window.SoyoPaletteEngine) return Promise.resolve();
    if (enginePromise) return enginePromise;
    enginePromise = new Promise((resolve,reject)=>{
      const script = document.createElement('script');
      script.src = trigger.dataset.engine; script.async = true;
      script.onload=()=>window.SoyoPaletteEngine ? resolve() : reject(Error('engine'));
      script.onerror=()=>{script.remove();reject(Error('network'));};
      document.head.appendChild(script);
    }).catch(error=>{enginePromise=null;throw error;});
    return enginePromise;
  }
  function position() {
    if (!panel.open) return;
    if (innerWidth<992) {panel.style.removeProperty('left');panel.style.removeProperty('top');return;}
    const rect=trigger.getBoundingClientRect(), width=panel.getBoundingClientRect().width;
    const left=rect.right+12+width<=innerWidth-16 ? rect.right+12 : Math.max(16,Math.min(rect.left,innerWidth-width-16));
    panel.style.left=left+'px';
    panel.style.top=Math.max(16,Math.min(rect.top,innerHeight-panel.getBoundingClientRect().height-16))+'px';
  }
  async function open() {
    if (panel.open) return;
    if (customOptions) customOptions.open = Boolean(appearance.get().custom && !selectedPreset(appearance.get().custom));
    panel.showModal(); document.documentElement.classList.add('appearance-open');
    trigger.setAttribute('aria-expanded','true');sync();position();
    notice('');engineNotice('正在准备自由调色…');
    try {
      await loadEngine();hue.disabled=false;levels.forEach(b=>b.disabled=false);
      engineNotice('');sync();position();
    } catch {engineNotice('自由调色暂不可用，请关闭面板后重试。主题配色和恢复默认绿色仍可使用。');}
  }
  function updatePalette(level) {
    if (!window.SoyoPaletteEngine) return;
    const result=window.SoyoPaletteEngine.generate(+hue.value,level || appearance.get().custom?.level || 'balanced');
    appearance.setCustom(result);
    notice('');
  }
  trigger.addEventListener('click',open);
  panel.querySelector('[data-appearance-close]').addEventListener('click',()=>panel.close());
  panel.addEventListener('close',()=>{
    if (frame) {cancelAnimationFrame(frame);frame=0;updatePalette();}
    drag=false;document.documentElement.classList.remove('appearance-open');
    trigger.setAttribute('aria-expanded','false');
    const focusTarget = trigger.getBoundingClientRect().height && getComputedStyle(trigger).visibility === 'visible' ? trigger : document.querySelector('.site-nav-toggle .toggle');
    focusTarget?.focus({preventScroll:true});
  });
  let outside=false;
  const isOutside=event=>{const r=panel.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  panel.addEventListener('pointerdown',event=>{outside=isOutside(event);});
  panel.addEventListener('pointerup',event=>{if(outside&&isOutside(event))panel.close();outside=false;});
  hue.addEventListener('input',()=>{
    drag=true;output.textContent=hue.value+'°';
    if (frame) cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{frame=0;updatePalette();});
  });
  hue.addEventListener('change',()=>{if(frame){cancelAnimationFrame(frame);frame=0;}updatePalette();drag=false;sync();});
  levels.forEach(b=>b.addEventListener('click',()=>updatePalette(b.dataset.level)));
  cards.forEach(card => card.addEventListener('click', () => {
    const preset = presets.find(p => p.id === card.dataset.appearancePreset);
    if (!preset) return;
    cancelDrag();
    appearance.setCustom(preset.colors);
    notice('已应用' + preset.name + '配色。');
  }));
  customOptions?.addEventListener('toggle', position);
  panel.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>appearance.setMode(b.dataset.mode)));
  panel.querySelector('[data-appearance-reset]').addEventListener('click',()=>{
    cancelDrag();appearance.reset();notice('已恢复默认绿色。');sync();
  });
  document.addEventListener('soyo-appearance-change',sync);
  window.addEventListener('resize',position);
  window.visualViewport?.addEventListener('resize',position);
  sync();
})();

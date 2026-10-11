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
  const baseHues = {green:164,blue:250,purple:305,apricot:60};
  let enginePromise, frame = 0, drag = false;
  function notice(text) { status.textContent = text; status.hidden = !text; position(); }
  function colors(sample, values) {
    appearance.roles.forEach((name,index)=>sample.style.setProperty('--sample-'+name,values[index]));
  }
  function sync() {
    const state = appearance.get();
    const custom = state.custom;
    trigger.querySelector('[data-appearance-current]').textContent = state.palette==='green' ? '默认' : '自定义';
    panel.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
    if (!drag) hue.value = custom?.hue ?? baseHues[state.palette] ?? 164;
    const level = custom?.level || 'balanced';
    levels.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.level===level)));
    output.textContent = state.palette==='green' ? '默认绿色' : hue.value + '°';
    hue.setAttribute('aria-valuetext', output.textContent);
    if (!panel.open || (!custom && !window.SoyoPaletteEngine)) return;
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
    panel.showModal(); document.documentElement.classList.add('appearance-open');
    trigger.setAttribute('aria-expanded','true');sync();position();
    notice('正在准备配色…');
    try {
      await loadEngine();hue.disabled=false;levels.forEach(b=>b.disabled=false);
      notice('');sync();position();
    } catch {notice('配色暂时未加载，请关闭后重试。仍可恢复默认绿色。');}
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
  panel.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>appearance.setMode(b.dataset.mode)));
  panel.querySelector('[data-appearance-reset]').addEventListener('click',()=>{
    if(frame){cancelAnimationFrame(frame);frame=0;}drag=false;appearance.reset();notice('已恢复默认绿色。');sync();
  });
  document.addEventListener('soyo-appearance-change',sync);
  window.addEventListener('resize',position);
  window.visualViewport?.addEventListener('resize',position);
  sync();
})();

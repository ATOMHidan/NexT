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
  const coverChoices = [...panel.querySelectorAll('[data-cover-choice]')];
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
    coverChoices.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.coverChoice === state.coverStyle)));
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
    } catch {engineNotice('自由调色暂不可用，请关闭面板后重试。封面、主题配色和恢复默认绿色仍可使用。');}
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
  coverChoices.forEach(choice => choice.addEventListener('click', () => {
    appearance.setCoverStyle(choice.dataset.coverChoice);
    notice('已切换为' + choice.querySelector('strong').textContent + '封面。');
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

/* One quiet day/night handover. Shares the existing panel request; no idle work. */
(function () {
  'use strict';
  if (!document.getElementById('appearance-panel') || typeof Element.prototype.animate !== 'function') return;
  const root=document.documentElement, reduced=matchMedia('(prefers-reduced-motion: reduce)'), forced=matchMedia('(forced-colors: active)'), print=matchMedia('print');
  const duration=560, paint=['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','fill-rule','opacity','display','color'];
  let current=null;
  function cancel() {
    const run=current;if(!run)return;current=null;
    run.observer?.disconnect();
    run.animations.forEach(animation=>animation.cancel());
    run.items.forEach(item=>item.ghost.remove());
  }
  function animate(run,node,frames,options={}) {
    run.animations.push(node.animate(frames,{duration,easing:'cubic-bezier(.22,.7,.2,1)',...options}));
  }
  function prepare(event) {
    cancel();const change=event.detail;
    if(change?.reason!=='mode' || !['light','dark'].includes(change.from) || change.from===change.to || document.hidden || reduced.matches || forced.matches || print.matches) return;
    const style=change.coverStyle==='landscape'?'landscape':'geometry',run={items:[],animations:[],change,style};current=run;
    try {
      const candidates=[...document.querySelectorAll('.article-cover:not([data-cover-preview])')].map(cover=>{
        const rect=cover.getBoundingClientRect(),width=Math.max(0,Math.min(innerWidth,rect.right)-Math.max(0,rect.left)),height=Math.max(0,Math.min(innerHeight,rect.bottom)-Math.max(0,rect.top));
        return {cover,area:width*height,rect};
      }).filter(item=>item.area>800 && item.rect.width>60 && item.rect.height>30 && getComputedStyle(item.cover).visibility==='visible')
        .sort((a,b)=>b.area-a.area).slice(0,2);
      for(const {cover} of candidates){
        const svg=cover.querySelector('svg:not([data-cover-interlude])'),group=svg?.querySelector('.cover-'+style);
        if(!group || getComputedStyle(group).display==='none')continue;
        const ghost=svg.cloneNode(true),originals=[svg,...svg.querySelectorAll('*')],copies=[ghost,...ghost.querySelectorAll('*')];
        // Resolve the OLD palette now, before root tokens change. Freeze only
        // paint, retaining SVG transforms, cropping and cutouts verbatim.
        originals.forEach((node,i)=>{const css=getComputedStyle(node);paint.forEach(name=>copies[i].style.setProperty(name,css.getPropertyValue(name)));copies[i].removeAttribute('id');});
        ghost.style.backgroundColor=getComputedStyle(cover).getPropertyValue('--cover-bg').trim();
        ghost.setAttribute('data-cover-interlude','');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('focusable','false');
        const lights=[...group.querySelectorAll('.scene-window,.scene-lantern')].map(node=>({node,fill:getComputedStyle(node).fill}));
        const glows=[...group.querySelectorAll('.gallery-halo,.gallery-light-ray,.scene-beam')].map(node=>({node,opacity:getComputedStyle(node).opacity}));
        cover.append(ghost);run.items.push({cover,group,ghost,lights,glows});
      }
      if(!run.items.length)cancel();
      else {
        run.observer=new MutationObserver(()=>{if(current===run && run.items.some(item=>!item.cover.isConnected))cancel();});
        run.observer.observe(document.body,{childList:true,subtree:true});
      }
    }catch {cancel();} // The theme still changes normally if decoration fails.
  }
  function play(event) {
    const run=current;if(!run)return;
    if(event.detail!==run.change || document.hidden || root.dataset.theme!==run.change.to){cancel();return;}
    try {
      for(const item of run.items){
        if(!item.cover.isConnected){cancel();return;}
        animate(run,item.ghost,[{opacity:1},{opacity:1,offset:.18},{opacity:0,offset:.76},{opacity:0}],{easing:'ease-in-out'});
        if(run.style==='landscape'){
          const outgoing=run.change.from==='light'?'.scene-day':'.scene-night',incoming=run.change.to==='dark'?'.scene-night':'.scene-day';
          item.ghost.querySelectorAll(outgoing).forEach(node=>animate(run,node,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(42px)'}],{duration:300,easing:'ease-in-out'}));
          item.group.querySelectorAll(incoming).forEach(node=>animate(run,node,[{opacity:0,transform:'translateY(18px)'},{opacity:0,transform:'translateY(18px)',offset:.25},{opacity:1,transform:'translateY(0)'}],{easing:'ease-in-out'}));
          item.lights.forEach(({node,fill})=>animate(run,node,[{fill},{fill:getComputedStyle(node).fill}],{delay:260,duration:260,fill:'backwards'}));
          item.glows.forEach(({node,opacity})=>animate(run,node,[{opacity},{opacity:getComputedStyle(node).opacity}],{delay:260,duration:260,fill:'backwards'}));
        }else{
          const old=item.ghost.querySelector('.cover-geometry');
          animate(run,old,[{transform:'translateY(0)'},{transform:'translateY(-7px)'}]);
          animate(run,item.group,[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}]);
        }
      }
      Promise.allSettled(run.animations.map(animation=>animation.finished)).then(()=>{if(current===run)cancel();});
    }catch {cancel();}
  }
  document.addEventListener('soyo-appearance-before-change',prepare);
  document.addEventListener('soyo-appearance-change',play);
  // No queues or offscreen continuation. Pointer/keyboard interaction always
  // gets the final native artwork, including gallery lamps and reading links.
  document.addEventListener('pointerdown',cancel,true);
  document.addEventListener('keydown',cancel,true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  window.addEventListener('pagehide',cancel);
  window.addEventListener('pageswap',cancel);
  window.addEventListener('scroll',cancel,{passive:true});
  window.addEventListener('resize',cancel);
  for(const media of [reduced,forced,print])media.addEventListener('change',cancel);
})();

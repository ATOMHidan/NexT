(function () {
  'use strict';
  const gallery = document.getElementById('article-gallery');
  const node = document.getElementById('gallery-data');
  if (!gallery || !node) return;
  let data;
  try { data = JSON.parse(node.textContent); } catch { return; }
  if (!data.rooms?.length || !Array.isArray(data.articles)) return;
  const stage = document.getElementById('gallery-stage');
  const exhibits = document.getElementById('gallery-exhibits');
  const tabs = [...gallery.querySelectorAll('[data-room]')];
  const prevRoom = gallery.querySelector('[data-room-prev]'), nextRoom = gallery.querySelector('[data-room-next]');
  const prevPage = gallery.querySelector('[data-page-prev]'), nextPage = gallery.querySelector('[data-page-next]');
  const positions = new Map();
  let room = 0, page = 0;
  const size = 2;
  function element(tag, cls, text) { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
  const controllers = new Set();
  function artController(art, motif) {
    const svg=art.querySelector('svg'), landscape=art.querySelector('.cover-landscape'), geometry=art.querySelector('.cover-geometry');
    if (!svg?.createSVGPoint || !svg.getCTM || !landscape || !geometry) return null;
    const ns='http://www.w3.org/2000/svg', controls=[], motion=[], stationary=[];
    let animations=[], revision=0;
    const make=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))e.setAttribute(key,value);return e;};
    const wrap=node=>{const g=make('g');node.before(g);g.append(node);return g;};
    const inside=node=>{const g=make('g');g.append(...node.childNodes);node.append(g);return g;};
    function control(style,kind,nodes,parts,label,extra={}) {
      const button=element('button','gallery-art-control');button.type='button';button.hidden=true;
      button.setAttribute('aria-label',label);button.dataset.artKind=kind;
      const item={style,kind,nodes,parts,button,label,...extra};controls.push(item);art.append(button);
      button.addEventListener('click',event=>{event.stopPropagation();if(event.defaultPrevented || button.hidden || !art.isConnected || button.getAttribute('aria-disabled')==='true')return;activate(item);});
      return item;
    }
    // Keep cutouts and nested SVG transforms together. Tiles, petals and paper
    // pieces can move individually; rings/portals move as coherent motifs.
    let base=geometry;
    if(base.children.length===1 && base.firstElementChild.tagName.toLowerCase()==='g')base=base.firstElementChild;
    const forms=[...base.children].filter(e=>e.tagName.toLowerCase()==='g');
    if(forms.length){
      const first=forms[0];let pieces=first;
      while(pieces.children.length===1 && pieces.firstElementChild.tagName.toLowerCase()==='g')pieces=pieces.firstElementChild;
      const split=[2,3,5,6,8,11,13].includes(motif);
      const parts=split ? [...pieces.children].filter(e=>!e.classList.contains('cover-line')).map(wrap) : forms.map(inside);
      motion.push(...parts);control('geometry','geometry',[first],parts,'拨动几何图案');
    }
    const scene=Number(landscape.dataset.landscape), windows=[...landscape.querySelectorAll('.scene-window,.scene-lantern')];
    if(scene===6){
      const sail=landscape.querySelector('.scene-sail');
      if(sail){const rotor=inside(sail.parentElement);motion.push(rotor);control('landscape','wind',[sail], [rotor],'轻转风车');}
    } else if(windows.length){
      const clusters=scene===2 ? [...landscape.querySelectorAll('.scene-window-group')].map(group=>windows.filter(e=>group.contains(e))) : [windows];
      clusters.filter(nodes=>nodes.length).forEach(nodes=>{
        const groups=nodes.map(node=>{const g=wrap(node);g.classList.add('gallery-light');g.prepend(make('circle',{class:'gallery-halo',r:0}));return g;});
        let ray;
        if(scene===1){const beam=landscape.querySelector('.scene-beam');if(beam){beam.setAttribute('data-original-beam','');ray=make('path',{class:'gallery-light-ray',d:beam.getAttribute('d')});landscape.append(ray);}}
        stationary.push(...groups,...(ray?[ray]:[]));
        control('landscape','light',nodes,groups,scene===3?'切换提灯':scene===1?'切换灯塔灯光':'切换窗灯',{ray});
      });
    } else {
      const waves=[...landscape.querySelectorAll('.scene-wave')];
      if(waves.length){const parts=waves.map(wrap);motion.push(...parts);control('landscape','water',waves,parts,'轻拨水纹');}
    }
    function stop(){
      revision++;animations.forEach(a=>a.cancel());animations=[];
      art.classList.remove('is-light-change');
      controls.forEach(c=>{c.button.removeAttribute('aria-disabled');if(c.kind!=='light')c.button.removeAttribute('aria-pressed');});
      motion.forEach(p=>p.classList.remove('gallery-still'));
    }
    function bounds(nodes){
      const root=svg.getCTM();if(!root)return null;const points=[];
      for(const node of nodes){const b=node.getBBox(),ctm=node.getCTM();if(!ctm)continue;const matrix=root.inverse().multiply(ctm);
        for(const [x,y] of [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]){const p=svg.createSVGPoint();p.x=x;p.y=y;points.push(p.matrixTransform(matrix));}}
      if(!points.length)return null;const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
      return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
    }
    function light(item,on){item.parts.forEach(g=>g.dataset.lit=String(on));if(item.ray)item.ray.dataset.lit=String(on);item.button.setAttribute('aria-pressed',String(on));}
    function activate(item){
      if(item.kind==='light'){art.classList.add('is-light-change');light(item,item.button.getAttribute('aria-pressed')!=='true');return;}
      if(reduced.matches || !item.parts[0]?.animate){
        const on=item.button.getAttribute('aria-pressed')!=='true';item.parts.forEach(p=>p.classList.toggle('gallery-still',on));item.button.setAttribute('aria-pressed',String(on));return;
      }
      const ticket=++revision;item.button.setAttribute('aria-disabled','true');
      // One finite response per activation, never an idle loop or queued spins.
      animations=item.parts.map((part,i)=>{
        let frames,duration;
        if(item.kind==='wind'){part.style.transformOrigin='0px 0px';frames=[{transform:'rotate(0deg)'},{transform:'rotate(90deg)'}];duration=1100;}
        else if(item.kind==='water'){frames=[{transform:'translateX(0)'},{transform:'translateX(9px)',offset:.45},{transform:'translateX(0)'}];duration=1000;}
        else {const box=part.getBBox();part.style.transformOrigin=`${box.x+box.width/2}px ${box.y+box.height/2}px`;const sign=i%2?-1:1;frames=[{transform:'translate(0,0) rotate(0deg)'},{transform:`translate(${sign*7}px,${(i%3-1)*5}px) rotate(${sign*(item.parts.length>1?7:13)}deg)`,offset:.44},{transform:'translate(0,0) rotate(0deg)'}];duration=800;}
        return part.animate(frames,{duration,easing:'cubic-bezier(.22,.7,.2,1)'});
      });
      Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(ticket!==revision)return;animations.forEach(a=>a.cancel());animations=[];item.button.removeAttribute('aria-disabled');});
    }
    function refresh(){
      stop();const style=document.documentElement.dataset.coverStyle==='landscape'?'landscape':'geometry';
      controls.forEach(item=>{
        item.button.hidden=item.style!==style;
        item.button.removeAttribute('aria-pressed');
        item.button.setAttribute('aria-label',reduced.matches&&item.kind!=='light'?'切换图案配色':item.label);
        if(item.kind==='light')light(item,document.documentElement.dataset.theme==='dark');
        if(item.button.hidden)return;
        try{if(item.kind==='light')item.nodes.forEach((node,i)=>{const b=node.getBBox(),halo=item.parts[i].querySelector('.gallery-halo');halo.setAttribute('cx',b.x+b.width/2);halo.setAttribute('cy',b.y+b.height/2);halo.setAttribute('r',Math.max(b.width,b.height)*.85);});
          const box=bounds(item.nodes);if(!box || !Number.isFinite(box.x+box.y+box.width+box.height) || !box.width || !box.height){item.button.hidden=true;return;}
          item.button.style.setProperty('--art-x',((box.x+box.width/2)/8)+'%');item.button.style.setProperty('--art-y',((box.y+box.height/2)/2.4)+'%');
          item.button.style.setProperty('--art-w',Math.min(44,(box.width+16)/8)+'%');item.button.style.setProperty('--art-h',Math.min(75,(box.height+16)/2.4)+'%');
        }catch{item.button.hidden=true;}
      });
    }
    return {refresh,stop};
  }
  function exhibit(article, number) {
    let url;
    try { url = new URL(article.url, location.href); } catch { return null; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    const card = element('article', 'gallery-exhibit'), detail=element('details','gallery-details'), summary = element('summary', '');
    // Only build-generated decorative SVG enters this HTML slot. All article text uses textContent.
    const art = element('div', 'gallery-art'); art.innerHTML = article.cover;
    const order = element('span', 'gallery-art-number', String(number).padStart(2, '0')); order.setAttribute('aria-hidden', 'true'); art.append(order);
    const label = element('div', 'gallery-label'), date = element('time', '', article.date); date.dateTime = article.date;
    const reveal = element('span', 'gallery-reveal', '展品资料 '); reveal.setAttribute('aria-hidden', 'true'); reveal.append(element('span', '', '＋')); label.append(date, reveal);
    summary.append(label, element('h3', '', article.title), element('p', 'gallery-intro', article.summary));
    const info = element('div', 'gallery-information');
    if (article.headings.length) {
      const list = element('ol', ''); article.headings.forEach(text => list.append(element('li', '', text)));
      info.append(element('p', 'gallery-caption', '文章里的章节'), list);
      if (article.more) info.append(element('p', 'gallery-caption', `另有 ${article.more} 个章节`));
    }
    const facts = [article.time ? `约 ${article.time}` : '', article.chapters ? `${article.chapters} 个章节` : '', article.code ? `${article.code} 段代码` : ''].filter(Boolean);
    const link = element('a', 'gallery-read', '阅读文章'); link.href = url.href;
    const arrow = element('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); link.append(arrow);
    info.append(element('p', 'gallery-facts', facts.join(' · '))); detail.append(summary, info);card.append(art,detail,link);
    try{const controller=artController(art,article.motif);if(controller)controllers.add(controller);}catch{/* Static artwork and native reading links remain available. */}
    return card;
  }
  function render(announce = true) {
    const current = data.rooms[room], pages = Math.max(1, Math.ceil(current.articles.length / size));
    page = Math.max(0, Math.min(page, pages - 1)); positions.set(room, page);
    tabs.forEach((tab,i) => tab.setAttribute('aria-pressed', String(i === room)));
    gallery.dataset.roomTone = String(room % 3);
    document.getElementById('gallery-room-name').textContent = current.name;
    document.getElementById('gallery-room-number').textContent = `ROOM ${String(room + 1).padStart(2,'0')}`;
    document.getElementById('gallery-room-count').textContent = `${current.articles.length} 件作品`;
    controllers.forEach(c=>c.stop());controllers.clear();exhibits.replaceChildren();
    current.articles.slice(page * size, (page + 1) * size).forEach((index,i) => { const card = exhibit(data.articles[index], page * size + i + 1); if (card) exhibits.append(card); });
    controllers.forEach(c=>c.refresh());
    document.getElementById('gallery-page').textContent = `${page + 1} / ${pages}`;
    prevPage.disabled = page === 0; nextPage.disabled = page === pages - 1;
    prevRoom.disabled = room === 0; nextRoom.disabled = room === data.rooms.length - 1;
    gallery.querySelector('.gallery-pagination').hidden = pages <= 1;
    exhibits.classList.remove('is-changing'); void exhibits.offsetWidth; exhibits.classList.add('is-changing');
    if (announce) document.getElementById('gallery-status').textContent = `${current.name}，${current.articles.length} 件作品，第 ${page + 1} 组，共 ${pages} 组。`;
  }
  function choose(index, focus = false) {
    if (index < 0 || index >= data.rooms.length || index === room) return;
    room = index; page = positions.get(room) || 0; render();
    const strip = gallery.querySelector('.gallery-rooms');
    const tabRect = tabs[room].getBoundingClientRect(), stripRect = strip.getBoundingClientRect();
    strip.scrollLeft += tabRect.left - stripRect.left - (strip.clientWidth - tabRect.width) / 2;
    if (focus) stage.focus({preventScroll:true});
  }
  tabs.forEach((tab,i) => tab.addEventListener('click', () => choose(i)));
  prevRoom.addEventListener('click', () => choose(room - 1, true)); nextRoom.addEventListener('click', () => choose(room + 1, true));
  function paginate(delta) { page += delta; render(); stage.focus({preventScroll:true}); stage.scrollIntoView?.({block:'start', behavior:'instant'}); }
  prevPage.addEventListener('click', () => paginate(-1)); nextPage.addEventListener('click', () => paginate(1));
  stage.addEventListener('keydown', event => {
    if (event.target !== stage || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); choose(room + (event.key === 'ArrowRight' ? 1 : -1), true); }
  });
  let touch, suppressClickUntil = 0;
  stage.addEventListener('click', event => {
    if (event.detail > 0 && Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  stage.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 && !event.target.closest('a,button,.gallery-information') ? {x:event.touches[0].clientX, y:event.touches[0].clientY, time:Date.now()} : null;
  }, {passive:true});
  stage.addEventListener('touchend', event => {
    if (!touch || event.changedTouches.length !== 1) { touch = null; return; }
    const dx = event.changedTouches[0].clientX - touch.x, dy = event.changedTouches[0].clientY - touch.y;
    if (Date.now() - touch.time < 700 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && !String(window.getSelection?.() || '')) {
      const target = room + (dx < 0 ? 1 : -1);
      if (target >= 0 && target < data.rooms.length) { suppressClickUntil = Date.now() + 350; choose(target); }
    }
    touch = null;
  }, {passive:true});
  stage.addEventListener('touchcancel', () => { touch = null; }, {passive:true});
  document.addEventListener('soyo-appearance-change',()=>controllers.forEach(c=>c.refresh()));
  reduced.addEventListener?.('change',()=>controllers.forEach(c=>c.refresh()));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)controllers.forEach(c=>c.stop());});
  window.addEventListener('pagehide',()=>controllers.forEach(c=>c.stop()));
  gallery.querySelector('.gallery-tools').hidden = false;
  stage.setAttribute('aria-label', '展品区：左右方向键切换展厅');
  render(false);
})();

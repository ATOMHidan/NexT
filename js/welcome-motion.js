(() => {
  'use strict';
  const title=document.getElementById('welcome-title'), button=document.getElementById('welcome-play');
  if(!title || !button) return;
  const letters=[...title.querySelectorAll('.welcome-letter')];
  // Artwork changes only with layout or appearance. Existing title interactions
  // continue to move the real text, including its own piece of the shared image.
  if (window.ResizeObserver && window.CSS?.supports('background-clip', 'text')) {
    let signature='', revision=0;
    const rgb=hex=>hex.slice(1).match(/../g).map(n=>parseInt(n,16));
    const hex=values=>'#'+values.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
    const mix=(a,b,t)=>hex(rgb(a).map((n,i)=>n*(1-t)+rgb(b)[i]*t));
    const light=hex=>rgb(hex).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
    const contrast=(a,b)=>(Math.max(light(a),light(b))+.05)/(Math.min(light(a),light(b))+.05);
    function renderWordmark() {
      const css=getComputedStyle(title), line=parseFloat(css.lineHeight);
      if (!title.clientWidth || !line) return;
      const width=Math.max(...letters.map(letter=>letter.offsetLeft+letter.offsetWidth));
      const root=document.documentElement, mode=root.dataset.theme, style=root.dataset.coverStyle;
      const color=(role,fallback)=>{const v=css.getPropertyValue('--md-'+role).trim();return /^#[0-9a-f]{6}$/i.test(v)?v:fallback;};
      const bg=color('low','#edf4ed'), text=color('text','#22252a');
      // Every painted color remains readable against the welcome surface, even
      // for custom palettes. Blend toward the existing text role when needed.
      const safe=value=>{for(let i=0;i<10&&contrast(value,bg)<4.5;i++)value=mix(value,text,.2);return value;};
      const primary=safe(color('primary','#286a50')), secondary=safe(color('secondary','#465f85')), warm=safe(color('tertiary','#855329'));
      const simple=parseFloat(css.fontSize)<35, next=[width,line,mode,style,primary,secondary,warm,bg,simple].join('|');
      if(next===signature)return;signature=next;title.classList.remove('welcome-wordmark-ready');
      // Compensate for different line widths so circles and the moon stay round.
      const aspect=8*line/width;
      let art;
      if(style==='landscape') {
        const sky=mode==='dark'?safe(mix(secondary,bg,.3)):primary;
        const far=mode==='dark'?primary:secondary, near=mode==='dark'?secondary:warm;
        const sun=mode==='dark'?`<g transform="translate(664 28) scale(${aspect} 1)"><path d="M5-12a13 13 0 1 0 9 22 15 15 0 0 1-9-22Z"/></g>`:`<ellipse cx="664" cy="28" rx="${12*aspect}" ry="12"/>`;
        art=`<path fill="${sky}" d="M0 0h800v100H0z"/><path fill="${far}" d="M0 89 123 26 263 83 425 21 582 86 724 39 800 78v22H0z"/><path fill="${near}" d="M0 95 182 55 334 89 513 47 667 91 800 62v38H0z"/><g fill="${warm}">${sun}${mode==='dark'&&!simple?'<circle cx="286" cy="22" r="2"/><circle cx="572" cy="17" r="1.6"/>':''}</g>`;
      } else {
        const ring=simple?49:57;
        art=`<path fill="${primary}" d="M0 0h800v100H0z"/><path fill="${secondary}" d="M0 0h116v100H0zM448 0h162L448 100z"/><ellipse fill="${warm}" cx="225" cy="50" rx="${91*aspect}" ry="91"/><ellipse fill="${primary}" cx="225" cy="50" rx="${ring*aspect}" ry="${ring}"/><path fill="${warm}" d="M335 100V0h104zM674 0h126v100A126 100 0 0 1 674 0z"/>`;
      }
      const url='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 100" preserveAspectRatio="none">${art}</svg>`);
      const ticket=++revision, image=new Image();
      // Do not make letters transparent until the local artwork can be painted.
      image.onload=()=>{if(ticket!==revision)return;title.style.setProperty('--welcome-art',`url("${url}")`);title.classList.add('welcome-wordmark-ready');};
      image.onerror=()=>{if(ticket===revision)title.classList.remove('welcome-wordmark-ready');};
      title.style.setProperty('--welcome-width',width+'px');title.style.setProperty('--welcome-line',line+'px');
      letters.forEach(letter=>letter.style.setProperty('--welcome-x',-letter.offsetLeft+'px'));
      image.src=url;
    }
    new ResizeObserver(renderWordmark).observe(title);
    document.addEventListener('soyo-appearance-change',renderWordmark);
    document.addEventListener('home-layout-change',renderWordmark);
    renderWordmark();
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), pointer=matchMedia('(hover: hover) and (pointer: fine)');
  let frame=0, playing=false, animations=[], timer;
  button.hidden=false;
  function reset(){cancelAnimationFrame(frame);frame=0;letters.forEach(letter=>{letter.style.transform='';});}
  title.addEventListener('pointermove',event=>{
    if(reduced.matches || !pointer.matches || playing || frame) return;
    const x=event.clientX,y=event.clientY;
    frame=requestAnimationFrame(()=>{frame=0;letters.forEach(letter=>{
      const r=letter.getBoundingClientRect(),dx=r.left+r.width/2-x,dy=r.top+r.height/2-y;
      const distance=Math.hypot(dx,dy), force=Math.max(0,1-distance/90)*3;
      letter.style.transform=`translate(${dx/Math.max(distance,1)*force}px,${dy/Math.max(distance,1)*force}px)`;
    });});
  });
  title.addEventListener('pointerleave',reset);
  button.addEventListener('click',()=>{
    if(playing) return;
    reset();clearTimeout(timer);
    const status=document.getElementById('welcome-play-status');status.textContent='欢迎来到 Soyo Course';
    timer=setTimeout(()=>{status.textContent='';},2200);
    if(reduced.matches || !title.animate) return;
    playing=true;
    animations=letters.map((letter,i)=>letter.animate([
      {transform:'translate(0,0) rotate(0deg)'},
      {transform:`translate(${(i%3-1)*7}px,${i%2?-9:8}px) rotate(${i%2?6:-6}deg)`,offset:.4},
      {transform:'translate(0,0) rotate(0deg)'}
    ],{duration:540,delay:i*12,easing:'cubic-bezier(.2,0,0,1)'}));
    Promise.allSettled(animations.map(a=>a.finished)).then(()=>{playing=false;animations=[];});
  });
  function stop(){reset();animations.forEach(a=>a.cancel());}
  reduced.addEventListener('change',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
})();

(() => {
  'use strict';
  const title=document.getElementById('welcome-title'), button=document.getElementById('welcome-play');
  if(!title || !button) return;
  const letters=[...title.querySelectorAll('.welcome-letter')];
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

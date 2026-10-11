/* Loaded only when the visitor plays music or opens its view. */
(() => {
  'use strict';
  window.SoyoMusicVisual = { mount({ slot, audio, getGraph }) {
    const art = slot.querySelector('.music-visual');
    const core = art.querySelector('[data-music-motion="core"]');
    const papers = ['a','b','c'].map(key => art.querySelector(`[data-music-motion="paper-${key}"]`));
    const marks = [...art.querySelectorAll('[data-music-motion^="mark-"]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false, playing = !audio.paused && !audio.ended && audio.readyState >= 3;
    let frame = 0, last = 0, bins, analyser, ranges, peakLevel = .35, levels = Array(10).fill(0);
    const transforms = Array(10).fill('');
    function rest() {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      art.classList.remove('music-visual-running');
      [core,...papers,...marks].forEach((node,i) => {
        node.style.transform = ''; transforms[i] = '';
        node.style.opacity = '';
      });
      levels.fill(0);
      peakLevel = .35;
    }
    function ready() {
      const graph = getGraph();
      return visible && playing && !audio.paused && !audio.ended && !audio.muted && audio.volume>0 && !document.hidden && !reduced.matches &&
        graph?.context.state === 'running' && graph.analyser;
    }
    function setup(node) {
      analyser = node;
      bins = new Uint8Array(node.frequencyBinCount);
      const hz = node.context.sampleRate / node.fftSize;
      ranges = [[35,180],[180,480],[480,1300],[1300,2800],
        [2800,3800],[3800,4800],[4800,6000],[6000,7600],[7600,9500],[9500,12000]].map(([lo,hi]) =>
        [Math.min(bins.length-1,Math.max(1,Math.floor(lo/hz))),Math.min(bins.length,Math.max(2,Math.ceil(hi/hz)))]);
    }
    function move(node,index,value) {
      if (transforms[index] === value) return;
      transforms[index] = value; node.style.transform = value;
    }
    function draw(now) {
      frame = 0;
      const node = ready();
      if (!node) { rest(); return; }
      if (!last || now-last >= 1000/30-1) {
        const elapsed = last ? Math.min(120,now-last) : 33;
        last = now;
        if (analyser !== node) setup(node);
        analyser.getByteFrequencyData(bins);
        // Normalize quiet tracks against a slowly changing spectral peak. The
        // floor prevents amplifying near-silence; this never changes audio gain.
        let peak = 0;
        const upper = Math.min(bins.length,Math.ceil(12000/(analyser.context.sampleRate/analyser.fftSize)));
        for(let i=1;i<upper;i++) peak = Math.max(peak,bins[i]/255);
        peakLevel += (peak-peakLevel)*(1-Math.exp(-elapsed/(peak>peakLevel ? 100 : 1200)));
        const normal = Math.max(.24,peakLevel);
        ranges.forEach(([from,to],i) => {
          let sum = 0;
          if (!audio.muted && audio.volume > 0) for(let j=from;j<to;j++) sum += bins[j]/255;
          const target = Math.pow(Math.min(1,sum/Math.max(1,to-from)/normal*.9),1.2);
          const blend = 1-Math.exp(-elapsed/(target>levels[i] ? 90 : 240));
          levels[i] += (target-levels[i])*blend;
        });
        const n = value => value.toFixed(3);
        move(core,0,`scale(${n(1+levels[0]*.18)})`);
        move(papers[0],1,`translate(${n(-levels[1]*8)}px,${n(-levels[1]*5)}px) rotate(${n(-levels[1]*7)}deg)`);
        move(papers[1],2,`translate(${n(levels[2]*7)}px,${n(-levels[2]*6)}px) rotate(${n(levels[2]*8)}deg)`);
        move(papers[2],3,`translate(${n(-levels[3]*4)}px,${n(levels[3]*7)}px) rotate(${n(-levels[3]*6)}deg)`);
        marks.forEach((mark,i) => {
          move(mark,i+4,`scale(${n(1+levels[i+4]*.8)})`);
          mark.style.opacity = n(.4+levels[i+4]*.6);
        });
      }
      frame = requestAnimationFrame(draw);
    }
    function sync() {
      if (!ready()) { rest(); return; }
      art.classList.add('music-visual-running');
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function view() {
      const r = art.getBoundingClientRect();
      visible = r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth;
      sync();
    }
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio>0);
      sync();
    }, { threshold:0 }) : null;
    observer?.observe(art);
    // Unsupported observers keep the composition static rather than poll layout.
    audio.addEventListener('playing', () => { playing = true; sync(); });
    ['pause','ended','waiting','stalled','seeking','emptied','error'].forEach(name =>
      audio.addEventListener(name, () => { playing = false; sync(); }));
    audio.addEventListener('seeked', () => { playing = !audio.paused && audio.readyState>=3; sync(); });
    audio.addEventListener('volumechange', sync);
    slot.addEventListener('soyo-music-graph', sync);
    slot.addEventListener('soyo-music-view', () => { if(observer) view(); });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', rest);
    window.addEventListener('pageshow', sync);
    reduced.addEventListener('change', sync);
    return { sync };
  } };
})();

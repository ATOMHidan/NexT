(function () {
  'use strict';
  const star = document.querySelector('.blog-star');
  if (star) {
    const trigger = star.querySelector('.blog-star-trigger');
    const bubble = star.querySelector('.blog-star-bubble');
    const lines = ['有什么事吗？', '这里没有隐藏的课程答案。', '……真的没有。', '好吧，你发现了一个正在摸鱼的博主。'];
    let step = -1;
    function close(restoreFocus) {
      bubble.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      star.classList.remove('blog-star-finished');
      step = -1;
      if (restoreFocus) trigger.focus({preventScroll: true});
    }
    trigger.addEventListener('click', () => {
      if (step === lines.length - 1) { close(false); return; }
      step++;
      bubble.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      bubble.querySelector('p').textContent = lines[step];
      bubble.querySelector('small').textContent = step === lines.length - 1 ? '再点一下星标，收起对白' : '再点一下星标，继续聊聊';
      star.classList.toggle('blog-star-finished', step === lines.length - 1);
    });
    star.querySelector('.blog-star-close').addEventListener('click', () => close(true));
    document.addEventListener('click', event => { if (!bubble.hidden && !star.contains(event.target)) close(false); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !bubble.hidden) close(star.contains(document.activeElement)); });
  }
  const dialog = document.getElementById('blog-guide-dialog');
  if (!dialog) return;
  const opener = document.getElementById('blog-guide-open');
  const ask = document.getElementById('blog-guide-ask');
  const reply = document.getElementById('blog-guide-reply');
  opener.addEventListener('click', () => {
    dialog.classList.remove('blog-guide-answered');
    reply.hidden = true;
    ask.hidden = false;
    dialog.showModal();
  });
  function close() { dialog.close(); }
  document.getElementById('blog-guide-close').addEventListener('click', close);
  document.getElementById('blog-guide-ok').addEventListener('click', close);
  ask.addEventListener('click', () => {
    dialog.classList.add('blog-guide-answered');
    reply.hidden = false;
    ask.hidden = true;
    document.getElementById('blog-guide-ok').focus({preventScroll: true});
  });
  dialog.addEventListener('close', () => opener.focus({preventScroll: true}));
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) close();
  });
})();

// The garden shares this existing footer script: no additional initial request.
(() => {
  'use strict';
  const garden = document.querySelector('.footer-garden');
  if (!garden) return;
  // A local-time accent, refreshed only on arrival / returning to this tab.
  // The article's geometry stays stable. No timer, weather API or animation.
  function updateClimate() {
    const now = new Date();
    const season = Math.floor((now.getMonth() + 1) % 12 / 3);
    const night = now.getHours() < 6 || now.getHours() >= 18;
    garden.dataset.gardenSeason = ['winter','spring','summer','autumn'][season];
    garden.dataset.gardenTime = night ? 'night' : 'day';
    const label = garden.querySelector('[data-garden-climate]');
    if (label) label.textContent = `${garden.dataset.gardenName} · ${['冬','春','夏','秋'][season]}${night ? '夜' : '日'}`;
  }
  updateClimate();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const status = garden.querySelector('.garden-status');
  const animations = new Set();
  const wheel = garden.querySelector('.garden-wheel-disc');
  const tiles = [...garden.querySelectorAll('.garden-tile')];
  let tile = Number(garden.dataset.gardenTile), layouts;
  try { layouts = JSON.parse(garden.dataset.gardenLayouts); } catch { layouts = []; }
  function cancel(element) {
    for (const animation of animations) if (!element || animation.effect?.target === element) animation.cancel();
  }
  function animate(element, frames, duration) {
    cancel(element);
    if (reduced.matches || document.hidden || !element.animate) return;
    const animation = element.animate(frames, {duration, easing:'cubic-bezier(.2,0,0,1)'});
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  }
  garden.querySelector('[data-garden-flower]').addEventListener('click', event => {
    const button = event.currentTarget;
    const open = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(open));
    button.setAttribute('aria-label', open ? '收起纸花' : '展开纸花');
    button.title = open ? '收起纸花' : '展开纸花';
    status.textContent = open ? '花开了。再点一下，可以收起。' : '纸花合上了，留待下一次绽放。';
  });
  garden.querySelector('[data-garden-wheel]').addEventListener('click', () => {
    animate(wheel, [
      {transform:'translateX(0) rotate(0deg)'},
      {transform:'translateX(16px) rotate(120deg)',offset:.33},
      {transform:'translateX(-16px) rotate(240deg)',offset:.67},
      {transform:'translateX(0) rotate(360deg)'}
    ], 700);
    status.textContent = reduced.matches ? '圆盘在这里，陪你歇一会儿。' : '圆盘绕了一圈，又回到了这里。';
  });
  garden.querySelector('[data-garden-papers]').addEventListener('click', () => {
    if (!Array.isArray(layouts) || layouts.length !== 3) return;
    tile = (tile + 1) % layouts.length;
    garden.dataset.gardenTile = tile;
    tiles.forEach((element, i) => {
      const from = getComputedStyle(element).transform;
      const [x,y,angle] = layouts[tile][i];
      const to = `translate(${x}px,${y}px) rotate(${angle}deg)`;
      element.style.transform = to;
      animate(element, [{transform:from},{transform:to}], 360);
    });
    status.textContent = ['纸片排成了小方阵。','纸片围成了一枚菱形。','纸片错落叠在了一起。'][tile];
  });
  reduced.addEventListener('change', () => cancel());
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); else updateClimate(); });
  garden.querySelector('[data-garden-top]').addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('.header .brand')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:reduced.matches ? 'instant':'smooth'});
  });
  if (document.getElementById('site-search')) garden.querySelector('[data-garden-search]').hidden = false;

  const random = garden.querySelector('[data-garden-random]');
  let request, loading = false;
  const fallback = random.href;
  function canonical(url) { return new URL(url,location.href).pathname.replace(/\/$/,''); }
  function loadArticles() {
    if (!request) request = fetch(random.dataset.gardenIndex).then(response => {
      if (!response.ok) throw new Error('Garden index unavailable');
      return response.json();
    }).then(data => {
      if (!Array.isArray(data.urls)) throw new Error('Invalid garden index');
      return [...new Set(data.urls.filter(value => typeof value === 'string').map(value => {
        try {
          const url = new URL(value, location.href);
          return url.origin === location.origin && /^https?:$/.test(url.protocol) && !url.search && !url.hash ? url.href : null;
        } catch { return null; }
      }).filter(Boolean))];
    }).catch(error => { request = undefined; throw error; });
    return request;
  }
  random.addEventListener('click', async event => {
    if (event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (loading) return;
    loading = true; random.setAttribute('aria-busy','true');
    status.textContent = '找一篇文章，继续逛逛。';
    let target = fallback;
    try {
      let choices = (await loadArticles()).filter(url => canonical(url) !== canonical(location.href));
      if (choices.length > 1) choices = choices.filter(url => url !== random.href);
      if (choices.length) target = choices[Math.floor(Math.random()*choices.length)];
      else if (canonical(fallback) === canonical(location.href)) target = new URL(random.dataset.gardenArchive,location.href).href;
    } catch { status.textContent = '先从这篇文章开始吧。'; }
    finally { loading = false; random.removeAttribute('aria-busy'); }
    random.href = target;
    location.assign(target);
  });
})();

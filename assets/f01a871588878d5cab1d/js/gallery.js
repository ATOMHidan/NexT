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
  function exhibit(article, number) {
    let url;
    try { url = new URL(article.url, location.href); } catch { return null; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    const detail = element('details', 'gallery-exhibit'), summary = element('summary', '');
    // Only build-generated decorative SVG enters this HTML slot. All article text uses textContent.
    const art = element('div', 'gallery-art'); art.innerHTML = article.cover;
    const order = element('span', 'gallery-art-number', String(number).padStart(2, '0')); order.setAttribute('aria-hidden', 'true'); art.append(order);
    const label = element('div', 'gallery-label'), date = element('time', '', article.date); date.dateTime = article.date;
    const reveal = element('span', 'gallery-reveal', '展品资料 '); reveal.setAttribute('aria-hidden', 'true'); reveal.append(element('span', '', '＋')); label.append(date, reveal);
    summary.append(art, label, element('h3', '', article.title), element('p', 'gallery-intro', article.summary));
    const info = element('div', 'gallery-information');
    if (article.headings.length) {
      const list = element('ol', ''); article.headings.forEach(text => list.append(element('li', '', text)));
      info.append(element('p', 'gallery-caption', '文章里的章节'), list);
      if (article.more) info.append(element('p', 'gallery-caption', `另有 ${article.more} 个章节`));
    }
    const facts = [article.time ? `约 ${article.time}` : '', article.chapters ? `${article.chapters} 个章节` : '', article.code ? `${article.code} 段代码` : ''].filter(Boolean);
    const link = element('a', 'gallery-read', '阅读文章'); link.href = url.href;
    const arrow = element('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); link.append(arrow);
    info.append(element('p', 'gallery-facts', facts.join(' · ')), link); detail.append(summary, info); return detail;
  }
  function render(announce = true) {
    const current = data.rooms[room], pages = Math.max(1, Math.ceil(current.articles.length / size));
    page = Math.max(0, Math.min(page, pages - 1)); positions.set(room, page);
    tabs.forEach((tab,i) => tab.setAttribute('aria-pressed', String(i === room)));
    gallery.dataset.roomTone = String(room % 3);
    document.getElementById('gallery-room-name').textContent = current.name;
    document.getElementById('gallery-room-number').textContent = `ROOM ${String(room + 1).padStart(2,'0')}`;
    document.getElementById('gallery-room-count').textContent = `${current.articles.length} 件作品`;
    exhibits.replaceChildren();
    current.articles.slice(page * size, (page + 1) * size).forEach((index,i) => { const card = exhibit(data.articles[index], page * size + i + 1); if (card) exhibits.append(card); });
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
  gallery.querySelector('.gallery-tools').hidden = false;
  stage.setAttribute('aria-label', '展品区：左右方向键切换展厅');
  render(false);
})();

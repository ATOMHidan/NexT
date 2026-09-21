(function () {
  'use strict';
  function boot() {
    const tools = document.getElementById('reader-tools');
    const body = document.querySelector('.post-body');
    if (!tools || !body) return;
    const $ = id => document.getElementById(id);
    const dialog = $('reader-dialog'), toc = $('reader-toc');
    const settingsKey = 'soyo-reading-settings', progressKey = 'soyo-reading-progress';
    const articleURL = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
    articleURL.hash = ''; articleURL.search = '';
    const title = document.querySelector('.post-title')?.textContent.trim() || document.title;
    let headings = [], sections = [], signature = '', pending = null, opener, closeTarget, statusTimer, saveTimer, raf;
    let active = -1, interacted = false, initialized = false;
    function read(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
    function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
    function hash(text) { let value = 2166136261; for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619); return (value >>> 0).toString(36); }
    const locked = () => Boolean(body.querySelector('#hbePass, #hexo-blog-encrypt input[type="password"]'));
    function announce(message) { clearTimeout(statusTimer); $('reader-status').textContent = message; $('reader-dialog-status').textContent = message; statusTimer = setTimeout(() => { $('reader-status').textContent = ''; $('reader-dialog-status').textContent = ''; }, 3200); }
    function applySettings(value) {
      const size = ['small', 'normal', 'large'].includes(value.size) ? value.size : 'normal';
      const spacing = value.spacing === 'relaxed' ? 'relaxed' : 'normal';
      document.documentElement.style.setProperty('--reader-size', {small:'15px',normal:'16px',large:'18px'}[size]);
      if (spacing === 'relaxed') document.documentElement.style.setProperty('--reader-spacing', '2.2');
      else document.documentElement.style.removeProperty('--reader-spacing');
      $('reader-size').value = size; $('reader-spacing').value = spacing;
    }
    document.body.classList.add('reader-article'); tools.hidden = false;
    applySettings(read(settingsKey));
    for (const id of ['reader-size', 'reader-spacing']) $(id).addEventListener('change', () => {
      const value = {size:$('reader-size').value, spacing:$('reader-spacing').value}; applySettings(value); write(settingsKey, value);
    });
    $('reader-reset').addEventListener('click', () => { applySettings({}); write(settingsKey, {}); });
    function open(panel) {
      opener = document.activeElement;
      tools.querySelectorAll('[data-reader-content]').forEach(section => { section.hidden = section.dataset.readerContent !== panel; });
      $('reader-dialog-title').textContent = {toc:'文章目录',settings:'阅读设置',share:'分享文章'}[panel];
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add('reader-panel-open');
      if (panel === 'toc') toc.querySelector('[aria-current]')?.scrollIntoView({block:'nearest'});
    }
    tools.querySelectorAll('[data-reader-panel]').forEach(button => button.addEventListener('click', () => open(button.dataset.readerPanel)));
    $('reader-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { document.documentElement.classList.remove('reader-panel-open'); (closeTarget || opener)?.focus({preventScroll:true}); closeTarget = null; });
    dialog.addEventListener('click', event => {
      const r = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
    function locationInArticle() {
      if (!sections.length) return null;
      let index = 0;
      for (let i = 1; i < sections.length; i++) if (sections[i].element.getBoundingClientRect().top <= 110) index = i;
      const top = sections[index].element.getBoundingClientRect().top + scrollY;
      const bottom = index + 1 < sections.length ? sections[index + 1].element.getBoundingClientRect().top + scrollY : body.getBoundingClientRect().bottom + scrollY;
      return {anchor:sections[index].key, offset:Math.max(0, Math.min(1, (scrollY + 110 - top) / Math.max(1, bottom - top)))};
    }
    function restore(position) {
      const index = sections.findIndex(section => section.key === position.anchor);
      if (index < 0) return;
      const top = sections[index].element.getBoundingClientRect().top + scrollY;
      const bottom = index + 1 < sections.length ? sections[index + 1].element.getBoundingClientRect().top + scrollY : body.getBoundingClientRect().bottom + scrollY;
      window.scrollTo({top:Math.max(0, top + position.offset * Math.max(1, bottom - top) - 110), behavior:'instant'});
    }
    function focusMode(enabled) {
      const within = body.getBoundingClientRect().top < 110 && body.getBoundingClientRect().bottom > 110;
      const position = within ? locationInArticle() : null;
      document.body.classList.toggle('reader-focus', enabled);
      $('reader-focus').setAttribute('aria-pressed', String(enabled));
      $('reader-focus').textContent = enabled ? '退出专注' : '专注阅读'; $('reader-exit').hidden = !enabled;
      requestAnimationFrame(() => { if (position) restore(position); (enabled ? $('reader-exit') : $('reader-focus')).focus({preventScroll:true}); });
    }
    $('reader-focus').addEventListener('click', () => focusMode(!document.body.classList.contains('reader-focus')));
    $('reader-exit').addEventListener('click', () => focusMode(false));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('dialog[open]') && document.body.classList.contains('reader-focus')) focusMode(false); });
    async function copy(text, fallbackPanel = 'share') {
      try { await navigator.clipboard.writeText(text); announce('已复制'); }
      catch {
        open(fallbackPanel); $('reader-copy-fallback').hidden = false;
        const field = $('reader-copy-fallback').querySelector('textarea'); field.value = text; field.focus(); field.select();
      }
    }
    $('reader-copy-url').addEventListener('click', () => copy(articleURL.href));
    $('reader-copy-title').addEventListener('click', () => copy(`${title}\n${articleURL.href}`));
    $('reader-native-share').hidden = !navigator.share;
    $('reader-native-share').addEventListener('click', async () => {
      try { await navigator.share({title, url:articleURL.href}); }
      catch (error) { if (error.name !== 'AbortError') announce('系统分享不可用，可以复制链接'); }
    });
    const endShare = document.createElement('button'); endShare.type = 'button'; endShare.className = 'reader-end-share'; endShare.textContent = '分享这篇文章';
    document.querySelector('.post-footer')?.prepend(endShare); endShare.addEventListener('click', () => open('share'));
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
      for (const {target} of entries) target.dataset.overflow = String(target.scrollWidth > target.clientWidth + 2);
    }) : null;
    function enhanceContent() {
      for (const table of body.querySelectorAll('table')) {
        if (table.closest('figure.highlight, .reader-code')) continue;
        let wrapper = table.closest('.table-container');
        if (!wrapper) { wrapper = document.createElement('div'); wrapper.className = 'table-container'; table.before(wrapper); wrapper.append(table); }
        wrapper.classList.add('reader-table'); wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', '文章表格，可横向滚动');
        observer?.observe(wrapper); wrapper.dataset.overflow = String(wrapper.scrollWidth > wrapper.clientWidth + 2);
      }
      for (const block of body.querySelectorAll('figure.highlight, pre')) {
        if (block.closest('.reader-code') || (block.tagName === 'PRE' && block.closest('figure.highlight')) || block.querySelector('.mermaid')) continue;
        const content = block.querySelector('.code pre') || block.querySelector('code') || block;
        const text = content.textContent;
        const wrapper = document.createElement('div'); wrapper.className = 'reader-code';
        const controls = document.createElement('div'); controls.className = 'reader-code-tools';
        function button(label, action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => action(b)); controls.append(b); return b; }
        button('复制代码', () => copy(text));
        const wrap = button('自动换行', b => { const enabled = wrapper.classList.toggle('is-wrapped'); b.setAttribute('aria-pressed', String(enabled)); }); wrap.setAttribute('aria-pressed', 'false');
        if (text.split('\n').length > 18) {
          wrapper.classList.add('is-collapsed');
          const expand = button('展开代码', b => { const collapsed = wrapper.classList.toggle('is-collapsed'); b.textContent = collapsed ? '展开代码' : '收起代码'; b.setAttribute('aria-expanded', String(!collapsed)); }); expand.setAttribute('aria-expanded','false');
        }
        block.before(wrapper); wrapper.append(controls, block);
      }
    }
    function progress() {
      const value = read(progressKey); return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    function forget() { const all = progress(); delete all[location.pathname]; write(progressKey, all); }
    function save() {
      if (!initialized || locked() || pending || !interacted || body.offsetHeight < innerHeight * 1.5) return;
      const rect = body.getBoundingClientRect();
      if (rect.bottom < innerHeight + 120) { forget(); return; }
      if (rect.top > -Math.max(250, innerHeight / 2)) return;
      const position = locationInArticle(); if (!position) return;
      const all = progress(); all[location.pathname] = {...position, signature, time:Date.now()};
      const latest = Object.entries(all).sort((a,b) => (b[1]?.time || 0) - (a[1]?.time || 0)).slice(0,40);
      write(progressKey, Object.fromEntries(latest));
    }
    function updateActive() {
      raf = null;
      let index = headings.length ? 0 : -1;
      for (let i = 0; i < headings.length; i++) if (headings[i].getBoundingClientRect().top <= 130) index = i;
      if (index === active) return; active = index;
      [...toc.children].forEach((link, i) => { if (i === index) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current'); });
    }
    function initialize() {
      if (locked() || initialized) return;
      initialized = true;
      const original = body.cloneNode(true);
      original.querySelectorAll('.copy-btn,.code-lang,.expand-btn,.fold-cover').forEach(node => node.remove());
      signature = hash(original.textContent);
      headings = [...body.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.textContent.trim() && !h.closest('pre,figure'));
      sections = [{element:body,key:'intro',label:'文章开头'}];
      const minLevel = Math.min(...headings.map(h => Number(h.tagName[1])));
      headings.forEach((heading, index) => {
        const label = heading.textContent.trim();
        if (!heading.id) { let id = `reader-section-${index + 1}`; while (document.getElementById(id)) id += '-'; heading.id = id; }
        sections.push({element:heading,key:hash(heading.id),label});
        const link = document.createElement('a'); link.textContent = label; link.href = '#' + encodeURIComponent(heading.id);
        link.dataset.depth = Number(heading.tagName[1]) > minLevel ? 'sub' : 'top';
        link.addEventListener('click', event => {
          event.preventDefault(); heading.tabIndex = -1; closeTarget = heading; dialog.close();
          heading.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
          heading.focus({preventScroll:true}); history.replaceState(null, '', link.hash); interacted = true;
        }); toc.append(link);
        // A heading link shares only the public article title and an anchor, never body text.
        const anchor = document.createElement('button'); anchor.type = 'button'; anchor.className = 'reader-section-link'; anchor.textContent = '链接'; anchor.setAttribute('aria-label', `复制章节链接：${label}`);
        anchor.addEventListener('click', () => { const url = new URL(articleURL); url.hash = heading.id; copy(url.href); });
        if (!body.querySelector('#hexo-blog-encrypt')) heading.append(anchor);
      });
      $('reader-toc-open').hidden = !headings.length;
      const stored = progress()[location.pathname];
      if (stored && stored.signature === signature && Number.isFinite(stored.offset) && stored.offset >= 0 && stored.offset <= 1 && sections.some(s => s.key === stored.anchor)) {
        if (!location.hash) {
          pending = stored; $('reader-resume-label').textContent = `上次读到「${sections.find(s => s.key === stored.anchor).label}」`;
          $('reader-resume').hidden = false;
        }
      } else if (stored) forget();
      enhanceContent(); updateActive();
    }
    $('reader-continue').addEventListener('click', () => { const position = pending; pending = null; $('reader-resume').hidden = true; if (position) restore(position); interacted = true; });
    $('reader-dismiss').addEventListener('click', () => { pending = null; $('reader-resume').hidden = true; forget(); });
    for (const name of ['wheel','touchmove']) window.addEventListener(name, () => { interacted = true; }, {passive:true});
    window.addEventListener('keydown', event => { if (['PageDown','PageUp','ArrowDown','ArrowUp','End','Home',' '].includes(event.key) && !event.target.closest('input,textarea,select,dialog')) interacted = true; });
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(updateActive); clearTimeout(saveTimer); saveTimer = setTimeout(save, 700); }, {passive:true});
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    window.addEventListener('hexo-blog-decrypt', initialize);
    initialize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0));
  else boot();
})();

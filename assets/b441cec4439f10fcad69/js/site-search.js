(function () {
  'use strict';
  let highlightTimer;
  function locatePassage() {
    if (!location.hash.startsWith('#search-hit=')) return;
    let id;
    try { id = decodeURIComponent(location.hash.slice(12)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !target.matches('.post-body [data-search-passage]') || document.getElementById('hexo-blog-encrypt')) return;
    document.querySelectorAll('.search-passage-hit').forEach(node => node.classList.remove('search-passage-hit'));
    target.classList.add('search-passage-hit');
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => target.classList.remove('search-passage-hit'), 4500);
  }
  // Wait for page images to settle only when an explicit match link was followed.
  if (document.readyState === 'complete') locatePassage();
  else window.addEventListener('load', locatePassage, { once: true });
  window.addEventListener('hashchange', locatePassage);
  const dialog = document.getElementById('site-search');
  if (!dialog) return;
  const input = document.getElementById('search-query');
  const results = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const retry = document.getElementById('search-retry');
  const actionSection = document.getElementById('search-actions');
  const actionList = document.getElementById('search-action-list');
  const actionStatus = document.getElementById('search-action-status');
  const normalize = text => text.trim().toLowerCase().replace(/\s+/g, ' ');
  const actions = [...dialog.querySelectorAll('[data-search-action]')].map(node => ({
    node, aliases: node.dataset.searchKeywords.split(',').map(normalize)
  }));
  let entries, request, timer, opener, loadError = '', composing = false;
  let randomRequest, randomBusy = false, randomRun = 0;
  function sameOriginURL(value) {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null;
    } catch { return null; }
  }
  function notice(text) {
    actionStatus.textContent = text;
    actionStatus.hidden = !text;
  }
  function renderActions() {
    const query = normalize(input.value), words = query.split(' ').filter(Boolean);
    const appearance = window.SoyoAppearance;
    const matches = [];
    for (const action of actions) {
      const {node, aliases} = action;
      const name = node.dataset.searchAction;
      const available = node.dataset.searchMode ? Boolean(appearance?.setMode) :
        name === 'reset' ? Boolean(appearance?.reset) :
        name === 'appearance' ? Boolean(appearance && document.querySelector('[data-appearance-open]')) : true;
      const defaultMode = node.dataset.searchMode && node.dataset.searchMode !== 'system' && node.dataset.searchMode !== document.documentElement.dataset.theme;
      const score = query ? (aliases.includes(query) ? 3 : aliases.some(alias => alias.startsWith(query)) ? 2 : words.every(word => aliases.some(alias => alias.includes(word))) ? 1 : 0) : 1;
      node.hidden = !available || !score || (!query && !node.hasAttribute('data-search-default') && !defaultMode);
      if (node.dataset.searchMode) node.querySelector('.search-action-kind').textContent = appearance?.get?.()?.mode === node.dataset.searchMode ? '当前' : '切换';
      if (!node.hidden) matches.push({...action, score});
    }
    matches.sort((a,b) => b.score - a.score);
    // Keep native links and buttons; no navigation interception or custom roles.
    for (const {node} of matches) actionList.append(node);
    actionSection.hidden = !matches.length;
    return matches;
  }
  function pathKey(url) {
    try { return decodeURI(new URL(url, location.href).pathname).replace(/\/+$/, '').toLowerCase(); }
    catch { return ''; }
  }
  async function randomArticle(button) {
    if (randomBusy) return;
    randomBusy = true;
    const run = ++randomRun;
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    notice('正在找一篇公开文章…');
    try {
      if (!randomRequest) randomRequest = fetch(dialog.dataset.randomIndex).then(response => {
        if (!response.ok) throw new Error('Random index unavailable');
        return response.json();
      }).then(data => {
        if (!Array.isArray(data.urls)) throw new Error('Invalid random index');
        return [...new Set(data.urls.filter(value => typeof value === 'string').map(value => {
          const url = sameOriginURL(value);
          return url && !url.search && !url.hash ? url.href : null;
        }).filter(Boolean))];
      }).catch(error => { randomRequest = null; throw error; });
      const choices = (await randomRequest).filter(url => pathKey(url) !== pathKey(location.href));
      // Closing search cancels the action, even if its request finishes later.
      if (!dialog.open || run !== randomRun) return;
      if (!choices.length) { notice('暂时没有其他公开文章，可以浏览分类或归档。'); return; }
      dialog.close();
      location.assign(choices[Math.floor(Math.random() * choices.length)]);
    } catch {
      if (dialog.open && run === randomRun) notice('随机文章暂时未加载，请再试一次。');
    } finally {
      randomBusy = false;
      button.disabled = false; button.removeAttribute('aria-busy');
    }
  }
  actions.forEach(({node}) => {
    if (node.tagName === 'A') return;
    node.addEventListener('click', () => {
      if (node.dataset.searchAction === 'random') { randomArticle(node); return; }
      input.value = '';
      dialog.close();
      if (node.dataset.searchMode) window.SoyoAppearance.setMode(node.dataset.searchMode);
      else if (node.dataset.searchAction === 'reset') window.SoyoAppearance.reset();
      else if (node.dataset.searchAction === 'appearance') document.querySelector('[data-appearance-open]').click();
    });
  });
  function highlight(text, words) {
    const fragment = document.createDocumentFragment();
    const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!escaped.length) { fragment.append(text); return fragment; }
    const regex = new RegExp(escaped.join('|'), 'gi');
    let offset = 0;
    for (const match of text.matchAll(regex)) {
      fragment.append(text.slice(offset, match.index));
      const mark = document.createElement('mark'); mark.textContent = match[0]; fragment.append(mark);
      offset = match.index + match[0].length;
    }
    fragment.append(text.slice(offset));
    return fragment;
  }
  function render() {
    const shortcuts = renderActions();
    results.replaceChildren();
    const words = [...new Set(input.value.trim().toLowerCase().split(/\s+/).filter(Boolean))];
    retry.hidden = !words.length || !loadError;
    if (!words.length) { status.textContent = '输入关键词查找文章，也可以选择快捷操作。'; return; }
    const prefix = shortcuts.length ? `${shortcuts.length} 项快捷操作 · ` : '';
    if (!entries) { status.textContent = prefix + (loadError || '正在查找文章…'); return; }
    const matches = entries.map(entry => {
      const title = entry.title.toLowerCase(), body = entry.content.toLowerCase();
      const hits = words.filter(word => title.includes(word) || body.includes(word)).length;
      return { entry, score: hits * 10 + words.filter(word => title.includes(word)).length * 5 + (hits === words.length ? 100 : 0) };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    status.textContent = prefix + (matches.length ? `找到 ${matches.length} 篇文章${matches.length > 30 ? '，显示最相关的 30 篇' : ''}` : '没有找到相关文章。试试缩短关键词，或浏览分类与归档。');
    for (const { entry } of matches.slice(0, 30)) {
      const link = document.createElement('a');
      const url = sameOriginURL(entry.url);
      if (!url) continue;
      link.href = url.href; link.className = 'search-result';
      const title = document.createElement('strong'); title.append(highlight(entry.title, words));
      const meta = document.createElement('small'); meta.textContent = [...entry.categories, entry.date, entry.locked ? '加密文章' : ''].filter(Boolean).join(' · ');
      const excerpt = document.createElement('p');
      const body = entry.content.toLowerCase();
      const positions = words.map(word => body.indexOf(word)).filter(index => index >= 0);
      const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 36);
      const snippet = entry.content ? `${start ? '…' : ''}${entry.content.slice(start, start + 150)}${entry.content.length > start + 150 ? '…' : ''}` : '此文章需要密码，搜索仅展示公开信息。';
      excerpt.append(highlight(snippet, words));
      link.append(title, meta, excerpt); results.append(link);
      if (!entry.locked && Array.isArray(entry.passages)) {
        const hits = entry.passages.filter(p => typeof p.id === 'string' && typeof p.text === 'string')
          .map(p => ({ p, score: words.filter(word => p.text.toLowerCase().includes(word)).length }))
          .filter(hit => hit.score).sort((a, b) => b.score - a.score);
        if (hits.length) {
          const group = document.createElement('details'); group.className = 'search-passages';
          const summary = document.createElement('summary'); summary.textContent = `查看匹配位置（${hits.length} 处）`;
          group.append(summary);
          for (const { p } of hits) {
            const match = document.createElement('a');
            const hitURL = new URL(url); hitURL.hash = 'search-hit=' + encodeURIComponent(p.id);
            match.href = hitURL.href;
            const lower = p.text.toLowerCase();
            const offsets = words.map(word => lower.indexOf(word)).filter(pos => pos >= 0);
            const from = Math.max(0, Math.min(...offsets) - 28);
            match.append(highlight(`${from ? '…' : ''}${p.text.slice(from, from + 130)}${p.text.length > from + 130 ? '…' : ''}`, words));
            group.append(match);
          }
          results.append(group);
        }
      }
    }
  }
  async function load() {
    if (entries) { render(); return; }
    if (request) return request;
    loadError = ''; retry.hidden = true;
    request = (async () => {
      try {
        const response = await fetch(dialog.dataset.indexUrl);
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (!Array.isArray(data) || data.some(row => typeof row.title !== 'string' || typeof row.content !== 'string' || typeof row.url !== 'string' || !Array.isArray(row.categories))) throw new Error('Invalid search index');
        entries = data; render();
      } catch { loadError = '搜索数据加载失败，请重试。快捷操作仍可使用。'; render(); }
      finally { request = null; }
    })();
    return request;
  }
  function open() {
    if (dialog.open) { input.focus(); return; }
    if (document.querySelector('dialog[open]')) return;
    opener = document.activeElement;
    notice(''); render();
    dialog.showModal(); document.documentElement.classList.add('search-open'); input.focus();
    if (input.value.trim() && !loadError) load();
  }
  document.querySelectorAll('[data-search-open]').forEach(button => button.addEventListener('click', open));
  dialog.querySelector('[data-search-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    ++randomRun; clearTimeout(timer);
    document.documentElement.classList.remove('search-open');
    if (!document.querySelector('dialog[open]')) opener?.focus({preventScroll:true});
  });
  dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
  dialog.querySelector('[data-search-clear]').addEventListener('click', () => { clearTimeout(timer); input.value = ''; notice(''); render(); input.focus(); });
  function changed() {
    clearTimeout(timer); notice(''); render();
    if (input.value.trim()) timer = setTimeout(() => {
      if (dialog.open && !loadError) load();
    }, 120);
  }
  input.addEventListener('input', event => { if (!composing && !event.isComposing) changed(); });
  input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
  input.addEventListener('compositionend', () => { composing = false; changed(); });
  retry.addEventListener('click', load);
  document.addEventListener('keydown', event => {
    if (!event.isComposing && !composing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]:not(#site-search)')) { event.preventDefault(); open(); }
  });
  dialog.addEventListener('keydown', event => {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && event.target === input) {
      if (!input.value.trim()) return;
      render();
      const first = selectable()[0];
      if (first) { event.preventDefault(); first.click(); }
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const links = selectable();
    if (!links.length || (event.target !== input && !links.includes(event.target))) return;
    event.preventDefault(); const index = links.indexOf(document.activeElement);
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : links.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
    links[next].focus();
  });
  function selectable() {
    return [...actionList.querySelectorAll('a,button'), ...results.querySelectorAll('a')]
      .filter(node => !node.disabled && !node.closest('[hidden],details:not([open])'));
  }
  document.addEventListener('soyo-appearance-change', () => { if (dialog.open) renderActions(); });
})();

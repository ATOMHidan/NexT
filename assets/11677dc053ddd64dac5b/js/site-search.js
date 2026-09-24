(function () {
  'use strict';
  const dialog = document.getElementById('site-search');
  if (!dialog) return;
  const input = document.getElementById('search-query');
  const results = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const retry = document.getElementById('search-retry');
  let entries, request, timer, opener;
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
    results.replaceChildren();
    if (!entries) return;
    const words = [...new Set(input.value.trim().toLowerCase().split(/\s+/).filter(Boolean))];
    if (!words.length) { status.textContent = '试试课程名称、技术问题或文章标题。'; return; }
    const matches = entries.map(entry => {
      const title = entry.title.toLowerCase(), body = entry.content.toLowerCase();
      const hits = words.filter(word => title.includes(word) || body.includes(word)).length;
      return { entry, score: hits * 10 + words.filter(word => title.includes(word)).length * 5 + (hits === words.length ? 100 : 0) };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    status.textContent = matches.length ? `找到 ${matches.length} 篇文章${matches.length > 30 ? '，显示最相关的 30 篇' : ''}` : '没有找到相关文章。试试缩短关键词，或浏览分类与归档。';
    for (const { entry } of matches.slice(0, 30)) {
      const link = document.createElement('a');
      const url = new URL(entry.url, location.origin);
      if (url.origin !== location.origin) continue;
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
    }
  }
  async function load() {
    if (entries) { render(); return; }
    if (request) return request;
    retry.hidden = true; status.textContent = '正在加载搜索数据…';
    request = (async () => {
      try {
        const response = await fetch(dialog.dataset.indexUrl);
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (!Array.isArray(data) || data.some(row => typeof row.title !== 'string' || typeof row.content !== 'string' || typeof row.url !== 'string' || !Array.isArray(row.categories))) throw new Error('Invalid search index');
        entries = data; render();
      } catch { status.textContent = '搜索数据加载失败，请重试。'; retry.hidden = false; }
      finally { request = null; }
    })();
    return request;
  }
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    dialog.showModal(); document.documentElement.classList.add('search-open'); input.focus(); load();
  }
  document.querySelectorAll('[data-search-open]').forEach(button => button.addEventListener('click', open));
  dialog.querySelector('[data-search-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.documentElement.classList.remove('search-open'); opener?.focus(); });
  dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
  dialog.querySelector('[data-search-clear]').addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
  retry.addEventListener('click', load);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
  });
  dialog.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const links = [...results.querySelectorAll('a')]; if (!links.length) return;
    event.preventDefault(); const index = links.indexOf(document.activeElement);
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : links.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
    links[next].focus();
  });
})();

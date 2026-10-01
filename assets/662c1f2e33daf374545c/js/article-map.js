(function () {
  'use strict';
  const dataNode = document.getElementById('atlas-data');
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent);
  const stations = [...document.querySelectorAll('.atlas-station')];
  const results = document.getElementById('atlas-results');
  const title = document.getElementById('atlas-result-title');
  const year = document.getElementById('atlas-year');
  const list = document.getElementById('atlas-articles');
  const prev = document.getElementById('atlas-prev');
  const next = document.getElementById('atlas-next');
  let selected = [], page = 0;
  const size = 12;
  function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  }
  function render() {
    const filtered = selected.filter(article => !year.value || article.date.slice(0, 4) === year.value);
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    page = Math.min(page, pages - 1);
    list.replaceChildren();
    for (const article of filtered.slice(page * size, (page + 1) * size)) {
      const detail = element('details', 'atlas-article', '');
      const summary = element('summary', '', '');
      const date = element('time', '', article.date); date.dateTime = article.date;
      summary.append(element('strong', '', article.title), date);
      if (article.locked) summary.append(element('span', 'atlas-lock', '需要密码'));
      const link = element('a', '', article.locked ? '前往解锁文章 →' : '阅读文章 →');
      const url = new URL(article.url, location.origin);
      if (url.origin !== location.origin) continue;
      link.href = url.href;
      detail.append(summary, element('p', 'atlas-preview', article.excerpt || (article.locked ? '这篇文章需要密码，地图仅展示公开信息。' : '打开文章，继续阅读这段记录。')), link);
      list.append(detail);
    }
    document.getElementById('atlas-status').textContent = `${filtered.length} 篇记录 · 点击标题查看摘要`;
    document.getElementById('atlas-page').textContent = `${page + 1} / ${pages}`;
    prev.disabled = page === 0; next.disabled = page + 1 >= pages;
    document.querySelector('.atlas-pagination').hidden = pages <= 1;
  }
  stations.forEach(button => button.addEventListener('click', () => {
    const category = data.categories[Number(button.dataset.category)];
    stations.forEach(node => node.setAttribute('aria-pressed', String(node === button)));
    selected = data.articles.filter(article => article.categories.includes(category.name));
    title.textContent = category.name;
    year.replaceChildren(new Option('全部年份', ''));
    [...new Set(selected.map(article => article.date.slice(0, 4)))].sort().reverse().forEach(value => year.add(new Option(value, value)));
    page = 0; results.hidden = false; document.getElementById('atlas-hint').hidden = true; render();
    title.focus({ preventScroll: true }); results.scrollIntoView({ block: 'start' });
  }));
  year.addEventListener('change', () => { page = 0; render(); });
  function move(delta) { page += delta; render(); title.focus({ preventScroll: true }); results.scrollIntoView({ block: 'start' }); }
  prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
})();

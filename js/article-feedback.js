(function () {
  'use strict';
  const root = document.getElementById('article-feedback');
  if (!root) return;
  const note = root.querySelector('#article-feedback-note');
  const mail = root.querySelector('#article-feedback-mail');
  const status = root.querySelector('#article-feedback-status');
  const fallback = root.querySelector('#article-feedback-fallback');
  const title = root.querySelector('.article-feedback-context strong').textContent.trim();
  const url = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
  url.search = ''; url.hash = '';
  function feedback() {
    const kind = root.querySelector('input:checked').value;
    return `文章：${title}\n链接：${url.href}\n问题类型：${kind}\n\n问题描述：\n${note.value.trim() || '请填写问题所在位置与具体描述。'}`;
  }
  function update() {
    mail.href = `mailto:${root.dataset.email}?subject=${encodeURIComponent('文章勘误：' + title)}&body=${encodeURIComponent(feedback())}`;
    status.textContent = '';
    fallback.hidden = true;
  }
  root.addEventListener('toggle', () => { if (root.open) update(); });
  root.addEventListener('input', update);
  mail.addEventListener('click', update);
  root.querySelector('#article-feedback-copy').addEventListener('click', async () => {
    const text = feedback();
    try {
      await navigator.clipboard.writeText(text);
      fallback.hidden = true;
      status.textContent = '已复制，可粘贴到邮件中发送。';
    } catch {
      fallback.hidden = false;
      const field = fallback.querySelector('textarea');
      field.value = text; field.focus(); field.select();
      status.textContent = '请手动复制反馈内容。';
    }
  });
})();

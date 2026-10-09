(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('article-share-dialog');
  if (!dialog) return;
  // Remove only the retired reading feature's preferences and progress.
  try { localStorage.removeItem('soyo-reading-settings'); localStorage.removeItem('soyo-reading-progress'); } catch {}
  const url = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
  url.hash = ''; url.search = '';
  const title = document.querySelector('.post-title')?.textContent.trim() || document.title;
  function close() { dialog.close(); }
  $('article-share-open').addEventListener('click', () => {
    $('article-share-status').textContent = '';
    $('article-share-fallback').hidden = true;
    $('article-share-native').hidden = !navigator.share;
    const select = $('article-share-heading'); select.replaceChildren();
    const body = document.querySelector('.post-body');
    // Keep private headings out of sharing controls, including after decryption.
    if (body && !body.querySelector('#hexo-blog-encrypt')) {
      for (const heading of body.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')) {
        const option = document.createElement('option'); option.value = heading.id; option.textContent = heading.textContent.trim(); select.append(option);
      }
    }
    $('article-share-section').hidden = !select.options.length;
    dialog.showModal(); document.documentElement.classList.add('article-share-open');
  });
  $('article-share-close').addEventListener('click', close);
  dialog.addEventListener('close', () => { document.documentElement.classList.remove('article-share-open'); $('article-share-open').focus({preventScroll:true}); });
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) close();
  });
  const copyButtons=['article-share-url','article-share-text','article-share-anchor'].map($);
  copyButtons.forEach(button=>{
    const label=button.textContent;
    button.replaceChildren();
    const icon=document.createElement('span');icon.className='copy-state-icon';icon.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.textContent=label;
    button.append(icon,text);button.classList.add('copy-feedback-button');
  });
  let copyTimer;
  async function copy(text, button) {
    if(button.disabled)return;
    button.disabled=true;
    clearTimeout(copyTimer);copyButtons.forEach(node=>node.classList.remove('copy-done'));
    try { await navigator.clipboard.writeText(text); button.classList.add('copy-done');copyTimer=setTimeout(()=>button.classList.remove('copy-done'),2000); $('article-share-status').textContent = '已复制'; $('article-share-fallback').hidden = true; }
    catch {
      $('article-share-status').textContent = '请手动复制'; $('article-share-fallback').hidden = false;
      const field = $('article-share-fallback').querySelector('textarea'); field.value = text; field.focus(); field.select();
    }
    finally { button.disabled=false; }
  }
  $('article-share-url').addEventListener('click', event => copy(url.href,event.currentTarget));
  $('article-share-text').addEventListener('click', event => copy(`${title}\n${url.href}`,event.currentTarget));
  $('article-share-anchor').addEventListener('click', event => { const section = new URL(url); section.hash = $('article-share-heading').value; copy(section.href,event.currentTarget); });
  $('article-share-native').addEventListener('click', async () => {
    try { await navigator.share({title, url:url.href}); }
    catch (error) { if (error.name !== 'AbortError') $('article-share-status').textContent = '系统分享不可用，可以复制链接'; }
  });
})();

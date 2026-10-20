/* Compatible with hexo-blog-encrypt v3 payloads. No password/key persistence. */
(() => {
  'use strict';
  const root = document.getElementById('hexo-blog-encrypt');
  const form = root?.querySelector('.article-unlock-form');
  if (!form) return;
  const input = form.querySelector('input'), button = form.querySelector('button');
  const error = document.getElementById('article-unlock-error');
  const payload = root.querySelector('#hbeData');
  const encrypted = payload.textContent.trim(), signature = payload.dataset.hmacdigest;
  const subtle = window.crypto?.subtle;
  const prefix = '<hbe-prefix></hbe-prefix>';
  let busy = false, composing = false;
  // Discard this page's legacy saved decryption keys without ever reading them.
  try { localStorage.removeItem('hexo-blog-encrypt:#' + location.pathname); } catch {}
  function showError(text, detail) {
    error.replaceChildren(document.createTextNode(text));
    if (detail) { const note = document.createElement('small'); note.textContent = detail; error.append(note); }
    error.hidden = false;
  }
  root.querySelector('[data-unlock-prepare]')?.remove();
  if (!subtle || !window.TextEncoder || !window.TextDecoder) { showError('当前页面暂时无法解锁，请刷新或使用新版浏览器重试。'); return; }
  const encoder = new TextEncoder();
  const bytes = hex => {
    if (!/^(?:[a-f\d]{2})+$/i.test(hex)) throw Error('Invalid encrypted data');
    return Uint8Array.from(hex.match(/../g), pair => parseInt(pair, 16));
  };
  async function decode(password) {
    const material = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
    const base = { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode('hexo-blog-encrypt的作者们都是大帅比!'), iterations: 1024 };
    const [key, hmac, iv] = await Promise.all([
      subtle.deriveKey(base, material, {name:'AES-CBC',length:256}, false, ['decrypt']),
      subtle.deriveKey(base, material, {name:'HMAC',hash:'SHA-256',length:256}, false, ['verify']),
      subtle.deriveBits({...base,salt:encoder.encode('hexo-blog-encrypt是地表最强Hexo加密插件!'),iterations:512}, material, 128)
    ]);
    const plain = await subtle.decrypt({name:'AES-CBC',iv}, key, bytes(encrypted));
    const text = new TextDecoder('utf-8', {fatal:true}).decode(plain);
    if (!text.startsWith(prefix)) throw Error('Incorrect password');
    // Authenticate before inserting any plaintext or executing authored scripts.
    if (!await subtle.verify('HMAC', hmac, bytes(signature), encoder.encode(text))) return null;
    return text.slice(prefix.length);
  }
  function reveal(text) {
    const template = document.createElement('template'); template.innerHTML = text;
    const scripts = [...template.content.querySelectorAll('script')];
    input.value = '';
    root.replaceChildren(template.content);
    root.classList.replace('article-unlock', 'article-unlocked');
    root.removeAttribute('data-wpm'); root.removeAttribute('aria-labelledby');
    root.setAttribute('aria-label', '已解锁的文章正文'); root.tabIndex = -1;
    // Preserve the plugin's support for scripts authored inside an encrypted post.
    for (const old of scripts) {
      const script = document.createElement('script');
      for (const attr of old.attributes) script.setAttribute(attr.name, attr.value);
      if (script.src && !script.hasAttribute('async')) script.async = false;
      script.textContent = old.textContent; old.replaceWith(script);
    }
    const relock = document.createElement('button'); relock.type = 'button'; relock.className = 'article-relock'; relock.textContent = '重新锁定';
    relock.addEventListener('click', () => location.reload()); root.append(relock);
    root.focus({preventScroll:true});
    try { window.NexT?.boot?.refresh?.(); } catch { /* Content remains readable without optional theme refresh. */ }
    window.dispatchEvent(new Event('hexo-blog-decrypt'));
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || composing) return;
    if (!input.value) { input.focus(); return; }
    busy = true; input.readOnly = true; button.disabled = true;
    form.setAttribute('aria-busy', 'true'); button.textContent = '正在解锁…';
    error.hidden = true; input.removeAttribute('aria-invalid');
    let text;
    try { text = await decode(input.value); }
    catch {
      showError('密码不正确，请再试一次。', root.dataset.wpm);
      input.setAttribute('aria-invalid', 'true');
    }
    busy = false; input.readOnly = false; button.disabled = false;
    form.removeAttribute('aria-busy'); button.textContent = '解锁文章 →';
    if (text === null) showError('正文校验失败，请刷新页面后重试。');
    else if (typeof text === 'string') { reveal(text); return; }
    input.focus({preventScroll:true}); input.select();
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault(); });
  input.addEventListener('input', () => { if (!busy) { error.hidden = true; input.removeAttribute('aria-invalid'); } });
  input.value = ''; input.disabled = false; button.disabled = false;
})();

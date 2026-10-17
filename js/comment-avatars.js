/* Local geometric fallbacks for Waline. Loaded only with the comment client. */
(() => {
  'use strict';
  const namespace = 'http://www.w3.org/2000/svg';
  const selector = '.wl-user > img, .wl-avatar img';
  const mounts = new WeakMap();
  const emptyHashes = ['d41d8cd98f00b204e9800998ecf8427e', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'];
  const hash = value => {
    let a = 2166136261, b = 2246822507;
    for (const char of String(value).normalize('NFC')) {
      const code = char.codePointAt(0);
      a = Math.imul(a ^ code, 16777619);
      b = Math.imul(b ^ code, 3266489909);
    }
    a ^= a >>> 16; b ^= b >>> 13;
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  };
  const provider = source => {
    try {
      const url = new URL(source, location.href);
      if (url.protocol !== 'https:' || !/^(?:(?:[\w-]+\.)?gravatar\.com|(?:seccdn\.)?libravatar\.org|(?:cravatar\.cn|weavatar\.com))$/i.test(url.hostname)) return null;
      const fallback = url.searchParams.get('d') || url.searchParams.get('default');
      if (fallback && !/^(?:mm|mp|404|blank|identicon|monsterid|wavatar|retro|robohash|initials|color)$/i.test(fallback)) return null;
      return /^\/avatar\/[a-f\d]{32,64}(?:\.[a-z]+)?\/?$/i.test(url.pathname) ? url : null;
    } catch { return null; }
  };
  const seedFor = record => {
    if (typeof record.user_id === 'string' && record.user_id) return hash('user:' + record.user_id);
    const url = provider(record.avatar);
    const id = url?.pathname.match(/[a-f\d]{32,64}/i)?.[0].toLowerCase();
    if (id && !emptyHashes.includes(id)) return hash('avatar:' + id);
    return hash('nick:' + String(record.nick || '访客').trim());
  };
  function artwork(seed, document) {
    const number = parseInt(seed.slice(0, 8), 16), variant = parseInt(seed.slice(8), 16);
    const shapes = [
      '<circle class="geo-soft" cx="29" cy="32" r="21"/><circle class="geo-ink" cx="38" cy="29" r="16"/><circle class="geo-base" cx="42" cy="26" r="8"/>',
      '<path class="geo-ink" d="M14 54V28a18 18 0 0 1 36 0v26H39V28a7 7 0 0 0-14 0v26Z"/><path class="geo-soft" d="M29 39h7v15h-7Z"/>',
      '<path class="geo-ink" d="M30 30H10a20 20 0 0 1 20-20Zm4 0V10a20 20 0 0 1 20 20Zm0 4h20a20 20 0 0 1-20 20Z"/><path class="geo-soft" d="M30 34v20a20 20 0 0 1-20-20Z"/>',
      '<circle class="geo-soft" cx="32" cy="32" r="23"/><path class="geo-ink" d="M9 32a23 23 0 0 1 46 0Z"/><circle class="geo-accent" cx="32" cy="43" r="8"/>',
      '<path class="geo-soft" d="M10 52V38h14V24h14V10h16v42Z"/><path class="geo-ink" d="M10 52V38h14V24h14v28Z"/>',
      '<path class="geo-soft" d="M8 45 32 9h24L32 45Z"/><path class="geo-ink" d="M8 55 32 19h14L22 55Z"/><circle class="geo-accent" cx="48" cy="47" r="7"/>'
    ];
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'comment-geo-avatar');
    svg.setAttribute('data-tone', String((variant >>> 16) % 3));
    const [x, y] = [[12,12], [32,8], [52,12], [56,32], [52,52], [32,56], [12,52], [8,32]][(variant >>> 4) % 8];
    const accent = [
      `<circle class="geo-accent" cx="${x}" cy="${y}" r="3"/>`,
      `<circle class="geo-line" cx="${x}" cy="${y}" r="4"/>`,
      `<path class="geo-line" d="M${x-4} ${y-2}h8m-8 4h8"/>`,
      `<path class="geo-accent" d="m${x} ${y-4} 4 4-4 4-4-4Z"/>`
    ][(variant >>> 8) % 4];
    // All markup below is constant or numeric, never comment HTML or identity text.
    svg.innerHTML = '<rect class="geo-base" width="64" height="64" rx="16"/>' +
      `<g transform="rotate(${(variant >>> 12) % 4 * 90} 32 32)${variant >>> 24 & 1 ? ' translate(64 0) scale(-1 1)' : ''}">${shapes[number % shapes.length]}</g>` + accent;
    return svg;
  }
  function mount(root, serverURL) {
    if (mounts.has(root)) return mounts.get(root);
    const document = root.ownerDocument, records = new Map(), images = new WeakMap();
    const server = new URL(serverURL, location.href);
    const prefix = server.pathname.replace(/\/$/, '');
    const originalFetch = window.fetch;
    const remember = (url, record) => {
      if (records.size >= 512) records.delete(records.keys().next().value);
      records.set(url, record);
    };
    const prepare = record => {
      if (!record || typeof record !== 'object') return;
      if (Array.isArray(record)) { record.forEach(prepare); return; }
      if (typeof record.nick === 'string' && Object.hasOwn(record, 'avatar')) {
        const seed = seedFor(record), url = provider(record.avatar);
        let local = !record.avatar;
        if (url) {
          // The existing avatar service still serves a user's real photo. A missing
          // photo returns 404 instead of a generic/generated provider default.
          local = emptyHashes.some(id => url.pathname.toLowerCase().includes('/' + id)) || /^(?:y|yes|true|1)$/i.test(url.searchParams.get('f') || url.searchParams.get('forcedefault') || '');
          url.searchParams.delete('default'); url.searchParams.set('d', '404');
          url.hash = 'soyo-geo-' + seed;
          record.avatar = url.href;
        }
        if (local) record.avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>') + '#' + seed;
        if (typeof record.avatar === 'string') {
          try { remember(new URL(record.avatar, location.href).href, { seed, local }); } catch {}
        }
      }
      // Traverse only API collections, never private fields, comment HTML or tokens.
      for (const field of ['data', 'children']) if (record[field]) prepare(record[field]);
    };
    const wrappedFetch = async function(input, init) {
      const response = await originalFetch.call(this, input, init);
      let url;
      try { url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href); } catch { return response; }
      const path = prefix + '/comment';
      if (url.origin !== server.origin || !(url.pathname === path || url.pathname.startsWith(path + '/')) || typeof response.json !== 'function') return response;
      const json = response.json.bind(response);
      response.json = async () => { const data = await json(); prepare(data); return data; };
      return response;
    };
    if (typeof originalFetch === 'function') window.fetch = wrappedFetch;
    const show = (image, state) => {
      if (!state.svg) {
        state.svg = artwork(state.seed, document);
        state.slot = image.closest('.wl-avatar') || image.parentElement;
        state.slot.appendChild(state.svg);
      }
      image.classList.add('comment-geo-source');
      state.slot.classList.add('comment-geo-slot');
    };
    const hide = (image, state) => {
      state.svg?.remove(); state.svg = null;
      image.classList.remove('comment-geo-source');
      state.slot?.classList.remove('comment-geo-slot');
    };
    const process = image => {
      if (!image.matches(selector)) return;
      const source = image.src;
      let state = images.get(image);
      if (state?.source === source) return;
      if (state) hide(image, state);
      const info = records.get(source);
      // Login avatars come from Waline's existing account state, outside comment API.
      // Never rewrite their custom URLs; failed/empty images still get a local fallback.
      const nick = image.closest('.wl-login-info')?.querySelector('.wl-login-nick:not(:has(img))')?.textContent || image.closest('.wl-card-item')?.querySelector('.wl-nick')?.textContent || '访客';
      state = { source, seed: info?.seed || hash('nick:' + nick.trim()), local: info?.local || !image.getAttribute('src'), svg: null };
      images.set(image, state);
      if (state.local || !image.complete || !image.naturalWidth) show(image, state);
    };
    const settle = event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches(selector)) return;
      process(image);
      const state = images.get(image);
      if (event.type === 'error' || state.local || !image.complete || !image.naturalWidth) show(image, state);
      else hide(image, state);
    };
    root.addEventListener('load', settle, true);
    root.addEventListener('error', settle, true);
    const scan = node => {
      if (node.nodeType !== 1) return;
      if (node.matches(selector)) process(node);
      node.querySelectorAll(selector).forEach(process);
    };
    const observer = new MutationObserver(changes => {
      for (const change of changes) {
        if (change.type === 'attributes') process(change.target);
        else change.addedNodes.forEach(scan);
      }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
    scan(root);
    const instance = { destroy() {
      observer.disconnect(); root.removeEventListener('load', settle, true); root.removeEventListener('error', settle, true);
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
      root.querySelectorAll(selector).forEach(image => { const state = images.get(image); if (state) hide(image, state); });
      mounts.delete(root);
    } };
    mounts.set(root, instance);
    return instance;
  }
  window.SoyoCommentAvatars = { mount };
})();

/* Global Waline account entry; no client bundle or API request on page load. */
(function () {
  'use strict';
  function start() {
    const entry = document.querySelector('[data-waline-account]');
    if (!entry) return;
    const login = entry.querySelector('[data-account-login]');
    const menu = entry.querySelector('[data-account-menu]');
    const name = entry.querySelector('[data-account-name]');
    const initial = entry.querySelector('[data-account-initial]');
    const status = entry.querySelector('[data-account-status]');
    const key = 'WALINE_USER';
    const server = new URL(entry.dataset.server);
    let popup = null, closeTimer = null, action = '', current = null;
    const validUser = value => value && typeof value === 'object' &&
      typeof value.token === 'string' && value.token.length > 0 && value.token.length < 8192 &&
      typeof value.objectId === 'string' && value.objectId.length > 0;
    function read() {
      for (const store of ['localStorage', 'sessionStorage']) {
        try { const user = JSON.parse(window[store].getItem(key)); if (validUser(user)) return user; } catch {}
      }
      return null;
    }
    function render(user) {
      current = validUser(user) ? user : null;
      login.hidden = Boolean(current);
      menu.hidden = !current;
      if (!current) { menu.open = false; return; }
      const nick = String(current.display_name || current.nick || '我的账户');
      name.textContent = nick;
      initial.textContent = Array.from(nick)[0] || '我';
      menu.querySelector('summary').setAttribute('aria-label', nick + '，账户菜单');
    }
    function message(text) { status.textContent = text; status.hidden = !text; }
    function theme() {
      const root = document.documentElement, style = getComputedStyle(root);
      const names = ['surface', 'container', 'low', 'primary', 'on-primary', 'tonal', 'on-tonal', 'text', 'muted', 'outline'];
      const shades = names.map(name => {
        let color = style.getPropertyValue('--md-' + name).trim();
        if (/^#[\da-f]{3}$/i.test(color)) color = '#' + [...color.slice(1)].map(c => c + c).join('');
        return color;
      });
      return { theme: root.dataset.theme === 'dark' ? 'dark' : 'light', colors: shades };
    }
    function persist(user) {
      const value = validUser(user) ? JSON.stringify(user) : null;
      let oldValue = null, area;
      try { area = localStorage; oldValue = area.getItem(key); } catch {}
      for (const store of ['localStorage', 'sessionStorage']) {
        try { window[store].removeItem(key); } catch {}
      }
      if (value) {
        try { (user.remember ? localStorage : sessionStorage).setItem(key, value); }
        catch { message('当前浏览器无法保存登录状态，关闭页面后需要重新登录。'); }
      }
      render(user);
      // VueUse (Waline v2) observes this event, including in the same document.
      // It updates the mounted comment form without destroying a typed draft.
      window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue: value, storageArea: area || null }));
      document.dispatchEvent(new CustomEvent('waline-account-change'));
    }
    function stopWatching() { if (closeTimer !== null) clearInterval(closeTimer); closeTimer = null; }
    function open(view = 'login') {
      message('');
      const url = new URL('ui/' + view, server.href.endsWith('/') ? server : server.href + '/');
      const appearance = theme();
      url.searchParams.set('lng', 'zh-CN');
      url.searchParams.set('theme', appearance.theme);
      if (appearance.colors.every(color => /^#[\da-f]{6}$/i.test(color))) {
        url.searchParams.set('colors', appearance.colors.map(color => color.slice(1)).join(','));
      }
      // Waline keeps its own TOKEN on the service origin. After logout, show
      // an email form instead of silently signing in with that cached token.
      if (view === 'login' && !current) url.searchParams.set('soyo_reset', '1');
      const width = Math.min(520, screen.availWidth || innerWidth);
      const height = Math.min(760, screen.availHeight || innerHeight);
      stopWatching();
      action = view;
      popup = window.open(url.href, 'soyo-waline-account', `popup=yes,width=${width},height=${height},left=${Math.max(0, Math.round((screen.availWidth - width) / 2))},top=${Math.max(0, Math.round((screen.availHeight - height) / 2))},scrollbars=yes,resizable=yes`);
      if (!popup) { message('登录窗口被浏览器拦截，请允许弹出窗口后重试。'); return; }
      popup.focus();
      closeTimer = setInterval(() => {
        if (popup?.closed) { stopWatching(); popup = null; render(read()); }
      }, 500);
    }
    window.addEventListener('message', event => {
      if (!popup || event.source !== popup || event.origin !== server.origin) return;
      const payload = event.data;
      if (payload?.type === 'SOYO_AUTH_READY') {
        popup.postMessage({ type: 'SOYO_THEME', data: theme() }, server.origin);
        if (action === 'profile' && current) popup.postMessage({ type: 'TOKEN', data: current.token }, server.origin);
      } else if (payload?.type === 'userInfo' && validUser(payload.data)) {
        persist(payload.data);
        if (action === 'login') { popup.close(); popup = null; stopWatching(); menu.querySelector('summary').focus(); }
      } else if (payload?.type === 'profile' && current && payload.data && typeof payload.data === 'object') {
        const updated = { ...current };
        for (const field of ['display_name', 'url']) if (typeof payload.data[field] === 'string') updated[field] = payload.data[field];
        persist(updated);
      }
    });
    login.addEventListener('click', event => { event.preventDefault(); open(); });
    entry.querySelector('[data-account-profile]').addEventListener('click', () => { menu.open = false; open('profile'); });
    entry.querySelector('[data-account-logout]').addEventListener('click', () => {
      if (popup && !popup.closed) popup.close();
      popup = null; stopWatching(); message(''); persist(null); login.focus();
    });
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('#waline .wl-login-btn, #waline .wl-info > button.wl-btn[type="button"]')) {
        event.preventDefault(); event.stopImmediatePropagation(); open();
      } else if (event.target.closest('#waline .wl-login-nick')) {
        event.preventDefault(); event.stopImmediatePropagation(); if (current) open('profile');
      }
      else if (!entry.contains(event.target)) menu.open = false;
    }, true);
    entry.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
    window.addEventListener('storage', event => { if (event.key === key || event.key === null) render(read()); });
    window.addEventListener('vueuse-storage', event => { if (event.detail?.key === key) render(read()); });
    window.addEventListener('focus', () => render(read()));
    window.addEventListener('pagehide', stopWatching);
    render(read());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

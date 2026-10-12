/* Native, same-origin page transitions. No interception or scroll management. */
(() => {
  'use strict';
  if (!('onpageswap' in window) || !('onpagereveal' in window) || !window.navigation) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'soyo-article-transition';
  let named = [];
  const reset = () => {
    for (const element of named) {
      element.style.viewTransitionName = '';
      if (!element.style.cssText) element.removeAttribute('style');
    }
    named = [];
  };
  const url = value => {
    try {
      const result = new URL(value, location.href);
      if (result.origin !== location.origin || result.hash) return null;
      // Netlify canonicalizes path casing on redirect. Keep query values intact
      // while matching the same article before and after that redirect.
      result.pathname = result.pathname.toLowerCase();
      return result;
    } catch { return null; }
  };
  const visible = element => {
    if (!element || element.closest('[hidden]') || !element.getClientRects().length) return false;
    const rect = element.getBoundingClientRect();
    // Require a substantial visible portion, avoiding snapshots from offscreen.
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth &&
      Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0) >= Math.min(40, rect.height / 2);
  };
  const homeCard = target => [...document.querySelectorAll('.index [data-article-url]')]
    .find(element => url(element.dataset.articleUrl)?.pathname === target.pathname);
  const parts = card => ({cover: card?.querySelector('.article-cover'), title: card?.querySelector('.post-title')});
  const mark = (elements, receipt) => {
    for (const [part, name] of [['cover', 'article-cover'], ['title', 'article-title']]) {
      if (receipt[part]) {
        elements[part].style.viewTransitionName = name;
        named.push(elements[part]);
      }
    }
  };
  const removeReceipt = () => { try { sessionStorage.removeItem(key); } catch {} };
  window.addEventListener('pageswap', event => {
    reset();
    removeReceipt();
    const transition = event.viewTransition, activation = event.activation;
    if (!transition) return;
    const from = url(location.href), to = url(activation?.entry?.url);
    if (reduced.matches || !from || !to || !activation || activation.navigationType === 'reload') {
      transition.skipTransition(); return;
    }
    let card, kind;
    if (document.querySelector('.main-inner.index')) {
      card = homeCard(to); kind = 'open';
    } else if (activation.navigationType === 'traverse') {
      card = document.querySelector('.main-inner.post [data-article-url]'); kind = 'close';
    }
    if (!card) { transition.skipTransition(); return; }
    const article = url(card.dataset.articleUrl), elements = parts(card);
    if (!article) { transition.skipTransition(); return; }
    const receipt = {from: from.href, to: to.href, fromKey: activation.from?.key,
      article: article.href, kind, cover: visible(elements.cover), title: visible(elements.title)};
    if (!receipt.cover && !receipt.title) { transition.skipTransition(); return; }
    // Share the precise source selection with the incoming document. If storage
    // is unavailable, use ordinary navigation rather than a mismatched snapshot.
    try { sessionStorage.setItem(key, JSON.stringify(receipt)); }
    catch { transition.skipTransition(); return; }
    mark(elements, receipt);
    transition.finished.then(reset, reset);
  });
  window.addEventListener('pagereveal', event => {
    reset();
    let receipt;
    try { receipt = JSON.parse(sessionStorage.getItem(key)); } catch {}
    removeReceipt();
    const transition = event.viewTransition, activation = navigation.activation;
    if (!transition) return;
    const from = url(activation?.from?.url), to = url(location.href), article = url(receipt?.article);
    if (reduced.matches || !receipt || !from || !to || !article ||
        receipt.from !== from.href || receipt.to !== to.href ||
        (receipt.fromKey && receipt.fromKey !== activation.from.key) || activation.navigationType === 'reload') {
      transition.skipTransition(); return;
    }
    let card;
    if (receipt.kind === 'open' && document.querySelector('.main-inner.post') && article.pathname === to.pathname) {
      card = document.querySelector('.main-inner.post [data-article-url]');
    } else if (receipt.kind === 'close' && activation.navigationType === 'traverse') {
      card = homeCard(article);
    }
    const elements = parts(card);
    if (!card || (receipt.cover && !visible(elements.cover)) || (receipt.title && !visible(elements.title))) {
      transition.skipTransition(); return;
    }
    mark(elements, receipt);
    // Incoming snapshots are complete at ready; never leave names in bfcache.
    transition.ready.then(reset, reset);
  });
})();

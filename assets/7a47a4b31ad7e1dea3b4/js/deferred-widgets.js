/* global NexT, CONFIG */
document.addEventListener('DOMContentLoaded', () => {
  const music = document.querySelector('[data-music-url]');
  if (music) {
    const audio = music.parentNode.querySelector('audio');
    const status = music.parentNode.querySelector('.music-status');
    const fail = () => {
      audio.hidden = true;
      music.hidden = false;
      music.textContent = '重新播放';
      status.textContent = '播放未成功，请点击重试';
    };
    audio.addEventListener('error', fail);
    audio.addEventListener('playing', () => { status.textContent = ''; });
    music.addEventListener('click', () => {
      status.textContent = '';
      music.hidden = true;
      audio.hidden = false;
      // No src exists before this click, so initial page loading never fetches audio.
      if (!audio.getAttribute('src')) audio.src = music.dataset.musicUrl;
      else if (audio.error) audio.load();
      audio.focus();
      audio.play().catch(fail);
    });
  }

  const comments = document.querySelector('#waline');
  if (comments) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = '加载评论';
    comments.appendChild(button);
    let loading = false;
    const loadComments = async () => {
      if (loading) return;
      loading = true;
      button.disabled = true;
      button.textContent = '评论加载中…';
      const style = document.createElement('link');
      try {
        style.rel = 'stylesheet';
        style.href = CONFIG.waline.cssUrl;
        await Promise.all([
          new Promise((resolve, reject) => {
            style.onload = resolve;
            style.onerror = () => { style.remove(); reject(new Error('Comment stylesheet failed')); };
            document.head.appendChild(style);
          }),
          NexT.utils.getScript(CONFIG.waline.libUrl, { condition: window.Waline })
        ]);
        button.remove();
        window.Waline.init(Object.assign({}, CONFIG.waline, { el: comments }));
      } catch (error) {
        style.remove();
        loading = false;
        button.disabled = false;
        button.textContent = '评论加载失败，点击重试';
        if (!button.isConnected) comments.appendChild(button);
      }
    };
    button.addEventListener('click', loadComments);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          loadComments();
        }
      }, { rootMargin: '200px' });
      observer.observe(comments);
    }
  }

  // The Live2D helper still owns model URLs and init options. Its scripts stay
  // inert inside a template until we explicitly activate them, in source order.
  const activate = async id => {
    const template = document.getElementById(id);
    if (!template) return;
    for (const original of template.content.querySelectorAll('script')) {
      if (original.src) {
        await NexT.utils.getScript(original.src);
      } else {
        const script = document.createElement('script');
        script.textContent = original.textContent;
        document.body.appendChild(script);
      }
    }
    template.remove();
  };
  const startDecorations = () => {
    const run = () => {
      activate('deferred-statistics').catch(console.warn);
      if (window.matchMedia('(min-width: 992px) and (prefers-reduced-motion: no-preference)').matches) {
        activate('deferred-live2d').catch(console.warn);
      }
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 1000);
  };
  if (document.readyState === 'complete') startDecorations();
  else window.addEventListener('load', startDecorations, { once: true });
});

/* global NexT, CONFIG */
document.addEventListener('DOMContentLoaded', () => {
  const music = document.querySelector('[data-music-url]');
  if (music) music.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.title = '网易云音乐播放器';
    frame.width = '100%';
    frame.height = '86';
    frame.frameBorder = '0';
    frame.src = music.dataset.musicUrl;
    music.parentNode.replaceChildren(frame);
  }, { once: true });

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

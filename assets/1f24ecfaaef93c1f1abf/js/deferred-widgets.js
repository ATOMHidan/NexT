/* global NexT, CONFIG */
document.addEventListener('DOMContentLoaded', () => {
  const music = document.querySelector('[data-music-url]');
  if (music) {
    const audio = music.parentNode.querySelector('audio');
    const status = music.parentNode.querySelector('.music-status');
    const controls = music.parentNode.querySelector('.music-controls');
    const toggle = controls.querySelector('.music-toggle');
    const seek = controls.querySelector('.music-seek');
    const time = controls.querySelector('.music-time');
    const volume = controls.querySelector('.music-volume');
    const mute = controls.querySelector('.music-mute');
    const volumeValue = controls.querySelector('.music-volume-value');
    const formatTime = seconds => {
      if (!Number.isFinite(seconds)) return '--:--';
      const value = Math.max(0, Math.floor(seconds));
      return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
    };
    const updateTime = () => {
      const available = Number.isFinite(audio.duration) && audio.duration > 0;
      seek.disabled = !available;
      seek.value = available ? Math.min(100, audio.currentTime / audio.duration * 100) : 0;
      time.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
      seek.setAttribute('aria-valuetext', time.textContent);
    };
    const updatePlayback = () => {
      toggle.textContent = audio.paused ? '播放' : '暂停';
      toggle.setAttribute('aria-label', audio.paused ? '播放音乐' : '暂停音乐');
    };
    const updateVolume = () => {
      const level = audio.muted ? 0 : audio.volume;
      volume.value = level;
      volumeValue.textContent = Math.round(level * 100) + '%';
      mute.setAttribute('aria-pressed', String(audio.muted || audio.volume === 0));
      mute.setAttribute('aria-label', level === 0 ? '取消静音' : '静音');
    };
    const fail = () => {
      controls.hidden = true;
      music.hidden = false;
      music.textContent = '重新播放';
      status.textContent = '播放未成功，请点击重试';
    };
    audio.addEventListener('error', fail);
    ['timeupdate', 'loadedmetadata', 'durationchange', 'ended', 'emptied'].forEach(name => audio.addEventListener(name, updateTime));
    ['play', 'pause', 'ended'].forEach(name => audio.addEventListener(name, updatePlayback));
    audio.addEventListener('volumechange', updateVolume);
    const play = () => audio.play().catch(fail);
    toggle.addEventListener('click', () => { if (audio.paused) play(); else audio.pause(); });
    seek.addEventListener('input', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Number(seek.value) / 100 * audio.duration;
      updateTime();
    });
    volume.addEventListener('input', () => { audio.volume = Number(volume.value); audio.muted = false; updateVolume(); });
    mute.addEventListener('click', () => {
      if (audio.muted || audio.volume === 0) { audio.muted = false; if (audio.volume === 0) audio.volume = 0.5; }
      else audio.muted = true;
      updateVolume();
    });
    audio.addEventListener('playing', () => { status.textContent = ''; });
    music.addEventListener('click', () => {
      status.textContent = '';
      music.hidden = true;
      controls.hidden = false;
      // No src exists before this click, so initial page loading never fetches audio.
      if (!audio.getAttribute('src')) audio.src = music.dataset.musicUrl;
      else if (audio.error) audio.load();
      toggle.focus();
      play();
    });
    updateTime();
    updateVolume();
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
        const options = Object.assign({}, CONFIG.waline, { el: comments });
        if (document.querySelector('[data-question-page]')) {
          options.locale = Object.assign({}, options.locale, {
            placeholder: '你想问什么？可以附上相关文章链接和你尝试过的方法。请勿填写隐私信息。'
          });
        }
        window.Waline.init(options);
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

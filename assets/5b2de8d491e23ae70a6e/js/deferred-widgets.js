/* global NexT, CONFIG */
// The inert SVG template is shared with search; create art only for a real state.
window.SoyoStates = {
  create(kind, title, description) {
    const template = document.getElementById('content-state-template');
    if (!template || !['search', 'comments', 'error'].includes(kind)) return null;
    const panel = template.content.firstElementChild.cloneNode(true);
    panel.querySelector('use').setAttribute('href', '#content-state-' + kind);
    panel.querySelector('.content-state-title').textContent = title;
    panel.querySelector('.content-state-description').textContent = description;
    return panel;
  }
};

function watchCommentStates(root, refreshLabel) {
  let surface;
  const decorate = () => {
    const empty = surface.querySelector(':scope > .wl-empty');
    if (empty && !empty.querySelector('.content-state')) {
      const panel = window.SoyoStates.create('comments', '还没有评论', '第一段对话，从你的留言开始。');
      if (panel) empty.replaceChildren(panel);
    }
    const operation = surface.querySelector(':scope > .wl-operation');
    // A load-more button shares this container. Keep its normal presentation.
    if (operation?.querySelector('button')?.textContent === refreshLabel && !operation.querySelector('.content-state')) {
      const panel = window.SoyoStates.create('error', '评论暂时没能加载', '可以重试一下，你已输入的内容会留在这里。');
      if (panel) { panel.setAttribute('role', 'status'); operation.prepend(panel); }
    }
  };
  const observer = new MutationObserver(decorate);
  const connect = () => {
    const next = root.querySelector('[data-waline]');
    if (!next || next === surface) return;
    observer.disconnect(); surface = next;
    // Observe only state switches at the client root, never the editor subtree.
    observer.observe(surface, { childList: true });
    decorate();
  };
  new MutationObserver(connect).observe(root, { childList: true });
  connect();
}

document.addEventListener('DOMContentLoaded', () => {
  const music = document.querySelector('[data-music-url]');
  if (music) {
    // Pin only when the entire sidebar fits. Short windows use page scrolling,
    // with no negative offset or nested sidebar scroll area.
    const sidebar = music.closest('.sidebar');
    if (sidebar && 'ResizeObserver' in window) {
      const fit = () => sidebar.classList.toggle('sidebar-fits', innerWidth >= 992 && sidebar.offsetHeight <= innerHeight - 96);
      new ResizeObserver(fit).observe(sidebar);
      window.addEventListener('resize', fit);
      fit();
    }
    const slot = music.closest('.music-player-slot');
    const audio = slot.querySelector('audio');
    const status = slot.querySelector('.music-status');
    const controls = slot.querySelector('.music-controls');
    const toggle = controls.querySelector('.music-toggle');
    const seek = controls.querySelector('.music-seek');
    const time = controls.querySelector('.music-time');
    const volume = controls.querySelector('.music-volume');
    const mute = controls.querySelector('.music-mute');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const visualUnavailable = '可视化暂不可用，音乐仍可播放';
    let graph, graphUnavailable = false, visualRequest, playFailed = false;
    // Resume inside the playback gesture. Only route audio into Web Audio after
    // resume succeeds; an unavailable/suspended context cannot swallow playback.
    const prepareGraph = () => {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context || graphUnavailable || reduced.matches) return;
      try {
        if (!graph) {
          const context = new Context();
          graph = { context, source: null, analyser: null };
          context.addEventListener('statechange', () => slot.dispatchEvent(new Event('soyo-music-graph')));
        }
        graph.context.resume().then(() => {
          if (graph.source || graphUnavailable || graph.context.state !== 'running') return;
          // Local files are same-origin. A future remote URL keeps native playback.
          if (new URL(audio.currentSrc || audio.src, location.href).origin !== location.origin) return;
          const analyser = graph.context.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.65;
          const source = graph.context.createMediaElementSource(audio);
          source.connect(graph.context.destination);
          graph.source = source;
          source.connect(analyser);
          graph.analyser = analyser;
          slot.dispatchEvent(new Event('soyo-music-graph'));
        }).catch(() => { /* Native media playback remains available. Retry on the next gesture. */ });
      } catch (error) { graphUnavailable = true; }
    };
    const loadVisual = () => {
      if (visualRequest) return visualRequest;
      const script = document.createElement('script');
      script.src = slot.dataset.visualEngine;
      visualRequest = new Promise((resolve, reject) => {
        script.onload = () => window.SoyoMusicVisual ? resolve(window.SoyoMusicVisual) : reject(new Error('Visual module unavailable'));
        script.onerror = () => reject(new Error('Visual module unavailable'));
        document.head.appendChild(script);
      }).then(module => {
        module.mount({ slot, audio, getGraph: () => graph });
        if (status.textContent === visualUnavailable) status.textContent = '';
      }).catch(() => {
        script.remove(); visualRequest = null;
        if (!audio.error && !status.textContent) status.textContent = visualUnavailable;
      });
      return visualRequest;
    };
    const formatTime = seconds => {
      if (!Number.isFinite(seconds)) return '--:--';
      const value = Math.max(0, Math.floor(seconds));
      return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
    };
    const updateTime = () => {
      const available = Number.isFinite(audio.duration) && audio.duration > 0;
      seek.disabled = !available;
      seek.value = available ? Math.min(100, audio.currentTime / audio.duration * 100) : 0;
      time.textContent = formatTime(audio.currentTime) + ' / ' + (available ? formatTime(audio.duration) : '—');
      seek.setAttribute('aria-valuetext', time.textContent);
      seek.style.setProperty('--range-progress', seek.value + '%');
    };
    const updatePlayback = () => {
      toggle.classList.toggle('is-playing', !playFailed && !audio.paused && !audio.ended);
      const label = playFailed ? '重新播放音乐' : audio.paused ? '播放音乐' : '暂停音乐';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    };
    const updateVolume = () => {
      const level = audio.muted ? 0 : audio.volume;
      volume.value = level;
      const percentage = Math.round(level * 100) + '%';
      volume.setAttribute('aria-valuetext', percentage);
      volume.title = '音量 ' + percentage;
      volume.style.setProperty('--range-progress', percentage);
      mute.classList.toggle('is-muted', level === 0);
      mute.setAttribute('aria-pressed', String(audio.muted || audio.volume === 0));
      mute.setAttribute('aria-label', level === 0 ? '取消静音' : '静音');
      mute.title = mute.getAttribute('aria-label');
    };
    const fail = () => {
      controls.classList.remove('music-active');
      playFailed = true;
      seek.disabled = true;
      updatePlayback();
      status.textContent = '播放未成功，请点击重试';
    };
    audio.addEventListener('error', fail);
    ['timeupdate', 'loadedmetadata', 'durationchange', 'ended', 'emptied'].forEach(name => audio.addEventListener(name, updateTime));
    ['play', 'pause', 'ended'].forEach(name => audio.addEventListener(name, updatePlayback));
    audio.addEventListener('volumechange', updateVolume);
    const play = () => {
      status.textContent = '';
      playFailed = false;
      // Controls have their final height from the first paint. Only this gesture
      // attaches the audio URL; no media is fetched merely to display controls.
      if (!audio.getAttribute('src')) audio.src = music.dataset.musicUrl;
      else if (audio.error) audio.load();
      updatePlayback();
      prepareGraph();
      audio.play().catch(fail);
      loadVisual();
    };
    toggle.addEventListener('click', () => { if (audio.paused || playFailed) play(); else audio.pause(); });
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
    audio.addEventListener('playing', () => { if (status.textContent !== visualUnavailable) status.textContent = ''; controls.classList.add('music-active'); });
    ['pause','ended','waiting','stalled','emptied'].forEach(name=>audio.addEventListener(name,()=>controls.classList.remove('music-active')));
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
    let loading = false, failure;
    const loadComments = async () => {
      if (loading) return;
      loading = true;
      failure?.remove(); failure = null;
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
          NexT.utils.getScript(CONFIG.waline.libUrl, { condition: window.Waline }),
          // An unavailable decorative module must never prevent reading/replying.
          NexT.utils.getScript(CONFIG.waline.avatarLibUrl, { condition: window.SoyoCommentAvatars }).catch(() => {})
        ]);
        button.remove();
        const options = Object.assign({}, CONFIG.waline, { el: comments });
        options.locale = Object.assign({}, options.locale, { refresh: '重新加载评论' });
        if (document.querySelector('[data-question-page]')) {
          options.locale = Object.assign({}, options.locale, {
            placeholder: '你想问什么？可以附上相关文章链接和你尝试过的方法。请勿填写隐私信息。'
          });
        }
        try { window.SoyoCommentAvatars?.mount(comments, options.serverURL); } catch { /* Comments work without decorative fallbacks. */ }
        try { window.SoyoCommentNote?.mount(comments); } catch { /* The native editor remains usable without presentation. */ }
        window.Waline.init(options);
        try { watchCommentStates(comments, options.locale.refresh); } catch { /* Decoration cannot block comments. */ }
      } catch (error) {
        style.remove();
        loading = false;
        button.disabled = false;
        button.textContent = '评论加载失败，点击重试';
        failure = window.SoyoStates.create('error', '评论暂时没能加载', '连接没有准备好，请再试一次。');
        if (failure) { failure.setAttribute('role', 'status'); comments.prepend(failure); }
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
  // Statistics must not wait for slow images or other third-party resources.
  const statistics = document.querySelector('.busuanzi-count');
  const statisticsStatus = statistics && statistics.querySelector('[data-statistics-status]');
  if (document.getElementById('deferred-statistics')) {
    const startStatistics = () => {
      let timeout;
      const counters = [...document.querySelectorAll('[data-statistic]')];
      const validCount = value => value && /^\d+$/.test(value.textContent.trim());
      const hasCounts = () => statistics && [...statistics.querySelectorAll('[id^="busuanzi_value_site_"]')]
        .some(validCount);
      const updateStatus = () => {
        // Own the presentation: the vendor's callback error handler can hide
        // its containers even after it has successfully filled the numbers.
        counters.forEach(counter => {
          counter.hidden = !validCount(counter.querySelector('[id^="busuanzi_value_"]'));
        });
        if (!hasCounts()) return;
        if (statisticsStatus) statisticsStatus.hidden = true;
        clearTimeout(timeout);
      };
      const unavailable = () => {
        if (hasCounts()) { updateStatus(); return; }
        if (statisticsStatus) statisticsStatus.textContent = '访客统计暂不可用';
      };
      const observer = new MutationObserver(updateStatus);
      counters.forEach(counter => {
        const value = counter.querySelector('[id^="busuanzi_value_"]');
        if (value) observer.observe(value, { childList: true, subtree: true, characterData: true });
      });
      if (statisticsStatus) timeout = setTimeout(unavailable, 12000);
      activate('deferred-statistics').then(updateStatus).catch(unavailable);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(startStatistics, { timeout: 1500 });
    else setTimeout(startStatistics, 0);
  }
  const startDecorations = () => {
    const run = () => {
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

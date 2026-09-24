(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const input = $('secret'), copy = $('copy'), code = $('code');
  let config = null, revision = 0, timer = null, slot = -1, current = '', toastTimer;
  function toast(message) {
    $('snackbar').textContent = message;
    $('snackbar').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('snackbar').classList.remove('visible'), 2600);
  }
  function stop() {
    revision++;
    config = null;
    current = '';
    slot = -1;
    clearTimeout(timer);
    copy.disabled = true;
    code.textContent = '••• •••';
    $('result-label').textContent = '准备就绪';
    $('countdown').textContent = '输入密钥后开始生成';
    $('progress').style.transform = 'scaleX(0)';
    $('parameters').textContent = 'TOTP · 默认 6 位 · 30 秒';
    $('generate').disabled = false;
    $('generate').removeAttribute('aria-busy');
  }
  function fail(message) {
    stop();
    $('input-error').textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }
  async function tick() {
    clearTimeout(timer);
    if (!config || document.hidden) return;
    const active = config, run = revision;
    const now = Date.now(), nextSlot = Math.floor(now / 1000 / active.period);
    const remaining = active.period - (now / 1000 % active.period);
    $('countdown').textContent = `距离更新还有 ${Math.ceil(remaining)} 秒`;
    $('progress').style.transform = `scaleX(${remaining / active.period})`;
    if (slot !== nextSlot) {
      copy.disabled = true;
      try {
        const next = await Totp.generate(active, now);
        if (run !== revision) return;
        // If calculation crossed the time boundary, recompute before displaying.
        if (Math.floor(Date.now() / 1000 / active.period) !== nextSlot) { timer = setTimeout(tick, 0); return; }
        current = next;
        slot = nextSlot;
        code.textContent = `${next.slice(0, next.length / 2)} ${next.slice(next.length / 2)}`;
        copy.disabled = false;
      } catch { if (run === revision) fail('生成失败，请检查设备时间和浏览器支持后重试。'); return; }
    }
    if (run === revision) timer = setTimeout(tick, 250);
  }
  $('totp-form').addEventListener('submit', async event => {
    event.preventDefault();
    stop();
    $('input-error').textContent = '';
    input.removeAttribute('aria-invalid');
    const run = revision;
    $('generate').disabled = true;
    $('generate').setAttribute('aria-busy', 'true');
    try {
      const prepared = await Totp.prepare(input.value);
      if (run !== revision) return;
      config = prepared;
      $('result-label').textContent = config.label || '当前验证码';
      $('parameters').textContent = `${config.algorithm} · ${config.digits} 位 · ${config.period} 秒`;
      await tick();
    } catch (error) { if (run === revision) fail(error.message); }
    finally { if (run === revision) { $('generate').disabled = false; $('generate').removeAttribute('aria-busy'); } }
  });
  input.addEventListener('input', () => { stop(); $('input-error').textContent = ''; input.removeAttribute('aria-invalid'); });
  $('reveal').addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('reveal').textContent = show ? '隐藏' : '显示';
    $('reveal').setAttribute('aria-pressed', String(show));
  });
  function clear() {
    stop();
    input.value = '';
    input.type = 'password';
    input.removeAttribute('aria-invalid');
    $('reveal').textContent = '显示';
    $('reveal').setAttribute('aria-pressed', 'false');
    $('input-error').textContent = '';
    clearTimeout(toastTimer);
    $('snackbar').textContent = '';
    $('snackbar').classList.remove('visible');
  }
  $('clear').addEventListener('click', () => { clear(); input.focus(); });
  copy.addEventListener('click', async () => {
    if (!config || !current) return;
    if (slot !== Math.floor(Date.now() / 1000 / config.period)) { await tick(); toast('验证码已更新，请重新复制'); return; }
    const run = revision;
    try { await navigator.clipboard.writeText(current); if (run === revision) toast('验证码已复制'); }
    catch { if (run === revision) toast('无法访问剪贴板，请选择上方数字手动复制'); }
  });
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) tick(); });
  // Clear before a page enters the browser's back/forward cache, too.
  window.addEventListener('pagehide', clear);
  window.addEventListener('pageshow', event => { if (event.persisted) clear(); });
  clear();
})();

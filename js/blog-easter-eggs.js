(function () {
  'use strict';
  const star = document.querySelector('.blog-star');
  if (star) {
    const trigger = star.querySelector('.blog-star-trigger');
    const bubble = star.querySelector('.blog-star-bubble');
    const lines = ['有什么事吗？', '这里没有隐藏的课程答案。', '……真的没有。', '好吧，你发现了一个正在摸鱼的博主。'];
    let step = -1;
    function close(restoreFocus) {
      bubble.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      star.classList.remove('blog-star-finished');
      step = -1;
      if (restoreFocus) trigger.focus({preventScroll: true});
    }
    trigger.addEventListener('click', () => {
      if (step === lines.length - 1) { close(false); return; }
      step++;
      bubble.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      bubble.querySelector('p').textContent = lines[step];
      bubble.querySelector('small').textContent = step === lines.length - 1 ? '再点一下星标，收起对白' : '再点一下星标，继续聊聊';
      star.classList.toggle('blog-star-finished', step === lines.length - 1);
    });
    star.querySelector('.blog-star-close').addEventListener('click', () => close(true));
    document.addEventListener('click', event => { if (!bubble.hidden && !star.contains(event.target)) close(false); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !bubble.hidden) close(star.contains(document.activeElement)); });
  }
  const dialog = document.getElementById('blog-guide-dialog');
  if (!dialog) return;
  const opener = document.getElementById('blog-guide-open');
  const ask = document.getElementById('blog-guide-ask');
  const reply = document.getElementById('blog-guide-reply');
  opener.addEventListener('click', () => {
    dialog.classList.remove('blog-guide-answered');
    reply.hidden = true;
    ask.hidden = false;
    dialog.showModal();
  });
  function close() { dialog.close(); }
  document.getElementById('blog-guide-close').addEventListener('click', close);
  document.getElementById('blog-guide-ok').addEventListener('click', close);
  ask.addEventListener('click', () => {
    dialog.classList.add('blog-guide-answered');
    reply.hidden = false;
    ask.hidden = true;
    document.getElementById('blog-guide-ok').focus({preventScroll: true});
  });
  dialog.addEventListener('close', () => opener.focus({preventScroll: true}));
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) close();
  });
})();

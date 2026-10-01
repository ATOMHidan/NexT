(function () {
  'use strict';
  function revealAnswer() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const answer = document.getElementById(id);
    if (answer && answer.matches('.ask-page details')) {
      answer.open = true;
      answer.scrollIntoView({ block: 'start' });
    }
  }
  revealAnswer();
  window.addEventListener('hashchange', revealAnswer);
})();

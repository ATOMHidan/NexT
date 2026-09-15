/* global Pace */

Pace.options.restartOnPushState = false;
// Keep background requests from restarting the page-loading indicator.
Pace.options.restartOnRequestAfter = false;

document.addEventListener('pjax:send', () => {
  Pace.restart();
});

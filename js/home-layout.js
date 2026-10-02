(() => {
  'use strict';
  const dialog=document.getElementById('home-layout-dialog'), api=window.SoyoHomeLayout;
  if(!dialog || !api) return;
  let opener;
  function sync(){const state=api.get();dialog.querySelectorAll('[data-home-option]').forEach(select=>select.value=state[select.dataset.homeOption]);
    // Match DOM focus order to the visual order, whose CSS was applied before paint.
    const main=document.querySelector('.main-inner.index'),welcome=main.querySelector('.home-welcome'),posts=main.querySelector('#home-posts');
    if(welcome && posts) { if(state.mainOrder==='posts') posts.after(welcome); else posts.before(welcome); }
    const profile=document.querySelector('.sidebar-profile'),music=document.querySelector('.sidebar-music-player');
    if(profile&&music) {if(state.sideOrder==='music') profile.before(music); else (document.querySelector('.sidebar-blogroll') || profile).after(music);}
  }
  function open(){if(dialog.open)return;opener=document.activeElement;sync();dialog.showModal();}
  document.querySelector('.home-layout-entry')?.addEventListener('click',event=>{event.preventDefault();open();});
  dialog.querySelectorAll('[data-home-option]').forEach(select=>select.addEventListener('change',()=>api.set({...api.get(),[select.dataset.homeOption]:select.value})));
  dialog.querySelectorAll('[data-layout-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  dialog.querySelector('[data-layout-reset]').addEventListener('click',()=>api.reset());
  dialog.addEventListener('close',()=>{opener?.focus();if(location.hash==='#customize-home')history.replaceState(null,'',location.pathname+location.search);});
  document.addEventListener('home-layout-change',sync);sync();
  if(location.hash==='#customize-home')open();
  window.addEventListener('hashchange',()=>{if(location.hash==='#customize-home')open();});
})();

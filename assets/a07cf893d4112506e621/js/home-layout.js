(() => {
  'use strict';
  const dialog=document.getElementById('home-layout-dialog'), api=window.SoyoHomeLayout;
  if(!dialog || !api) return;
  let opener;
  function sync(){const state=api.get();dialog.querySelectorAll('[data-home-option]').forEach(input=>{
    input.checked=input.value===state[input.dataset.homeOption];
    if(input.checked) input.closest('.layout-choice').querySelector('[data-choice-value]').textContent=input.nextElementSibling.textContent;
  });
    // Match DOM focus order to the visual order, whose CSS was applied before paint.
    const main=document.querySelector('.main-inner.index'),welcome=main.querySelector('.home-welcome'),posts=main.querySelector('#home-posts');
    if(welcome && posts) { if(state.mainOrder==='posts') posts.after(welcome); else posts.before(welcome); }
    const profile=document.querySelector('.sidebar-profile'),music=document.querySelector('.sidebar-music-player');
    if(profile&&music) {if(state.sideOrder==='music') profile.before(music); else (document.querySelector('.sidebar-blogroll') || profile).after(music);}
  }
  function open(){if(dialog.open)return;opener=document.activeElement;sync();dialog.showModal();}
  document.querySelector('.home-layout-entry')?.addEventListener('click',event=>{event.preventDefault();open();});
  dialog.querySelectorAll('[data-home-option]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)api.set({...api.get(),[input.dataset.homeOption]:input.value});}));
  const choices=[...dialog.querySelectorAll('.layout-choice')];
  choices.forEach(choice=>choice.addEventListener('toggle',()=>{
    if(choice.open)choices.forEach(other=>{if(other!==choice)other.open=false;});
  }));
  dialog.addEventListener('cancel',event=>{
    const expanded=choices.find(choice=>choice.open);
    if(expanded){event.preventDefault();expanded.open=false;expanded.querySelector('summary').focus();}
  });
  dialog.querySelectorAll('[data-layout-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  dialog.querySelector('[data-layout-reset]').addEventListener('click',()=>api.reset());
  dialog.addEventListener('close',()=>{choices.forEach(choice=>choice.open=false);opener?.focus();if(location.hash==='#customize-home')history.replaceState(null,'',location.pathname+location.search);});
  document.addEventListener('home-layout-change',sync);sync();
  if(location.hash==='#customize-home')open();
  window.addEventListener('hashchange',()=>{if(location.hash==='#customize-home')open();});
})();

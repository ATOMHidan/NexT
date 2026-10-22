/* Annual records: twelve tracks at most, no playback, polling or storage. */
(() => {
  'use strict';
  const root = document.querySelector('.archive-records');
  const payload = document.getElementById('archive-record-data');
  if (!root || !payload) return;
  let model;
  try { model = JSON.parse(payload.textContent); } catch { return; }
  const catalog = model.catalog;
  if (!Array.isArray(catalog) || !catalog.length || !model.initial?.articles?.length) return;
  const $ = selector => root.querySelector(selector);
  const local = value => { try { const u=new URL(value,location.href); return u.origin===location.origin && /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
  // Only build-generated SVG shapes enter these two decorative containers.
  function artwork(target, markup) {
    const t = document.createElement('template'); t.innerHTML = String(markup || '');
    const tags=new Set(['DIV','svg','g','path','circle','rect','ellipse','line','polyline','polygon']);
    if (!t.content.firstElementChild || [...t.content.querySelectorAll('*')].some(e => !tags.has(e.tagName) || [...e.attributes].some(a => /^on/i.test(a.name) || /href|src|style/i.test(a.name) || /url\s*\(/i.test(a.value)))) throw Error('Invalid record artwork');
    target.replaceChildren(t.content);
  }
  const cache = new Map(), memory = new Map();
  let current, side=0, articles=[], selected=0, serial=0, pending, retry;
  const keyFor = (key,s) => key+':'+s;
  cache.set(keyFor(model.initial.key,0),model.initial);
  function number(n) { return String(n).padStart(2,'0'); }
  function hash(key,s,i) { return '#record-'+key+'-'+(s+1)+'-'+(i+1); }
  function save(push=false) {
    if (!current) return;
    memory.set(current.key,{side,index:selected});
    const value=hash(current.key,side,selected);
    if (location.hash!==value) history[push?'pushState':'replaceState'](null,'',value);
  }
  const polar = (r,a) => [200+r*Math.cos(a*Math.PI/180),200+r*Math.sin(a*Math.PI/180)];
  function svg(tag,attributes) { const e=document.createElementNS('http://www.w3.org/2000/svg',tag); for (const [k,v] of Object.entries(attributes)) e.setAttribute(k,v); return e; }
  function renderTracks() {
    const tracks=$('#record-tracks'),list=$('.record-list'); tracks.replaceChildren(); list.replaceChildren();
    articles.forEach((article,i) => {
      const step=360/articles.length, gap=Math.min(8,step*.18), start=-90+i*step+gap/2, end=-90+(i+1)*step-gap/2;
      const a=polar(166,start),b=polar(166,end),mid=polar(140,(start+end)/2);
      const d=`M${a[0]} ${a[1]}A166 166 0 ${end-start>180?1:0} 1 ${b[0]} ${b[1]}`;
      const g=svg('g',{class:'record-track',role:'button',tabindex:i===selected?'0':'-1','aria-label':`${number(side*12+i+1)} · ${article.title}`,'aria-pressed':'false','data-index':i});
      g.append(svg('path',{d,class:'track-hit'}),svg('path',{d,class:'track-line'}));
      const text=svg('text',{x:mid[0],y:mid[1],'aria-hidden':'true'});text.textContent=number(side*12+i+1);g.append(text); tracks.append(g);
      const li=document.createElement('li'),button=document.createElement('button'),ordinal=document.createElement('span'),label=document.createElement('span'),date=document.createElement('small'),open=document.createElement('a');
      button.type='button';button.className='record-select';button.dataset.index=i;button.setAttribute('aria-pressed','false');
      ordinal.className='record-number';ordinal.textContent=number(side*12+i+1);label.append(document.createTextNode(article.title));
      date.textContent=article.date+(article.locked?' · 加密':'');label.append(date);button.append(ordinal,label);
      open.className='record-open';open.href=local(article.url);open.textContent='↗';open.setAttribute('aria-label','阅读：'+article.title);li.append(button,open);list.append(li);
    });
  }
  function select(index,{remember=true,announce=true,focus=false}={}) {
    selected=(index+articles.length)%articles.length;
    const article=articles[selected];
    root.querySelectorAll('.record-track').forEach((e,i) => {e.setAttribute('aria-pressed',String(i===selected));e.setAttribute('tabindex',i===selected?'0':'-1');});
    root.querySelectorAll('.record-select').forEach((e,i) => {e.setAttribute('aria-pressed',String(i===selected));e.parentElement.dataset.selected=String(i===selected);});
    artwork($('#record-cover'),article.cover);
    $('#record-preview-title').textContent=article.title;$('#record-date').textContent=article.date;$('#record-date').dateTime=article.date;
    $('#record-category').textContent=article.categories.join(' / ');$('#record-locked').hidden=!article.locked;$('#record-read').href=local(article.url);
    $('#record-position').textContent=number(side*12+selected+1)+' / '+number(current.count);
    if (announce) $('.record-status').textContent=`已选 ${number(side*12+selected+1)} · ${article.title}`;
    if (remember) save();
    if (focus) root.querySelector(`.record-track[data-index="${selected}"]`).focus();
  }
  function validate(data,album,s) {
    if (data?.key!==album.key || data.side!==s || !Array.isArray(data.articles) || data.articles.length!==album.sides[s].count || data.articles.length>12) throw Error('Invalid record data');
    for (const a of data.articles) if (typeof a.title!=='string' || typeof a.date!=='string' || !Array.isArray(a.categories) || !a.categories.every(c=>typeof c==='string') || !local(a.url) || typeof a.cover!=='string') throw Error('Invalid article metadata');
    // Validate all artwork before replacing any visible state.
    const probe=document.createElement('div');for (const a of data.articles) artwork(probe,a.cover);artwork(probe,album.art);
    return data;
  }
  async function load(album,s=0,index=0,{push=false,remember=true,announce=true}={}) {
    if (!album || !Number.isInteger(s) || s<0 || s>=album.sides.length) return;
    const request=++serial;pending?.abort();pending=new AbortController();
    root.setAttribute('aria-busy','true');$('.record-error').hidden=true;
    retry=()=>load(album,s,index,{push,remember,announce});
    try {
      const cacheKey=keyFor(album.key,s);let data=cache.get(cacheKey);
      if (!data) {
        const url=local(album.sides[s].url);if (!url) throw Error('Invalid data URL');
        $('.record-status').textContent='正在换上 '+album.year+' 的唱片…';
        const response=await fetch(url,{signal:pending.signal,credentials:'same-origin'});
        if (!response.ok) throw Error('Record unavailable');data=await response.json();
      }
      validate(data,album,s);if (request!==serial) return;
      cache.set(cacheKey,data);current=album;side=s;articles=data.articles;selected=Math.max(0,Math.min(articles.length-1,index));
      artwork($('#record-label-art'),album.art);$('#record-year').textContent=album.year;
      $('#record-label-count').textContent=album.count+' 篇 · '+(album.key.length>4?album.key.slice(5).replace('-','月')+(album.key.length>7?'日':'月'):'全年');
      $('#record-list-heading').textContent=album.year+' · 曲目清单';$('#record-side-name').textContent='SIDE '+number(s+1);
      $('#record-side-range').textContent=(s*12+1)+'–'+(s*12+articles.length)+' / '+album.count+' 篇';
      root.querySelectorAll('[data-record-year]').forEach(e => {if (e.dataset.recordYear===album.key)e.setAttribute('aria-current','true');else e.removeAttribute('aria-current');});
      $('.record-browse').hidden=false;$('.record-sides').hidden=album.sides.length<2;
      $('[data-record-side-prev]').disabled=s===0;$('[data-record-side-next]').disabled=s===album.sides.length-1;
      $('#record-side-total').textContent=(s+1)+' / '+album.sides.length+' 面';
      renderTracks();select(selected,{remember:false,announce});if (remember) save(push);
      if (!announce) $('.record-status').textContent='';
    } catch (error) {
      if (request!==serial || error.name==='AbortError') return;
      $('.record-error').hidden=false;$('#record-fallback').href=local(album.url);$('.record-status').textContent='载入失败，当前文章仍可阅读。';
    } finally { if (request===serial) root.removeAttribute('aria-busy'); }
  }
  function fromHash(initial=false) {
    const match=location.hash.match(/^#record-(\d{4}(?:-\d\d){0,2})-(\d+)-(\d+)$/);
    const album=match&&catalog.find(a=>a.key===match[1]);
    if (album && +match[2]>0 && +match[2]<=album.sides.length && +match[3]>0 && +match[3]<=album.sides[+match[2]-1].count) load(album,+match[2]-1,+match[3]-1,{remember:false,announce:!initial});
    else if (initial || !location.hash) load(catalog.find(a=>a.key===model.initial.key)||catalog[0],0,0,{remember:false,announce:false});
  }
  root.addEventListener('click',event=>{
    const year=event.target.closest('[data-record-year]');
    if (year && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button===0) {
      const album=catalog.find(a=>a.key===year.dataset.recordYear);
      if (!album) return;
      event.preventDefault();const saved=memory.get(album.key);load(album,saved?.side||0,saved?.index||0,{push:true});return;
    }
    const track=event.target.closest('.record-track,.record-select');
    if (track && articles.length) {select(Number(track.dataset.index));return;}
    if (event.target.closest('[data-record-prev]')) select(selected-1);
    if (event.target.closest('[data-record-next]')) select(selected+1);
    if (event.target.closest('[data-record-side-prev]')) load(current,side-1,0,{push:true});
    if (event.target.closest('[data-record-side-next]')) load(current,side+1,0,{push:true});
    if (event.target.closest('[data-record-retry]')) retry?.();
  });
  root.addEventListener('keydown',event=>{
    const track=event.target.closest('.record-track');if (!track) return;
    let i=Number(track.dataset.index);
    if (['ArrowRight','ArrowDown'].includes(event.key)) i++;
    else if (['ArrowLeft','ArrowUp'].includes(event.key)) i--;
    else if (event.key==='Home') i=0;
    else if (event.key==='End') i=articles.length-1;
    else if (!['Enter',' '].includes(event.key)) return;
    event.preventDefault();select(i,{focus:true});
  });
  window.addEventListener('hashchange',()=>fromHash());
  fromHash(true);
})();

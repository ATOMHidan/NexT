(() => {
  'use strict';
  const year=document.getElementById('book-year'), category=document.getElementById('book-category');
  const chapters=[...document.querySelectorAll('.book-chapter')];
  document.querySelector('.book-filters').hidden=false;
  function filter() {
    let count=0;
    chapters.forEach(chapter=>{
      const visible=(!year.value || chapter.dataset.year===year.value) && (!category.value || JSON.parse(chapter.dataset.categories).includes(category.value));
      chapter.hidden=!visible;
      document.querySelector(`[data-book-entry="${chapter.dataset.number}"]`).hidden=!visible;
      if(visible) count++;
    });
    document.getElementById('book-count').textContent=count+' 篇';
    document.getElementById('book-empty').hidden=count!==0;
  }
  year.addEventListener('change',filter);category.addEventListener('change',filter);
})();

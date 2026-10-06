(function(){
  // reveal + counters
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animateCount(el){
    var target = parseFloat(el.dataset.target), prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
    var decimals = parseInt(el.dataset.decimals || '0', 10);
    if(reduceMotion){ el.textContent = prefix + target.toFixed(decimals) + suffix; return; }
    var duration = 1300, start = null;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts - start) / duration, 1), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if(p < 1) requestAnimationFrame(step); else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }
  window.initReveal = function(){
    var els = document.querySelectorAll('.reveal:not(.in)');
    if(!('IntersectionObserver' in window)){ els.forEach(function(el){ el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          entry.target.querySelectorAll('[data-target]').forEach(function(n){ if(!n.dataset.done){ n.dataset.done='1'; animateCount(n); } });
          if(entry.target.matches('[data-target]') && !entry.target.dataset.done){ entry.target.dataset.done='1'; animateCount(entry.target); }
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function(el){ io.observe(el); });
  };

  // theme toggle
  document.getElementById('theme-toggle').addEventListener('click', function(){
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if(isDark){ document.documentElement.removeAttribute('data-theme'); }
    else{ document.documentElement.setAttribute('data-theme','dark'); }
    try{ localStorage.setItem('theme', isDark ? 'light' : 'dark'); }catch(e){}
  });

  // mobile menu
  var menuBtn = document.getElementById('menu-toggle'), menu = document.getElementById('mobile-menu');
  menuBtn.addEventListener('click', function(){
    var open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  menu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){ menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded','false'); });
  });

  // Research dropdown (click/tap + keyboard; hover handled in CSS)
  document.querySelectorAll('.has-sub').forEach(function(li){
    var btn = li.querySelector('.sub-toggle');
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function(){
    document.querySelectorAll('.has-sub.open').forEach(function(li){ li.classList.remove('open'); li.querySelector('.sub-toggle').setAttribute('aria-expanded','false'); });
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){ document.querySelectorAll('.has-sub.open').forEach(function(li){ li.classList.remove('open'); }); }
  });
})();

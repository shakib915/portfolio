/* Home hero background: a slow drift of concrete aggregate, sand grains and air voids,
   drawn faintly like a polished concrete cross-section. Static when reduced motion is set. */
(function(){
  var canvas = document.querySelector('.hero-bg');
  if(!canvas || !canvas.getContext) return;
  var hero = canvas.parentElement;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var SPEED = 2.3;   // drift speed multiplier (1 = original pace)
  var W = 0, H = 0, stones = [], sand = [], voids = [], colors = {}, running = false, visible = true, raf = 0;

  function hexToRgb(h){
    h = (h || '').trim().replace('#','');
    if(h.length === 3){ h = h.split('').map(function(c){ return c + c; }).join(''); }
    var n = parseInt(h, 16);
    if(isNaN(n)) return [30, 59, 42];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readColors(){
    var cs = getComputedStyle(document.documentElement);
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    colors.stone = hexToRgb(cs.getPropertyValue('--brand'));
    colors.grain = hexToRgb(cs.getPropertyValue('--text-muted'));
    colors.accent = hexToRgb(cs.getPropertyValue('--accent'));
    colors.k = dark ? 1.35 : 1;   // a touch stronger on the dark ground
  }
  function rgba(c, a){ return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * colors.k).toFixed(3) + ')'; }
  function rand(a, b){ return a + Math.random() * (b - a); }

  function makeStone(){
    var r = Math.random() < 0.18 ? rand(18, 34) : rand(6, 17);   // a few coarse, many medium aggregates
    var n = Math.floor(rand(6, 10)), pts = [];
    for(var i = 0; i < n; i++){
      var ang = (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
      var rr = r * rand(0.62, 1.0);
      pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr * rand(0.7, 1)]);
    }
    pts = hull(pts);
    var cr = 0;
    for(i = 0; i < pts.length; i++){ cr = Math.max(cr, Math.sqrt(pts[i][0] * pts[i][0] + pts[i][1] * pts[i][1])); }
    return { x: rand(0, W), y: rand(0, H), r: r, cr: cr, m: r * r, pts: pts, rot: rand(0, Math.PI * 2),
             vr: rand(-0.0012, 0.0012) * SPEED, vx: rand(-0.09, 0.09) * SPEED, vy: rand(-0.06, 0.06) * SPEED,
             fill: rand(0.045, 0.1), edge: rand(0.08, 0.16), accent: Math.random() < 0.12 };
  }
  function overlapsAny(a){
    for(var k = 0; k < stones.length; k++){
      var b = stones[k], dx = b.x - a.x, dy = b.y - a.y, rr = a.cr + b.cr + 2;
      if(dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }
  // convex hull (monotone chain) of a stone's outline
  function hull(pts){
    var p = pts.slice().sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b){ return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for(i = 0; i < p.length; i++){ while(lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for(i = p.length - 1; i >= 0; i--){ while(up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  // a stone's outline in page coordinates
  function worldPts(st){
    var c = Math.cos(st.rot), sn = Math.sin(st.rot), out = [];
    for(var k = 0; k < st.pts.length; k++){
      var px = st.pts[k][0], py = st.pts[k][1];
      out.push([st.x + px * c - py * sn, st.y + px * sn + py * c]);
    }
    return out;
  }
  // separating-axis test: returns {nx, ny, depth} pointing from A to B, or null if the outlines don't touch
  function contact(A, B, ax, ay, bx, by){
    var best = Infinity, bnx = 0, bny = 0, polys = [A, B];
    for(var q = 0; q < 2; q++){
      var P = polys[q];
      for(var k = 0; k < P.length; k++){
        var p1 = P[k], p2 = P[(k + 1) % P.length];
        var ex = p2[0] - p1[0], ey = p2[1] - p1[1], len = Math.sqrt(ex * ex + ey * ey);
        if(len === 0) continue;
        var nx = -ey / len, ny = ex / len;
        var minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity, t, m;
        for(m = 0; m < A.length; m++){ t = A[m][0] * nx + A[m][1] * ny; if(t < minA) minA = t; if(t > maxA) maxA = t; }
        for(m = 0; m < B.length; m++){ t = B[m][0] * nx + B[m][1] * ny; if(t < minB) minB = t; if(t > maxB) maxB = t; }
        var o = Math.min(maxA, maxB) - Math.max(minA, minB);
        if(o <= 0) return null;
        if(o < best){ best = o; bnx = nx; bny = ny; }
      }
    }
    if((bx - ax) * bnx + (by - ay) * bny < 0){ bnx = -bnx; bny = -bny; }
    return { nx: bnx, ny: bny, depth: best };
  }
  // stones bounce off each other when their outlines touch
  function collide(){
    var W8 = [];
    for(var i = 0; i < stones.length; i++) W8[i] = null;
    for(i = 0; i < stones.length; i++){
      var a = stones[i];
      for(var j = i + 1; j < stones.length; j++){
        var b = stones[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.cr + b.cr;
        if(Math.abs(dx) > rr || Math.abs(dy) > rr || dx * dx + dy * dy >= rr * rr) continue;
        if(!W8[i]) W8[i] = worldPts(a);
        if(!W8[j]) W8[j] = worldPts(b);
        var c = contact(W8[i], W8[j], a.x, a.y, b.x, b.y);
        if(!c) continue;
        var nx = c.nx, ny = c.ny, tm = a.m + b.m;
        // push apart along the contact normal so the edges just touch
        a.x -= nx * c.depth * (b.m / tm); a.y -= ny * c.depth * (b.m / tm);
        b.x += nx * c.depth * (a.m / tm); b.y += ny * c.depth * (a.m / tm);
        W8[i] = null; W8[j] = null;
        // exchange momentum along the normal (only if moving toward each other)
        var rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if(rv < 0){
          var imp = -2 * rv / tm;
          a.vx -= imp * b.m * nx; a.vy -= imp * b.m * ny;
          b.vx += imp * a.m * nx; b.vy += imp * a.m * ny;
          a.vr += (Math.random() - 0.5) * 0.004; b.vr += (Math.random() - 0.5) * 0.004;
          a.vr = Math.max(-0.006, Math.min(0.006, a.vr)); b.vr = Math.max(-0.006, Math.min(0.006, b.vr));
        }
      }
    }
  }
  function build(){
    var area = W * H;
    stones = []; sand = []; voids = [];
    var ns = Math.round(area / 11000), ng = Math.round(area / 1400), nv = Math.round(area / 60000);
    for(var i = 0; i < ns; i++){
      var st = makeStone(), tries = 0;
      while(tries++ < 40 && overlapsAny(st)){ st.x = rand(0, W); st.y = rand(0, H); }
      stones.push(st);
    }
    for(i = 0; i < ng; i++) sand.push({ x: rand(0, W), y: rand(0, H), r: rand(0.5, 1.6), a: rand(0.08, 0.2), vx: rand(-0.05, 0.05) * SPEED, vy: rand(-0.04, 0.04) * SPEED });
    for(i = 0; i < nv; i++) voids.push({ x: rand(0, W), y: rand(0, H), r: rand(2.5, 6), vx: rand(-0.05, 0.05) * SPEED, vy: rand(-0.04, 0.04) * SPEED });
  }
  function resize(){
    var rect = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build(); draw();
  }
  function wrap(p, m){
    if(p.x < -m) p.x = W + m; else if(p.x > W + m) p.x = -m;
    if(p.y < -m) p.y = H + m; else if(p.y > H + m) p.y = -m;
  }
  function draw(){
    ctx.clearRect(0, 0, W, H);
    var i, p;
    for(i = 0; i < sand.length; i++){
      p = sand[i];
      ctx.fillStyle = rgba(colors.grain, p.a);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 1;
    for(i = 0; i < voids.length; i++){
      p = voids[i];
      ctx.strokeStyle = rgba(colors.grain, 0.16);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    }
    for(i = 0; i < stones.length; i++){
      p = stones[i];
      var c = p.accent ? colors.accent : colors.stone;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(p.pts[0][0], p.pts[0][1]);
      for(var k = 1; k < p.pts.length; k++) ctx.lineTo(p.pts[k][0], p.pts[k][1]);
      ctx.closePath();
      ctx.fillStyle = rgba(c, p.fill); ctx.fill();
      ctx.strokeStyle = rgba(c, p.edge); ctx.stroke();
      ctx.restore();
    }
  }
  function step(){
    var i, p;
    for(i = 0; i < stones.length; i++){ p = stones[i]; p.x += p.vx; p.y += p.vy; p.rot += p.vr; wrap(p, p.r + 4); }
    collide();
    for(i = 0; i < sand.length; i++){ p = sand[i]; p.x += p.vx; p.y += p.vy; wrap(p, 2); }
    for(i = 0; i < voids.length; i++){ p = voids[i]; p.x += p.vx; p.y += p.vy; wrap(p, 8); }
    draw();
    raf = requestAnimationFrame(step);
  }
  function start(){ if(reduce || running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(step); }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  readColors(); resize(); start();

  var t; window.addEventListener('resize', function(){ clearTimeout(t); t = setTimeout(resize, 150); });
  document.addEventListener('visibilitychange', function(){ document.hidden ? stop() : start(); });
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(e){ visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
  }
  new MutationObserver(function(){ readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

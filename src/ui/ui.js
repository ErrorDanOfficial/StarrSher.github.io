export class UI{
  constructor(storage, audio){
    this.storage = storage; this.audio = audio; this.listeners = new Map();
    this.screens = {
      auth: document.getElementById('screen-auth'),
      menu: document.getElementById('screen-menu'),
      levels: document.getElementById('screen-levels'),
      characters: document.getElementById('screen-characters'),
      shop: document.getElementById('screen-shop'),
      upgrades: document.getElementById('screen-upgrades'),
      settings: document.getElementById('screen-settings'),
      credits: document.getElementById('screen-credits'),
      game: document.getElementById('screen-game'),
      gameover: document.getElementById('screen-gameover'),
      levelwin: document.getElementById('screen-levelwin'),
    };
    this.toastEl = document.getElementById('toast');
    this.waveEl = document.getElementById('mutator-wave');
    this.pauseOverlay = document.getElementById('pause-overlay');

    // back buttons
    for (const el of document.querySelectorAll('[data-nav="back"]')) el.addEventListener('click', ()=> this.showScreen('menu'));
  }

  mount(game){
    this.game = game;
    // HUD refs
    this.hud = {
      timer: document.getElementById('hud-timer'),
      round: document.getElementById('hud-round'),
      lives: document.getElementById('hud-lives'),
      score: document.getElementById('hud-score'),
      mult: document.getElementById('hud-mult'),
      totalScore: document.getElementById('ui-total-score'),
      totalXP: document.getElementById('ui-total-xp'),
      xpFill: document.getElementById('ui-xp-fill'),
      multiplier: document.getElementById('ui-multiplier'),
    };
    this.refreshMeta();

    // Levels
    this.renderLevels();
    // Upgrades / Shop / Characters UI
    this.renderUpgrades(); this.renderCharacters(); this.renderShop('skins'); this.wireExternal();
    document.querySelector('#screen-shop .tabs').addEventListener('click', (e)=>{
      const b = e.target.closest('.tab'); if (!b) return; for (const t of e.currentTarget.children) t.classList.remove('active'); b.classList.add('active'); this.renderShop(b.dataset.tab);
    });
  }
  renderLevels(){
    const grid = document.getElementById('levels-grid'); if (!grid) return; grid.innerHTML='';
    const maxLevel = this.storage.get('max_level', 1);
    for (let i=1;i<=30;i++){
      const open = i<=maxLevel; const div = document.createElement('div'); div.className = 'level-card ' + (open? 'open':'locked'); div.textContent = i;
      if (open){ div.addEventListener('click', ()=> this.startLevel(i)); }
      grid.appendChild(div);
    }
    const tower = document.getElementById('tower-card'); const towerOpen = maxLevel>=30; if (tower){ tower.classList.toggle('locked', !towerOpen); if (towerOpen){ tower.addEventListener('click', ()=> this.startTower()); } }
  }

  startLevel(level){ this.showScreen('game'); this.game.startLevel(level); this.setupWavebar(this.game.getWaveTarget()); }
  startTower(){ this.showScreen('game'); this.game.startTower(); this.setupWavebar(this.game.getWaveTarget()); }

  setupWavebar(total){ const wrap = document.getElementById('wavebar'); const marks = document.getElementById('wavebar-marks'); this.waveTotal = total; if (!wrap||!marks){ return; } wrap.classList.remove('hidden'); marks.innerHTML=''; for (let i=1;i<=total;i++){ const m = document.createElement('div'); m.textContent = i; marks.appendChild(m); } this.updateWavebar(0); }
  updateWavebar(cur){ const fill = document.getElementById('wavebar-fill'); if (!fill||!this.waveTotal) return; const pct = Math.min(100, Math.max(0, (cur/this.waveTotal)*100)); fill.style.width = `calc(${pct}% - 24px)`; }

  on(name, cb){ this.listeners.set(name, cb); }
  emit(name, payload){ const cb = this.listeners.get(name); if (cb) cb(payload); }

  showScreen(name){
    for (const [k,el] of Object.entries(this.screens)){
      if (!el) continue;
      const isTarget = (k===name);
      el.classList.toggle('visible', isTarget);
      // Inline fallback to avoid any CSS specificity issues
      if (isTarget){
        el.style.display = (k==='gameover') ? 'flex' : 'block';
      } else {
        el.style.display = 'none';
      }
    }
    this.emit('screen', name);
    if (name==='game'){ this.emit('start'); }
  }
  exitToMenu(){ this.showScreen('menu'); }
  retry(){ this.showScreen('game'); this.emit('start'); }

  updateTimer(t){ this.hud.timer.textContent = t.toFixed(1); }
  updateRound(r){ this.hud.round.textContent = r; }
  updateLives(v){ this.hud.lives.textContent = v; }
  updateScore(score, mult){
    if (this.hud.score) this.hud.score.textContent = score;
    if (this.hud.mult) this.hud.mult.textContent = `${mult.toFixed(1)}x`;
    if (this.hud.totalScore) {
      const prev = parseInt(this.hud.totalScore.textContent)||0;
      this.hud.totalScore.textContent = String(Math.max(prev, score));
    }
    this.refreshMeta();
  }

  refreshMeta(){ const xp = this.storage.get('xp', 0); this.hud.totalXP.textContent = xp; const mult = 1.0 + Math.min(1.0, Math.floor(xp/1000)*0.1); this.hud.multiplier.textContent = `${mult.toFixed(1)}x`; const pct = Math.min(100, (xp%1000)/1000*100); this.hud.xpFill.style.width = pct+'%'; }

  togglePause(v){ const target = v===undefined? !this.pauseOverlay.classList.contains('hidden') : v; if (target){ this.pauseOverlay.classList.add('hidden'); this.game.pause(false); } else { this.pauseOverlay.classList.remove('hidden'); this.game.pause(true); } }
  shake(){ const el = document.getElementById('screen-game'); el.animate([{ transform:'translate(0,0)' },{ transform:'translate(4px,-2px)' },{ transform:'translate(-3px,2px)' },{ transform:'translate(0,0)' }], { duration:180, iterations:1 }); }
  toast(text){ this.toastEl.textContent=text; this.toastEl.classList.remove('show'); void this.toastEl.offsetWidth; this.toastEl.classList.add('show'); }
  mutatorWave(){ this.waveEl.classList.remove('show'); void this.waveEl.offsetWidth; this.waveEl.classList.add('show'); }

  showGameOver({ score, roundXP, totalXP, best, echoes, kills }){
    document.getElementById('go-score').textContent = score;
    document.getElementById('go-round-xp').textContent = roundXP;
    document.getElementById('go-total-xp').textContent = totalXP;
    document.getElementById('go-best').textContent = best;
    document.getElementById('go-echoes').textContent = echoes;
    document.getElementById('go-kills').textContent = kills;
    this.showScreen('gameover');
  }

  showLevelWin({ score, roundXP, totalXP, nextAvailable }){
    document.getElementById('lw-score').textContent = score;
    document.getElementById('lw-round-xp').textContent = roundXP;
    document.getElementById('lw-total-xp').textContent = totalXP;
    const nextBtn = document.getElementById('lw-next'); if (nextBtn) nextBtn.disabled = !nextAvailable;
    this.showScreen('levelwin');
  }

  // Panels
  renderUpgrades(){
    const cont = document.getElementById('upgrades-grid'); cont.innerHTML='';
    const ups = this.game.getState().characters.upgrades;
    for (const it of ups.list()){
      const owned = ups.has(it.id); const active = ups.activeOf(it.id);
      const div = document.createElement('div'); div.className='card'+(owned?'':' locked');
      div.innerHTML = `<div><b>${it.name}</b></div><div class="tag">${it.desc}</div><div class="price">${owned? 'Куплено' : ('Цена: '+it.price+' XP')}</div><div class="actions"></div>`;
      const actions = div.querySelector('.actions');
      const b = document.createElement('button'); b.className='btn'; b.textContent = owned? (active? 'Выключить' : 'Включить') : 'Купить';
      b.addEventListener('click', ()=>{ if (!owned){ if (ups.buy(it.id)){ this.toast('Куплено'); this.refreshMeta(); this.renderUpgrades(); } else { this.toast('Не хватает XP'); } } else { ups.toggle(it.id); this.renderUpgrades(); }});
      actions.appendChild(b);
      cont.appendChild(div);
    }
  }

  renderCharacters(){
    const chars = this.game.getState().characters;
    const list = chars.getAll();
    let index = Math.max(0, list.findIndex(c=> c.id===chars.selected));
    const canvas = document.getElementById('character-canvas'); const ctx = canvas.getContext('2d');
    const nameEl = document.getElementById('char-name'); const descEl = document.getElementById('char-desc'); const actionBtn = document.getElementById('char-action');

    // Mouse tracking for aiming
    const mouse = { x: canvas.width/2, y: canvas.height/2 };
    canvas.addEventListener('mousemove', (e)=>{
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      mouse.x = sx; mouse.y = sy;
    });

    // Slide animation state
    let sliding = false, slideDir = 0, slideStart = 0, prevIndex = index;
    const SLIDE_MS = 420; // smoother
    const easeInOutCubic = (t)=> t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

    // Bullets for preview
    const bullets = [];
    let lastTime = performance.now();
    let shootTimer = 0; // seconds

    function rotate(v, ang){ const ca=Math.cos(ang), sa=Math.sin(ang); return { x: v.x*ca - v.y*sa, y: v.x*sa + v.y*ca }; }
    function normalize(v){ const l = Math.hypot(v.x, v.y) || 1; return { x: v.x/l, y: v.y/l }; }

    function renderCard(){ const it = list[index]; const owned = chars.isOwned(it.id); nameEl.textContent = it.name; descEl.textContent = it.desc + (owned? '' : ` · Цена: ${it.price} XP`); actionBtn.textContent = owned? 'Выбрать' : 'Купить'; }

    function fireOnce(){ const it = list[index]; const x=canvas.width/2, y=canvas.height/2; const aim = normalize({ x: mouse.x - x, y: mouse.y - y }); const speed=320; const push=(dx,dy)=> bullets.push({ x, y, dx:dx*speed, dy:dy*speed, life:1.2 });
      if (it.id==='sher'){ push(aim.x, aim.y); }
      else if (it.id==='dubsher'){ push(aim.x, aim.y); push(-aim.x, -aim.y); }
      else { const a90 = rotate(aim, Math.PI/2), a180 = { x:-aim.x,y:-aim.y }, a270 = rotate(aim, -Math.PI/2); push(aim.x,aim.y); push(a180.x,a180.y); push(a90.x,a90.y); push(a270.x,a270.y); }
    }

    function drawFrame(){
      const now = performance.now(); const dt = Math.min(0.033, (now - lastTime)/1000); lastTime = now; ctx.clearRect(0,0,canvas.width,canvas.height);
      const center = { x: canvas.width/2, y: canvas.height/2 };
      // slide progress with easing
      let prog = 1;
      if (sliding){ prog = Math.min(1, (now - slideStart)/SLIDE_MS); if (prog>=1) { sliding=false; prevIndex=index; } }
      const eased = easeInOutCubic(prog);
      const distance = canvas.width;
      const offset = sliding? (1-eased) * (slideDir>0? distance : -distance) : 0;
      // draw current character
      const cur = list[index]; const r=18;
      ctx.save(); ctx.translate(offset, 0);
      ctx.globalAlpha = sliding? (0.6 + 0.4*eased) : 1;
      ctx.fillStyle = chars.getFillStyle(ctx, center.x, center.y, r, cur.id, '#7df'); ctx.beginPath(); ctx.arc(center.x, center.y, r, 0, Math.PI*2); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
      // draw previous character during slide
      if (sliding){ const prev = list[prevIndex]; ctx.save(); ctx.translate(offset - (slideDir>0? -distance : distance), 0); ctx.globalAlpha = 1 - 0.4*eased; ctx.fillStyle = chars.getFillStyle(ctx, center.x, center.y, r, prev.id, '#7df'); ctx.beginPath(); ctx.arc(center.x, center.y, r, 0, Math.PI*2); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }

      // bullets update/draw (only when not sliding)
      if (!sliding){ shootTimer -= dt; if (shootTimer<=0){ fireOnce(); shootTimer = 1.0; }
        for (const b of bullets){ b.x += b.dx*dt; b.y += b.dy*dt; b.life -= dt; }
        for (let i=bullets.length-1;i>=0;i--){ const b = bullets[i]; if (b.life<=0 || b.x<-10 || b.x>canvas.width+10 || b.y<-10 || b.y>canvas.height+10) bullets.splice(i,1); }
        ctx.fillStyle = '#fff'; for (const b of bullets){ ctx.fillRect(b.x-2,b.y-2,4,4); }
      }
      requestAnimationFrame(drawFrame);
    }

    document.getElementById('char-prev').onclick = ()=>{ if (sliding) return; prevIndex = index; index = (index - 1 + list.length)%list.length; renderCard(); sliding=true; slideDir = -1; slideStart = performance.now(); };
    document.getElementById('char-next').onclick = ()=>{ if (sliding) return; prevIndex = index; index = (index + 1)%list.length; renderCard(); sliding=true; slideDir = +1; slideStart = performance.now(); };
    actionBtn.onclick = ()=>{ const it = list[index]; const owned = chars.isOwned(it.id); if (!owned){ if (chars.buyCharacter(it.id)){ this.toast('Куплено'); this.refreshMeta(); renderCard(); } else { this.toast('Не хватает XP'); } } else { chars.select(it.id); this.toast('Выбрано'); } };

    renderCard(); requestAnimationFrame(drawFrame);
  }

  renderShop(tab){
    const cont = document.getElementById('shop-content'); cont.innerHTML=''; const chars = this.game.getState().characters;
    if (tab==='skins'){
      for (const s of chars.listSkins()){
        const owned = chars.skinOwned(s.id); const div = document.createElement('div'); div.className='card'+(owned?'':' locked');
        div.innerHTML = `<div><b>Скин для ${s.for}</b></div><div class="tag">Градиентная раскраска</div><div class="price">${owned? 'Куплено' : ('Цена: '+s.price+' XP')}</div><div class="actions"></div>`;
        const b = document.createElement('button'); b.className='btn'; b.textContent = owned? 'Выбрать' : 'Купить'; b.addEventListener('click', ()=>{ if (!owned){ if (chars.buySkin(s.id)){ this.toast('Куплено'); this.refreshMeta(); this.renderShop('skins'); } else { this.toast('Не хватает XP'); } } else { chars.selectSkin(s.id); this.toast('Выбрано'); }});
        div.querySelector('.actions').appendChild(b); cont.appendChild(div);
      }
    } else {
      for (const it of chars.getAll()){
        const owned = chars.isOwned(it.id); const div = document.createElement('div'); div.className='card'+(owned?'':' locked');
        div.innerHTML = `<div><b>${it.name}</b></div><div class="tag">${it.desc}</div><div class="price">${owned? 'Доступен' : ('Цена: '+it.price+' XP')}</div><div class="actions"></div>`;
        const b = document.createElement('button'); b.className='btn'; b.textContent = owned? 'Выбрать' : 'Купить'; b.addEventListener('click', ()=>{ if (!owned){ if (chars.buyCharacter(it.id)){ this.toast('Куплено'); this.refreshMeta(); this.renderShop('characters'); } else { this.toast('Не хватает XP'); } } else { chars.select(it.id); this.toast('Выбрано'); }});
        div.querySelector('.actions').appendChild(b); cont.appendChild(div);
      }
    }
  }

  confirmReset(){ if (confirm('Сбросить весь прогресс?')){ localStorage.clear(); location.reload(); } }

  // External buttons wiring that depend on game API
  wireExternal(){
    const restartBtn = document.getElementById('btn-restart'); if (restartBtn){ restartBtn.onclick = ()=> this.game.restartCycle(); }
    const exitBtn = document.getElementById('btn-exit'); if (exitBtn){ exitBtn.onclick = ()=> { this.game.stop(); this.showScreen('menu'); }; }
  }
}



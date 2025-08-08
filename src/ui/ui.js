export class UI{
  constructor(storage, audio){
    this.storage = storage; this.audio = audio; this.listeners = new Map();
    this.screens = {
      auth: document.getElementById('screen-auth'),
      menu: document.getElementById('screen-menu'),
      characters: document.getElementById('screen-characters'),
      shop: document.getElementById('screen-shop'),
      upgrades: document.getElementById('screen-upgrades'),
      settings: document.getElementById('screen-settings'),
      credits: document.getElementById('screen-credits'),
      game: document.getElementById('screen-game'),
      gameover: document.getElementById('screen-gameover'),
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

    // Upgrades / Shop / Characters UI
    this.renderUpgrades(); this.renderCharacters(); this.renderShop('skins'); this.wireExternal();
    document.querySelector('#screen-shop .tabs').addEventListener('click', (e)=>{
      const b = e.target.closest('.tab'); if (!b) return; for (const t of e.currentTarget.children) t.classList.remove('active'); b.classList.add('active'); this.renderShop(b.dataset.tab);
    });
  }

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
    const cont = document.getElementById('character-grid'); cont.innerHTML=''; const chars = this.game.getState().characters;
    for (const it of chars.getAll()){
      const owned = chars.isOwned(it.id); const div = document.createElement('div'); div.className='card'+(owned?'':' locked');
      div.innerHTML = `<div><b>${it.name}</b></div><div class="tag">${it.desc}</div><div class="price">${owned? 'Доступен' : ('Цена: '+it.price+' XP')}</div><div class="actions"></div>`;
      const actions = div.querySelector('.actions');
      const bSel = document.createElement('button'); bSel.className='btn'; bSel.textContent = owned? 'Выбрать' : 'Купить';
      bSel.addEventListener('click', ()=>{ if (!owned){ if (chars.buyCharacter(it.id)){ this.toast('Куплено'); this.refreshMeta(); this.renderCharacters(); } else { this.toast('Не хватает XP'); } } else { chars.select(it.id); this.toast('Выбрано'); }});
      actions.appendChild(bSel);
      cont.appendChild(div);
    }
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



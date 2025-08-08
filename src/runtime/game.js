import { rng } from '../utils/rng.js';
import { clamp, length, normalize } from '../utils/math.js';
import { Mutators } from '../systems/mutators.js';
import { Characters } from '../systems/characters.js';

const INPUT = { up:false, down:false, left:false, right:false, shoot:false, dash:false, mutator:false, restart:false };

export function createGame({ canvas, storage, audio, ui }){
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  let width = 1280, height = 720;
  function resize(){
    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    width = Math.max(1, rect.width || parent.clientWidth || 1280);
    height = Math.max(1, rect.height || parent.clientHeight || 720);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize); resize();

  // State
  const state = {
    running: false, paused: false,
    round: 1, timeLeft: 10.0, loopDuration: 10.0,
    lives: 3, score: 0, best: storage.get('best', 0), kills: 0,
    totalXP: storage.get('xp', 0),
    echoes: [], // each: { timeline:[input frames], characterId }
    timeline: [], // records of current round (fixed-step)
    timelineClock: 0, frameStep: 1/60,
    entities: [], bullets: [], enemyBullets: [], particles: [], enemies: [], boss: null,
    player: null,
    mutators: new Mutators(storage),
    characters: new Characters(storage),
    enemySpawnCount: 3,
  };

  // Input handling
  const keyMap = {
    'KeyW':'up','ArrowUp':'up', 'KeyS':'down','ArrowDown':'down',
    'KeyA':'left','ArrowLeft':'left', 'KeyD':'right','ArrowRight':'right',
    'Space':'shoot','MouseLeft':'shoot', 'ShiftLeft':'dash','ShiftRight':'dash',
    'KeyE':'mutator','KeyR':'restart'
  };
  function setInput(key, pressed){
    const k = keyMap[key]; if (!k) return; INPUT[k] = pressed;
  }
  window.addEventListener('keydown', (e)=>{ if (e.repeat) return; setInput(e.code,true); });
  window.addEventListener('keyup', (e)=> setInput(e.code,false));
  window.addEventListener('mousedown', ()=> setInput('MouseLeft', true));
  window.addEventListener('mouseup', ()=> setInput('MouseLeft', false));

  // Input: mouse position for aiming
  const mouse = { x: 0, y: 0 };
  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    // convert from device pixels to world (CSS) pixels
    const scale = Math.max(1, window.devicePixelRatio || 1);
    mouse.x = sx / scale; mouse.y = sy / scale;
  });

  // Player
  function spawnPlayer(){
    const character = state.characters.getSelected();
    state.player = {
      x: width/2, y: height/2, r: 14,
      speed: 200 * state.characters.getSpeedMultiplier(),
      dash: { cd: 0, active:0 },
      shootCd: 0,
      characterId: character.id,
    };
  }

  // Entities helpers
  function spawnBullet(x,y,dx,dy, friendly=true){
    const speed = 460; const l = length({x:dx,y:dy}) || 1; const ndx = dx/l, ndy = dy/l;
    const dmg = state.characters.getDamage();
    state.bullets.push({ x,y, dx:ndx*speed, dy:ndy*speed, r:4, life:2.0, friendly, dmg });
  }
  function spawnEnemyBullet(x,y,dx,dy, isBoss=false){
    const speed = 260; const l = length({x:dx,y:dy}) || 1; const ndx = dx/l, ndy = dy/l;
    state.enemyBullets.push({ x,y, dx:ndx*speed, dy:ndy*speed, r:4, life:3.0, boss:isBoss });
  }
  function spawnParticle(x,y,color){ state.particles.push({ x,y, life:0.5, color }); }

  // Enemy waves
  function spawnWave(){
    // boss every 10 rounds
    if (state.round % 10 === 0) {
      const hp = 25 + Math.floor(state.round/10 - 1)*10;
      state.boss = { x: rng()*width, y: rng()*height, r: 26, hp, shoot:1.2 };
    }

    const toSpawn = Math.max(0, Math.min(25 - state.enemies.length, state.enemySpawnCount));
    for (let i=0;i<toSpawn;i++){
      const t = Math.floor(rng()*5); // 5 types
      const baseHp = (t===0? 5 : 3);
      const useEdges = state.characters.upgrades.distance.active;
      const rad = 14;
      let sx=0, sy=0;
      if (useEdges){
        // spawn near edges with margin
        const margin = 40; const band = 90; // area from margin..margin+band near edges
        const side = Math.floor(rng()*4); // 0:top 1:right 2:bottom 3:left
        if (side===0){ sx = margin + rng()*(width - margin*2); sy = margin + rng()*band; }
        if (side===1){ sx = width - margin - rng()*band; sy = margin + rng()*(height - margin*2); }
        if (side===2){ sx = margin + rng()*(width - margin*2); sy = height - margin - rng()*band; }
        if (side===3){ sx = margin + rng()*band; sy = margin + rng()*(height - margin*2); }
      } else {
        // spawn inside map but away from center
        const safeR = Math.min(width, height) * 0.18;
        let attempts=0; do{
          sx = rad + rng()*(width - rad*2);
          sy = rad + rng()*(height - rad*2);
          attempts++;
        } while (attempts<30 && ((sx-width/2)**2 + (sy-height/2)**2) < safeR*safeR);
      }
      const enemy = { type:t, x:sx, y:sy, r: 14, speed: 80 + t*20, cd: 0, hp: baseHp, maxHp: baseHp };
      // shooters wander slowly with bounce
      if (t===1 || t===2 || t===4){
        const ang = rng()*Math.PI*2; const spd = 40 + rng()*30;
        enemy.vx = Math.cos(ang)*spd; enemy.vy = Math.sin(ang)*spd; enemy.wanderCd = 0.8 + rng()*0.8;
      }
      state.enemies.push(enemy);
    }
    state.enemySpawnCount += 2;
  }

  // Round / Echo
  function startRound(){
    state.timeLeft = state.loopDuration;
    state.timeline = []; state.timelineClock = 0;
    state.enemies = []; state.bullets = []; state.enemyBullets = []; state.particles=[]; state.boss=null;
    spawnPlayer();
    spawnWave();
  }
  function endRound(){
    // Add echo if upgrade enabled
    if (state.characters.upgrades.echoEnabled()){
      // double echo chance
      const spawnCount = (state.characters.upgrades.doubleEchoRoll() ? 2 : 1);
      for (let i=0;i<spawnCount;i++) state.echoes.push({ timeline: state.timeline.slice(0), characterId: state.player.characterId });
    }
    // Round clear bonus score
    addScore(100);
  }

  function applyMutatorSwitch(){
    if (state.totalXP < 2000) { ui.toast('Недоступно'); return; }
    state.mutators.next(); ui.mutatorWave(); audio.play('mutate');
  }

  // Core loop
  let last = performance.now();
  function tick(now){
    const dt = Math.min(0.033, (now - last)/1000) * state.mutators.timeScale();
    last = now;
    if (!state.running || state.paused) { requestAnimationFrame(tick); return; }

    update(dt);
    render();
    requestAnimationFrame(tick);
  }

  function update(dt){
    // input record for echo at fixed step
    state.timelineClock += dt;
    while (state.timelineClock >= state.frameStep){
      state.timeline.push({ up:INPUT.up,down:INPUT.down,left:INPUT.left,right:INPUT.right,shoot:INPUT.shoot,dash:INPUT.dash });
      state.timelineClock -= state.frameStep;
    }

    state.timeLeft -= dt; if (state.timeLeft <= 0) { endRound(); state.round++; startRound(); ui.updateRound(state.round); }

    // player
    const p = state.player; if (!p) return;
    let moveX = (INPUT.right?1:0) - (INPUT.left?1:0);
    let moveY = (INPUT.down?1:0) - (INPUT.up?1:0);
    const n = normalize({x:moveX,y:moveY});
    const speed = p.speed * state.mutators.speedScale();
    p.x = clamp(p.x + n.x*speed*dt, p.r, width - p.r);
    p.y = clamp(p.y + n.y*speed*dt, p.r, height - p.r);

    if (INPUT.dash && p.dash.cd<=0){
      p.x = clamp(p.x + n.x*220, 0, width); p.y = clamp(p.y + n.y*220, 0, height); p.dash.cd=1.0; audio.play('dash');
    } else { p.dash.cd = Math.max(0, p.dash.cd-dt); }

    // shooting pattern based on character
    p.shootCd = Math.max(0, p.shootCd - dt);
    if (INPUT.shoot && p.shootCd<=0){
      const id = p.characterId;
      const aim = normalize({ x: mouse.x - p.x, y: mouse.y - p.y });
      if (id === 'sher') spawnBullet(p.x, p.y, aim.x, aim.y);
      if (id === 'dubsher'){ spawnBullet(p.x,p.y,aim.x,aim.y); spawnBullet(p.x,p.y,-aim.x,-aim.y); }
      if (id === 'quadsher'){
        const a90 = rotate(aim, Math.PI/2);
        const a180 = { x: -aim.x, y: -aim.y };
        const a270 = rotate(aim, -Math.PI/2);
        spawnBullet(p.x,p.y, aim.x, aim.y);
        spawnBullet(p.x,p.y, a180.x, a180.y);
        spawnBullet(p.x,p.y, a90.x, a90.y);
        spawnBullet(p.x,p.y, a270.x, a270.y);
      }
      p.shootCd = 0.18;
      audio.play('shoot');
    }

    if (INPUT.mutator){ INPUT.mutator = false; applyMutatorSwitch(); }
    if (INPUT.restart){ INPUT.restart = false; restartCycle(); }

    // echoes replay
    for (const echo of state.echoes){
      const char = state.characters.getById(echo.characterId);
      if (!echo.player) echo.player = { x: width/2, y: height/2, r: 10, shootCd:0 };
      const frameIndex = Math.floor((state.loopDuration - state.timeLeft)/state.frameStep);
      const cmd = echo.timeline[frameIndex] || {};
      const mX = (cmd.right?1:0) - (cmd.left?1:0); const mY = (cmd.down?1:0) - (cmd.up?1:0);
      const nn = normalize({x:mX,y:mY});
      echo.player.x = clamp(echo.player.x + nn.x* (200*state.characters.getSpeedMultiplier()) *dt, 0, width);
      echo.player.y = clamp(echo.player.y + nn.y* (200*state.characters.getSpeedMultiplier()) *dt, 0, height);
      echo.player.shootCd = Math.max(0, echo.player.shootCd-dt);
      if (cmd.shoot && echo.player.shootCd<=0){
        // Echoes re-use current mouse aim direction for consistency
        const aim = normalize({ x: mouse.x - echo.player.x, y: mouse.y - echo.player.y });
        if (char.id==='sher') spawnBullet(echo.player.x, echo.player.y, aim.x, aim.y);
        if (char.id==='dubsher'){ spawnBullet(echo.player.x, echo.player.y, aim.x, aim.y); spawnBullet(echo.player.x, echo.player.y, -aim.x, -aim.y);} 
        if (char.id==='quadsher'){
          const a90 = rotate(aim, Math.PI/2); const a180 = { x: -aim.x, y: -aim.y }; const a270 = rotate(aim, -Math.PI/2);
          spawnBullet(echo.player.x, echo.player.y, aim.x, aim.y);
          spawnBullet(echo.player.x, echo.player.y, a180.x, a180.y);
          spawnBullet(echo.player.x, echo.player.y, a90.x, a90.y);
          spawnBullet(echo.player.x, echo.player.y, a270.x, a270.y);
        } 
        echo.player.shootCd=0.18;
      }
    }

    // bullets
    for (const b of state.bullets){ b.x+=b.dx*dt; b.y+=b.dy*dt; b.life-=dt; if (state.mutators.current().id==='ricochet'){ if (b.x<0||b.x>width) { b.dx*=-1; b.x=clamp(b.x, 0, width);} if (b.y<0||b.y>height){ b.dy*=-1; b.y=clamp(b.y, 0, height);} } }
    state.bullets = state.bullets.filter(b=> b.life>0 && b.x>-20 && b.x<width+20 && b.y>-20 && b.y<height+20);

    // enemies behaviors
    for (const e of state.enemies){
      const toP = { x: state.player.x - e.x, y: state.player.y - e.y };
      const d = normalize(toP);
      if (e.type===0 || e.type===3){ // chase (fast for 3)
        const sp = (e.type===3? 140: e.speed) * state.mutators.enemySpeedScale();
        e.x = clamp(e.x + d.x*sp*dt, e.r, width - e.r); e.y = clamp(e.y + d.y*sp*dt, e.r, height - e.r);
      }
      if (e.type===1 || e.type===2 || e.type===4){ // shooters
        // wander move with bounce
        if (typeof e.vx==='number' && typeof e.vy==='number'){
          e.x += e.vx*dt; e.y += e.vy*dt;
          let bounced=false;
          if (e.x<e.r){ e.x=e.r; e.vx*=-1; bounced=true; }
          if (e.x>width-e.r){ e.x=width-e.r; e.vx*=-1; bounced=true; }
          if (e.y<e.r){ e.y=e.r; e.vy*=-1; bounced=true; }
          if (e.y>height-e.r){ e.y=height-e.r; e.vy*=-1; bounced=true; }
          e.wanderCd -= dt; if (e.wanderCd<=0){ // slight random course change
            const ang = (rng()-0.5)*0.7; const ca=Math.cos(ang), sa=Math.sin(ang); const vx=e.vx, vy=e.vy; e.vx=vx*ca - vy*sa; e.vy=vx*sa + vy*ca; e.wanderCd=0.8 + rng()*0.8;
          }
        }
        e.cd -= dt; if (e.cd<=0){
          // Only shoot when visible on screen
          if (e.x>=0 && e.x<=width && e.y>=0 && e.y<=height){
            if (e.type===1){
              spawnEnemyBullet(e.x,e.y, d.x, d.y);
            }
            if (e.type===2){
              const spread = 0.25; const d1 = rotate(d, spread), d2 = rotate(d, -spread);
              spawnEnemyBullet(e.x,e.y, d1.x, d1.y); spawnEnemyBullet(e.x,e.y, d2.x, d2.y);
            }
            if (e.type===4){
              const spread = 0.35; const dirs = [d, rotate(d, spread), rotate(d, -spread), rotate(d, spread*2)];
              for (const dir of dirs) spawnEnemyBullet(e.x,e.y, dir.x, dir.y);
            }
          }
          e.cd = 1.2;
        }
      }
    }

    // boss
    if (state.boss){
      const b = state.boss; const d = normalize({ x: state.player.x - b.x, y: state.player.y - b.y });
      b.x += d.x*60*dt; b.y += d.y*60*dt;
      b.shoot -= dt; if (b.shoot<=0){
        const spread = 0.35; // radians approx split using vectors
        const dirs = [d, rotate(d, spread), rotate(d, -spread)];
        for (const dir of dirs) spawnEnemyBullet(b.x,b.y, dir.x, dir.y, true);
        b.shoot = 1.0;
      }
      // instant kill check
      if (distSq(b, state.player) < (b.r+state.player.r)*(b.r+state.player.r)) loseLife(true);
    }

    // enemy bullets
    for (const b of state.enemyBullets){ b.x+=b.dx*dt; b.y+=b.dy*dt; b.life-=dt; }
    state.enemyBullets = state.enemyBullets.filter(b=> b.life>0 && b.x>-20 && b.x<width+20 && b.y>-20 && b.y<height+20);

    // collisions
    // player with enemies
    for (const e of state.enemies){ if (!e.dead && distSq(e, state.player) < (e.r+state.player.r)*(e.r+state.player.r)) { loseLife(false); } }
    for (const b of state.bullets){
      for (const e of state.enemies){
        if (distSq(b,e) < (b.r+e.r)*(b.r+e.r)){
          b.life=0; const dmg = rollDamage(b.dmg, state.characters.upgrades);
          e.hp = (e.hp||1) - dmg; if (e.hp<=0){ killEnemy(e); }
        }
      }
      if (state.boss && b.life>0){
        const boss = state.boss; if (distSq(b,boss) < (b.r+boss.r)*(b.r+boss.r)){
          b.life=0; const dmg = rollDamage(b.dmg, state.characters.upgrades);
          boss.hp -= dmg; if (boss.hp<=0){
            // boss down
            state.boss = null; addScore(500);
            for (let i=0;i<32;i++) spawnParticle(boss.x, boss.y, '#fff');
            audio.play('bossDown'); ui.toast('Босс повержен!');
          }
        }
      }
    }

    for (const b of state.enemyBullets){ if (distSq(b, state.player) < (b.r+state.player.r)*(b.r+state.player.r)) { b.life=0; loseLife(!!b.boss); } }
  }

  function rollDamage(base, upgrades){
    // Double Kill 30% or Mega Muscles 80% (exclusive)
    if (upgrades.megaMuscles.active){ return rng()<0.8? base*2: base; }
    if (upgrades.doubleKill.active){ return rng()<0.3? base*2: base; }
    return base;
  }

  function addScore(v){
    const mult = 1.0 + clamp(Math.floor(state.totalXP/1000)*0.1, 0, 1.0); // up to 2.0 at 10000 XP
    state.score += Math.floor(v * mult);
    ui.updateScore(state.score, mult);
  }

  function killEnemy(e){
    state.kills++; addScore(50);
    for (let i=0;i<8;i++) spawnParticle(e.x, e.y, '#ffd166');
    e.dead = true;
    audio.play('enemyDown');
    // remove enemy from list
    state.enemies = state.enemies.filter(en => en!==e);
    // Vampire upgrade: 20% to gain +1 life (up to 3?)
    if (state.characters.upgrades.activeOf && state.characters.upgrades.activeOf('vampire')){
      if (rng() < 0.2){ state.lives = Math.min(5, state.lives+1); ui.updateLives(state.lives); ui.toast('+1 жизнь'); }
    }
  }

  function loseLife(insta){
    state.lives = insta? 0 : Math.max(0, state.lives-1);
    ui.updateLives(state.lives, true);
    audio.play('hit'); ui.shake();
    if (state.lives<=0) gameOver();
  }

  function gameOver(){
    state.running=false;
    state.best = Math.max(state.best, state.score); storage.set('best', state.best);
    // Convert score to XP: 100 score -> 1 XP
    const gainedXP = Math.floor(state.score / 100);
    state.totalXP += gainedXP; storage.set('xp', state.totalXP);
    ui.showGameOver({ score: state.score, roundXP: gainedXP, totalXP: state.totalXP, best: state.best, echoes: state.echoes.length, kills: state.kills });
  }

  function restartCycle(){
    // Restart current 10s cycle without wiping progress
    state.timeLeft = state.loopDuration; state.timeline=[]; state.timelineClock=0;
    state.enemies=[]; state.bullets=[]; state.enemyBullets=[]; state.particles=[]; state.boss=null;
    spawnPlayer(); spawnWave();
  }

  function newRun(){
    state.round = 1; state.lives=3; state.score=0; state.kills=0; state.enemySpawnCount=3; state.echoes=[];
    startRound(); ui.updateRound(state.round); ui.updateScore(0, 1.0);
  }

  function render(){
    ctx.clearRect(0,0,width,height);
    // background subtle grid depending on theme
    ctx.globalAlpha = 0.08; ctx.strokeStyle = '#ffffff';
    const step=48; ctx.beginPath();
    for (let x=0;x<width;x+=step){ ctx.moveTo(x,0); ctx.lineTo(x,height); }
    for (let y=0;y<height;y+=step){ ctx.moveTo(0,y); ctx.lineTo(width,y); }
    ctx.stroke(); ctx.globalAlpha=1;

    // particles
    for (const p of state.particles){ p.life-=0.016; ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life*2); ctx.fillRect(p.x-2,p.y-2,4,4); }
    ctx.globalAlpha=1; state.particles = state.particles.filter(p=>p.life>0);

    // player
    if (state.player){ drawEntity(state.player, '#7df', state.player.characterId); }
    // echoes
    for (const e of state.echoes){ if (e.player) drawEntity(e.player, '#9fa', e.characterId); }
    // enemies + hp rings
    for (const e of state.enemies){ drawEntity(e, '#f66'); drawHpRing(e); }
    // boss
    if (state.boss){ drawEntity(state.boss, '#ff0'); drawBossHp(); }
    // bullets
    ctx.fillStyle='#fff'; for (const b of state.bullets){ ctx.fillRect(b.x-2,b.y-2,4,4); }
    ctx.fillStyle='#f77'; for (const b of state.enemyBullets){ ctx.fillRect(b.x-2,b.y-2,4,4); }

    // HUD
    ui.updateTimer(Math.max(0, state.timeLeft));
  }

  function drawEntity(ent, color, characterId){ ctx.fillStyle = state.characters.getFillStyle(ctx, ent.x, ent.y, ent.r, characterId, color); ctx.beginPath(); ctx.arc(ent.x, ent.y, ent.r, 0, Math.PI*2); ctx.fill(); }
  function drawHpRing(e){ if (e.maxHp){ const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp)); ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.arc(e.x, e.y, e.r + 6, -Math.PI/2, -Math.PI/2 + ratio*2*Math.PI); ctx.stroke(); ctx.lineWidth = 1; } }
  function drawBossHp(){ const b = state.boss; if (!b) return; const w=200,h=10,x=20,y=height-30; const p = clamp(b.hp / 100, 0, 1); // visual only
    ctx.fillStyle='rgba(255,255,255,.15)'; ctx.fillRect(x,y,w,h); ctx.fillStyle='#ffdd55'; ctx.fillRect(x,y,w*p,h);
  }

  function rotate(v, ang){ const ca=Math.cos(ang), sa=Math.sin(ang); return { x: v.x*ca - v.y*sa, y: v.x*sa + v.y*ca }; }
  function distSq(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }

  // Public API for UI
  const api = {
    start(){ if (state.running) return; state.running=true; newRun(); requestAnimationFrame(tick); ui.updateLives(state.lives); ui.updateScore(state.score, 1.0); },
    pause(v=true){ state.paused = v; },
    restartCycle,
    stop(){ state.running=false; },
    getState: ()=> state,
  };

  ui.on('start', ()=> api.start());

  return api;
}



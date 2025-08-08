import { createGame } from './runtime/game.js';
import { Storage } from './systems/storage.js';
import { AudioSystem } from './systems/audio.js';
import { UI } from './ui/ui.js';

// Bootstrap
const storage = new Storage();
const audio = new AudioSystem(storage);
const ui = new UI(storage, audio);

// Theme init
const savedTheme = storage.get('theme', 'default');
document.body.setAttribute('data-theme', savedTheme);
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
  themeSelect.value = savedTheme;
  themeSelect.addEventListener('change', () => {
    const val = themeSelect.value;
    document.body.setAttribute('data-theme', val);
    storage.set('theme', val);
  });
}

// Game setup
const canvas = document.getElementById('game-canvas');
const game = createGame({ canvas, storage, audio, ui });

// UI wiring
ui.mount(game);

// Menu background mini-sim
const menuCanvas = document.getElementById('menu-canvas');
if (menuCanvas){
  const mctx = menuCanvas.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio||1);
  function resizeMenu(){ const rect = menuCanvas.getBoundingClientRect(); menuCanvas.width = Math.floor(rect.width*dpr); menuCanvas.height = Math.floor(menuCanvas.height*dpr); mctx.setTransform(dpr,0,0,dpr,0,0); }
  resizeMenu(); window.addEventListener('resize', resizeMenu);
  let orbs = Array.from({length: 12}, ()=>({ x: Math.random()*menuCanvas.clientWidth, y: Math.random()*200+10, r: 6+Math.random()*6, vx:(Math.random()*2-1)*60, vy:(Math.random()*2-1)*60, c: `hsla(${Math.floor(Math.random()*360)},80%,60%,0.9)` }));
  function tickMenu(ts){ mctx.clearRect(0,0,menuCanvas.clientWidth,menuCanvas.clientHeight);
    // draw soft grid
    mctx.globalAlpha=.06; mctx.strokeStyle='#fff'; mctx.beginPath(); for (let x=0;x<menuCanvas.clientWidth;x+=48){ mctx.moveTo(x,0); mctx.lineTo(x,menuCanvas.clientHeight);} for (let y=0;y<menuCanvas.clientHeight;y+=48){ mctx.moveTo(0,y); mctx.lineTo(menuCanvas.clientWidth,y);} mctx.stroke(); mctx.globalAlpha=1;
    // update + draw orbs
    const dt=.016; for (const o of orbs){ o.x+=o.vx*dt; o.y+=o.vy*dt; if (o.x<o.r){o.x=o.r;o.vx*=-1;} if (o.x>menuCanvas.clientWidth-o.r){o.x=menuCanvas.clientWidth-o.r;o.vx*=-1;} if (o.y<o.r){o.y=o.r;o.vy*=-1;} if (o.y>menuCanvas.clientHeight-o.r){o.y=menuCanvas.clientHeight-o.r;o.vy*=-1;} }
    // interactions
    for (let i=0;i<orbs.length;i++){ for (let j=i+1;j<orbs.length;j++){ const a=orbs[i],b=orbs[j]; const dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy); if (d<120){ mctx.strokeStyle='rgba(255,255,255,.12)'; mctx.beginPath(); mctx.moveTo(a.x,a.y); mctx.lineTo(b.x,b.y); mctx.stroke(); } if (d<a.r+b.r){ const nx=dx/d, ny=dy/d; const overlap=(a.r+b.r-d)/2; a.x+=nx*overlap; a.y+=ny*overlap; b.x-=nx*overlap; b.y-=ny*overlap; a.vx*=-1; a.vy*=-1; b.vx*=-1; b.vy*=-1; } } }
    for (const o of orbs){ const grad = mctx.createRadialGradient(o.x,o.y,1,o.x,o.y,o.r*1.6); grad.addColorStop(0,'#fff'); grad.addColorStop(1,o.c); mctx.fillStyle=grad; mctx.beginPath(); mctx.arc(o.x,o.y,o.r,0,Math.PI*2); mctx.fill(); }
    requestAnimationFrame(tickMenu);
  }
  requestAnimationFrame(tickMenu);
  // pause sim when leaving menu not necessary; lightweight
}

// Menu buttons (guarded bindings)
document.querySelectorAll('[data-action="start"]').forEach(el => el.addEventListener('click', () => ui.showScreen('game')));
document.querySelectorAll('[data-action="select-character"]').forEach(el => el.addEventListener('click', () => ui.showScreen('characters')));
document.querySelectorAll('[data-action="shop"]').forEach(el => el.addEventListener('click', () => ui.showScreen('shop')));
document.querySelectorAll('[data-action="upgrades"]').forEach(el => el.addEventListener('click', () => ui.showScreen('upgrades')));
document.querySelectorAll('[data-action="settings"]').forEach(el => el.addEventListener('click', () => ui.showScreen('settings')));
document.querySelectorAll('[data-action="credits"]').forEach(el => el.addEventListener('click', () => ui.showScreen('credits')));
document.querySelectorAll('[data-action="levels"]').forEach(el => el.addEventListener('click', () => ui.showScreen('levels')));

// Global delegation fallback (ensures clicks always work)
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]'); if (!target) return;
  const action = target.getAttribute('data-action');
  switch(action){
    case 'start': ui.showScreen('game'); break;
    case 'select-character': ui.showScreen('characters'); break;
    case 'shop': ui.showScreen('shop'); break;
    case 'upgrades': ui.showScreen('upgrades'); break;
    case 'settings': ui.showScreen('settings'); break;
    case 'credits': ui.showScreen('credits'); break;
  }
});

// Settings wiring
const volRange = document.getElementById('volume-range');
if (volRange){
  volRange.value = storage.get('volume', 0.7);
  volRange.addEventListener('input', () => {
    audio.setVolume(parseFloat(volRange.value));
    storage.set('volume', volRange.value);
  });
}
const exportBtn = document.getElementById('export-save'); if (exportBtn) exportBtn.addEventListener('click', () => storage.export());
const importFile = document.getElementById('import-file'); if (importFile) importFile.addEventListener('change', e => storage.import(e.target.files[0]));
const resetBtn = document.getElementById('reset-progress'); if (resetBtn) resetBtn.addEventListener('click', () => ui.confirmReset());
const logoutBtn = document.getElementById('btn-logout'); if (logoutBtn) logoutBtn.addEventListener('click', ()=>{ storage.logout(); ui.showScreen('auth'); });

// Game controls
const btnExit = document.getElementById('btn-exit'); if (btnExit) btnExit.addEventListener('click', () => { game.stop(); ui.showScreen('menu'); });

document.getElementById('go-retry').addEventListener('click', () => ui.retry());
document.getElementById('go-menu').addEventListener('click', () => ui.showScreen('menu'));
const lwLevels = document.getElementById('lw-levels'); if (lwLevels){ lwLevels.addEventListener('click', ()=> ui.showScreen('levels')); }
const lwMenu = document.getElementById('lw-menu'); if (lwMenu){ lwMenu.addEventListener('click', ()=> ui.showScreen('menu')); }

// Auth wiring
const loginBtn = document.getElementById('auth-login');
const regBtn = document.getElementById('auth-register');
if (loginBtn && regBtn){
  loginBtn.addEventListener('click', ()=>{
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value;
    if (!u || !p) return alert('Введите имя пользователя и пароль');
    if (storage.login(u,p)) { ui.toast('Вход выполнен'); ui.showScreen('menu'); } else { alert('Неверные данные'); }
  });
  regBtn.addEventListener('click', ()=>{
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value;
    if (!u || !p) return alert('Введите имя пользователя и пароль');
    if (storage.register(u,p)) { ui.toast('Регистрация успешна'); ui.showScreen('menu'); } else { alert('Пользователь уже существует'); }
  });
}

// Экран старта зависит от наличия авторизованного пользователя
if (storage.user) { ui.showScreen('menu'); }
else { ui.showScreen('auth'); }



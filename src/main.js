import { createGame } from './runtime/game.js';
import { Storage } from './systems/storage.js';
import { AudioSystem } from './systems/audio.js';
import { UI } from './ui/ui.js';

// Bootstrap
const storage = new Storage();
const audio = new AudioSystem(storage);
const ui = new UI(storage, audio);

// Theme init
const savedTheme = storage.get('theme', 'white');
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

// Menu buttons (guarded bindings)
document.querySelectorAll('[data-action="start"]').forEach(el => el.addEventListener('click', () => ui.showScreen('game')));
document.querySelectorAll('[data-action="select-character"]').forEach(el => el.addEventListener('click', () => ui.showScreen('characters')));
document.querySelectorAll('[data-action="shop"]').forEach(el => el.addEventListener('click', () => ui.showScreen('shop')));
document.querySelectorAll('[data-action="upgrades"]').forEach(el => el.addEventListener('click', () => ui.showScreen('upgrades')));
document.querySelectorAll('[data-action="settings"]').forEach(el => el.addEventListener('click', () => ui.showScreen('settings')));
document.querySelectorAll('[data-action="credits"]').forEach(el => el.addEventListener('click', () => ui.showScreen('credits')));

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
const btnPause = document.getElementById('btn-pause'); if (btnPause) btnPause.addEventListener('click', () => ui.togglePause());
const btnExit = document.getElementById('btn-exit'); if (btnExit) btnExit.addEventListener('click', () => { game.stop(); ui.showScreen('menu'); });
const btnResume = document.getElementById('btn-resume'); if (btnResume) btnResume.addEventListener('click', () => ui.togglePause(false));
const btnRestart = document.getElementById('btn-restart'); if (btnRestart) btnRestart.addEventListener('click', () => game.restartCycle());

document.getElementById('go-retry').addEventListener('click', () => ui.retry());
document.getElementById('go-menu').addEventListener('click', () => ui.showScreen('menu'));

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



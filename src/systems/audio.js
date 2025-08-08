export class AudioSystem{
  constructor(storage){
    this.ctx = null; this.volume = parseFloat(storage.get('volume', 0.7));
    this.buffers = new Map();
    this.enabled = true;
    window.addEventListener('pointerdown', ()=> this._ensure());
  }
  _ensure(){ if (!this.ctx){ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); } }
  setVolume(v){ this.volume = v; }
  play(name){ if (!this.enabled) return; this._ensure(); const ctx = this.ctx; const now = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
    let freq = 440; let dur = 0.08; let type = 'sine';
    switch(name){
      case 'shoot': freq=680; dur=0.06; type='square'; break;
      case 'dash': freq=220; dur=0.05; type='sawtooth'; break;
      case 'enemyDown': freq=300; dur=0.12; type='triangle'; break;
      case 'hit': freq=110; dur=0.16; type='sawtooth'; break;
      case 'mutate': freq=520; dur=0.3; type='sine'; break;
      case 'bossDown': freq=180; dur=0.5; type='triangle'; break;
      default: break;
    }
    o.type=type; o.frequency.value=freq; g.gain.value = this.volume; o.connect(g).connect(ctx.destination); o.start(now); o.stop(now+dur);
  }
}



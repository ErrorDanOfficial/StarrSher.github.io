import { rng } from '../utils/rng.js';

export class Upgrades{
  constructor(storage){
    this.storage = storage;
    this.items = [
      { id:'echo', name:'ЭХО!', price:10, desc:'Позволяет спавнить эха' },
      { id:'doubleKill', name:'Дабл килл!', price:10, desc:'30% шанс двойного урона' },
      { id:'speed', name:'Скорость!', price:20, desc:'Скорость +10%' },
      { id:'doubleEcho', name:'Дабл эхо!', price:50, desc:'30% шанс спавна двух эха' },
      { id:'megaMuscles', name:'Мега мышцы!', price:100, desc:'80% шанс двойного урона (взаимоисключимо с Дабл килл!)' },
      { id:'distance', name:'Дистанция!', price:10, desc:'Враги спавнятся возле границ карты' },
      { id:'vampire', name:'Вампир', price:100, desc:'20% шанс получить +1 жизнь при убийстве' },
    ];
    this.owned = new Set(storage.get('owned_upgrades', []));
    this.toggles = storage.get('upgrade_toggles', {}); // id -> bool
    // enforce exclusivity at load
    if (this.toggles.megaMuscles && this.toggles.doubleKill){ this.toggles.doubleKill=false; this.save(); }
  }
  list(){ return this.items; }
  has(id){ return this.owned.has(id); }
  toggle(id){ if (!this.has(id)) return false; if (id==='megaMuscles' && this.toggles.doubleKill){ this.toggles.doubleKill=false; } if (id==='doubleKill' && this.toggles.megaMuscles){ this.toggles.megaMuscles=false; }
    this.toggles[id] = !this.toggles[id]; this.save(); return true; }
  activeOf(id){ return !!this.toggles[id]; }
  buy(id){ const it = this.items.find(i=>i.id===id); if (!it) return false; if (this.has(id)) return true; const xp = this.storage.get('xp',0); if (xp<it.price) return false; this.storage.set('xp', xp - it.price); this.owned.add(id); this.save(); return true; }
  save(){ this.storage.set('owned_upgrades', [...this.owned]); this.storage.set('upgrade_toggles', this.toggles); }

  echoEnabled(){ return this.has('echo') && this.activeOf('echo')!==false; }
  doubleEchoRoll(){ return this.activeOf('doubleEcho') && Math.random()<0.3; }
  speedMult(){ return this.activeOf('speed') ? 1.1 : 1.0; }
  get doubleKill(){ return { active: this.activeOf('doubleKill') }; }
  get megaMuscles(){ return { active: this.activeOf('megaMuscles') }; }
  get distance(){ return { active: this.activeOf('distance') }; }
}



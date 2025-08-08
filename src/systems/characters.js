import { Upgrades } from './upgrades.js';

export class Characters{
  constructor(storage){
    this.storage = storage;
    this.upgrades = new Upgrades(storage);
    this.characters = [
      { id:'sher', name:'Шер', price:0, desc:'Стреляет вперёд' },
      { id:'dubsher', name:'Дабшер', price:100, desc:'Стреляет вперёд и назад' },
      { id:'quadsher', name:'Квадшер', price:250, desc:'Стреляет во все 4 стороны' },
    ];
    this.skins = [
      { id:'sher-skin', for:'sher', price:50 },
      { id:'dubsher-skin', for:'dubsher', price:50 },
      { id:'quadsher-skin', for:'quadsher', price:50 },
    ];
    this.owned = new Set(storage.get('owned_chars', ['sher']));
    this.selected = storage.get('selected_char', 'sher');
    this.ownedSkins = new Set(storage.get('owned_skins', []));
    this.selectedSkin = storage.get('selected_skin', null);
  }
  save(){ this.storage.set('owned_chars', [...this.owned]); this.storage.set('selected_char', this.selected); this.storage.set('owned_skins', [...this.ownedSkins]); this.storage.set('selected_skin', this.selectedSkin); }
  getAll(){ return this.characters; }
  getById(id){ return this.characters.find(c=>c.id===id); }
  getSelected(){ return this.getById(this.selected); }
  isOwned(id){ return this.owned.has(id); }
  canAfford(price){ return this.storage.get('xp',0) >= price; }
  buyCharacter(id){ const c = this.getById(id); if (!c) return false; if (this.isOwned(id)) return true; if (!this.canAfford(c.price)) return false; const xp = this.storage.get('xp',0) - c.price; this.storage.set('xp', xp); this.owned.add(id); this.save(); return true; }
  select(id){ if (this.isOwned(id)) { this.selected=id; this.save(); return true; } return false; }
  // skins
  listSkins(){ return this.skins; }
  skinOwned(id){ return this.ownedSkins.has(id); }
  buySkin(id){ const s = this.skins.find(s=>s.id===id); if (!s) return false; if (this.skinOwned(id)) return true; if (!this.canAfford(s.price)) return false; const xp = this.storage.get('xp',0) - s.price; this.storage.set('xp', xp); this.ownedSkins.add(id); this.save(); return true; }
  selectSkin(id){ if (!id) { this.selectedSkin=null; this.save(); return true; } if (this.skinOwned(id)) { this.selectedSkin=id; this.save(); return true; } return false; }

  getSpeedMultiplier(){ return this.upgrades.speedMult(); }
  getDamage(){ return 1; }

  getFillStyle(ctx, x, y, r, characterId, fallback){
    const skin = this.selectedSkin;
    const gradientFor = {
      'sher-skin': ['#79f','#3df'],
      'dubsher-skin': ['#ff8a00','#ff3b5c'],
      'quadsher-skin': ['#9be15d','#00e3ae'],
    };
    const mapping = { sher:'sher-skin', dubsher:'dubsher-skin', quadsher:'quadsher-skin' };
    const expected = mapping[characterId];
    if (skin && skin===expected){
      // Animated conic-like gradient by rotating two radial gradients over time
      const t = (performance.now()%4000)/4000;
      const ang = t * Math.PI*2;
      const dx = Math.cos(ang)*r*0.6, dy = Math.sin(ang)*r*0.6;
      const g = ctx.createRadialGradient(x+dx,y+dy, r*0.1, x,y, r*1.1);
      const [a,b] = gradientFor[skin]||['#fff',fallback||'#fff'];
      g.addColorStop(0,a); g.addColorStop(0.5,b); g.addColorStop(1,a);
      return g;
    }
    return fallback||'#fff';
  }
}



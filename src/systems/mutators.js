export class Mutators{
  constructor(storage){
    this.storage = storage;
    this.index = storage.get('mutator_index', 0);
    this.list = [
      { id:'none', name:'Обычный мир', speed:1, time:1, enemy:1 },
      { id:'lowG', name:'Низкая гравитация', speed:1.2, time:1, enemy:1 },
      { id:'highG', name:'Высокая гравитация', speed:0.85, time:1, enemy:1 },
      { id:'slowmo', name:'Замедление времени', speed:1, time:0.75, enemy:1 },
      { id:'slippery', name:'Скользко', speed:1.1, time:1, enemy:1 },
      { id:'buffed', name:'Усиленные враги', speed:1, time:1, enemy:1.2 },
      { id:'ricochet', name:'Рикошет пуль', speed:1, time:1, enemy:1 },
    ];
  }
  current(){ return this.list[this.index % this.list.length]; }
  next(){ this.index = (this.index+1)%this.list.length; this.storage.set('mutator_index', this.index); return this.current(); }
  speedScale(){ return this.current().speed; }
  timeScale(){ return this.current().time; }
  enemySpeedScale(){ return this.current().enemy; }
}



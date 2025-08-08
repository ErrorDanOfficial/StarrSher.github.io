export class Storage{
  constructor(){ this.ns = 'anomaly_hunter_v1'; this.user = this._getCurrentUser(); }
  _userPrefix(){ return this.user? `${this.ns}:user:${this.user}:` : `${this.ns}:guest:`; }
  _getCurrentUser(){ try{ return JSON.parse(localStorage.getItem(`${this.ns}:current_user`)||'null'); } catch{ return null; } }
  _setCurrentUser(u){ localStorage.setItem(`${this.ns}:current_user`, JSON.stringify(u)); this.user = u; }
  get(key, def){ try{ const raw = localStorage.getItem(this._userPrefix()+key); return raw==null? def : JSON.parse(raw); } catch{ return def; } }
  set(key, val){ try{ localStorage.setItem(this._userPrefix()+key, JSON.stringify(val)); } catch{} }
  export(){ const bundle = {}; for (let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); if (!k.startsWith(this.ns+':')) continue; bundle[k] = localStorage.getItem(k); }
    const blob = new Blob([JSON.stringify(bundle,null,2)], { type:'application/json' }); const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='anomaly_save.json'; a.click(); URL.revokeObjectURL(a.href); }
  async import(file){ if (!file) return; const text = await file.text(); try{ const data = JSON.parse(text); Object.entries(data).forEach(([k,v])=> localStorage.setItem(k, v)); location.reload(); } catch{ alert('Неверный файл сохранения'); } }
  // Simple local auth (folder-like namespace via key prefixes)
  register(username, password){ const uKey = `${this.ns}:auth:${username}`; if (localStorage.getItem(uKey)) return false; localStorage.setItem(uKey, JSON.stringify({ username, password })); this._setCurrentUser(username); return true; }
  login(username, password){ const uKey = `${this.ns}:auth:${username}`; const raw = localStorage.getItem(uKey); if (!raw) return false; try{ const rec = JSON.parse(raw); if (rec.password!==password) return false; this._setCurrentUser(username); return true; } catch{ return false; } }
  logout(){ this._setCurrentUser(null); }
}



export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
export function length(v){ return Math.hypot(v.x, v.y); }
export function normalize(v){ const l = length(v); return l? { x: v.x/l, y: v.y/l } : { x:0, y:0 }; }
export function vecAdd(a,b){ return { x:a.x+b.x, y:a.y+b.y }; }
export function vecSub(a,b){ return { x:a.x-b.x, y:a.y-b.y }; }
export function vecMul(a,s){ return { x:a.x*s, y:a.y*s }; }



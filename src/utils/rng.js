let seed = (Math.random()*1e9)>>>0;
export function rng(){ seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return ((seed>>>0)%100000)/100000; }



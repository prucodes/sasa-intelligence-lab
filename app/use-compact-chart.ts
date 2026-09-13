'use client';
import {useSyncExternalStore} from 'react';
const query='(max-width: 1000px)';
const subscribe=(notify:()=>void)=>{
  if(typeof window.matchMedia!=='function')return()=>{};
  const media=window.matchMedia(query);
  media.addEventListener('change',notify);
  return()=>media.removeEventListener('change',notify);
};
const snapshot=()=>typeof window.matchMedia==='function'&&window.matchMedia(query).matches;
/** Change chart geometry, not its data domain, for narrow screens. */
export function useCompactChart(){return useSyncExternalStore(subscribe,snapshot,()=>false);}

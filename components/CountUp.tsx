'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';

// Counts up to `value` when it first appears, and from the old to the new value when it changes.
// Safe by design: if the tab is hidden, motion is reduced, or animation frames are paused,
// the real number is shown (a timer guarantees it), so a tile can never stay at 0.
export function CountUp({value,duration=700,className}:{value:number,duration?:number,className?:string}){
  const[shown,setShown]=useState(value);
  const from=useRef<number|null>(null);
  const calm=()=>document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Before the first paint after hydration, start from 0 so the count-up is visible.
  useLayoutEffect(()=>{if(from.current===null&&!calm())setShown(0);},[]);
  useEffect(()=>{
    const start=from.current??0;
    from.current=value;
    if(start===value||calm()){setShown(value);return;}
    let raf=0;const t0=performance.now();
    const tick=(t:number)=>{
      const p=Math.min(1,(t-t0)/duration);
      setShown(Math.round(start+(value-start)*(1-Math.pow(1-p,3))));
      if(p<1)raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const done=setTimeout(()=>{cancelAnimationFrame(raf);setShown(value);},duration+150);
    return()=>{cancelAnimationFrame(raf);clearTimeout(done);};
  },[value,duration]);
  return <span className={className?`num ${className}`:'num'}>{shown}</span>;
}

'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';

// Counts up to `value` when it first appears, and from the old to the new value when it changes.
// Uses requestAnimationFrame only; with "reduce motion" turned on it just shows the number.
export function CountUp({value,duration=900,className}:{value:number,duration?:number,className?:string}){
  const[shown,setShown]=useState(value);
  const from=useRef<number|null>(null);
  // Before the first paint after hydration, start from 0 so the count-up is visible.
  useLayoutEffect(()=>{
    if(from.current===null&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)setShown(0);
  },[]);
  useEffect(()=>{
    const start=from.current??0;
    from.current=value;
    if(start===value||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(value);return;}
    let raf=0;const t0=performance.now();
    const tick=(t:number)=>{
      const p=Math.min(1,(t-t0)/duration);
      const eased=1-Math.pow(1-p,4);
      setShown(Math.round(start+(value-start)*eased));
      if(p<1)raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[value,duration]);
  return <span className={className?`num ${className}`:'num'}>{shown}</span>;
}

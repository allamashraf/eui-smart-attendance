'use client';
import {useEffect,useState} from 'react';

export type AttendanceClass={
  id:string;code:string;title:string;instructorName:string;room:string;
  attended:number;sessionCount:number;
};
type EngineExports={
  attendance_percent:(attended:number,completedSessions:number)=>number;
  attendance_band:(attended:number,completedSessions:number,targetPercent:number)=>number;
};
const DEMO_TARGET_PERCENT=75;
let enginePromise:Promise<EngineExports>|null=null;
function getEngine():Promise<EngineExports>{
  if(!enginePromise){
    enginePromise=fetch('/attendance-engine.wasm',{cache:'force-cache'})
      .then(async response=>{
        if(!response.ok)throw new Error('C++ WebAssembly engine unavailable');
        return response.arrayBuffer();
      })
      .then(buffer=>WebAssembly.instantiate(buffer,{}))
      .then(({instance})=>{
        const exports=instance.exports as unknown as Partial<EngineExports>;
        if(typeof exports.attendance_percent!=='function'||typeof exports.attendance_band!=='function')
          throw new Error('Invalid C++ engine exports');
        return exports as EngineExports;
      })
      .catch(err=>{enginePromise=null;throw err;});
  }
  return enginePromise;
}
export function ClassAttendance({classes}:{classes:AttendanceClass[]}){
  const[engine,setEngine]=useState<EngineExports|null>(null);
  const[failed,setFailed]=useState(false);
  useEffect(()=>{
    if(classes.length===0)return;
    let alive=true;
    void getEngine().then(exports=>{if(alive)setEngine(exports);})
      .catch(()=>{if(alive)setFailed(true);});
    return()=>{alive=false;};
  },[classes.length]);
  return <div>
    {classes.map((sub,i)=>{
      const percent=engine?engine.attendance_percent(sub.attended,sub.sessionCount):null;
      const band=engine?engine.attendance_band(sub.attended,sub.sessionCount,DEMO_TARGET_PERCENT):null;
      return <div className="class-row" key={sub.id}>
        <span className="class-code" aria-hidden="true">{sub.code}</span>
        <div className="class-meta">
          <span className="row-title">{sub.title}</span>
          <span className="row-sub">{sub.instructorName} · {sub.room}</span>
          <div className="meter" aria-hidden="true">
            <span style={{width:`${percent!==null&&percent>=0?percent:0}%`,'--i':i} as React.CSSProperties}/>
          </div>
          {band===0&&<span className="row-sub">No completed sessions yet</span>}
          {band===1&&<span className="row-sub">Below demo target ({DEMO_TARGET_PERCENT}%) · {percent}%</span>}
          {band===2&&<span className="row-sub">Attendance: {percent}%</span>}
          {band===-1&&<span className="row-sub">Attendance data could not be calculated</span>}
        </div>
        <div className="class-count" aria-label={`${sub.attended} of ${sub.sessionCount} completed sessions`}>{sub.attended}<span className="muted">/{sub.sessionCount}</span></div>
      </div>;
    })}
    {!classes.length&&<p className="empty">No classes yet.</p>}
    {classes.length>0&&<p className="small muted" style={{marginTop:12}}>Attendance analytics powered by C++ WebAssembly. The 75% target is illustrative, not an official EUI policy.</p>}
    {failed&&<p className="small" role="alert">C++ attendance analytics are unavailable. Raw session counts are still shown.</p>}
  </div>;
}

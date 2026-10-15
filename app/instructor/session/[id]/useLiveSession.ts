'use client';
// Shared by the live board and the projector page.
// - Polls GET /live every 2 s (instructor screens only; students never poll).
// - Fetches a new QR exactly when the current one expires, using the server's clock.
import {useCallback,useEffect,useRef,useState} from 'react';

export type RosterRow={id:string,name:string,number:string|null,status:string|null,verification:string|null,method:string|null,checkedInAt:string|null,location:string|null,distanceM:number|null};
export type Live={state:'active'|'ended',qrOpen:boolean,anchor:{accuracyM:number,setAt:string}|null,
  counts:{roster:number,attended:number,needsReview:number},roster:RosterRow[],
  recent:{name:string,status:string,verification:string,checkedInAt:string}[]};
export type Challenge={state:'active'|'qr_closed'|'ended',qrImage?:string,expiresAt?:string,now?:string,intervalSeconds?:number};

const LIVE_POLL_MS=2000;

export async function postJson(path:string,data:Record<string,unknown>){
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Request failed');
  return d;
}

export function useLiveSession(sessionId:string,initiallyActive:boolean){
  const[live,setLive]=useState<Live|null>(null);
  const[challenge,setChallenge]=useState<Challenge|null>(null);
  const[error,setError]=useState('');
  const[,setTick]=useState(0);
  const skew=useRef(0);        // server clock minus this computer's clock, in ms
  const alive=useRef(true);
  useEffect(()=>()=>{alive.current=false;},[]);

  const loadLive=useCallback(async()=>{
    try{
      const r=await fetch(`/api/sessions/${sessionId}/live`,{cache:'no-store'});const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Could not load live data.');
      if(alive.current){setLive(d);setError('');}
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not load live data.');}
  },[sessionId]);

  const loadChallenge=useCallback(async()=>{
    const sent=Date.now();
    try{
      const r=await fetch(`/api/sessions/${sessionId}/challenge`,{cache:'no-store'});const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Could not load the QR code.');
      // The server read its clock about halfway through the request.
      if(d.now)skew.current=Date.parse(d.now)-(sent+Date.now())/2;
      if(alive.current)setChallenge(d);
    }catch(e){
      if(!alive.current)return;
      setError(e instanceof Error?e.message:'Could not load the QR code.');
      setTimeout(()=>{if(alive.current)loadChallenge();},2000); // try again shortly
    }
  },[sessionId]);

  // First load, then poll /live every 2 s while the session is active (skipped while the tab is hidden).
  const polling=live?live.state==='active':initiallyActive;
  useEffect(()=>{loadLive();loadChallenge();},[loadLive,loadChallenge]);
  useEffect(()=>{
    if(!polling)return;
    const t=setInterval(()=>{if(!document.hidden)loadLive();},LIVE_POLL_MS);
    return()=>clearInterval(t);
  },[polling,loadLive]);

  // New QR exactly when the current one expires (+100 ms), measured on the server's clock.
  // If the answer still has the same expiry (this computer was early), the effect simply runs again.
  useEffect(()=>{
    if(challenge?.state!=='active'||!challenge.expiresAt)return;
    const wait=Math.max(0,Date.parse(challenge.expiresAt)-(Date.now()+skew.current))+100;
    const t=setTimeout(loadChallenge,wait);
    return()=>clearTimeout(t);
  },[challenge,loadChallenge]);

  // The QR was closed/reopened or the session ended (maybe from another tab): fetch the QR state again.
  // This reacts only when /live reports a change, never in a loop.
  const qrShouldShow=live?(live.state==='active'&&live.qrOpen):null;
  const challengeState=useRef<string|undefined>(undefined);
  challengeState.current=challenge?.state;
  useEffect(()=>{
    if(qrShouldShow===null||challengeState.current===undefined)return;
    if(qrShouldShow!==(challengeState.current==='active'))loadChallenge();
  },[qrShouldShow,loadChallenge]);

  // Re-render 4 times a second for the countdown.
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),250);return()=>clearInterval(t);},[]);
  const remainingMs=challenge?.state==='active'&&challenge.expiresAt?Math.max(0,Date.parse(challenge.expiresAt)-(Date.now()+skew.current)):0;

  const refresh=useCallback(()=>{loadLive();loadChallenge();},[loadLive,loadChallenge]);
  return {live,challenge,error,setError,remainingMs,refresh};
}

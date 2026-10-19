'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ChevronRight,Users} from 'lucide-react';
import {StateBadge} from '@/components/Shell';

type Row={id:string,code:string,title:string,started:string,attended:number,state:string};

// Newest five sessions first; "Show all" reveals the rest that the page already loaded.
export function SessionList({rows}:{rows:Row[]}){
  const[all,setAll]=useState(false);
  const shown=all?rows:rows.slice(0,5);
  if(!rows.length)return <p className="empty">No sessions yet.</p>;
  return <>
    <div className="rows">{shown.map(s=><Link className="record record-link" key={s.id} href={`/instructor/session/${s.id}`}>
      <div className="record-main"><b>{s.code} · {s.title}</b><time className="mono">{s.started}</time></div>
      <div className="record-end"><span className="record-count" aria-label={`${s.attended} check-ins`}><Users size={14} aria-hidden="true"/><span className="num">{s.attended}</span></span><StateBadge value={s.state}/><ChevronRight size={16} className="muted" aria-hidden="true"/></div>
    </Link>)}</div>
    {rows.length>5&&<button type="button" className="btn btn-ghost btn-sm section-gap" onClick={()=>setAll(!all)}>{all?'Show less':'Show all'}</button>}
  </>;
}

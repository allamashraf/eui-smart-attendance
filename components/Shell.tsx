import Link from 'next/link';
import {BookOpen,GraduationCap,LayoutDashboard,ScanLine,type LucideIcon} from 'lucide-react';
import type {AppUser} from '@/lib/auth';
import {LogoutButton} from './LogoutButton';
import {CountUp} from './CountUp';

const menus:Record<AppUser['role'],{url:string,label:string,Icon:LucideIcon}[]>={
  student:[{url:'/student',label:'My attendance',Icon:GraduationCap},{url:'/checkin',label:'Check in',Icon:ScanLine}],
  instructor:[{url:'/instructor',label:'My classes',Icon:BookOpen}],
  admin:[{url:'/admin',label:'Control center',Icon:LayoutDashboard}],
};
const roleLabel:Record<AppUser['role'],string>={student:'Student',instructor:'Instructor',admin:'Administrator'};

// The product mark: concentric "scan" rings. Deliberately not a university logo.
export function BrandMark({size=28}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
    <rect width="28" height="28" rx="8" fill="#0E1113"/>
    <circle cx="14" cy="14" r="8.2" fill="none" stroke="#5FD3BC" strokeWidth="1.5" opacity=".45"/>
    <circle cx="14" cy="14" r="4.6" fill="none" stroke="#5FD3BC" strokeWidth="1.8"/>
    <circle cx="14" cy="14" r="1.8" fill="#FFFFFF"/>
  </svg>;
}

export function SiteFooter(){
  return <footer className="site-footer">
    <span>EUI Smart Attendance · student project prototype. <b>Not an official EUI system.</b></span>
    <span>All records are synthetic demo data.</span>
  </footer>;
}

// `calm`: no entrance animation (the check-in page keeps the phone free for the camera).
export function Shell({user,active,heading,subtitle,eyebrow,aside,calm=false,children}:{user:AppUser,active:string,heading:string,subtitle?:string,eyebrow?:React.ReactNode,aside?:React.ReactNode,calm?:boolean,children:React.ReactNode}){
  const initials=user.full_name.replace(/^Dr\.?\s+/,'').split(' ').map(x=>x[0]).slice(0,2).join('');
  return <div className="app">
    <a className="skip" href="#main">Skip to content</a>
    <header className="topbar"><div className="topbar-in">
      <Link className="brand" href="/" aria-label="EUI Attendance, home"><BrandMark/><span className="brand-name">EUI Attendance</span><span className="brand-tag">Demo</span></Link>
      <nav className="nav" aria-label="Main">{menus[user.role].map(({url,label,Icon})=>
        <Link key={url} href={url} aria-current={active===url?'page':undefined}><Icon size={16} aria-hidden="true"/>{label}</Link>)}</nav>
      <div className="topbar-end">
        <div className="who"><b>{user.full_name}</b><span>{roleLabel[user.role]}</span></div>
        <span className="avatar" aria-hidden="true">{initials}</span>
        <LogoutButton/>
      </div>
    </div></header>
    <main id="main" className="page">
      <div className={calm?'page-head':'page-head reveal'}>
        <div><span className="eyebrow">{eyebrow??roleLabel[user.role]}</span><h1 className="page-title">{heading}</h1>{subtitle&&<p className="page-sub">{subtitle}</p>}</div>
        {aside}
      </div>
      {children}
    </main>
    <SiteFooter/>
  </div>;
}

// A number tile. Numbers count up; `i` staggers the entrance.
export function Stat({label,value,note,Icon,i=0}:{label:string,value:string|number,note?:string,Icon:LucideIcon,i?:number}){
  return <div className="card stat reveal" style={{'--i':i} as React.CSSProperties}>
    <div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={16} aria-hidden="true"/></span></div>
    <div className="stat-value">{typeof value==='number'?<CountUp value={value}/>:value}</div>
    {note&&<div className="stat-note">{note}</div>}
  </div>;
}

export function SectionHeader({title,note,aside}:{title:string,note?:string,aside?:React.ReactNode}){
  return <div className="card-head"><div><h2 className="card-title">{title}</h2>{note&&<p className="card-sub">{note}</p>}</div>{aside}</div>;
}

const badgeText:Record<string,string>={needs_review:'Needs review',qr_closed:'QR closed',not_collected:'Not collected'};
export function StateBadge({value}:{value:string}){
  const text=badgeText[value]??value.charAt(0).toUpperCase()+value.slice(1).replace(/_/g,' ');
  return <span className={'badge badge-'+value.toLowerCase()}>{text}</span>;
}

export function displayDate(date:Date|string|null|undefined){return date?new Date(date).toLocaleString('en-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}):'—';}
export function displayTime(date:Date|string|null|undefined){return date?new Date(date).toLocaleTimeString('en-EG',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}):'';}

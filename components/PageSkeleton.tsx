import {BrandMark} from './Shell';

// Shown by the route's loading.tsx while the server prepares the page: the same layout, in grey.
export function PageSkeleton({stats=4,wide=false}:{stats?:number,wide?:boolean}){
  return <div className="app" aria-busy="true" aria-label="Loading">
    <div className="topbar"><div className="topbar-in"><span className="brand"><BrandMark/><span>EUI Attendance</span></span></div></div>
    <main className="page">
      <div className="page-head"><div style={{width:'100%'}}>
        <div className="skeleton" style={{height:12,width:90}}/>
        <div className="skeleton" style={{height:36,width:'min(420px,80%)',marginTop:14}}/>
        <div className="skeleton" style={{height:14,width:'min(520px,90%)',marginTop:14}}/>
      </div></div>
      {stats>0&&<div className={`grid grid-${stats}`}>{Array.from({length:stats},(_,i)=><div key={i} className="card stat"><div className="skeleton" style={{height:12,width:'60%'}}/><div className="skeleton" style={{height:34,width:'40%'}}/></div>)}</div>}
      <div className={wide?'board section':'split section'}>
        <div className="card card-pad stack"><div className="skeleton" style={{height:16,width:'40%'}}/><div className="skeleton" style={{height:wide?300:160}}/></div>
        <div className="card card-pad stack"><div className="skeleton" style={{height:16,width:'30%'}}/>{[0,1,2,3].map(i=><div key={i} className="skeleton" style={{height:20}}/>)}</div>
      </div>
    </main>
  </div>;
}

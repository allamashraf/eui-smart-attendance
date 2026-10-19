'use client';
import {useState} from 'react';
import {LogOut,Loader2} from 'lucide-react';
export function LogoutButton() {
  const[busy,setBusy]=useState(false);
  async function logout() {
    setBusy(true);
    await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    window.location.href='/login';
  }
  return <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={logout} disabled={busy} aria-label="Sign out" title="Sign out">
    {busy?<Loader2 size={16} className="spin" aria-hidden="true"/>:<LogOut size={16} aria-hidden="true"/>}
  </button>;
}

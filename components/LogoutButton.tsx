'use client';
import {LogOut} from 'lucide-react';
export function LogoutButton() {
  async function logout() {
    await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    window.location.href='/login';
  }
  return <button type="button" className="nav-logout" onClick={logout}><LogOut size={17}/> Sign out</button>;
}

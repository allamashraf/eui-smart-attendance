import {currentUser,defaultRoute} from '@/lib/auth';
import {redirect} from 'next/navigation';
import {LoginPanel} from './LoginPanel';
export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string}>}){const user=await currentUser();if(user)redirect(defaultRoute(user.role));const params=await searchParams;return <LoginPanel nextPath={typeof params.next==='string'?params.next:''}/>;}

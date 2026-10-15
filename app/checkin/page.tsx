import {currentUser,defaultRoute} from '@/lib/auth';
import {redirect} from 'next/navigation';
import {Shell} from '@/components/Shell';
import {CheckinClient} from './CheckinClient';
export default async function CheckinPage({searchParams}:{searchParams:Promise<{token?:string}>}){
  const params=await searchParams;const user=await currentUser();
  if(!user)redirect('/login?next='+encodeURIComponent('/checkin?token='+encodeURIComponent(params.token||'')));
  if(user.role!=='student')redirect(defaultRoute(user.role));
  return <Shell user={user} active="/checkin" heading="Class check-in" subtitle="Scan a live QR on the instructor's display or paste the session token."><CheckinClient initialToken={params.token||''}/></Shell>;
}

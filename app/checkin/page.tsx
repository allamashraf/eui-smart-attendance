import {currentUser,defaultRoute} from '@/lib/auth';
import {redirect} from 'next/navigation';
import {Shell} from '@/components/Shell';
import {QR} from '@/lib/config';
import {CheckinClient} from './CheckinClient';
// No ?token= support: the only way to check in is scanning the live code with the camera below.
export default async function CheckinPage(){
  const user=await currentUser();
  if(!user)redirect('/login?next=/checkin');
  if(user.role!=='student')redirect(defaultRoute(user.role));
  return <Shell calm user={user} active="/checkin" heading="Check in"><CheckinClient intervalSeconds={QR.intervalSeconds}/></Shell>;
}

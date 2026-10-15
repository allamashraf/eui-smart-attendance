import { redirect } from 'next/navigation';
import { currentUser, defaultRoute } from '@/lib/auth';
export default async function Index() {
  const u=await currentUser(); redirect(u?defaultRoute(u.role):'/login');
}

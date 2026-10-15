import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata = {title:'EUI Smart Attendance | Demo',description:'University attendance prototype with rotating QR codes, enrollment checks and human-reviewed risk alerts.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}

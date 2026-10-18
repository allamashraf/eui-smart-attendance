import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

// Geist for text, Geist Mono for every number, time and ID (digits never jump).
// next/font downloads the fonts at build time and serves them from this site.
const sans = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'EUI Smart Attendance | Demo',
  description: 'University attendance prototype with rotating QR codes, enrollment checks and human-reviewed risk alerts.',
};
export const viewport: Viewport = { themeColor: '#F6F7F5', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body>{children}</body></html>;
}

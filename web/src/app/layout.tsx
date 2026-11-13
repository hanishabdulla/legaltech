import type { Metadata } from 'next';
import { Geist, Geist_Mono, Newsreader } from 'next/font/google';

import { SiteFooter, SiteHeader } from '@/components/site-header';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const newsreader = Newsreader({ variable: '--font-newsreader', subsets: ['latin'], style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: { default: 'Common Counsel · Remedy', template: '%s · Common Counsel' },
  description: 'Crisis support for people in Leeds, and lawyer-checked answers for small businesses.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}

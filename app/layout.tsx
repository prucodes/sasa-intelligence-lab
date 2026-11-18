import type { Metadata } from 'next';
import { VISIT_COUNTER_SCRIPT } from '@/lib/visit-counter';
import './globals.css';
import './mobile-refinement.css';
import './interaction-polish.css';
import './typefaces.css';
import './motion.css';

export const metadata: Metadata = {
  title: 'SASA Intelligence Lab',
  description: 'Evidence-first sanitation decision-intelligence prototype',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The root layout wraps every route, so this loads Inter app-wide; the rule targets the Pages router's per-page heads. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: VISIT_COUNTER_SCRIPT }} />
      </body>
    </html>
  );
}

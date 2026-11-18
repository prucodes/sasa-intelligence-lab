import type { Metadata } from 'next';
import { VISIT_COUNTER_SCRIPT } from '@/lib/visit-counter';
import { EARLY_REVEAL_SCRIPT } from '@/lib/early-reveal';
import './globals.css';
import './mobile-refinement.css';
import './interaction-polish.css';
import './typefaces.css';
import './motion.css';

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';

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
        {/* Inter loads without blocking first paint: the page shows in the system face and swaps to
            Inter when it arrives (display=swap), instead of waiting on a third-party stylesheet. */}
        <link rel="preload" as="style" href={FONT_CSS} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href=${JSON.stringify(FONT_CSS)};document.head.appendChild(l);})();` }} />
        <noscript><link rel="stylesheet" href={FONT_CSS} /></noscript>
        {/* Show the prerendered page at once when the link asks for what it already holds (governed
            data, light theme). Other modes and the dark theme keep the shell hidden until the client
            resolves them, so a link never flashes the wrong mode. Runs before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_REVEAL_SCRIPT }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: VISIT_COUNTER_SCRIPT }} />
      </body>
    </html>
  );
}

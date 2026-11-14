import localFont from 'next/font/local';
import { AppShell } from '@/components/AppShell';
import './globals.css';

// Same typefaces as controla.dev, hosted locally (licenses in ./fonts/LICENSE.txt).
const inter = localFont({ src: './fonts/inter.woff2', variable: '--font-inter', display: 'swap', weight: '100 900' });
const space = localFont({ src: './fonts/space-grotesk.woff2', variable: '--font-space', display: 'swap', weight: '300 700' });
const mono = localFont({ src: './fonts/jetbrains-mono.woff2', variable: '--font-jetbrains', display: 'swap', weight: '100 800', preload: false });

export const metadata = {
  title: 'Controla',
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" className={`${inter.variable} ${space.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Apply the stored theme (else the system preference) before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

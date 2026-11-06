import type { Metadata } from 'next';
import { Cairo, Inter } from 'next/font/google';
import './globals.css';
import { Shell } from '@/components/layout/Shell';
import { Toaster } from 'sonner';
import { SessionProviderWrapper } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo' });

export const metadata: Metadata = {
  title: 'Sales OS',
  description: 'Sales OS — Revenue Operating System & CRM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${cairo.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <SessionProviderWrapper>
          <Toaster position="bottom-right" richColors />
          <Shell>{children}</Shell>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

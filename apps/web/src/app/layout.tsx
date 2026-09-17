import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Panda Product OS',
  description: 'Idea → Validate → Build → Launch → Revenue → Scale',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

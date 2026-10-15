import type { Metadata } from 'next';

import './styles.css';
import AppNavigation from './components/AppNavigation';

export const metadata: Metadata = {
  title: {
    default: 'SEO Auditor',
    template: '%s | SEO Auditor',
  },
  description: 'Open-source technical SEO auditing and monitoring platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AppNavigation />{children}</body>
    </html>
  );
}

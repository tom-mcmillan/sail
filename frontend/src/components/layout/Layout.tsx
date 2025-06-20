import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GetSail - Share Knowledge with AI Assistants',
  description: 'Connect your documents, Google Drive, and GitHub repositories as MCP servers for AI assistants to access your knowledge.',
  keywords: ['AI', 'MCP', 'knowledge sharing', 'documents', 'collaboration'],
  authors: [{ name: 'GetSail Team' }],
  openGraph: {
    title: 'GetSail - Share Knowledge with AI Assistants',
    description: 'Connect your documents, Google Drive, and GitHub repositories as MCP servers for AI assistants.',
    url: 'https://getsail.net',
    siteName: 'GetSail',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GetSail - Share Knowledge with AI Assistants',
    description: 'Connect your documents, Google Drive, and GitHub repositories as MCP servers for AI assistants.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
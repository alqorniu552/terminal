import type {Metadata} from 'next';
import { Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-code-pro',
});

export const metadata: Metadata = {
  title: 'Command Center - AI & CTF Terminal Simulation',
  description: 'An interactive AI-powered terminal where you can navigate a virtual filesystem, solve Capture The Flag (CTF) challenges, and use AI-driven hacking tools.',
  openGraph: {
    title: 'Command Center - AI & CTF Terminal Simulation',
    description: 'An interactive terminal simulation with AI-driven hacking tools.',
    type: 'website',
    url: 'https://command-center.firebaseapp.com', // Replace with your actual domain
    images: [
      {
        url: 'https://placehold.co/1200x630.png', // Replace with a compelling preview image
        width: 1200,
        height: 630,
        alt: 'A preview of the Command Center AI Terminal Interface.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Command Center - AI & CTF Terminal Simulation',
    description: 'An interactive terminal simulation with AI-driven hacking tools.',
    images: ['https://placehold.co/1200x630.png'], // Replace with a compelling preview image
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark h-full ${sourceCodePro.variable}`}>
      <head />
      <body className="h-full font-code antialiased" suppressHydrationWarning={true}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

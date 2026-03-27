import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Malik\'s Quantum Terminal | Global Intelligence Platform',
  description: 'Advanced global intelligence, financial markets, geopolitical & AI analytics platform combining Bloomberg Terminal, Palantir Gotham, and CryptoQuant capabilities.',
  generator: 'self',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  keywords: ['intelligence', 'terminal', 'markets', 'crypto', 'analytics', 'geopolitical', 'AI'],
  openGraph: {
    title: 'Malik\'s Quantum Terminal',
    description: 'Global intelligence and financial analytics platform',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased dark">
        {children}
      </body>
    </html>
  )
}

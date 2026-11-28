import type { Metadata } from 'next'
import { Fira_Code, Inter, Outfit } from 'next/font/google'

import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
})

const firaCode = Fira_Code({
  variable: '--font-fira-code',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: { default: 'Worq', template: '%s — Worq' },
  description:
    'Find a study or co-working Space and hold an open seat now. Host-updated seat maps, curated amenities, and instant sandbox holds.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${firaCode.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground selection:bg-accent selection:text-primary">
        {children}
      </body>
    </html>
  )
}

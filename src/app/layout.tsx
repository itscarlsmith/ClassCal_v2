import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'ClassCal - Online Teaching Platform',
  description: 'All-in-one platform for online teachers to manage scheduling, lessons, students, and payments.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <Providers>
          <Toaster
            position="top-center"
            offset={72}
            richColors
            closeButton
            toastOptions={{ duration: 4000 }}
          />
          {children}
        </Providers>
      </body>
    </html>
  )
}

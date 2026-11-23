import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { Toaster } from '@/components/toast'

import './globals.scss'

export const metadata: Metadata = {
  title: process.env.KENT_NAME?.trim() || 'Kent',
  description: 'Chat with Kent',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}

/**
 * FACEPrep LMS — Learning Management System
 * Copyright (c) 2026 Dhanush Sadhasivan. All rights reserved.
 */

import './globals.css'
import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/Toast'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FACEPrep LMS — Trainer & Learning Platform',
  description: 'FACEPrep Learning Management System for trainer evaluation, skill badges, and HackerRank contest progress tracking. Designed & Developed by Dhanush Sadhasivan.',
  authors: [{ name: 'Dhanush Sadhasivan' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={outfit.className}>
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

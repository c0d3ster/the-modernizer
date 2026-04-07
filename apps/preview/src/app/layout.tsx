import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'The Modernizer - Preview',
  description: 'Component library preview and test harness',
}

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

export default RootLayout

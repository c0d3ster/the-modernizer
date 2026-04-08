'use client'

import * as React from 'react'
import type { NavItem } from '@modernizer/schema'
import { Button } from '../shadcn/button'
import { cn } from '../lib/cn'
import { container } from '../styles/tokens'
import { Menu, X } from 'lucide-react'

interface NavbarProps {
  siteName: string
  nav: NavItem[]
  ctaText?: string
  ctaUrl?: string
}

export const Navbar = ({ siteName, nav, ctaText, ctaUrl }: NavbarProps): React.ReactElement => {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className={cn(container, 'flex h-16 items-center justify-between')}>
        <a href="/" className="text-lg font-bold tracking-tight">{siteName}</a>

        {/* desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <a key={item.url} href={item.url} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </a>
          ))}
          {ctaText && ctaUrl && (
            <Button asChild size="sm">
              <a href={ctaUrl}>{ctaText}</a>
            </Button>
          )}
        </nav>

        {/* mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* mobile menu */}
      {open && (
        <div className="border-t bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {nav.map((item) => (
              <a key={item.url} href={item.url} className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ))}
            {ctaText && ctaUrl && (
              <Button asChild size="sm" className="w-fit">
                <a href={ctaUrl}>{ctaText}</a>
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

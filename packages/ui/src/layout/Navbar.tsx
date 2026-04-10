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
    <header className="sticky top-0 z-50 border-b border-primary/15 bg-primary text-primary-foreground shadow-sm">
      <div className={cn(container, 'flex h-16 items-center justify-between')}>
        <a href="/" className="text-lg font-bold tracking-tight text-primary-foreground">
          {siteName}
        </a>

        {/* desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <a
              key={item.url}
              href={item.url}
              className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground"
            >
              {item.label}
            </a>
          ))}
          {ctaText && ctaUrl && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <a href={ctaUrl}>{ctaText}</a>
            </Button>
          )}
        </nav>

        {/* mobile toggle */}
        <button
          type="button"
          className="text-primary-foreground md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* mobile menu */}
      {open && (
        <div className="border-t border-primary-foreground/15 bg-primary px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {nav.map((item) => (
              <a
                key={item.url}
                href={item.url}
                className="text-sm text-primary-foreground/90"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            {ctaText && ctaUrl && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="w-fit border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
              >
                <a href={ctaUrl}>{ctaText}</a>
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

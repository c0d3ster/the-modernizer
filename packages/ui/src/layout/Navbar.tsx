'use client'

import * as React from 'react'
import Link from 'next/link'
import type { NavItem } from '@modernizer/schema'
import { Button } from '../shadcn/button'
import { cn } from '../lib/cn'
import { container } from '../styles/tokens'
import { Menu, X, ChevronDown } from 'lucide-react'

interface NavbarProps {
  siteName: string
  nav: NavItem[]
  ctaText?: string
  ctaUrl?: string
}

const DesktopDropdown = ({ item }: { item: NavItem }): React.ReactElement => {
  const hasChildren = item.children && item.children.length > 0
  const linkHref = item.url && item.url !== '#' ? item.url : undefined

  if (!hasChildren) {
    return (
      <a
        href={linkHref ?? '#'}
        className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground"
      >
        {item.label}
      </a>
    )
  }

  return (
    <div className="group relative flex items-center gap-1">
      {linkHref ? (
        <a
          href={linkHref}
          className="text-sm text-primary-foreground/85 transition-colors hover:text-primary-foreground"
        >
          {item.label}
        </a>
      ) : (
        <span className="text-sm text-primary-foreground/85">{item.label}</span>
      )}
      <ChevronDown
        className="h-3.5 w-3.5 transition-transform group-hover:rotate-180"
        aria-hidden
      />
      <div className="invisible absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-card py-1 shadow-lg opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        {item.children!.map((child) => (
          <a
            key={child.url}
            href={child.url}
            className="block px-4 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-foreground"
          >
            {child.label}
          </a>
        ))}
      </div>
    </div>
  )
}

const MobileNavItem = ({ item, onClose }: { item: NavItem; onClose: () => void }): React.ReactElement => {
  const [expanded, setExpanded] = React.useState(false)
  const hasChildren = item.children && item.children.length > 0
  const linkHref = item.url && item.url !== '#' ? item.url : undefined

  if (!hasChildren) {
    return (
      <a
        href={linkHref ?? '#'}
        className="text-sm text-primary-foreground/90"
        onClick={onClose}
      >
        {item.label}
      </a>
    )
  }

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm text-primary-foreground/90"
        onClick={() => setExpanded((e) => !e)}
      >
        {item.label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="mt-2 ml-3 flex flex-col gap-3 border-l border-primary-foreground/20 pl-3">
          {item.children!.map((child) => (
            <a
              key={child.url}
              href={child.url}
              className="text-sm text-primary-foreground/75"
              onClick={onClose}
            >
              {child.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export const Navbar = ({ siteName, nav, ctaText, ctaUrl }: NavbarProps): React.ReactElement => {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-primary/15 bg-primary text-primary-foreground shadow-sm">
      <div className={cn(container, 'flex h-16 items-center justify-between')}>
        <Link href="/" className="text-lg font-bold tracking-tight text-primary-foreground">
          {siteName}
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <DesktopDropdown key={item.url + item.label} item={item} />
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
              <MobileNavItem key={item.url + item.label} item={item} onClose={() => setOpen(false)} />
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

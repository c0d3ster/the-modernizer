'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { NavItem } from '@modernizer/schema'
import { Button } from '../shadcn/button'
import { cn } from '../lib/cn'
import { skipOptimization } from '../lib/image'
import { container } from '../styles/tokens'
import { Menu, X, ChevronDown, Phone } from 'lucide-react'

interface NavbarProps {
  siteName: string
  // The business's own logo; shown small in place of the name (the name stays for screen readers)
  logoUrl?: string
  nav: NavItem[]
  ctaText?: string
  ctaUrl?: string
  // Shown as a tap-to-call button
  phone?: string
  // Links shown in the bar before the rest move into a "More" menu, so the menu never wraps
  maxVisible?: number
}

/** "(540) 555-0100" -> "tel:5405550100" */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`

const linkClass = 'whitespace-nowrap text-sm font-medium text-foreground/80 transition-colors hover:text-foreground'

const DesktopItem = ({ item }: { item: NavItem }): React.ReactElement => {
  const children = item.children ?? []
  const linkHref = item.url && item.url !== '#' ? item.url : undefined

  if (!children.length) {
    return (
      <a href={linkHref ?? '#'} className={linkClass}>
        {item.label}
      </a>
    )
  }

  return (
    <div className="group relative flex items-center gap-1">
      {linkHref ? (
        <a href={linkHref} className={linkClass}>
          {item.label}
        </a>
      ) : (
        <span className={linkClass}>{item.label}</span>
      )}
      <ChevronDown className="h-3.5 w-3.5 text-foreground/60 transition-transform group-hover:rotate-180" aria-hidden />
      {/* Panel sits flush under the trigger (padding, not margin) so the hover area has no gap */}
      <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="min-w-[200px] rounded-xl border border-border bg-card py-1 shadow-lg">
          {children.map((child) => (
            <a key={child.url} href={child.url} className="block px-4 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-foreground">
              {child.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

const MobileNavItem = ({ item, onClose }: { item: NavItem; onClose: () => void }): React.ReactElement => {
  const [expanded, setExpanded] = React.useState(false)
  const children = item.children ?? []
  const linkHref = item.url && item.url !== '#' ? item.url : undefined

  if (!children.length) {
    return (
      <a href={linkHref ?? '#'} className="py-1 text-base text-foreground" onClick={onClose}>
        {item.label}
      </a>
    )
  }

  return (
    <div>
      <button type="button" className="flex w-full items-center justify-between py-1 text-base text-foreground" onClick={() => setExpanded((e) => !e)}>
        {item.label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="mt-2 ml-3 flex flex-col gap-3 border-l border-border pl-3">
          {children.map((child) => (
            <a key={child.url} href={child.url} className="text-sm text-muted-foreground" onClick={onClose}>
              {child.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export const Navbar = ({ siteName, logoUrl, nav, ctaText, ctaUrl, phone, maxVisible = 6 }: NavbarProps): React.ReactElement => {
  const [open, setOpen] = React.useState(false)
  const visible = nav.length > maxVisible ? nav.slice(0, maxVisible - 1) : nav
  const overflow = nav.length > maxVisible ? nav.slice(maxVisible - 1) : []
  const more: NavItem | null = overflow.length
    ? { label: 'More', url: '#', children: overflow.flatMap((i) => (i.url && i.url !== '#' ? [{ label: i.label, url: i.url }] : (i.children ?? []))) }
    : null
  const hasCta = Boolean(ctaText && ctaUrl)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className={cn(container, 'flex h-16 items-center justify-between gap-6 lg:h-20')}>
        {logoUrl ? (
          <Link href="/" className="flex shrink-0 items-center">
            <Image src={logoUrl} alt="" width={224} height={44} priority unoptimized={skipOptimization(logoUrl)} className="h-9 w-auto max-w-[11rem] object-contain object-left lg:h-11 lg:max-w-[14rem]" />
            <span className="sr-only">{siteName}</span>
          </Link>
        ) : (
          <Link href="/" className="min-w-0 truncate font-heading text-lg font-bold tracking-tight text-foreground lg:max-w-[16rem] lg:text-xl xl:max-w-none">
            {siteName}
          </Link>
        )}

        <nav className="hidden items-center gap-5 lg:flex xl:gap-7" aria-label="Main">
          {visible.map((item) => (
            <DesktopItem key={item.url + item.label} item={item} />
          ))}
          {more && <DesktopItem item={more} />}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {phone && (
            <Button asChild variant="outline" className="gap-2">
              <a href={telHref(phone)}>
                <Phone className="h-4 w-4" aria-hidden />
                {phone}
              </a>
            </Button>
          )}
          {hasCta && (
            <Button asChild>
              <a href={ctaUrl}>{ctaText}</a>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {phone && (
            <Button asChild variant="outline" size="icon" aria-label={`Call ${phone}`}>
              <a href={telHref(phone)}>
                <Phone className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center text-foreground"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-5 lg:hidden">
          <nav className="flex flex-col gap-3" aria-label="Main">
            {nav.map((item) => (
              <MobileNavItem key={item.url + item.label} item={item} onClose={() => setOpen(false)} />
            ))}
            {hasCta && (
              <Button asChild className="mt-2 w-full">
                <a href={ctaUrl}>{ctaText}</a>
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

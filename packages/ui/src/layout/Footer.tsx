import type { NavItem } from '@modernizer/schema'
import { Separator } from '../shadcn/separator'
import { cn } from '../lib/cn'
import { container } from '../styles/tokens'

interface FooterProps {
  siteName: string
  nav: NavItem[]
  phone?: string
  email?: string
  address?: string
}

const FooterNavSection = ({ item }: { item: NavItem }): React.ReactElement => {
  const hasChildren = item.children && item.children.length > 0

  if (!hasChildren) {
    const href = item.url && item.url !== '#' ? item.url : undefined
    return (
      <a
        href={href ?? '#'}
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {item.label}
      </a>
    )
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">{item.label}</p>
      <ul className="space-y-1.5">
        {item.children!.map((child) => (
          <li key={child.url}>
            <a
              href={child.url}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {child.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const Footer = ({ siteName, nav, phone, email, address }: FooterProps): React.ReactElement => {
  const year = new Date().getFullYear()
  const hasGrouped = nav.some((item) => item.children && item.children.length > 0)

  return (
    <footer className="border-t bg-muted/40">
      <div className={cn(container, 'py-12')}>
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-12">
          <div>
            <p className="font-bold">{siteName}</p>
            {address && <p className="mt-2 text-sm text-muted-foreground">{address}</p>}
            <nav
              className={cn(
                'mt-5 border-t border-border/60 pt-5',
                hasGrouped
                  ? 'grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4'
                  : 'grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3'
              )}
              aria-label="Footer navigation"
            >
              {nav.map((item) => (
                <FooterNavSection key={item.url + item.label} item={item} />
              ))}
            </nav>
          </div>
          {(phone ?? email) && (
            <div className="lg:text-right">
              <p className="mb-3 text-sm font-semibold">Contact</p>
              <ul className="space-y-2 lg:ml-auto">
                {phone && (
                  <li>
                    <a href={`tel:${phone}`} className="text-sm text-muted-foreground hover:text-foreground">
                      {phone}
                    </a>
                  </li>
                )}
                {email && (
                  <li>
                    <a href={`mailto:${email}`} className="text-sm text-muted-foreground hover:text-foreground">
                      {email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        <Separator className="my-8" />
        <p className="text-center text-xs text-muted-foreground">© {year} {siteName}. All rights reserved.</p>
      </div>
    </footer>
  )
}

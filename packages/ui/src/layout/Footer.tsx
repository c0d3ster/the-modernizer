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

export const Footer = ({ siteName, nav, phone, email, address }: FooterProps): React.ReactElement => {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/40">
      <div className={cn(container, 'py-12')}>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-bold">{siteName}</p>
            {address && <p className="mt-2 text-sm text-muted-foreground">{address}</p>}
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Navigation</p>
            <ul className="space-y-2">
              {nav.map((item) => (
                <li key={item.url}>
                  <a href={item.url} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {(phone ?? email) && (
            <div>
              <p className="mb-3 text-sm font-semibold">Contact</p>
              <ul className="space-y-2">
                {phone && <li><a href={`tel:${phone}`} className="text-sm text-muted-foreground hover:text-foreground">{phone}</a></li>}
                {email && <li><a href={`mailto:${email}`} className="text-sm text-muted-foreground hover:text-foreground">{email}</a></li>}
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

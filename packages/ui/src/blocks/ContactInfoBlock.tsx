import type { ContactInfoBlock as ContactInfoBlockData } from '@modernizer/schema'
import { Card, CardContent } from '../shadcn/card'
import { MapPin, Phone, Mail } from 'lucide-react'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface ContactInfoBlockProps {
  block: ContactInfoBlockData
}

export const ContactInfoBlock = ({ block }: ContactInfoBlockProps): React.ReactElement => {
  const { heading, phone, email, address, mapEmbedUrl } = block

  return (
    <section className={cn(section)}>
      <div className={container}>
        {heading && (
          <h2 className="mb-10 text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div className={cn('grid gap-8', mapEmbedUrl ? 'lg:grid-cols-2' : 'max-w-lg')}>
          <Card>
            <CardContent className="space-y-4 pt-6">
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">{address}</p>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 shrink-0 text-primary" />
                  <a href={`tel:${phone}`} className="text-sm hover:text-primary">{phone}</a>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 shrink-0 text-primary" />
                  <a href={`mailto:${email}`} className="text-sm hover:text-primary">{email}</a>
                </div>
              )}
            </CardContent>
          </Card>
          {mapEmbedUrl && (
            <div className="overflow-hidden rounded-xl border aspect-video">
              <iframe
                src={mapEmbedUrl}
                className="h-full w-full"
                loading="lazy"
                title="Map"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

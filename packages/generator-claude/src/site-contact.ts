import type { SiteFooterInfo, SiteSchema } from '@modernizer/schema'

/**
 * The site's real contact details: the extracted footer, filled in from the first contact block on
 * any page. Extraction often finds the phone only in a contact section, and a prompt without one
 * invites the model to make a number up.
 */
export const siteContact = ({ footer, pages }: Pick<SiteSchema, 'footer' | 'pages'>): SiteFooterInfo => {
  const contact = pages.flatMap((p) => p.blocks).find((b) => b.type === 'contact_info')
  if (!contact || contact.type !== 'contact_info') return footer ?? {}
  return {
    phone: footer?.phone ?? contact.phone,
    email: footer?.email ?? contact.email,
    address: footer?.address ?? contact.address,
  }
}

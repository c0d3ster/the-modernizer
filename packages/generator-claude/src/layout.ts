import type { SiteSchema } from '@modernizer/schema'
import { fontSetup, generateMetadataExport } from '@modernizer/generator-config'
import { profileFor, verticalOf } from '@modernizer/design-guide'

/**
 * The root layout, written in code rather than by the shell call so every site gets the same
 * essentials: one <main> landmark around the page, share tags, and the vertical's fonts. The shell
 * call only writes the Navbar and Footer, both default exports that take no props.
 */
export const generateClaudeLayout = (schema: SiteSchema): string => {
  const fonts = fontSetup(profileFor(verticalOf(schema)))
  return `import type { ReactElement, ReactNode } from 'react'
import type { Metadata } from 'next'
${fonts.imports}
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import './globals.css'

${fonts.declarations}

${generateMetadataExport(schema)}

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>): ReactElement => {
  return (
    <html lang='en' className={${fonts.className}}>
      <body className='font-sans bg-background text-foreground antialiased'>
        <Navbar />
        <main id='main-content'>{children}</main>
        <Footer />
      </body>
    </html>
  )
}

export default RootLayout
`
}

/**
 * The layout already provides <main>; a page that renders its own would nest a second main
 * landmark, so page-level <main> tags become <div>s (attributes and classes kept).
 */
export const demoteMainLandmark = (source: string): string => source.replace(/<main(?=[\s>])/g, '<div').replace(/<\/main>/g, '</div>')

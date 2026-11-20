import type { HeroBlock as HeroBlockData } from '@modernizer/schema'
import { Button } from '../shadcn/button'
import Image from 'next/image'
import { cn } from '../lib/cn'
import { skipOptimization } from '../lib/image'
import { container } from '../styles/tokens'

/**
 * overlay: full-bleed photo, headline bottom-left over a soft dark gradient (trades, cafes).
 * panel: full-bleed photo, headline on a light translucent panel (dental, professional services).
 * centered: full-bleed photo with a dark wash, everything centered (restaurants).
 */
export type HeroVariant = 'overlay' | 'panel' | 'centered'

interface HeroBlockProps {
  block: HeroBlockData
  variant?: HeroVariant
  // A second action beside the main one, e.g. a tap-to-call link
  secondaryCta?: { text: string; url: string }
}

const Actions = ({ block, secondaryCta, onPhoto, light }: { block: HeroBlockData; secondaryCta?: HeroBlockProps['secondaryCta']; onPhoto: boolean; light: boolean }): React.ReactElement | null => {
  const { ctaText, ctaUrl } = block
  if (!(ctaText && ctaUrl) && !secondaryCta) return null
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      {ctaText && ctaUrl && (
        <Button asChild size="lg">
          <a href={ctaUrl}>{ctaText}</a>
        </Button>
      )}
      {secondaryCta && (
        <Button
          asChild
          size="lg"
          variant="outline"
          className={cn(onPhoto && !light && 'border-white/70 bg-transparent text-white hover:bg-white/10 hover:text-white')}
        >
          <a href={secondaryCta.url}>{secondaryCta.text}</a>
        </Button>
      )}
    </div>
  )
}

export const HeroBlock = ({ block, variant = 'overlay', secondaryCta }: HeroBlockProps): React.ReactElement => {
  const { heading, subheading, backgroundImageUrl, compact } = block

  // Compact mode: page-title banner for inner pages, no image
  if (compact && !backgroundImageUrl) {
    return (
      <section className="border-b border-border bg-muted/60 py-12 md:py-16">
        <div className={cn(container)}>
          <h1 className="text-3xl font-bold md:text-5xl">{heading}</h1>
          {subheading && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{subheading}</p>}
        </div>
      </section>
    )
  }

  // No photo: a calm brand-colored band
  if (!backgroundImageUrl) {
    return (
      <section className="bg-primary py-20 text-primary-foreground lg:py-32">
        <div className={cn(container, variant === 'centered' && 'text-center')}>
          <div className={cn('max-w-3xl', variant === 'centered' && 'mx-auto')}>
            <h1 className="text-4xl font-bold lg:text-6xl">{heading}</h1>
            {subheading && <p className="mt-6 text-lg opacity-90 lg:text-xl">{subheading}</p>}
            <div className={cn(variant === 'centered' && 'flex justify-center')}>
              <Actions block={block} secondaryCta={secondaryCta} onPhoto={false} light={false} />
            </div>
          </div>
        </div>
      </section>
    )
  }

  const panel = variant === 'panel'
  const centered = variant === 'centered'

  return (
    // Fills the first screen below the sticky header, so the next section never peeks in half cut
    <section className="relative flex min-h-[calc(100svh-4rem)] w-full overflow-hidden lg:min-h-[calc(100svh-5rem)]">
      <Image src={backgroundImageUrl} alt="" aria-hidden="true" fill priority sizes="100vw" unoptimized={skipOptimization(backgroundImageUrl)} className="object-cover object-center" />
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0',
          centered && 'bg-black/45',
          panel && 'bg-gradient-to-r from-black/25 via-black/10 to-transparent',
          !centered && !panel && 'bg-gradient-to-t from-black/75 via-black/35 to-black/5'
        )}
      />
      <div className={cn(container, 'relative z-10 flex w-full py-16 lg:py-24', centered ? 'items-center justify-center text-center' : panel ? 'items-center' : 'items-end')}>
        <div
          className={cn(
            'max-w-2xl',
            panel && 'rounded-[var(--radius-xl,1rem)] bg-background/85 p-8 shadow-xl backdrop-blur-sm sm:p-10',
            !panel && 'text-white'
          )}
        >
          <h1 className={cn('text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl', !panel && '[text-shadow:0_2px_24px_rgba(0,0,0,0.35)]')}>
            {heading}
          </h1>
          {subheading && <p className={cn('mt-5 text-lg lg:text-xl', panel ? 'text-muted-foreground' : 'text-white/90')}>{subheading}</p>}
          <div className={cn(centered && 'flex justify-center')}>
            <Actions block={block} secondaryCta={secondaryCta} onPhoto light={panel} />
          </div>
        </div>
      </div>
    </section>
  )
}

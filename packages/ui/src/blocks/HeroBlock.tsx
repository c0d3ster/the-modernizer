import type { HeroBlock as HeroBlockData } from '@modernizer/schema'
import { Button } from '../shadcn/button'
import { cn } from '../lib/cn'
import { container } from '../styles/tokens'

interface HeroBlockProps {
  block: HeroBlockData
}

export const HeroBlock = ({ block }: HeroBlockProps): React.ReactElement => {
  const { heading, subheading, ctaText, ctaUrl, backgroundImageUrl } = block

  return (
    <section
      className={cn(
        'relative flex min-h-[480px] items-center py-20 lg:py-32',
        backgroundImageUrl ? 'text-white' : 'bg-primary text-primary-foreground'
      )}
    >
      {backgroundImageUrl && (
        <>
          <img
            src={backgroundImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <div className={cn(container, 'relative z-10')}>
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight lg:text-5xl xl:text-6xl">{heading}</h1>
          {subheading && (
            <p className="mt-6 text-lg opacity-90 lg:text-xl">{subheading}</p>
          )}
          {ctaText && ctaUrl && (
            <div className="mt-8">
              <Button asChild size="lg" variant={backgroundImageUrl ? 'default' : 'outline'}>
                <a href={ctaUrl}>{ctaText}</a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

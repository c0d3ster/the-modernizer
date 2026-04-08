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
        'relative w-full',
        backgroundImageUrl
          ? 'h-[93dvh] max-h-[93dvh] overflow-hidden bg-black text-white'
          : 'flex min-h-[480px] flex-col items-center bg-primary py-20 text-primary-foreground lg:py-32'
      )}
    >
      {backgroundImageUrl && (
        <>
          {/* ~93dvh leaves room for fixed header; flow content must not stretch the section */}
          <div className="absolute inset-0 bg-black">
            <img
              src={backgroundImageUrl}
              alt=""
              className="mx-auto block h-full w-full max-w-5xl object-cover object-bottom md:max-w-6xl lg:max-w-7xl"
              aria-hidden="true"
            />
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-transparent"
            aria-hidden="true"
          />
        </>
      )}
      <div
        className={cn(
          container,
          'relative z-10',
          backgroundImageUrl && 'absolute inset-x-0 top-0 pt-10 md:pt-16'
        )}
      >
        <div
          className={cn(
            'max-w-2xl',
            backgroundImageUrl &&
              'rounded-2xl bg-black/50 px-5 py-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-sm sm:px-6 sm:py-7'
          )}
        >
          <h1
            className={cn(
              'text-4xl font-bold tracking-tight lg:text-5xl xl:text-6xl',
              backgroundImageUrl && 'text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.35)]'
            )}
          >
            {heading}
          </h1>
          {subheading && (
            <p
              className={cn(
                'mt-6 text-lg lg:text-xl',
                backgroundImageUrl ? 'text-white/95' : 'opacity-90'
              )}
            >
              {subheading}
            </p>
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

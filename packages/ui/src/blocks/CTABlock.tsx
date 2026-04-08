import type { CTABlock as CTABlockData } from '@modernizer/schema'
import { Button } from '../shadcn/button'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface CTABlockProps {
  block: CTABlockData
}

export const CTABlock = ({ block }: CTABlockProps): React.ReactElement => {
  const { heading, subheading, ctaText, ctaUrl } = block

  return (
    <section className={cn(section, 'bg-primary text-primary-foreground')}>
      <div className={cn(container, 'text-center')}>
        <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        {subheading && (
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-90">{subheading}</p>
        )}
        <div className="mt-8">
          <Button asChild size="lg" variant="outline">
            <a href={ctaUrl}>{ctaText}</a>
          </Button>
        </div>
      </div>
    </section>
  )
}

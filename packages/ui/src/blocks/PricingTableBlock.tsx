import type { PricingTableBlock as PricingTableBlockData } from '@modernizer/schema'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../shadcn/card'
import { Badge } from '../shadcn/badge'
import { Button } from '../shadcn/button'
import { Check } from 'lucide-react'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface PricingTableBlockProps {
  block: PricingTableBlockData
}

export const PricingTableBlock = ({ block }: PricingTableBlockProps): React.ReactElement => {
  const { heading, tiers } = block
  const isHighlighted = (i: number): boolean => tiers.length > 1 && i === 1

  return (
    <section className={cn(section)}>
      <div className={container}>
        {heading && (
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div className={cn('grid gap-8', tiers.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
          {tiers.map((tier, i) => (
            <Card key={i} className={cn(isHighlighted(i) && 'border-primary shadow-lg')}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{tier.name}</CardTitle>
                  {isHighlighted(i) && <Badge>Popular</Badge>}
                </div>
                <p className="text-3xl font-bold">{tier.price}</p>
                {tier.description && <CardDescription>{tier.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              {tier.ctaText && tier.ctaUrl && (
                <CardFooter>
                  <Button asChild className="w-full" variant={isHighlighted(i) ? 'default' : 'outline'}>
                    <a href={tier.ctaUrl}>{tier.ctaText}</a>
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

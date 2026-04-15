import type { FeatureGridBlock as FeatureGridBlockData } from '@modernizer/schema'
import { Card, CardHeader, CardTitle, CardDescription } from '../shadcn/card'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface FeatureGridBlockProps {
  block: FeatureGridBlockData
}

export const FeatureGridBlock = ({ block }: FeatureGridBlockProps): React.ReactElement => {
  const { heading, features } = block

  return (
    <section className={cn(section, 'bg-muted/40')}>
      <div className={container}>
        {heading && (
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-primary lg:text-4xl">{heading}</h2>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <Card key={i} className="border-t-2 border-t-primary">
              <CardHeader>
                {feature.iconUrl && (
                  <img src={feature.iconUrl} alt="" className="mb-2 h-8 w-8" aria-hidden="true" />
                )}
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

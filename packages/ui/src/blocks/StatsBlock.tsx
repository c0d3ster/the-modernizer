import type { StatsBlock as StatsBlockData } from '@modernizer/schema'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface StatsBlockProps {
  block: StatsBlockData
}

export const StatsBlock = ({ block }: StatsBlockProps): React.ReactElement => {
  const { heading, stats } = block

  return (
    <section className={cn(section, 'bg-primary text-primary-foreground')}>
      <div className={container}>
        {heading && (
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl font-bold lg:text-5xl">{stat.value}</p>
              <p className="mt-2 text-sm opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

import type { LogoCloudBlock as LogoCloudBlockData } from '@modernizer/schema'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface LogoCloudBlockProps {
  block: LogoCloudBlockData
}

export const LogoCloudBlock = ({ block }: LogoCloudBlockProps): React.ReactElement => {
  const { heading, logos } = block

  return (
    <section className={cn(section, 'bg-muted/40')}>
      <div className={container}>
        {heading && (
          <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {heading}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
          {logos.map((logo, i) => {
            const img = (
              <img
                src={logo.imageUrl}
                alt={logo.name}
                className="h-8 max-w-[120px] object-contain opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0"
              />
            )
            return logo.url ? (
              <a key={i} href={logo.url} target="_blank" rel="noopener noreferrer">{img}</a>
            ) : (
              <div key={i}>{img}</div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

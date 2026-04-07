import type { GenericSectionBlock } from '@modernizer/schema'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface GenericSectionProps {
  block: GenericSectionBlock
}

export const GenericSection = ({ block }: GenericSectionProps): React.ReactElement => {
  const { heading, rawHtml } = block

  return (
    <section className={cn(section)}>
      <div className={cn(container, 'max-w-3xl')}>
        {heading && (
          <h2 className="mb-6 text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div
          className="prose prose-lg max-w-none text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: rawHtml }}
        />
      </div>
    </section>
  )
}

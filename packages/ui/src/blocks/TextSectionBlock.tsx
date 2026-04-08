import type { TextSectionBlock as TextSectionBlockData } from '@modernizer/schema'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface TextSectionBlockProps {
  block: TextSectionBlockData
}

export const TextSectionBlock = ({ block }: TextSectionBlockProps): React.ReactElement => {
  const { heading, body } = block

  return (
    <section className={cn(section)}>
      <div className={cn(container, 'max-w-3xl')}>
        {heading && (
          <h2 className="mb-6 text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div className="prose prose-lg max-w-none text-muted-foreground">
          {body.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  )
}

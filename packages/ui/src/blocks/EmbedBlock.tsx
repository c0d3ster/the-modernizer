import type { EmbedBlock as EmbedBlockData } from '@modernizer/schema'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface EmbedBlockProps {
  block: EmbedBlockData
}

export const EmbedBlock = ({ block }: EmbedBlockProps): React.ReactElement => {
  const { heading, embedHtml } = block

  return (
    <section className={cn(section)}>
      <div className={container}>
        {heading && (
          <h2 className="mb-8 text-3xl font-bold tracking-tight text-primary lg:text-4xl">{heading}</h2>
        )}
        <div
          className="overflow-hidden rounded-xl [&_iframe]:aspect-video [&_iframe]:w-full"
          dangerouslySetInnerHTML={{ __html: embedHtml }}
        />
      </div>
    </section>
  )
}

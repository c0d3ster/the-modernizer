import type { ImageGalleryBlock as ImageGalleryBlockData } from '@modernizer/schema'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface ImageGalleryBlockProps {
  block: ImageGalleryBlockData
}

export const ImageGalleryBlock = ({ block }: ImageGalleryBlockProps): React.ReactElement => {
  const { heading, images } = block

  return (
    <section className={cn(section)}>
      <div className={container}>
        {heading && (
          <h2 className="mb-10 text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, i) => (
            <figure key={i} className="overflow-hidden rounded-xl">
              <img
                src={image.url}
                alt={image.alt ?? ''}
                className="aspect-video w-full object-cover transition-transform hover:scale-105"
                loading="lazy"
              />
              {image.caption && (
                <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

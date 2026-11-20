import type { ImageGalleryBlock as ImageGalleryBlockData } from '@modernizer/schema'
import Image from 'next/image'
import { cn } from '../lib/cn'
import { skipOptimization } from '../lib/image'
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
          <h2 className="mb-10 text-3xl font-bold tracking-tight text-primary lg:text-4xl">{heading}</h2>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, i) => (
            <figure key={i} className="overflow-hidden rounded-xl">
              <div className="relative aspect-video w-full">
                <Image
                  src={image.url}
                  alt={image.alt ?? ''}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  unoptimized={skipOptimization(image.url)}
                  className="object-cover transition-transform hover:scale-105"
                />
              </div>
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

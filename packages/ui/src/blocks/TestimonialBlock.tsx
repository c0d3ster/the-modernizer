import type { TestimonialBlock as TestimonialBlockData } from '@modernizer/schema'
import { Card, CardContent } from '../shadcn/card'
import { Avatar, AvatarImage, AvatarFallback } from '../shadcn/avatar'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface TestimonialBlockProps {
  block: TestimonialBlockData
}

export const TestimonialBlock = ({ block }: TestimonialBlockProps): React.ReactElement => {
  const { heading, testimonials } = block

  return (
    <section className={cn(section)}>
      <div className={container}>
        {heading && (
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight lg:text-4xl">{heading}</h2>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <blockquote className="mb-4 italic text-muted-foreground">"{t.quote}"</blockquote>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.author} />}
                    <AvatarFallback>{t.author.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{t.author}</p>
                    {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

'use client'

import type { FAQBlock as FAQBlockData } from '@modernizer/schema'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../shadcn/accordion'
import { cn } from '../lib/cn'
import { container, section } from '../styles/tokens'

interface FAQBlockProps {
  block: FAQBlockData
}

export const FAQBlock = ({ block }: FAQBlockProps): React.ReactElement => {
  const { heading, items } = block

  return (
    <section className={cn(section, 'bg-muted/40')}>
      <div className={cn(container, 'max-w-3xl')}>
        {heading && (
          <h2 className="mb-10 text-3xl font-bold tracking-tight text-primary lg:text-4xl">{heading}</h2>
        )}
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

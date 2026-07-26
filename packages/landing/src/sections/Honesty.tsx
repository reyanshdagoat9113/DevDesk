import { X } from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui'
import { faq, nonGoals } from '@/config/content'

export function Honesty() {
  return (
    <section aria-labelledby="honesty" className="border-t border-border/50 bg-muted/20">
      <div className="mx-auto grid w-full max-w-6xl gap-16 px-6 py-20 md:grid-cols-2">
        <div>
          <h2 id="honesty" className="text-3xl font-semibold tracking-tight md:text-4xl">
            What DevDesk is not
          </h2>
          <p className="mt-3 text-muted-foreground">
            These are deliberate non-goals, not a roadmap. If you need them, DevDesk is the wrong
            tool and it is better to know now.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {nonGoals.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <X className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Questions</h2>

          <Accordion type="single" collapsible className="mt-6">
            {faq.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}

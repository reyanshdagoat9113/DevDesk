import { SectionPath } from '@/components/Prompt'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui'
import { faq, nonGoals } from '@/config/content'

export function Honesty() {
  return (
    <section aria-label="Scope and questions" className="border-t border-border/40">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:gap-16 sm:px-6 sm:py-24 lg:grid-cols-2">
        <div role="region" aria-labelledby="honesty">
          <SectionPath segment="not-this" />
          <h2
            id="honesty"
            className="text-balance text-3xl font-semibold sm:text-4xl"
          >
            What DevDesk is not
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            These are deliberate non-goals, not a roadmap. If you need them, this is the wrong tool
            — better to know now.
          </p>

          <ul className="mt-8 flex flex-col gap-1 font-mono text-sm">
            {nonGoals.map((item) => (
              <li
                key={item}
                className="flex items-baseline gap-3 border-b border-border/40 py-3 last:border-b-0"
              >
                <span className="text-muted-foreground/50" aria-hidden="true">
                  ×
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div role="region" aria-labelledby="faq-heading">
          <SectionPath segment="faq" />
          <h2
            id="faq-heading"
            className="text-balance text-3xl font-semibold sm:text-4xl"
          >
            Questions
          </h2>

          <Accordion type="single" collapsible className="mt-6">
            {faq.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-sm sm:text-base">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}

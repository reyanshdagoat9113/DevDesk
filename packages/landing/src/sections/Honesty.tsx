import { X } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Card,
  CardContent,
} from '@/components/ui'
import { faq, nonGoals } from '@/config/content'

export function Honesty() {
  return (
    <section aria-labelledby="honesty" className="border-t border-border/40">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:gap-16 sm:px-6 sm:py-24 lg:grid-cols-2">
        <div>
          <Badge variant="outline" className="mb-4">
            Honest about scope
          </Badge>
          <h2
            id="honesty"
            className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            What DevDesk is not
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            These are deliberate non-goals, not a roadmap. If you need them, this is the wrong tool
            — better to know now.
          </p>

          <ul className="mt-8 grid gap-2 sm:grid-cols-2">
            {nonGoals.map((item) => (
              <li key={item}>
                <Card className="border-border/50 bg-muted/20">
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium">{item}</span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Badge variant="outline" className="mb-4">
            FAQ
          </Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
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

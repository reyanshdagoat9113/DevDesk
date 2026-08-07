import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { parseCodeFenceMeta } from '../lib/markdownUtils'
import { RunnableBlock } from './RunnableBlock'

interface MarkdownPreviewProps {
  source: string
  projectId?: string
  className?: string
  onTaskToggle?: (taskIndex: number) => void
}

export const MarkdownPreview = React.memo(function MarkdownPreview({ source, projectId, className, onTaskToggle }: MarkdownPreviewProps) {
  const taskIndexRef = React.useRef(0)

  const markdownComponents = React.useMemo<React.ComponentProps<typeof ReactMarkdown>['components']>(
    () => ({
      code({ className, children, ref: _ref, ...props }) {
        const meta = parseCodeFenceMeta(className)
        return meta.language || meta.runnable ? (
          <RunnableBlock
            code={String(children).replace(/\n$/, '')}
            language={meta.language}
            projectId={projectId}
            runnable={meta.runnable}
          />
        ) : (
          <code className={className} {...props}>
            {children}
          </code>
        )
      },
      input({ checked, disabled: _disabled, type, ref: _ref, ...props }) {
        if (type !== 'checkbox') {
          return <input checked={checked} type={type} {...props} />
        }

        const taskIndex = taskIndexRef.current
        taskIndexRef.current += 1

        return (
          <input
            {...props}
            aria-label={`Toggle task ${taskIndex + 1}`}
            checked={Boolean(checked)}
            className="mr-2 h-3.5 w-3.5 rounded border-border accent-primary"
            disabled={!onTaskToggle}
            type="checkbox"
            onChange={() => onTaskToggle?.(taskIndex)}
          />
        )
      },
    }),
    [onTaskToggle, projectId]
  )

  taskIndexRef.current = 0

  return (
    <div
      aria-label="Markdown preview"
      className={cn(
        'prose prose-invert max-w-none',
        'prose-headings:mb-3 prose-headings:mt-6 prose-headings:font-semibold prose-headings:text-foreground',
        'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h4:text-sm',
        'prose-p:my-2 prose-p:text-sm prose-p:text-foreground/90',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-strong:text-foreground prose-strong:font-semibold',
        'prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5',
        'prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5',
        'prose-li:my-0.5 prose-li:text-sm prose-li:text-foreground/90',
        'prose-li:has-[input[type=checkbox]]:list-none prose-li:has-[input[type=checkbox]]:ml-[-1.25rem]',
        'prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r',
        'prose-blockquote:text-sm prose-blockquote:text-muted-foreground prose-blockquote:not-italic',
        'prose-hr:border-border/40 prose-hr:my-4',
        'prose-table:w-full prose-table:text-sm prose-table:border-collapse',
        'prose-thead:border-b prose-thead:border-border/40',
        'prose-th:p-2 prose-th:text-left prose-th:font-semibold prose-th:text-foreground',
        'prose-td:p-2 prose-td:text-foreground/90 prose-td:border-b prose-td:border-border/20',
        'prose-tr:hover:prose-td:bg-muted/20',
        'prose-img:rounded-md prose-img:my-2',
        '[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-code-border [&_pre]:bg-code [&_pre]:text-code-foreground',
        '[&_code]:font-mono [&_code]:text-xs',
        '[&_p>code]:bg-muted [&_p>code]:px-1 [&_p>code]:py-0.5 [&_p>code]:rounded [&_p>code]:text-[11px]',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
})

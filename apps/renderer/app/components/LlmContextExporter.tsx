import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Copy, Download, RefreshCw, ShieldAlert } from 'lucide-react'
import type { LlmBundleOptions, LlmBundleResult, LlmBundleSection, Project } from '../types'
import { MarkdownPreview } from './MarkdownPreview'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'
import { Button } from './ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { ScrollArea } from './ui/ScrollArea'

const SECTION_OPTIONS: Array<{ key: LlmBundleSection; label: string; description: string }> = [
  { key: 'files', label: 'Files', description: 'Include filtered project files as fenced code blocks.' },
  { key: 'runHistory', label: 'Run History', description: 'Include the latest project command runs.' },
  { key: 'health', label: 'Health', description: 'Include the latest health check summary.' },
  { key: 'bugs', label: 'Bugs', description: 'Include open and recent bug reports.' },
  { key: 'notes', label: 'Notes', description: 'Include saved setup notes, todos, and reminders.' },
  { key: 'engineStats', label: 'Engine Stats', description: 'Include indexed file and language stats when available.' },
]

const DEFAULT_SECTION_STATE = Object.fromEntries(SECTION_OPTIONS.map(({ key }) => [key, true])) as Record<LlmBundleSection, boolean>

export function LlmContextExporter({ project }: { project: Project }) {
  const [sectionState, setSectionState] = useState<Record<LlmBundleSection, boolean>>(DEFAULT_SECTION_STATE)
  const [maxTokensInput, setMaxTokensInput] = useState('100000')
  const [bugReportId, setBugReportId] = useState('')
  const [result, setResult] = useState<LlmBundleResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')

  const sections = useMemo(
    () => SECTION_OPTIONS.filter(({ key }) => sectionState[key]).map(({ key }) => key),
    [sectionState],
  )

  const maxTokensValue = useMemo(() => {
    const parsed = Number.parseInt(maxTokensInput, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }, [maxTokensInput])

  const options = useMemo<LlmBundleOptions>(() => {
    return {
      sections,
      maxTokens: maxTokensValue,
      bugReportId: bugReportId.trim() || undefined,
    }
  }, [bugReportId, maxTokensValue, sections])

  const generateBundle = useCallback(async (activeOptions: LlmBundleOptions, allowEmpty = false) => {
    if (!sections.length && !allowEmpty) {
      setIsLoading(false)
      setResult(null)
      setError('Select at least one section to generate a context bundle.')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const nextResult = await window.electronAPI.llm.bundleContext(project.id, activeOptions)
      setResult(nextResult)
    } catch (nextError) {
      setResult(null)
      setError(nextError instanceof Error ? nextError.message : 'Failed to generate LLM context bundle.')
    } finally {
      setIsLoading(false)
    }
  }, [project.id, sections.length])

  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (cancelled) {
          return
        }
        await generateBundle(options)
      })()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [generateBundle, options])

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }
    const timeoutId = window.setTimeout(() => setCopyState('idle'), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [copyState])

  useEffect(() => {
    if (saveState === 'idle') {
      return
    }
    const timeoutId = window.setTimeout(() => setSaveState('idle'), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [saveState])

  const warningItems = result?.warnings ?? []
  const privacyWarnings = warningItems.filter((warning) => /sensitive|secret|\.env|privacy/i.test(warning))
  const truncationWarnings = warningItems.filter((warning) => /truncat|token cap|omitted/i.test(warning))
  const maxTokensCap = maxTokensValue ?? 100000
  const tokenUsageRatio = result ? Math.min(1, result.tokenEstimate / maxTokensCap) : 0
  const tokenUsagePercent = Math.round(tokenUsageRatio * 100)

  const handleCopy = async () => {
    if (!result?.markdown) {
      return
    }

    try {
      await navigator.clipboard.writeText(result.markdown)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const handleSave = () => {
    if (!result?.markdown) {
      return
    }

    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
    const fileName = `${slug}-llm-context.md`
    const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setSaveState('saved')
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
      <Card className="border-border/50 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">LLM Context Exporter</CardTitle>
          <CardDescription>
            Build a shareable Markdown bundle for {project.name} with privacy guardrails and a live token estimate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sections</Label>
                <p className="text-xs text-muted-foreground">Toggle which project context sections should be included.</p>
              </div>
              <div className="flex gap-2">
                <Button size="xs" variant="ghost" onClick={() => setSectionState({ ...DEFAULT_SECTION_STATE })}>
                  Select all
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setSectionState(Object.fromEntries(SECTION_OPTIONS.map(({ key }) => [key, false])) as Record<LlmBundleSection, boolean>)}
                >
                  Clear all
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {SECTION_OPTIONS.map((section) => (
                <label
                  key={section.key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-3 transition-colors hover:border-border"
                >
                  <input
                    type="checkbox"
                    checked={sectionState[section.key]}
                    onChange={(event) => {
                      setSectionState((current) => ({
                        ...current,
                        [section.key]: event.target.checked,
                      }))
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-background accent-primary"
                  />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{section.label}</div>
                    <div className="text-xs leading-relaxed text-muted-foreground">{section.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="llm-max-tokens" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Max tokens</Label>
              <Input
                id="llm-max-tokens"
                inputMode="numeric"
                value={maxTokensInput}
                onChange={(event) => setMaxTokensInput(event.target.value)}
                placeholder="100000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-bug-focus" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bug report focus</Label>
              <Input
                id="llm-bug-focus"
                value={bugReportId}
                onChange={(event) => setBugReportId(event.target.value)}
                placeholder="Optional bug report ID"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-background/30 px-3 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Token estimate</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{result?.tokenEstimate?.toLocaleString() ?? '—'}</div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${tokenUsageRatio >= 0.95 ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.max(6, tokenUsagePercent)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {result ? `${tokenUsagePercent}% of ${maxTokensCap.toLocaleString()} token cap` : `Cap ${maxTokensCap.toLocaleString()} tokens`}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/30 px-3 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Included / Excluded</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {result ? `${result.includedFiles.length} / ${result.excludedFiles.length}` : '—'}
              </div>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Bundle generation failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {privacyWarnings.length ? (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Privacy guardrails active</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {privacyWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {truncationWarnings.length ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Token cap warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {truncationWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {result?.includedFiles.length ? (
            <div className="space-y-2 rounded-lg border border-border/50 bg-background/20 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Included files</div>
              <ScrollArea className="h-24">
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.includedFiles.slice(0, 20).map((entry) => (
                    <li key={entry} className="font-mono">{entry}</li>
                  ))}
                  {result.includedFiles.length > 20 ? (
                    <li className="text-foreground/70">…and {result.includedFiles.length - 20} more</li>
                  ) : null}
                </ul>
              </ScrollArea>
            </div>
          ) : null}

          {result?.excludedFiles.length ? (
            <div className="space-y-2 rounded-lg border border-border/50 bg-background/20 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Excluded files</div>
              <ScrollArea className="h-28">
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.excludedFiles.slice(0, 30).map((entry) => (
                    <li key={entry} className="font-mono">{entry}</li>
                  ))}
                  {result.excludedFiles.length > 30 ? (
                    <li className="text-foreground/70">…and {result.excludedFiles.length - 30} more</li>
                  ) : null}
                </ul>
              </ScrollArea>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={handleCopy} disabled={!result?.markdown}>
              <Copy className="h-3.5 w-3.5" />
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy to Clipboard'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={!result?.markdown}>
              <Download className="h-3.5 w-3.5" />
              {saveState === 'saved' ? 'Saved' : 'Save as .md'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[720px] border-border/50 bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Bundle preview</CardTitle>
            <CardDescription>
              Live Markdown preview of the current export bundle.
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => void generateBundle(options)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing' : 'Live'}
          </Button>
        </CardHeader>
        <CardContent className="h-[640px] pt-0">
          <div className="h-full rounded-lg border border-border/50 bg-background/40">
            <ScrollArea className="h-full px-5 py-4">
              {isLoading && !result ? (
                <div className="flex h-full min-h-[540px] items-center justify-center text-sm text-muted-foreground">
                  Generating bundle preview…
                </div>
              ) : result?.markdown ? (
                <MarkdownPreview source={result.markdown} projectId={project.id} className="prose-sm" />
              ) : (
                <div className="flex h-full min-h-[540px] items-center justify-center text-sm text-muted-foreground">
                  No preview available yet.
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { Terminal, AlertCircle } from 'lucide-react'
import type { CommandVariable } from '../types'

interface VariablePromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variables: CommandVariable[]
  commandPreview?: string
  onSubmit: (values: Record<string, string>) => void
  onCancel?: () => void
}

// Simple hash function to generate a storage key for a command preview
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

function getStorageKey(commandPreview: string): string {
  return `devdesk:vars:${hashString(commandPreview)}`
}

export function VariablePromptModal({
  open,
  onOpenChange,
  variables,
  commandPreview,
  onSubmit,
  onCancel,
}: VariablePromptModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Load saved values from localStorage when modal opens
  useEffect(() => {
    if (!open || !commandPreview) return

    const storageKey = getStorageKey(commandPreview)
    const saved = localStorage.getItem(storageKey)
    let savedValues: Record<string, string> = {}
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          savedValues = parsed as Record<string, string>
        }
      } catch {
        savedValues = {}
      }
    }

    const initialValues: Record<string, string> = {}
    for (const variable of variables) {
      initialValues[variable.name] = savedValues[variable.name] ?? variable.default ?? ''
    }
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [open, variables, commandPreview])

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}
    for (const variable of variables) {
      if (variable.required && !values[variable.name]?.trim()) {
        newErrors[variable.name] = 'This field is required'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [values, variables])

  const handleSubmit = useCallback(() => {
    if (!validate()) return

    // Save values to localStorage
    if (commandPreview) {
      const storageKey = getStorageKey(commandPreview)
      localStorage.setItem(storageKey, JSON.stringify(values))
    }

    onSubmit(values)
    onOpenChange(false)
  }, [validate, values, commandPreview, onSubmit, onOpenChange])

  const handleCancel = useCallback(() => {
    onCancel?.()
    onOpenChange(false)
  }, [onCancel, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        handleCancel()
      }
    },
    [handleSubmit, handleCancel]
  )

  // Validate on blur for touched fields
  const handleBlur = (variableName: string) => {
    setTouched((prev) => ({ ...prev, [variableName]: true }))
    const variable = variables.find((v) => v.name === variableName)
    if (variable?.required && !values[variableName]?.trim()) {
      setErrors((prev) => ({ ...prev, [variableName]: 'This field is required' }))
    } else {
      setErrors((prev) => ({ ...prev, [variableName]: '' }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Command Variables</DialogTitle>
              <DialogDescription>
                Enter values for the variables in this command.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {commandPreview && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Command Preview
              </p>
              <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground/80">
                {commandPreview}
              </code>
            </div>
          )}

          <div className="space-y-4">
            {variables.map((variable) => (
              <div key={variable.name} className="space-y-2">
                <Label htmlFor={`var-${variable.name}`} className="text-sm font-medium">
                  {variable.description || variable.name}
                  {variable.required && (
                    <span className="ml-1 text-destructive" aria-label="required">
                      *
                    </span>
                  )}
                  {!variable.required && variable.default !== undefined && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (default: {variable.default})
                    </span>
                  )}
                </Label>
                <Input
                  id={`var-${variable.name}`}
                  value={values[variable.name] ?? ''}
                  onChange={(e) => {
                    setValues((prev) => ({ ...prev, [variable.name]: e.target.value }))
                    if (touched[variable.name]) {
                      // Clear error if user is typing
                      setErrors((prev) => ({ ...prev, [variable.name]: '' }))
                    }
                  }}
                  onBlur={() => handleBlur(variable.name)}
                  placeholder={variable.default || `Enter ${variable.name}...`}
                  className={errors[variable.name] ? 'border-destructive' : ''}
                  autoFocus={variable === variables[0]}
                />
                {errors[variable.name] && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {errors[variable.name]}
                  </div>
                )}
              </div>
            ))}
          </div>

          {variables.some((v) => v.required) && (
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">*</span> Required field
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Run Command</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

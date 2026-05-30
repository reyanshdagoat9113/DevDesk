import { useCallback, useEffect, useState } from 'react'
import {
  Download,
  Upload,
  FileJson,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/Dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs'
import { Button } from './ui/Button'
import { Alert, AlertDescription, AlertTitle } from './ui/Alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/Table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/Select'
import { Badge } from './ui/Badge'
import { ScrollArea } from './ui/ScrollArea'
import type { ExportData, ImportMode, ImportResult } from '../types'

type DialogTab = 'export' | 'import'
type ImportStep = 'select' | 'preview' | 'done'

interface ExportImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess: () => void
}

export function ExportImportDialog({
  open,
  onOpenChange,
  onImportSuccess,
}: ExportImportDialogProps) {
  const [activeTab, setActiveTab] = useState<DialogTab>('export')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [exportCounts, setExportCounts] = useState<Record<string, number> | null>(null)
  const [exportFilePath, setExportFilePath] = useState<string | null>(null)

  const [importStep, setImportStep] = useState<ImportStep>('select')
  const [importData, setImportData] = useState<ExportData | null>(null)
  const [importCounts, setImportCounts] = useState<Record<string, number> | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const resetAll = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setSuccess(null)
    setExportCounts(null)
    setExportFilePath(null)
    setImportStep('select')
    setImportData(null)
    setImportCounts(null)
    setImportMode('merge')
    setImportWarnings([])
    setImportResult(null)
  }, [])

  useEffect(() => {
    if (!open) resetAll()
  }, [open, resetAll])

  useEffect(() => {
    setError(null)
    setSuccess(null)
    setIsLoading(false)
    if (activeTab === 'export') {
      setImportStep('select')
      setImportData(null)
      setImportCounts(null)
      setImportMode('merge')
      setImportWarnings([])
      setImportResult(null)
    } else {
      setExportFilePath(null)
    }
  }, [activeTab])

  useEffect(() => {
    if (!open || activeTab !== 'export') return
    let canceled = false
    setIsLoading(true)
    window.electronAPI
      .exportData()
      .then((res) => {
        if (canceled) return
        if (res.success) setExportCounts(res.recordCounts)
        else setError('Failed to load export preview.')
      })
      .catch(() => {
        if (!canceled) setError('Failed to load export preview.')
      })
      .finally(() => {
        if (!canceled) setIsLoading(false)
      })
    return () => { canceled = true }
  }, [open, activeTab])

  const handleExportToFile = async () => {
    setError(null)
    setSuccess(null)
    setIsLoading(true)
    try {
      const result = await window.electronAPI.exportDataToFile()
      if (result.canceled) {
        // no-op
      } else if (result.success && result.filePath) {
        setExportFilePath(result.filePath)
        if (result.recordCounts) setExportCounts(result.recordCounts)
        setSuccess('Export completed successfully.')
      } else {
        setError(result.error ?? 'Export failed.')
      }
    } catch {
      setError('Export failed due to an unexpected error.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectImportFile = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const result = await window.electronAPI.previewImportFile()
      if (result.canceled) {
        // no-op
      } else if (result.success && result.data) {
        setImportData(result.data)
        setImportCounts(result.recordCounts ?? {})
        setImportWarnings(result.warnings ?? [])
        setImportStep('preview')
      } else {
        setError(result.error ?? 'Failed to read backup file.')
      }
    } catch {
      setError('Failed to read backup file due to an unexpected error.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!importData) return
    setError(null)
    setIsLoading(true)
    try {
      const result = await window.electronAPI.importData(importData, importMode)
      setImportResult(result)
      setImportStep('done')
      if (result.success) {
        onImportSuccess()
      }
    } catch {
      setImportResult({
        success: false,
        recordCounts: {},
        error: 'Import failed due to an unexpected error.',
      })
      setImportStep('done')
    } finally {
      setIsLoading(false)
    }
  }

  const totalRecords = (counts: Record<string, number>) =>
    Object.values(counts).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0)

  const renderRecordCountsTable = (counts: Record<string, number>) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Table</TableHead>
          <TableHead className="text-right">Records</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([table, n]) => (
            <TableRow key={table}>
              <TableCell className="capitalize">
                {table.replace(/_/g, ' ')}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary">{n}</Badge>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !isLoading && onOpenChange(v)}>
      <DialogContent
        onPointerDownOutside={(e) => isLoading && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Data Backup</DialogTitle>
          <DialogDescription>
            Export or restore your DevDesk data.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DialogTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="export">
            {!exportCounts && isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 py-2 mt-2">
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && exportFilePath && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Export successful</AlertTitle>
                    <AlertDescription className="break-all">
                      {exportFilePath}
                    </AlertDescription>
                  </Alert>
                )}
                {exportCounts && (
                  <>
                    {renderRecordCountsTable(exportCounts)}
                    <div className="flex justify-end">
                      <Badge variant="outline">
                        Total: {totalRecords(exportCounts)}
                      </Badge>
                    </div>
                  </>
                )}
                {exportCounts && totalRecords(exportCounts) === 0 && (
                  <Alert>
                    <AlertTitle>No data</AlertTitle>
                    <AlertDescription>
                      There is nothing to export yet.
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  className="w-full"
                  onClick={handleExportToFile}
                  disabled={
                    isLoading ||
                    !exportCounts ||
                    totalRecords(exportCounts) === 0
                  }
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export to JSON
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="import">
            {importStep === 'select' && (
              <div className="space-y-4 py-2 mt-2">
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  className="w-full"
                  onClick={handleSelectImportFile}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileJson className="mr-2 h-4 w-4" />
                  )}
                  Select JSON Backup File
                </Button>
              </div>
            )}

            {importStep === 'preview' && importCounts && (
              <div className="space-y-4 py-2 mt-2">
                {importWarnings.length > 0 && (
                  <Alert className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 space-y-1">
                        {importWarnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="rounded-md border">
                  <ScrollArea className="h-[180px]">
                    {renderRecordCountsTable(importCounts)}
                  </ScrollArea>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Import mode</label>
                  <Select
                    value={importMode}
                    onValueChange={(v) => setImportMode(v as ImportMode)}
                  >
                    <SelectTrigger aria-label="Import mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">
                        Merge (update existing, add new)
                      </SelectItem>
                      <SelectItem value="replace">
                        Replace (delete current data first)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {importMode === 'replace' && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTitle>Destructive action</AlertTitle>
                      <AlertDescription>
                        Replace will permanently delete all current data before
                        importing.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setImportStep('select')}
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleConfirmImport}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Confirm Import
                  </Button>
                </div>
              </div>
            )}

            {importStep === 'done' && importResult && (
              <div className="space-y-4 py-2 mt-2">
                {importResult.success ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Import successful</AlertTitle>
                    <AlertDescription>
                      {importResult.backupPath && (
                        <span className="block break-all text-muted-foreground text-xs mt-1">
                          Backup created at: {importResult.backupPath}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertTitle>Import failed</AlertTitle>
                    <AlertDescription>
                      {importResult.error}
                    </AlertDescription>
                  </Alert>
                )}
                {importResult.recordCounts &&
                  Object.keys(importResult.recordCounts).length > 0 &&
                  renderRecordCountsTable(importResult.recordCounts)}
                {importResult.warnings && importResult.warnings.length > 0 && (
                  <Alert className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 space-y-1">
                        {importResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  className="w-full"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

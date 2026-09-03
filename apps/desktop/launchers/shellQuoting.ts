export function formatPowerShellLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

export function formatCmdLiteral(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function formatPosixShellLiteral(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`
}

export function buildCustomCommand(template: string, targetPath: string, platform: NodeJS.Platform = process.platform) {
  const quotedPath = platform === 'win32'
    ? formatCmdLiteral(targetPath)
    : formatPosixShellLiteral(targetPath)
  return template.includes('{path}')
    ? template.split('{path}').join(quotedPath)
    : `${template} ${quotedPath}`
}

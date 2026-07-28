<#
.SYNOPSIS
  Captures a landing-page product screenshot from the running DevDesk window.

.DESCRIPTION
  Sizes the DevDesk window so its client area is exactly 1600x1000, brings it to the
  foreground, and writes public/screenshots/<Id>.png. Run it once per view listed in
  src/config/screenshots.ts, switching tabs in the app between runs.

  This only does the mechanical part: window sizing and pixel capture. Choosing what is
  on screen (real, presentable data — no private paths or tokens) stays a human call.

.EXAMPLE
  npm run dev                                    # in another shell, then open the Projects tab
  powershell -File packages/landing/scripts/capture-screenshot.ps1 -Id projects

.EXAMPLE
  powershell -File packages/landing/scripts/capture-screenshot.ps1 -Id engine -DelaySeconds 5
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('projects', 'commands', 'engine', 'containers', 'terminal', 'history')]
  [string]$Id,

  # Seconds to wait after focusing the window, so hover states and animations settle.
  [int]$DelaySeconds = 2,

  [int]$Width = 1600,
  [int]$Height = 1000,

  # Process names that can own the DevDesk window (dev run vs packaged install).
  [string[]]$ProcessNames = @('electron', 'DevDesk')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class Win {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X, Y; }

  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int t, bool repaint);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
}
'@

$packageRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$outDir = Join-Path $packageRoot 'public\screenshots'
$outFile = Join-Path $outDir "$Id.png"

# The DevDesk window: the packaged app is DevDesk.exe, `npm run dev` runs electron.exe.
# Match on process name as well as title — editors and shells often have "DevDesk" (the
# repo folder) in their window title and would otherwise be captured by mistake.
$candidates = Get-Process -Name $ProcessNames -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*DevDesk*' }

$target = $candidates | Select-Object -First 1

if (-not $target) {
  throw "No DevDesk window found (looked for processes: $($ProcessNames -join ', ')). Start the app with 'npm run dev' and try again."
}

if (@($candidates).Count -gt 1) {
  Write-Warning "Multiple DevDesk windows found; using pid $($target.Id)."
}

$hwnd = $target.MainWindowHandle
Write-Host "[landing] target: $($target.ProcessName) (pid $($target.Id)) - $($target.MainWindowTitle)"

if ([Win]::IsIconic($hwnd)) { [void][Win]::ShowWindow($hwnd, 9) } # SW_RESTORE
[void][Win]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 400

# Grow the window by its frame size so the *client* area lands on exactly WxH.
$windowRect = New-Object Win+RECT
$clientRect = New-Object Win+RECT
[void][Win]::GetWindowRect($hwnd, [ref]$windowRect)
[void][Win]::GetClientRect($hwnd, [ref]$clientRect)

$frameW = ($windowRect.Right - $windowRect.Left) - $clientRect.Right
$frameH = ($windowRect.Bottom - $windowRect.Top) - $clientRect.Bottom

[void][Win]::MoveWindow(
  $hwnd,
  $windowRect.Left,
  $windowRect.Top,
  $Width + $frameW,
  $Height + $frameH,
  $true
)

Write-Host "[landing] waiting $DelaySeconds s for the UI to settle..."
Start-Sleep -Seconds $DelaySeconds

# Re-measure: the window manager may have clamped the requested size.
[void][Win]::GetClientRect($hwnd, [ref]$clientRect)
$actualW = $clientRect.Right
$actualH = $clientRect.Bottom
if ($actualW -ne $Width -or $actualH -ne $Height) {
  Write-Warning "Client area is ${actualW}x${actualH}, not ${Width}x${Height}. Screen may be too small, or display scaling is not 100%."
}

$origin = New-Object Win+POINT
[void][Win]::ClientToScreen($hwnd, [ref]$origin)

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$bitmap = New-Object System.Drawing.Bitmap($actualW, $actualH)
try {
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, $bitmap.Size)
  } finally {
    $graphics.Dispose()
  }
  $bitmap.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $bitmap.Dispose()
}

Write-Host "[landing] wrote $outFile ($actualW x $actualH)"
Write-Host '[landing] verify all shots with: npm run landing:verify-assets'

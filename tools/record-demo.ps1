# Records the ?demo=1 run on the primary screen.
# Needs: tools/serve.js running on port 8081, ffmpeg, Chrome. Output: raw/demo-raw.mkv (not committed).
# Uses a separate, throwaway Chrome profile so your normal browser and tabs are untouched.

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root "raw\demo-raw.mkv"
$profileDir = Join-Path $env:TEMP "lmd-demo-profile"
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$ffmpeg = (Get-Command ffmpeg).Source

# Physical size of the primary screen (the display is scaled, so ask for real pixels).
Add-Type @'
using System; using System.Runtime.InteropServices;
public class DpiRec { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i); }
'@
[DpiRec]::SetProcessDPIAware() | Out-Null
$w = [DpiRec]::GetSystemMetrics(0); $h = [DpiRec]::GetSystemMetrics(1)
Write-Output "Recording primary screen ${w}x${h} for 48 s -> $out"

# GPU capture (Desktop Duplication). The older gdigrab could only keep ~12-16 fps at this size.
$ff = Start-Process -FilePath $ffmpeg -PassThru -WindowStyle Hidden -ArgumentList @(
  "-y", "-f", "lavfi", "-i", "ddagrab=output_idx=0:framerate=30:draw_mouse=0",
  "-t", "48", "-vf", "hwdownload,format=bgra,scale=1920:1200:flags=lanczos",
  "-c:v", "libx264", "-preset", "ultrafast", "-crf", "14", "-pix_fmt", "yuv420p", "`"$out`"")
Start-Sleep -Seconds 2

$cr = Start-Process -FilePath $chrome -PassThru -ArgumentList @(
  "--user-data-dir=`"$profileDir`"", "--no-first-run", "--no-default-browser-check", "--kiosk",
  "--disable-session-crashed-bubble", "--hide-crash-restore-bubble", "http://localhost:8081/?demo=1")

$ff.WaitForExit()
# The demo writes its own measured frame rate into the window title when it finishes.
$title = (Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*fps*" } | Select-Object -First 1).MainWindowTitle
Write-Output "Game window title: $title"
Start-Sleep -Milliseconds 500
& taskkill /PID $cr.Id /T /F | Out-Null
Write-Output "Done. ffmpeg exit code: $($ff.ExitCode)"
Get-Item $out | Select-Object Name, Length

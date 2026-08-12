$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = "$env:TEMP\mpv-handler.pid"

if (Test-Path $pidFile) {
    $handlerPid = Get-Content $pidFile
    if (Get-Process -Id $handlerPid -ErrorAction SilentlyContinue) {
        Write-Host "MPV handler already running (PID: $handlerPid)"
        exit 0
    }
    Remove-Item $pidFile
}

$proc = Start-Process python -ArgumentList "$scriptDir\mpv-handler.py" -PassThru -WindowStyle Hidden
$proc.Id | Out-File $pidFile -NoNewline
Write-Host "MPV handler started (PID: $($proc.Id))"

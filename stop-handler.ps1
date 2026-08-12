$pidFile = "$env:TEMP\mpv-handler.pid"

if (Test-Path $pidFile) {
    $handlerPid = Get-Content $pidFile
    if (Get-Process -Id $handlerPid -ErrorAction SilentlyContinue) {
        Stop-Process -Id $handlerPid -Force
        Write-Host "MPV handler stopped"
    } else {
        Write-Host "Handler not running (stale PID file)"
    }
    Remove-Item $pidFile
} else {
    Write-Host "No handler running"
}

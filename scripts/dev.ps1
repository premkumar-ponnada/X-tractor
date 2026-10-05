# Starts the whole X-tractor dev stack on Windows, each service in its own window.
#   powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
# Needs: MongoDB running (Windows service), Java 11+, backend\venv and frontend\node_modules installed.

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$tikaJar = Get-ChildItem (Join-Path $root 'tools\tika') -Filter 'tika-server-standard-*.jar' -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not (Test-Path (Join-Path $backend 'venv\Scripts\python.exe'))) { Write-Error 'backend\venv is missing — see README "Local setup".'; exit 1 }
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) { Write-Error 'frontend\node_modules is missing — run npm install in frontend.'; exit 1 }
if (-not $tikaJar) { Write-Warning 'No Tika server jar in tools\tika — Apache Tika runs will fail (see README).' }

function Start-Service-Window($title, $dir, $command) {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle='$title'; Set-Location '$dir'; $command"
}

if ($tikaJar) { Start-Service-Window 'X-tractor · Tika' (Split-Path $tikaJar.FullName) "java -jar '$($tikaJar.Name)' --host localhost --port 9998" }
Start-Service-Window 'X-tractor · API' $backend '.\venv\Scripts\python.exe -m uvicorn main:app --port 8000 --reload'
Start-Service-Window 'X-tractor · Worker' $backend '.\venv\Scripts\python.exe run_worker.py'
Start-Service-Window 'X-tractor · Web' $frontend 'npm run dev'

Write-Host 'Started. Open http://localhost:5173 — close the windows to stop.' -ForegroundColor Green

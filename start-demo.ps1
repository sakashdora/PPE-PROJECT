# ARGUS AI — Demo Startup Script
# Starts all 4 tiers: NestJS backend, Next.js frontend, Edge worker, Forensics server
# Run from project root: .\start-demo.ps1

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ARGUS AI — Factory Safety Platform" -ForegroundColor Cyan
Write-Host "  BPUT Hackathon 2026 — PS06" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

# Check for existing processes
function Test-Port {
    param([int]$Port)
    try {
        $conn = New-Object System.Net.Sockets.TcpClient
        $conn.Connect("localhost", $Port)
        $conn.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Host "Checking existing services..." -ForegroundColor Yellow

if (Test-Port 4000) {
    Write-Host "  [RUNNING] NestJS backend on :4000" -ForegroundColor Green
} else {
    Write-Host "  [STARTING] NestJS backend..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm run start:dev" -WindowStyle Normal
}

if (Test-Port 3000) {
    Write-Host "  [RUNNING] Next.js dashboard on :3000" -ForegroundColor Green
} else {
    Write-Host "  [STARTING] Next.js dashboard..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\web'; npm run dev" -WindowStyle Normal
}

if (Test-Port 8080) {
    Write-Host "  [RUNNING] Edge MJPEG stream on :8080" -ForegroundColor Green
} else {
    Write-Host "  [STARTING] Edge MJPEG stream..." -ForegroundColor Yellow
    $venv = "$root\.venv\Scripts\python.exe"
    if (Test-Path $venv) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONPATH='edge'; cd '$root'; & '$venv' -m app.main" -WindowStyle Normal
    } else {
        Write-Host "  [WARNING] Python venv not found at .venv - start edge manually" -ForegroundColor Red
    }
}

if (Test-Port 8090) {
    Write-Host "  [RUNNING] Forensics server on :8090" -ForegroundColor Green
} else {
    Write-Host "  [STARTING] Forensics SSE server..." -ForegroundColor Yellow
    $venv = "$root\.venv\Scripts\python.exe"
    if (Test-Path $venv) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONPATH='edge'; cd '$root'; & '$venv' -m uvicorn app.forensics_server:app --app-dir edge --host 0.0.0.0 --port 8090" -WindowStyle Normal
    } else {
        Write-Host "  [WARNING] Python venv not found at .venv - start forensics manually" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  SYSTEM READY" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Dashboard:   http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API: http://localhost:4000" -ForegroundColor White
Write-Host "  Edge Stream: http://localhost:8080" -ForegroundColor White
Write-Host "  Forensics:   http://localhost:8090" -ForegroundColor White
Write-Host ""
Write-Host "  LOGIN:  supervisor@factory.ai" -ForegroundColor Cyan
Write-Host "  PASS:   supervisor123" -ForegroundColor Cyan
Write-Host ""
Write-Host "  DEMO DATA: Run 'node server/clean-demo-db.js' for fresh incidents" -ForegroundColor Yellow
Write-Host ""

# Open browser
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

@echo off
echo ========================================================
echo Launching LenGen Full-Stack Production Environment
echo ========================================================
start "LenGen Backend Engine (Port 8000)" cmd /k "run_backend.bat"
timeout /t 2 /nobreak >nul
start "LenGen Next.js 14 Dashboard (Port 3000)" cmd /k "run_frontend.bat"
echo Engines launched in separate windows:
echo - Backend API & WebSocket: http://localhost:8000
echo - Frontend Dashboard: http://localhost:3000

@echo off
echo ========================================================
echo Starting LenGen Autonomous Cold Outreach Engine (Backend)
echo ========================================================
cd /d "%~dp0\backend"
call .venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause

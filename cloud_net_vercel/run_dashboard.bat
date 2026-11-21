@echo off
title Datadog Log Anomaly Detection & Self-Healing Web Dashboard
cd /d "%~dp0\web_dashboard"
echo =====================================================================
echo  Launching Datadog Log Anomaly Detection & Autonomous Self-Healing UI
echo =====================================================================
echo.
echo Starting web server on http://localhost:8000 ...
python -m uvicorn server:app --host 127.0.0.1 --port 8000
pause

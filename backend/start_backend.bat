@echo off
cd /d C:\MsSafeData\Desktop\yijiandaodi\backend
echo Starting Django Backend Server...
echo Backend URL: http://localhost:8000
echo API Docs: http://localhost:8000/api/auth/
echo.
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
pause

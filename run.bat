@echo off
echo ========================================================
echo   BrandGuard AI - Intelligent Brand Governance Platform
echo ========================================================
echo.

echo [1/3] Checking Python dependencies...
python -m pip install -r backend/requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Checking Frontend build...
if not exist "frontend\dist\index.html" (
    echo Building React frontend production bundle...
    cd frontend
    call npm install
    call npm run build
    cd ..
) else (
    echo Frontend build found.
)

echo.
echo [3/3] Starting BrandGuard AI Full-Stack Server...
echo --------------------------------------------------------
echo Application URL: http://localhost:5000
echo API Status:      http://localhost:5000/api/health
echo --------------------------------------------------------
echo Press Ctrl+C to terminate.
echo.

python backend/app.py
pause

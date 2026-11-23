#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  BrandGuard AI - Intelligent Brand Governance Platform"
echo "========================================================"
echo ""

echo "[1/3] Checking Python dependencies..."
python3 -m pip install -r backend/requirements.txt

echo ""
echo "[2/3] Checking Frontend build..."
if [ ! -f "frontend/dist/index.html" ]; then
    echo "Building React frontend production bundle..."
    cd frontend
    npm install
    npm run build
    cd ..
else
    echo "Frontend build found."
fi

echo ""
echo "[3/3] Starting BrandGuard AI Full-Stack Server..."
echo "--------------------------------------------------------"
echo "Application URL: http://localhost:5000"
echo "API Status:      http://localhost:5000/api/health"
echo "--------------------------------------------------------"
echo "Press Ctrl+C to terminate."
echo ""

python3 backend/app.py

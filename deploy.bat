@echo off
title CARE OPS PRODUCTION DEPLOYMENT
echo 🛰️ INITIALIZING TACTICAL DEPLOYMENT...
echo ──────────────────────────────────────────────────

echo 🛠️ STEP 1: RUNNING LOCAL CLINICAL BUILD CHECK...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: LOCAL BUILD FAILED. 
    echo ⚠️ DEPLOYMENT ABORTED TO PREVENT VERCEL ERRORS.
    echo 🔍 Please check the errors above and fix them before trying again.
    pause
    exit /b %errorlevel%
)

echo.
echo ✅ LOCAL BUILD VERIFIED GREEN.
echo ──────────────────────────────────────────────────

echo 💾 STEP 2: STAGING AND LOCKING CHANGES...
git add .
git commit -m "tactical: stable hardware update"
if %errorlevel% neq 0 (
    echo ℹ️ INFO: No new changes to commit.
)

echo.
echo 🚀 STEP 3: PUSHING TO COMMAND (GITHUB)...
git push origin master

echo.
echo 🛰️ STEP 4: INJECTING TO PRODUCTION (VERCEL)...
npx vercel --prod --yes

echo.
echo ──────────────────────────────────────────────────
echo 🏁 MISSION COMPLETE: SYSTEM IS LIVE.
echo URL: https://care-ops-os.vercel.app/
echo ──────────────────────────────────────────────────
pause

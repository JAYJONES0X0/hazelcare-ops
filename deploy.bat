@echo off
setlocal
cd /d "%~dp0"

git branch --show-current | findstr /x "master" >nul
if errorlevel 1 (
  echo Deployment stopped: switch to the reviewed master branch first.
  exit /b 1
)
git diff --quiet
if errorlevel 1 (
  echo Deployment stopped: review and commit your changes first.
  exit /b 1
)
git diff --cached --quiet
if errorlevel 1 (
  echo Deployment stopped: review and commit staged changes first.
  exit /b 1
)
call npm ci
if errorlevel 1 exit /b 1
call npm run lint
if errorlevel 1 exit /b 1
call npm test
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
git push origin master
if errorlevel 1 (
  echo Deployment stopped: the Git push failed.
  exit /b 1
)
echo Push accepted. Vercel Git integration will build this commit.
echo Confirm the production deployment is READY before reporting it live.
echo https://app.ovsite.co.uk/
endlocal

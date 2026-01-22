@echo off
chcp 65001 >nul

echo ============================================================
echo   Run Parser Tests with Embedded Python
echo ============================================================

cd /d "%~dp0..\..\"

echo Current Directory: %CD%
echo Embedded Python: %CD%\electron\python\python.exe
echo Test Script: %CD%\test-environment\test-scripts\test-runner.py
echo.

"%CD%\electron\python\python.exe" "test-environment\test-scripts\test-runner.py"

echo.
echo ============================================================
echo   Test execution completed
echo ============================================================

pause

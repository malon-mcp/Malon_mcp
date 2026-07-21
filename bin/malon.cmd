@echo off
REM Malon launcher for Windows
REM This wrapper explicitly calls node to avoid .js file association issues.
node "%~dp0\..\dist\cli\index.js" %*

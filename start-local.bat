@echo off
echo ========================================
echo   NEMY - Iniciar TODO en LOCAL
echo ========================================
echo.

echo [1/3] Matando procesos anteriores...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Iniciando backend local...
start "NEMY Backend" cmd /k "cd /d %~dp0 && npm run server:demo"

timeout /t 5 /nobreak >nul

echo.
echo [3/3] Iniciando frontend local...
start "NEMY Frontend" cmd /k "cd /d %~dp0 && npm run expo:dev"

echo.
echo ========================================
echo   TODO iniciado en LOCAL
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:8081
echo.
echo Presiona cualquier tecla para cerrar...
pause >nul

@echo off
setlocal
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop bulunamadi. Once Docker Desktop'i kurup baslat.
  echo Alternatif: README.md dosyasindaki yerel Node.js kurulumunu kullan.
  pause
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "STREET_BAZAARS_SECRET=%%i"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='.env'; $c=Get-Content -Raw $p; $c=[regex]::Replace($c,'(?m)^JWT_SECRET=.*$','JWT_SECRET=%STREET_BAZAARS_SECRET%'); Set-Content -Path $p -Value $c -Encoding utf8"
)

echo Street Bazaars baslatiliyor. Ilk acilis biraz surebilir.
docker compose up --build -d
if errorlevel 1 (
  echo Baslatma basarisiz. Ayrintilar icin: docker compose logs --tail=100 app
  pause
  exit /b 1
)
start "" "http://localhost:3000"
echo Hazir. Durumu gormek icin: docker compose ps
echo Durdurmak icin: docker compose down
endlocal

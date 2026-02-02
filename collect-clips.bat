 @echo off
  chcp 65001 >nul
  echo ========================================
  echo   치지직 클립 수집기 (Witchs Cauldron)
  echo ========================================
  echo.

  cd /d "%~dp0chizzkData"

  REM 가상환경이 있으면 활성화
  if exist "venv\Scripts\activate.bat" (
      call venv\Scripts\activate.bat
  )

  REM 기본 설정으로 실행 (10개, 인기순)
  python ShortForm.py %*

  echo.
  echo ========================================
  echo   수집 완료! frontend/public/clips 확인
  echo ========================================
  pause
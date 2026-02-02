@echo off
echo ====================================================
echo 치지직 클립 수집기 (ChizzkData) 환경 설정 스크립트
echo ====================================================
echo.

echo [1/4] Anaconda 가상환경 생성 중...
call conda create -n chizzk_clips python=3.9 -y
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 가상환경 생성 실패! Anaconda가 설치되어 있는지 확인하세요.
    pause
    exit /b 1
)

echo.
echo [2/4] 가상환경 활성화 중...
call conda activate chizzk_clips
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 가상환경 활성화 실패!
    pause
    exit /b 1
)

echo.
echo [3/4] 필수 라이브러리 설치 중...
call pip install selenium beautifulsoup4 requests webdriver-manager
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 라이브러리 설치 실패!
    pause
    exit /b 1
)

echo.
echo [4/4] 설치 테스트 중...
call python test_setup.py
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️ 테스트 실패! Chrome 브라우저가 설치되어 있는지 확인하세요.
) else (
    echo ✅ 설치 완료!
)

echo.
echo ====================================================
echo 설치 완료! 이제 다음 명령으로 프로그램을 실행할 수 있습니다:
echo.
echo conda activate chizzk_clips
echo python ShortForm.py
echo ====================================================
echo.
pause
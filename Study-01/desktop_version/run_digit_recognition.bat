:: 작성일: 2026-11-25 01:45 (수정됨)
@echo off
title Handwritten Digit Recognition

:: %~dp0 = 이 bat 파일이 있는 폴더 (어디서 실행하든 경로가 고정됨)
:: 가상환경은 Study-01 루트의 .venv (requirements.txt, .gitignore와 같은 위치)
set "SCRIPT_DIR=%~dp0"
set "VENV_PYTHON=%SCRIPT_DIR%..\.venv\Scripts\python.exe"

if not exist "%VENV_PYTHON%" (
    echo [ERROR] Virtual environment not found:
    echo     %VENV_PYTHON%
    echo.
    echo Create it from the Study-01 folder first:
    echo     py -3.11 -m venv .venv
    echo     .venv\Scripts\python.exe -m pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo Starting Handwritten Digit Recognition Program...
echo Please wait while the program loads (this may take a few minutes)...

"%VENV_PYTHON%" "%SCRIPT_DIR%digit_recognition.py"

pause

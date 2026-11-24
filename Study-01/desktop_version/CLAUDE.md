<!-- 작성일: 2026-11-25 01:45 -->
# desktop_version — Python/Tkinter 데스크톱 앱

공통 규칙과 전처리 규칙은 상위 `../CLAUDE.md`를 따릅니다.

## 구조
- `digit_recognition.py` 단일 파일.
  - 모듈 import 시점에 MNIST를 내려받아 Dense 모델(Flatten → Dense 128 → Dropout 0.2 → Dense 10)을 **실행할 때마다 5 epoch 학습**합니다. 저장된 모델 파일이 없어 시작이 느립니다.
  - 그리기는 Tkinter 캔버스와 PIL `Image`("L" 모드)에 동시에 하고, 예측에는 PIL 이미지를 사용합니다. 캔버스만 수정하면 예측에 반영되지 않습니다.
  - 모델 입력 형태는 `[1, 28, 28]`.
- `run_digit_recognition.bat`: 더블클릭 실행용. `%~dp0..\.venv`(= Study-01 루트의 `.venv`)의 파이썬으로 스크립트를 실행하며, 가상환경이 없으면 생성 방법을 출력하고 종료합니다.

## Commands
Study-01 루트에서:
- 가상환경 생성: `py -3.11 -m venv .venv` (TensorFlow 호환을 위해 3.11 사용. 시스템 기본은 3.14)
- 의존성 설치: `.venv\Scripts\python.exe -m pip install -r requirements.txt` (`matplotlib`, `opencv-python`은 현재 코드에서 미사용)
- 실행: `.venv\Scripts\python.exe desktop_version\digit_recognition.py` 또는 bat 더블클릭

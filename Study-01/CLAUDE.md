<!-- 작성일: 2026-11-25 01:45 (수정됨) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 손글씨 인식 프로그램
손글씨로 숫자(0~9)를 입력하면 AI가 이를 인식하는 프로젝트입니다. 상위 저장소(`VibeCoding`)의 `Study-01` 하위 폴더이며, 빌드/린트/테스트 설정은 없습니다.

## Architecture
- `/desktop_version`: 파이썬(Tkinter) 데스크톱 앱 → `desktop_version/CLAUDE.md`
- `/web_version`: 브라우저용 TensorFlow.js 앱 → `web_version/CLAUDE.md`

두 버전은 코드를 공유하지 않는 독립 구현이지만, 같은 UI 흐름(280x280 흰 캔버스에 그리기 → 지우기/인식 버튼 → 예측 숫자와 신뢰도 % 표시)을 따릅니다.

### 전처리 규칙 (두 버전 공통)
흰 바탕/검은 글씨 캔버스 → 28x28 리사이즈 → `255 - x`로 반전(MNIST는 검은 바탕/흰 글씨) → `/255` 정규화. 한쪽 전처리를 바꾸면 다른 버전도 함께 맞춥니다.

## Development Notes
- 앞으로 만드는 모든 파일은 날짜와 시간을 주석으로 표시합니다. (예: `# 작성일: 2026-11-25 01:45`, HTML은 `<!-- 작성일: ... -->`, 수정 시 `(수정됨)` 추가)

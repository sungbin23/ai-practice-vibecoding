<!-- 작성일: 2026-11-25 02:46 (수정됨) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Study-03 — 지식왕 도전 Ultimate (Vanilla JS 상식 퀴즈)

빌드 도구·패키지 매니저·테스트 프레임워크가 없는 순수 HTML/CSS/JS 프로젝트입니다. 저장소 공통 규칙(main 전용 Git 흐름, 파일 첫 줄 날짜 주석)은 루트 `../CLAUDE.md`를 따릅니다.

## 실행 / 검증
- 실행: `index.html`을 브라우저에서 직접 엽니다(`file://`로 동작하도록 ES 모듈·fetch 없이 `<script>` 태그로만 로드).
- 데이터 검증: `python validate_quiz.py` (스크립트 위치 기준으로 `quiz-data.js`를 찾으므로 어디서 실행해도 됨).
  - 구조 검사(필수 키, 보기 4개, `correctAnswer` 범위, id·문제 중복, 필수 카테고리 4개 각 20문제 이상, 총 80문제 이상) 실패 시 종료 코드 1.
  - `가장/최초/최대/세계에서`가 들어간 문제는 경고만 출력합니다(측정 기준 명시 여부는 수동 확인).
  - 정규식으로 파싱하므로 문자열 값은 큰따옴표 한 줄, 객체 닫는 `}`는 별도 줄에 두는 현재 형식을 유지해야 합니다.

## 구조
- `quiz-data.js`: 전역 `const quizData` 배열. 항목 스키마는 `{ id, category, difficulty, question, options[4], correctAnswer, explanation }`이며 `correctAnswer`는 정답 보기의 0부터 시작하는 **인덱스**입니다. 카테고리는 `한국사`·`과학`·`지리`·`예술과 문화`(3단계 요구사항으로 각 20문제 이상). 정답 위치(`correctAnswer`)는 카테고리마다 0~3이 고르게 나뉘도록 유지합니다.
- 스크립트 로드 순서: `quiz-data.js` → `quiz-records.js` → `quiz-game.js` → `quiz-ui.js`. 모두 classic script라 최상위 `const`/`let`/함수가 파일끼리 공유됩니다.
- `quiz-game.js`: 단일 파일에 전역 상태 변수 + DOM 조작으로 게임 전체를 구현.
  - 화면 전환: `#start-screen` / `#quiz-screen` / `#result-screen`에 `active` 클래스를 토글.
  - 규칙 수치는 파일 상단 상수(`BASE_POINTS`, `FAST_BONUS`, `NO_HINT_BONUS`, `COMBO_BONUS`, `HINTS_PER_GAME`, `SPEED_TIME_LIMIT`, `MODE_QUESTION_COUNT`)에 모여 있습니다.
  - 모드(`currentMode`): `normal`(전체 도전 40문제) / `category`(`startGame('category', 카테고리)`, 10문제, 버튼은 `quizData` 카테고리로 자동 생성) / `speed`(20문제, 문제당 15초, `timer`를 문제마다 재시작) / `survival`(오답 1회 시 `showResult(false, true)`) / `timeattack`(전역 60초, 같은 `timer` 변수를 공유하므로 `loadQuestion`에서 timeattack일 때는 clear하지 않음).
  - 점수: 정답 10점 + 10초 내 정답 +3 + 그 문제에서 힌트 미사용 +2 + 2연속 이상 콤보 +5. 힌트는 오답 2개 제거, 게임당 3회. 시간 초과는 `checkAnswer(-1, null)`로 처리(응답 시간 15초로 기록).
  - 문제별 경과 시간은 `elapsedTicker`(모든 모드)와 `getElapsedMs()`로 관리하며 일시정지 시간은 제외됩니다. `pauseGame`/`resumeGame`은 `timer`(speed·timeattack)와 `elapsedTicker`를 멈췄다 다시 시작합니다.
  - 결과 분석(`renderAnalysis`)은 `answeredCount`·`totalResponseMs`·`maxCombo`·`categoryStats`로 정답률, 평균 응답 시간, 최장 연속 정답, 카테고리별 정답 수를 그립니다. `showResult`는 `isGameOver`로 중복 호출을 막습니다.
  - 역대 최고 점수는 `localStorage` 키 `knowledge_king_highscore`(기존 기능 유지). `showResult`에서 `buildGameRecord`로 기록을 만들어 `saveGameRecord`로 저장합니다(푼 문제가 0개면 저장 안 함).
  - 키보드: 퀴즈 화면에서 1~4 보기, H 힌트, Enter/→ 다음, Esc/P 일시정지. 열린 `<dialog>`가 있거나 입력창에 포커스가 있으면 무시합니다.
  - 결과 공유: `buildShareText` + `copyText`(Clipboard API, 안 되면 `execCommand('copy')` 대체).
  - 효과음은 Web Audio API 오실레이터로 합성(외부 음원 없음), 폭죽은 `#confetti-canvas` 캔버스 파티클.
- `quiz-records.js`: DOM 없이 localStorage만 다루는 데이터 계층. 키는 `STORAGE_KEYS`(`knowledge_king_records`·`_profiles`·`_current_profile`·`_theme`). 기록은 최대 500개(`MAX_RECORDS`). `getLeaderboard(period, category)`는 `daily`(오늘)·`weekly`(이번 주 월요일부터)·`all`·`category`(카테고리별 도전 기록만)로 거른 뒤 프로필별 최고 기록 상위 10개를 돌려줍니다. `getProfileStats`는 통계 대시보드용 집계입니다.
- `quiz-ui.js`: 상단 바, 다크모드(`<html data-theme>`; 깜빡임 방지를 위해 초기값은 `index.html` `<head>`의 인라인 스크립트가 설정), 리더보드·통계·프로필 `<dialog>`. 퀴즈 중 대화상자를 열면 `pauseGame()`을 호출합니다. 점수 추이 그래프는 라이브러리 없이 SVG로 그립니다.
- `styles.css`: 색은 `:root`와 `[data-theme="dark"]`의 CSS 변수로만 지정합니다. 새 색을 쓸 때는 두 테마 모두에 변수를 추가합니다.

## 퀴즈 데이터 작성 규칙 (할루시네이션 방지 가이드라인)
README에 명시된 프로젝트 핵심 원칙이므로 문제를 추가·수정할 때 지킵니다.
1. 정답이 하나만 성립하도록 질문을 구성합니다.
2. '가장', '최초' 등 최상급 표현에는 측정 기준을 명시합니다(예: "(전통적 측정 기준)", "(2024년 기준)").
3. 신뢰할 수 있는 복수 출처로 교차 검증된 사실만 사용하고, 수정 후 `validate_quiz.py`로 확인합니다.

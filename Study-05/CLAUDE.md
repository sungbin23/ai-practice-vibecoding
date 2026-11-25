<!-- 작성일: 2026-11-25 17:37 (수정됨 2026-11-25 18:33: PDF 요약 앱 섹션 추가) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Study-05 — AI 공감 다이어리 (OpenRouter 기반 감정 분석·공감 일기)

오늘 있었던 일을 한 줄로 쓰면 AI가 감정을 분석하고 공감·위로 메시지를 주는 일기 앱입니다. 저장소 공통 규칙(main 전용 Git 흐름, Study별 커밋 분리, 새 파일 첫 줄 날짜·시간 주석, 퀴즈 교차 검증 가이드라인)은 루트 `../CLAUDE.md`를 따릅니다.

## 실행 / 검증
외부 npm 패키지가 **없습니다**(Node 20+ 내장 모듈만). 의존성을 추가하지 않는 것을 기본으로 합니다.
- 실행: `npm start` → http://localhost:3000. `npm run demo`(= `--demo`)는 키가 있어도 데모 모드 강제. 포트는 `PORT`, 저장 위치는 `DATA_DIR`(기본 `data/`, git 무시).
- 테스트 전체: `npm test` (= `node --test "test/*.test.js"`). 하나만: `node --test test/regression.test.js`, 특정 케이스: `node --test --test-name-pattern="부정" "test/*.test.js"`.
- `test/api.test.js`는 API 계약(데모, 입력 검증, 정렬, 삭제, 정적 파일, 가짜 `chat` 주입으로 실제 모드 파싱·502), `test/regression.test.js`는 QA에서 나온 회귀 케이스(데모 감정 오탐·부정문·대조, 저장소 손상, 헤더, listen 오류). 임시 폴더는 `after`에서 지웁니다. 실제 API를 호출하는 테스트는 만들지 않습니다.
- 서버를 직접 띄워 확인할 때 띄운 프로세스만 종료합니다(`taskkill /IM node.exe` 금지).

## API 키 / 데모 모드
- 키는 `Study-05/.env`의 `OPENROUTER_API_KEY`(견본 `.env.example`). `lib/config.js` 자체 파서가 읽고, 이미 설정된 환경 변수는 덮어쓰지 않습니다. 키는 서버에서만 씁니다.
- 키가 비었거나 견본 문구면, 또는 `DEMO_MODE=1`/`--demo`면 데모 모드입니다. 이때는 `lib/analyze.js`의 `demoAnalysis`가 키워드로 감정을 고르고, 프론트는 `/api/status`의 `demo`로 "데모 모드: API 키 없음" 배너를 켭니다.
- **키가 있는데 API가 실패하면 데모로 대체하지 않고** 502와 한국어 메시지를 돌려주며 저장하지 않습니다(401/403·402·429·404·타임아웃 구분, `lib/openrouter.js`).
- 모델은 `MODEL`(기본 `deepseek/deepseek-chat-v3.1:free`)로 바꿉니다.

## 구조
- `server.js`: `createApp(config, { chat })`. 제공하는 정적 파일은 `GET /`·`/index.html`뿐입니다(그 외는 404 JSON이라 `.env`가 노출되지 않음). API는 `GET /api/status`, `GET /api/entries`(createdAt 오름차순), `POST /api/entries {text}`(trim 후 1~200 **코드포인트**, 분석 후 저장, 201), `DELETE /api/entries/:id`입니다. 오류는 항상 `{error:"한국어"}` 형식입니다.
- Entry: `{ id, text, createdAt, demo, analysis:{ emotion, emoji, intensity(1~5), keywords(≤3), empathy, comfort } }`. 모델 출력은 `parseModelOutput`(코드블록·앞뒤 설명 제거)를 거쳐 `normalizeAnalysis`로 스키마를 강제합니다.
- 데모 분석(`lib/analyze.js`): 감정 단어 `words`는 1점, 상황 단서 `cues`(시험·야근·합격 등)는 0.5점입니다. 부정문(`-지 않`, `안 X`, `없이`)은 반대 감정에 절반 점수를 주고, 이중 부정은 세지 않습니다. `지만/그런데` 대조문은 뒤쪽 절을 우선합니다. 판정을 바꾸면 `regression.test.js`에 케이스를 추가합니다.
- 저장(`lib/store.js`): `data/diary.json`에 임시 파일→rename으로 씁니다. 쓰기는 직렬화하고, 같은 밀리초에 들어온 항목은 createdAt을 1ms씩 늘려 순서를 보장합니다. 손상된 파일은 `diary.json.corrupt-<시각>`으로 백업한 뒤 빈 목록으로 시작합니다.
- `index.html`: CSS·JS를 모두 인라인으로 넣은 단일 파일입니다. 사용자·모델 문자열은 `escapeHtml`이나 `textContent`로만 넣습니다. 한글 조합 중 Enter(`isComposing`)는 무시하고, `busy` 플래그로 중복 제출을 막습니다. 목록은 날짜별로 묶어 시간 순서대로 보여 줍니다. 결과 카드는 `resultId`로 추적해 해당 일기를 지우면 비웁니다. 연결 실패 시 재시도 버튼을 보여 줍니다.

실습 결과물의 커밋은 이 폴더 변경만 담아 `Study-05: ...` 형식으로 `main`에 push합니다.

## PDF 요약 앱 (같은 폴더의 별도 앱)
PDF를 올리면 텍스트를 추출해 AI가 요약합니다. 상세 명세는 `PRD_PDF_Summary_App.md`입니다. 다이어리 앱(`server.js`)과는 진입점이 다르고, `lib/config.js`·`lib/openrouter.js`만 함께 씁니다.
- 실행: `npm run pdf` → http://localhost:3001. `npm run pdf:demo`는 데모를 강제합니다. 포트는 `PORT`가 아니라 `PDF_PORT`(기본 3001)입니다.
- `pdf-server.js`: `createPdfApp(config, { chat, summarize })`. 정적 파일은 `GET /`·`/index_pdf.html`뿐입니다. `GET /api/status`는 `{demo, model}`을 돌려줍니다. `POST /api/summarize`는 PDF 원본 바이트를 받고(Content-Type `application/pdf`·`application/octet-stream`·없음 허용), 파일명은 `X-File-Name` 헤더에 encodeURIComponent로 넣습니다.
- 오류: 10MB 초과 413, 빈 본문 400, PDF 아님 415, 암호화·텍스트 없음(스캔본)·손상 422, AI 실패 502(데모로 대체하지 않음). 응답은 `{ fileName, pages, chars, truncated, demo, summary:{ title, oneLine, keyPoints(1~5, AI는 3~5), keywords(≤5) } }`입니다.
- `lib/pdf-extract.js`: 외부 패키지 없이 node:zlib으로 구현한 경량 파서입니다. 객체는 xref 없이 스캔하고, ObjStm·FlateDecode·ToUnicode(Identity-H 한글)를 지원합니다. 줄바꿈·공백은 텍스트 위치 추적과 폰트 폭(`/Widths`, `/W`, `/DW`, Tc/Tw/Tz)으로 판정합니다(공백 임계 ≥0.2em, 폭 정보가 없으면 한글 1em 등으로 추정). OCR·암호 해독·Form XObject는 지원하지 않습니다.
- `lib/summarize.js`: 모델 입력은 앞 12,000자입니다. 문서는 `<document>` 구분자로 감싸 프롬프트 인젝션을 막고, `normalizeSummary`가 스키마를 강제합니다(불량이면 `BAD_SUMMARY`). `demoSummary`는 결정적으로 동작합니다. 줄 이어붙이기, 머리글·페이지 번호 제거, 여러 줄 제목 합치기, 제목 줄을 본문에서 빼고 첫 완결 문장을 한 줄 요약으로 씁니다.
- 테스트: `test/pdf-extract.test.js`, `pdf-api.test.js`, `pdf-summarize.test.js`, `pdf-qa.test.js`(QA 회귀). 테스트용 PDF는 `test/pdf-helpers.js`로 코드에서 만들고 PDF 파일은 커밋하지 않습니다. 추출·데모 판정을 바꾸면 `pdf-qa.test.js`에 회귀 케이스를 추가합니다.

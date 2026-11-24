<!-- 작성일: 2026-11-25 03:13 (수정됨) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Study-04 — 냉장고를 부탁해 (OpenRouter 기반 재료 인식·레시피 추천 웹앱)

냉장고 사진에서 재료를 인식하고, 그 재료로 레시피를 추천·저장하는 웹 애플리케이션 실습입니다. 저장소 공통 규칙(main 전용 Git 흐름, Study별 커밋 분리, 파일 첫 줄 날짜 주석)은 루트 `../CLAUDE.md`를 따릅니다.

## 실행 / 검증
외부 npm 패키지가 **없습니다**(Node 20+ 내장 `http`·`fetch`·`crypto`·`node:test`만 사용). 의존성을 추가하지 않는 것을 기본으로 합니다.
- 실행: `npm start` (= `node server.js`) → http://localhost:3000. `npm run demo`(= `--demo`)는 키가 있어도 데모 모드 강제.
- 테스트 전체: `npm test` (= `node --test "test/*.test.js"`)
- 테스트 하나: `node --test test/step2.test.js`, 특정 케이스는 `node --test --test-name-pattern="fallback" "test/*.test.js"` (폴더 `test/`만 넘기면 동작하지 않음)
- 테스트는 `test/helpers.js`의 `startServer({ demo, chat })`로 임시 `dataDir`과 포트 0에 서버를 띄웁니다. `chat`에 가짜 함수를 넘기면 실제 OpenRouter 없이 "실제 모드" 경로(응답 파싱·오류 처리)를 검사할 수 있습니다. 실제 API를 호출하는 테스트는 만들지 않습니다.
- 서버를 직접 띄워 확인할 때 다른 node 프로세스를 일괄 종료(`taskkill /IM node.exe` 등)하지 말고, 띄운 프로세스만 종료합니다.

## API 키 / 데모 모드
- 키는 `Study-04/.env`의 `OPENROUTER_API_KEY`(견본: `.env.example`). `lib/config.js`의 자체 파서가 읽으며 이미 설정된 환경 변수는 덮어쓰지 않습니다. 키는 서버에서만 쓰고 `/api/status` 등으로 내려보내지 않습니다.
- 키가 비었거나 견본 문구면(`isUsableKey`) 또는 `DEMO_MODE=1`/`--demo`면 `config.demo=true`. 데모 모드에서 `/api/recognize`·`/api/recipes`는 `lib/demo-data.js`의 샘플을 돌려주고, 프론트는 `/api/status`의 `demo`로 상단 "데모 모드: API 키 없음" 배너를 켭니다.
- **키가 있는데 API가 실패하면 데모 데이터로 대체하지 않고** 502 + 한국어 메시지(`openrouter.userMessageFor`)를 돌려줍니다.
- 모델은 `VISION_MODEL`(기본 `google/gemma-3-27b-it:free`), `TEXT_MODEL`(기본 `deepseek/deepseek-chat-v3.1:free`) 환경 변수로 바꿀 수 있습니다. 무료 모델은 자주 바뀝니다.

## 구조
- `server.js`: `createApp(config, { chat })`가 http 서버를 만듭니다. `routes` 객체(`'METHOD /path'` → `async (ctx) => 결과`)에 API를 모으고, `/:id` 경로 변수는 `findRoute`가 처리합니다. 핸들러는 결과 객체를 반환하고 `ctx.status`·`ctx.headers`로 상태 코드·쿠키를 정하며, 오류는 `HttpError(status, 한국어메시지)`를 던집니다. `/api/` 밖은 `public/` 정적 파일.
- AI 흐름: `lib/recognize.js`(1단계)·`lib/recipes.js`(2단계)가 프롬프트를 만들고 `chat()` 결과를 `extractJson`(코드블록·앞뒤 설명 제거)으로 꺼낸 뒤 `normalize*`로 스키마를 강제합니다. 모델 출력은 신뢰하지 않습니다.
  - 레시피 스키마: `{ title, cuisine, difficulty, timeMinutes, servings, ingredients:[{name, amount, have, pantry}], steps[], tip }`. `have`는 서버가 `markHave`로 사용자 재료와 비교해 다시 계산(포함 관계 허용, 1글자 이름은 정확히 일치할 때만). `PANTRY`(소금·설탕 등)는 "더 필요한 재료"·대시보드 TOP 5에서 제외.
  - 저장 시 `sanitizeRecipeForSave`가 같은 정규화를 거쳐 모르는 필드를 버립니다.
- `lib/store.js`(3단계): `data/users.json`·`data/saved_recipes.json`(`data/`는 git 무시)에 임시 파일→rename으로 기록. 비밀번호는 scrypt+salt, 세션은 **메모리 Map**(서버 재시작 시 재로그인), 쿠키 `sid`(HttpOnly, SameSite=Lax). 같은 사용자·같은 제목 레시피는 409. 로그인 상태에서 인식/생성 시 `stats.recognitions`/`generations` 증가.
- `public/app.js`: 단일 `state` 객체 + 렌더 함수(`renderIngredients`, `renderRecipes`, `loadSavedList`, `loadDashboard`). 사용자 문자열은 반드시 `escapeHtml`을 거쳐 innerHTML에 넣습니다. 이미지는 업로드 전 캔버스로 긴 변 1024px JPEG로 줄입니다. 탭(요리하기/나의 레시피/대시보드)은 `showView`, 로그인이 필요한 동작은 `openAuth(이어서 할 함수)`로 로그인 후 재개합니다. 대시보드 그래프는 라이브러리 없이 CSS 막대.

## 개발 단계 (PRD)
`PRD_step1.md`(재료 인식) → `PRD_step2.md`(재료 수정·종류/난이도 → 레시피) → `PRD_step3.md`(로그인·저장·대시보드) 순으로 구현되어 있고, 테스트 파일도 `test/step1~3.test.js`로 단계별입니다. 기능을 바꾸면 해당 PRD도 맞춰 고칩니다.
테스트용 이미지는 `Study-04/냉장고.jpg`(교재 저장소 `입력예제` 폴더). 이후 실습에서 프로젝트 서브에이전트(`code-bug-analyzer`, `performance-optimizer`, `ux-design-advisor`)로 리뷰·최적화·UX 개선을 하며 백업은 `backup/`(git 무시)에 둡니다.

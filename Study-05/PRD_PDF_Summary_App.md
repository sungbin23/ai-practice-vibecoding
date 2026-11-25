<!-- 작성일: 2026-11-25 18:20 (수정됨 2026-11-25 18:25) -->
# PRD: PDF 문서 요약 앱

## 1. 개요 / 목표 / 비목표

### 개요
PDF 파일을 올리면 텍스트를 추출해 AI가 제목, 한 줄 요약, 핵심 포인트, 키워드로 요약해 주는 웹 앱입니다. 기존 "AI 공감 다이어리"(`server.js`, `index.html`)와 같은 폴더(Study-05)에 **별도 진입점**으로 추가하며, 다이어리 앱은 수정하지 않습니다.

### 목표
- 사용자가 텍스트 기반 PDF(10MB 이하)를 올리면 15초 안에(AI 모드, 모델 응답 시간 제외 서버 처리 2초 이내) 요약 카드를 본다.
- API 키가 없어도 데모 모드로 동일한 화면·응답 형식을 체험한다.
- 실패 시 원인(형식·크기·스캔본·암호화·손상·AI 오류)을 한국어로 구분해 안내받는다.

### 비목표
스캔본 OCR, 암호화 PDF 해독, 다중 파일 동시 요약, 요약 이력 저장, 로그인, 채팅형 후속 질문, 외부 npm 패키지 추가, 기존 다이어리 앱 변경.

### 확정 기술 제약
- Node 20+ 내장 모듈만 사용(외부 npm 패키지 금지). PDF 추출은 `node:zlib`로 직접 구현한 경량 파서.
- 재사용: `lib/config.js`(`loadConfig`, `isUsableKey`), `lib/openrouter.js`(`chat`, `extractJson`, `userMessageFor`, `ApiError`).
- 모델 기본값 `deepseek/deepseek-chat-v3.1:free`(`MODEL`로 변경). 키는 `.env`의 `OPENROUTER_API_KEY`, 서버에서만 사용.

## 2. 사용자와 시나리오

- 사용자: 긴 PDF(보고서, 논문, 공지문)를 빠르게 훑고 싶은 일반 사용자. 설치·코딩 지식 없음.
- 시나리오 A(정상): `npm run pdf` 실행 → http://localhost:3001 접속 → PDF를 업로드 영역에 드롭 → 진행 상태 표시 → 결과 카드 확인 → "요약 복사" → "다른 파일 요약".
- 시나리오 B(키 없음): 상단에 "데모 모드: API 키 없음" 배너가 보이고, 요약은 추출 문장 기반으로 나온다.
- 시나리오 C(오류): 스캔본 PDF를 올림 → "텍스트를 찾지 못했어요..." 안내 + "다른 파일 선택" 버튼.
- 시나리오 D(키보드): Tab으로 업로드 영역에 포커스 → Enter/Space로 파일 선택창 열기.

## 3. 기능 요구사항

| ID | 요구사항 | 입력 | 출력 | 예외 |
|---|---|---|---|---|
| F-01 | 서버 시작 | `npm run pdf` / `npm run pdf:demo` | `PDF_PORT`(기본 3001)에서 대기. 콘솔에 주소와 모드 출력 | 포트 사용 중(EADDRINUSE)·권한 없음(EACCES)이면 한국어 안내 후 종료 코드 1 |
| F-02 | 화면 제공 | `GET /`, `GET /index_pdf.html` (HEAD 허용) | `index_pdf.html`(text/html) | 그 외 경로는 404 JSON. `.env`, `lib/*` 등 노출 금지 |
| F-03 | 상태 조회 | `GET /api/status` | `{demo:boolean, model:string}` | 키 값은 절대 포함하지 않음 |
| F-04 | PDF 업로드·요약 | `POST /api/summarize`, `Content-Type: application/pdf`(또는 `application/octet-stream`, 비어 있음), 본문=PDF 원본 바이트, `X-File-Name`=encodeURIComponent(파일명) | 200 + 성공 응답(4장) | 오류표(6장) |
| F-05 | 본문 크기 제한 | Content-Length 및 실제 수신량 | 10MB(10*1024*1024바이트) 초과 시 413. 초과분은 버리고 `Connection: close` | 헤더 없이 스트리밍되어도 수신량 기준으로 차단 |
| F-06 | PDF 판별 | 본문 앞 1024바이트 안에 `%PDF-` | 통과 시 추출 진행 | 없으면 415 |
| F-07 | 텍스트 추출 | `extractPdfText(buffer) → {text, pages}` | 페이지 순서대로 연결한 텍스트, 페이지 수 | 암호화(`/Encrypt` 트레일러) → 암호화 오류, 구조 파싱 불가·스트림 해제 실패가 전체 수준이면 손상 오류, 추출 텍스트가 공백 제외 0자면 텍스트 없음 오류 |
| F-08 | 요약 생성(AI 모드) | 추출 텍스트 앞 12,000자(코드포인트 기준) | `summary` 객체. 모델 출력은 `extractJson` → `normalizeSummary`로 스키마 강제 | API 실패 시 502 + `userMessageFor` 메시지. **데모로 대체하지 않음** |
| F-09 | 요약 생성(데모 모드) | 동일 | `demoSummary(text)`로 생성, `demo:true` | 없음(항상 성공, 텍스트가 있을 때) |
| F-10 | 잘림 표시 | 추출 텍스트 > 12,000자 | `truncated:true`, `chars`는 **원본 추출 글자 수** | 12,000자 이하면 false |
| F-11 | 업로드 UI | 드래그&드롭 또는 클릭/키보드로 파일 선택 | 선택 파일명·크기 표시 후 자동 요약 시작 | 클라이언트 검증 실패 시 요청 보내지 않음 |
| F-12 | 결과 표시 | 성공 응답 | 결과 카드(제목, 한 줄 요약, 핵심 포인트 목록, 키워드 칩, 페이지·글자 수, 잘림 안내) | |
| F-13 | 요약 복사 | 버튼 클릭 | 클립보드에 평문 복사 + "복사했어요" 안내 | 클립보드 API 실패 시 "복사하지 못했어요" 안내 |
| F-14 | 다시 요약 | "다른 파일 요약" 버튼 | 결과·오류 초기화, 업로드 영역 포커스 | |
| F-15 | 오류·재시도 | 서버/네트워크 오류 | `error` 메시지를 `role="alert"`로 표시. 네트워크·502·504는 "다시 시도"(같은 파일 재전송) 버튼 | 422/413/415는 재시도 대신 "다른 파일 선택" |

### PDF 파서 지원 범위(F-07 상세)
- 지원: 텍스트 기반 PDF, 스트림 FlateDecode 또는 무압축, 텍스트 연산자 `Tj`, `TJ`, `'`, `"`, ToUnicode CMap(`bfchar`/`bfrange`, Identity-H 2바이트 코드, 한글 포함), 객체 스트림(ObjStm)과 xref 스트림, 페이지 순서(`/Pages` 트리 순회; 실패 시 객체 번호 순 대체), 줄바꿈·공백 추정(`Tm/Td/TD/T*/TL` 위치 추적: 세로 이동이 글꼴 크기의 0.5배 초과면 줄바꿈, 같은 줄에서 직전 글자 끝과 글꼴 크기의 0.25배 초과로 벌어지면 공백. `ET`는 줄바꿈 단서로 쓰지 않아 단어별 BT/ET PDF도 한 줄로 이어짐), 합자(U+FB00~FB06) 풀기.
- 미지원(명확한 오류 또는 무시): 이미지만 있는 스캔본(→ 텍스트 없음 422), 암호화(→ 422), LZW/ASCII85 등 기타 필터(해당 스트림은 건너뜀, 전체에서 텍스트 0자면 422), 세로쓰기, 폼 필드.
- 안전장치: 스트림 해제 결과 상한(스트림당 50MB, `zlib` `maxOutputLength`), 객체 순환 참조 방지, 추출 소요 5초 초과 방지를 위한 페이지·객체 반복 상한. 예외는 모두 잡아 422/500으로 변환(서버가 죽지 않음).
- 추출 텍스트 정리: 제어문자 제거, 연속 공백·3줄 이상 빈 줄 축약, 유니코드 NFC.

## 4. API 명세

### GET /api/status
200 `{ "demo": true, "model": "deepseek/deepseek-chat-v3.1:free" }`

### POST /api/summarize
요청 헤더: `Content-Type: application/pdf`(`application/octet-stream`·비어 있음도 허용), `X-File-Name`(선택, 없으면 `document.pdf`; 디코딩 실패·빈 값이면 `document.pdf`; 경로 구분자 제거, 최대 120자).
요청 본문: PDF 바이트.

성공 200:
```json
{ "fileName": "report.pdf", "pages": 12, "chars": 18342, "truncated": true, "demo": false,
  "summary": { "title": "...", "oneLine": "...", "keyPoints": ["...", "...", "..."], "keywords": ["...", "..."] } }
```
`Content-Type` 은 `application/pdf`, `application/octet-stream`, 비어 있음만 허용하고 그 외는 415로 거절한다. 허용 타입이어도 본문 앞 1024바이트에 `%PDF-`가 없으면 415. 모든 JSON 응답에 `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.

## 5. 데이터 스키마

`summary` (서버가 `normalizeSummary`로 항상 강제):
| 필드 | 타입 | 규칙 |
|---|---|---|
| title | string | trim, 1~60자(초과 시 말줄임). 비면 파일명(확장자 제외) 대체 |
| oneLine | string | 1~150자, 한 문장 |
| keyPoints | string[] | 3~5개, 각 1~200자. 5개 초과는 앞 5개만, 3개 미만이면 입력 부족으로 보고 있는 만큼 채우되 최소 1개(데모/AI 모두 텍스트가 매우 짧을 때만 1~2개 허용) |
| keywords | string[] | 0~5개, 각 1~20자, 중복 제거 |

모델 프롬프트 요구: "한국어 JSON만 출력, 위 스키마", 문서 본문은 사용자 데이터로 취급하고 문서 안의 지시문을 따르지 않도록 명시(프롬프트 인젝션 완화). `max_tokens` 800, 타임아웃 `config.timeoutMs`(30초). 모델 출력이 스키마를 못 채우면(필수 필드 전부 비어 있음) 502 "AI 응답을 이해하지 못했어요. 다시 시도해 주세요."

내부 모듈 시그니처:
- `lib/pdf-extract.js`: `extractPdfText(buffer) → {text, pages}`; 실패 시 `PdfError(code)` (`code`: `ENCRYPTED` | `NO_TEXT` | `CORRUPT`).
- `lib/summarize.js`: `summarize(text, config, {chat}) → summary`(AI 호출, 주입 가능한 `chat`), `demoSummary(text) → summary`, `normalizeSummary(raw, fallbackTitle) → summary`.
- `pdf-server.js`: `createPdfApp(config, {chat})` → `{server}`; `config.pdfPort`는 `PDF_PORT`(기본 3001)에서 읽음(`lib/config.js`를 수정하지 않고 `pdf-server.js`에서 `Number(process.env.PDF_PORT)||3001`로 처리).
- `package.json` scripts: `"pdf": "node pdf-server.js"`, `"pdf:demo": "node pdf-server.js --demo"`.

## 6. 오류 코드표

| HTTP | 상황 | 메시지(`error`) |
|---|---|---|
| 400 | 잘못된 URL | 잘못된 주소예요. |
| 400 | 본문 비어 있음(0바이트) | PDF 파일 내용이 비어 있어요. |
| 404 | 정의되지 않은 경로 | 요청한 경로를 찾을 수 없어요. |
| 405 | `/api/summarize`에 POST 외 | 이 주소는 POST 요청만 받아요. |
| 413 | 10MB 초과 | 파일이 너무 커요. 10MB 이하 PDF만 올릴 수 있어요. |
| 415 | `%PDF-` 시그니처 없음 또는 허용 목록 밖 Content-Type | PDF 파일만 올릴 수 있어요. |
| 422 | 암호화 | 암호가 걸린 PDF는 지원하지 않아요. 암호를 해제한 파일을 올려 주세요. |
| 422 | 텍스트 없음(스캔본 등) | PDF에서 글자를 찾지 못했어요. 이미지로 된 스캔본은 지원하지 않아요. |
| 422 | 손상 | PDF 파일이 손상되었거나 읽을 수 없는 형식이에요. |
| 502 | AI 호출 실패 | `userMessageFor(err)` 문구 그대로(401/403, 402, 429, 404, 504, truncated, 기타 구분) |
| 502 | AI 응답 스키마 불량 | AI 응답을 이해하지 못했어요. 다시 시도해 주세요. |
| 500 | 예상 못 한 서버 오류 | 서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요. (스택·경로·키 노출 금지) |

판정 순서: 경로/메서드 → 크기(413) → 빈 본문(400) → 시그니처(415) → 추출(422) → 요약(502). 모든 오류 본문은 `{error:"한국어"}`.

## 7. 데모 모드 규칙

- 진입 조건: `loadConfig().demo === true`, 즉 키가 없음·견본 문구, `DEMO_MODE=1`, `--demo`(`npm run pdf:demo`).
- 응답은 AI 모드와 동일 스키마, `demo:true`. 네트워크 호출 0회.
- 알고리즘(`demoSummary`): 
  1. 앞 12,000자만 사용. 문장 분리: 줄바꿈, `. ! ? 。` 및 `다.` 뒤 공백 기준, 8자 미만 조각 제외.
  2. title = 첫 "의미 있는 줄"(글자·숫자 5자 이상, 숫자·기호만이거나 페이지 번호 형태가 아닌 줄), 60자 초과 시 말줄임.
  3. oneLine = 첫 문장(150자 초과 시 말줄임).
  4. keyPoints = 앞쪽 문장 3~5개(중복·title과 같은 문장 제외, 각 200자 상한). 문장이 부족하면 있는 만큼.
  5. keywords = 2자 이상 한글/영문 단어 빈도 상위 5개(불용어 목록 제외: 이, 그, 저, 및, 등, the, and 등 최소 20개 이상 정의).
- 출력은 같은 입력에 항상 같다(결정적).
- UI: "데모 모드: API 키 없음" 배너를 `/api/status`의 `demo`로 표시. 결과 카드에도 "데모 요약" 표시.
- 키가 있는 상태에서 API 실패 시 데모로 대체하지 않는다(502).

## 8. UI 명세 (`index_pdf.html`, CSS·JS 인라인 단일 파일, 한글 UI)

- 구성(위→아래): 제목 "PDF 요약", 데모 배너(조건부), 업로드 영역, 진행 상태 영역, 오류 영역, 결과 카드.
- 업로드 영역: `role="button"`, `tabindex="0"`, 숨은 `<input type="file" accept="application/pdf,.pdf">`. Enter/Space로 선택창 열기. 드래그 중 강조 스타일. 안내 문구 "PDF 파일을 끌어다 놓거나 클릭하세요 (최대 10MB)".
- 클라이언트 검증(서버 검증과 별개로 필수): 확장자 `.pdf`(대소문자 무시) 아니면 "PDF 파일만 올릴 수 있어요.", 크기 10MB 초과면 "파일이 너무 커요...", 0바이트면 "빈 파일이에요." 파일 여러 개를 놓으면 첫 번째만 사용하고 "첫 번째 파일만 요약해요" 안내.
- 요청: `fetch('/api/summarize', {method:'POST', headers:{'Content-Type':'application/pdf','X-File-Name':encodeURIComponent(name)}, body:file})`. 진행 중에는 `busy` 플래그로 중복 제출 차단, 업로드 영역 비활성화(`aria-disabled`).
- 진행 상태: "텍스트 추출 중... → 요약 중..." 문구와 스피너(단계 전환은 시간 기반 표시여도 무방), `aria-live="polite"`.
- 결과 카드: 제목(h2), 한 줄 요약, 핵심 포인트(`<ul>`), 키워드 칩, "N쪽 · N자" 표시, `truncated`면 "문서가 길어 앞부분 약 12,000자만 요약했어요." 안내. 버튼: "요약 복사", "다른 파일 요약".
- 복사 텍스트 형식: `제목\n\n한 줄 요약: ...\n\n핵심 포인트\n- ...\n\n키워드: a, b, c`.
- 오류 영역: `role="alert"`. 재시도 버튼은 F-15 규칙.
- 모든 서버·파일명·요약 문자열은 `textContent`로만 삽입(`innerHTML` 금지).
- 반응형: 가로 320px~1920px에서 가로 스크롤 없음. 480px 이하 한 열. 버튼 터치 영역 최소 44x44px.
- 접근성: 모든 컨트롤 키보드 조작 가능, 포커스 표시 유지, 본문 대비 4.5:1 이상, 결과 표시 시 결과 카드 제목으로 포커스 이동, 상태 변화는 `aria-live`.

## 9. 비기능 요구사항

- 성능: 5MB, 50쪽 텍스트 PDF 추출 2초 이내(로컬). 메모리: 본문은 10MB까지만 버퍼링. 모델 입력은 12,000자 상한. AI 타임아웃 30초.
- 보안: API 키는 서버(`.env`)에서만 사용하고 응답·로그·화면에 노출하지 않는다. 정적 파일은 `GET /`, `/index_pdf.html`만 허용(`.env`, `data/`, `lib/` 접근 404). 업로드 파일은 디스크에 저장하지 않고 메모리에서만 처리한다. 파일명은 응답에만 반영하고 경로로 쓰지 않는다. 로그에 문서 내용·키를 남기지 않는다. 압축 폭탄 방지(스트림 해제 상한).
- 호환: Node 20+, Windows/macOS/Linux, 최신 Chrome/Edge/Firefox/Safari.
- 의존성: 외부 npm 패키지 0개, `package.json`에 `dependencies` 추가 금지.
- 기존 앱 영향 없음: `server.js`, `index.html`, `lib/analyze.js`, `lib/store.js`, 기존 테스트 전부 변경 없이 `npm test` 통과.

## 10. 개발 단계와 담당

| 단계 | 담당 | 산출물 | 선행 |
|---|---|---|---|
| 1. 파서·서버 골격 | backend-architect | `lib/pdf-extract.js`, `pdf-server.js`(라우팅, 크기·시그니처·오류 처리, 정적 제공, 상태 API), `package.json` 스크립트, 테스트용 PDF 생성 헬퍼 합의 | 없음 |
| 2. 요약 로직 | ai-integration-specialist | `lib/summarize.js`(프롬프트, `normalizeSummary`, `demoSummary`, 오류 변환), 서버에 `/api/summarize` 연결 | 1 |
| 3. 화면 | frontend-developer | `index_pdf.html`(업로드·검증·진행·결과·복사·오류·재시도, 접근성·반응형) | 1의 API 명세(4~6장)만 있으면 병행 가능, 통합은 2 이후 |
| 4. 테스트·검증 | qa-engineer | `test/pdf-extract.test.js`, `test/pdf-api.test.js`, `test/pdf-summarize.test.js`, 수동 UI 점검 결과 | 1~3 |

단계 간 인수 조건: 앞 단계는 해당 테스트가 통과해야 다음 단계로 넘긴다. 판정이나 오류 문구를 바꾸면 회귀 테스트에 케이스를 추가한다. 구현 중 이 PRD와 충돌하는 결정이 필요하면 PM에게 질문한다.

## 11. 완료 기준 (QA 체크리스트)

테스트 규칙: `node:test`, 파일명 `test/pdf-*.test.js`, 테스트용 PDF는 코드로 생성(바이너리 파일 커밋 금지), 실제 OpenRouter 호출 금지(가짜 `chat` 주입), 임시 폴더는 `after`에서 정리, `npm test`로 기존 테스트와 함께 전부 통과.

생성해야 할 테스트 PDF 종류: (a) 무압축 영문 Tj, (b) FlateDecode 영문 TJ, (c) `'`/`"` 연산자, (d) Identity-H + ToUnicode 한글, (e) ObjStm 안에 페이지 객체, (f) 2쪽 이상, (g) 텍스트 없는 이미지 전용 형태, (h) `/Encrypt` 포함, (i) 잘린 손상 파일, (j) 12,000자 초과 텍스트.

추출(`pdf-extract`)
- [ ] AC-01 (a)~(f)에서 기대 문자열이 모두 포함된 `text`와 정확한 `pages`를 반환한다.
- [ ] AC-02 (d)에서 한글 문장이 깨지지 않고 그대로 나온다.
- [ ] AC-03 (g)는 `NO_TEXT`, (h)는 `ENCRYPTED`, (i)는 `CORRUPT` 오류를 던진다.
- [ ] AC-04 임의 바이트·빈 버퍼를 넣어도 예외가 `PdfError`로 정리되고 프로세스가 멈추지 않는다.

API
- [ ] AC-05 `GET /`, `/index_pdf.html`은 200 text/html, `/.env`, `/server.js`, `/lib/config.js`, `/index.html`은 404 `{error}`.
- [ ] AC-06 `GET /api/status`는 `{demo, model}`만 포함하며 키 문자열이 응답 어디에도 없다.
- [ ] AC-07 정상 PDF(데모)는 200이고 응답이 4장 스키마와 일치(`keyPoints` 길이 3~5, `keywords` ≤5, `demo:true`, `fileName` 디코딩 일치).
- [ ] AC-08 10MB+1바이트는 413, 정확히 10MB 이하 유효 PDF는 413이 아님.
- [ ] AC-09 `%PDF-` 없는 본문은 415, 빈 본문은 400, (g)는 422, (h)는 422, (i)는 422이며 메시지가 6장과 같다.
- [ ] AC-10 12,000자 초과 PDF는 `truncated:true`, `chars`는 원본 길이, 가짜 `chat`이 받은 사용자 메시지의 문서 부분은 12,000자 이하.
- [ ] AC-11 `X-File-Name` 한글·공백 파일명이 올바르게 디코딩되고, 잘못된 인코딩이면 `document.pdf`로 대체된다.
- [ ] AC-12 AI 모드: 가짜 `chat`이 코드블록·앞뒤 설명이 붙은 JSON을 줘도 스키마대로 파싱된다. 필드 누락·초과는 `normalizeSummary`로 보정된다.
- [ ] AC-13 AI 모드에서 `chat`이 `ApiError`(401, 402, 429, 404, 504)를 던지면 502와 `userMessageFor` 문구, 데모 대체 없음.
- [ ] AC-14 데모 모드(`demo:true`)에서는 `chat`이 호출되지 않는다. 같은 입력은 같은 요약.
- [ ] AC-15 모든 오류 응답이 `{error:"한국어"}` 형식이고 스택·파일 경로·키를 포함하지 않는다.

데모 요약
- [ ] AC-16 title은 페이지 번호만 있는 첫 줄을 건너뛰고 첫 의미 있는 줄이다. oneLine은 첫 문장. 키워드는 불용어를 제외한 빈도 상위.
- [ ] AC-17 한 문장뿐인 짧은 문서도 오류 없이 요약된다.

화면(수동 점검 + 가능한 부분은 서버 응답으로 자동화)
- [ ] AC-18 데모 모드에서 배너 "데모 모드: API 키 없음"이 보이고, AI 모드에서는 보이지 않는다.
- [ ] AC-19 PDF가 아닌 파일과 10MB 초과 파일은 서버 요청 없이 클라이언트에서 막힌다.
- [ ] AC-20 드래그&드롭과 클릭, 키보드(Tab, Enter, Space)로 업로드된다. 진행 중 중복 업로드가 되지 않는다.
- [ ] AC-21 결과 카드에 제목·한 줄 요약·핵심 포인트·키워드·"N쪽 · N자"가 표시되고 `truncated` 시 안내가 보인다.
- [ ] AC-22 "요약 복사"로 8장 형식의 텍스트가 복사되고, "다른 파일 요약"으로 초기 상태로 돌아간다.
- [ ] AC-23 서버를 끈 상태에서 업로드하면 오류와 "다시 시도" 버튼이 나오고, 서버를 켠 뒤 재시도하면 성공한다.
- [ ] AC-24 파일명에 `<img src=x onerror=alert(1)>.pdf` 같은 문자열을 써도 스크립트가 실행되지 않고 글자 그대로 보인다.
- [ ] AC-25 320px, 768px, 1280px 폭에서 가로 스크롤이 없고 버튼이 가려지지 않는다.

회귀·품질
- [ ] AC-26 `npm test` 전체 통과(기존 다이어리 테스트 포함), `package.json`에 외부 의존성 없음.
- [ ] AC-27 `git status`에 `.env`, 테스트용 PDF 파일, `data/`가 포함되지 않는다.
- [ ] AC-28 `npm run pdf`와 `npm start`를 동시에 실행해도 각각 3001, 3000 포트로 충돌 없이 동작한다.

## 12. 사용자 확인이 필요한 열린 질문

1. (결정됨) Content-Type은 `application/pdf`, `application/octet-stream`, 비어 있음을 허용하고 그 외는 415.
2. 요약 언어: 원문이 영어여도 항상 한국어로 요약(현재 안)할지.
3. 데모 모드에서 영어 문서의 문장 분리·키워드 품질을 어느 수준까지 보장할지(현재 안: 기본 동작만).

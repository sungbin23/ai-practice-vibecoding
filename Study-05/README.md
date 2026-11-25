<!-- 작성일: 2026-11-25 19:53 -->
# Study-05 — AI 에이전트 개발팀으로 만든 두 앱

역할이 다른 서브에이전트 5개(기획자, 백엔드, 프런트엔드, QA, AI 통합 전문가)로 "AI 개발팀"을 꾸리고, 이 팀에게 웹 앱 두 개를 만들게 한 실습입니다.

1. **AI 공감 다이어리**: 오늘 있었던 일을 한 줄로 쓰면 AI가 감정을 분석하고 공감·위로 메시지를 보여 줍니다.
2. **PDF 요약 AI**: PDF를 끌어다 놓으면 텍스트를 추출해 제목, 한 줄 요약, 핵심 포인트, 키워드로 요약합니다.

> **솔직한 참고 사항: API 키 없이 데모 모드로 구현·확인했습니다.**
> 실습하는 동안 OpenRouter API 키를 넣지 않았기 때문에 실제 DeepSeek 모델은 호출하지 않았습니다. 키가 없으면 자동으로 **데모 모드**로 동작합니다.
> - 다이어리: 일기 문장 속 감정 단어·상황 단서(부정문, "~지만" 대조문 처리 포함)로 감정을 골라 미리 준비한 공감 문구를 보여 줍니다.
> - PDF 요약: PDF 텍스트 추출은 실제로 하고, 요약만 규칙 기반(첫 문장·핵심 문장 뽑기)으로 만듭니다.
>
> 실제 모델 호출 코드와 응답 처리 코드는 있고, 테스트에서는 가짜 모델 응답을 넣어 응답 해석·오류 처리를 검사했습니다. 실제 모드는 키를 넣고 직접 돌려 보지 않았습니다.

## 폴더 구조
```
Study-05/
├── CLAUDE.md                  # 실행·테스트 명령, 데모 모드 규칙, 두 앱 구조 설명
├── PRD_PDF_Summary_App.md     # PDF 요약 앱 PRD(product-manager-prd 작성)
├── package.json               # start / demo / pdf / pdf:demo / test 스크립트(외부 패키지 없음)
├── .env.example               # API 키 설정 견본(실제 키 없음)
├── .gitignore                 # .env, data/, 개인 설정 제외
├── server.js                  # 다이어리 서버(포트 3000), 일기 API
├── index.html                 # 다이어리 화면(CSS/JS 인라인 단일 파일)
├── pdf-server.js              # PDF 요약 서버(포트 3001), 업로드·요약 API
├── index_pdf.html             # PDF 요약 화면(드래그 앤 드롭 업로드, 결과 카드)
├── lib/
│   ├── config.js              # .env 읽기, 키 유무로 데모 모드 결정(두 앱 공통)
│   ├── openrouter.js          # OpenRouter 호출, 오류를 한국어 메시지로 변환(두 앱 공통)
│   ├── analyze.js             # 다이어리: 감정 분석 프롬프트·응답 정규화·데모 분석
│   ├── store.js               # 다이어리: data/diary.json 저장
│   ├── pdf-extract.js         # PDF: 외부 패키지 없이 만든 텍스트 추출기(한글 지원)
│   └── summarize.js           # PDF: 요약 프롬프트·응답 정규화·데모 요약
├── test/
│   ├── api.test.js            # 다이어리 API 테스트
│   ├── regression.test.js     # 다이어리 QA 회귀 테스트(감정 오탐, 부정문 등)
│   ├── pdf-helpers.js         # 테스트용 PDF를 코드로 생성
│   ├── pdf-extract.test.js    # PDF 텍스트 추출 테스트
│   ├── pdf-api.test.js        # PDF 업로드 API 테스트(크기·형식·손상 오류 등)
│   ├── pdf-summarize.test.js  # 요약 정규화·데모 요약 테스트
│   └── pdf-qa.test.js         # PDF QA 회귀 테스트
└── .claude/agents/            # 프로젝트 서브에이전트 5개
```

## 실행 방법
Node.js 20 이상만 있으면 됩니다. 외부 패키지가 없어서 `npm install`이 필요 없습니다. 두 HTML 파일은 서버가 제공하므로 파일을 직접 여는 대신 서버를 켜고 주소로 접속합니다.
```powershell
cd Study-05
npm start       # AI 공감 다이어리 → http://localhost:3000
npm run pdf     # PDF 요약 AI     → http://localhost:3001
npm test        # 전체 테스트(실제 API 호출 없음)
```
키가 없으면 두 앱 모두 화면 위에 데모 모드 안내가 표시됩니다.

### 실제 AI로 실행하려면 (.env)
1. `Copy-Item .env.example .env`
2. `.env`에서 `OPENROUTER_API_KEY=` 뒤에 본인이 발급받은 OpenRouter 키를 붙여 넣습니다(예: `OPENROUTER_API_KEY=your_key`).
3. 서버를 다시 켭니다. 모델은 `MODEL`(기본 `deepseek/deepseek-chat-v3.1:free`)로 바꿀 수 있습니다.

`.env`는 `.gitignore`에 들어 있어 커밋되지 않습니다. 키는 서버에서만 읽고 HTML·JS 파일에는 들어 있지 않습니다.

## 사용한 클로드 코드 기능
- **`/init`**: 프로젝트를 분석해 `CLAUDE.md`를 만들었습니다(PDF 앱을 추가한 뒤 내용도 보강).
- **서브에이전트(`/agents`)**: 프로젝트 범위 에이전트 5개를 Sonnet 모델로 만들었습니다(`.claude/agents/`).
  | 에이전트 | 역할 |
  |---|---|
  | `product-manager-prd` | 제품 목표·기능·요구사항을 정의하는 PRD 작성 |
  | `backend-architect` | 서버·API·데이터 저장·PDF 업로드와 텍스트 추출 |
  | `ai-integration-specialist` | OpenRouter·DeepSeek 연동, 프롬프트, 응답 정규화 |
  | `frontend-developer` | 일기장 UI, 드래그 앤 드롭 업로드 UI, 반응형·접근성 |
  | `qa-engineer` | 여러 상황 테스트, 오류 처리 검증, 문제 보고 |
- **에이전트 팀 협업**: 한 프롬프트로 기획 → 백엔드 → AI 연동 → 프런트엔드 → QA 순서로 일을 나눠 맡기고, QA가 찾은 문제를 해결할 때까지 고쳤습니다. QA에서 나온 문제는 회귀 테스트(`regression.test.js`, `pdf-qa.test.js`)로 남겼습니다.
- **API 키 노출 검사**: 키가 HTML/JS 파일에 직접 들어가지 않았는지 확인했습니다.

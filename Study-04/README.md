<!-- 작성일: 2026-11-25 19:50 -->
# Study-04 — 냉장고를 부탁해

냉장고 사진을 올리면 AI가 재료를 인식하고, 그 재료로 레시피를 추천해 주는 웹 앱입니다. OpenRouter API를 쓰도록 설계했고, 3단계 PRD를 만든 뒤 단계별로 구현했습니다. 완성 후에는 직접 만든 서브에이전트 3개(코드 리뷰어, 성능 최적화, UX 디자이너)로 리뷰·개선했습니다.

> **솔직한 참고 사항: API 키 없이 데모 모드로 구현·확인했습니다.**
> 실습하는 동안 OpenRouter API 키를 넣지 않았기 때문에, 실제 AI 모델은 호출하지 않았습니다. 대신 키가 없으면 자동으로 켜지는 **데모 모드**(미리 준비한 샘플 재료·샘플 레시피를 돌려줌)를 만들어 화면과 흐름을 확인했습니다. 실제 모델 호출 코드(`lib/openrouter.js`)와 응답 처리 코드는 있고, 테스트에서는 가짜 모델 응답을 넣어 응답 해석·오류 처리를 검사했습니다. `.env`에 키를 넣으면 실제 모드로 바뀌지만, 실제 모드는 키를 넣고 직접 돌려 보지 않았습니다.

## 단계별 기능 (PRD)
| 단계 | 문서 | 내용 | 사용 모델(설계) |
|---|---|---|---|
| 1단계 | [PRD_step1.md](PRD_step1.md) | 냉장고 사진 업로드 → 재료 인식(이름·수량·분류) | `google/gemma-3-27b-it:free` |
| 2단계 | [PRD_step2.md](PRD_step2.md) | 재료 수정, 요리 종류·난이도 선택 → 레시피 생성 | `deepseek/deepseek-chat-v3.1:free` |
| 3단계 | [PRD_step3.md](PRD_step3.md) | 회원가입·로그인, 레시피 저장(나의 레시피), 통계 대시보드 | — |

## 폴더 구조
```
Study-04/
├── CLAUDE.md               # 실행·테스트 명령, 데모 모드 규칙, 구조 설명
├── PRD_step1~3.md          # 단계별 요구사항 문서
├── package.json            # npm start / demo / test 스크립트(외부 패키지 없음)
├── .env.example            # API 키 설정 견본(실제 키 없음)
├── .gitignore              # .env, data/(사용자 데이터), backup/ 제외
├── server.js               # Node 내장 http 서버, API 라우트, 정적 파일 제공
├── lib/
│   ├── config.js           # .env 읽기, 키 유무로 데모 모드 결정
│   ├── openrouter.js       # OpenRouter 호출, 오류를 한국어 메시지로 변환
│   ├── recognize.js        # 1단계: 재료 인식 프롬프트·응답 정규화
│   ├── recipes.js          # 2단계: 레시피 생성 프롬프트·응답 정규화
│   ├── store.js            # 3단계: 사용자(scrypt 비밀번호)·세션·저장 레시피
│   └── demo-data.js        # 데모 모드용 샘플 재료·레시피
├── public/
│   ├── index.html          # 화면(요리하기 / 나의 레시피 / 대시보드 탭)
│   ├── style.css           # 스타일
│   └── app.js              # 프론트엔드 로직(업로드, 이미지 축소, 렌더링, 로그인)
├── test/
│   ├── helpers.js          # 테스트용 임시 서버 띄우기
│   └── step1~3.test.js     # 단계별 API 테스트(실제 API 호출 없음)
└── .claude/agents/         # 프로젝트 서브에이전트 3개
```

## 실행 방법
Node.js 20 이상만 있으면 됩니다. 외부 패키지가 없어서 `npm install`이 필요 없습니다.
```powershell
cd Study-04
npm start          # http://localhost:3000
```
- **키가 없으면 자동으로 데모 모드**로 실행되고 화면 위에 "데모 모드: API 키 없음"이 표시됩니다.
- 테스트: `npm test`

### 실제 AI로 실행하려면 (.env)
1. `.env.example`을 복사해 `.env`를 만듭니다: `Copy-Item .env.example .env`
2. `.env`에서 `OPENROUTER_API_KEY=` 뒤에 본인이 openrouter.ai에서 발급받은 키를 붙여 넣습니다(예: `OPENROUTER_API_KEY=your_key`).
3. 서버를 다시 켭니다. 무료 모델이 없어졌으면 `.env`의 `VISION_MODEL`, `TEXT_MODEL`로 바꿀 수 있습니다.

`.env`는 `.gitignore`에 들어 있어 커밋되지 않습니다.

## 사용한 클로드 코드 기능
- **`/init`**: 프로젝트를 분석해 `CLAUDE.md`를 만들었습니다.
- **API 키 안전하게 다루기**: `.env` + `.env.example` + `.gitignore` 구성, 키는 서버에서만 쓰고 브라우저로 보내지 않게 했습니다.
- **PRD 기반 개발**: 3단계 PRD를 먼저 작성하고 "PRD_step1.md를 실행해"처럼 단계별로 구현·테스트했습니다.
- **서브에이전트(`/agents`)**: 프로젝트 범위 에이전트 3개를 만들었습니다(`.claude/agents/`).
  | 에이전트 | 역할 | 도구 |
  |---|---|---|
  | `code-bug-analyzer` | 버그·코딩 규칙·성능 문제 리뷰 | 읽기 전용, Opus 모델 |
  | `performance-optimizer` | 병목을 찾아 직접 수정 | 모든 도구 |
  | `ux-design-advisor` | 화면 디자인·버튼 배치·에러 메시지 개선 | 모든 도구 |
- **서브에이전트 협업**: 코드 리뷰 → 성능 최적화 → UX 개선 순서로 세 에이전트가 이어서 작업했습니다.
- **백업**: 작업 후 현재 상태를 `backup/`에 백업했습니다(`.gitignore`로 저장소에는 올리지 않음).

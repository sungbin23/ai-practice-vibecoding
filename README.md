<!-- 작성일: 2026-11-25 20:00 -->
# 인공지능활용실습 - VibeCoding

- **이름:** 이성빈
- **소속:** 목포대학교 컴퓨터공학과
- **학번:** 223621

클로드 코드(Claude Code)로 바이브 코딩을 실습한 결과물을 모은 저장소입니다. 각 Study 폴더는 독립된 프로젝트이고, 폴더마다 README와 `CLAUDE.md`가 있습니다.

| Study | 주제 | 핵심 실습 내용 | 폴더 |
|---|---|---|---|
| Study-01 | 손글씨 숫자 인식 | `/init`, `#` 메모리, 폴더별 `CLAUDE.md` / Python(Tkinter)·TensorFlow.js 두 버전 | [Study-01](Study-01/) |
| Study-02 | 할 일 관리 앱 | 교재 Step 1~5 요구사항 점검, 키워드 자동 분류, 데스크톱 `web_version`, `@` 참조, `/export` | [Study-02](Study-02/) |
| Study-03 | 상식 퀴즈 게임 | `/memory`로 교차 검증 가이드라인 저장, 커스텀 명령어 15개(`$ARGUMENTS`·`$1 $2`, 체이닝, 통합 명령어, 선생님 모드) | [Study-03](Study-03/) |
| Study-04 | 냉장고를 부탁해 | OpenRouter API 설계, 3단계 PRD 개발, 서브에이전트 3개(리뷰·최적화·UX) 협업 *(API 키 없이 데모 모드)* | [Study-04](Study-04/) |
| Study-05 | AI 공감 다이어리 · PDF 요약 AI | 서브에이전트 5개로 구성한 AI 개발팀(PM·백엔드·프런트·QA·AI 통합) *(API 키 없이 데모 모드)* | [Study-05](Study-05/) |
| Study-06 | MCP 활용 · 쇼핑 리스트 앱 | Sequential Thinking·Playwright MCP 실사용(자동 테스트 30개), Notion·Context7·GitHub MCP는 설정만 | [Study-06](Study-06/) |

## 공통 규칙
- 저장소 전체 규칙은 루트 [`CLAUDE.md`](CLAUDE.md)에 있습니다(main 브랜치 전용 작업, Study별 커밋 분리, 파일 첫 줄 작성 날짜 주석, 퀴즈 문제 교차 검증 가이드라인).
- API 키·토큰은 저장소에 올리지 않습니다. 키가 필요한 Study는 `.env.example`만 있고, 실제 `.env`는 `.gitignore`로 제외했습니다.
- Study-01~03은 기존에 따로 만든 저장소 3개를 커밋 기록을 유지한 채(`git subtree`) 이 저장소로 합친 뒤 클로드 코드로 보완했습니다.

<!-- 작성일: 2026-11-25 18:45 (수정됨 2026-11-25 18:55: notion·context7·github MCP 추가) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Study-06

아직 실습 코드가 없는 자리 표시 폴더입니다(`.gitkeep`만 있음). 프로젝트를 시작하면 이 파일에 실행·테스트 명령과 구조를 채워 넣습니다. 저장소 공통 규칙(main 전용 Git 흐름, Study별 커밋 분리, 새 파일 첫 줄 날짜·시간 주석, 퀴즈 교차 검증 가이드라인)은 루트 `../CLAUDE.md`를 따릅니다.

## MCP 서버
`.mcp.json`에 프로젝트 MCP 서버가 있습니다. 서버별 역할과 계정 연결 방법은 `MCP_SETUP.md`에 있습니다.
- `sequential-thinking`, `playwright`: `npx`로 실행하는 stdio 서버이고 인증이 필요 없습니다(Node.js 필요).
- `notion`(OAuth), `context7`(헤더 `CONTEXT7_API_KEY`), `github`(헤더 `Authorization: Bearer`): http 서버이고 **아직 미인증**입니다.
- 키·토큰은 `.mcp.json`에 `${CONTEXT7_API_KEY}`, `${GITHUB_PAT}` 같은 환경 변수 자리로만 넣습니다. 변수 이름은 `.env.example`에 적고 실제 값은 셸 환경 변수로 설정합니다.

## 참고: 앞선 Study의 관례
Study-04·05는 외부 npm 패키지 없는 Node 내장 모듈 서버, 인라인 CSS·JS 단일 `index.html`, `node --test "test/*.test.js"` 테스트, `.env`의 `OPENROUTER_API_KEY`와 키가 없을 때의 데모 모드로 만들었습니다. 새 프로젝트도 이 방식을 따를지는 과제 요구사항에 맞춰 정하고, 정한 뒤에는 이 파일에 적습니다.

실습 결과물은 이 폴더 변경만 담아 `Study-06: ...` 형식으로 커밋하고 `main`에 push합니다.

<!-- 작성일: 2026-11-25 18:55 -->
# MCP 서버 설정 안내 (Study-06)

`.mcp.json`에 등록된 MCP 서버와 계정 연결 방법을 정리한 문서입니다. 키와 토큰은 `.mcp.json`에 직접 쓰지 않고 `${CONTEXT7_API_KEY}`, `${GITHUB_PAT}` 같은 환경 변수 자리로만 넣습니다. Claude Code가 실행될 때 이 자리를 환경 변수 값으로 바꿉니다.

## 현재 상태 (2026-11-25 기준)

| 서버 | 방식 | 인증 | 상태 |
|---|---|---|---|
| sequential-thinking | stdio (`npx`) | 필요 없음 | 사용 가능 |
| playwright | stdio (`npx`) | 필요 없음 | 사용 가능 |
| notion | http | OAuth | **미인증** (계정 연결 안 함) |
| context7 | http | API 키 헤더 `CONTEXT7_API_KEY` | **미인증** (키 미설정) |
| github | http | `Authorization: Bearer` 헤더 | **미인증** (토큰 미설정) |

## 각 MCP가 하는 일

- **sequential-thinking**: 복잡한 문제를 여러 단계의 생각으로 나눠 차례로 추론하게 돕는 도구입니다.
- **playwright**: 브라우저를 띄워 페이지 이동, 클릭, 입력, 스크린샷 같은 동작을 자동으로 합니다. 만든 웹 앱을 실제 화면에서 확인할 때 씁니다.
- **notion** (`https://mcp.notion.com/mcp`): Notion 공식 MCP입니다. 연결한 워크스페이스의 페이지·데이터베이스를 검색하고 읽고, 페이지를 만들거나 고칩니다.
- **context7** (`https://mcp.context7.com/mcp`): 라이브러리·프레임워크의 최신 공식 문서와 코드 예시를 찾아 줍니다. 모델이 알고 있는 내용이 오래되었을 수 있을 때 최신 API를 확인하는 데 씁니다.
- **github** (`https://api.githubcopilot.com/mcp`): GitHub 공식 원격 MCP입니다. 저장소, 이슈, 풀 리퀘스트, 코드 검색, Actions 실행 결과 등을 조회하고 다룹니다. 토큰 권한 범위 안에서만 동작합니다.

## 계정 연결 방법

### 1. 환경 변수 설정 (context7, github)

Claude Code는 `.env` 파일을 자동으로 읽지 않습니다. `.env.example`에 적힌 변수를 **Claude Code를 실행하는 셸의 환경 변수**로 설정한 뒤 Claude Code를 다시 시작하세요.

PowerShell (현재 창에서만):
```powershell
$env:CONTEXT7_API_KEY = "발급받은_키"
$env:GITHUB_PAT = "발급받은_토큰"
claude
```

계속 쓰려면 Windows 사용자 환경 변수로 등록합니다(등록 후 새 터미널을 열어야 적용).
```powershell
setx CONTEXT7_API_KEY "발급받은_키"
setx GITHUB_PAT "발급받은_토큰"
```

> 주의: `.mcp.json`이 참조하는 환경 변수가 설정되지 않으면 Claude Code가 설정을 읽지 못하거나 해당 서버 연결이 실패할 수 있습니다. 쓰지 않는 서버라면 `/mcp`에서 끄거나 변수를 먼저 설정하세요.

### 2. Context7 API 키 발급
1. https://context7.com 에 로그인합니다.
2. 대시보드에서 API 키를 만듭니다.
3. 위 방법으로 `CONTEXT7_API_KEY`에 넣습니다.

### 3. GitHub Personal Access Token 발급
1. https://github.com/settings/personal-access-tokens 에서 **Fine-grained token**을 만듭니다.
2. 쓸 저장소만 고르고, 필요한 권한만 줍니다(예: Contents·Issues·Pull requests 읽기, 필요할 때만 쓰기).
3. 위 방법으로 `GITHUB_PAT`에 넣습니다. 헤더는 `Authorization: Bearer ${GITHUB_PAT}` 형태로 전달됩니다.

### 4. Notion 연결 (OAuth)
Notion은 키를 쓰지 않습니다.
1. Claude Code에서 `/mcp`를 입력합니다.
2. `notion`을 고르고 **Authenticate**를 선택합니다.
3. 브라우저에서 Notion에 로그인하고 접근할 워크스페이스·페이지를 허용합니다.
4. 인증 토큰은 Claude Code가 따로 보관하므로 저장소에 남지 않습니다.

### 5. 서버 승인과 상태 확인
- 프로젝트 `.mcp.json`의 서버는 처음 쓸 때 승인이 필요합니다. 현재 `.claude/settings.local.json`의 `enabledMcpjsonServers`에는 `sequential-thinking`, `playwright`만 들어 있으므로, 새 서버는 Claude Code를 다시 시작할 때 나오는 승인 창에서 허용하거나 `/mcp`에서 켭니다.
- `/mcp`에서 각 서버가 `connected`인지, 인증이 필요한지 확인할 수 있습니다.

## 보안 주의
- 실제 키·토큰은 `.mcp.json`, `.env.example`, 이 문서에 쓰지 않습니다.
- `.env`에 값을 적어 두더라도 루트 `.gitignore`가 `.env`, `*.env`를 무시하므로 커밋되지 않습니다. `.env.example`에는 변수 이름만 둡니다.
- 토큰이 노출되면 GitHub·Context7 설정 화면에서 바로 폐기하고 다시 발급합니다.

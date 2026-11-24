<!-- 작성일: 2026-11-25 02:52 -->
# 선생님 모드 내보내기 — 보고서를 CSV·PDF로 저장

선생님 대시보드 HTML을 읽어 **CSV**(엑셀·스프레드시트용) 또는 **PDF**(인쇄·보관용)로 저장합니다. **대시보드와 학생 원본 데이터는 수정하지 않습니다.**

입력값: `$ARGUMENTS`
- 형식입니다: `csv`, `pdf`, `all`(기본값, 둘 다)
- 두 번째 값을 주면 그 HTML 파일을 읽습니다.
- 사용 예: `/export-report`, `/export-report csv`, `/export-report pdf teacher/output/dashboard.html`
- 형식 값이 셋 중 하나가 아니면 사용법을 보여 주고 끝냅니다.

## 공통 규칙
- 각 단계는 **작업 → 검증** 순서로 진행합니다. 검증에 실패하면 즉시 중단하고 아래 형식으로 보고합니다. `all`일 때 CSV가 실패하면 PDF는 진행하고, 실패한 형식만 보고합니다.
  ```
  ❌ export-report 실패 (단계: …)
  - 원인 / 오류 메시지:
  - 만들어진 파일 / 만들어지지 않은 파일:
  - 권장 조치:
  ```
- 산출물은 학생 성적이므로 `teacher/` 안에만 저장합니다. 외부 서비스(Artifact 게시, 클라우드 변환기 등)에 올리지 않습니다.
- 커밋과 push는 하지 않습니다.

## 1. 원본 HTML 찾기
- 다음 순서로 원본 HTML 파일을 찾습니다.
  1. 인자로 준 경로
  2. `teacher/output/dashboard.html`(teacher-report 산출물)
  3. `teacher/output/teacher_report.html`
  4. 작업 폴더의 `teacher_report.html`
- 처음 찾은 파일을 씁니다. 하나도 없으면 중단하고 `/teacher-report` 또는 `/teacher-dashboard`를 먼저 실행하라고 안내합니다.
- `git check-ignore -q`로 출력 폴더 `teacher/`가 git에서 제외되는지 확인합니다. 제외되지 않으면 중단합니다.
- 출력 폴더는 `teacher/output/export/<YYYYMMDD-HHMM>/`입니다. 시각은 `date "+%Y%m%d-%H%M"`로 정하고, 이미 있으면 뒤에 `-2`를 붙입니다. 기존 내보내기를 덮어쓰지 않습니다.

## 2. 렌더링 (헤드리스 브라우저)
대시보드의 표는 페이지 안 JS가 그리므로, 파일을 그대로 읽지 않고 **브라우저로 렌더링한 결과**를 씁니다.
- 브라우저는 Chrome(`C:/Program Files/Google/Chrome/Application/chrome.exe`)이나 Edge(`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`) 중 있는 것을 씁니다. 둘 다 없으면 중단합니다.
- 렌더링된 DOM을 저장합니다.
  ```
  "<브라우저>" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=3000 --dump-dom "file:///<HTML 절대경로>" > <scratchpad>/rendered.html
  ```
- 검증: `rendered.html`이 비어 있지 않고 `<table`이 1개 이상 있어야 합니다.

## 3. CSV 내보내기 (`csv` 또는 `all`)
- **찾을 표:** `rendered.html`에서 `data-export` 속성이 붙은 표를 찾습니다(teacher-report 규칙).
  - `data-export` 속성이 없는 오래된 대시보드라면 `<caption>`이나 바로 앞 제목으로 표를 구분합니다.
  - 그래도 구분할 수 없으면 CSV 단계를 중단합니다.
- **표와 파일 이름:**

  | `data-export` 값 | 파일 이름 | 내용 |
  |---|---|---|
  | `students` | `students.csv` | 학생 비교 표(순위, 등급, 학생, 플레이, 푼 문제, 정답률, 평균 점수, 최고 점수, 평균 응답, 최장 연속, 최근 플레이, 추세) |
  | `category` | `category.csv` | 학생 × 카테고리 정답률 |
  | `alerts` | `alerts.csv` | 알림 목록(학생, 수준, 규칙 코드, 근거) |
- **변환 방법:** 파싱은 `node` 스크립트로 합니다. 스크립트는 scratchpad에 두고 저장소에 남기지 않습니다. 정규식 대신 jsdom 같은 HTML 파서를 쓰고, 설치는 scratchpad 안에서 합니다.
  - 머리 행은 `<th>` 텍스트를 그대로 씁니다. 셀 값은 화면에 보이는 텍스트(`textContent`)에서 앞뒤 공백을 지운 값입니다.
  - 숫자와 단위가 붙은 셀은 분석하기 좋게 열을 나눕니다. 예: "64% (36/56)" → `정답률(%)`=64, `맞힌 수`=36, `푼 수`=56
  - 기호(⚠️, ⭐, `*`, ▲, ▼)는 `표시` 열로 따로 뺍니다.
- **CSV 규칙:**
  - 인코딩은 **UTF-8 BOM**입니다. 엑셀에서 한글이 깨지지 않게 하기 위해서입니다. 줄바꿈은 CRLF, 구분자는 쉼표입니다.
  - 쉼표·큰따옴표·줄바꿈이 있는 값은 큰따옴표로 감싸고, 값 안의 `"`는 `""`로 바꿉니다.
  - **수식 주입 방지:** 학생 이름처럼 글자로 된 칸의 값이 `=`, `+`, `-`, `@`, 탭, CR로 시작하면 앞에 `'`를 붙입니다. 숫자 칸(음수 추세값 등)에는 붙이지 않습니다.
- **검증:**
  - 만든 CSV를 다시 읽었을 때 데이터 행 수가 원래 표의 `<tbody>` 행 수와 같아야 합니다.
  - 모든 행의 열 수가 머리 행과 같아야 합니다.
  - `students.csv`의 학생 수가 `teacher/output/merged.json`의 학생 수와 같아야 합니다.

## 4. PDF 내보내기 (`pdf` 또는 `all`)
- 대시보드의 인쇄 스타일(`@media print`)을 그대로 써서 저장합니다.
  ```
  "<브라우저>" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=3000 --no-pdf-header-footer --print-to-pdf="<출력 폴더>/teacher_report.pdf" "file:///<HTML 절대경로>"
  ```
- **검증:**
  - 파일 크기가 0보다 커야 합니다.
  - 첫 5바이트가 `%PDF-`여야 합니다.
  - `/Type /Page` 개수로 페이지 수를 세서 보고합니다.
- 가능하면 첫 페이지를 확인합니다. PDF를 Read 도구로 열거나 같은 HTML의 인쇄 미리보기 스크린샷을 찍어 표가 잘리거나 다크 배경으로 인쇄되지 않았는지 봅니다.
  - 다크 배경으로 인쇄되면 대시보드 인쇄 스타일을 고쳐야 한다고 보고합니다. 이 명령에서는 HTML을 수정하지 않습니다.

## 5. 보고
- 원본 HTML 경로와 출력 폴더
- 만든 파일 목록: 파일마다 크기, CSV는 행·열 수, PDF는 페이지 수
- 검증 결과(항목별 ✅/❌)
- 여는 방법: CSV는 엑셀이나 구글 스프레드시트, PDF는 브라우저나 PDF 뷰어
- 주의: 학생 성적이 들어 있는 파일이므로 공유할 때 주의해야 합니다. `teacher/` 폴더는 git에서 제외되어 있습니다.

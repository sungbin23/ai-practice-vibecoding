<!-- 작성일: 2026-11-25 02:48 -->
# 선생님 모드 1/5 — 학생 기록 수집·검증·병합

`teacher/data/` 폴더에 모은 학생별 기록 파일을 읽어 검증하고, 분석 명령어들이 공통으로 쓰는 `teacher/output/merged.json` 하나로 합칩니다. **학생 원본 파일은 수정하지 않습니다.**

입력값: `$ARGUMENTS`
- 첫 번째 값은 **기간**입니다: `all`(기본값), `7d`, `30d`, 또는 `YYYY-MM-DD~YYYY-MM-DD`
- 두 번째 값은 **데이터 폴더**입니다. 기본값은 `teacher/data`입니다.
- 사용 예: `/teacher-import`, `/teacher-import 7d`, `/teacher-import 2026-11-01~2026-11-30 teacher/data/3반`

## 학생이 기록을 내보내는 방법 (안내용)
게임 기록은 각 학생 브라우저의 localStorage에만 있으므로, 학생이 직접 내보내야 합니다.
1. 퀴즈 페이지(`index.html`)를 연 브라우저에서 F12를 눌러 개발자 도구 → Console 탭을 엽니다.
2. 아래 한 줄을 붙여 넣고 Enter를 누르면 클립보드에 복사됩니다.
   ```js
   copy(JSON.stringify({ exportedAt: new Date().toISOString(), profiles: JSON.parse(localStorage.knowledge_king_profiles || '[]'), records: JSON.parse(localStorage.knowledge_king_records || '[]') }, null, 2))
   ```
3. 메모장에 붙여 넣고 `학생이름.json`으로 저장해 선생님께 제출합니다(예: `김민지.json`).

데이터 폴더가 없거나 비어 있으면 위 안내를 보여 주고 끝냅니다. 연습용 가짜 데이터가 필요하면 `/teacher-sample`을 안내합니다.

## 0. 개인정보 보호 확인
- `git check-ignore -q teacher/` 로 `teacher/`가 git에서 제외되는지 확인합니다.
- 제외되지 않으면 **중단**합니다. 학생 성적이 커밋될 수 있다고 알리고 `Study-03/.gitignore`에 `teacher/`를 추가하라고 안내합니다.

## 1. 파일 읽기와 검증
데이터 폴더의 `*.json` 파일을 하나씩 검사합니다(하위 폴더 제외). 많으면 `node -e` 스크립트로 처리합니다.
- **허용 형식 (둘 중 하나):**
  - 위 내보내기 형식 `{ exportedAt, profiles, records }`
  - 기록 배열만 담긴 `[ ...records ]`
- **기록 1개 필수 필드:** `id`, `profileId`, `mode`, `score`, `correct`, `answered`, `accuracy`, `avgResponseMs`, `maxCombo`, `categoryStats`, `playedAt`
  - `mode`는 `normal`/`category`/`speed`/`survival`/`timeattack` 중 하나입니다.
  - `playedAt`은 날짜로 읽을 수 있어야 합니다.
  - 숫자 필드는 0 이상이어야 하고, `correct ≤ answered`여야 합니다.
- **처리 규칙:**
  - JSON 문법 오류나 형식이 다른 파일은 **건너뛰고** `skipped`에 이유를 기록합니다. 다른 파일은 계속 처리합니다.
  - 필드가 잘못된 기록은 그 기록만 건너뛰고 개수를 셉니다.
  - 기록 `id`가 같은 중복 기록은 1개만 남깁니다. 같은 파일을 두 번 제출한 경우도 여기서 걸러집니다.

## 2. 학생 식별
- **기본 규칙:** 학생 이름은 **파일 이름**(확장자 제외)입니다. 기기마다 프로필 id가 다르고, 프로필 이름은 학생끼리 겹칠 수 있기 때문입니다.
- **한 파일에 기록이 있는 프로필이 2개 이상일 때:** 여러 사람이 한 기기를 나눠 쓴 경우입니다.
  - 학생을 `파일이름/프로필이름`으로 나눕니다.
  - 보고할 때 "공용 기기로 보임"이라고 표시합니다.
- **학생 id:** `studentId`는 학생 이름을 그대로 씁니다. 이름이 겹치면 뒤에 `(2)`를 붙입니다.

## 3. 기간 필터
- 기간을 정한 경우:
  - `7d`/`30d`는 오늘 날짜 기준 최근 N일입니다.
  - 날짜 범위는 시작일 0시부터 종료일 23:59까지이며, 로컬 시간 기준입니다.
- 기간 안 기록이 0개인 학생도 목록에는 남깁니다. `records`를 빈 배열로 두고 "기간 내 미참여"로 표시합니다.

## 4. 저장
`teacher/output/merged.json`에 저장합니다. 폴더가 없으면 만듭니다.
```json
{
  "generatedAt": "ISO 시각",
  "period": { "label": "all | 7d | ...", "from": "ISO 또는 null", "to": "ISO 또는 null" },
  "sourceDir": "teacher/data",
  "students": [ { "studentId": "김민지", "sourceFile": "김민지.json", "sharedDevice": false, "records": [ /* playedAt 오름차순 */ ] } ],
  "skipped": [ { "file": "x.json", "reason": "JSON 문법 오류" } ],
  "stats": { "files": 0, "students": 0, "records": 0, "invalidRecords": 0, "duplicates": 0 }
}
```

## 5. 검증과 보고
- 저장 후 파일을 다시 읽어 `students`의 기록 수 합계가 `stats.records`와 같은지 확인합니다. 다르면 오류로 보고합니다.
- 다음 내용을 보고합니다.
  - 처리한 파일 수와 학생 수
  - 학생별 기록 수(기간 안 / 전체)
  - 건너뛴 파일과 이유
  - 잘못된 기록 수, 중복 제거 수
  - 출력 파일 경로
- 학생 이름 외의 개인정보(이메일 등)는 출력하지 않습니다.

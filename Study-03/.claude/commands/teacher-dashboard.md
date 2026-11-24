<!-- 작성일: 2026-11-25 02:52 (수정됨) -->
# 선생님 모드 통합 — teacher-dashboard

학생 기록 수집부터 요약, 카테고리 비교, 알림, HTML 대시보드, CSV·PDF 내보내기까지 선생님 모드 전체를 한 번에 실행합니다.

입력값: `$ARGUMENTS`
- 첫 번째 값은 **기간**입니다: `all`(기본값), `7d`, `30d`, `YYYY-MM-DD~YYYY-MM-DD`
- 두 번째 값은 **데이터 폴더**입니다. 기본값은 `teacher/data`입니다.
- 나머지 값은 **대시보드 제목**입니다. 비어 있으면 기본 제목을 씁니다.
- 내보내기 형식은 `--export=csv|pdf|all|none`으로 정합니다. 기본값은 `all`이고, 위치와 상관없이 쓸 수 있습니다. 이 옵션은 제목에 포함하지 않습니다.
- 사용 예:
  - `/teacher-dashboard`
  - `/teacher-dashboard 7d`
  - `/teacher-dashboard all teacher/data/sample`
  - `/teacher-dashboard 30d teacher/data/3반 3학년 2반 상식 퀴즈`
  - `/teacher-dashboard 7d --export=csv`

## 실행 방법
아래 하위 명령어를 **순서대로** 실행합니다.
- **실행 방식:** 각 단계마다 `.claude/commands/<이름>.md` 파일을 읽고, 그 절차를 아래 표의 인자로 그대로 수행합니다.
- **입력 데이터:** 2~6단계는 1단계가 방금 만든 `teacher/output/merged.json`을 씁니다. 하위 명령어에 있는 "0. 입력 데이터 준비"의 import 재실행은 건너뜁니다.
- **같은 기준 유지:** 하위 명령어의 계산식과 기준값을 그대로 씁니다. 통합 실행이라고 해서 기준을 바꾸지 않습니다.

| 단계 | 하위 명령어 | 인자 | 산출물 |
|---|---|---|---|
| 1 | `teacher-import` | `<기간> <데이터 폴더>` | `teacher/output/merged.json` |
| 2 | `teacher-summary` | `accuracy` | `teacher/output/summary.md` |
| 3 | `teacher-category` | (없음) | `teacher/output/category.md` |
| 4 | `teacher-alert` | `60` | `teacher/output/alerts.md` |
| 5 | `teacher-report` | `<대시보드 제목>` | `teacher/output/dashboard.html` |
| 6 | `export-report` | `<내보내기 형식> teacher/output/dashboard.html` | `teacher/output/export/<시각>/` (CSV 3개, `teacher_report.pdf`) |

## 단계별 검증과 중단
- 각 단계가 끝나면 산출물 파일이 생겼는지, 비어 있지 않은지, 이번 실행에서 새로 쓴 파일인지(수정 시각) 확인합니다.
- **1단계가 실패하면 즉시 중단합니다.**
  - 데이터 폴더 없음, 유효한 학생 0명, git 제외 미설정이 여기에 해당합니다.
  - 데이터가 없으면 학생 내보내기 방법(teacher-import 안내)과 `/teacher-sample`을 알려 줍니다.
- **2~4단계 중 하나가 실패하면** 나머지 분석은 계속 진행하고, 실패한 단계를 보고합니다. 서로 독립된 분석이기 때문입니다.
- **5단계는 2~4단계가 모두 성공했을 때만 실행합니다.** 대시보드 숫자가 표 보고서와 맞아야 하기 때문입니다.
- **6단계는 5단계가 이번 실행에서 성공했을 때만 실행합니다.** 이전 실행의 오래된 대시보드를 내보내지 않기 위해서입니다.
  - `--export=none`이면 건너뜁니다.
  - 6단계가 실패해도 1~5단계 산출물은 그대로 두고, 실패만 보고합니다.
- 오류 보고 형식:
  ```
  ❌ N단계(teacher-xxx) 실패
  - 원인:
  - 완료된 단계 / 건너뛴 단계:
  - 권장 조치:
  ```

## 최종 보고
1. **실행 결과 표:** 단계, 명령어, 결과(✅/❌/건너뜀), 산출물 경로, 소요 시간
2. **핵심 요약 (5줄 이내):**
   - 기간, 학생 수, 반 정답률
   - 가장 약한 카테고리
   - 🔴 알림 학생 수와 이름
   - 정답률 상위 3명
   - 상대평가 등급 분포(A/B/C/D/평가 보류 인원)
3. **대시보드 여는 방법:** `teacher/output/dashboard.html`을 브라우저로 엽니다. 내보낸 CSV·PDF의 경로와 PDF 페이지 수도 함께 적습니다.
4. **개인정보 안내:** 산출물에는 학생 성적이 들어 있습니다. `teacher/` 폴더는 git에서 제외되어 있고, 외부에 게시하지 않았다는 점을 밝힙니다.

커밋과 push는 하지 않습니다.

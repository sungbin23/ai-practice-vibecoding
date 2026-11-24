<!-- 작성일: 2026-11-25 03:01 -->
# 퀴즈 게임 통계 관리

게임의 통계 기능(게임 기록 저장, 프로필별 통계, 📊 통계 대시보드)을 **분석·검증·확장**합니다. 통계 로직은 `quiz-records.js`(`saveGameRecord`, `getProfileStats`), 기록 생성은 `quiz-game.js`(`buildGameRecord`), 화면은 `quiz-ui.js`(`renderStats`, `buildScoreChart`)에 있습니다.

입력값: `$ARGUMENTS`. 첫 단어가 하위 명령입니다.

| 하위 명령 | 하는 일 | 파일 수정 |
|---|---|---|
| `show` (기본값) | 통계 기능의 구조와 지표 정의 설명 | 없음 |
| `analyze <JSON 경로>` | 학생이 내보낸 기록 파일 하나의 통계 계산 | 없음 |
| `verify` | 통계 계산이 맞는지 자동 테스트 | 없음 |
| `add-metric <설명>` | 통계 대시보드에 새 지표 추가 | 있음 |
| `reset-guide` | 브라우저의 통계 기록을 지우거나 백업하는 방법 안내 | 없음 |

- 사용 예: `/quiz-stats`, `/quiz-stats analyze teacher/data/김민지.json`, `/quiz-stats verify`, `/quiz-stats add-metric 요일별 플레이 횟수`
- 알 수 없는 하위 명령이면 위 표를 보여 주고 끝냅니다.
- **데이터 접근 한계:** 게임 기록은 각 브라우저의 localStorage에만 있습니다. Claude는 직접 읽을 수 없으므로, 실제 기록은 내보낸 JSON 파일로만 분석합니다. 내보내는 방법은 `teacher-import.md`에 있습니다.

## show
- `quiz-records.js`와 `quiz-ui.js`를 읽고 다음을 표로 설명합니다. 코드에서 확인한 내용만 씁니다.
  - localStorage 키와 저장 한도(`MAX_RECORDS`)
  - 기록 1개의 필드
  - 대시보드 지표와 그 계산식(플레이 횟수, 평균 점수, 개인 최고, 전체 정답률, 모드별 횟수, 카테고리별 정답률, 최근 30게임 추이)
- 기록이 저장되지 않는 경우(푼 문제 0개)도 함께 적습니다.

## analyze `<JSON 경로>`
- 파일 형식은 `{ exportedAt, profiles, records }` 또는 기록 배열입니다. 형식이 다르면 중단하고 이유를 보고합니다.
- **계산 방법:** `quiz-records.js`를 `node`의 `vm`에서 실행합니다. 가짜 `localStorage` 객체에 파일 내용을 넣고 `getProfileStats`를 그대로 호출합니다. 화면의 통계와 같은 결과가 나오게 하기 위해서입니다.
- 프로필마다 대시보드와 같은 지표를 표로 보여 줍니다. 그 밖에 다음을 추가로 보여 줍니다.
  - 기록 기간(첫·마지막 플레이)
  - 모드별 평균 점수
  - 평균 응답 시간
- 파일은 학생 개인정보입니다. 결과를 저장소에 저장하지 않고 화면으로만 보고합니다.

## verify
`node`의 `vm`과 가짜 `localStorage`로 `quiz-records.js`를 실행해 아래를 검사합니다. 스크립트는 scratchpad에 둡니다.
1. **기본 계산:** 직접 만든 기록 5개로 `getProfileStats`를 호출합니다. `playCount`, `bestScore`, `averageScore`, `accuracy`, `modeCounts`, `categoryTotals`가 손으로 계산한 기댓값과 같은지 확인합니다.
2. **정답률 계산식:** 정답률이 게임별 정답률의 평균이 아니라 `correct` 합 ÷ `answered` 합인지 확인합니다.
3. **최근 30게임:** 기록이 35개일 때 `timeline`이 가장 최근 30개이고 시간 순서인지 확인합니다.
4. **저장 한도:** 기록을 `MAX_RECORDS + 5`개 저장하면 가장 오래된 5개가 지워지는지 확인합니다.
5. **프로필 구분:** 다른 프로필의 기록이 섞이지 않는지 확인합니다.
6. **빈 데이터:** 기록이 0개일 때 0을 돌려주고 오류가 나지 않는지 확인합니다.
7. **화면 렌더링:** jsdom으로 `index.html`과 스크립트 4개를 불러 📊 통계를 엽니다. 타일 4개, 카테고리 행 4개, 그래프 점 개수가 데이터와 맞는지 확인합니다.

- jsdom은 scratchpad에 설치합니다.
- 항목별 ✅/❌, 실패 시 기댓값과 실제값을 보고합니다. ❌가 있어도 코드는 고치지 않고 원인 후보만 제시합니다.

## add-metric `<설명>`
1. **설계:** 새 지표를 어디서 계산하고 어디에 보여 줄지 정합니다. 다음 규칙을 지킵니다.
   - 계산은 `getProfileStats`에 넣습니다.
   - 화면은 `renderStats`에 넣습니다.
   - 기존 기록 필드로 계산할 수 없으면 `buildGameRecord`에 필드를 추가합니다. 이때 그 필드가 없는 예전 기록도 오류 없이 처리해야 합니다.
2. **차트:** 차트가 필요하면 `dataviz` 스킬을 먼저 불러 그 절차를 따릅니다. 색은 `styles.css`의 CSS 변수만 쓰고, 라이트·다크 두 테마에 모두 정의합니다.
3. **파일 규칙:** 수정한 파일의 첫 줄 날짜 주석을 `(수정됨)`과 현재 시각으로 바꿉니다.
4. **검증:** `node --check`, 위 `verify`, 헤드리스 Chrome 스크린샷(라이트·다크)으로 확인합니다.
5. **문서:** README와 Study-03 `CLAUDE.md`의 통계 설명을 고칩니다.
6. 커밋하지 않고 변경 내용을 보고합니다.

## reset-guide
학생이나 선생님에게 전달할 수 있도록 다음 방법을 단계별로 안내합니다. Claude가 직접 지우지는 않습니다.
- **백업:** 브라우저 개발자 도구 콘솔에서 기록을 내보냅니다(`teacher-import.md`의 한 줄 명령).
- **기록만 지우기:** `localStorage.removeItem('knowledge_king_records')`
- **프로필까지 초기화:** `knowledge_king_profiles`·`knowledge_king_current_profile`도 지웁니다. 역대 최고 점수 `knowledge_king_highscore`는 따로 지워야 합니다.
- **주의:** 지운 기록은 되돌릴 수 없습니다. 반드시 백업 후 진행하라고 안내합니다.

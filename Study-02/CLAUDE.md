<!-- 작성일: 2026-11-25 02:00 (수정됨) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 개인용 할 일 관리 앱 (Personal To-Do App)
백엔드 없이 브라우저 LocalStorage에 데이터를 저장하는 Vanilla JS(HTML/CSS/JS) To-Do 앱입니다. 상위 저장소(`VibeCoding`)의 `Study-02` 하위 폴더이며, 빌드·린트·테스트 설정이나 패키지 의존성은 없습니다.

## 실행
- `index.html`을 브라우저(크롬, 엣지 등)로 직접 열면 실행됩니다. 수정 후에는 새로고침으로 확인합니다.
- 저장 데이터를 초기화하려면 개발자 도구 콘솔에서 `localStorage.clear()`를 실행합니다.

## 구조
- `index.html`: 모든 UI 요소가 정적으로 선언되어 있고, `script.js`가 `id`로 참조합니다.
- `script.js`: 전체 로직이 하나의 파일에 있으며 모듈/프레임워크 없이 전역 변수와 함수로 구성됩니다.
- `style.css`: 라이트 스타일 + 하단의 `body.dark-mode` 오버라이드로 다크 모드를 구현합니다.
- `web_version/`: 같은 앱의 데스크톱 전체 화면 버전(상단 바 + 왼쪽 사이드바 + 메인 목록 그리드, 1600px 이상에서 목록 2열, 1023px 이하에서는 한 줄로 쌓임). 요소 `id`·클래스를 루트 버전과 똑같이 맞춰 두었기 때문에 `web_version/script.js`는 루트 `script.js`와 로직이 같은 복사본입니다. **기능을 바꾸면 두 `script.js`를 함께 고치고**, 레이아웃만 다른 `index.html`/`style.css`는 각각 수정합니다. 다크 모드는 `body.dark-mode`에서 CSS 변수를 바꾸는 방식입니다.
- `README_old.md`는 `README.md`와 거의 동일한 이전 버전입니다.

## 핵심 동작 방식 (`script.js`)
- **단일 상태 + 전체 재렌더링:** 전역 `tasks` 배열이 유일한 진실 공급원입니다. 모든 변경은 `tasks` 수정 → `saveTasks()` → `renderTasks()` 순서를 따르며, `renderTasks()`는 목록을 DocumentFragment로 다시 그린 뒤 `updateDashboard()`까지 호출합니다.
- **저장은 디바운싱됨:** `saveTasks()`는 300ms 뒤에 저장하고, `persistTasks()`는 즉시 저장합니다(페이지 이탈·가져오기 시 사용). 검색 입력도 디바운싱됩니다.
- **항목 식별은 `id`로:** 화면 목록은 필터·검색·정렬이 적용된 복사본이므로 핸들러는 배열 인덱스가 아닌 `task.id`(`findTask(id)`, `li[data-id]`)로 항목을 찾습니다. 렌더링 후 포커스 복원은 `focusTaskControl(id, selector)`를 씁니다.
- **할 일 객체 형태:** `{ id, text, completed, category, createdAt(ISO 문자열) }`. 저장소/가져오기 데이터는 `normalizeTasks()`를 거쳐 id 부여·잘못된 항목 제거가 됩니다.
- **LocalStorage 키:** `tasks`, `isDarkMode`, `currentSort`, `currentFilter`.
- **정렬:** `getSortedTasks()`는 완료 항목을 항상 아래로 보낸 뒤 `currentSort`를 적용합니다. `manual`(직접 정렬)은 배열 순서를 그대로 쓰며, 드래그 앤 드롭(`moveTask`) 시 현재 보이는 순서를 배열에 반영하고 자동으로 `manual`로 전환합니다.
- **삭제 실행 취소:** 삭제·완료 항목 일괄 삭제 시 `{ task, index }` 목록을 `undoState`에 보관하고 5초간 토스트(또는 Ctrl+Z)로 복원할 수 있습니다.
- **키워드 자동 분류:** `classifyTask(text)`가 `CATEGORY_KEYWORDS`와 비교해 일치한 키워드 길이 합이 가장 큰 카테고리를 고릅니다(동점·불일치는 null). 새 할 일 입력 시 `applyAutoCategory()`가 드롭다운을 바꾸고, 사용자가 드롭다운을 직접 바꾸면 `categoryManuallySet`으로 입력을 비우거나 추가할 때까지 자동 분류를 멈춥니다. 인라인 편집에도 같은 규칙이 적용됩니다. 키워드는 다른 단어에 섞이기 쉬운 짧은 단어(예: `약`→`계약`)를 피합니다.
- **내보내기/가져오기:** 내보내기 JSON은 `{ tasks, settings, metadata }` 구조이며, 가져오기는 `data.tasks`만 읽어 현재 데이터를 덮어씁니다.

## 카테고리 추가/변경 시 함께 수정할 곳
카테고리(`work`/`personal`/`study`)는 여러 곳에 하드코딩되어 있습니다.
- `script.js`: `CATEGORIES`, `categoryNames`, `CATEGORY_KEYWORDS`, `Alt+1~4` 단축키 매핑(`filterKeys`)
- `index.html`: `#categorySelect` 옵션, `.filter-btn[data-filter]`, 대시보드의 `{cat}Text` / `{cat}Progress` 요소
- `style.css`: `.tag-{cat}`, `.{cat}-fill`, `.{cat}-stat`, `.auto-category-hint.tag-text-{cat}` 색상 클래스

## 작업 규칙
- 새로 만드는 파일 첫 줄에 작성 날짜·시간 주석을 넣습니다(예: `<!-- 작성일: 2026-11-25 01:51 -->`, JS/CSS는 `/* 작성일: ... */`). 기존 파일을 수정하면 `(수정됨)`을 붙여 시각을 갱신합니다. JSON 등 주석을 지원하지 않는 형식은 예외입니다.
- UI 문구는 한국어로 작성합니다.

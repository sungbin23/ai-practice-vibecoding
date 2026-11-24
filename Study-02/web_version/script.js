/* 작성일: 2026-11-25 02:00 */
/* 원본: ../script.js 와 동일한 로직 (데스크톱 레이아웃용 web_version) */
/**
 * My Tasks - 개인용 할 일 관리 앱
 *
 * 동작 원칙: 전역 `tasks` 배열이 유일한 데이터 원본이다.
 * 모든 변경은 `tasks` 수정 → saveTasks() → renderTasks() 순서로 처리하며,
 * renderTasks()는 목록 전체를 다시 그리고 대시보드까지 갱신한다.
 * 화면의 항목은 필터·검색·정렬이 적용된 복사본이므로 항목 식별은 항상 task.id로 한다.
 */

// ===== DOM 참조 =====
const taskInput = document.getElementById('taskInput');
const categorySelect = document.getElementById('categorySelect');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const filterBtns = document.querySelectorAll('.filter-btn');
const themeToggle = document.getElementById('themeToggle');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const quoteContainer = document.getElementById('quoteContainer');
const remainingBadge = document.getElementById('remainingBadge');
const cheerMessage = document.getElementById('cheerMessage');
const srStatus = document.getElementById('srStatus');
const undoToast = document.getElementById('undoToast');
const undoText = document.getElementById('undoText');
const undoBtn = document.getElementById('undoBtn');
const autoCategoryHint = document.getElementById('autoCategoryHint');

// ===== 상수 =====
const CATEGORIES = ['work', 'personal', 'study'];
const categoryNames = { work: '업무', personal: '개인', study: '공부' };

/**
 * 키워드 기반 자동 분류 사전 (소문자로 비교).
 * 너무 짧아 다른 단어에 섞이기 쉬운 키워드(예: '약' → '계약', '책' → '책임')는 피한다.
 */
const CATEGORY_KEYWORDS = {
    work: ['회의', '미팅', '보고서', '보고', '업무', '출근', '퇴근', '프로젝트', '기획', '발표', '메일', '결재',
        '거래처', '고객', '계약', '마감', '팀장', '부장', '상사', '야근', '출장', '견적', 'ppt', '제안서',
        '회사', '면접', '인수인계', '정산', '세미나', '클라이언트', '협업'],
    personal: ['운동', '헬스', '요가', '산책', '러닝', '장보기', '마트', '쇼핑', '청소', '빨래', '설거지',
        '병원', '약국', '치과', '은행', '약속', '친구', '가족', '엄마', '아빠', '생일', '선물', '여행',
        '영화', '요리', '택배', '미용실', '데이트', '이사', '세탁', '분리수거', '예약', '휴가', '취미'],
    study: ['공부', '시험', '과제', '숙제', '강의', '수업', '복습', '예습', '독서', '책 읽기', '레포트',
        '리포트', '논문', '자격증', '토익', '토플', '영어', '단어', '문제집', '학원', '코딩', '프로그래밍',
        '알고리즘', '자바스크립트', 'javascript', '파이썬', 'python', '중간고사', '기말고사', '스터디',
        '인강', '퀴즈', '발제', '실습', '전공']
};
const FILTERS = ['all', ...CATEGORIES];
const SORTS = ['latest', 'oldest', 'category', 'completed', 'manual'];
const SEARCH_DEBOUNCE_MS = 250;
const SAVE_DEBOUNCE_MS = 300;
const UNDO_TIMEOUT_MS = 5000;
const ANIMATION_MS = 300;

const quotes = [
    "작은 진전도 큰 성과입니다 🌟",
    "오늘 할 일을 내일로 미루지 말자 ⏰",
    "꾸준함이 탁월함을 만듭니다 💪",
    "시작이 반이다! 일단 시작해볼까요? 🚀",
    "당신의 하루를 스스로 디자인하세요 🎨"
];

// ===== 유틸리티 =====

/** localStorage 값을 JSON으로 안전하게 읽는다. 손상된 값이면 fallback을 돌려준다. */
function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
        console.error(`localStorage '${key}' 읽기 실패:`, error);
        return fallback;
    }
}

/** 마지막 호출 후 wait(ms) 동안 추가 호출이 없을 때만 fn을 실행한다. */
function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function findTask(id) {
    return tasks.find(t => t.id === id);
}

/** 저장소/가져오기 데이터를 앱이 쓰는 형태로 정리한다. 쓸 수 없는 항목은 null. */
function normalizeTask(raw) {
    if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) return null;
    return {
        id: raw.id ? String(raw.id) : generateId(),
        text: raw.text.trim(),
        completed: Boolean(raw.completed),
        category: CATEGORIES.includes(raw.category) ? raw.category : 'personal',
        createdAt: isNaN(new Date(raw.createdAt)) ? new Date().toISOString() : raw.createdAt
    };
}

/** 배열 전체를 정리하고, 겹치는 id는 새로 발급한다. */
function normalizeTasks(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.map(normalizeTask).filter(Boolean).map(task => {
        if (seen.has(task.id)) task.id = generateId();
        seen.add(task.id);
        return task;
    });
}

/** 스크린 리더에 상태 변화를 알린다(aria-live 영역). */
function announce(message) {
    srStatus.textContent = '';
    requestAnimationFrame(() => { srStatus.textContent = message; });
}

/** 다시 그린 뒤 특정 항목의 요소로 포커스를 돌려준다. */
function focusTaskControl(id, selector) {
    const li = taskList.querySelector(`li[data-id="${CSS.escape(id)}"]`);
    const target = li && li.querySelector(selector);
    if (target) target.focus();
}

// ===== 키워드 기반 자동 카테고리 분류 =====

/**
 * 텍스트에 포함된 키워드로 카테고리를 추정한다.
 * 점수 = 일치한 키워드 길이의 합(길수록 구체적인 키워드로 본다).
 * 일치가 없거나 최고 점수가 동점이면 null을 돌려준다.
 */
function classifyTask(text) {
    const lower = text.toLowerCase();
    let best = null;
    for (const cat of CATEGORIES) {
        const keywords = CATEGORY_KEYWORDS[cat].filter(k => lower.includes(k));
        const score = keywords.reduce((sum, k) => sum + k.length, 0);
        if (score === 0) continue;
        if (!best || score > best.score) best = { category: cat, keywords, score, tie: false };
        else if (score === best.score) best.tie = true;
    }
    return best && !best.tie ? best : null;
}

function showAutoHint(message, type) {
    autoCategoryHint.textContent = message;
    autoCategoryHint.className = `auto-category-hint${type ? ` ${type}` : ''}`;
}

/** 새 할 일 입력에 맞춰 카테고리 드롭다운을 자동으로 고른다(사용자가 직접 고르면 중단). */
function applyAutoCategory() {
    const text = taskInput.value.trim();
    if (!text) {
        categoryManuallySet = false; // 입력을 비우면 자동 분류 다시 켜기
        showAutoHint('');
        return;
    }
    if (categoryManuallySet) {
        showAutoHint(`✋ 직접 선택한 카테고리(${categoryNames[categorySelect.value]})를 사용합니다`, 'manual');
        return;
    }
    const result = classifyTask(text);
    if (!result) {
        showAutoHint('');
        return;
    }
    if (categorySelect.value !== result.category) {
        categorySelect.value = result.category;
        categorySelect.classList.remove('auto-selected');
        void categorySelect.offsetWidth; // 강조 애니메이션 다시 시작
        categorySelect.classList.add('auto-selected');
    }
    const shown = result.keywords.slice(0, 3).map(k => `'${k}'`).join(', ');
    showAutoHint(`🤖 자동 분류: ${categoryNames[result.category]} (키워드 ${shown})`, `auto tag-text-${result.category}`);
}

// ===== 상태 =====
let tasks = normalizeTasks(loadJSON('tasks', []));
let currentFilter = FILTERS.includes(localStorage.getItem('currentFilter')) ? localStorage.getItem('currentFilter') : 'all';
let currentSort = SORTS.includes(localStorage.getItem('currentSort')) ? localStorage.getItem('currentSort') : 'latest';
let isDarkMode = loadJSON('isDarkMode', false) === true;
let animateId = null;     // 다음 렌더링에서 애니메이션을 줄 항목 id
let animateType = null;   // 'add' | 'complete'
let undoState = null;     // [{ task, index }] 삭제 취소용
let undoTimer = null;
let saveTimer = null;
let categoryManuallySet = false; // 사용자가 카테고리를 직접 골랐는지 (자동 분류 중단)

// ===== 저장 (디바운싱) =====
function persistTasks() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
        console.error('저장 실패:', error);
        alert('할 일을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');
    }
}

/** 연속 변경 시 마지막 변경 후 한 번만 저장한다. */
function saveTasks() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistTasks, SAVE_DEBOUNCE_MS);
}

// 페이지를 떠나기 전에 대기 중인 저장을 즉시 처리
window.addEventListener('beforeunload', () => { if (saveTimer) persistTasks(); });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && saveTimer) persistTasks();
});

// ===== 테마 =====
function applyTheme() {
    document.body.classList.toggle('dark-mode', isDarkMode);
    themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-pressed', String(isDarkMode));
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    announce(isDarkMode ? '다크 모드가 켜졌습니다.' : '라이트 모드가 켜졌습니다.');
}

themeToggle.addEventListener('click', toggleTheme);

// ===== 시간 표시 =====
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((Date.now() - date) / (1000 * 60));
    if (diffInMinutes < 1) return '방금 전';
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    const hours = Math.floor(diffInMinutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

// 1분마다 시간 텍스트만 갱신 (목록 전체를 다시 그리지 않음)
setInterval(() => {
    taskList.querySelectorAll('.time-text').forEach(span => {
        span.textContent = getTimeAgo(span.dataset.created);
    });
}, 60 * 1000);

// ===== 대시보드 =====
function setProgress(fillId, percent) {
    const fill = document.getElementById(fillId);
    fill.style.width = `${percent}%`;
    fill.parentElement.setAttribute('aria-valuenow', String(Math.round(percent)));
}

function getCheerMessage(percent, total) {
    if (total === 0) return '첫 할 일을 추가해 보세요 ✍️';
    if (percent === 100) return '모든 할 일을 완료했어요! 정말 대단해요 🎉';
    if (percent >= 75) return '거의 다 왔어요! 조금만 더 힘내세요 🔥';
    if (percent >= 50) return '절반 넘게 해냈어요! 좋은 흐름이에요 👍';
    if (percent >= 25) return '좋은 출발이에요! 계속 가 볼까요? 🌱';
    return '하나씩 차근차근 시작해 봐요 💪';
}

function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    document.getElementById('overallText').textContent = `${completed}/${total} 완료 (${percent}%)`;
    setProgress('overallProgress', percent);

    const today = new Date().toDateString();
    document.getElementById('todayCount').textContent = `${tasks.filter(t => new Date(t.createdAt).toDateString() === today).length}개`;

    CATEGORIES.forEach(cat => {
        const catTasks = tasks.filter(t => t.category === cat);
        const catCompleted = catTasks.filter(t => t.completed).length;
        const catPercent = catTasks.length === 0 ? 0 : (catCompleted / catTasks.length) * 100;
        document.getElementById(`${cat}Text`).textContent = `${catCompleted}/${catTasks.length}`;
        setProgress(`${cat}Progress`, catPercent);
    });

    remainingBadge.textContent = `${total - completed}개 남음`;
    cheerMessage.textContent = getCheerMessage(percent, total);
}

// ===== 정렬 =====
const sorters = {
    latest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    category: (a, b) => a.category.localeCompare(b.category),
    completed: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    manual: () => 0 // 배열 순서(드래그 앤 드롭 결과)를 그대로 유지
};

/** 완료 항목은 항상 아래로 보내고, 그 안에서 현재 정렬 방식을 적용한다. */
function getSortedTasks(list) {
    return [...list].sort((a, b) => (a.completed - b.completed) || sorters[currentSort](a, b));
}

function setSort(value) {
    currentSort = value;
    sortSelect.value = value;
    localStorage.setItem('currentSort', value);
}

// ===== 렌더링 =====
function createTaskElement(task) {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.draggable = true;
    if (task.completed) li.classList.add('completed');
    if (task.id === animateId) li.classList.add(animateType === 'add' ? 'fade-in' : 'slide-in');

    // 드래그 앤 드롭: id로 대상을 찾아 배열 순서를 바꾼다
    li.addEventListener('dragstart', (e) => {
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', (e) => {
        e.preventDefault();
        moveTask(e.dataTransfer.getData('text/plain'), task.id);
    });

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `"${task.text}" 완료 표시`);
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;
    span.tabIndex = 0;
    span.title = '더블클릭(또는 Enter)하여 수정';
    span.addEventListener('dblclick', () => enableEditMode(li, task));
    span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); enableEditMode(li, task); }
    });

    const tag = document.createElement('span');
    tag.className = `category-tag tag-${task.category}`;
    tag.textContent = categoryNames[task.category];

    const timeSpan = document.createElement('span');
    timeSpan.className = 'time-text';
    timeSpan.dataset.created = task.createdAt;
    timeSpan.title = new Date(task.createdAt).toLocaleString('ko-KR');
    timeSpan.textContent = getTimeAgo(task.createdAt);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'X';
    deleteBtn.setAttribute('aria-label', `"${task.text}" 삭제`);
    deleteBtn.addEventListener('click', () => deleteTask(task.id, li));

    taskContent.append(span, tag);
    li.append(checkbox, taskContent, timeSpan, deleteBtn);
    return li;
}

function renderTasks() {
    const keyword = searchInput.value.trim().toLowerCase();

    // 1. 필터 및 검색 적용 → 2. 정렬 적용
    const displayTasks = getSortedTasks(tasks.filter(task => {
        const matchesFilter = currentFilter === 'all' || task.category === currentFilter;
        const matchesSearch = task.text.toLowerCase().includes(keyword);
        return matchesFilter && matchesSearch;
    }));

    // 3. DocumentFragment로 한 번에 DOM에 반영 (항목이 많아도 부드럽게)
    const fragment = document.createDocumentFragment();
    if (displayTasks.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty-message';
        if (tasks.length === 0) empty.textContent = '할 일이 없습니다. 추가해보세요!';
        else if (keyword) empty.textContent = '검색 결과가 없습니다.';
        else empty.textContent = '이 카테고리에는 할 일이 없습니다.';
        fragment.appendChild(empty);
    } else {
        displayTasks.forEach(task => fragment.appendChild(createTaskElement(task)));
    }
    taskList.replaceChildren(fragment);
    animateId = null;
    animateType = null;
    updateDashboard();
}

// ===== 할 일 조작 =====
function addTask() {
    const text = taskInput.value.trim();
    if (!text) {
        announce('할 일 내용을 입력해 주세요.');
        taskInput.focus();
        return;
    }

    // 중복 경고
    const duplicate = tasks.find(t => t.text.toLowerCase() === text.toLowerCase());
    if (duplicate && !confirm(`"${text}"은(는) 이미 목록에 있습니다. 그래도 추가하시겠습니까?`)) {
        taskInput.select();
        return;
    }

    // 입력 이벤트 없이 값이 바뀐 경우(자동완성 등)를 대비해 한 번 더 분류
    const auto = categoryManuallySet ? null : classifyTask(text);
    if (auto) categorySelect.value = auto.category;

    const task = { id: generateId(), text, completed: false, category: categorySelect.value, createdAt: new Date().toISOString() };
    tasks.push(task);
    animateId = task.id;
    animateType = 'add';
    taskInput.value = '';
    categoryManuallySet = false;
    showAutoHint('');
    saveTasks();
    renderTasks();

    const hidden = currentFilter !== 'all' && currentFilter !== task.category;
    announce(`"${text}"을(를) ${categoryNames[task.category]}에 ${auto ? '자동 분류해 ' : ''}추가했습니다.${hidden ? ' 현재 필터에서는 보이지 않습니다.' : ''}`);
    taskInput.focus();
}

function toggleTask(id) {
    const task = findTask(id);
    if (!task) return;
    task.completed = !task.completed;
    if (task.completed) { animateId = id; animateType = 'complete'; }
    saveTasks();
    renderTasks();
    announce(task.completed ? `"${task.text}" 완료` : `"${task.text}" 완료 취소`);
    focusTaskControl(id, '.task-checkbox');
}

/** 페이드아웃 애니메이션 후 삭제하고, 실행 취소를 제공한다. */
function deleteTask(id, li) {
    if (!findTask(id) || (li && li.classList.contains('fade-out'))) return;
    const neighbor = li && (li.nextElementSibling || li.previousElementSibling);
    const nextFocusId = neighbor && neighbor.dataset.id;

    const remove = () => {
        const index = tasks.findIndex(t => t.id === id);
        if (index < 0) return;
        const [removed] = tasks.splice(index, 1);
        saveTasks();
        renderTasks();
        offerUndo(`"${removed.text}" 삭제됨`, [{ task: removed, index }]);
        if (nextFocusId) focusTaskControl(nextFocusId, '.task-checkbox');
        else taskInput.focus();
    };

    if (li) {
        li.classList.add('fade-out');
        setTimeout(remove, ANIMATION_MS);
    } else {
        remove();
    }
}

/** 드래그한 항목(fromId)을 놓은 항목(toId) 위치로 옮긴다. */
function moveTask(fromId, toId) {
    if (!fromId || fromId === toId) return;
    // 다른 정렬 중이었다면 지금 보이는 순서를 기준으로 '직접 정렬'로 전환
    if (currentSort !== 'manual') {
        tasks = getSortedTasks(tasks);
        setSort('manual');
        announce('직접 정렬로 전환되었습니다.');
    }
    const from = tasks.findIndex(t => t.id === fromId);
    const to = tasks.findIndex(t => t.id === toId);
    if (from < 0 || to < 0) return;
    const [dragged] = tasks.splice(from, 1);
    tasks.splice(to, 0, dragged);
    saveTasks();
    renderTasks();
}

function enableEditMode(li, task) {
    const taskContent = li.querySelector('.task-content');
    if (taskContent.classList.contains('editing')) return;
    taskContent.classList.add('editing');
    li.draggable = false; // 편집 중 텍스트 선택이 드래그로 바뀌지 않도록
    taskContent.replaceChildren();

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = task.text;
    editInput.className = 'edit-mode-input';
    editInput.title = 'Enter 저장 · ESC 취소';
    editInput.setAttribute('aria-label', '할 일 내용 수정 (Enter 저장, ESC 취소)');

    const editCategory = document.createElement('select');
    editCategory.className = 'edit-category-select';
    editCategory.setAttribute('aria-label', '카테고리 변경');
    CATEGORIES.forEach(cat => editCategory.add(new Option(categoryNames[cat], cat)));
    editCategory.value = task.category;

    // 편집 중에도 카테고리를 직접 바꾸지 않았다면 키워드로 자동 분류
    let editCategoryTouched = false;
    editCategory.addEventListener('change', () => { editCategoryTouched = true; });
    editInput.addEventListener('input', () => {
        const result = !editCategoryTouched && classifyTask(editInput.value);
        if (result) editCategory.value = result.category;
    });

    const saveEdit = () => {
        const target = findTask(task.id);
        if (target) {
            if (editInput.value.trim()) target.text = editInput.value.trim();
            target.category = editCategory.value;
            saveTasks();
            announce('수정되었습니다.');
        }
        renderTasks();
        focusTaskControl(task.id, '.task-text');
    };
    const cancelEdit = () => {
        renderTasks();
        focusTaskControl(task.id, '.task-text');
    };
    const onKeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    };
    editInput.addEventListener('keydown', onKeydown);
    editCategory.addEventListener('keydown', onKeydown);

    taskContent.append(editInput, editCategory);
    editInput.focus();
    editInput.select();
}

// ===== 실행 취소 =====
function offerUndo(message, removedItems) {
    undoState = removedItems;
    undoText.textContent = message;
    undoToast.hidden = false;
    announce(`${message}. 실행 취소하려면 Ctrl+Z를 누르세요.`);
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, UNDO_TIMEOUT_MS);
}

function hideUndo() {
    clearTimeout(undoTimer);
    undoToast.hidden = true;
    undoState = null;
}

function undoDelete() {
    if (!undoState) return;
    // 원래 위치를 오름차순으로 다시 끼워 넣으면 기존 순서가 복원된다
    const restored = [...undoState].sort((a, b) => a.index - b.index);
    restored.forEach(({ task, index }) => tasks.splice(Math.min(index, tasks.length), 0, task));
    hideUndo();
    saveTasks();
    renderTasks();
    announce(`${restored.length}개 항목을 복원했습니다.`);
}

undoBtn.addEventListener('click', undoDelete);

// ===== 정렬 변경 =====
sortSelect.value = currentSort;
sortSelect.addEventListener('change', (e) => {
    setSort(e.target.value);
    renderTasks();
});

// ===== JSON 내보내기 / 가져오기 =====
function exportTasks({ silent = false } = {}) {
    const exportData = { tasks, settings: { currentFilter, currentSort, isDarkMode }, metadata: { exportDate: new Date().toISOString(), taskCount: tasks.length } };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-tasks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (!silent) alert('데이터가 성공적으로 내보내졌습니다!');
}

exportBtn.addEventListener('click', () => exportTasks());

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    importFile.value = ''; // 같은 파일을 다시 고를 수 있도록 초기화
    if (!file) return;
    if (!confirm(`현재 ${tasks.length}개의 할 일이 있습니다. 가져오시겠습니까? (현재 데이터는 덮어씌워집니다)`)) return;

    // 가져오기 전 백업 확인
    if (tasks.length > 0 && confirm('덮어쓰기 전에 현재 데이터를 백업 파일로 저장할까요?')) {
        exportTasks({ silent: true });
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            const list = Array.isArray(data) ? data : data && data.tasks;
            if (!Array.isArray(list)) throw new Error('tasks 목록을 찾을 수 없습니다.');
            const imported = normalizeTasks(list);
            if (list.length > 0 && imported.length === 0) throw new Error('올바른 할 일 항목이 없습니다.');

            tasks = imported;
            hideUndo();
            persistTasks();
            renderTasks();
            const skipped = list.length - imported.length;
            alert(`데이터를 성공적으로 불러왔습니다! (${imported.length}개${skipped > 0 ? `, 잘못된 항목 ${skipped}개 제외` : ''})`);
        } catch (error) {
            console.error('가져오기 실패:', error);
            alert(`파일 형식이 잘못되었습니다.\n${error.message}`);
        }
    };
    reader.onerror = () => alert('파일을 읽는 중 오류가 발생했습니다.');
    reader.readAsText(file);
});

// ===== 완료 항목 일괄 삭제 =====
clearCompletedBtn.addEventListener('click', () => {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) return alert('삭제할 완료된 항목이 없습니다.');
    if (confirm(`완료된 할 일 ${completedCount}개를 모두 삭제하시겠습니까?`)) {
        const removed = [];
        tasks.forEach((task, index) => { if (task.completed) removed.push({ task, index }); });
        tasks = tasks.filter(t => !t.completed);
        saveTasks();
        renderTasks();
        offerUndo(`완료 항목 ${completedCount}개 삭제됨`, removed);
    }
});

// ===== 필터 (상태 저장) =====
function setFilter(filter) {
    currentFilter = filter;
    localStorage.setItem('currentFilter', filter);
    filterBtns.forEach(b => {
        const active = b.dataset.filter === filter;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
    });
}

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter);
        renderTasks();
    });
});

// ===== 입력 / 검색 =====
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('input', applyAutoCategory);
categorySelect.addEventListener('change', () => {
    categoryManuallySet = true;
    if (taskInput.value.trim()) applyAutoCategory();
});
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) addTask(); // 한글 조합 중 Enter는 무시
});
searchInput.addEventListener('input', debounce(renderTasks, SEARCH_DEBOUNCE_MS));
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchInput.value = ''; renderTasks(); }
});

// ===== 키보드 단축키 =====
document.addEventListener('keydown', (e) => {
    if (e.altKey) {
        const filterKeys = { '1': 'all', '2': 'work', '3': 'personal', '4': 'study' };
        const key = e.key.toLowerCase();
        if (key === 'n') { e.preventDefault(); taskInput.focus(); }
        else if (key === 'd') { e.preventDefault(); toggleTheme(); }
        else if (filterKeys[key]) { e.preventDefault(); document.querySelector(`[data-filter="${filterKeys[key]}"]`).click(); }
        return;
    }
    // 입력창 밖에서 Ctrl+Z → 삭제 실행 취소
    const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && undoState && !typing) {
        e.preventDefault();
        undoDelete();
    }
});

// ===== 초기화 =====
quoteContainer.textContent = quotes[Math.floor(Math.random() * quotes.length)];
applyTheme();
setFilter(currentFilter);
persistTasks(); // 예전 데이터에 id를 부여한 결과를 바로 저장
renderTasks();

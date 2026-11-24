// 작성일: 2026-11-25 02:40
// quiz-ui.js — 상단 바, 다크모드, 리더보드·통계·프로필 대화상자 (quiz-records.js, quiz-game.js 다음에 로드)

const statsDialog = document.getElementById('stats-dialog');
const leaderboardDialog = document.getElementById('leaderboard-dialog');
const profileDialog = document.getElementById('profile-dialog');
const themeToggle = document.getElementById('theme-toggle');

let leaderboardPeriod = 'daily';

// --- 공통 헬퍼 ---
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
}

// 퀴즈 진행 중에 대화상자를 열면 자동으로 일시정지
function openDialog(dialog, render) {
    if (quizScreen.classList.contains('active') && !isGameOver) pauseGame();
    render();
    dialog.showModal();
}

document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog').close());
});
// 대화상자 바깥(배경)을 클릭하면 닫기
[statsDialog, leaderboardDialog, profileDialog].forEach(dialog => {
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
});

document.getElementById('open-stats').addEventListener('click', () => openDialog(statsDialog, renderStats));
document.getElementById('open-leaderboard').addEventListener('click', () => openDialog(leaderboardDialog, renderLeaderboard));
document.getElementById('open-profile').addEventListener('click', () => openDialog(profileDialog, renderProfile));

// --- 다크모드 ---
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const isDark = theme === 'dark';
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
    themeToggle.title = themeToggle.getAttribute('aria-label');
}

themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEYS.theme, next);
    applyTheme(next);
});
applyTheme(document.documentElement.dataset.theme || 'light'); // 초기 테마는 index.html <head>에서 먼저 적용

// --- 상단 프로필 표시 + 시작 화면 개인 최고 기록 ---
function refreshProfileUI() {
    const profile = getCurrentProfile();
    document.getElementById('profile-chip-avatar').textContent = profile.avatar;
    document.getElementById('profile-chip-name').textContent = profile.name;
    document.getElementById('personal-best').textContent = getPersonalBest(profile.id);
}
refreshProfileUI();
document.getElementById('restart-btn').addEventListener('click', refreshProfileUI);

// --- 리더보드 ---
const leaderboardTabs = [...document.querySelectorAll('#leaderboard-tabs [role="tab"]')];
const leaderboardCategory = document.getElementById('leaderboard-category');

getCategories().forEach(category => {
    const option = el('option', '', category);
    option.value = category;
    leaderboardCategory.appendChild(option);
});

leaderboardTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
        leaderboardPeriod = tab.dataset.period;
        renderLeaderboard();
    });
    // 탭 목록 안에서는 ←/→ 키로 이동
    tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = leaderboardTabs[(index + (e.key === 'ArrowRight' ? 1 : -1) + leaderboardTabs.length) % leaderboardTabs.length];
        next.focus();
        next.click();
    });
});
leaderboardCategory.addEventListener('change', renderLeaderboard);

function renderLeaderboard() {
    leaderboardTabs.forEach(tab => {
        const selected = tab.dataset.period === leaderboardPeriod;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
    });
    leaderboardCategory.parentElement.classList.toggle('hidden', leaderboardPeriod !== 'category');

    const descriptions = {
        daily: '오늘 플레이한 기록',
        weekly: '이번 주(월요일부터) 플레이한 기록',
        all: '전체 기간 기록',
        category: `카테고리별 도전 '${leaderboardCategory.value}' 기록`
    };
    document.getElementById('leaderboard-desc').textContent =
        `${descriptions[leaderboardPeriod]} · 프로필별 최고 점수 상위 ${LEADERBOARD_SIZE}명`;

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    const rows = getLeaderboard(leaderboardPeriod, leaderboardCategory.value);
    if (rows.length === 0) {
        list.appendChild(el('li', 'empty-state', '아직 기록이 없습니다. 게임을 플레이해 보세요!'));
        return;
    }

    const currentId = getCurrentProfile().id;
    const medals = ['🥇', '🥈', '🥉'];
    rows.forEach((r, i) => {
        const item = el('li', 'leaderboard-row' + (r.profileId === currentId ? ' is-me' : ''));
        item.append(
            el('span', 'rank', medals[i] || String(i + 1)),
            el('span', 'player', `${r.avatar} ${r.name}`),
            el('span', 'meta', `${MODE_LABELS[r.mode] || r.mode}${r.category ? ` · ${r.category}` : ''} · ${formatDateTime(r.playedAt)}`),
            el('strong', 'points', `${r.score}점`)
        );
        list.appendChild(item);
    });
}

// --- 통계 대시보드 ---
function renderStats() {
    const profile = getCurrentProfile();
    const stats = getProfileStats(profile.id);
    document.getElementById('stats-owner').textContent = `${profile.avatar} ${profile.name}님의 기록`;

    const body = document.getElementById('stats-body');
    body.innerHTML = '';
    if (stats.playCount === 0) {
        body.appendChild(el('p', 'empty-state', '아직 기록이 없습니다. 게임을 한 판 끝내면 통계가 나타납니다.'));
        return;
    }

    // 요약 수치
    const tiles = el('div', 'stat-grid stat-grid-4');
    [
        ['플레이 횟수', `${stats.playCount}회`],
        ['평균 점수', `${stats.averageScore}점`],
        ['개인 최고', `${stats.bestScore}점`],
        ['전체 정답률', `${stats.accuracy}%`]
    ].forEach(([label, value]) => {
        const card = el('div', 'stat-card');
        card.append(el('strong', '', value), el('span', '', label));
        tiles.appendChild(card);
    });
    body.appendChild(tiles);

    // 모드별 플레이 횟수
    body.appendChild(el('h3', 'section-title', '모드별 플레이 횟수'));
    const modeList = el('div', 'mode-count-list');
    Object.keys(MODE_LABELS).forEach(mode => {
        modeList.appendChild(el('span', 'mode-count', `${MODE_LABELS[mode]} ${stats.modeCounts[mode] || 0}회`));
    });
    body.appendChild(modeList);

    // 카테고리별 정답률
    body.appendChild(el('h3', 'section-title', '카테고리별 정답률'));
    const categoryList = el('div', 'category-result');
    getCategories().forEach(category => {
        const t = stats.categoryTotals[category];
        const row = el('div', 'category-row');
        const bar = el('div', 'category-bar');
        const fill = el('div', 'category-bar-fill');
        const rate = t && t.total ? Math.round((t.correct / t.total) * 100) : 0;
        fill.style.width = `${rate}%`;
        bar.appendChild(fill);
        row.append(
            el('span', 'category-name', category),
            bar,
            el('span', 'category-count', t ? `${rate}% (${t.correct}/${t.total})` : '기록 없음')
        );
        categoryList.appendChild(row);
    });
    body.appendChild(categoryList);

    // 시간별 점수 추이
    body.appendChild(el('h3', 'section-title', `시간별 점수 추이 (최근 ${stats.timeline.length}게임)`));
    body.appendChild(buildScoreChart(stats.timeline));
    body.appendChild(buildScoreTable(stats.timeline));
}

function niceMax(value) {
    if (value <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value / 4 * 1.0001) * magnitude;
    return Math.ceil(value / step) * step;
}

function buildScoreChart(timeline) {
    const W = 520, H = 220, PAD = { top: 14, right: 14, bottom: 30, left: 42 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const yMax = niceMax(Math.max(...timeline.map(r => r.score)));
    const x = i => PAD.left + (timeline.length === 1 ? plotW / 2 : (i / (timeline.length - 1)) * plotW);
    const y = v => PAD.top + plotH - (v / yMax) * plotH;

    const wrap = el('div', 'chart-wrap');
    const svg = svgEl('svg', {
        viewBox: `0 0 ${W} ${H}`,
        class: 'score-chart',
        role: 'img',
        'aria-label': `최근 ${timeline.length}게임 점수 추이 선 그래프. 최고 ${Math.max(...timeline.map(r => r.score))}점`
    });

    // 가로 눈금선 + y축 값
    for (let i = 0; i <= 4; i++) {
        const value = (yMax / 4) * i;
        svg.appendChild(svgEl('line', { x1: PAD.left, x2: W - PAD.right, y1: y(value), y2: y(value), class: i === 0 ? 'chart-axis' : 'chart-grid' }));
        const label = svgEl('text', { x: PAD.left - 8, y: y(value) + 4, class: 'chart-label', 'text-anchor': 'end' });
        label.textContent = Math.round(value);
        svg.appendChild(label);
    }

    // x축: 처음과 마지막 게임 날짜
    const dateLabel = iso => formatDateTime(iso).slice(5, 10);
    [[0, 'start'], [timeline.length - 1, 'end']].forEach(([i, anchor]) => {
        if (timeline.length === 1 && anchor === 'end') return;
        const label = svgEl('text', { x: x(i), y: H - 8, class: 'chart-label', 'text-anchor': timeline.length === 1 ? 'middle' : anchor });
        label.textContent = dateLabel(timeline[i].playedAt);
        svg.appendChild(label);
    });

    // 선 + 점
    if (timeline.length > 1) {
        const d = timeline.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r.score).toFixed(1)}`).join(' ');
        svg.appendChild(svgEl('path', { d, class: 'chart-line' }));
    }
    timeline.forEach((r, i) => svg.appendChild(svgEl('circle', { cx: x(i), cy: y(r.score), r: 4, class: 'chart-dot' })));

    // 호버: 세로 보조선 + 툴팁 (가장 가까운 게임)
    const crosshair = svgEl('line', { y1: PAD.top, y2: PAD.top + plotH, class: 'chart-crosshair', visibility: 'hidden' });
    const focusDot = svgEl('circle', { r: 6, class: 'chart-dot chart-dot-focus', visibility: 'hidden' });
    svg.append(crosshair, focusDot);
    const hitArea = svgEl('rect', { x: PAD.left - 10, y: 0, width: plotW + 20, height: H, fill: 'transparent' });
    svg.appendChild(hitArea);

    const tooltip = el('div', 'chart-tooltip hidden');
    wrap.append(svg, tooltip);

    function showPoint(i) {
        const r = timeline[i];
        crosshair.setAttribute('x1', x(i));
        crosshair.setAttribute('x2', x(i));
        focusDot.setAttribute('cx', x(i));
        focusDot.setAttribute('cy', y(r.score));
        crosshair.setAttribute('visibility', 'visible');
        focusDot.setAttribute('visibility', 'visible');
        tooltip.innerHTML = '';
        tooltip.append(
            el('strong', '', `${r.score}점`),
            el('span', '', formatDateTime(r.playedAt)),
            el('span', '', `${MODE_LABELS[r.mode] || r.mode}${r.category ? ` · ${r.category}` : ''} · 정답률 ${r.accuracy}%`)
        );
        tooltip.classList.remove('hidden');
        const left = (x(i) / W) * 100;
        tooltip.style.left = `${left}%`;
        tooltip.style.transform = left > 70 ? 'translateX(-100%)' : left < 30 ? 'translateX(0)' : 'translateX(-50%)';
    }
    function hidePoint() {
        crosshair.setAttribute('visibility', 'hidden');
        focusDot.setAttribute('visibility', 'hidden');
        tooltip.classList.add('hidden');
    }
    hitArea.addEventListener('pointermove', (e) => {
        const rect = svg.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * W;
        let nearest = 0;
        timeline.forEach((_, i) => { if (Math.abs(x(i) - svgX) < Math.abs(x(nearest) - svgX)) nearest = i; });
        showPoint(nearest);
    });
    hitArea.addEventListener('pointerleave', hidePoint);
    return wrap;
}

// 그래프와 같은 데이터를 표로도 제공 (스크린 리더·정확한 값 확인용)
function buildScoreTable(timeline) {
    const details = el('details', 'chart-table');
    details.appendChild(el('summary', '', '표로 보기'));
    const table = el('table');
    const head = el('tr');
    ['일시', '모드', '점수', '정답률'].forEach(h => head.appendChild(el('th', '', h)));
    table.appendChild(head);
    [...timeline].reverse().forEach(r => {
        const row = el('tr');
        [formatDateTime(r.playedAt), `${MODE_LABELS[r.mode] || r.mode}${r.category ? ` · ${r.category}` : ''}`, `${r.score}점`, `${r.accuracy}%`]
            .forEach(v => row.appendChild(el('td', '', v)));
        table.appendChild(row);
    });
    details.appendChild(table);
    return details;
}

// --- 프로필 ---
let selectedAvatar = null;

function renderProfile() {
    const profile = getCurrentProfile();
    selectedAvatar = profile.avatar;
    document.getElementById('profile-name').value = profile.name;
    document.getElementById('profile-status').textContent = '';
    document.getElementById('profile-summary').textContent =
        `플레이 ${getProfileRecords(profile.id).length}회 · 개인 최고 ${getPersonalBest(profile.id)}점 · 생성일 ${formatDateTime(profile.createdAt).slice(0, 10)}`;

    const picker = document.getElementById('avatar-picker');
    picker.innerHTML = '';
    AVATARS.forEach(avatar => {
        const button = el('button', 'avatar-btn', avatar);
        button.type = 'button';
        button.setAttribute('aria-label', `아바타 ${avatar}`);
        button.setAttribute('aria-pressed', String(avatar === selectedAvatar));
        button.addEventListener('click', () => {
            selectedAvatar = avatar;
            picker.querySelectorAll('.avatar-btn').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === avatar)));
        });
        picker.appendChild(button);
    });

    const list = document.getElementById('profile-list');
    list.innerHTML = '';
    getProfiles().forEach(p => {
        const button = el('button', 'profile-item' + (p.id === profile.id ? ' is-me' : ''), `${p.avatar} ${p.name}`);
        button.type = 'button';
        if (p.id === profile.id) {
            button.disabled = true;
            button.appendChild(el('span', 'badge', '사용 중'));
        } else {
            button.addEventListener('click', () => {
                switchProfile(p.id);
                refreshProfileUI();
                renderProfile();
                document.getElementById('profile-status').textContent = `✅ '${p.name}' 프로필로 전환했습니다.`;
            });
        }
        list.appendChild(button);
    });
}

document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const profile = getCurrentProfile();
    const updated = updateProfile(profile.id, { name: document.getElementById('profile-name').value, avatar: selectedAvatar });
    refreshProfileUI();
    renderProfile();
    document.getElementById('profile-status').textContent = `✅ '${updated.name}' 프로필을 저장했습니다.`;
});

document.getElementById('new-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('new-profile-name');
    const created = createProfile(input.value, AVATARS[getProfiles().length % AVATARS.length]);
    input.value = '';
    refreshProfileUI();
    renderProfile();
    document.getElementById('profile-status').textContent = `✅ '${created.name}' 프로필을 만들고 전환했습니다.`;
});

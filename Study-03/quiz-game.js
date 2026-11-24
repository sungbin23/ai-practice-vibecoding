// 작성일: 2026-11-25 02:40 (수정됨)
// --- 게임 규칙 상수 (2단계) ---
const BASE_POINTS = 10;          // 정답 기본 점수
const FAST_BONUS = 3;            // 10초 안에 맞히면 추가
const FAST_LIMIT_MS = 10000;
const NO_HINT_BONUS = 2;         // 그 문제에서 힌트를 쓰지 않으면 추가
const COMBO_BONUS = 5;           // 2연속 이상 정답 시 추가
const HINTS_PER_GAME = 3;        // 게임당 힌트 횟수 (1회 = 오답 2개 제거)
const SPEED_TIME_LIMIT = 15;     // 스피드 모드 문제당 제한 시간(초)
const MODE_QUESTION_COUNT = { normal: 40, category: 10, speed: 20 }; // 없는 모드는 전체 문제 사용

// --- 게임 상태 변수 ---
let currentQuestionIndex = 0;
let score = 0;
let combo = 0;
let maxCombo = 0;
let correctCount = 0;
let answeredCount = 0;
let totalResponseMs = 0;
let categoryStats = {};          // { 카테고리: { correct, total } }
let currentMode = 'normal';      // normal(전체 도전), category, speed, survival, timeattack
let selectedCategory = null;
let timer;                       // speed: 문제별 카운트다운 / timeattack: 전역 60초 (같은 변수 공유)
let elapsedTicker;               // 모든 모드 공통: 문제별 경과 시간 표시
let timeLeft = SPEED_TIME_LIMIT;
let globalTimeLeft = 60;
let lives = 1;
let currentQuizSet = [];
let hintsLeft = HINTS_PER_GAME;
let hintUsedThisQuestion = false;
let questionAnswered = false;
let isPaused = false;
let isGameOver = false;
let questionStartTime = 0;       // 현재 문제(또는 일시정지 해제) 시작 시각
let questionElapsedBefore = 0;   // 일시정지 전까지 누적된 경과 시간(ms)
let lastResponseMs = 0;

// --- Web Audio API 사운드 효과음 시스템 ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.setValueAtTime(110, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
    } else if (type === 'hint') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

// --- 폭죽 파티클 연출 (Confetti Engine) ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function triggerConfetti() {
    particles = [];
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.7) * 12,
            size: Math.random() * 8 + 4,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            life: 100
        });
    }
    animateConfetti();
}

function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // 중력
        p.life -= 2;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.life <= 0) particles.splice(index, 1);
    });
    if (particles.length > 0) requestAnimationFrame(animateConfetti);
}

// --- UI 엘리먼트 가져오기 ---
const mainCard = document.getElementById('main-card');
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const topScoreDisplay = document.getElementById('top-score');
const categoryGrid = document.getElementById('category-grid');

const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const progressText = document.getElementById('progress-text');
const scoreText = document.getElementById('score-text');
const categoryText = document.getElementById('category-text');
const timerDisplay = document.getElementById('timer-display');
const timeLeftSpan = document.getElementById('time-left');
const elapsedDisplay = document.getElementById('q-elapsed');
const elapsedSpan = document.getElementById('q-elapsed-time');
const comboText = document.getElementById('combo-text');
const lifeText = document.getElementById('life-text');
const hintBtn = document.getElementById('hint-btn');
const pauseBtn = document.getElementById('pause-btn');
const pauseOverlay = document.getElementById('pause-overlay');

const feedbackContainer = document.getElementById('feedback-container');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackPoints = document.getElementById('feedback-points');
const feedbackDesc = document.getElementById('feedback-desc');
const nextBtn = document.getElementById('next-btn');

// --- 이벤트 바인딩 ---
document.getElementById('mode-normal').addEventListener('click', () => startGame('normal'));
document.getElementById('mode-speed').addEventListener('click', () => startGame('speed'));
document.getElementById('mode-survival').addEventListener('click', () => startGame('survival'));
document.getElementById('mode-timeattack').addEventListener('click', () => startGame('timeattack'));

document.getElementById('restart-btn').addEventListener('click', () => {
    startScreen.classList.add('active');
    resultScreen.classList.remove('active');
    loadHighScore();
});

nextBtn.addEventListener('click', loadNextQuestion);
hintBtn.addEventListener('click', useHint);
pauseBtn.addEventListener('click', pauseGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);

document.getElementById('share-btn').addEventListener('click', shareResult);

// --- 키보드 네비게이션 (퀴즈 화면) ---
// 1~4: 보기 선택 / H: 힌트 / Enter·→: 다음 문제 / Esc·P: 일시정지·재개
// 대화상자가 열려 있거나 입력창에 입력 중일 때는 동작하지 않습니다.
document.addEventListener('keydown', (e) => {
    if (!quizScreen.classList.contains('active')) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toLowerCase();
    if (key === 'escape' || key === 'p') {
        e.preventDefault();
        if (isPaused) resumeGame(); else pauseGame();
        return;
    }
    if (isPaused) return;

    if (['1', '2', '3', '4'].includes(key)) {
        const button = optionsContainer.querySelectorAll('.option-btn')[Number(key) - 1];
        if (button && !button.disabled) button.click();
    } else if (key === 'h') {
        useHint();
    } else if ((key === 'enter' || key === 'arrowright') && !feedbackContainer.classList.contains('hidden')) {
        // 버튼에 포커스가 있으면 Enter는 브라우저가 그 버튼을 누르므로 중복 처리하지 않음
        if (key === 'enter' && e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        loadNextQuestion();
    }
});
// 탭을 벗어나면 자동 일시정지
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
});

// --- 카테고리별 도전 버튼 생성 ---
function getCategories() {
    return [...new Set(quizData.map(q => q.category))];
}

getCategories().forEach(category => {
    const count = Math.min(quizData.filter(q => q.category === category).length, MODE_QUESTION_COUNT.category);
    const button = document.createElement('button');
    button.className = 'category-btn';
    button.textContent = `${category} (${count}문제)`;
    button.addEventListener('click', () => startGame('category', category));
    categoryGrid.appendChild(button);
});

// --- 최고 점수 저장 및 불러오기 (LocalStorage) ---
function loadHighScore() {
    const savedScore = localStorage.getItem('knowledge_king_highscore') || 0;
    topScoreDisplay.textContent = savedScore;
}
loadHighScore();

function saveHighScore(newScore) {
    const currentHigh = parseInt(localStorage.getItem('knowledge_king_highscore') || 0);
    if (newScore > currentHigh) {
        localStorage.setItem('knowledge_king_highscore', newScore);
        return true;
    }
    return false;
}

// Fisher-Yates 셔플 (원본 배열은 변경하지 않음)
function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// --- 게임 시작 로직 ---
function startGame(mode, category = null) {
    currentMode = mode;
    selectedCategory = category;
    currentQuestionIndex = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    correctCount = 0;
    answeredCount = 0;
    totalResponseMs = 0;
    categoryStats = {};
    hintsLeft = HINTS_PER_GAME;
    isPaused = false;
    isGameOver = false;
    clearInterval(timer);
    clearInterval(elapsedTicker);

    // 모드별 문제 구성 (랜덤 순서)
    const pool = mode === 'category' ? quizData.filter(q => q.category === category) : quizData;
    currentQuizSet = shuffle(pool);
    const limit = MODE_QUESTION_COUNT[mode];
    if (limit) currentQuizSet = currentQuizSet.slice(0, limit);

    startScreen.classList.remove('active');
    resultScreen.classList.remove('active');
    quizScreen.classList.add('active');
    pauseOverlay.classList.add('hidden');

    // 모드별 상태 초기화
    timerDisplay.classList.add('hidden');
    lifeText.classList.add('hidden');
    comboText.classList.add('hidden'); // 이전 게임의 콤보 배지가 남지 않도록 초기화
    // 스피드 모드는 카운트다운 자체가 문제별 타이머이므로 경과 시간 표시를 숨김
    elapsedDisplay.classList.toggle('hidden', mode === 'speed');

    if (mode === 'speed') {
        timerDisplay.classList.remove('hidden');
    } else if (mode === 'survival') {
        lives = 1;
        lifeText.classList.remove('hidden');
        lifeText.textContent = `❤️ 목숨: ${lives}`;
    } else if (mode === 'timeattack') {
        timerDisplay.classList.remove('hidden');
        globalTimeLeft = 60;
        timeLeftSpan.textContent = globalTimeLeft;
        timer = setInterval(handleGlobalTimer, 1000);
    }

    loadQuestion();
}

function loadQuestion() {
    if (currentMode !== 'timeattack') clearInterval(timer);
    clearInterval(elapsedTicker);

    feedbackContainer.classList.add('hidden');
    optionsContainer.innerHTML = '';
    hintUsedThisQuestion = false;
    questionAnswered = false;
    updateHintButton();

    const currentQ = currentQuizSet[currentQuestionIndex];
    questionText.textContent = currentQ.question;
    categoryText.textContent = currentQ.category;
    progressText.textContent = `${currentQuestionIndex + 1} / ${currentQuizSet.length}`;
    scoreText.textContent = `점수: ${score}`;

    currentQ.options.forEach((option, index) => {
        const button = document.createElement('button');
        const keyBadge = document.createElement('span');
        keyBadge.className = 'option-key';
        keyBadge.textContent = index + 1;
        keyBadge.setAttribute('aria-hidden', 'true');
        button.append(keyBadge, document.createTextNode(option));
        button.setAttribute('aria-label', `${index + 1}번 보기: ${option}`);
        button.classList.add('option-btn');
        button.addEventListener('click', () => checkAnswer(index, button));
        optionsContainer.appendChild(button);
    });

    // 문제별 타이머 시작
    questionElapsedBefore = 0;
    questionStartTime = Date.now();
    updateElapsedDisplay();
    elapsedTicker = setInterval(updateElapsedDisplay, 100);

    if (currentMode === 'speed') {
        timeLeft = SPEED_TIME_LIMIT;
        timeLeftSpan.textContent = timeLeft;
        timer = setInterval(handleSpeedTimer, 1000);
    }
}

// 현재 문제의 경과 시간(ms) — 일시정지 시간은 제외
function getElapsedMs() {
    if (questionAnswered) return lastResponseMs;
    return questionElapsedBefore + (isPaused ? 0 : Date.now() - questionStartTime);
}

function updateElapsedDisplay() {
    elapsedSpan.textContent = (getElapsedMs() / 1000).toFixed(1);
}

function handleSpeedTimer() {
    timeLeft--;
    timeLeftSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
        clearInterval(timer);
        checkAnswer(-1, null);
    }
}

function handleGlobalTimer() {
    globalTimeLeft--;
    timeLeftSpan.textContent = globalTimeLeft;
    if (globalTimeLeft <= 0) {
        clearInterval(timer);
        showResult(true);
    }
}

// --- 일시정지 ---
function pauseGame() {
    if (isPaused || isGameOver || !quizScreen.classList.contains('active')) return;
    if (!questionAnswered) questionElapsedBefore += Date.now() - questionStartTime;
    isPaused = true;
    clearInterval(timer);
    clearInterval(elapsedTicker);
    pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
    if (!isPaused) return;
    isPaused = false;
    pauseOverlay.classList.add('hidden');
    if (!questionAnswered) {
        questionStartTime = Date.now();
        elapsedTicker = setInterval(updateElapsedDisplay, 100);
        if (currentMode === 'speed') timer = setInterval(handleSpeedTimer, 1000);
    }
    if (currentMode === 'timeattack') timer = setInterval(handleGlobalTimer, 1000);
}

// --- 힌트: 오답 2개 제거, 게임당 3회 ---
function updateHintButton() {
    hintBtn.textContent = `💡 힌트: 오답 2개 제거 (남은 횟수 ${hintsLeft}/${HINTS_PER_GAME})`;
    hintBtn.disabled = hintsLeft <= 0 || hintUsedThisQuestion || questionAnswered;
}

function useHint() {
    if (hintsLeft <= 0 || hintUsedThisQuestion || questionAnswered || isPaused) return;
    playSound('hint');
    const currentQ = currentQuizSet[currentQuestionIndex];
    const allButtons = [...optionsContainer.querySelectorAll('.option-btn')];
    const wrongIndexes = allButtons
        .map((_, i) => i)
        .filter(i => i !== currentQ.correctAnswer && !allButtons[i].disabled);

    shuffle(wrongIndexes).slice(0, 2).forEach(i => {
        allButtons[i].disabled = true;
        allButtons[i].classList.add('eliminated');
    });

    hintsLeft--;
    hintUsedThisQuestion = true;
    updateHintButton();
}

function checkAnswer(selectedIndex, selectedButton) {
    if (questionAnswered || isPaused || isGameOver) return;

    const responseMs = selectedIndex === -1 ? SPEED_TIME_LIMIT * 1000 : getElapsedMs();
    lastResponseMs = responseMs;
    questionAnswered = true;
    clearInterval(elapsedTicker);
    updateElapsedDisplay();
    if (currentMode === 'speed') clearInterval(timer);

    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);
    updateHintButton();

    const currentQ = currentQuizSet[currentQuestionIndex];
    const isCorrect = (selectedIndex === currentQ.correctAnswer);

    // 결과 분석용 통계 기록
    answeredCount++;
    totalResponseMs += responseMs;
    if (!categoryStats[currentQ.category]) categoryStats[currentQ.category] = { correct: 0, total: 0 };
    categoryStats[currentQ.category].total++;

    if (isCorrect) {
        playSound('correct');
        triggerConfetti();
        if (selectedButton) selectedButton.classList.add('correct');

        correctCount++;
        categoryStats[currentQ.category].correct++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);

        let points = BASE_POINTS;
        const breakdown = [`기본 +${BASE_POINTS}`];
        if (responseMs < FAST_LIMIT_MS) {
            points += FAST_BONUS;
            breakdown.push(`10초 내 정답 +${FAST_BONUS}`);
        }
        if (!hintUsedThisQuestion) {
            points += NO_HINT_BONUS;
            breakdown.push(`힌트 미사용 +${NO_HINT_BONUS}`);
        }
        if (combo >= 2) {
            points += COMBO_BONUS;
            breakdown.push(`${combo}연속 콤보 +${COMBO_BONUS}`);
            comboText.textContent = `🔥 ${combo}연속 정답! (+${COMBO_BONUS}점)`;
            comboText.classList.remove('hidden');
        }

        score += points;
        feedbackTitle.textContent = `✅ 정답입니다! (+${points}점)`;
        feedbackTitle.style.color = "var(--good)";
        feedbackPoints.textContent = `${breakdown.join(' · ')}  |  응답 ${(responseMs / 1000).toFixed(1)}초`;
        feedbackPoints.classList.remove('hidden');
    } else {
        playSound('wrong');
        mainCard.classList.add('shake');
        setTimeout(() => mainCard.classList.remove('shake'), 400);

        if (selectedButton) selectedButton.classList.add('wrong');
        allButtons[currentQ.correctAnswer].classList.add('correct');
        combo = 0;
        comboText.classList.add('hidden');
        feedbackPoints.classList.add('hidden');

        if (selectedIndex === -1) {
            feedbackTitle.textContent = "⏰ 시간 초과!";
        } else {
            feedbackTitle.textContent = "❌ 틀렸습니다";
        }
        feedbackTitle.style.color = "var(--danger)";

        if (currentMode === 'survival') {
            lives--;
            lifeText.textContent = `❤️ 목숨: ${lives}`;
            setTimeout(() => {
                showResult(false, true);
            }, 1200);
            return;
        }
    }

    scoreText.textContent = `점수: ${score}`;
    feedbackDesc.textContent = currentQ.explanation;
    feedbackContainer.classList.remove('hidden');
    nextBtn.focus(); // 키보드 사용자는 바로 Enter로 다음 문제
}

function loadNextQuestion() {
    if (isPaused) return;
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizSet.length) {
        loadQuestion();
    } else {
        showResult();
    }
}

function showResult(timeOut = false, isSurvivalGameOver = false) {
    if (isGameOver) return;
    isGameOver = true;
    isPaused = false;
    clearInterval(timer);
    clearInterval(elapsedTicker);
    pauseOverlay.classList.add('hidden');
    quizScreen.classList.remove('active');
    resultScreen.classList.add('active');

    const isNewRecord = saveHighScore(score);
    const newRecordMsg = document.getElementById('new-record-msg');
    const personalRecordMsg = document.getElementById('personal-record-msg');

    // 게임 결과를 기록에 저장 (한 문제도 풀지 않은 게임은 저장하지 않음)
    const profile = getCurrentProfile();
    const previousBest = getPersonalBest(profile.id);
    if (answeredCount > 0) saveGameRecord(buildGameRecord(profile));
    personalRecordMsg.classList.toggle('hidden', !(answeredCount > 0 && score > previousBest));

    if (isNewRecord && score > 0) {
        newRecordMsg.classList.remove('hidden');
        triggerConfetti();
    } else {
        newRecordMsg.classList.add('hidden');
    }

    const resultTitle = document.getElementById('result-title');
    if (isSurvivalGameOver) {
        resultTitle.textContent = "💀 게임 오버!";
    } else if (timeOut) {
        resultTitle.textContent = "⏱️ 시간 종료!";
    } else {
        resultTitle.textContent = "🏆 퀴즈 완료!";
    }

    document.getElementById('final-score').textContent = `${score}점`;
    document.getElementById('final-stats').textContent =
        `정답 ${correctCount}개 / 푼 문제 ${answeredCount}개 (출제 ${currentQuizSet.length}문제)`;
    renderAnalysis();
    document.getElementById('share-status').textContent = '';
    if (typeof refreshProfileUI === 'function') refreshProfileUI();
}

function buildGameRecord(profile) {
    return {
        id: makeId(),
        profileId: profile.id,
        name: profile.name,
        avatar: profile.avatar,
        mode: currentMode,
        category: selectedCategory,
        score,
        correct: correctCount,
        answered: answeredCount,
        total: currentQuizSet.length,
        accuracy: answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0,
        avgResponseMs: answeredCount ? Math.round(totalResponseMs / answeredCount) : 0,
        maxCombo,
        categoryStats: JSON.parse(JSON.stringify(categoryStats)),
        playedAt: new Date().toISOString()
    };
}

// --- 결과 클립보드 공유 ---
function buildShareText() {
    const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
    const avg = answeredCount ? (totalResponseMs / answeredCount / 1000).toFixed(1) : '-';
    const modeName = MODE_LABELS[currentMode] + (selectedCategory ? `(${selectedCategory})` : '');
    const categoryLines = getCategories()
        .filter(c => categoryStats[c])
        .map(c => `- ${c}: ${categoryStats[c].correct}/${categoryStats[c].total}`);
    return [
        `👑 지식왕 도전 — ${modeName}`,
        `🏆 총점 ${score}점 | 정답률 ${accuracy}% (${correctCount}/${answeredCount})`,
        `⏱ 평균 ${avg}초 | 🔥 최장 ${maxCombo}연속`,
        ...categoryLines
    ].join('\n');
}

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // file:// 등 Clipboard API를 쓸 수 없는 환경용 대체 방법
    return new Promise((resolve, reject) => {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        ok ? resolve() : reject(new Error('copy failed'));
    });
}

function shareResult() {
    const status = document.getElementById('share-status');
    copyText(buildShareText())
        .then(() => { status.textContent = '✅ 결과를 클립보드에 복사했습니다.'; })
        .catch(() => { status.textContent = '⚠️ 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.'; });
}

// --- 결과 분석: 정답률, 평균 응답 시간, 최장 연속 정답, 카테고리별 정답 수 ---
function renderAnalysis() {
    const accuracy = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
    const avgResponse = answeredCount ? `${(totalResponseMs / answeredCount / 1000).toFixed(1)}초` : '-';

    const statGrid = document.getElementById('stat-grid');
    statGrid.innerHTML = '';
    [
        ['정답률', `${accuracy}%`],
        ['평균 응답 시간', avgResponse],
        ['최장 연속 정답', `${maxCombo}회`]
    ].forEach(([label, value]) => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        const valueEl = document.createElement('strong');
        valueEl.textContent = value;
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        card.append(valueEl, labelEl);
        statGrid.appendChild(card);
    });

    const categoryList = document.getElementById('category-result');
    categoryList.innerHTML = '';
    const categories = getCategories().filter(c => categoryStats[c]);
    if (categories.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'category-empty';
        empty.textContent = '푼 문제가 없습니다.';
        categoryList.appendChild(empty);
        return;
    }

    categories.forEach(category => {
        const { correct, total } = categoryStats[category];
        const row = document.createElement('div');
        row.className = 'category-row';

        const name = document.createElement('span');
        name.className = 'category-name';
        name.textContent = category;

        const bar = document.createElement('div');
        bar.className = 'category-bar';
        const fill = document.createElement('div');
        fill.className = 'category-bar-fill';
        fill.style.width = `${(correct / total) * 100}%`;
        bar.appendChild(fill);

        const count = document.createElement('span');
        count.className = 'category-count';
        count.textContent = `${correct} / ${total}`;

        row.append(name, bar, count);
        categoryList.appendChild(row);
    });
}

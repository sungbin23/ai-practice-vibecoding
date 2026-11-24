// 작성일: 2026-11-25 02:38
// quiz-records.js — localStorage 기반 프로필·게임 기록·리더보드·통계 계산 (DOM을 다루지 않음)
// quiz-game.js보다 먼저 로드되어야 합니다.

const STORAGE_KEYS = {
    records: 'knowledge_king_records',               // 게임 결과 기록 배열
    profiles: 'knowledge_king_profiles',             // 프로필 배열
    currentProfile: 'knowledge_king_current_profile', // 현재 프로필 id
    theme: 'knowledge_king_theme'                    // 'light' | 'dark'
};
const MAX_RECORDS = 500;          // 오래된 기록부터 지워 저장 용량을 제한
const LEADERBOARD_SIZE = 10;
const PROFILE_NAME_MAX = 12;
const AVATARS = ['🦊', '🐯', '🐼', '🐧', '🦉', '🐬', '🦄', '🐢'];
const MODE_LABELS = {
    normal: '전체 도전',
    category: '카테고리별',
    speed: '스피드',
    survival: '서바이벌',
    timeattack: '60초 타임어택'
};

function readJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value === null || value === undefined ? fallback : value;
    } catch (e) {
        return fallback;
    }
}

function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// --- 프로필 ---
function sanitizeProfileName(name) {
    const trimmed = String(name || '').trim().slice(0, PROFILE_NAME_MAX);
    return trimmed || '플레이어';
}

function getProfiles() {
    return readJSON(STORAGE_KEYS.profiles, []);
}

function createProfile(name, avatar) {
    const profile = {
        id: makeId(),
        name: sanitizeProfileName(name),
        avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
        createdAt: new Date().toISOString()
    };
    const profiles = getProfiles();
    profiles.push(profile);
    writeJSON(STORAGE_KEYS.profiles, profiles);
    localStorage.setItem(STORAGE_KEYS.currentProfile, profile.id);
    return profile;
}

function getCurrentProfile() {
    const profiles = getProfiles();
    const currentId = localStorage.getItem(STORAGE_KEYS.currentProfile);
    const found = profiles.find(p => p.id === currentId) || profiles[0];
    if (found) {
        localStorage.setItem(STORAGE_KEYS.currentProfile, found.id);
        return found;
    }
    return createProfile('플레이어', AVATARS[0]);
}

function updateProfile(id, changes) {
    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === id);
    if (!profile) return null;
    if ('name' in changes) profile.name = sanitizeProfileName(changes.name);
    if ('avatar' in changes && AVATARS.includes(changes.avatar)) profile.avatar = changes.avatar;
    writeJSON(STORAGE_KEYS.profiles, profiles);
    return profile;
}

function switchProfile(id) {
    if (getProfiles().some(p => p.id === id)) localStorage.setItem(STORAGE_KEYS.currentProfile, id);
    return getCurrentProfile();
}

// --- 게임 기록 ---
function getRecords() {
    return readJSON(STORAGE_KEYS.records, []);
}

function saveGameRecord(record) {
    const records = getRecords();
    records.push(record);
    if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
    writeJSON(STORAGE_KEYS.records, records);
}

function getProfileRecords(profileId) {
    return getRecords()
        .filter(r => r.profileId === profileId)
        .sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));
}

function getPersonalBest(profileId) {
    return getProfileRecords(profileId).reduce((best, r) => Math.max(best, r.score), 0);
}

// --- 리더보드 ---
function startOfToday(now) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(now) {
    const today = startOfToday(now);
    const daysSinceMonday = (today.getDay() + 6) % 7; // 월요일 시작
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday);
}

// period: 'daily'(오늘) | 'weekly'(이번 주, 월요일부터) | 'all' | 'category'(전체 기간, 카테고리별 도전 기록만)
// 한 프로필에서는 최고 기록 1개만 남겨 상위 10명을 보여 줍니다.
function getLeaderboard(period, category, now = new Date()) {
    let records = getRecords();
    if (period === 'daily') {
        const from = startOfToday(now);
        records = records.filter(r => new Date(r.playedAt) >= from);
    } else if (period === 'weekly') {
        const from = startOfWeek(now);
        records = records.filter(r => new Date(r.playedAt) >= from);
    } else if (period === 'category') {
        records = records.filter(r => r.mode === 'category' && r.category === category);
    }

    const bestByProfile = new Map();
    records.forEach(r => {
        const prev = bestByProfile.get(r.profileId);
        if (!prev || r.score > prev.score || (r.score === prev.score && r.playedAt < prev.playedAt)) {
            bestByProfile.set(r.profileId, r);
        }
    });

    // 이름·아바타는 프로필을 수정했으면 최신 값으로 표시
    const profiles = new Map(getProfiles().map(p => [p.id, p]));
    return [...bestByProfile.values()]
        .sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || (a.playedAt < b.playedAt ? -1 : 1))
        .slice(0, LEADERBOARD_SIZE)
        .map(r => {
            const p = profiles.get(r.profileId);
            return { ...r, name: p ? p.name : r.name, avatar: p ? p.avatar : r.avatar };
        });
}

// --- 통계 ---
function getProfileStats(profileId) {
    const records = getProfileRecords(profileId);
    const modeCounts = {};
    const categoryTotals = {};
    let correct = 0;
    let answered = 0;
    let scoreSum = 0;

    records.forEach(r => {
        modeCounts[r.mode] = (modeCounts[r.mode] || 0) + 1;
        correct += r.correct;
        answered += r.answered;
        scoreSum += r.score;
        Object.entries(r.categoryStats || {}).forEach(([cat, s]) => {
            if (!categoryTotals[cat]) categoryTotals[cat] = { correct: 0, total: 0 };
            categoryTotals[cat].correct += s.correct;
            categoryTotals[cat].total += s.total;
        });
    });

    return {
        playCount: records.length,
        modeCounts,
        categoryTotals,
        bestScore: records.reduce((best, r) => Math.max(best, r.score), 0),
        averageScore: records.length ? Math.round(scoreSum / records.length) : 0,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0,
        timeline: records.slice(-30) // 최근 30게임
    };
}

function formatDateTime(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

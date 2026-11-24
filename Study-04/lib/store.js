// 작성일: 2026-11-25 03:11 (수정됨) 2026-11-25 03:52
// 3단계: 사용자·세션·저장 레시피. JSON 파일(data/users.json, data/saved_recipes.json)에 보관한다.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 10 * 60 * 1000; // 만료 세션·로그인 실패 기록 정리 간격
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 60 * 1000;
const USERS_SAVE_DELAY_MS = 1000; // 활동 횟수는 1초 모아서 한 번에 기록
const RENAME_RETRIES = 5;

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64)).toString('hex');
}

// 아이디는 대소문자 구분 없이 소문자로 통일한다(가입·로그인 모두).
const normUsername = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v);

// 사용자에게 그대로 보여 줄 수 있는 저장 실패 오류
function storageError(cause) {
  console.error('[저장소] 쓰기 실패:', cause.message);
  return Object.assign(new Error('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'), { status: 500, expose: true });
}

// Windows 에서 백신·인덱서가 파일을 잡고 있으면 rename 이 EPERM/EBUSY 로 잠깐 실패한다.
const isBusy = (err) => err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES');
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function renameSyncRetry(from, to) {
  for (let i = 0; ; i++) {
    try {
      return fs.renameSync(from, to);
    } catch (err) {
      if (!isBusy(err) || i >= RENAME_RETRIES) throw err;
      sleepSync(20 * (i + 1));
    }
  }
}

function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const usersFile = path.join(dataDir, 'users.json');
  const recipesFile = path.join(dataDir, 'saved_recipes.json');
  const sessions = new Map(); // token -> { userId, expires }
  const loginFails = new Map(); // username -> { count, until, last }
  let lastSweep = Date.now();
  let tmpSeq = 0;

  // 파일이 없으면 빈 목록으로 시작. 깨져 있으면 원본을 .corrupt-<시각> 으로 옮겨 두고 빈 목록으로 시작한다
  // (덮어써서 데이터를 잃지 않게). 그 밖의 읽기 오류는 그대로 던져 서버가 잘못된 상태로 뜨지 않게 한다.
  function readList(file, key) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    try {
      const list = JSON.parse(text)?.[key];
      if (Array.isArray(list)) return list;
      throw new Error(`"${key}" 배열이 없음`);
    } catch (err) {
      const backup = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.renameSync(file, backup);
      console.warn(`[저장소] ${path.basename(file)} 이(가) 깨져 있어 ${path.basename(backup)} 로 옮기고 빈 목록으로 시작합니다: ${err.message}`);
      return [];
    }
  }

  const tmpName = (file) => `${file}.${process.pid}.${++tmpSeq}.tmp`;

  // 임시 파일에 쓴 뒤 이름을 바꿔 중간에 꺼져도 파일이 깨지지 않게 한다.
  // 들여쓰기 없이 기록(파일 크기·기록 시간 감소, 읽는 쪽은 JSON.parse 라 동일).
  function writeSync(file, data) {
    const tmp = tmpName(file);
    try {
      fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
      renameSyncRetry(tmp, file);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* 임시 파일이 없을 수 있음 */ }
      throw err;
    }
  }

  let users = readList(usersFile, 'users');
  const saved = readList(recipesFile, 'recipes');

  // ----- users.json 기록: 즉시(가입) 또는 1초 디바운스(활동 횟수) -----
  let usersVersion = 0; // 메모리 변경 번호
  let usersWritten = 0; // 파일에 반영된 마지막 변경 번호
  let usersTimer = null;
  let closed = false;

  function saveUsersNow() {
    const version = usersVersion;
    writeSync(usersFile, { users });
    usersWritten = Math.max(usersWritten, version);
    if (usersWritten >= usersVersion && usersTimer) { clearTimeout(usersTimer); usersTimer = null; }
  }

  function scheduleUsersSave() {
    if (usersTimer || closed) return;
    usersTimer = setTimeout(async () => {
      usersTimer = null;
      const version = usersVersion;
      if (version <= usersWritten) return;
      const tmp = tmpName(usersFile);
      try {
        await fs.promises.writeFile(tmp, JSON.stringify({ users }), 'utf8');
        // 기다리는 동안 더 새 내용이 동기로 기록됐으면 이 (낡은) 내용은 버린다.
        if (version <= usersWritten || closed) return fs.promises.unlink(tmp).catch(() => {});
        renameSyncRetry(tmp, usersFile);
        usersWritten = version;
      } catch (err) {
        fs.promises.unlink(tmp).catch(() => {});
        if (!closed) {
          console.error('[저장소] users.json 기록 실패(다음에 다시 시도):', err.message);
          scheduleUsersSave();
        }
      }
    }, USERS_SAVE_DELAY_MS);
    usersTimer.unref?.();
  }

  // 서버 종료·테스트 정리 때 미뤄 둔 기록을 바로 끝낸다.
  function flush() {
    if (usersTimer) { clearTimeout(usersTimer); usersTimer = null; }
    if (usersVersion > usersWritten) {
      try { saveUsersNow(); } catch (err) { console.error('[저장소] users.json 마무리 기록 실패:', err.message); }
    }
  }
  function close() {
    flush();
    closed = true;
  }

  const saveRecipes = () => writeSync(recipesFile, { recipes: saved });

  const publicUser = (u) => ({ id: u.id, username: u.username, nickname: u.nickname, createdAt: u.createdAt });

  // ----- 정리(만료 세션, 지난 로그인 실패 기록) -----
  function sweep(now = Date.now()) {
    if (now - lastSweep < SWEEP_EVERY_MS) return;
    lastSweep = now;
    for (const [token, s] of sessions) if (s.expires < now) sessions.delete(token);
    for (const [name, f] of loginFails) if (f.until < now && now - f.last > LOGIN_LOCK_MS) loginFails.delete(name);
  }

  // ----- 회원 -----
  function validateSignup({ username, password, nickname }) {
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) return '아이디는 영문 소문자·숫자·_ 3~20자로 만들어 주세요.';
    if (typeof password !== 'string' || password.length < 4 || password.length > 100) return '비밀번호는 4~100자로 입력해 주세요.';
    const nick = typeof nickname === 'string' ? nickname.trim() : '';
    if (nick.length < 1 || nick.length > 20) return '닉네임은 1~20자로 입력해 주세요.';
    return null;
  }

  async function register(body) {
    const username = normUsername(body?.username);
    const { password, nickname } = body || {};
    const problem = validateSignup({ username, password, nickname });
    if (problem) return { error: problem, status: 400 };
    if (users.some((u) => u.username === username)) return { error: '이미 쓰고 있는 아이디예요.', status: 409 };
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashPassword(password, salt);
    // 해시를 계산하는 동안 같은 아이디가 먼저 가입했을 수 있다.
    if (users.some((u) => u.username === username)) return { error: '이미 쓰고 있는 아이디예요.', status: 409 };
    const user = {
      id: crypto.randomUUID(),
      username,
      nickname: nickname.trim(),
      salt,
      hash,
      createdAt: new Date().toISOString(),
      stats: { recognitions: 0, generations: 0 },
    };
    users.push(user);
    usersVersion++;
    try {
      saveUsersNow();
    } catch (err) {
      users = users.filter((u) => u !== user); // 메모리 롤백
      throw storageError(err);
    }
    return { user: publicUser(user) };
  }

  async function login(body) {
    const username = normUsername(body?.username);
    const key = typeof username === 'string' ? username : '';
    const now = Date.now();
    const fail = loginFails.get(key);
    if (fail && fail.until > now) {
      return { error: '로그인을 너무 많이 실패했어요. 1분 뒤 다시 시도해 주세요.', status: 429 };
    }
    const user = users.find((u) => u.username === username);
    // 사용자가 없어도 해시를 계산해 응답 시간으로 아이디 존재 여부를 알 수 없게 한다.
    const expected = Buffer.from(user ? user.hash : '0'.repeat(128), 'hex');
    // 100자 넘는 비밀번호는 가입할 수 없으므로 거대한 입력을 해시하지 않고 빈 값으로 비교(항상 실패)한다.
    const pw = String(body?.password ?? '');
    const actual = Buffer.from(await hashPassword(pw.length > 100 ? '' : pw, user ? user.salt : 'no-user'), 'hex');
    if (!user || !crypto.timingSafeEqual(expected, actual)) {
      const f = loginFails.get(key) || { count: 0, until: 0, last: 0 };
      f.count = f.until && f.until <= now ? 1 : f.count + 1; // 잠금이 풀린 뒤에는 다시 1부터
      f.until = f.count >= LOGIN_MAX_FAILS ? now + LOGIN_LOCK_MS : 0;
      if (f.until) f.count = 0;
      f.last = now;
      loginFails.set(key, f);
      return { error: '아이디 또는 비밀번호가 맞지 않아요.', status: 401 };
    }
    loginFails.delete(key);
    return { user: publicUser(user) };
  }

  // ----- 세션 -----
  function createSession(userId) {
    sweep();
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId, expires: Date.now() + SESSION_TTL_MS });
    return token;
  }
  function getSessionUser(token) {
    const s = token && sessions.get(token);
    if (!s) return null;
    if (s.expires < Date.now()) {
      sessions.delete(token);
      return null;
    }
    const user = users.find((u) => u.id === s.userId);
    return user ? publicUser(user) : null;
  }
  const destroySession = (token) => sessions.delete(token);

  // ----- 활동 기록 (파일 기록은 1초 디바운스) -----
  function countActivity(userId, kind) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    user.stats = user.stats || {};
    user.stats[kind] = (user.stats[kind] || 0) + 1;
    usersVersion++;
    scheduleUsersSave();
  }

  // ----- 저장 레시피 -----
  const listRecipes = (userId) =>
    saved.filter((r) => r.userId === userId).sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  function addRecipe(userId, recipe) {
    if (saved.some((r) => r.userId === userId && r.recipe.title === recipe.title)) {
      return { error: '이미 저장한 레시피예요.', status: 409 };
    }
    const entry = { id: crypto.randomUUID(), userId, savedAt: new Date().toISOString(), recipe };
    saved.push(entry);
    try {
      saveRecipes();
    } catch (err) {
      saved.pop(); // 메모리 롤백
      throw storageError(err);
    }
    return { entry };
  }

  function deleteRecipe(userId, id) {
    const idx = saved.findIndex((r) => r.id === id && r.userId === userId); // 남의 레시피는 못 찾음
    if (idx < 0) return false;
    const [removed] = saved.splice(idx, 1);
    try {
      saveRecipes();
    } catch (err) {
      saved.splice(idx, 0, removed); // 메모리 롤백
      throw storageError(err);
    }
    return true;
  }

  function dashboard(userId) {
    const user = users.find((u) => u.id === userId);
    const mine = listRecipes(userId);
    const count = (list) => list.reduce((acc, k) => ((acc[k] = (acc[k] || 0) + 1), acc), {});
    const ingredientCounts = count(mine.flatMap((r) => r.recipe.ingredients.filter((i) => !i.pantry).map((i) => i.name)));
    const topIngredients = Object.entries(ingredientCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
      .slice(0, 5)
      .map(([name, n]) => ({ name, count: n }));
    const totalTime = mine.reduce((sum, r) => sum + r.recipe.timeMinutes, 0);
    return {
      savedCount: mine.length,
      recognitions: user?.stats?.recognitions || 0,
      generations: user?.stats?.generations || 0,
      avgTimeMinutes: mine.length ? Math.round(totalTime / mine.length) : 0,
      byCuisine: count(mine.map((r) => r.recipe.cuisine)),
      byDifficulty: count(mine.map((r) => r.recipe.difficulty)),
      topIngredients,
    };
  }

  return {
    register, login, createSession, getSessionUser, destroySession,
    countActivity, listRecipes, addRecipe, deleteRecipe, dashboard,
    flush, close,
    _internals: { sessions, loginFails, sweep },
  };
}

module.exports = { createStore, LOGIN_MAX_FAILS };

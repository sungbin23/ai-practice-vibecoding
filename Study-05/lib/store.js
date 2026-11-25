// 작성일: 2026-11-25 17:45 (수정됨) 2026-11-25 18:10
// data/diary.json 저장소. 임시 파일 -> rename 으로 쓰고, 쓰기는 한 줄로 직렬화한다.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isValidEntry = (e) => isObject(e) && typeof e.id === 'string' && e.id !== '' && typeof e.text === 'string'
  && typeof e.createdAt === 'string' && !Number.isNaN(Date.parse(e.createdAt)) && isObject(e.analysis);

// 읽을 수 없는 파일은 지우지 않고 diary.json.corrupt-<시각> 으로 옮겨 두어, 다음 쓰기가 덮어쓰지 못하게 한다.
function backupCorrupt(file, reason) {
  const backup = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try {
    fs.renameSync(file, backup);
    console.warn(`[경고] 일기 파일을 읽을 수 없어요(${reason}). 원본을 ${path.basename(backup)} 로 옮겨 두고 새로 시작합니다.`);
  } catch (err) {
    console.warn(`[경고] 일기 파일이 손상됐지만 백업에 실패했어요: ${err.message}`);
  }
}

function loadEntries(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return []; // 처음 실행: 정상
    throw err; // 권한 등 다른 오류는 숨기지 않는다
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    backupCorrupt(file, 'JSON 파싱 실패');
    return [];
  }
  const arr = Array.isArray(parsed?.entries) ? parsed.entries : Array.isArray(parsed) ? parsed : null;
  if (!arr) {
    backupCorrupt(file, '형식 오류');
    return [];
  }
  const valid = arr.filter(isValidEntry);
  if (valid.length !== arr.length) {
    // 일부 항목만 이상하면 항목을 제외하되, 원본은 복사해 보관한다.
    const copy = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try { fs.copyFileSync(file, copy); } catch { /* 보관 실패는 무시 */ }
    console.warn(`[경고] 일기 ${arr.length - valid.length}건이 형식 오류로 제외됐어요. 원본은 ${path.basename(copy)} 에 보관했어요.`);
  }
  // 안정 정렬(같은 시각이면 파일 순서 유지)
  return valid
    .map((e, i) => [e, i, Date.parse(e.createdAt)])
    .sort((a, b) => a[2] - b[2] || a[1] - b[1])
    .map((x) => x[0]);
}

function createStore(dataDir) {
  const file = path.join(dataDir, 'diary.json');
  let entries = loadEntries(file);

  let queue = Promise.resolve();
  let lastMs = entries.length ? Date.parse(entries[entries.length - 1].createdAt) || 0 : 0;

  async function persist(next) {
    await fs.promises.mkdir(dataDir, { recursive: true });
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify({ entries: next }, null, 2), 'utf8');
    await fs.promises.rename(tmp, file);
  }

  // fn 을 이전 작업 뒤에 실행한다(앞 작업이 실패해도 다음은 진행).
  function serial(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  }

  return {
    list: () => entries.map((e) => ({ ...e })),
    add: (partial) => serial(async () => {
      // 같은 밀리초여도 createdAt 이 항상 증가하도록 보정 -> 삽입 순서 = 시간 순서
      const ms = Math.max(Date.now(), lastMs + 1);
      const entry = { id: crypto.randomUUID(), ...partial, createdAt: new Date(ms).toISOString() };
      const next = [...entries, entry];
      await persist(next); // 저장 실패 시 메모리도 바뀌지 않는다
      entries = next;
      lastMs = ms;
      return entry;
    }),
    remove: (id) => serial(async () => {
      if (!entries.some((e) => e.id === id)) return false;
      const next = entries.filter((e) => e.id !== id);
      await persist(next);
      entries = next;
      return true;
    }),
  };
}

module.exports = { createStore };

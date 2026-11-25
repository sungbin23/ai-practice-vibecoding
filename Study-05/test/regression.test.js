// 작성일: 2026-11-25 18:10 (수정됨) 2026-11-25 18:50
// QA 회귀 테스트: 데모 감정 오탐/부정문/키워드, 저장소 손상 처리, 헤더, listen 오류.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { demoAnalysis, pickKeywords } = require('../lib/analyze');
const { createStore } = require('../lib/store');
const { createApp } = require('../server');

const tmpDirs = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'diary-reg-')); tmpDirs.push(d); return d; };
after(() => { for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true }); });
const quiet = (fn) => {
  const orig = console.warn;
  const logs = [];
  console.warn = (...a) => logs.push(a.join(' '));
  try { return [fn(), logs]; } finally { console.warn = orig; }
};

test('M1: 부분 문자열 오탐 없음', () => {
  assert.notEqual(demoAnalysis('그리고 나서 집에 갔다').emotion, '슬픔');
  assert.notEqual(demoAnalysis('잠깐 쉬었다').emotion, '피곤');
  assert.equal(demoAnalysis('그 사람이 그리워서 울었다').emotion, '슬픔');
  assert.equal(demoAnalysis('걱정돼서 잠이 안 온다').emotion, '불안');
  assert.equal(demoAnalysis('졸려서 죽겠다').emotion, '피곤');
});

test('M2: 부정문은 해당 감정으로 세지 않음', () => {
  assert.notEqual(demoAnalysis('나는 행복하지 않다').emotion, '기쁨');
  assert.notEqual(demoAnalysis('화나지 않았다').emotion, '분노');
  assert.notEqual(demoAnalysis('하나도 기쁘지 않았다').emotion, '기쁨');
  assert.equal(demoAnalysis('나는 행복하지 않다').emotion, '슬픔');
  assert.equal(demoAnalysis('오늘은 행복했다').emotion, '기쁨');
});

test('L10: 데모 키워드는 불용어 제외, 조사 제거', () => {
  const k = pickKeywords('오늘 너무 친구랑 케이크를 먹었다');
  assert.ok(!k.includes('오늘') && !k.includes('너무'));
  assert.ok(k.includes('케이크'));
  assert.ok(!k.some((w) => w.endsWith('를')));
  assert.ok(demoAnalysis('오늘 너무 기뻐').keywords.every((w) => w !== '오늘' && w !== '너무'));
});

test('M3: 손상된 diary.json 은 .corrupt 로 백업되고 덮어쓰이지 않음', async () => {
  const dir = tmp();
  const file = path.join(dir, 'diary.json');
  fs.writeFileSync(file, '{깨진 json');
  const [store, logs] = quiet(() => createStore(dir));
  assert.deepEqual(store.list(), []);
  assert.ok(logs.some((l) => l.includes('경고')));
  const backups = fs.readdirSync(dir).filter((f) => f.startsWith('diary.json.corrupt-'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, backups[0]), 'utf8'), '{깨진 json');
  await store.add({ text: '새 일기', demo: true, analysis: {} });
  assert.equal(fs.readFileSync(path.join(dir, backups[0]), 'utf8'), '{깨진 json');
  // 형식 오류(객체이지만 entries 없음)도 동일
  const dir2 = tmp();
  fs.writeFileSync(path.join(dir2, 'diary.json'), '{"foo":1}');
  quiet(() => createStore(dir2));
  assert.equal(fs.readdirSync(dir2).filter((f) => f.includes('corrupt')).length, 1);
  // 파일 없음(ENOENT)은 정상: 경고·백업 없음
  const dir3 = tmp();
  const [, logs3] = quiet(() => createStore(dir3));
  assert.equal(logs3.length, 0);
  assert.deepEqual(fs.readdirSync(dir3), []);
});

test('L8: 형식이 잘못된 항목은 제외하고 원본은 보관', () => {
  const dir = tmp();
  const ok = { id: 'a', text: '정상', createdAt: '2026-01-02T00:00:00.000Z', demo: true, analysis: { emotion: '기쁨' } };
  const early = { ...ok, id: 'b', createdAt: '2026-01-01T00:00:00.000Z' };
  const bad = [
    { id: 'c', createdAt: '2026-01-01T00:00:00.000Z', analysis: {} },
    { id: 'd', text: 'x', createdAt: 'not-a-date', analysis: {} },
    { id: 'e', text: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
    null, 5,
  ];
  fs.writeFileSync(path.join(dir, 'diary.json'), JSON.stringify({ entries: [ok, ...bad, early] }));
  const [store] = quiet(() => createStore(dir));
  assert.deepEqual(store.list().map((e) => e.id), ['b', 'a']);
  assert.equal(fs.readdirSync(dir).filter((f) => f.includes('corrupt')).length, 1);
});

test('L6: 응답에 X-Content-Type-Options: nosniff', async () => {
  const dir = tmp();
  const { server } = createApp({ demo: true, model: 'm', dataDir: dir });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const p of ['/api/status', '/api/entries', '/nope', '/']) {
      const res = await fetch(base + p);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', p);
      await res.arrayBuffer();
    }
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
});

test('L7: 포트 사용 중이면 한국어 안내 후 종료 코드 1', async () => {
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, r));
  try {
    const port = blocker.address().port;
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js'), '--demo'], {
      env: { ...process.env, PORT: String(port), DATA_DIR: tmp() },
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /이미 다른 프로그램이 쓰고 있어요/);
  } finally {
    await new Promise((r) => blocker.close(r));
  }
});

test('L9: .gitignore 첫 줄은 작성 날짜 주석', () => {
  const first = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8').split(/\r?\n/)[0];
  assert.match(first, /^#.*작성일/);
});

test('QA2-1: 부정 패턴 확장(-지는/도 않, 안/못 + 키워드, 없이)', () => {
  assert.equal(demoAnalysis('너무 슬프지는 않았어 그냥 그랬어').emotion, '평온');
  assert.equal(demoAnalysis('안 피곤해').emotion, '평온');
  assert.notEqual(demoAnalysis('화나지도 않았다').emotion, '분노');
  assert.equal(demoAnalysis('걱정 없이 푹 잤다').emotion, '평온');
  // 기존 정상 케이스 유지
  assert.equal(demoAnalysis('화나지 않았다').emotion, '평온');
  assert.equal(demoAnalysis('걱정돼서 잠이 안 온다').emotion, '불안');
  assert.equal(demoAnalysis('그리고 나서 집에 갔다').emotion, '복합');
});

test('QA2-2: 이중 부정은 복합', () => {
  assert.equal(demoAnalysis('행복하지 않은 건 아니야').emotion, '복합');
});

test('QA2-3: 대조(A지만 B)는 뒤쪽 감정 우선', () => {
  assert.equal(demoAnalysis('피곤하지만 뿌듯했다').emotion, '기쁨');
  assert.equal(demoAnalysis('기뻤지만 결국 눈물이 났다').emotion, '슬픔');
});

test('QA2-4: 키워드에서 부정·접속 어미 제거', () => {
  const k = demoAnalysis('피곤하지만 뿌듯했다').keywords;
  assert.ok(k.includes('피곤'));
  assert.ok(!k.some((w) => /지만$|지는$|^않|^아니/.test(w)));
  for (const t of ['화나지 않았다', '행복하지 않은 건 아니야', '너무 슬프지는 않았어']) {
    assert.ok(!demoAnalysis(t).keywords.some((w) => /지$|지는$|^않|^아니|^아냐/.test(w)), t);
  }
});

test('QA3: 상황 단서(시험·야근 등)보다 감정 단어가 우선', () => {
  assert.equal(demoAnalysis('오늘 시험에 합격해서 너무 기뻤다').emotion, '기쁨');
  assert.equal(demoAnalysis('면접 망쳐서 속상해').emotion, '슬픔');
  assert.equal(demoAnalysis('시험이 내일이라 걱정돼').emotion, '불안');
  assert.equal(demoAnalysis('야근했다').emotion, '피곤'); // 단서만 있으면 단서 감정
});

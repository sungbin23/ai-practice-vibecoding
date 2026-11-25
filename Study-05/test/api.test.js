// 작성일: 2026-11-25 17:45
// API 테스트: 데모/실제(가짜 chat 주입) 모드. 임시 dataDir, 포트 0. 실제 외부 호출 없음.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../server');
const { ApiError } = require('../lib/openrouter');

const cleanups = [];
after(async () => {
  for (const fn of cleanups) await fn();
});

async function start(configOverrides = {}, deps = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diary-test-'));
  const config = { apiKey: 'test-key', demo: true, model: 'test/model', dataDir, timeoutMs: 1000, ...configOverrides };
  const { server } = createApp(config, deps);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  cleanups.push(() => new Promise((r) => { server.close(r); server.closeAllConnections?.(); }).then(() => fs.rmSync(dataDir, { recursive: true, force: true })));
  const api = async (method, url, body, raw) => {
    const res = await fetch(base + url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html 등 */ }
    return { status: res.status, json, text, headers: res.headers };
  };
  return { api, dataDir, base };
}

test('상태: 데모 모드와 모델, 키는 노출되지 않음', async () => {
  const { api } = await start();
  const r = await api('GET', '/api/status');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { demo: true, model: 'test/model' });
  assert.ok(!r.text.includes('test-key'));
});

test('데모: 키워드별로 다른 감정과 메시지, 스키마 준수', async () => {
  const { api } = await start();
  const cases = [
    ['오늘 합격해서 너무 기뻐!', '기쁨'],
    ['친구랑 싸워서 정말 화가 났다', '분노'],
    ['혼자 있으니 외롭고 눈물이 났다', '슬픔'],
    ['내일 면접이라 걱정된다', '불안'],
    ['야근하느라 너무 피곤했다', '피곤'],
    ['공원에서 산책하며 여유롭게 쉬었다', '평온'],
    ['그냥 평범한 화요일', '복합'],
  ];
  const empathies = new Set();
  for (const [text, emotion] of cases) {
    const r = await api('POST', '/api/entries', { text });
    assert.equal(r.status, 201, text);
    const e = r.json.entry;
    assert.equal(e.analysis.emotion, emotion, text);
    assert.equal(e.demo, true);
    assert.equal(e.text, text);
    assert.ok(e.id && !Number.isNaN(Date.parse(e.createdAt)));
    assert.ok(Number.isInteger(e.analysis.intensity) && e.analysis.intensity >= 1 && e.analysis.intensity <= 5);
    assert.ok(e.analysis.keywords.length <= 3);
    assert.ok(e.analysis.empathy && e.analysis.comfort && e.analysis.emoji);
    empathies.add(e.analysis.empathy);
  }
  assert.ok(empathies.size >= 5);
});

test('입력 검증: 빈 값, 공백, 200자 초과, 타입, 깨진 JSON, 너무 큰 본문', async () => {
  const { api } = await start();
  for (const body of [{}, { text: '' }, { text: '   ' }, { text: 123 }, [], null]) {
    const r = await api('POST', '/api/entries', body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(typeof r.json.error, 'string');
  }
  assert.equal((await api('POST', '/api/entries', { text: 'a'.repeat(201) })).status, 400);
  assert.equal((await api('POST', '/api/entries', { text: '가'.repeat(200) })).status, 201);
  assert.equal((await api('POST', '/api/entries', { text: `  ${'a'.repeat(200)}  ` })).status, 201); // trim 후 200자
  const bad = await api('POST', '/api/entries', undefined, '{not json');
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /JSON/);
  const big = await api('POST', '/api/entries', { text: 'x'.repeat(50000) });
  assert.equal(big.status, 413);
  assert.equal(typeof big.json.error, 'string');
  const list = await api('GET', '/api/entries');
  assert.equal(list.json.entries.length, 2);
});

test('정렬: 빠르게 연속 등록해도 삽입 순서(오름차순) 유지, 재시작 후에도 유지', async () => {
  const { api, dataDir } = await start();
  const texts = Array.from({ length: 12 }, (_, i) => `일기 ${i}`);
  for (const text of texts) await api('POST', '/api/entries', { text });
  const { entries } = (await api('GET', '/api/entries')).json;
  assert.deepEqual(entries.map((e) => e.text), texts);
  const times = entries.map((e) => Date.parse(e.createdAt));
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'diary.json'), 'utf8'));
  assert.deepEqual(saved.entries.map((e) => e.text), texts);
  assert.deepEqual(fs.readdirSync(dataDir), ['diary.json']); // 임시 파일이 남지 않음
});

test('동시 요청: 모두 저장되고 쓰기가 직렬화됨', async () => {
  const { api } = await start();
  const rs = await Promise.all(Array.from({ length: 15 }, (_, i) => api('POST', '/api/entries', { text: `동시 ${i}` })));
  assert.ok(rs.every((r) => r.status === 201));
  const { entries } = (await api('GET', '/api/entries')).json;
  assert.equal(entries.length, 15);
  assert.equal(new Set(entries.map((e) => e.id)).size, 15);
  const times = entries.map((e) => e.createdAt);
  assert.deepEqual(times, [...times].sort());
});

test('삭제: 성공 후 목록에서 사라지고, 없는 id 는 404', async () => {
  const { api } = await start();
  const a = (await api('POST', '/api/entries', { text: '하나' })).json.entry;
  const b = (await api('POST', '/api/entries', { text: '둘' })).json.entry;
  const d = await api('DELETE', `/api/entries/${a.id}`);
  assert.equal(d.status, 200);
  assert.deepEqual(d.json, { ok: true });
  assert.deepEqual((await api('GET', '/api/entries')).json.entries.map((e) => e.id), [b.id]);
  const again = await api('DELETE', `/api/entries/${a.id}`);
  assert.equal(again.status, 404);
  assert.equal(typeof again.json.error, 'string');
  assert.equal((await api('DELETE', '/api/entries/%E0%A4%A')).status, 404);
});

test('정적 파일: index.html 만 제공, 그 외(.env 등)와 없는 경로는 404 JSON', async () => {
  const { api } = await start();
  for (const p of ['/', '/index.html']) {
    const r = await api('GET', p);
    assert.match(r.headers.get('content-type'), /^text\/html; charset=utf-8/);
  }
  for (const p of ['/.env', '/server.js', '/package.json', '/lib/config.js', '/nope', '/api/nope', '/../.env']) {
    const r = await api('GET', p);
    assert.equal(r.status, 404, p);
    assert.equal(typeof r.json.error, 'string');
  }
});

const GOOD = { emotion: '기쁨', emoji: '😊', intensity: 4, keywords: ['합격', '친구', '축하'], empathy: '정말 기쁘시겠어요.', comfort: '충분히 누리세요.' };

test('실제 모드: 코드블록 JSON·앞뒤 설명을 파싱하고 가짜 chat 에 키/모델 전달', async () => {
  let seen;
  const chat = async (opts) => {
    seen = opts;
    return `분석 결과입니다.\n\`\`\`json\n${JSON.stringify(GOOD)}\n\`\`\`\n도움이 되길 바라요.`;
  };
  const { api } = await start({ demo: false }, { chat });
  assert.deepEqual((await api('GET', '/api/status')).json, { demo: false, model: 'test/model' });
  const r = await api('POST', '/api/entries', { text: '합격했다' });
  assert.equal(r.status, 201);
  assert.equal(r.json.entry.demo, false);
  assert.deepEqual(r.json.entry.analysis, GOOD);
  assert.equal(seen.apiKey, 'test-key');
  assert.equal(seen.model, 'test/model');
  assert.ok(!r.text.includes('test-key'));
});

test('실제 모드: 깨진 JSON 은 기본값으로 정규화', async () => {
  const { api } = await start({ demo: false }, { chat: async () => '{"emotion": "기쁨", "intensity": ' });
  const r = await api('POST', '/api/entries', { text: '테스트' });
  assert.equal(r.status, 201);
  const a = r.json.entry.analysis;
  assert.equal(a.emotion, '복합');
  assert.equal(a.intensity, 3);
  assert.deepEqual(a.keywords, []);
  assert.ok(a.empathy && a.comfort && a.emoji);
});

test('실제 모드: 이상한 값(범위 밖 강도, 긴 배열, 잘못된 타입)을 스키마에 맞게 보정', async () => {
  const weird = { emotion: 123, emoji: '글자abc😀😀', intensity: 99, keywords: ['a', '', 'b', 'c', 'd', 5], empathy: ['배열'], comfort: '  위로\n\n한마디  ' };
  const { api } = await start({ demo: false }, { chat: async () => JSON.stringify(weird) });
  const a = (await api('POST', '/api/entries', { text: '테스트' })).json.entry.analysis;
  assert.equal(a.emotion, '복합');
  assert.equal(a.emoji, '😀');
  assert.equal(a.intensity, 5);
  assert.deepEqual(a.keywords, ['a', 'b', 'c']);
  assert.ok(a.empathy.length > 0 && typeof a.empathy === 'string');
  assert.equal(a.comfort, '위로 한마디');
  const { api: api2 } = await start({ demo: false }, { chat: async () => JSON.stringify({ ...GOOD, intensity: -3 }) });
  assert.equal((await api2('POST', '/api/entries', { text: 'x' })).json.entry.analysis.intensity, 1);
});

test('실제 모드: API 실패는 502 + 한국어 메시지, 저장 안 됨, 데모로 대체 안 함', async () => {
  const cases = [
    [new ApiError(429, 'rate'), /요청이 너무 많아요/],
    [new ApiError(401, 'bad key'), /API 키/],
    [new ApiError(504, 'timeout'), /늦어요|시간 초과/],
    [new ApiError(502, 'network: x'), /통신하지 못했어요/],
    [new Error('boom'), /통신하지 못했어요/],
  ];
  for (const [err, re] of cases) {
    const { api } = await start({ demo: false }, { chat: async () => { throw err; } });
    const r = await api('POST', '/api/entries', { text: '실패 테스트' });
    assert.equal(r.status, 502);
    assert.match(r.json.error, re);
    assert.ok(!r.text.includes('test-key'));
    assert.equal((await api('GET', '/api/entries')).json.entries.length, 0);
  }
});

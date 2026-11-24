// 작성일: 2026-11-25 03:07 (수정됨) 2026-11-25 05:10
// 1단계 테스트: 데모 모드 배너·샘플 재료, 이미지 검사, 모델 응답 해석, API 키 처리
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, TINY_PNG } = require('./helpers');
const { isUsableKey, loadConfig } = require('../lib/config');
const { extractJson } = require('../lib/openrouter');
const openrouter = require('../lib/openrouter');

test('데모 모드: 상태 API와 화면에 데모 배너가 있다', async () => {
  const app = await startServer({ demo: true });
  try {
    const status = await app.request('GET', '/api/status');
    assert.equal(status.status, 200);
    assert.equal(status.data.demo, true);
    assert.equal(status.data.demoReason, 'no-key');
    assert.ok(!('apiKey' in status.data), 'API 키는 내려보내지 않는다');

    const page = await app.request('GET', '/');
    assert.equal(page.status, 200);
    assert.match(page.data, /데모 모드: API 키 없음/);
    assert.match(page.data, /id="demo-banner"/);
  } finally {
    await app.close();
  }
});

test('데모 모드: 사진을 올리면 샘플 재료를 돌려준다', async () => {
  const app = await startServer({ demo: true });
  try {
    const res = await app.request('POST', '/api/recognize', { image: TINY_PNG });
    assert.equal(res.status, 200);
    assert.equal(res.data.demo, true);
    assert.ok(res.data.ingredients.length >= 5);
    for (const i of res.data.ingredients) assert.ok(i.name && i.quantity && i.category);
  } finally {
    await app.close();
  }
});

test('이미지 검사: 형식이 틀리거나 없으면 400', async () => {
  const app = await startServer({ demo: true });
  try {
    assert.equal((await app.request('POST', '/api/recognize', {})).status, 400);
    const gif = await app.request('POST', '/api/recognize', { image: 'data:image/gif;base64,R0lGODlh' });
    assert.equal(gif.status, 400);
    assert.match(gif.data.error, /JPG, PNG, WEBP/);
  } finally {
    await app.close();
  }
});

test('실제 모드(가짜 모델): 코드블록 JSON을 해석하고 정규화한다', async () => {
  let received;
  const chat = async (args) => {
    received = args;
    return '찾은 재료입니다.\n```json\n{"ingredients":[{"name":"달걀","quantity":"4개","category":"달걀"},{"name":" 달걀 ","quantity":"","category":"이상함"},{"name":"시금치","category":"채소"}]}\n```';
  };
  const app = await startServer({ demo: false, chat });
  try {
    const res = await app.request('POST', '/api/recognize', { image: TINY_PNG });
    assert.equal(res.status, 200);
    assert.equal(res.data.demo, false);
    assert.deepEqual(res.data.ingredients, [
      { name: '달걀', quantity: '4개', category: '달걀' },
      { name: '시금치', quantity: '알 수 없음', category: '채소' },
    ]);
    assert.equal(received.model, 'test/vision');
    assert.equal(received.messages[0].content[1].image_url.url, TINY_PNG);
  } finally {
    await app.close();
  }
});

test('실제 모드: API 오류는 데모로 바꾸지 않고 한국어 오류로 알린다', async () => {
  const chat = async () => { throw new openrouter.ApiError(429, 'rate limited'); };
  const app = await startServer({ demo: false, chat });
  try {
    const res = await app.request('POST', '/api/recognize', { image: TINY_PNG });
    assert.equal(res.status, 502);
    assert.match(res.data.error, /요청이 너무 많아요/);
  } finally {
    await app.close();
  }
});

test('API 키 판별과 JSON 추출', () => {
  assert.equal(isUsableKey(''), false);
  assert.equal(isUsableKey('   '), false);
  assert.equal(isUsableKey('your_key_here'), false);
  assert.equal(isUsableKey('sk-or-v1-abc123'), true);
  assert.deepEqual(extractJson('앞말 {"a":[1,2]} 뒷말'), { a: [1, 2] });
  assert.throws(() => extractJson('JSON 없음'));
});

test('정적 파일: 상위 폴더 접근 차단', async () => {
  const app = await startServer({ demo: true });
  try {
    const res = await app.request('GET', '/..%2F.env');
    assert.equal(res.status, 403);
  } finally {
    await app.close();
  }
});

// ----- 서버 견고성(리뷰 1~3) -----
const net = require('node:net');

// fetch 는 잘못된 주소를 고쳐 보내므로, 그대로 보내려고 소켓을 직접 쓴다.
function rawRequest(base, head) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve) => {
    const s = net.connect(Number(port), hostname);
    let data = '';
    const done = () => resolve({ status: Number((data.match(/^HTTP\/1\.1 (\d{3})/) || [])[1] || 0), text: data });
    s.setTimeout(5000, () => s.destroy());
    s.on('data', (c) => { data += c; });
    s.on('error', done);
    s.on('close', done);
    s.write(`${head}\r\nHost: x\r\nConnection: close\r\n\r\n`);
  });
}

test('잘못된 주소(%, %E0, %00, //)에도 서버가 죽지 않고 4xx로 답한다', async () => {
  const app = await startServer({ demo: true });
  try {
    assert.equal((await rawRequest(app.base, 'GET /% HTTP/1.1')).status, 400);
    assert.equal((await rawRequest(app.base, 'GET /%00 HTTP/1.1')).status, 400);
    assert.equal((await rawRequest(app.base, 'GET /a%00.js HTTP/1.1')).status, 400);
    assert.equal((await rawRequest(app.base, 'DELETE /api/my-recipes/%E0 HTTP/1.1')).status, 404);
    assert.equal((await rawRequest(app.base, 'GET // HTTP/1.1')).status, 200); // "//" 는 첫 화면
    assert.equal((await rawRequest(app.base, 'GET /api/me HTTP/1.1\r\nCookie: sid=%E0')).status, 200); // 깨진 쿠키는 비로그인
    assert.equal((await app.request('GET', '/api/status')).status, 200, '이후에도 서버가 살아 있다');
  } finally {
    await app.close();
  }
});

test('본문이 객체가 아니면(null·배열·숫자) 400', async () => {
  const app = await startServer({ demo: true });
  try {
    for (const body of ['null', '[]', '42', '"x"']) {
      const res = await fetch(`${app.base}/api/recognize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(res.status, 400, body);
      assert.equal((await res.json()).error, '요청 형식이 올바르지 않아요.');
    }
  } finally {
    await app.close();
  }
});

test('너무 큰 본문은 413을 받는다(Content-Length·스트리밍 모두)', async () => {
  const app = await startServer({ demo: true });
  try {
    const big = await fetch(`${app.base}/api/recognize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(16 * 1024 * 1024) });
    assert.equal(big.status, 413);
    assert.match((await big.json()).error, /요청이 너무 커요/);
    const stream = new ReadableStream({ start(c) { for (let i = 0; i < 17; i++) c.enqueue(new Uint8Array(1024 * 1024)); c.close(); } });
    const chunked = await fetch(`${app.base}/api/recognize`, { method: 'POST', body: stream, duplex: 'half' });
    assert.equal(chunked.status, 413);
    await chunked.text();
    assert.equal((await app.request('GET', '/api/status')).status, 200);
  } finally {
    await app.close();
  }
});

test('정적 파일: ETag 가 같으면 304', async () => {
  const app = await startServer({ demo: true });
  try {
    const first = await fetch(`${app.base}/app.js`);
    const etag = first.headers.get('etag');
    assert.ok(etag);
    await first.text();
    const again = await fetch(`${app.base}/app.js`, { headers: { 'If-None-Match': etag } });
    assert.equal(again.status, 304);
    assert.equal((await again.text()).length, 0);
  } finally {
    await app.close();
  }
});

// ----- 모델 응답 해석(리뷰 9·10) -----
test('extractJson: 설명 속 [ 가 먼저 나와도 객체를 찾고, 잘린 JSON 은 실패', () => {
  assert.deepEqual(extractJson('참고 [1] 결과: {"recipes":[{"title":"a"}]}'), { recipes: [{ title: 'a' }] });
  assert.deepEqual(extractJson('[{"name":"달걀"}]'), [{ name: '달걀' }]);
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => extractJson('{"recipes":[{"title":"김치찌개","steps":["끓인다'));
});

test('chat(): finish_reason=length 는 잘림 오류, 본문 읽기 중 시간 초과는 504 (fetch 가짜)', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"recipes":[' } }] }), { status: 200 });
    await assert.rejects(openrouter.chat({ apiKey: 'k', model: 'm', messages: [] }), (err) => err instanceof openrouter.ApiError && err.code === 'truncated');
    assert.match(openrouter.userMessageFor({ code: 'truncated' }), /잘렸어요/);

    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); } });
    await assert.rejects(openrouter.chat({ apiKey: 'k', model: 'm', messages: [] }), (err) => err.status === 504);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('실제 모드: 잘린 응답이면 레시피 실패 문구로 502', async () => {
  const chat = async () => { throw new openrouter.ApiError(502, 'truncated', 'truncated'); };
  const app = await startServer({ demo: false, chat });
  const error = console.error;
  console.error = () => {};
  try {
    const res = await app.request('POST', '/api/recipes', { ingredients: ['달걀'] });
    assert.equal(res.status, 502);
    assert.match(res.data.error, /^레시피를 만들지 못했어요.*잘렸어요/);
  } finally {
    console.error = error;
    await app.close();
  }
});

// ----- .env 파서(리뷰 23) -----
test('.env: 따옴표 없는 값의 # 주석을 지우고, ...로 끝나는 견본 키는 거부', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { loadEnvFile } = require('../lib/config');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridge-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'FRIDGE_T1=abc  # 설명\nFRIDGE_T2="a # b"\nFRIDGE_T3=x#y\n');
  try {
    loadEnvFile(file);
    assert.equal(process.env.FRIDGE_T1, 'abc');
    assert.equal(process.env.FRIDGE_T2, 'a # b');
    assert.equal(process.env.FRIDGE_T3, 'x#y');
  } finally {
    delete process.env.FRIDGE_T1; delete process.env.FRIDGE_T2; delete process.env.FRIDGE_T3;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(isUsableKey('sk-or-v1-0123abcd...'), false);
  assert.equal(isUsableKey('sk-or-v1-0123abcd…'), false);
  assert.equal(isUsableKey('sk-or-v1-0123abcd'), true);
});

// ----- 데모 배너 문구 구분(리뷰 20): 직접 강제했으면 키가 없어도 'forced' -----
test('loadConfig: --demo/DEMO_MODE 로 강제하면 키 유무와 상관없이 demoReason 은 forced', () => {
  const saved = { key: process.env.OPENROUTER_API_KEY, demo: process.env.DEMO_MODE };
  try {
    delete process.env.DEMO_MODE;
    process.env.OPENROUTER_API_KEY = ''; // 이미 정의된 값은 .env 가 덮어쓰지 않는다
    assert.equal(loadConfig({ argv: [] }).demoReason, 'no-key');
    assert.equal(loadConfig({ argv: ['--demo'] }).demoReason, 'forced');
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-0123abcd';
    assert.equal(loadConfig({ argv: [] }).demoReason, null);
    assert.equal(loadConfig({ argv: [] }).demo, false);
    process.env.DEMO_MODE = '1';
    const forced = loadConfig({ argv: [] });
    assert.equal(forced.demo, true);
    assert.equal(forced.demoReason, 'forced');
  } finally {
    if (saved.key === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = saved.key;
    if (saved.demo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = saved.demo;
  }
});

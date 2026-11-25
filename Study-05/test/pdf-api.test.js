// 작성일: 2026-11-25 18:12
// PDF 요약 서버 API 테스트: 데모 config, 가짜 chat/summarize 주입, 포트 0. 실제 외부 호출 없음.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const { createPdfApp } = require('../pdf-server');
const { ApiError } = require('../lib/openrouter');
const h = require('./pdf-helpers');

const SECRET = 'sk-or-v1-super-secret-test-key';
const cleanups = [];
after(async () => { for (const fn of cleanups) await fn(); });

async function start(configOverrides = {}, deps = {}) {
  const config = { apiKey: SECRET, demo: true, model: 'test/model', timeoutMs: 1000, ...configOverrides };
  const { server } = createPdfApp(config, deps);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  cleanups.push(() => new Promise((r) => { server.close(r); server.closeAllConnections?.(); }));
  const post = async (body, headers = { 'Content-Type': 'application/pdf' }) => {
    const res = await fetch(base + '/api/summarize', { method: 'POST', headers, body });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 본문이 JSON 이 아님 */ }
    return { status: res.status, json, text, headers: res.headers };
  };
  return { base, post };
}

const goodPdf = () => h.textPdf([['Quarterly report overview', 'Revenue grew in the third quarter.']], { flate: true });

test('GET / 와 /index_pdf.html 은 text/html, 보안 헤더 포함', async () => {
  const { base } = await start();
  for (const p of ['/', '/index_pdf.html']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/html/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy'), /default-src/);
    await res.text();
  }
});

test('그 외 정적 경로는 404 {error}, .env 등 비노출', async () => {
  const { base } = await start();
  for (const p of ['/.env', '/server.js', '/pdf-server.js', '/lib/config.js', '/index.html', '/package.json', '/../.env', '/%2e%2e/.env']) {
    const res = await fetch(base + p);
    const text = await res.text();
    assert.equal(res.status, 404, p);
    assert.equal(typeof JSON.parse(text).error, 'string');
    assert.ok(!text.includes(SECRET));
  }
});

test('GET /api/status 는 {demo, model} 만, 키 비노출', async () => {
  const { base } = await start();
  const res = await fetch(base + '/api/status');
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(text), { demo: true, model: 'test/model' });
  assert.ok(!text.includes(SECRET));
});

test('/api/summarize 에 GET 은 405', async () => {
  const { base } = await start();
  const res = await fetch(base + '/api/summarize');
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'POST');
  assert.equal(typeof (await res.json()).error, 'string');
});

test('정상 PDF(데모): 200 + 응답 스키마, 한글 파일명 디코딩', async () => {
  const { post } = await start();
  const name = '분기 보고서 (최종).pdf';
  const r = await post(goodPdf(), { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(name) });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.json.fileName, name);
  assert.equal(r.json.pages, 1);
  assert.equal(r.json.demo, true);
  assert.equal(r.json.truncated, false);
  assert.equal(r.json.chars, [...'Quarterly report overview\nRevenue grew in the third quarter.'].length);
  const s = r.json.summary;
  assert.equal(typeof s.title, 'string');
  assert.equal(typeof s.oneLine, 'string');
  assert.ok(Array.isArray(s.keyPoints) && s.keyPoints.length >= 1 && s.keyPoints.length <= 5);
  assert.ok(Array.isArray(s.keywords) && s.keywords.length <= 5);
  assert.deepEqual(Object.keys(r.json).sort(), ['chars', 'demo', 'fileName', 'pages', 'summary', 'truncated']);
});

test('Content-Type 은 application/pdf, octet-stream, 없음 허용 / 그 외 415', async () => {
  const { post } = await start();
  assert.equal((await post(goodPdf(), { 'Content-Type': 'application/octet-stream' })).status, 200);
  assert.equal((await post(goodPdf(), { 'Content-Type': 'application/pdf; charset=binary' })).status, 200);
  assert.equal((await post(goodPdf(), {})).status, 200); // fetch 가 Buffer 본문에 Content-Type 을 붙이지 않음
  const bad = await post(goodPdf(), { 'Content-Type': 'text/plain' });
  assert.equal(bad.status, 415);
  assert.equal(bad.json.error, 'PDF 파일만 올릴 수 있어요.');
});

test('X-File-Name: 잘못된 인코딩·빈 값·경로·긴 이름 정리', async () => {
  const { post } = await start();
  const nameOf = async (v) => (await post(goodPdf(), { 'Content-Type': 'application/pdf', 'X-File-Name': v })).json.fileName;
  assert.equal(await nameOf('%E0%A4%A'), 'document.pdf');
  assert.equal(await nameOf('%20%20'), 'document.pdf');
  assert.equal(await nameOf(encodeURIComponent('..\\evil/dir\\a.pdf')), '..evildira.pdf');
  assert.equal([...(await nameOf(encodeURIComponent('가'.repeat(300))))].length, 120);
  const noHeader = await post(goodPdf());
  assert.equal(noHeader.json.fileName, 'document.pdf');
});

test('413: 10MB 초과, 10MB 정확히는 통과', async () => {
  const { post } = await start();
  const max = 10 * 1024 * 1024;
  const big = await post(Buffer.concat([goodPdf(), Buffer.alloc(max)]));
  assert.equal(big.status, 413);
  assert.equal(big.json.error, '파일이 너무 커요. 10MB 이하 PDF만 올릴 수 있어요.');
  const plusOne = await post(h.padTo(goodPdf(), max + 1));
  assert.equal(plusOne.status, 413);
  const exact = await post(h.padTo(goodPdf(), max));
  assert.equal(exact.status, 200);
});

test('400 빈 본문 / 415 시그니처 없음 / 422 암호화·텍스트 없음·손상', async () => {
  const { post } = await start();
  const empty = await post(Buffer.alloc(0));
  assert.equal(empty.status, 400);
  assert.equal(empty.json.error, 'PDF 파일 내용이 비어 있어요.');

  const notPdf = await post(Buffer.from('<html>not a pdf</html>'));
  assert.equal(notPdf.status, 415);
  assert.equal(notPdf.json.error, 'PDF 파일만 올릴 수 있어요.');
  // 시그니처가 1024바이트 밖이면 415
  assert.equal((await post(Buffer.concat([Buffer.alloc(1100, 0x20), goodPdf()]))).status, 415);
  // 시그니처가 1024바이트 안이면 통과
  assert.equal((await post(Buffer.concat([Buffer.alloc(500, 0x20), goodPdf()]))).status, 200);

  const enc = await post(h.textPdf([['secret']], { encrypt: true }));
  assert.equal(enc.status, 422);
  assert.equal(enc.json.error, '암호가 걸린 PDF는 지원하지 않아요. 암호를 해제한 파일을 올려 주세요.');
  const scan = await post(h.imageOnlyPdf());
  assert.equal(scan.status, 422);
  assert.equal(scan.json.error, 'PDF에서 글자를 찾지 못했어요. 이미지로 된 스캔본은 지원하지 않아요.');
  const broken = await post(h.truncatedPdf());
  assert.equal(broken.status, 422);
  assert.equal(broken.json.error, 'PDF 파일이 손상되었거나 읽을 수 없는 형식이에요.');
  for (const r of [enc, scan, broken, empty, notPdf]) {
    assert.ok(!r.text.includes(SECRET));
    assert.ok(!/[A-Za-z]:\\|at .*\(|node_modules/.test(r.text));
  }
});

test('12,000자 초과: truncated, chars 는 원본 길이, summarize 입력은 12,000자', async () => {
  const seen = [];
  const summarize = async (text) => {
    seen.push(text);
    return { title: 't', oneLine: 'o', keyPoints: ['k'], keywords: [] };
  };
  const { post } = await start({}, { summarize });
  const line = 'abcdefghij '.repeat(30).trim();
  const pdf = h.textPdf([Array.from({ length: 50 }, () => line)], { flate: true });
  const r = await post(pdf);
  assert.equal(r.status, 200);
  assert.equal(r.json.truncated, true);
  assert.ok(r.json.chars > 12000);
  assert.equal([...seen[0]].length, 12000);
});

test('summarize 에 config 와 chat 이 전달된다', async () => {
  let got;
  const fakeChat = async () => 'x';
  const summarize = async (text, config, deps) => {
    got = { config, chat: deps.chat };
    return { title: 't', oneLine: 'o', keyPoints: ['k'], keywords: [] };
  };
  const { post } = await start({ demo: false }, { chat: fakeChat, summarize });
  const r = await post(goodPdf());
  assert.equal(r.status, 200);
  assert.equal(r.json.demo, false);
  assert.equal(got.chat, fakeChat);
  assert.equal(got.config.model, 'test/model');
});

test('AI 오류: ApiError 는 502 + userMessageFor, 데모로 대체하지 않음', async () => {
  const cases = [
    [401, 'API 키가 올바르지 않아요. .env 의 OPENROUTER_API_KEY 를 확인해 주세요.'],
    [402, 'OpenRouter 크레딧이 부족해요. 크레딧을 확인하거나 무료(:free) 모델로 바꿔 주세요.'],
    [429, '요청이 너무 많아요(무료 모델 한도 초과). 잠시 뒤 다시 시도해 주세요.'],
    [404, '모델을 사용할 수 없어요. .env 의 MODEL 을 다른 모델로 바꿔 보세요.'],
    [504, 'AI 응답이 너무 늦어요(시간 초과). 다시 시도해 주세요.'],
  ];
  for (const [status, msg] of cases) {
    const { post } = await start({ demo: false }, { summarize: async () => { throw new ApiError(status, `upstream ${SECRET}`); } });
    const r = await post(goodPdf());
    assert.equal(r.status, 502, String(status));
    assert.equal(r.json.error, msg);
    assert.ok(!r.text.includes(SECRET));
  }
});

test('스키마 불량(BAD_SUMMARY)은 502, 예상 못 한 예외는 500 이며 내부 정보 비노출', async () => {
  const bad = await start({ demo: false }, { summarize: async () => { throw Object.assign(new Error('bad'), { code: 'BAD_SUMMARY' }); } });
  const r1 = await bad.post(goodPdf());
  assert.equal(r1.status, 502);
  assert.equal(r1.json.error, 'AI 응답을 이해하지 못했어요. 다시 시도해 주세요.');

  const boom = await start({}, { summarize: async () => { throw new Error(`boom C:\\secret\\path ${SECRET}`); } });
  const origError = console.error;
  console.error = () => {};
  let r2;
  try { r2 = await boom.post(goodPdf()); } finally { console.error = origError; }
  assert.equal(r2.status, 500);
  assert.equal(r2.json.error, '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.');
  assert.ok(!r2.text.includes('secret'));
});

test('데모 모드에서는 chat 이 호출되지 않는다', async () => {
  let calls = 0;
  const { post } = await start({ demo: true }, { chat: async () => { calls++; return '{}'; } });
  const r = await post(goodPdf());
  assert.equal(r.status, 200);
  assert.equal(calls, 0);
});

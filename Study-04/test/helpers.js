// 작성일: 2026-11-25 03:07 (수정됨) 2026-11-25 04:34
// 테스트 공통: 임시 데이터 폴더와 빈 포트로 서버를 띄우고 요청을 보낸다.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

// 1x1 흰색 PNG
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

async function startServer({ demo = true, chat } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridge-test-'));
  const config = {
    demo,
    demoReason: demo ? 'no-key' : null,
    apiKey: demo ? '' : 'test-key',
    visionModel: 'test/vision',
    textModel: 'test/text',
    dataDir,
  };
  const server = createApp(config, chat ? { chat } : undefined);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';

  async function request(method, urlPath, body) {
    const res = await fetch(base + urlPath, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  }

  return {
    base,
    dataDir,
    server,
    request,
    clearCookie() { cookie = ''; },
    async close() {
      // 테스트에서 먼저 닫았으면 close 가 오류를 넘기지만 무시한다. 닫힐 때 서버가 미뤄 둔 기록을 flush 한다.
      if (server.listening) await new Promise((r) => server.close(r));
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

module.exports = { startServer, TINY_PNG };

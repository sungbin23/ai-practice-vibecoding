// 작성일: 2026-11-25 17:45 (수정됨) 2026-11-25 18:10
// AI 공감 다이어리 - 외부 패키지 없이 Node 내장 모듈만 쓰는 웹 서버
// 실행: node server.js  (키 없으면 자동 데모 모드, --demo 로 강제)
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { loadConfig } = require('./lib/config');
const openrouter = require('./lib/openrouter');
const { analyzeWithAi, demoAnalysis } = require('./lib/analyze');
const { createStore } = require('./lib/store');

const INDEX_FILE = path.join(__dirname, 'index.html');
const MAX_BODY_BYTES = 8 * 1024; // 200자 일기에는 충분
const MAX_TEXT = 200;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}

// 본문을 한도까지만 모은다. 넘으면 이후는 버리고(끝까지 읽어 흘려보냄) 413.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    let size = 0;
    let tooLarge = Number.isFinite(declared) && declared > MAX_BODY_BYTES;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) tooLarge = true;
      if (!tooLarge) chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) reject(new HttpError(413, '요청이 너무 커요. 일기는 200자 이내로 써 주세요.'));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => reject(new HttpError(400, '요청을 읽지 못했어요.')));
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, '요청 형식이 올바르지 않아요(JSON 오류).');
  }
}

function validateText(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.text !== 'string') {
    throw new HttpError(400, '일기 내용(text)을 문자열로 보내 주세요.');
  }
  const text = body.text.trim();
  if (!text) throw new HttpError(400, '오늘 있었던 일을 한 줄 적어 주세요.');
  if ([...text].length > MAX_TEXT) throw new HttpError(400, `일기는 ${MAX_TEXT}자 이내로 써 주세요.`);
  return text;
}

function createApp(config, { chat = openrouter.chat } = {}) {
  const store = createStore(config.dataDir);

  async function handle(req, res) {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      throw new HttpError(400, '잘못된 주소예요.');
    }
    const p = url.pathname;
    const m = req.method;

    if ((p === '/' || p === '/index.html') && (m === 'GET' || m === 'HEAD')) {
      let html;
      try {
        html = await fs.promises.readFile(INDEX_FILE);
      } catch {
        throw new HttpError(404, '화면 파일(index.html)을 찾을 수 없어요.');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(m === 'HEAD' ? undefined : html);
    }
    if (p === '/api/status' && m === 'GET') {
      return sendJson(res, 200, { demo: !!config.demo, model: config.model });
    }
    if (p === '/api/entries' && m === 'GET') {
      return sendJson(res, 200, { entries: store.list() });
    }
    if (p === '/api/entries' && m === 'POST') {
      const text = validateText(await readJson(req));
      let analysis;
      if (config.demo) {
        analysis = demoAnalysis(text);
      } else {
        try {
          analysis = await analyzeWithAi(text, config, chat);
        } catch (err) {
          throw new HttpError(502, openrouter.userMessageFor(err));
        }
      }
      const entry = await store.add({ text, demo: !!config.demo, analysis });
      return sendJson(res, 201, { entry });
    }
    const del = p.match(/^\/api\/entries\/([^/]+)$/);
    if (del && m === 'DELETE') {
      let id = null;
      try { id = decodeURIComponent(del[1]); } catch { /* 404 로 처리 */ }
      if (!id || !(await store.remove(id))) throw new HttpError(404, '해당 일기를 찾을 수 없어요.');
      return sendJson(res, 200, { ok: true });
    }
    throw new HttpError(404, '요청한 경로를 찾을 수 없어요.');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) return res.end();
      if (err instanceof HttpError) {
        return sendJson(res, err.status, { error: err.message }, err.status === 413 ? { Connection: 'close' } : {});
      }
      console.error('서버 오류:', err.message);
      sendJson(res, 500, { error: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' });
    });
  });
  return { server, store };
}

if (require.main === module) {
  const config = loadConfig();
  const { server } = createApp(config);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`포트 ${config.port} 를 이미 다른 프로그램이 쓰고 있어요. 다른 포트로 실행해 보세요(예: PORT=3001 npm start).`);
    else if (err.code === 'EACCES') console.error(`포트 ${config.port} 를 사용할 권한이 없어요. 다른 포트로 실행해 보세요.`);
    else console.error(`서버를 시작하지 못했어요: ${err.message}`);
    process.exit(1);
  });
  server.listen(config.port, () => {
    console.log(`AI 공감 다이어리: http://localhost:${config.port}  (${config.demo ? '데모 모드' : `AI 모드, 모델 ${config.model}`})`);
  });
}

module.exports = { createApp };

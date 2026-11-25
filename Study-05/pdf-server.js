// 작성일: 2026-11-25 18:05 (수정됨 2026-11-25 18:25)
// PDF 요약 앱 서버 - 외부 패키지 없이 Node 내장 모듈만 사용. 실행: node pdf-server.js (--demo 로 데모 강제)
// 업로드한 PDF는 메모리에서만 처리하고 디스크에 저장하지 않는다.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { loadConfig } = require('./lib/config');
const openrouter = require('./lib/openrouter');
const { extractPdfText } = require('./lib/pdf-extract');
const summarizeModule = require('./lib/summarize');

const INDEX_FILE = path.join(__dirname, 'index_pdf.html');
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_DRAIN_BYTES = 64 * 1024 * 1024; // 초과 업로드를 흘려보낼 최대량(넘으면 연결 끊기)
const MAX_SUMMARY_CHARS = 12000;
const MAX_NAME_CHARS = 120;
const DEFAULT_NAME = 'document.pdf';
const ALLOWED_TYPES = new Set(['', 'application/pdf', 'application/octet-stream']);

const HTML_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

const EXTRACT_ERRORS = {
  ENCRYPTED: '암호가 걸린 PDF는 지원하지 않아요. 암호를 해제한 파일을 올려 주세요.',
  NO_TEXT: 'PDF에서 글자를 찾지 못했어요. 이미지로 된 스캔본은 지원하지 않아요.',
  CORRUPT: 'PDF 파일이 손상되었거나 읽을 수 없는 형식이에요.',
};

class HttpError extends Error {
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    this.headers = headers || {};
  }
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...headers });
  res.end(JSON.stringify(body));
}

// 본문을 10MB까지만 모은다. 넘는 순간 모으기를 멈추고(메모리 보호) 나머지는 버린다.
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
      else {
        chunks.length = 0;
        if (size > MAX_DRAIN_BYTES) req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) reject(new HttpError(413, '파일이 너무 커요. 10MB 이하 PDF만 올릴 수 있어요.', { Connection: 'close' }));
      else resolve(Buffer.concat(chunks, size));
    });
    req.on('error', () => reject(new HttpError(400, '요청을 읽지 못했어요.')));
    req.on('close', () => { if (!req.complete) reject(new HttpError(400, '요청을 읽지 못했어요.')); });
  });
}

function cleanFileName(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 3000) return DEFAULT_NAME;
  let name;
  try {
    name = decodeURIComponent(raw);
  } catch {
    return DEFAULT_NAME;
  }
  name = name.replace(/[\u0000-\u001F\u007F]/g, '').replace(/[\\/]/g, '').trim();
  const chars = [...name];
  if (chars.length > MAX_NAME_CHARS) name = chars.slice(0, MAX_NAME_CHARS).join('');
  return name || DEFAULT_NAME;
}

function createPdfApp(config, { chat = openrouter.chat, summarize = summarizeModule.summarize } = {}) {
  async function handle(req, res) {
    let url;
    try {
      // '//x' 가 호스트로 해석되지 않도록 항상 'http://localhost' 뒤에 그대로 붙인다.
      if (typeof req.url !== 'string' || !req.url.startsWith('/')) throw new Error('bad url');
      url = new URL('http://localhost' + req.url);
    } catch {
      throw new HttpError(400, '잘못된 주소예요.');
    }
    const p = url.pathname;
    const m = req.method;

    if ((p === '/' || p === '/index_pdf.html') && (m === 'GET' || m === 'HEAD')) {
      let html;
      try {
        html = await fs.promises.readFile(INDEX_FILE);
      } catch {
        throw new HttpError(404, '화면 파일(index_pdf.html)을 찾을 수 없어요.');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': HTML_CSP, 'X-Frame-Options': 'DENY', ...BASE_HEADERS });
      return res.end(m === 'HEAD' ? undefined : html);
    }
    if (p === '/api/status' && m === 'GET') {
      return sendJson(res, 200, { demo: !!config.demo, model: config.model });
    }
    if (p === '/api/summarize') {
      if (m !== 'POST') throw new HttpError(405, '이 주소는 POST 요청만 받아요.', { Allow: 'POST' });
      return handleSummarize(req, res);
    }
    throw new HttpError(404, '요청한 경로를 찾을 수 없어요.');
  }

  async function handleSummarize(req, res) {
    const body = await readBody(req); // 413
    if (body.length === 0) throw new HttpError(400, 'PDF 파일 내용이 비어 있어요.');
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type) || body.subarray(0, 1024).indexOf('%PDF-') < 0) {
      throw new HttpError(415, 'PDF 파일만 올릴 수 있어요.');
    }
    const fileName = cleanFileName(req.headers['x-file-name']);

    let extracted;
    try {
      extracted = extractPdfText(body);
    } catch (err) {
      throw new HttpError(422, EXTRACT_ERRORS[err && err.code] || EXTRACT_ERRORS.CORRUPT);
    }

    const chars = [...extracted.text];
    const truncated = chars.length > MAX_SUMMARY_CHARS;
    const input = truncated ? chars.slice(0, MAX_SUMMARY_CHARS).join('') : extracted.text;

    let summary;
    try {
      summary = await summarize(input, config, { chat });
    } catch (err) {
      if (err instanceof openrouter.ApiError) throw new HttpError(502, openrouter.userMessageFor(err));
      if (err && err.code === 'BAD_SUMMARY') throw new HttpError(502, 'AI 응답을 이해하지 못했어요. 다시 시도해 주세요.');
      throw err;
    }
    return sendJson(res, 200, {
      fileName,
      pages: extracted.pages,
      chars: chars.length,
      truncated,
      demo: !!config.demo,
      summary,
    });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) return res.end();
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message }, err.headers);
      console.error('서버 오류:', err && err.name);
      sendJson(res, 500, { error: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' });
    });
  });
  server.requestTimeout = 120000;
  return { server };
}

if (require.main === module) {
  const config = loadConfig();
  const port = Number(process.env.PDF_PORT) || 3001;
  const { server } = createPdfApp(config);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`포트 ${port} 를 이미 다른 프로그램이 쓰고 있어요. 다른 포트로 실행해 보세요(예: PDF_PORT=3002 npm run pdf).`);
    else if (err.code === 'EACCES') console.error(`포트 ${port} 를 사용할 권한이 없어요. 다른 포트로 실행해 보세요.`);
    else console.error(`서버를 시작하지 못했어요: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(`PDF 요약: http://localhost:${port}  (${config.demo ? '데모 모드' : `AI 모드, 모델 ${config.model}`})`);
  });
}

module.exports = { createPdfApp };

// 작성일: 2026-11-25 03:11 (수정됨) 2026-11-25 05:10
// 냉장고를 부탁해 - 외부 패키지 없이 Node 내장 모듈만 쓰는 웹 서버
// 실행: node server.js  (키 없으면 자동 데모 모드, --demo 로 강제)
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { loadConfig } = require('./lib/config');
const openrouter = require('./lib/openrouter');
const { recognizeIngredients, validateImage } = require('./lib/recognize');
const { validateRecipeRequest, generateRecipes, pickDemoRecipes, sanitizeRecipeForSave, CUISINES, DIFFICULTIES, ANY } = require('./lib/recipes');
const { createStore } = require('./lib/store');
const { SAMPLE_INGREDIENTS, SAMPLE_RECIPES } = require('./lib/demo-data');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 15 * 1024 * 1024; // base64 이미지(10MB 원본) 여유분 포함
const TOO_LARGE_MESSAGE = '요청이 너무 커요. 이미지는 10MB 이하로 올려 주세요.';
const RECIPE_FAIL_MESSAGE = '레시피를 만들지 못했어요. 다시 시도해 주세요.';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

// 잘못된 % 인코딩이면 예외 대신 null
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function sendJson(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(text);
}

const DRAIN_TIMEOUT_MS = 15000;

// 본문 한도를 넘으면 413. Content-Length 로 미리 알 수 있으면 메모리에 모으지 않고 바로 거절 단계로 가고,
// 스트리밍 중에 넘으면 그때부터 더 모으지 않는다. 어느 쪽이든 남은 본문은 버리면서 흘려보낸 뒤
// Connection: close 로 응답한다. (올리는 중에 연결을 닫으면 클라이언트가 ECONNRESET 만 받고 413을 못 본다.)
// 너무 많이(한도의 2배 초과) 오거나 오래 걸리면 기다리지 않고 바로 응답한다.
function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const tooLarge = () => {
      const fail = () => reject(new HttpError(413, TOO_LARGE_MESSAGE, { Connection: 'close' }));
      req.removeAllListeners('data');
      req.removeAllListeners('end');
      if (req.complete) return fail();
      let drained = 0;
      const timer = setTimeout(fail, DRAIN_TIMEOUT_MS);
      timer.unref?.();
      const finish = () => { clearTimeout(timer); fail(); };
      req.on('data', (chunk) => { drained += chunk.length; if (drained > maxBytes * 2) finish(); });
      req.once('end', finish);
      req.once('close', finish);
      req.resume();
    };
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) return tooLarge();
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > maxBytes) return;
      if (!chunks.length) return resolve({});
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reject(new HttpError(400, '요청 형식이 올바르지 않아요.'));
      }
      // 모든 API 가 객체 본문을 기대한다(null·배열·숫자는 거절).
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reject(new HttpError(400, '요청 형식이 올바르지 않아요.'));
      }
      resolve(parsed);
    });
    req.on('error', reject);
  });
}

const SESSION_COOKIE = 'sid';

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return safeDecode(v.join('='));
  }
  return null;
}

function sessionCookie(token, maxAgeSec) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
}

// 정적 파일: 첫 요청 때 메모리에 올려 두고, 매 요청 stat 의 mtime·크기로 바뀌었는지만 확인한다.
// ETag 가 같으면 304 로 본문을 보내지 않는다.
const staticCache = new Map(); // filePath -> { mtimeMs, size, etag, data, type }

async function loadStatic(filePath) {
  const st = await fs.promises.stat(filePath);
  if (!st.isFile()) return null;
  const hit = staticCache.get(filePath);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit;
  const data = await fs.promises.readFile(filePath);
  const entry = {
    mtimeMs: st.mtimeMs,
    size: st.size,
    etag: `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`,
    data,
    type: MIME[path.extname(filePath)] || 'application/octet-stream',
  };
  staticCache.set(filePath, entry);
  return entry;
}

async function serveStatic(req, res, rawPath) {
  const urlPath = safeDecode(rawPath);
  if (urlPath === null || urlPath.includes('\0')) return sendJson(res, 400, { error: '잘못된 주소예요.' });
  const rel = urlPath.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: '접근할 수 없어요.' });
  let file;
  try {
    file = await loadStatic(filePath);
  } catch {
    file = null;
  }
  if (!file) return sendJson(res, 404, { error: '페이지를 찾을 수 없어요.' });
  const headers = { 'Content-Type': file.type, 'Cache-Control': 'no-cache', ETag: file.etag };
  if (req.headers['if-none-match'] === file.etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  res.writeHead(200, { ...headers, 'Content-Length': file.data.length });
  res.end(req.method === 'HEAD' ? undefined : file.data);
}

// chat 을 주입할 수 있게 해서 테스트에서 실제 API 대신 가짜 응답을 쓸 수 있다.
function createApp(config, { chat = openrouter.chat } = {}) {
  const store = createStore(config.dataDir);
  const maxBodyBytes = config.maxBodyBytes || MAX_BODY_BYTES;

  function requireUser(ctx) {
    if (!ctx.user) throw new HttpError(401, '로그인이 필요해요.');
    return ctx.user;
  }

  // 활동 횟수 기록이 실패해도 본 응답(인식·레시피 결과)에는 영향을 주지 않는다.
  function countActivity(ctx, kind) {
    if (!ctx.user) return;
    try {
      store.countActivity(ctx.user.id, kind);
    } catch (err) {
      console.error('[활동 기록 실패]', err.message);
    }
  }

  // AI 호출 공통 처리: 실패하면 데모 데이터로 바꾸지 않고 오류를 알린다.
  // parseFail: 응답을 해석하지 못했을 때, truncated: 응답이 max_tokens 에 걸려 잘렸을 때 보여 줄 문장
  async function callAi(fn, {
    parseFail = 'AI가 알아볼 수 없는 답을 보냈어요. 다시 시도해 주세요.',
    truncated = openrouter.userMessageFor({ code: 'truncated' }),
  } = {}) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof openrouter.ApiError) {
        console.error(`[OpenRouter] ${err.status} ${err.message}`);
        throw new HttpError(502, err.code === 'truncated' ? truncated : openrouter.userMessageFor(err));
      }
      console.error('[AI 응답 해석 실패]', err.message);
      throw new HttpError(502, parseFail);
    }
  }

  const routes = {
    'GET /api/status': async () => ({
      demo: config.demo,
      demoReason: config.demoReason,
      models: { vision: config.visionModel, text: config.textModel },
      options: { cuisines: [ANY, ...CUISINES], difficulties: [ANY, ...DIFFICULTIES] },
    }),

    'POST /api/recognize': async (ctx) => {
      const problem = validateImage(ctx.body.image);
      if (problem) throw new HttpError(400, problem);
      let result;
      if (config.demo) {
        result = { demo: true, ingredients: SAMPLE_INGREDIENTS };
      } else {
        const ingredients = await callAi(() =>
          recognizeIngredients({ chat, apiKey: config.apiKey, model: config.visionModel, image: ctx.body.image }));
        result = { demo: false, ingredients };
      }
      countActivity(ctx, 'recognitions');
      return result;
    },

    'POST /api/recipes': async (ctx) => {
      const request = validateRecipeRequest(ctx.body);
      if (request.error) throw new HttpError(400, request.error);
      let result;
      if (config.demo) {
        result = { demo: true, ...pickDemoRecipes(SAMPLE_RECIPES, request) };
      } else {
        const recipes = await callAi(() =>
          generateRecipes({ chat, apiKey: config.apiKey, model: config.textModel, request }), {
            parseFail: RECIPE_FAIL_MESSAGE,
            truncated: '레시피를 만들지 못했어요(AI 응답이 너무 길어 잘렸어요). 다시 시도해 주세요.',
          });
        if (!recipes.length) throw new HttpError(502, RECIPE_FAIL_MESSAGE);
        result = { demo: false, recipes, fallback: false };
      }
      countActivity(ctx, 'generations');
      return result;
    },

    // ----- 3단계: 회원·세션 -----
    'POST /api/register': async (ctx) => {
      const r = await store.register(ctx.body);
      if (r.error) throw new HttpError(r.status, r.error);
      ctx.status = 201;
      ctx.headers = { 'Set-Cookie': sessionCookie(store.createSession(r.user.id), 7 * 24 * 3600) };
      return { user: r.user };
    },

    'POST /api/login': async (ctx) => {
      const r = await store.login(ctx.body);
      if (r.error) throw new HttpError(r.status, r.error);
      ctx.headers = { 'Set-Cookie': sessionCookie(store.createSession(r.user.id), 7 * 24 * 3600) };
      return { user: r.user };
    },

    'POST /api/logout': async (ctx) => {
      if (ctx.token) store.destroySession(ctx.token);
      ctx.headers = { 'Set-Cookie': sessionCookie('', 0) };
      return { ok: true };
    },

    'GET /api/me': async (ctx) => ({ user: ctx.user }),

    // ----- 3단계: 나의 레시피 -----
    'GET /api/my-recipes': async (ctx) => ({ recipes: store.listRecipes(requireUser(ctx).id) }),

    'POST /api/my-recipes': async (ctx) => {
      const user = requireUser(ctx);
      const recipe = sanitizeRecipeForSave(ctx.body.recipe);
      if (!recipe) throw new HttpError(400, '저장할 레시피 형식이 올바르지 않아요.');
      const r = store.addRecipe(user.id, recipe);
      if (r.error) throw new HttpError(r.status, r.error);
      ctx.status = 201;
      return { saved: r.entry };
    },

    'DELETE /api/my-recipes/:id': async (ctx) => {
      const user = requireUser(ctx);
      if (!store.deleteRecipe(user.id, ctx.params.id)) throw new HttpError(404, '레시피를 찾을 수 없어요.');
      return { ok: true };
    },

    'GET /api/dashboard': async (ctx) => store.dashboard(requireUser(ctx).id),
  };

  // "/api/my-recipes/:id" 같은 경로 변수를 처리하는 간단한 매칭(디코딩할 수 없는 값이면 매칭 실패 → 404)
  function findRoute(method, pathname) {
    if (routes[`${method} ${pathname}`]) return { handler: routes[`${method} ${pathname}`], params: {} };
    for (const key of Object.keys(routes)) {
      const [m, pattern] = key.split(' ');
      if (m !== method || !pattern.includes('/:')) continue;
      const a = pattern.split('/');
      const b = pathname.split('/');
      if (a.length !== b.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < a.length && ok; i++) {
        if (a[i].startsWith(':')) {
          const value = b[i] ? safeDecode(b[i]) : null;
          if (!value) ok = false;
          else params[a[i].slice(1)] = value;
        } else if (a[i] !== b[i]) {
          ok = false;
        }
      }
      if (ok) return { handler: routes[key], params };
    }
    return null;
  }

  async function handle(req, res) {
    // new URL 은 "//" 같은 주소에서 예외를 던지므로 경로는 직접 잘라 쓴다.
    const pathname = String(req.url || '/').split(/[?#]/)[0];
    if (!pathname.startsWith('/')) return sendJson(res, 400, { error: '잘못된 주소예요.' });
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: '허용되지 않는 요청이에요.' });
      return serveStatic(req, res, pathname);
    }
    const route = findRoute(req.method, pathname);
    if (!route) return sendJson(res, 404, { error: '없는 API 예요.' });
    const token = getCookie(req, SESSION_COOKIE);
    const ctx = {
      req, res,
      params: route.params,
      token,
      user: store.getSessionUser(token),
      body: req.method === 'GET' || req.method === 'DELETE' ? {} : await readJson(req, maxBodyBytes),
    };
    const result = await route.handler(ctx);
    sendJson(res, ctx.status || 200, result, ctx.headers);
  }

  // 어떤 요청이 와도 예외가 프로세스 밖으로 새지 않게 핸들러 전체를 감싼다.
  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      const known = err instanceof HttpError || err?.expose;
      const status = known ? err.status : 500;
      if (!known) console.error(err);
      if (res.headersSent) return res.destroy();
      try {
        sendJson(res, status, { error: known ? err.message : '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' }, err?.headers);
      } catch {
        res.destroy();
      }
    }
  });
  // 서버를 닫을 때 미뤄 둔 users.json 기록을 마무리한다(테스트 정리·재시작 시 데이터 유지).
  server.on('close', () => store.close());
  server.store = store;
  return server;
}

if (require.main === module) {
  const config = loadConfig();
  const server = createApp(config);
  server.listen(config.port, () => {
    console.log(`냉장고를 부탁해 실행 중: http://localhost:${config.port}`);
    if (config.demo) {
      console.log(config.demoReason === 'forced'
        ? `데모 모드(강제${config.apiKey ? '' : ', API 키도 없음'}): API를 호출하지 않고 샘플 데이터를 씁니다.`
        : '데모 모드: API 키 없음 — .env.example 을 .env 로 복사하고 OPENROUTER_API_KEY 를 넣으면 실제 모델을 씁니다.');
    } else {
      console.log(`실제 모드: 이미지=${config.visionModel}, 텍스트=${config.textModel}`);
    }
  });
  // Ctrl+C·종료 신호에도 미뤄 둔 기록을 남기고 끝낸다.
  const shutdown = () => { server.store.flush(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => server.store.flush());
}

module.exports = { createApp, HttpError, safeDecode };

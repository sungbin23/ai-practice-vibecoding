// 작성일: 2026-11-25 03:12 (수정됨) 2026-11-25 04:34
// 3단계 테스트: 회원가입·로그인·세션, 레시피 저장·삭제, 사용자 간 격리, 대시보드 통계 (데모 모드 전체 흐름)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, TINY_PNG } = require('./helpers');

test('데모 모드 전체 흐름: 가입 → 인식 → 레시피 → 저장 → 나의 레시피 → 대시보드', async () => {
  const app = await startServer({ demo: true });
  try {
    const reg = await app.request('POST', '/api/register', { username: 'chef_kim', password: 'pass1234', nickname: '김셰프' });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.nickname, '김셰프');
    assert.ok(!('hash' in reg.data.user) && !('salt' in reg.data.user));
    assert.match(reg.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);

    assert.equal((await app.request('GET', '/api/me')).data.user.username, 'chef_kim');

    const rec = await app.request('POST', '/api/recognize', { image: TINY_PNG });
    const ingredients = rec.data.ingredients.map((i) => i.name);
    const recipes = (await app.request('POST', '/api/recipes', { ingredients, cuisine: '아무거나', difficulty: '아무거나' })).data.recipes;
    await app.request('POST', '/api/recipes', { ingredients, cuisine: '중식', difficulty: '아무거나' });
    assert.equal(recipes.length, 3);

    for (const r of recipes.slice(0, 2)) {
      const s = await app.request('POST', '/api/my-recipes', { recipe: r });
      assert.equal(s.status, 201);
    }
    const dup = await app.request('POST', '/api/my-recipes', { recipe: recipes[0] });
    assert.equal(dup.status, 409, '같은 레시피 중복 저장 불가');

    const mine = await app.request('GET', '/api/my-recipes');
    assert.equal(mine.data.recipes.length, 2);
    assert.deepEqual(new Set(mine.data.recipes.map((r) => r.recipe.title)), new Set(recipes.slice(0, 2).map((r) => r.title)));

    const dash = (await app.request('GET', '/api/dashboard')).data;
    assert.equal(dash.savedCount, 2);
    assert.equal(dash.recognitions, 1);
    assert.equal(dash.generations, 2);
    const expectedAvg = Math.round((recipes[0].timeMinutes + recipes[1].timeMinutes) / 2);
    assert.equal(dash.avgTimeMinutes, expectedAvg);
    assert.equal(Object.values(dash.byCuisine).reduce((a, b) => a + b, 0), 2);
    assert.ok(dash.topIngredients.length >= 1 && dash.topIngredients.length <= 5);
    assert.ok(!dash.topIngredients.some((t) => ['소금', '물', '설탕'].includes(t.name)), '기본 양념은 TOP 5에서 제외');

    // 삭제
    const del = await app.request('DELETE', `/api/my-recipes/${mine.data.recipes[0].id}`);
    assert.equal(del.status, 200);
    assert.equal((await app.request('GET', '/api/dashboard')).data.savedCount, 1);

    // 비밀번호는 평문으로 저장되지 않는다
    const usersFile = fs.readFileSync(path.join(app.dataDir, 'users.json'), 'utf8');
    assert.ok(!usersFile.includes('pass1234'));
    assert.ok(fs.existsSync(path.join(app.dataDir, 'saved_recipes.json')));
  } finally {
    await app.close();
  }
});

test('로그인·로그아웃과 잘못된 입력', async () => {
  const app = await startServer({ demo: true });
  try {
    assert.equal((await app.request('POST', '/api/register', { username: 'AB', password: '1234', nickname: 'x' })).status, 400);
    assert.equal((await app.request('POST', '/api/register', { username: 'user1', password: '12', nickname: 'x' })).status, 400);
    assert.equal((await app.request('POST', '/api/register', { username: 'user1', password: '1234', nickname: '  ' })).status, 400);
    assert.equal((await app.request('POST', '/api/register', { username: 'user1', password: '1234', nickname: '하나' })).status, 201);
    assert.equal((await app.request('POST', '/api/register', { username: 'user1', password: '9999', nickname: '둘' })).status, 409);

    await app.request('POST', '/api/logout');
    assert.equal((await app.request('GET', '/api/me')).data.user, null);
    assert.equal((await app.request('GET', '/api/my-recipes')).status, 401);
    assert.equal((await app.request('GET', '/api/dashboard')).status, 401);

    assert.equal((await app.request('POST', '/api/login', { username: 'user1', password: 'wrong' })).status, 401);
    assert.equal((await app.request('POST', '/api/login', { username: 'nobody', password: '1234' })).status, 401);
    const ok = await app.request('POST', '/api/login', { username: 'user1', password: '1234' });
    assert.equal(ok.status, 200);
    assert.equal((await app.request('GET', '/api/me')).data.user.nickname, '하나');
  } finally {
    await app.close();
  }
});

test('다른 사용자의 레시피는 보거나 지울 수 없다 / 로그인 안 하면 저장 불가', async () => {
  const app = await startServer({ demo: true });
  try {
    const recipes = (await app.request('POST', '/api/recipes', { ingredients: ['달걀', '토마토'] })).data.recipes;
    assert.equal((await app.request('POST', '/api/my-recipes', { recipe: recipes[0] })).status, 401);

    await app.request('POST', '/api/register', { username: 'alice', password: '1234', nickname: 'A' });
    const saved = (await app.request('POST', '/api/my-recipes', { recipe: recipes[0] })).data.saved;

    app.clearCookie();
    await app.request('POST', '/api/register', { username: 'bob', password: '1234', nickname: 'B' });
    assert.equal((await app.request('GET', '/api/my-recipes')).data.recipes.length, 0);
    assert.equal((await app.request('DELETE', `/api/my-recipes/${saved.id}`)).status, 404);

    app.clearCookie();
    await app.request('POST', '/api/login', { username: 'alice', password: '1234' });
    assert.equal((await app.request('GET', '/api/my-recipes')).data.recipes.length, 1);
  } finally {
    await app.close();
  }
});

test('저장할 레시피 형식 검사와 정리', async () => {
  const app = await startServer({ demo: true });
  try {
    await app.request('POST', '/api/register', { username: 'tester', password: '1234', nickname: 'T' });
    assert.equal((await app.request('POST', '/api/my-recipes', { recipe: { title: '빈 레시피' } })).status, 400);
    assert.equal((await app.request('POST', '/api/my-recipes', {})).status, 400);
    const res = await app.request('POST', '/api/my-recipes', {
      recipe: {
        title: '<b>달걀국</b>', cuisine: '한식', difficulty: '쉬움', timeMinutes: 10, servings: 2,
        ingredients: [{ name: '달걀', amount: '2개', have: true }, { name: '대파', amount: '약간', have: false }],
        steps: ['물을 끓인다.', '달걀을 푼다.'], tip: '', extra: 'x'.repeat(10000),
      },
    });
    assert.equal(res.status, 201);
    const r = res.data.saved.recipe;
    assert.ok(!('extra' in r), '모르는 필드는 버린다');
    assert.deepEqual(r.ingredients.map((i) => i.have), [true, false]);
  } finally {
    await app.close();
  }
});

test('서버를 다시 켜도 계정과 저장 레시피가 남는다', async () => {
  const { createApp } = require('../server');
  const app = await startServer({ demo: true });
  try {
    await app.request('POST', '/api/register', { username: 'persist', password: '1234', nickname: 'P' });
    const recipes = (await app.request('POST', '/api/recipes', { ingredients: ['김치'] })).data.recipes;
    await app.request('POST', '/api/my-recipes', { recipe: recipes[0] });

    // 같은 데이터 폴더로 새 서버
    const server2 = createApp({ demo: true, dataDir: app.dataDir, visionModel: 'v', textModel: 't' });
    await new Promise((r) => server2.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server2.address().port}`;
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'persist', password: '1234' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const mine = await (await fetch(`${base}/api/my-recipes`, { headers: { Cookie: cookie } })).json();
    assert.equal(mine.recipes.length, 1);
    await new Promise((r) => server2.close(r));
  } finally {
    await app.close();
  }
});

test('아이디는 대소문자 구분 없이 가입·로그인한다', async () => {
  const app = await startServer({ demo: true });
  try {
    const reg = await app.request('POST', '/api/register', { username: 'ChefLee', password: '1234', nickname: '리' });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.username, 'cheflee');
    assert.equal((await app.request('POST', '/api/register', { username: 'CHEFLEE', password: '1234', nickname: '둘' })).status, 409);
    app.clearCookie();
    assert.equal((await app.request('POST', '/api/login', { username: 'CHEFLEE', password: '1234' })).status, 200);
    const short = await app.request('POST', '/api/register', { username: 'pw_test', password: '12', nickname: 'x' });
    assert.equal(short.data.error, '비밀번호는 4~100자로 입력해 주세요.');
  } finally {
    await app.close();
  }
});

test('로그아웃하면 이전 세션 토큰은 401', async () => {
  const app = await startServer({ demo: true });
  try {
    const reg = await app.request('POST', '/api/register', { username: 'bye', password: '1234', nickname: 'B' });
    const oldCookie = reg.headers.get('set-cookie').split(';')[0];
    await app.request('POST', '/api/logout');
    const res = await fetch(`${app.base}/api/my-recipes`, { headers: { Cookie: oldCookie } });
    assert.equal(res.status, 401);
  } finally {
    await app.close();
  }
});

test('같은 아이디로 5번 틀리면 1분 동안 429', async () => {
  const app = await startServer({ demo: true });
  try {
    await app.request('POST', '/api/register', { username: 'locked', password: '1234', nickname: 'L' });
    app.clearCookie();
    for (let i = 0; i < 5; i++) assert.equal((await app.request('POST', '/api/login', { username: 'locked', password: 'bad' })).status, 401);
    const res = await app.request('POST', '/api/login', { username: 'LOCKED', password: '1234' });
    assert.equal(res.status, 429);
    assert.match(res.data.error, /1분 뒤 다시 시도/);
  } finally {
    await app.close();
  }
});

test('저장소: 깨진 JSON 은 덮어쓰지 않고 .corrupt 로 옮긴다', () => {
  const os = require('node:os');
  const { createStore } = require('../lib/store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridge-corrupt-'));
  const warn = console.warn;
  console.warn = () => {};
  try {
    fs.writeFileSync(path.join(dir, 'saved_recipes.json'), '{"recipes":[{"id":');
    fs.writeFileSync(path.join(dir, 'users.json'), 'null');
    const store = createStore(dir);
    assert.deepEqual(store.listRecipes('x'), []);
    const files = fs.readdirSync(dir);
    const corrupt = files.find((f) => f.startsWith('saved_recipes.json.corrupt-'));
    assert.ok(corrupt);
    assert.ok(files.some((f) => f.startsWith('users.json.corrupt-')));
    assert.equal(fs.readFileSync(path.join(dir, corrupt), 'utf8'), '{"recipes":[{"id":', '원본 보존');
    store.close();
  } finally {
    console.warn = warn;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('저장소: 파일 쓰기가 실패하면 메모리도 되돌리고 500 메시지를 준다', async () => {
  const os = require('node:os');
  const { createStore } = require('../lib/store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fridge-fail-'));
  const error = console.error;
  console.error = () => {};
  const realWrite = fs.writeFileSync;
  try {
    const store = createStore(dir);
    const ok = await store.register({ username: 'writer', password: '1234', nickname: 'W' });
    fs.writeFileSync = () => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); };
    assert.throws(() => store.addRecipe(ok.user.id, { title: 't', ingredients: [], timeMinutes: 1 }), (err) => err.status === 500 && err.expose);
    await assert.rejects(store.register({ username: 'writer2', password: '1234', nickname: 'W' }), (err) => err.status === 500);
    fs.writeFileSync = realWrite;
    assert.equal(store.listRecipes(ok.user.id).length, 0, '실패한 저장은 메모리에 남지 않는다');
    assert.equal((await store.register({ username: 'writer2', password: '1234', nickname: 'W' })).user.username, 'writer2', '롤백되어 다시 가입 가능');
    store.close();
  } finally {
    fs.writeFileSync = realWrite;
    console.error = error;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('활동 횟수는 모아서 기록하고, 서버를 닫으면 파일에 남는다', async () => {
  const app = await startServer({ demo: true });
  try {
    await app.request('POST', '/api/register', { username: 'counter', password: '1234', nickname: 'C' });
    for (let i = 0; i < 5; i++) await app.request('POST', '/api/recognize', { image: TINY_PNG });
    const before = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'users.json'), 'utf8'));
    assert.equal(before.users[0].stats.recognitions, 0, '요청마다 바로 쓰지 않는다(1초 디바운스)');
    assert.equal((await app.request('GET', '/api/dashboard')).data.recognitions, 5, '메모리 값은 바로 반영');
    await new Promise((r) => app.server.close(r));
    const after = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'users.json'), 'utf8'));
    assert.equal(after.users[0].stats.recognitions, 5, '닫을 때 flush');
  } finally {
    await app.close();
  }
});

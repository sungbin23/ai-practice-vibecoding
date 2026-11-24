// 작성일: 2026-11-25 03:10 (수정됨) 2026-11-25 04:34
// 2단계 테스트: 재료 수정 반영, 요리 종류·난이도 필터, 모델 응답 정규화, 입력 검사
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const { markHave } = require('../lib/recipes');

test('데모 모드: 종류·난이도에 맞는 샘플 레시피를 최대 3개 준다', async () => {
  const app = await startServer({ demo: true });
  try {
    const res = await app.request('POST', '/api/recipes', { ingredients: ['김치', '돼지고기 앞다리살', '두부'], cuisine: '한식', difficulty: '쉬움' });
    assert.equal(res.status, 200);
    assert.equal(res.data.demo, true);
    assert.equal(res.data.fallback, false);
    assert.ok(res.data.recipes.length >= 1 && res.data.recipes.length <= 3);
    for (const r of res.data.recipes) {
      assert.equal(r.cuisine, '한식');
      assert.equal(r.difficulty, '쉬움');
    }
    // 가진 재료가 가장 많은 김치찌개가 먼저
    assert.equal(res.data.recipes[0].title, '돼지고기 김치찌개');
  } finally {
    await app.close();
  }
});

test('데모 모드: 재료를 고치면 have 표시가 바뀐다', async () => {
  const app = await startServer({ demo: true });
  try {
    const body = { cuisine: '중식', difficulty: '쉬움' };
    const before = await app.request('POST', '/api/recipes', { ...body, ingredients: ['토마토', '달걀'] });
    const after = await app.request('POST', '/api/recipes', { ...body, ingredients: ['토마토'] }); // 달걀 삭제
    const egg = (res) => res.data.recipes[0].ingredients.find((i) => i.name === '달걀');
    assert.equal(egg(before).have, true);
    assert.equal(egg(after).have, false);
    const salt = before.data.recipes[0].ingredients.find((i) => i.name === '소금');
    assert.equal(salt.pantry, true, '소금은 기본 양념');
  } finally {
    await app.close();
  }
});

test('데모 모드: 조건에 맞는 샘플이 없으면 fallback 표시와 함께 3개', async () => {
  const app = await startServer({ demo: true });
  try {
    const res = await app.request('POST', '/api/recipes', { ingredients: ['달걀'], cuisine: '일식', difficulty: '어려움' });
    assert.equal(res.status, 200);
    assert.equal(res.data.fallback, true);
    assert.equal(res.data.recipes.length, 3);
  } finally {
    await app.close();
  }
});

test('입력 검사: 빈 재료·잘못된 옵션·너무 많은 재료는 400', async () => {
  const app = await startServer({ demo: true });
  try {
    assert.equal((await app.request('POST', '/api/recipes', { ingredients: [] })).status, 400);
    assert.equal((await app.request('POST', '/api/recipes', { ingredients: ['  '] })).status, 400);
    assert.equal((await app.request('POST', '/api/recipes', { ingredients: ['달걀'], cuisine: '태국식' })).status, 400);
    assert.equal((await app.request('POST', '/api/recipes', { ingredients: ['달걀'], difficulty: '최상' })).status, 400);
    const many = Array.from({ length: 41 }, (_, i) => `재료${i}`);
    assert.equal((await app.request('POST', '/api/recipes', { ingredients: many })).status, 400);
  } finally {
    await app.close();
  }
});

test('실제 모드(가짜 모델): 프롬프트에 조건이 들어가고 응답을 정규화한다', async () => {
  let prompt;
  const chat = async ({ messages, model }) => {
    prompt = { text: messages[1].content, model };
    return JSON.stringify({
      recipes: [
        { title: '양배추 달걀부침', cuisine: '한식', difficulty: '쉬움', timeMinutes: '15분', servings: 2,
          ingredients: [{ name: '양배추', amount: '1/4통' }, { name: '달걀', amount: '2개' }, { name: '소금' }],
          steps: ['1. 양배추를 채 썬다.', '2. 달걀과 섞어 부친다.'], tip: '케첩과 함께' },
        { title: '', steps: ['x'], ingredients: [{ name: 'y' }] }, // 제목 없음 → 버림
        { title: '이상한 값', cuisine: '프랑스식', difficulty: '극한', timeMinutes: 99999,
          ingredients: ['양배추'], steps: ['볶는다'] },
      ],
    });
  };
  const app = await startServer({ demo: false, chat });
  try {
    const res = await app.request('POST', '/api/recipes', { ingredients: ['양배추', '달걀'], cuisine: '한식', difficulty: '아무거나' });
    assert.equal(res.status, 200);
    assert.equal(prompt.model, 'test/text');
    assert.match(prompt.text, /양배추, 달걀/);
    assert.match(prompt.text, /요리 종류: 한식/);
    assert.equal(res.data.recipes.length, 2);
    const [a, b] = res.data.recipes;
    assert.equal(a.timeMinutes, 15);
    assert.deepEqual(a.steps, ['양배추를 채 썬다.', '달걀과 섞어 부친다.']);
    assert.deepEqual(a.ingredients.map((i) => [i.name, i.have, i.pantry]), [['양배추', true, false], ['달걀', true, false], ['소금', false, true]]);
    assert.equal(b.cuisine, '한식', '목록 밖 값은 요청한 종류로');
    assert.equal(b.difficulty, '보통');
    assert.equal(b.timeMinutes, 30);
  } finally {
    await app.close();
  }
});

test('실제 모드: 응답이 JSON이 아니면 502 + PRD F2-6 문구', async () => {
  const app = await startServer({ demo: false, chat: async () => '죄송해요, 만들 수 없어요.' });
  try {
    const res = await app.request('POST', '/api/recipes', { ingredients: ['달걀'] });
    assert.equal(res.status, 502);
    assert.equal(res.data.error, '레시피를 만들지 못했어요. 다시 시도해 주세요.');
  } finally {
    await app.close();
  }
});

test('markHave: 포함 관계 매칭', () => {
  const r = markHave([{ name: '돼지고기', amount: '1' }, { name: '파', amount: '1' }, { name: '양파', amount: '1' }], ['돼지고기 앞다리살', '대파']);
  assert.deepEqual(r.map((i) => i.have), [true, false, false]);
});

test('toInt/toMinutes: 첫 숫자만 읽고, 시간 단위는 분으로 바꾼다', () => {
  const { toInt, toMinutes } = require('../lib/recipes');
  assert.equal(toInt('2~3인분', 1, 20, 2), 2); // 예전: "23" 으로 읽혀 범위 밖 → 기본값
  assert.equal(toInt('약 2.6인분', 1, 20, 2), 3);
  assert.equal(toInt('없음', 1, 20, 2), 2);
  assert.equal(toMinutes('15분', 1, 600, 30), 15);
  assert.equal(toMinutes('20~30분', 1, 600, 30), 20);
  assert.equal(toMinutes('1시간', 1, 600, 30), 60);
  assert.equal(toMinutes('1시간 30분', 1, 600, 30), 90);
  assert.equal(toMinutes('1.5시간', 1, 600, 30), 90);
  assert.equal(toMinutes(45, 1, 600, 30), 45);
});

test('저장용 정리: have 는 보낸 have=true 재료와 정확히 같은 이름만', () => {
  const { sanitizeRecipeForSave } = require('../lib/recipes');
  const r = sanitizeRecipeForSave({
    title: '고추장찌개', cuisine: '한식', difficulty: '보통', timeMinutes: 20, servings: 2,
    ingredients: [{ name: '고추', amount: '1개', have: true }, { name: '고추장', amount: '1큰술', have: false }, { name: '소금', amount: '약간' }],
    steps: ['끓인다.'],
  });
  assert.deepEqual(r.ingredients.map((i) => [i.name, i.have, i.pantry]), [['고추', true, false], ['고추장', false, false], ['소금', false, true]]);
});

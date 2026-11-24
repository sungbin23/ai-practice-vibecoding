// 작성일: 2026-11-25 03:11 (수정됨) 2026-11-25 04:12
// 2단계: 재료 + 요리 종류 + 난이도 → 레시피 3개
'use strict';

const { extractJson } = require('./openrouter');

const CUISINES = ['한식', '양식', '중식', '일식'];
const DIFFICULTIES = ['쉬움', '보통', '어려움'];
const ANY = '아무거나';
// 대부분의 집에 있는 기본 양념: "더 필요한 재료"로 세지 않는다.
const PANTRY = ['소금', '후추', '설탕', '식용유', '물', '간장', '참기름', '깨', '통깨', '식초'];

const MAX_INGREDIENTS = 40;
const MAX_NAME = 40;

const normKey = (s) => String(s).toLowerCase().replace(/\s+/g, '');

function cleanText(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// 요청 검사. 정리된 입력 또는 { error } 를 돌려준다.
function validateRecipeRequest(body) {
  const list = Array.isArray(body?.ingredients) ? body.ingredients : null;
  if (!list) return { error: '재료 목록이 필요해요.' };
  const seen = new Set();
  const ingredients = [];
  for (const raw of list) {
    const name = cleanText(typeof raw === 'string' ? raw : raw?.name, MAX_NAME);
    if (!name || seen.has(normKey(name))) continue;
    seen.add(normKey(name));
    ingredients.push(name);
  }
  if (!ingredients.length) return { error: '재료를 하나 이상 넣어 주세요.' };
  if (ingredients.length > MAX_INGREDIENTS) return { error: `재료는 ${MAX_INGREDIENTS}개까지만 넣을 수 있어요.` };
  const cuisine = body.cuisine ?? ANY;
  const difficulty = body.difficulty ?? ANY;
  if (cuisine !== ANY && !CUISINES.includes(cuisine)) return { error: '요리 종류가 올바르지 않아요.' };
  if (difficulty !== ANY && !DIFFICULTIES.includes(difficulty)) return { error: '난이도가 올바르지 않아요.' };
  return { ingredients, cuisine, difficulty };
}

// 레시피 재료를 사용자가 가진 재료와 비교한다("돼지고기" ↔ "돼지고기 앞다리살"처럼 포함 관계도 인정).
function markHave(recipeIngredients, userIngredients) {
  const mine = userIngredients.map(normKey).filter((k) => k.length >= 1);
  return recipeIngredients.map((ing) => {
    const k = normKey(ing.name);
    const pantry = PANTRY.some((p) => normKey(p) === k);
    const have = mine.some((m) => m === k || (m.length >= 2 && k.includes(m)) || (k.length >= 2 && m.includes(k)));
    return { name: ing.name, amount: ing.amount, have, pantry: pantry && !have };
  });
}

// 문자열에서 첫 숫자만 읽는다("2~3인분" → 2, "15분" → 15). 숫자들을 이어 붙이지 않는다(예전: "2~3" → 23).
function firstNumber(v) {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

function toInt(v, min, max, fallback) {
  const n = Math.round(firstNumber(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

// 조리 시간(분). "1시간" → 60, "1.5시간" → 90, "1시간 30분" → 90, "25분" → 25
function toMinutes(v, min, max, fallback) {
  if (typeof v === 'string' && /시간/.test(v)) {
    const h = v.match(/(\d+(?:\.\d+)?)\s*시간/);
    const m = v.match(/시간\s*(\d+(?:\.\d+)?)\s*분/);
    if (h) return toInt(Number(h[1]) * 60 + (m ? Number(m[1]) : 0), min, max, fallback);
  }
  return toInt(v, min, max, fallback);
}

function normalizeRecipes(parsed, request) {
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.recipes) ? parsed.recipes : [];
  const out = [];
  for (const r of list) {
    const title = cleanText(r?.title, 60);
    const steps = (Array.isArray(r?.steps) ? r.steps : [])
      .map((s) => cleanText(typeof s === 'string' ? s : s?.text ?? s?.description, 300).replace(/^\d+[.)]\s*/, ''))
      .filter(Boolean)
      .slice(0, 15);
    const ingredients = (Array.isArray(r?.ingredients) ? r.ingredients : [])
      .map((i) => ({ name: cleanText(typeof i === 'string' ? i : i?.name, MAX_NAME), amount: cleanText(i?.amount, 30) || '적당량' }))
      .filter((i) => i.name)
      .slice(0, 30);
    if (!title || !steps.length || !ingredients.length) continue;
    const cuisine = CUISINES.includes(r.cuisine) ? r.cuisine : request.cuisine !== ANY ? request.cuisine : '기타';
    const difficulty = DIFFICULTIES.includes(r.difficulty) ? r.difficulty : request.difficulty !== ANY ? request.difficulty : '보통';
    out.push({
      title,
      cuisine,
      difficulty,
      timeMinutes: toMinutes(r.timeMinutes ?? r.time, 1, 600, 30),
      servings: toInt(r.servings, 1, 20, 2),
      ingredients: markHave(ingredients, request.ingredients),
      steps,
      tip: cleanText(r.tip, 300),
    });
    if (out.length >= 3) break;
  }
  return out;
}

function buildPrompt({ ingredients, cuisine, difficulty }) {
  return `냉장고에 있는 재료: ${ingredients.join(', ')}
요리 종류: ${cuisine === ANY ? '상관없음(한식·양식·중식·일식 중 어울리는 것)' : cuisine}
난이도: ${difficulty === ANY ? '상관없음' : difficulty}

위 재료를 최대한 활용하는 집밥 레시피 3개를 추천해 주세요.
- 주재료는 위 목록에서 고르고, 꼭 필요한 경우에만 다른 재료를 조금 추가하세요.
- 3개는 서로 다른 요리여야 합니다.
- 조리 순서는 한국어로 3~8단계, 각 단계는 80자 이내의 한 문장으로 구체적으로 쓰세요.
- 레시피마다 재료는 12개 이내, tip 은 60자 이내 한 문장으로 쓰세요(응답이 길면 중간에 잘립니다).
- cuisine 은 "${CUISINES.join('|')}" 중 하나, difficulty 는 "${DIFFICULTIES.join('|')}" 중 하나입니다.
반드시 아래 JSON 형식으로만 답하고 다른 말은 쓰지 마세요.
{"recipes":[{"title":"요리 이름","cuisine":"한식","difficulty":"쉬움","timeMinutes":20,"servings":2,"ingredients":[{"name":"재료명","amount":"양"}],"steps":["1단계 설명","2단계 설명"],"tip":"한 줄 팁"}]}`;
}

async function generateRecipes({ chat, apiKey, model, request }) {
  const content = await chat({
    apiKey,
    model,
    // 한국어 레시피 3개 JSON 은 2~3천 토큰이 나올 수 있어 잘리지 않게 여유를 둔다(프롬프트에도 길이 제한).
    maxTokens: 4096,
    messages: [
      { role: 'system', content: '당신은 한국 가정식에 밝은 요리 연구가입니다. 요청한 JSON 형식만 출력합니다.' },
      { role: 'user', content: buildPrompt(request) },
    ],
  });
  return normalizeRecipes(extractJson(content), request);
}

// 데모 모드: 조건에 맞는 샘플을 가진 재료가 많은 순으로 최대 3개
function pickDemoRecipes(samples, request) {
  const fit = samples.filter((r) =>
    (request.cuisine === ANY || r.cuisine === request.cuisine) &&
    (request.difficulty === ANY || r.difficulty === request.difficulty));
  const fallback = fit.length === 0;
  const scored = (fallback ? samples : fit).map((r) => {
    const ingredients = markHave(r.ingredients, request.ingredients);
    return { recipe: { ...r, ingredients }, score: ingredients.filter((i) => i.have).length };
  });
  scored.sort((a, b) => b.score - a.score);
  return { recipes: scored.slice(0, 3).map((s) => s.recipe), fallback };
}

// 3단계: 브라우저가 보낸 레시피를 저장 전에 같은 규칙으로 다시 정리한다.
// have 표시는 보낸 값 중 have=true 였던 재료 이름과 정확히(normKey) 같은 재료만 인정한다.
// (포함 관계 매칭을 쓰면 have=true 인 "고추"가 같은 레시피의 "고추장"까지 have 로 바꿔 버린다.)
function sanitizeRecipeForSave(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return null;
  const haveKeys = new Set((Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .filter((i) => i && i.have === true && typeof i.name === 'string')
    .map((i) => normKey(cleanText(i.name, MAX_NAME))));
  const [clean] = normalizeRecipes([recipe], { ingredients: [], cuisine: ANY, difficulty: ANY });
  if (!clean) return null;
  clean.ingredients = clean.ingredients.map((i) => {
    const have = haveKeys.has(normKey(i.name));
    const pantry = PANTRY.some((p) => normKey(p) === normKey(i.name));
    return { name: i.name, amount: i.amount, have, pantry: pantry && !have };
  });
  return clean;
}

module.exports = {
  CUISINES, DIFFICULTIES, ANY, PANTRY,
  validateRecipeRequest, normalizeRecipes, markHave, generateRecipes, pickDemoRecipes, buildPrompt, toInt, toMinutes,
  sanitizeRecipeForSave,
};

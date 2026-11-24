// 작성일: 2026-11-25 03:06
// 1단계: 냉장고 사진 → 재료 목록
'use strict';

const { extractJson } = require('./openrouter');

const CATEGORIES = ['채소', '과일', '육류', '해산물', '유제품', '달걀', '가공식품', '소스/양념', '기타'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

const VISION_PROMPT = `이 냉장고(또는 식재료) 사진에 보이는 식재료를 모두 찾아 주세요.
반드시 아래 JSON 형식으로만 답하고 다른 설명은 쓰지 마세요.
{"ingredients":[{"name":"한국어 재료명","quantity":"대략 수량(예: 2개, 반 통, 알 수 없음)","category":"${CATEGORIES.join('|')}"}]}
규칙: 식재료가 아닌 물건(그릇, 포장 용기 자체 등)은 빼세요. 무엇인지 확실하지 않은 것은 빼세요. 같은 재료는 한 번만 쓰세요.`;

// data URL 검사. 문제가 있으면 사용자에게 보여 줄 메시지를 돌려준다.
function validateImage(image) {
  if (typeof image !== 'string') return '이미지가 없어요.';
  const m = image.match(IMAGE_RE);
  if (!m) return 'JPG, PNG, WEBP 이미지만 올릴 수 있어요.';
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return '이미지가 너무 커요(10MB 이하).';
  return null;
}

function cleanText(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// 모델 응답을 { name, quantity, category } 배열로 정규화
function normalizeIngredients(parsed) {
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.ingredients) ? parsed.ingredients : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const name = cleanText(typeof item === 'string' ? item : item?.name, 40);
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const rawCat = cleanText(item?.category, 20);
    const category = CATEGORIES.includes(rawCat) ? rawCat : CATEGORIES.find((c) => rawCat && c.includes(rawCat)) || '기타';
    out.push({ name, quantity: cleanText(item?.quantity, 20) || '알 수 없음', category });
    if (out.length >= 40) break;
  }
  return out;
}

async function recognizeIngredients({ chat, apiKey, model, image }) {
  const content = await chat({
    apiKey,
    model,
    maxTokens: 1500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: VISION_PROMPT },
        { type: 'image_url', image_url: { url: image } },
      ],
    }],
  });
  return normalizeIngredients(extractJson(content));
}

module.exports = { recognizeIngredients, normalizeIngredients, validateImage, CATEGORIES };

// 작성일: 2026-11-25 03:06 (수정됨) 2026-11-25 05:10
// OpenRouter Chat Completions 호출과 모델 응답(JSON) 해석.
'use strict';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code; // 'truncated' 등 상태 코드만으로 구분하기 어려운 경우
  }
}

const isTimeout = (err) => err?.name === 'TimeoutError' || err?.cause?.name === 'TimeoutError';

async function chat({ apiKey, model, messages, maxTokens = 2000, timeoutMs = 60000 }) {
  let res;
  let raw;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'Fridge Recipe App',
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    // 본문을 받는 중에도 시간 초과·연결 끊김이 날 수 있으므로 같은 try 안에서 읽는다.
    raw = await res.text();
  } catch (err) {
    if (isTimeout(err)) throw new ApiError(504, 'timeout');
    throw new ApiError(502, `network: ${err.message}`);
  }
  let data = null;
  try { data = JSON.parse(raw); } catch { /* 아래에서 처리 */ }
  if (!res.ok || data?.error) {
    const status = data?.error?.code && Number.isInteger(data.error.code) ? data.error.code : res.status;
    throw new ApiError(status || 502, data?.error?.message || raw.slice(0, 200));
  }
  const choice = data?.choices?.[0];
  // max_tokens 에 걸려 잘린 응답은 JSON 이 깨져 있으므로 해석하지 않고 의미 있는 오류로 알린다.
  if (choice?.finish_reason === 'length') throw new ApiError(502, 'truncated (finish_reason=length)', 'truncated');
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new ApiError(502, 'empty response');
  return content;
}

// body 에서 여는 괄호 하나(open)를 기준으로 JSON 후보를 잘라 파싱한다.
function parseFrom(body, open) {
  const start = body.indexOf(open);
  if (start < 0) return { start: Infinity };
  const end = body.lastIndexOf(open === '{' ? '}' : ']');
  if (end <= start) return { start, error: new Error('no json end') };
  try {
    return { start, value: JSON.parse(body.slice(start, end + 1)) };
  } catch (error) {
    return { start, error };
  }
}

// 모델이 ```json 코드블록이나 앞뒤 설명을 붙여도 JSON 부분만 꺼낸다.
// '{' 와 '[' 로 시작하는 후보를 각각 시도해서, 앞쪽에 있으면서 파싱에 성공한 것을 쓴다
// (예: "참고 [1] {...}" 처럼 설명 속 대괄호가 먼저 나와도 객체를 찾는다).
function extractJson(text) {
  if (typeof text !== 'string') throw new Error('not text');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const bodies = fenced ? [fenced[1], text] : [text];
  let lastError = new Error('no json');
  for (const body of bodies) {
    const candidates = [parseFrom(body, '{'), parseFrom(body, '[')]
      .filter((c) => c.start !== Infinity)
      .sort((a, b) => a.start - b.start);
    for (const c of candidates) {
      if (!c.error) return c.value;
      lastError = c.error;
    }
  }
  throw lastError;
}

// API 오류를 사용자에게 보여 줄 한국어 문장으로 바꾼다.
function userMessageFor(err) {
  const s = err?.status;
  if (err?.code === 'truncated') return 'AI 응답이 너무 길어 중간에 잘렸어요. 다시 시도해 주세요.';
  if (s === 401 || s === 403) return 'API 키가 올바르지 않아요. .env 의 OPENROUTER_API_KEY 를 확인해 주세요.';
  if (s === 402) return 'OpenRouter 크레딧이 부족해요. OpenRouter 사이트에서 크레딧을 확인하거나 무료(:free) 모델로 바꿔 주세요.';
  if (s === 429) return '요청이 너무 많아요(무료 모델 한도). 잠시 뒤 다시 시도해 주세요.';
  if (s === 404 || (s === 400 && /model/i.test(err.message))) return '모델을 사용할 수 없어요. .env 의 VISION_MODEL / TEXT_MODEL 을 다른 무료 모델로 바꿔 보세요.';
  if (s === 504) return 'AI 응답이 너무 늦어요(60초 초과). 다시 시도해 주세요.';
  return 'AI 서버와 통신하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}

module.exports = { chat, extractJson, userMessageFor, ApiError };

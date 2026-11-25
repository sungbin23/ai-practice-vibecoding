// 작성일: 2026-11-25 17:45
// .env 를 읽어 서버 설정을 만든다. API 키는 서버 안에서만 쓰고 브라우저로 보내지 않는다.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_MODEL = 'deepseek/deepseek-chat-v3.1:free';

// KEY=VALUE 형식만 처리하는 작은 .env 파서. 이미 설정된 환경 변수는 덮어쓰지 않는다.
function loadEnvFile(filePath = path.join(ROOT, '.env')) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }
  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

// 비어 있거나 견본 문구가 그대로면 키가 없는 것으로 본다.
function isUsableKey(key) {
  if (!key) return false;
  const k = key.trim();
  if (!k) return false;
  if (/^(your|여기|발급|sk-or-v1-\.{3}|xxx)/i.test(k)) return false;
  if (/(\.{3}|…)$/.test(k)) return false;
  if (/\s/.test(k)) return false;
  return true;
}

function loadConfig({ argv = process.argv } = {}) {
  loadEnvFile();
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const forceDemo = process.env.DEMO_MODE === '1' || argv.includes('--demo');
  const hasKey = isUsableKey(apiKey);
  return {
    apiKey: hasKey ? apiKey : '',
    demo: forceDemo || !hasKey,
    model: process.env.MODEL || DEFAULT_MODEL,
    port: Number(process.env.PORT) || 3000,
    dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
    timeoutMs: 30000,
  };
}

module.exports = { loadConfig, loadEnvFile, isUsableKey, DEFAULT_MODEL, ROOT };

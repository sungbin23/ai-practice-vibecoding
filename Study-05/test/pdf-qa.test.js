// 작성일: 2026-11-25 18:15 (수정됨 2026-11-25 18:32)
// QA 추가 점검: PDF 요약 앱의 실제 PDF 생성기(Chrome/한컴 등) 패턴과 PRD 불일치를 재현한다.
// 'KNOWN-BUG' 가 붙은 테스트는 현재 제품 코드에서 실패하는 것이 정상이다(수정 후 통과해야 함).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createPdfApp } = require('../pdf-server');
const { extractPdfText } = require('../lib/pdf-extract');
const { demoSummary } = require('../lib/summarize');
const h = require('./pdf-helpers');

let server;
let port;
test.before(async () => {
  ({ server } = createPdfApp({ demo: true, model: 'm', apiKey: '', timeoutMs: 1000 }, { chat: async () => { throw new Error('chat 호출 금지'); } }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
test.after(() => new Promise((r) => server.close(r)));

function req(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', reject);
    r.end(body);
  });
}
const post = (body, headers = {}) => req('POST', '/api/summarize', { body, headers: { 'Content-Type': 'application/pdf', ...headers } });

test('통과 기대: 경로 조작·특수문자 파일명은 구분자만 제거되고 응답에만 쓰인다', async () => {
  const pdf = h.textPdf([['Quarterly report sentence one is here.']]);
  for (const [raw, want] of [['..%2F..%2F.env', '.....env'], ['%2F', 'document.pdf'], ['%E0%A4%A', 'document.pdf'], ['%00%01a.pdf', 'a.pdf']]) {
    const r = await post(pdf, { 'X-File-Name': raw });
    assert.equal(r.status, 200);
    assert.equal(JSON.parse(r.text).fileName, want, raw);
  }
});

test('통과 기대: 동시 요청 30개가 모두 200', async () => {
  const pdf = h.textPdf([['Concurrent request sentence number one.']], { flate: true });
  const rs = await Promise.all(Array.from({ length: 30 }, () => post(pdf)));
  assert.deepEqual([...new Set(rs.map((r) => r.status))], [200]);
});

test('통과 기대: 데모 응답 스키마(keyPoints 1~5, keywords<=5, demo:true)', async () => {
  const r = await post(h.koreanPdf(['인공지능 보고서 제목입니다', '인공지능은 산업 전반에 확산되고 있습니다.', '기업은 보안과 윤리 기준을 마련해야 합니다.']));
  const j = JSON.parse(r.text);
  assert.equal(j.demo, true);
  assert.ok(j.summary.keyPoints.length >= 1 && j.summary.keyPoints.length <= 5);
  assert.ok(j.summary.keywords.length <= 5);
});

// ---------------- KNOWN-BUG (현재 실패 예상) ----------------

test('한 단어가 Td 로 쪼개져도(Chrome 출력 패턴) 단어 중간에 공백을 넣지 않는다', () => {
  const c = 'BT /F1 16 Tf 8 240 Td (Ar) Tj 16.6875 0 Td (tificial) Tj ET\n';
  const { text } = extractPdfText(h.pdfFromContents([c]));
  assert.match(text, /Artificial/, `실제 추출: ${JSON.stringify(text)}`);
});

test('단어마다 BT/ET 로 나뉜 PDF(한컴/일부 변환기)도 한 줄로 이어진다', () => {
  const words = ['Overseas', 'language', 'program', 'application', 'guide'];
  const c = words.map((w, i) => `BT /F1 12 Tf 1 0 0 1 ${72 + i * 60} 700 Tm (${w}) Tj ET`).join('\n') + '\n';
  const { text } = extractPdfText(h.pdfFromContents([c]));
  assert.ok(!text.includes('\n'), `실제 추출: ${JSON.stringify(text)}`);
});

test('줄바꿈으로 갈라진 문장(PDF 자동 줄바꿈)이 데모 keyPoints 에서 잘리지 않는다', () => {
  const text = '인공지능 활용 가이드\n인공지능은 업무 효율을 높이는 도구입니다. 올바르게 사용하면 문서 작성 시간을 크게 줄일 수 있습\n니다.\n그러나 결과를 그대로 믿기보다 반드시 검토해야 합니다.';
  const s = demoSummary(text);
  const all = [s.oneLine, ...s.keyPoints];
  assert.ok(all.some((p) => p.includes('줄일 수 있습니다.')), JSON.stringify(s.keyPoints));
});

test('데모 keyPoints 가 다른 keyPoint 의 일부(구절 조각)를 중복해서 싣지 않는다', () => {
  const s = demoSummary('Quarterly Report on Renewable Energy\nSolar capacity grew rapidly across the region this year.\nWind projects also expanded, driven by lower costs and new policy support.\nStorage remains the main challenge for grid operators.');
  for (const a of s.keyPoints) for (const b of s.keyPoints) if (a !== b) assert.ok(!b.includes(a.replace(/[.,]$/, '')), `"${a}" 은 "${b}" 의 일부`);
});

test('중간에서 잘린 PDF(약 50~70%)는 NO_TEXT(스캔본 안내)가 아니라 CORRUPT', () => {
  const full = h.textPdf([['Cut in the middle of a file sentence.']], { flate: true });
  for (const f of [0.5, 0.7]) {
    try { extractPdfText(full.subarray(0, Math.floor(full.length * f))); assert.fail('예외 기대'); } catch (e) {
      assert.equal(e.code, 'CORRUPT', `${f}: ${e.code}`);
    }
  }
});

test('//호스트 형태 경로가 화면을 내려주지 않는다(404)', async () => {
  const r = await req('GET', '//anything');
  assert.equal(r.status, 404);
});

test('Content-Type 이 application/octet-stream 이어도 PDF 시그니처가 있으면 허용(PRD 결정)', async () => {
  const pdf = h.textPdf([['Content type mismatch sentence here.']]);
  const r = await post(pdf, { 'Content-Type': 'application/octet-stream' });
  assert.equal(r.status, 200);
});

// ---------------- 재검증(2차): Edge/Chrome 출력처럼 글자마다 Td 로 배치된 PDF ----------------

// Helvetica 글자 폭(1/1000 em). Chrome/Edge 는 글자마다 'Td' 로 직전 글자의 폭만큼 이동한다.
const HELV = { t: 278, e: 556, a: 556, m: 833, s: 500, ' ': 278, h: 556, i: 222, p: 556, l: 222, O: 778, v: 500, r: 333, W: 944, b: 556 };
function perGlyphTd(str, size = 12) {
  let c = `BT /F1 ${size} Tf 72 700 Td\n`;
  [...str].forEach((ch, i) => {
    if (i > 0) c += `${(HELV[[...str][i - 1]] * size / 1000).toFixed(3)} 0 Td\n`;
    c += `(${ch}) Tj\n`;
  });
  return c + 'ET\n';
}

test('Edge 형태(글자마다 Td): 폭이 넓은 m·O·W 뒤에서 단어를 쪼개지 않는다', () => {
  const { text } = extractPdfText(h.pdfFromContents([perGlyphTd('teams help') + perGlyphTd('Overseas Web')]));
  assert.match(text, /teams help/, JSON.stringify(text));
  assert.match(text, /Overseas Web/, JSON.stringify(text));
});

test('Edge 형태(글자마다 Td): 한글 글자 사이에 공백이 끼지 않는다', () => {
  const chars = [...'인공지능 활용 가이드는 업무 효율을 높입니다.'];
  const table = new Map();
  const code = (ch) => (table.has(ch) ? table.get(ch) : (table.set(ch, table.size + 1), table.size));
  const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, '0');
  let c = 'BT /F1 12 Tf 72 700 Td\n';
  chars.forEach((ch, i) => {
    if (i > 0) c += `${chars[i - 1] === ' ' ? 3.4 : (/[가-힣]/.test(chars[i - 1]) ? 12 : 4)} 0 Td\n`;
    c += `<${hex4(code(ch))}> Tj\n`;
  });
  c += 'ET\n';
  const bf = [...table.entries()].map(([ch, n]) => `<${hex4(n)}> <${hex4(ch.charCodeAt(0))}>`).join('\n');
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${table.size} beginbfchar\n${bf}\nendbfchar\nendcmap\nend\nend\n`;
  const fontObjs = [
    { num: 3, body: '<< /Type /Font /Subtype /Type0 /BaseFont /TestKR /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 5 0 R >>' },
    { num: 4, body: '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /TestKR /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>' },
    { num: 5, stream: true, body: h.streamObj('', h.L(cmap), false) },
  ];
  const { text } = extractPdfText(h.pdfFromContents([c], { fontObjs }));
  assert.equal(text, '인공지능 활용 가이드는 업무 효율을 높입니다.', JSON.stringify(text));
});

test('TJ 간격 -250(공백 폭 0.25em)도 단어 사이 공백으로 본다', () => {
  const { text } = extractPdfText(h.pdfFromContents(['BT /F1 12 Tf 72 700 Td [(helps)-250(teams)-250(ship)] TJ ET\n']));
  assert.equal(text, 'helps teams ship');
});

// 회귀: 문장부호 없는 5어절 이상 제목이 한 줄 요약에 붙지 않는다.
test('한 줄 요약에 제목 줄이 섞이지 않는다(5어절 이상 제목)', () => {
  const s = demoSummary('Quarterly Report on Renewable Energy Markets\nSolar capacity grew rapidly across the region this year. Wind also expanded.\nStorage is hard for operators.');
  assert.equal(s.oneLine, 'Solar capacity grew rapidly across the region this year.');
});

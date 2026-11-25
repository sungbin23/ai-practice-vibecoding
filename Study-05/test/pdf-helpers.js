// 작성일: 2026-11-25 18:08
// 테스트용 PDF 생성 헬퍼(바이너리 파일을 커밋하지 않고 코드로 만든다). *.test.js 가 아니므로 테스트로 실행되지 않는다.
'use strict';

const zlib = require('node:zlib');

const L = (s) => Buffer.from(s, 'latin1');
const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);

function streamObj(dictExtra, data, flate) {
  const body = flate ? zlib.deflateSync(data) : data;
  return Buffer.concat([
    L(`<< ${dictExtra} /Length ${body.length}${flate ? ' /Filter /FlateDecode' : ''} >>\nstream\n`),
    body,
    L('\nendstream'),
  ]);
}

// objs: [{ num, body: string|Buffer }]  (xref 없이 만든다 - 추출기는 xref 를 쓰지 않는다)
function assemble(objs, { trailer = '' } = {}) {
  const parts = [L('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n')];
  for (const o of objs) parts.push(L(`${o.num} 0 obj\n`), Buffer.isBuffer(o.body) ? o.body : L(o.body), L('\nendobj\n'));
  const max = Math.max(...objs.map((o) => o.num));
  parts.push(L(`trailer\n<< /Size ${max + 1} /Root 1 0 R ${trailer} >>\n%%EOF\n`));
  return Buffer.concat(parts);
}

// 페이지별 콘텐츠 스트림(문자열)으로 PDF 를 만든다.
function pdfFromContents(contents, opts = {}) {
  const { flate = false, objStm = false, encrypt = false, reverse = false, fontObjs, resources = '', extraObjs = [] } = opts;
  const n = contents.length;
  const pageNum = (i) => 10 + 2 * (reverse ? n - 1 - i : i);
  const kids = contents.map((_, i) => `${pageNum(i)} 0 R`).join(' ');
  const plain = [
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { num: 2, body: `<< /Type /Pages /Count ${n} /Kids [${kids}] >>` },
    ...(fontObjs || [{ num: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' }]),
  ];
  const streams = [];
  contents.forEach((c, i) => {
    plain.push({
      num: pageNum(i),
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> ${resources} >> /Contents ${pageNum(i) + 1} 0 R >>`,
    });
    streams.push({ num: pageNum(i) + 1, body: streamObj('', L(c), flate) });
  });
  const dicts = plain.filter((o) => !Buffer.isBuffer(o.body) && !o.stream);
  const streamish = [...plain.filter((o) => o.stream), ...streams, ...extraObjs];
  let objs;
  if (objStm) {
    const bodies = dicts.map((o) => o.body);
    let head = '';
    let off = 0;
    dicts.forEach((o, i) => { head += `${o.num} ${off} `; off += bodies[i].length + 1; });
    const data = L(head + '\n' + bodies.join('\n'));
    objs = [...streamish, { num: 99, body: streamObj(`/Type /ObjStm /N ${dicts.length} /First ${head.length + 1}`, data, flate) }];
  } else {
    objs = [...dicts, ...streamish];
  }
  if (encrypt) objs.push({ num: 900, body: '<< /Filter /Standard /V 1 /R 2 /O (xxxxxxxx) /U (yyyyyyyy) /P -4 >>' });
  return assemble(objs, { trailer: encrypt ? '/Encrypt 900 0 R' : '' });
}

function pageContent(lines, mode) {
  let c = 'BT /F1 12 Tf 14 TL 72 720 Td\n';
  lines.forEach((line, i) => {
    if (mode === 'TJ') {
      c += `[${line.split(' ').map((w) => `(${esc(w)})`).join(' -300 ')}] TJ\n0 -14 Td\n`;
    } else if (mode === 'quote') {
      if (i === 0) c += `(${esc(line)}) Tj\n`;
      else if (i % 2) c += `(${esc(line)}) '\n`;
      else c += `0 0 (${esc(line)}) "\n`;
    } else {
      c += `(${esc(line)}) Tj\n0 -14 Td\n`;
    }
  });
  return c + 'ET\n';
}

// pages: 페이지마다 문자열 줄 배열. mode: 'Tj' | 'TJ' | 'quote'
function textPdf(pages, opts = {}) {
  return pdfFromContents(pages.map((lines) => pageContent(lines, opts.mode || 'Tj')), opts);
}

// Identity-H 2바이트 코드 + ToUnicode(bfchar 한글, bfrange 영문/공백/숫자)
function koreanPdf(lines, opts = {}) {
  const table = new Map();
  const code = (ch) => {
    const cp = ch.charCodeAt(0);
    if (cp >= 0x20 && cp <= 0x7e) return 0x1000 + cp;
    if (!table.has(ch)) table.set(ch, table.size + 1);
    return table.get(ch);
  };
  const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, '0');
  let c = 'BT /F1 12 Tf 72 720 Td\n';
  for (const line of lines) c += `<${[...line].map((ch) => hex4(code(ch))).join('')}> Tj\n0 -14 Td\n`;
  c += 'ET\n';
  const chars = [...table.entries()].map(([ch, n]) => `<${hex4(n)}> <${hex4(ch.charCodeAt(0))}>`).join('\n');
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<1020> <107E> <0020>\nendbfrange\n${table.size} beginbfchar\n${chars}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
  const fontObjs = [
    { num: 3, body: '<< /Type /Font /Subtype /Type0 /BaseFont /TestKR /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 5 0 R >>' },
    { num: 4, body: '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /TestKR /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>' },
    { num: 5, stream: true, body: streamObj('', L(cmap), !!opts.flate) },
  ];
  return pdfFromContents([c], { ...opts, fontObjs });
}

// 이미지만 있고 글자가 없는 페이지(스캔본 형태)
function imageOnlyPdf() {
  const img = { num: 20, body: streamObj('/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8', Buffer.from([0, 80, 160, 255]), false) };
  return pdfFromContents(['q 100 0 0 100 50 50 cm /Im0 Do Q\n'], { resources: '/XObject << /Im0 20 0 R >>', extraObjs: [img] });
}

// 앞부분만 남은 손상 파일(카탈로그는 있으나 닫히지 않고 페이지 없음)
function truncatedPdf() {
  return L('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R');
}

// 정확히 size 바이트가 되도록 끝에 주석 줄을 덧붙인다.
function padTo(buf, size) {
  if (buf.length > size) throw new Error('already larger');
  return Buffer.concat([buf, Buffer.alloc(size - buf.length, 0x25)]); // '%' 반복(주석)
}

module.exports = { textPdf, koreanPdf, pdfFromContents, imageOnlyPdf, truncatedPdf, padTo, streamObj, assemble, L };

// 작성일: 2026-11-25 18:10
// PDF 텍스트 추출기 단위 테스트. PDF 는 test/pdf-helpers.js 가 코드로 만든다.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const { extractPdfText, PdfError } = require('../lib/pdf-extract');
const h = require('./pdf-helpers');

const throwsCode = (buf, code) => assert.throws(() => extractPdfText(buf), (e) => e instanceof PdfError && e.code === code);

test('(a) 무압축 Tj', () => {
  const r = extractPdfText(h.textPdf([['Hello World', 'Second line']]));
  assert.equal(r.pages, 1);
  assert.equal(r.text, 'Hello World\nSecond line');
});

test('(b) FlateDecode + TJ: 큰 음수 간격은 공백', () => {
  const r = extractPdfText(h.textPdf([['Quick brown fox']], { flate: true, mode: 'TJ' }));
  assert.equal(r.text, 'Quick brown fox');
});

test("(c) ' 와 \" 연산자", () => {
  const r = extractPdfText(h.textPdf([['one', 'two', 'three']], { mode: 'quote' }));
  assert.equal(r.text, 'one\ntwo\nthree');
});

test('(d) Identity-H + ToUnicode 한글(bfchar/bfrange)', () => {
  for (const flate of [false, true]) {
    const r = extractPdfText(h.koreanPdf(['안녕하세요 PDF 요약 123', '한글이 깨지지 않아야 합니다.'], { flate }));
    assert.equal(r.text, '안녕하세요 PDF 요약 123\n한글이 깨지지 않아야 합니다.');
  }
});

test('(e) ObjStm 안에 카탈로그·페이지 객체', () => {
  for (const flate of [false, true]) {
    const r = extractPdfText(h.textPdf([['inside objstm']], { objStm: true, flate }));
    assert.equal(r.text, 'inside objstm');
    assert.equal(r.pages, 1);
  }
});

test('(f) 여러 쪽: Pages 트리 순서(객체 번호가 거꾸로여도)', () => {
  const r = extractPdfText(h.textPdf([['page one'], ['page two'], ['page three']], { reverse: true, flate: true }));
  assert.equal(r.pages, 3);
  assert.equal(r.text, 'page one\n\npage two\n\npage three');
});

test('리터럴 문자열 이스케이프·8진수·hex 문자열', () => {
  const content = 'BT /F1 12 Tf 72 720 Td (a\\(b\\)c \\\\ \\101\\102 \\\n joined) Tj 0 -14 Td <48656C6C6F> Tj 0 -14 Td (nested (paren) ok) Tj ET';
  const r = extractPdfText(h.pdfFromContents([content]));
  assert.equal(r.text, 'a(b)c \\ AB joined\nHello\nnested (paren) ok');
});

test('Td/Tm 줄바꿈 처리와 BI 인라인 이미지 건너뛰기', () => {
  const content = 'BT /F1 12 Tf 1 0 0 1 72 700 Tm (first) Tj 1 0 0 1 72 680 Tm (second) Tj ET\n'
    + 'BI /W 1 /H 1 /CS /G /BPC 8 ID \x00(fake) Tj\x01 EI\n'
    + 'BT /F1 12 Tf 72 600 Td (third) Tj 50 0 Td (same-line) Tj ET';
  const r = extractPdfText(h.pdfFromContents([content]));
  assert.equal(r.text, 'first\nsecond\nthird same-line');
});

test('12,000자 초과 문서도 전체 텍스트를 돌려준다', () => {
  const line = 'abcdefghij '.repeat(30).trim(); // 329자
  const lines = Array.from({ length: 50 }, () => line);
  const r = extractPdfText(h.textPdf([lines], { flate: true }));
  assert.ok([...r.text].length > 12000);
});

test('(g) 텍스트 없는 이미지 전용 PDF는 NO_TEXT', () => {
  throwsCode(h.imageOnlyPdf(), 'NO_TEXT');
});

test('(h) /Encrypt 가 있으면 ENCRYPTED', () => {
  throwsCode(h.textPdf([['secret']], { encrypt: true }), 'ENCRYPTED');
});

test('(i) 잘린 손상 파일은 CORRUPT', () => {
  throwsCode(h.truncatedPdf(), 'CORRUPT');
  throwsCode(h.textPdf([['x']]).subarray(0, 12), 'CORRUPT');
});

test('빈 버퍼·임의 바이트·잘못된 입력은 PdfError', () => {
  throwsCode(Buffer.alloc(0), 'CORRUPT');
  throwsCode(Buffer.from('hello, not a pdf'), 'CORRUPT');
  throwsCode('not a buffer', 'CORRUPT');
  throwsCode(null, 'CORRUPT');
  for (let i = 0; i < 20; i++) {
    const junk = Buffer.concat([Buffer.from('%PDF-1.4\n'), require('node:crypto').randomBytes(2000)]);
    assert.throws(() => extractPdfText(junk), (e) => e instanceof PdfError);
  }
});

test('깨진 구조(순환 Kids, 깊은 중첩 배열)에서도 멈추지 않는다', () => {
  const cyc = h.assemble([
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { num: 2, body: '<< /Type /Pages /Kids [2 0 R 3 0 R] /Count 2 >>' },
    { num: 3, body: '<< /Type /Pages /Kids [2 0 R] /Count 1 >>' },
  ]);
  assert.throws(() => extractPdfText(cyc), (e) => e instanceof PdfError);
  const deep = h.assemble([{ num: 1, body: '['.repeat(5000) }]);
  assert.throws(() => extractPdfText(deep), (e) => e instanceof PdfError);
});

test('압축 폭탄: 스트림 해제 상한을 넘으면 크래시 없이 PdfError', () => {
  const bomb = zlib.deflateSync(Buffer.alloc(60 * 1024 * 1024)); // 60MB(상한 50MB) 가 수십 KB 로 압축
  const pdf = h.assemble([
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { num: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { num: 3, body: '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>' },
    { num: 4, body: Buffer.concat([h.L(`<< /Length ${bomb.length} /Filter /FlateDecode >>\nstream\n`), bomb, h.L('\nendstream')]) },
  ]);
  assert.throws(() => extractPdfText(pdf), (e) => e instanceof PdfError && (e.code === 'CORRUPT' || e.code === 'NO_TEXT'));
});

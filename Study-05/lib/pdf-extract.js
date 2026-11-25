// 작성일: 2026-11-25 18:01 (수정됨 2026-11-25 18:23)
// 경량 PDF 텍스트 추출기(node:zlib만 사용). xref 에 의존하지 않고 "N G obj ... endobj" 를 직접 스캔한다.
// 지원: 무압축/FlateDecode 스트림, ObjStm, Pages 트리 순서, Tj/TJ/'/", ToUnicode CMap(bfchar/bfrange, 2바이트 Identity-H).
// 한계: 스캔본(OCR 없음), 암호화, LZW/ASCII85/예측기(Predictor) 스트림, Form XObject(Do) 안의 글자, /Differences 글리프 이름, 세로쓰기.
'use strict';

const zlib = require('node:zlib');

const MAX_STREAM_OUTPUT = 50 * 1024 * 1024; // 스트림 하나당 해제 상한
const MAX_TOTAL_OUTPUT = 300 * 1024 * 1024; // 문서 전체 해제 상한(압축 폭탄 방지)
const MAX_OBJECTS = 200000;
const MAX_PAGES = 2000;
const MAX_PAGE_TEXT = 2000000; // 페이지당 글자 상한
const MAX_TOTAL_TEXT = 10000000;
const MAX_DEPTH = 64;
const MAX_CMAP_ENTRIES = 300000;
const TIME_LIMIT_MS = 8000;

class PdfError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'PdfError';
    this.code = code; // 'ENCRYPTED' | 'NO_TEXT' | 'CORRUPT'
  }
}

class Ref {
  constructor(num, gen) {
    this.num = num;
    this.gen = gen;
  }
}

// ---------- 렉서 (입력은 latin1 문자열: 문자 코드 = 바이트) ----------
const WS = new Uint8Array(256);
const DELIM = new Uint8Array(256);
for (const c of [0, 9, 10, 12, 13, 32]) WS[c] = 1;
for (const ch of '()<>[]{}/%') DELIM[ch.charCodeAt(0)] = 1;
const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

class Lexer {
  constructor(s, pos = 0) {
    this.s = s;
    this.pos = pos;
  }

  skipWs() {
    const s = this.s;
    const n = s.length;
    let p = this.pos;
    while (p < n) {
      const c = s.charCodeAt(p);
      if (c < 256 && WS[c]) p++;
      else if (c === 37) {
        while (p < n) {
          const d = s.charCodeAt(p);
          if (d === 10 || d === 13) break;
          p++;
        }
      } else break;
    }
    this.pos = p;
  }

  next() {
    const s = this.s;
    const n = s.length;
    for (;;) {
      this.skipWs();
      if (this.pos >= n) return null;
      const c = s.charCodeAt(this.pos);
      switch (c) {
        case 47: return this.readName();
        case 40: return this.readLiteral();
        case 60:
          if (s.charCodeAt(this.pos + 1) === 60) { this.pos += 2; return { k: '<<' }; }
          return this.readHex();
        case 62:
          if (s.charCodeAt(this.pos + 1) === 62) { this.pos += 2; return { k: '>>' }; }
          this.pos++;
          continue;
        case 91: this.pos++; return { k: '[' };
        case 93: this.pos++; return { k: ']' };
        case 123: case 125: case 41: this.pos++; continue; // { } ) 단독은 무시
        default: return this.readRegular();
      }
    }
  }

  readName() {
    const s = this.s;
    const n = s.length;
    let p = this.pos + 1;
    const start = p;
    while (p < n) {
      const c = s.charCodeAt(p);
      if (c < 256 && (WS[c] || DELIM[c])) break;
      p++;
    }
    this.pos = p;
    const raw = s.slice(start, p).replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    return { k: 'name', v: raw };
  }

  readLiteral() {
    const s = this.s;
    const n = s.length;
    const out = [];
    let depth = 1;
    let p = this.pos + 1;
    while (p < n) {
      const c = s.charCodeAt(p++);
      if (c === 92) {
        if (p >= n) break;
        const e = s.charCodeAt(p++);
        switch (e) {
          case 110: out.push(10); break;
          case 114: out.push(13); break;
          case 116: out.push(9); break;
          case 98: out.push(8); break;
          case 102: out.push(12); break;
          case 13: if (s.charCodeAt(p) === 10) p++; break;
          case 10: break;
          default:
            if (e >= 48 && e <= 55) {
              let v = e - 48;
              for (let i = 0; i < 2; i++) {
                const d = s.charCodeAt(p);
                if (d >= 48 && d <= 55) { v = v * 8 + (d - 48); p++; } else break;
              }
              out.push(v & 255);
            } else out.push(e & 255); // \( \) \\ 및 알 수 없는 이스케이프
        }
      } else if (c === 40) { depth++; out.push(c); }
      else if (c === 41) { if (--depth === 0) break; out.push(c); }
      else out.push(c & 255);
    }
    this.pos = p;
    return { k: 'str', v: Buffer.from(out) };
  }

  readHex() {
    const s = this.s;
    let end = s.indexOf('>', this.pos + 1);
    if (end < 0) end = s.length;
    let hex = s.slice(this.pos + 1, end).replace(/[^0-9A-Fa-f]/g, '');
    if (hex.length % 2) hex += '0';
    this.pos = end + 1;
    return { k: 'str', v: Buffer.from(hex, 'hex') };
  }

  readRegular() {
    const s = this.s;
    const n = s.length;
    const start = this.pos;
    let p = start;
    while (p < n) {
      const c = s.charCodeAt(p);
      if (c < 256 && (WS[c] || DELIM[c])) break;
      p++;
    }
    if (p === start) p++;
    this.pos = p;
    const tok = s.slice(start, p);
    if (NUM_RE.test(tok)) return { k: 'num', v: Number(tok) };
    return { k: 'kw', v: tok };
  }
}

const STOP_KW = new Set(['endobj', 'stream', 'endstream']);

// 토큰 하나에서 시작해 PDF 값을 만든다. 이름은 '/Name' 문자열, 문자열은 Buffer, 사전은 Map(키는 슬래시 없음).
function fromToken(lx, tok, depth, allowRef = true) {
  if (!tok) return undefined;
  if (depth > MAX_DEPTH) throw new PdfError('CORRUPT', 'too deep');
  switch (tok.k) {
    case 'num': {
      if (allowRef && Number.isInteger(tok.v) && tok.v >= 0) {
        const save = lx.pos;
        const t2 = lx.next();
        if (t2 && t2.k === 'num' && Number.isInteger(t2.v) && t2.v >= 0) {
          const t3 = lx.next();
          if (t3 && t3.k === 'kw' && t3.v === 'R') return new Ref(tok.v, t2.v);
        }
        lx.pos = save;
      }
      return tok.v;
    }
    case 'name': return '/' + tok.v;
    case 'str': return tok.v;
    case '[': {
      const arr = [];
      for (;;) {
        const t = lx.next();
        if (!t || t.k === ']' || t.k === '>>') break;
        if (t.k === 'kw' && STOP_KW.has(t.v)) break;
        arr.push(fromToken(lx, t, depth + 1, allowRef));
        if (arr.length > 1000000) throw new PdfError('CORRUPT', 'array too large');
      }
      return arr;
    }
    case '<<': {
      const m = new Map();
      for (;;) {
        const t = lx.next();
        if (!t || t.k === '>>') break;
        if (t.k === 'kw' && STOP_KW.has(t.v)) break;
        if (t.k !== 'name') continue;
        const vt = lx.next();
        if (!vt || vt.k === '>>') break;
        m.set(t.v, fromToken(lx, vt, depth + 1, allowRef));
      }
      return m;
    }
    case 'kw':
      if (tok.v === 'true') return true;
      if (tok.v === 'false') return false;
      return null;
    default: return undefined;
  }
}

// ---------- 문자 변환 ----------
const CP1252_HIGH = ['€', '', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '', 'Ž', '', '', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '', 'ž', 'Ÿ'];

function latin1Char(b) {
  if (b >= 0x80 && b <= 0x9f) return CP1252_HIGH[b - 0x80];
  if (b < 0x20) return b === 9 || b === 10 || b === 13 ? ' ' : '';
  return String.fromCharCode(b);
}

function utf16Hex(hex) {
  if (hex.length % 2) hex += '0';
  let out = '';
  if (hex.length <= 2) return hex ? String.fromCharCode(parseInt(hex, 16)) : '';
  for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

function parseToUnicode(text) {
  const map = new Map();
  let spaceBytes = 0;
  let inferred = 0;
  for (const m of text.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    const h = /<([0-9A-Fa-f]+)>/.exec(m[1]);
    if (h) spaceBytes = Math.max(spaceBytes, Math.ceil(h[1].length / 2));
  }
  for (const m of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of m[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
      if (map.size > MAX_CMAP_ENTRIES) break;
      inferred = Math.max(inferred, Math.ceil(p[1].length / 2));
      map.set(parseInt(p[1], 16), utf16Hex(p[2]));
    }
  }
  for (const m of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of m[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]*)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(p[1], 16);
      const hi = parseInt(p[2], 16);
      inferred = Math.max(inferred, Math.ceil(p[1].length / 2));
      if (!(hi >= lo) || hi - lo > 65535 || map.size > MAX_CMAP_ENTRIES) continue;
      if (p[3] !== undefined) {
        const base = utf16Hex(p[3]);
        if (!base) continue;
        const head = base.slice(0, -1);
        const last = base.charCodeAt(base.length - 1);
        for (let i = 0; i <= hi - lo; i++) map.set(lo + i, head + String.fromCharCode(last + i));
      } else {
        const items = [...p[4].matchAll(/<([0-9A-Fa-f]*)>/g)];
        for (let i = 0; i < items.length && lo + i <= hi; i++) map.set(lo + i, utf16Hex(items[i][1]));
      }
    }
  }
  return { map, codeBytes: spaceBytes || inferred || 0 };
}

function decodeWithFont(font, buf) {
  let r = '';
  if (font.codeBytes === 2) {
    for (let i = 0; i + 1 < buf.length; i += 2) {
      const m = font.cmap ? font.cmap.get((buf[i] << 8) | buf[i + 1]) : undefined;
      if (m !== undefined) r += m;
    }
  } else {
    for (let i = 0; i < buf.length; i++) {
      const m = font.cmap ? font.cmap.get(buf[i]) : undefined;
      r += m !== undefined ? m : latin1Char(buf[i]);
    }
  }
  return r;
}

const DEFAULT_FONT = { cmap: null, codeBytes: 1, widths: null };

// 폭 정보가 없을 때의 추정(em): 한글·CJK·전각 1, 공백 0.25, 대문자·m·w 약간 넓게
function fallbackEm(ch) {
  if (!ch) return 0.5;
  const c = ch.codePointAt(0);
  if (c === 32 || c === 0xa0) return 0.25;
  if ((c >= 0x1100 && c <= 0x11ff) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7af) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || c >= 0x20000) return 1;
  if (ch === 'm' || ch === 'w') return 0.8;
  if (ch === 'M' || ch === 'W') return 0.9;
  if (c >= 65 && c <= 90) return 0.65;
  if ("il.,;:'|!".includes(ch)) return 0.3;
  return 0.5;
}

// 글자 코드별 { code, text, em }
function glyphAdvances(font, buf) {
  const res = [];
  const n = font.codeBytes === 2 ? 2 : 1;
  for (let i = 0; i + n <= buf.length; i += n) {
    const code = n === 2 ? (buf[i] << 8) | buf[i + 1] : buf[i];
    const m = font.cmap ? font.cmap.get(code) : undefined;
    const text = m !== undefined ? m : n === 1 ? latin1Char(code) : '';
    let em;
    const w = font.widths;
    if (w) {
      const v = w.map.get(code);
      em = (v !== undefined ? v : w.dflt) / 1000;
      if (!(em > 0) && w.dflt === 0 && v === undefined) em = fallbackEm(text);
    } else {
      em = fallbackEm(text);
    }
    res.push({ code, text, em, n });
  }
  return res;
}

// ---------- 문서 ----------
class PdfDoc {
  constructor(buf) {
    this.buf = buf;
    this.s = buf.toString('latin1');
    this.objects = new Map(); // num -> { val, stream:Buffer|null, decoded }
    this.totalOut = 0;
    this.okStreams = 0;
    this.failedStreams = 0;
    this.partialStreams = 0;
    this.missingPages = 0;
    this.deadline = Date.now() + TIME_LIMIT_MS;
    this.fontCache = new Map();
  }

  tick() {
    if (Date.now() > this.deadline) throw new PdfError('CORRUPT', 'timeout');
  }

  entry(v) {
    for (let i = 0; i < 16; i++) {
      if (v instanceof Ref) {
        const e = this.objects.get(v.num);
        if (!e) return null;
        if (e.val instanceof Ref) { v = e.val; continue; }
        return e;
      }
      return { val: v, stream: null, decoded: null };
    }
    return null;
  }

  resolve(v) {
    const e = this.entry(v);
    return e ? e.val : undefined;
  }

  scan() {
    const { s, buf } = this;
    const re = /(?<![0-9A-Za-z])(\d{1,10})[\0\t\n\f\r ]+(\d{1,5})[\0\t\n\f\r ]+obj(?![0-9A-Za-z])/g;
    let m;
    let count = 0;
    while ((m = re.exec(s))) {
      if (++count > MAX_OBJECTS) throw new PdfError('CORRUPT', 'too many objects');
      if ((count & 255) === 0) this.tick();
      const num = Number(m[1]);
      const lx = new Lexer(s, re.lastIndex);
      let val;
      try {
        val = fromToken(lx, lx.next(), 0);
      } catch (e) {
        if (e instanceof PdfError && e.message === 'timeout') throw e;
        continue;
      }
      let stream = null;
      let after = lx.pos;
      if (val instanceof Map) {
        const t = lx.next();
        if (t && t.k === 'kw' && t.v === 'stream') {
          let p = lx.pos;
          if (s[p] === '\r' && s[p + 1] === '\n') p += 2;
          else if (s[p] === '\n' || s[p] === '\r') p++;
          let end;
          const len = val.get('Length');
          if (typeof len === 'number' && len >= 0 && p + len <= s.length && /^[\0\t\n\f\r ]*endstream/.test(s.slice(p + len, p + len + 16))) {
            end = p + len;
          } else {
            const idx = s.indexOf('endstream', p);
            if (idx >= 0) {
              end = idx;
              if (s[end - 1] === '\n') end--;
              if (s[end - 1] === '\r') end--;
            } else end = s.length;
          }
          stream = buf.subarray(p, end);
          after = end;
        }
      }
      this.objects.set(num, { val, stream, decoded: null });
      re.lastIndex = Math.max(after, m.index + m[0].length);
    }
  }

  inflate(raw) {
    const limit = Math.min(MAX_STREAM_OUTPUT, MAX_TOTAL_OUTPUT - this.totalOut);
    if (limit <= 0) throw new PdfError('CORRUPT', 'output budget exceeded');
    let out;
    try {
      out = zlib.inflateSync(raw, { maxOutputLength: limit });
    } catch (e) {
      if (e.code === 'ERR_BUFFER_TOO_LARGE') return null;
      try {
        out = zlib.inflateSync(raw, { maxOutputLength: limit, finishFlush: zlib.constants.Z_SYNC_FLUSH });
        this.partialStreams++;
      } catch {
        return null;
      }
    }
    this.totalOut += out.length;
    return out;
  }

  // -> { data } | { status: 'unsupported' | 'failed' }
  decode(entry) {
    if (entry.decoded) return entry.decoded;
    const dict = entry.val instanceof Map ? entry.val : new Map();
    let filters = this.resolve(dict.get('Filter'));
    if (filters === undefined || filters === null) filters = [];
    if (!Array.isArray(filters)) filters = [filters];
    filters = filters.map((f) => this.resolve(f));
    let parms = this.resolve(dict.get('DecodeParms'));
    if (!Array.isArray(parms)) parms = [parms];
    let data = entry.stream;
    let result;
    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      const p = this.resolve(parms[i]);
      const predictor = p instanceof Map ? this.resolve(p.get('Predictor')) : 1;
      if (f === '/FlateDecode' || f === '/Fl') {
        if (typeof predictor === 'number' && predictor > 1) { result = { status: 'unsupported' }; break; }
        const out = this.inflate(data);
        if (!out) { result = { status: 'failed' }; break; }
        data = out;
      } else if (f === '/ASCIIHexDecode' || f === '/AHx') {
        const hex = data.toString('latin1').replace(/>.*$/s, '').replace(/[^0-9A-Fa-f]/g, '');
        data = Buffer.from(hex.length % 2 ? hex + '0' : hex, 'hex');
      } else {
        result = { status: 'unsupported' };
        break;
      }
    }
    if (!result) result = { data };
    if (result.data) this.okStreams++;
    else if (result.status === 'failed') this.failedStreams++;
    entry.decoded = result;
    return result;
  }

  expandObjStms() {
    const list = [...this.objects.values()].filter((e) => e.stream && e.val instanceof Map && e.val.get('Type') === '/ObjStm');
    for (const e of list) {
      this.tick();
      const r = this.decode(e);
      if (!r.data) continue;
      const n = this.resolve(e.val.get('N'));
      const first = this.resolve(e.val.get('First'));
      if (!Number.isInteger(n) || !Number.isInteger(first) || n < 0 || n > MAX_OBJECTS || first < 0) continue;
      const s2 = r.data.toString('latin1');
      const hx = new Lexer(s2, 0);
      const pairs = [];
      for (let i = 0; i < n; i++) {
        const a = hx.next();
        const b = hx.next();
        if (!a || !b || a.k !== 'num' || b.k !== 'num') break;
        pairs.push([a.v, b.v]);
      }
      for (const [onum, off] of pairs) {
        if (this.objects.has(onum)) continue;
        if (this.objects.size > MAX_OBJECTS) throw new PdfError('CORRUPT', 'too many objects');
        try {
          const lx = new Lexer(s2, first + off);
          this.objects.set(onum, { val: fromToken(lx, lx.next(), 0), stream: null, decoded: null });
        } catch (err) {
          if (err instanceof PdfError && err.message === 'timeout') throw err;
        }
      }
    }
  }

  collectPages() {
    const pages = [];
    const seen = new Set();
    let catalog = null;
    for (const e of this.objects.values()) {
      if (e.val instanceof Map && e.val.get('Type') === '/Catalog' && e.val.has('Pages')) catalog = e.val;
    }
    const walk = (node, inheritedRes, depth) => {
      if (pages.length >= MAX_PAGES || depth > MAX_DEPTH) return;
      if (node instanceof Ref) {
        if (seen.has(node.num)) return;
        seen.add(node.num);
      }
      const d = this.resolve(node);
      if (!(d instanceof Map)) { if (node instanceof Ref) this.missingPages++; return; }
      const res = d.has('Resources') ? d.get('Resources') : inheritedRes;
      const kids = this.resolve(d.get('Kids'));
      if (d.get('Type') === '/Pages' || Array.isArray(kids)) {
        if (Array.isArray(kids)) for (const k of kids) walk(k, res, depth + 1);
      } else {
        pages.push({ dict: d, res });
      }
    };
    if (catalog) walk(catalog.get('Pages'), undefined, 0);
    if (!pages.length) {
      const nums = [...this.objects.keys()].sort((a, b) => a - b);
      for (const n of nums) {
        const d = this.objects.get(n).val;
        if (d instanceof Map && d.get('Type') === '/Page') pages.push({ dict: d, res: d.get('Resources') });
        if (pages.length >= MAX_PAGES) break;
      }
    }
    return pages;
  }

  // 글꼴 폭(1000분율). -> { get(code) -> 숫자|undefined } | null
  fontWidths(fd) {
    try {
      const num = (v) => { const n = this.resolve(v); return typeof n === 'number' && Number.isFinite(n) ? n : undefined; };
      const map = new Map();
      let dflt;
      if (fd.get('Subtype') === '/Type0') {
        const desc = this.resolve(fd.get('DescendantFonts'));
        const df = this.resolve(Array.isArray(desc) ? desc[0] : desc);
        if (!(df instanceof Map)) return null;
        dflt = num(df.get('DW'));
        if (dflt === undefined) dflt = 1000;
        const w = this.resolve(df.get('W'));
        if (Array.isArray(w)) {
          for (let i = 0; i < w.length && map.size < MAX_CMAP_ENTRIES;) {
            const c1 = num(w[i]);
            const nx = this.resolve(w[i + 1]);
            if (c1 === undefined) { i++; continue; }
            if (Array.isArray(nx)) {
              for (let k = 0; k < nx.length; k++) { const v = num(nx[k]); if (v !== undefined) map.set(c1 + k, v); }
              i += 2;
            } else {
              const c2 = num(nx);
              const v = num(w[i + 2]);
              if (c2 !== undefined && v !== undefined && c2 >= c1 && c2 - c1 <= 65535) {
                for (let c = c1; c <= c2 && map.size < MAX_CMAP_ENTRIES; c++) map.set(c, v);
              }
              i += 3;
            }
          }
        }
      } else {
        const first = num(fd.get('FirstChar'));
        const w = this.resolve(fd.get('Widths'));
        if (first === undefined || !Array.isArray(w)) return null;
        const desc = this.resolve(fd.get('FontDescriptor'));
        dflt = desc instanceof Map ? num(desc.get('MissingWidth')) : undefined;
        if (dflt === undefined) dflt = 0;
        for (let k = 0; k < w.length && k < 65536; k++) { const v = num(w[k]); if (v !== undefined) map.set(first + k, v); }
      }
      return { map, dflt };
    } catch {
      return null;
    }
  }

  fontFor(ref) {
    const fd = this.resolve(ref);
    if (!(fd instanceof Map)) return DEFAULT_FONT;
    if (this.fontCache.has(fd)) return this.fontCache.get(fd);
    let font = { cmap: null, codeBytes: fd.get('Subtype') === '/Type0' ? 2 : 1 };
    const widths = this.fontWidths(fd);
    const tu = this.entry(fd.get('ToUnicode'));
    if (tu && tu.stream) {
      const r = this.decode(tu);
      if (r.data) {
        const { map, codeBytes } = parseToUnicode(r.data.toString('latin1'));
        if (map.size) font = { cmap: map, codeBytes: codeBytes === 2 || codeBytes === 1 ? codeBytes : font.codeBytes };
      }
    }
    font.widths = widths;
    this.fontCache.set(fd, font);
    return font;
  }

  pageText(page) {
    const raw = page.dict.get('Contents');
    const resolved = this.resolve(raw);
    const list = Array.isArray(resolved) ? resolved : [raw];
    const parts = [];
    for (const c of list) {
      const e = this.entry(c);
      if (!e || !e.stream) continue;
      const r = this.decode(e);
      if (r.data) parts.push(r.data.toString('latin1'));
    }
    if (!parts.length) return '';
    const res = this.resolve(page.res);
    const fontDict = res instanceof Map ? this.resolve(res.get('Font')) : null;
    const fonts = (name) => (fontDict instanceof Map && fontDict.has(name) ? this.fontFor(fontDict.get(name)) : DEFAULT_FONT);
    return interpret(parts.join('\n'), fonts, this);
  }
}

// ---------- 콘텐츠 스트림 해석 ----------
function interpret(content, fonts, doc) {
  const lx = new Lexer(content);
  let out = '';
  let font = DEFAULT_FONT;
  let st = [];
  let ops = 0;
  // 텍스트 위치 추적(페이지 공간 근사: Tm/Td/TD/T*/TL/Tf 반영, CTM 은 무시)
  let fs = 0; // Tf 글꼴 크기
  let leading = 0; // TL
  let scale = 1; // Tm 의 세로 배율(|d|)
  let lineX = 0;
  let lineY = 0;
  let penX = 0; // 현재 펜 위치(TJ 간격 반영)
  let endX = null; // 직전에 그린 텍스트의 추정 끝 X
  let endY = null;
  let tc = 0; // Tc 글자 간격
  let tw = 0; // Tw 단어 간격
  let tz = 1; // Tz 가로 배율

  const size = () => (fs > 0 ? fs : 10) * scale;
  const fs0 = () => (fs > 0 ? fs : 10) * scale;
  const nl = () => { if (out && !out.endsWith('\n')) out += '\n'; };
  const sp = () => { if (out && !/\s$/.test(out)) out += ' '; };
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const moveLine = (x, y) => { lineX = x; lineY = y; penX = x; };
  // 그리기 직전: 직전 글자 끝과 비교해 줄바꿈/공백 결정. ET 는 단서로 쓰지 않는다.
  const gap = () => {
    if (endX === null) return;
    const sz = size();
    if (Math.abs(lineY - endY) > sz * 0.5) nl();
    else if (penX - endX >= sz * 0.2 - 1e-6 || endX - penX > sz * 2) sp();
  };
  const show = (b) => {
    if (!Buffer.isBuffer(b) || out.length >= MAX_PAGE_TEXT) return;
    const t = decodeWithFont(font, b);
    if (!t) return;
    gap();
    out += t;
    for (const g of glyphAdvances(font, b)) {
      penX += (g.em * fs0() + (tc + (g.code === 32 && g.n === 1 ? tw : 0)) * scale) * tz;
    }
    endX = penX;
    endY = lineY;
  };

  for (let tok = lx.next(); tok; tok = lx.next()) {
    if ((++ops & 1023) === 0) doc.tick();
    if (out.length >= MAX_PAGE_TEXT) break;
    switch (tok.k) {
      case 'num': st.push(tok.v); break;
      case 'name': st.push('/' + tok.v); break;
      case 'str': st.push(tok.v); break;
      case '[': case '<<': st.push(fromToken(lx, tok, 0, false)); break;
      case 'kw': {
        const a = st;
        switch (tok.v) {
          case 'BT': moveLine(0, 0); scale = 1; break;
          case 'Tf': {
            font = fonts(String(a[0]).replace(/^\//, ''));
            const z = num(a[1]);
            if (!Number.isNaN(z)) fs = Math.abs(z);
            break;
          }
          case 'Tc': { const v = num(a[a.length - 1]); if (!Number.isNaN(v)) tc = v; break; }
          case 'Tw': { const v = num(a[a.length - 1]); if (!Number.isNaN(v)) tw = v; break; }
          case 'Tz': { const v = num(a[a.length - 1]); if (!Number.isNaN(v) && v !== 0) tz = Math.abs(v) / 100; break; }
          case 'TL': { const v = num(a[a.length - 1]); if (!Number.isNaN(v)) leading = v; break; }
          case 'Tj': show(a[a.length - 1]); break;
          case 'TJ': {
            const arr = a[a.length - 1];
            if (Array.isArray(arr)) {
              for (const it of arr) {
                if (Buffer.isBuffer(it)) show(it);
                else if (typeof it === 'number') penX -= (it / 1000) * size() * tz;
              }
            }
            break;
          }
          case "'": moveLine(lineX, lineY - leading); show(a[a.length - 1]); break;
          case '"': moveLine(lineX, lineY - leading); show(a[a.length - 1]); break;
          case 'Td': case 'TD': {
            const tx = num(a[a.length - 2]);
            const ty = num(a[a.length - 1]);
            if (!Number.isNaN(tx) && !Number.isNaN(ty)) {
              if (tok.v === 'TD') leading = -ty;
              moveLine(lineX + tx * scale, lineY + ty * scale);
            }
            break;
          }
          case 'T*': moveLine(lineX, lineY - leading); break;
          case 'Tm': {
            const d = num(a[3]);
            const e = num(a[4]);
            const f = num(a[5]);
            if (!Number.isNaN(e) && !Number.isNaN(f)) {
              scale = !Number.isNaN(d) && d !== 0 ? Math.abs(d) : 1;
              moveLine(e, f);
            }
            break;
          }
          case 'BI': {
            const idm = /\sID\s/g;
            idm.lastIndex = lx.pos;
            const m1 = idm.exec(content);
            if (!m1) { lx.pos = content.length; break; }
            const eim = /\sEI(?=\s|$)/g;
            eim.lastIndex = m1.index + m1[0].length;
            const m2 = eim.exec(content);
            lx.pos = m2 ? m2.index + m2[0].length : content.length;
            break;
          }
          default: break;
        }
        st = [];
        break;
      }
      default: break;
    }
    if (st.length > 256) st = st.slice(-256);
  }
  return out;
}

const LIGATURES = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'ft', 'ﬆ': 'st' };

function cleanText(t) {
  return t
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c])
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F�]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .normalize('NFC');
}

function extract(input) {
  let buf;
  if (Buffer.isBuffer(input)) buf = input;
  else if (input instanceof Uint8Array) buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  else throw new PdfError('CORRUPT', 'not a buffer');
  if (buf.length < 8) throw new PdfError('CORRUPT', 'too small');
  const head = buf.subarray(0, 1024).indexOf('%PDF-');
  if (head < 0) throw new PdfError('CORRUPT', 'no header');

  const doc = new PdfDoc(buf);
  if (/\/Encrypt\s*(?:\d+\s+\d+\s+R|<<)/.test(doc.s)) throw new PdfError('ENCRYPTED', 'encrypted');
  doc.scan();
  if (!doc.objects.size) throw new PdfError('CORRUPT', 'no objects');
  doc.expandObjStms();
  const pages = doc.collectPages();
  if (!pages.length) throw new PdfError('CORRUPT', 'no pages');

  const texts = [];
  let total = 0;
  for (const p of pages) {
    if (Date.now() > doc.deadline || total > MAX_TOTAL_TEXT) break;
    const t = cleanText(doc.pageText(p));
    total += t.length;
    if (t) texts.push(t);
  }
  const text = texts.join('\n\n');
  if (!/\S/.test(text)) {
    // 손상 신호: 스트림 해제 실패/부분 해제, %%EOF 없음(중간에서 잘림), Pages 트리 참조 객체 누락
    const damaged = (doc.failedStreams > 0 && doc.okStreams === 0) || doc.partialStreams > 0
      || !/%%EOF/.test(doc.s.slice(-1100)) || doc.missingPages > 0;
    if (damaged) throw new PdfError('CORRUPT', 'damaged');
    throw new PdfError('NO_TEXT', 'no text');
  }
  return { text, pages: pages.length };
}

function extractPdfText(buffer) {
  try {
    return extract(buffer);
  } catch (err) {
    if (err instanceof PdfError) throw err;
    throw new PdfError('CORRUPT', 'parse failed');
  }
}

module.exports = { extractPdfText, PdfError };

// 작성일: 2026-11-25 03:12 (수정됨) 2026-11-25 05:10
// 냉장고를 부탁해 - 브라우저 쪽 코드 (API 키는 서버만 알고 있음)
'use strict';

const $ = (sel) => document.querySelector(sel);

const state = {
  demo: false,
  imageDataUrl: null,
  ingredients: [], // { name, quantity, category } — 직접 추가한 재료는 category ''
  cuisine: '아무거나',
  difficulty: '아무거나',
  recipes: [],
  user: null, // { id, username, nickname }
  savedTitles: new Set(), // 이미 저장한 레시피 제목(중복 저장 방지 표시)
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const RESIZE_MAX_SIDE = 1024;

// ---------- 공통 ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(message, isError = false) {
  const el = $('#toast');
  // 오류는 화면 읽기 프로그램이 바로 읽도록 alert, 안내는 하던 말을 끊지 않도록 status
  el.setAttribute('role', isError ? 'alert' : 'status');
  el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 7000 : 3000);
}

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('서버에 연결하지 못했어요. 인터넷 연결이나 서버가 켜져 있는지 확인한 뒤 다시 시도해 주세요.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    err.status = res.status;
    // 로그인했던 세션이 끊긴 경우(서버 재시작·만료) 공통 처리. 로그인/가입 요청 자체의 401은 제외.
    if (res.status === 401 && path !== '/api/login' && path !== '/api/register') handleSessionExpired();
    throw err;
  }
  return data;
}

const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐어요. 다시 로그인해 주세요.';

function handleSessionExpired() {
  const wasLoggedIn = !!state.user;
  setUser(null);
  state.savedTitles = new Set();
  if (state.recipes.length) renderRecipes({ scroll: false });
  // 로그인이 필요한 화면을 보고 있었으면 다시 로그인한 뒤 그 화면을 이어서 연다.
  if (wasLoggedIn && (currentView === 'saved' || currentView === 'dashboard')) {
    const view = currentView;
    openAuth(() => showView(view), SESSION_EXPIRED_MESSAGE);
  }
}

// 버튼 옆 상태 글자. isError 면 빨간 글자로 남겨 두어 무엇이 잘못됐는지 버튼 가까이에서 보이게 한다.
function setStatus(el, text, isError = false) {
  el.classList.toggle('error', isError);
  el.textContent = text;
}

// 오래 걸리는 작업(최대 1분) 동안 버튼을 막고, 몇 초째 기다리는지 보여 준다.
// 돌려주는 함수에 오류 문구를 넘기면 그 문구를 상태 칸에 남긴다.
function setBusy(button, statusEl, busyText) {
  button.disabled = true;
  const card = button.closest('.card');
  card?.setAttribute('aria-busy', 'true');
  statusEl.classList.remove('error');
  // 화면 읽기 프로그램에는 안내 문구만 한 번 읽히고, 매초 바뀌는 초 표시는 읽히지 않게 한다.
  statusEl.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escapeHtml(busyText)} <span class="elapsed" aria-hidden="true"></span>`;
  const elapsed = statusEl.querySelector('.elapsed');
  const started = Date.now();
  const timer = setInterval(() => {
    const sec = Math.floor((Date.now() - started) / 1000);
    elapsed.textContent = sec >= 3 ? `${sec}초째` : '';
  }, 1000);
  return (resultText = '', isError = false) => {
    clearInterval(timer);
    card?.removeAttribute('aria-busy');
    button.disabled = false;
    setStatus(statusEl, resultText, isError);
  };
}

// 결과가 나온 카드로 화면을 옮기고, 키보드·화면 읽기 사용자를 위해 제목에 포커스를 준다.
function moveTo(cardSelector, headingSelector) {
  const card = $(cardSelector);
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $(headingSelector)?.focus({ preventScroll: true });
}

// ---------- 상태 / 데모 배너 ----------
const DEMO_TEXT = {
  'no-key': {
    title: '데모 모드: API 키 없음',
    detail: '샘플 재료와 샘플 레시피를 보여 줍니다. <code>.env</code>에 <code>OPENROUTER_API_KEY</code>를 넣고 서버를 다시 켜면 실제 AI를 씁니다.',
  },
  forced: {
    title: '데모 모드: 직접 켬',
    detail: '<code>--demo</code> 또는 <code>DEMO_MODE=1</code>로 켜서 AI 대신 샘플 재료와 샘플 레시피를 보여 줍니다. 실제 AI를 쓰려면 이 설정 없이 서버를 다시 켜세요.',
  },
};

async function loadStatus() {
  try {
    const status = await api('/api/status');
    state.demo = status.demo;
    $('#demo-banner').hidden = !status.demo;
    if (status.demo) {
      const text = DEMO_TEXT[status.demoReason] || DEMO_TEXT['no-key'];
      $('#demo-title').textContent = text.title;
      $('#demo-detail').innerHTML = text.detail; // 고정 문구(사용자·모델 문자열 아님)
    }
    renderPills('#cuisine-options', status.options.cuisines, 'cuisine');
    renderPills('#difficulty-options', status.options.difficulties, 'difficulty');
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- 1단계: 사진 올리기 ----------
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요.'));
    reader.readAsDataURL(file);
  });
}

// 긴 변을 1024px로 줄인 JPEG data URL (전송량·API 처리 시간 감소)
async function resizeImage(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, RESIZE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // 투명 PNG 배경
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function handleFile(file) {
  if (!file) return;
  const status = $('#recognize-status');
  if (!ALLOWED_TYPES.includes(file.type)) {
    return setStatus(status, 'JPG, PNG, WEBP 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.', true);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return setStatus(status, '사진이 10MB보다 커요. 더 작은 사진을 고르거나 화면을 캡처해서 올려 주세요.', true);
  }
  try {
    const original = await readAsDataUrl(file);
    state.imageDataUrl = await resizeImage(original);
    $('#preview').src = state.imageDataUrl;
    $('#preview').hidden = false;
    $('#dropzone-text').innerHTML = '다른 사진으로 바꾸려면 여기를 다시 누르세요';
    $('#recognize-btn').disabled = false;
    setStatus(status, '사진이 준비됐어요. [재료 인식하기]를 눌러 주세요.');
  } catch {
    setStatus(status, '사진을 열지 못했어요. 다른 사진을 골라 주세요.', true);
  }
}

function setupUpload() {
  const dz = $('#dropzone');
  $('#file-input').addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
    e.target.value = ''; // 같은 사진을 다시 골라도 change 가 일어나게
  });
  ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
  $('#recognize-btn').addEventListener('click', recognize);
}

async function recognize() {
  if (!state.imageDataUrl) return;
  const done = setBusy($('#recognize-btn'), $('#recognize-status'),
    state.demo ? '샘플 재료를 불러오는 중…' : 'AI가 사진을 보는 중이에요. 보통 10~30초, 길면 1분까지 걸려요.');
  // 인식을 기다리는 동안 사용자가 직접 추가한 재료는 결과가 와도 지우지 않는다.
  const before = new Set(state.ingredients.map((i) => normKey(i.name)));
  try {
    const data = await api('/api/recognize', { method: 'POST', body: { image: state.imageDataUrl } });
    const addedMeanwhile = state.ingredients.filter((i) => !before.has(normKey(i.name)));
    const merged = mergeIngredients(data.ingredients, addedMeanwhile);
    state.ingredients = merged.list;
    renderIngredients();
    if (!data.ingredients.length) {
      done('재료를 찾지 못했어요. 냉장고 안을 더 밝고 가까이 찍어 다시 올리거나, 아래 2번에 재료를 직접 적어 주세요.', true);
      return;
    }
    done(`재료 ${data.ingredients.length}개를 찾았어요. 아래 2번에서 맞는지 확인해 주세요.`);
    if (merged.dropped) toast(`재료는 ${MAX_INGREDIENTS}개까지만 넣을 수 있어서 ${merged.dropped}개는 빼 두었어요.`, true);
    moveTo('#ingredients-card', '#step2-title');
  } catch (err) {
    done(err.message, true);
  }
}

// ---------- 2단계: 재료 수정 ----------
const normKey = (s) => String(s).toLowerCase().replace(/\s+/g, '');
const MAX_INGREDIENTS = 40;

// 인식 결과 + 직접 추가한 재료를 이름(normKey) 기준으로 합친다. 직접 추가한 재료를 우선 남기고 40개로 자른다.
function mergeIngredients(recognized, manual) {
  const seen = new Set();
  const keep = [];
  for (const i of manual) {
    const k = normKey(i.name);
    if (!seen.has(k)) { seen.add(k); keep.push(i); }
  }
  const room = Math.max(0, MAX_INGREDIENTS - keep.length);
  const fromPhoto = [];
  let dropped = Math.max(0, keep.length - MAX_INGREDIENTS);
  for (const i of recognized) {
    const k = normKey(i.name);
    if (seen.has(k)) continue;
    seen.add(k);
    if (fromPhoto.length < room) fromPhoto.push(i);
    else dropped++;
  }
  return { list: [...fromPhoto, ...keep.slice(0, MAX_INGREDIENTS)], dropped };
}

function renderIngredients() {
  const list = $('#ingredient-list');
  const n = state.ingredients.length;
  if (!n) {
    list.innerHTML = '<li class="empty">아직 재료가 없어요. 위에서 사진을 인식하거나 아래 칸에 직접 적어 주세요.</li>';
  } else {
    // 인식 결과는 이름·대략 수량·분류(PRD 1단계)를 함께 보여 준다. 직접 추가한 재료는 분류가 없다.
    list.innerHTML = state.ingredients.map((i, idx) => `
      <li class="chip">
        ${i.category ? `<span class="cat">${escapeHtml(i.category)}</span>` : ''}
        <span>${escapeHtml(i.name)}</span>
        ${i.quantity && i.quantity !== '알 수 없음' ? `<span class="meta">${escapeHtml(i.quantity)}</span>` : ''}
        <button type="button" data-remove="${idx}" aria-label="${escapeHtml(i.name)} 지우기" title="지우기">×</button>
      </li>`).join('');
  }
  $('#ingredient-count').textContent = n ? `재료 ${n}개 (최대 ${MAX_INGREDIENTS}개)` : '';
  $('#clear-ingredients').hidden = n === 0;
  const recipeBtn = $('#recipe-btn');
  recipeBtn.disabled = n === 0;
  // 추천 버튼이 왜 안 눌리는지 바로 옆에서 알려 준다(작업 중 문구·오류 문구는 건드리지 않음).
  const status = $('#recipe-status');
  if (!status.querySelector('.spinner') && !status.classList.contains('error')) {
    status.textContent = n === 0 ? '재료를 1개 이상 넣으면 누를 수 있어요.' : '';
  }
}

function showIngredientError(message) {
  const input = $('#ingredient-input');
  const el = $('#ingredient-error');
  el.textContent = message;
  el.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

// 추가에 실패하면 이유(문장)를, 성공하면 '' 를 돌려준다.
function addIngredient(rawName) {
  const name = rawName.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) return '';
  if (state.ingredients.some((i) => normKey(i.name) === normKey(name))) return `'${name}'은(는) 이미 목록에 있어요.`;
  if (state.ingredients.length >= MAX_INGREDIENTS) return `재료는 ${MAX_INGREDIENTS}개까지만 넣을 수 있어요. 필요 없는 재료를 ×로 지운 뒤 추가해 주세요.`;
  state.ingredients.push({ name, quantity: '', category: '' });
  return '';
}

function setupIngredients() {
  const input = $('#ingredient-input');
  $('#add-ingredient-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) {
      showIngredientError('추가할 재료 이름을 적어 주세요.');
      input.focus();
      return;
    }
    // 쉼표로 여러 개를 한 번에 넣을 수 있다: "양배추, 버섯"
    const problems = parts.map(addIngredient).filter(Boolean);
    renderIngredients();
    showIngredientError(problems.join(' '));
    input.value = '';
    input.focus();
  });
  input.addEventListener('input', () => showIngredientError(''));
  $('#ingredient-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const idx = Number(btn.dataset.remove);
    state.ingredients.splice(idx, 1);
    renderIngredients();
    // 지운 자리의 다음 재료(없으면 입력칸)로 포커스를 옮겨 키보드로 이어서 지울 수 있게 한다.
    const buttons = document.querySelectorAll('#ingredient-list [data-remove]');
    (buttons[Math.min(idx, buttons.length - 1)] || input).focus();
  });
  $('#clear-ingredients').addEventListener('click', () => {
    const n = state.ingredients.length;
    if (n > 1 && !confirm(`재료 ${n}개를 모두 지울까요? 되돌릴 수 없어요.`)) return;
    state.ingredients = [];
    renderIngredients();
    showIngredientError('');
    input.focus();
  });
  $('#recipe-btn').addEventListener('click', requestRecipes);
}

// ---------- 2단계: 요리 종류·난이도 ----------
// role="radio" 묶음: Tab 으로는 선택된 항목 하나에만 들어가고, 화살표로 고른다(WAI-ARIA 라디오 그룹 방식).
function renderPills(selector, values, key) {
  const box = $(selector);
  const draw = (focus = false) => {
    box.innerHTML = values.map((v) => {
      const on = state[key] === v;
      return `<button type="button" class="pill" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`;
    }).join('');
    if (focus) box.querySelector('[aria-checked="true"]')?.focus();
  };
  const choose = (value, focus) => { state[key] = value; draw(focus); };
  draw();
  box.onclick = (e) => {
    const btn = e.target.closest('[data-value]');
    if (btn) choose(btn.dataset.value, true);
  };
  box.onkeydown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const cur = values.indexOf(state[key]);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? values.length - 1 : (cur + step + values.length) % values.length;
    choose(values[next], true);
  };
}

// ---------- 2단계: 레시피 ----------
async function requestRecipes() {
  if (!state.ingredients.length) return;
  const status = $('#recipe-status');
  status.classList.remove('error');
  const done = setBusy($('#recipe-btn'), status,
    state.demo ? '샘플 레시피를 고르는 중…' : 'AI가 레시피 3개를 만드는 중이에요. 보통 20~40초, 길면 1분까지 걸려요.');
  try {
    const data = await api('/api/recipes', {
      method: 'POST',
      body: { ingredients: state.ingredients.map((i) => i.name), cuisine: state.cuisine, difficulty: state.difficulty },
    });
    state.recipes = data.recipes;
    const note = $('#recipes-note');
    note.hidden = !data.fallback;
    note.textContent = data.fallback ? '고른 요리 종류·난이도에 맞는 샘플이 없어서 다른 샘플을 보여 드려요.' : '';
    done(data.recipes.length ? `레시피 ${data.recipes.length}개를 추천했어요.` : '');
    renderRecipes({ keepOpen: false, focus: true }); // 새 추천: 이전 카드의 펼침 상태를 쓰지 않고 첫 카드만 펼친다
  } catch (err) {
    done(err.message, true);
  } finally {
    $('#recipe-btn').disabled = state.ingredients.length === 0;
  }
}

// 레시피 카드 HTML. actions 는 카드 아래 버튼 영역(3단계 저장·삭제)에 들어갈 HTML.
// 가진 재료/더 필요한 재료는 색뿐 아니라 기호(✓ / +)와 숨은 글자로도 구분한다(색맹·화면 읽기 대응).
function recipeCardHtml(r, { open = false, actions = '' } = {}) {
  const needCount = r.ingredients.filter((i) => !i.have && !i.pantry).length;
  const ingClass = (i) => (i.have ? 'have' : i.pantry ? 'pantry' : 'need');
  const ingMark = (i) => (i.have
    ? '<span aria-hidden="true">✓ </span><span class="visually-hidden">있음: </span>'
    : i.pantry ? '<span class="visually-hidden">기본 양념: </span>'
      : '<span aria-hidden="true">+ </span><span class="visually-hidden">더 필요: </span>');
  return `
    <details class="recipe" ${open ? 'open' : ''}>
      <summary>
        <span class="recipe-title">${escapeHtml(r.title)}</span>
        <span class="tags">
          <span class="tag">${escapeHtml(r.cuisine)}</span>
          <span class="tag">${escapeHtml(r.difficulty)}</span>
          <span class="tag"><span aria-hidden="true">⏱ </span>${r.timeMinutes}분</span>
          <span class="tag">${r.servings}인분</span>
          <span class="tag ${needCount ? 'need' : 'have'}">${needCount ? `더 필요한 재료 ${needCount}개` : '재료 모두 있음'}</span>
        </span>
      </summary>
      <div class="recipe-body">
        <h3>재료</h3>
        <ul class="ing-list">
          ${r.ingredients.map((i) => `<li class="${ingClass(i)}">${ingMark(i)}${escapeHtml(i.name)} <small>${escapeHtml(i.amount)}</small></li>`).join('')}
        </ul>
        <div class="legend" aria-hidden="true">✓ 가진 재료 · + 더 필요한 재료 · 회색 글자: 집에 흔한 기본 양념</div>
        <h3>만드는 법</h3>
        <ol>${r.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
        ${r.tip ? `<div class="tip"><span aria-hidden="true">💡 </span>${escapeHtml(r.tip)}</div>` : ''}
        ${actions ? `<div class="recipe-actions">${actions}</div>` : ''}
      </div>
    </details>`;
}

const savingTitles = new Set(); // 저장 요청 중인 레시피 제목(연타 방지)

function saveButtonHtml(r, idx) {
  if (state.savedTitles.has(r.title)) return '<button class="btn small saved" type="button" disabled>✓ 저장됨</button>';
  if (savingTitles.has(r.title)) return '<button class="btn small primary" type="button" disabled>저장 중…</button>';
  const label = state.user ? '나의 레시피에 저장' : '로그인하고 저장';
  return `<button class="btn small primary" type="button" data-save="${idx}" aria-label="${escapeHtml(r.title)}: ${label}">${label}</button>`;
}

function renderRecipes({ scroll = true, keepOpen = true, focus = false } = {}) {
  $('#recipes-card').hidden = false;
  // 같은 레시피를 다시 그릴 때(저장 표시 등)만 펼쳐 둔 카드를 펼친 채로 둔다.
  const openIdx = keepOpen ? [...document.querySelectorAll('#recipe-list details')].map((d) => d.open) : [];
  $('#recipe-list').innerHTML = state.recipes.length
    ? state.recipes.map((r, idx) => recipeCardHtml(r, { open: openIdx.length ? !!openIdx[idx] : idx === 0, actions: saveButtonHtml(r, idx) })).join('')
    : '<p class="empty">조건에 맞는 레시피를 찾지 못했어요. 요리 종류나 난이도를 \'아무거나\'로 바꾸거나 재료를 더 넣고 다시 추천받아 보세요.</p>';
  if (focus) moveTo('#recipes-card', '#step4-title');
  else if (scroll) $('#recipes-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- 3단계: 로그인 ----------
let authMode = 'login';
let afterLogin = null; // 로그인 후 이어서 할 일(예: 저장)

function setUser(user) {
  state.user = user;
  $('#login-open').hidden = !!user;
  $('#user-info').hidden = !user;
  $('#user-nickname').textContent = user ? user.nickname : '';
}

function setAuthError(message, field = null) {
  const el = $('#auth-error');
  el.textContent = message;
  el.hidden = !message;
  ['#auth-username', '#auth-password', '#auth-nickname'].forEach((sel) => {
    if (sel === field) $(sel).setAttribute('aria-invalid', 'true');
    else $(sel).removeAttribute('aria-invalid');
  });
  if (field) $(field).focus();
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  $('#auth-title').textContent = isLogin ? '로그인' : '회원가입';
  $('#auth-submit').textContent = isLogin ? '로그인' : '가입하기';
  $('#nickname-field').hidden = isLogin;
  $('#auth-password').autocomplete = isLogin ? 'current-password' : 'new-password';
  document.querySelectorAll('.auth-switch [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  setAuthError('');
}

function openAuth(then = null, message = '') {
  afterLogin = then;
  const dialog = $('#auth-dialog');
  if (!dialog.open) {
    setAuthMode('login');
    $('#auth-form').reset();
  }
  if (message) setAuthError(message);
  if (!dialog.open) dialog.showModal(); // 이미 열려 있으면 다시 열지 않는다(InvalidStateError 방지)
  $('#auth-username').focus();
}

// 서버에 보내기 전에 입력칸 바로 옆에서 무엇을 고치면 되는지 알려 준다(서버도 같은 규칙으로 다시 검사).
function checkAuthInput(body) {
  if (!/^[a-z0-9_]{3,20}$/.test(body.username)) return ['아이디는 영문·숫자·_ 로 3~20자를 적어 주세요.', '#auth-username'];
  if (body.password.length < 4 || body.password.length > 100) return ['비밀번호는 4~100자로 적어 주세요.', '#auth-password'];
  if (authMode === 'register' && !body.nickname) return ['화면에 보일 닉네임을 적어 주세요.', '#auth-nickname'];
  return null;
}

async function submitAuth(e) {
  e.preventDefault();
  const body = {
    username: $('#auth-username').value.trim().toLowerCase(), // 서버와 같이 소문자로 통일
    password: $('#auth-password').value,
    nickname: $('#auth-nickname').value.trim(),
  };
  const problem = checkAuthInput(body);
  if (problem) return setAuthError(...problem);
  const btn = $('#auth-submit');
  btn.disabled = true;
  btn.textContent = authMode === 'login' ? '로그인 중…' : '가입 중…';
  try {
    const data = await api(authMode === 'login' ? '/api/login' : '/api/register', { method: 'POST', body });
    setUser(data.user);
    const next = afterLogin; // close 이벤트에서 afterLogin 을 비우기 전에 꺼내 둔다
    afterLogin = null;
    $('#auth-dialog').close();
    toast(`${data.user.nickname}님, 환영해요!`);
    // 이어서 할 일(화면 열기·저장)을 먼저 하고, 그 과정에서 저장 목록을 이미 받았으면 다시 받지 않는다.
    // (예전: 저장 목록 1번 + 이어서 연 화면 1번 + refreshCurrentView 1번 = 같은 요청 최대 3번)
    savedTitlesFresh = false;
    if (next) await next();
    else await refreshCurrentView();
    if (!savedTitlesFresh) await loadSavedTitles();
    if (state.recipes.length && !savedTitlesFresh) renderRecipes({ scroll: false }); // 저장 버튼 문구 갱신
  } catch (err) {
    const field = err.status === 409 ? '#auth-username' : null; // 이미 쓰는 아이디
    setAuthError(err.message, field);
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? '로그인' : '가입하기';
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  setUser(null);
  state.savedTitles = new Set();
  if (state.recipes.length) renderRecipes({ scroll: false });
  showView('cook');
  toast('로그아웃했어요.');
}

function setupAuth() {
  const dialog = $('#auth-dialog');
  $('#login-open').addEventListener('click', () => openAuth());
  $('#logout-btn').addEventListener('click', logout);
  $('#auth-form').addEventListener('submit', submitAuth);
  $('#auth-cancel').addEventListener('click', () => dialog.close());
  // 취소 버튼·Esc 어느 쪽으로 닫아도 '로그인 뒤 이어서 할 일'은 버린다.
  dialog.addEventListener('close', () => { afterLogin = null; });
  document.querySelectorAll('.auth-switch [data-mode]').forEach((b) => b.addEventListener('click', () => {
    setAuthMode(b.dataset.mode);
    $('#auth-username').focus();
  }));
  ['#auth-username', '#auth-password', '#auth-nickname'].forEach((sel) => $(sel).addEventListener('input', () => {
    if ($(sel).getAttribute('aria-invalid') === 'true') setAuthError('');
  }));
}

// ---------- 3단계: 레시피 저장 ----------
let savedTitlesFresh = false; // 로그인 뒤 저장 목록을 이미 받아 왔는지

function setSavedTitles(recipes) {
  state.savedTitles = new Set(recipes.map((r) => r.recipe.title));
  savedTitlesFresh = true;
  if (state.recipes.length) renderRecipes({ scroll: false });
}

async function loadSavedTitles() {
  if (!state.user) return;
  try {
    setSavedTitles((await api('/api/my-recipes')).recipes);
  } catch { /* 저장 목록을 못 불러와도 요리하기는 계속 가능 */ }
}

async function saveRecipe(idx) {
  const recipe = state.recipes[idx];
  if (!recipe) return;
  if (!state.user) return openAuth(() => saveRecipe(idx), '레시피를 저장하려면 로그인해 주세요. 처음이면 [회원가입]을 눌러 주세요.');
  if (savingTitles.has(recipe.title) || state.savedTitles.has(recipe.title)) return; // 연타 방지
  savingTitles.add(recipe.title);
  renderRecipes({ scroll: false });
  try {
    await api('/api/my-recipes', { method: 'POST', body: { recipe } });
    state.savedTitles.add(recipe.title);
    toast(`'${recipe.title}'을(를) 저장했어요. [나의 레시피]에서 다시 볼 수 있어요.`);
  } catch (err) {
    if (err.status === 409) {
      state.savedTitles.add(recipe.title); // 이미 저장돼 있음: 오류가 아니라 저장됨 상태로 보여 준다
    } else if (err.status === 401) {
      // 세션 정리는 api()가 했다. 다시 로그인하면 이 저장을 이어서 한다.
      savingTitles.delete(recipe.title);
      openAuth(() => saveRecipe(idx), SESSION_EXPIRED_MESSAGE);
    } else {
      toast(err.message, true);
    }
  } finally {
    savingTitles.delete(recipe.title);
  }
  renderRecipes({ scroll: false });
}

// ---------- 3단계: 화면 전환 ----------
let currentView = 'cook';

function showView(view) {
  if (view !== 'cook' && !state.user) {
    return openAuth(() => showView(view), view === 'saved' ? '나의 레시피를 보려면 로그인해 주세요.' : '대시보드를 보려면 로그인해 주세요.');
  }
  currentView = view;
  ['cook', 'saved', 'dashboard'].forEach((v) => { $(`#view-${v}`).hidden = v !== view; });
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.view === view;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  return refreshCurrentView();
}

// 기다릴 수 있게 Promise 를 돌려준다(로그인 직후 중복 요청을 피하는 데 씀).
function refreshCurrentView() {
  if (currentView === 'saved') return loadSavedList();
  if (currentView === 'dashboard') return loadDashboard();
  return Promise.resolve();
}

const GO_COOK_BUTTON = '<button class="btn primary" type="button" data-goto="cook">요리하기로 가기</button>';

async function loadSavedList() {
  const box = $('#saved-list');
  box.innerHTML = '<p class="empty"><span class="spinner" aria-hidden="true"></span>불러오는 중…</p>';
  try {
    const data = await api('/api/my-recipes');
    setSavedTitles(data.recipes);
    box.innerHTML = data.recipes.length
      ? data.recipes.map((s) => recipeCardHtml(s.recipe, {
          actions: `<span class="saved-date">${new Date(s.savedAt).toLocaleString('ko-KR')} 저장</span>
                    <button class="btn small danger" type="button" data-delete="${escapeHtml(s.id)}" data-title="${escapeHtml(s.recipe.title)}" aria-label="${escapeHtml(s.recipe.title)} 삭제">삭제</button>`,
        })).join('')
      : `<div class="empty-box"><p>아직 저장한 레시피가 없어요.<br>[요리하기]에서 레시피를 추천받고 [나의 레시피에 저장]을 눌러 보세요.</p>${GO_COOK_BUTTON}</div>`;
  } catch (err) {
    box.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

async function deleteSaved(id, title) {
  if (!confirm(`'${title}' 레시피를 나의 레시피에서 삭제할까요? 되돌릴 수 없어요.`)) return;
  try {
    await api(`/api/my-recipes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.savedTitles.delete(title);
    toast(`'${title}'을(를) 삭제했어요.`);
    await loadSavedList();
    $('#saved-title').focus(); // 지운 버튼이 사라졌으니 포커스를 목록 제목으로 옮긴다
    if (state.recipes.length) renderRecipes({ scroll: false });
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- 3단계: 대시보드 ----------
function barsHtml(title, entries, empty) {
  if (!entries.length) return `<div class="chart"><h3>${title}</h3><p class="empty">${empty}</p></div>`;
  const max = Math.max(...entries.map(([, n]) => n));
  return `<div class="chart"><h3>${title}</h3>${entries.map(([label, n]) => `
    <div class="bar-row" role="img" aria-label="${escapeHtml(label)} ${n}개">
      <span class="label" title="${escapeHtml(label)}" aria-hidden="true">${escapeHtml(label)}</span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></span></span>
      <span class="n" aria-hidden="true">${n}</span>
    </div>`).join('')}</div>`;
}

async function loadDashboard() {
  const box = $('#dashboard');
  box.innerHTML = '<p class="empty"><span class="spinner" aria-hidden="true"></span>불러오는 중…</p>';
  try {
    const d = await api('/api/dashboard');
    const order = (obj, keys) => keys.filter((k) => obj[k]).map((k) => [k, obj[k]])
      .concat(Object.entries(obj).filter(([k]) => !keys.includes(k)));
    const nothingYet = !d.savedCount && !d.recognitions && !d.generations;
    const emptyChart = '레시피를 저장하면 여기에 그래프가 생겨요.';
    box.innerHTML = `
      ${nothingYet ? `<div class="empty-box"><p>아직 기록이 없어요. 사진으로 재료를 인식하고 레시피를 저장하면 통계가 쌓여요.</p>${GO_COOK_BUTTON}</div>` : ''}
      <div class="stat-grid">
        <div class="stat"><div class="label">저장한 레시피</div><div class="value">${d.savedCount}<small>개</small></div></div>
        <div class="stat"><div class="label">재료 인식</div><div class="value">${d.recognitions}<small>회</small></div></div>
        <div class="stat"><div class="label">레시피 추천</div><div class="value">${d.generations}<small>회</small></div></div>
        <div class="stat"><div class="label">평균 조리 시간</div><div class="value">${d.savedCount ? `${d.avgTimeMinutes}<small>분</small>` : '-'}</div></div>
      </div>
      <p class="field-help">인식·추천 횟수는 로그인한 상태에서 한 것만 세요. 평균 조리 시간과 그래프는 저장한 레시피 기준이에요.</p>
      <div class="chart-grid">
        ${barsHtml('요리 종류별', order(d.byCuisine, ['한식', '양식', '중식', '일식']), emptyChart)}
        ${barsHtml('난이도별', order(d.byDifficulty, ['쉬움', '보통', '어려움']), emptyChart)}
        ${barsHtml('자주 쓴 재료 TOP 5', d.topIngredients.map((t) => [t.name, t.count]), emptyChart)}
      </div>`;
  } catch (err) {
    box.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

function setupViews() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('#recipe-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (btn) saveRecipe(Number(btn.dataset.save));
  });
  $('#saved-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete]');
    if (btn) deleteSaved(btn.dataset.delete, btn.dataset.title);
  });
  // 빈 상태 안내의 [요리하기로 가기]
  $('main').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    showView(btn.dataset.goto);
    $('#step1-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#file-input').focus({ preventScroll: true });
  });
}

async function loadMe() {
  try {
    const data = await api('/api/me');
    setUser(data.user);
    await loadSavedTitles();
  } catch { setUser(null); }
}

// ---------- 시작 ----------
setupUpload();
setupIngredients();
setupAuth();
setupViews();
renderIngredients();
loadStatus();
loadMe();

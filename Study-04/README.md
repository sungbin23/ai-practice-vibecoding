<!-- 작성일: 2026-11-25 03:13 -->
# 🧊 냉장고를 부탁해

냉장고 사진에서 재료를 인식하고(OpenRouter `google/gemma-3-27b-it:free`), 그 재료로 레시피를 추천하는(`deepseek/deepseek-chat-v3.1:free`) 웹 앱입니다. 로그인해서 레시피를 저장하고 대시보드로 통계를 볼 수 있습니다.

## 실행
Node.js 20 이상만 있으면 됩니다(외부 패키지 없음, `npm install` 불필요).

```powershell
cd Study-04
npm start          # 또는 node server.js
```
브라우저에서 http://localhost:3000 을 엽니다.

- **API 키가 없으면 자동으로 데모 모드**로 켜집니다. 화면 맨 위에 "데모 모드: API 키 없음"이 표시되고 샘플 재료·샘플 레시피가 나옵니다.
- 키가 있어도 데모 모드로 보고 싶으면 `npm run demo`.
- 포트 변경: `$env:PORT=3001; npm start`

## API 키 넣기
1. `Copy-Item .env.example .env`
2. `.env`의 `OPENROUTER_API_KEY=` 뒤에 OpenRouter 키(`sk-or-v1-...`)를 붙여 넣습니다.
3. 서버를 다시 켭니다. 터미널에 `실제 모드: 이미지=..., 텍스트=...`가 나오면 성공입니다.

무료 모델이 사라졌으면 `.env`에 `VISION_MODEL=`, `TEXT_MODEL=`로 다른 모델 이름을 넣습니다.

## 테스트
```powershell
npm test
```
데모 모드와 가짜 모델 응답으로 1~3단계 API를 검사합니다(실제 OpenRouter는 호출하지 않음).

## 문서
- [PRD_step1.md](PRD_step1.md) — 사진으로 재료 인식
- [PRD_step2.md](PRD_step2.md) — 재료 수정 + 요리 종류·난이도 선택 → 레시피 생성
- [PRD_step3.md](PRD_step3.md) — 로그인, 레시피 저장, 대시보드

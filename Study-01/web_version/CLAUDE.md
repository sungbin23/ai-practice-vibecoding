<!-- 작성일: 2026-11-25 01:45 -->
# web_version — TensorFlow.js 브라우저 앱

공통 규칙과 전처리 규칙은 상위 `../CLAUDE.md`를 따릅니다.

## 구조
- `index.html` 단일 파일 (CSS/JS 인라인, 빌드 단계 없음).
  - TensorFlow.js를 CDN(`@tensorflow/tfjs@latest`)에서 로드합니다.
  - 직접 학습하지 않고 Google Storage의 사전학습 CNN(`mnist_transfer_cnn_v1/model.json`)을 `tf.loadLayersModel`로 불러오므로 **인터넷 연결이 필요**합니다. desktop_version의 모델과는 다른 모델입니다.
  - 모델 입력 형태는 `[1, 28, 28, 1]` (`tf.browser.fromPixels(canvas, 1)` → resize → 반전/정규화 → `expandDims(0)`).
  - 예측 후 텐서를 `dispose()`로 해제합니다. 새 텐서를 추가하면 함께 해제합니다.
- UI 문구는 한국어입니다.

## 실행
`index.html`을 브라우저로 직접 열면 됩니다 (별도 서버 불필요). 오류는 브라우저 콘솔(F12)에서 확인합니다.

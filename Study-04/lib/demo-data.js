// 작성일: 2026-11-25 03:09
// 데모 모드(API 키 없음)에서 보여 줄 샘플 데이터
'use strict';

const SAMPLE_INGREDIENTS = [
  { name: '달걀', quantity: '6개', category: '달걀' },
  { name: '대파', quantity: '1대', category: '채소' },
  { name: '양파', quantity: '2개', category: '채소' },
  { name: '당근', quantity: '1개', category: '채소' },
  { name: '김치', quantity: '반 통', category: '가공식품' },
  { name: '두부', quantity: '1모', category: '가공식품' },
  { name: '돼지고기 앞다리살', quantity: '300g', category: '육류' },
  { name: '우유', quantity: '1팩', category: '유제품' },
  { name: '토마토', quantity: '3개', category: '채소' },
  { name: '고추장', quantity: '1통', category: '소스/양념' },
];

// 샘플 레시피 (재료 have 값은 서버가 사용자 재료와 비교해 채운다)
const SAMPLE_RECIPES = [
  {
    title: '돼지고기 김치찌개', cuisine: '한식', difficulty: '쉬움', timeMinutes: 25, servings: 2,
    ingredients: [
      { name: '김치', amount: '2컵' }, { name: '돼지고기', amount: '200g' }, { name: '두부', amount: '반 모' },
      { name: '대파', amount: '반 대' }, { name: '고춧가루', amount: '1큰술' }, { name: '물', amount: '500ml' },
    ],
    steps: [
      '냄비에 한입 크기로 썬 돼지고기를 넣고 중불에서 기름이 나올 때까지 볶는다.',
      '김치를 넣고 3분 정도 함께 볶는다.',
      '물과 고춧가루를 넣고 끓어오르면 중약불로 10분 끓인다.',
      '두부와 어슷썬 대파를 넣고 5분 더 끓인다.',
    ],
    tip: '김치가 덜 익었다면 설탕을 반 작은술 넣으면 신맛과 단맛이 맞춰져요.',
  },
  {
    title: '김치전', cuisine: '한식', difficulty: '쉬움', timeMinutes: 20, servings: 2,
    ingredients: [
      { name: '김치', amount: '1컵' }, { name: '양파', amount: '반 개' }, { name: '부침가루', amount: '1컵' },
      { name: '물', amount: '150ml' }, { name: '식용유', amount: '3큰술' },
    ],
    steps: [
      '김치와 양파를 잘게 썬다.',
      '부침가루와 물, 김치 국물 2큰술을 섞어 반죽을 만든다.',
      '썬 재료를 반죽에 넣고 고루 섞는다.',
      '기름을 두른 팬에 얇게 펴서 앞뒤로 노릇하게 부친다.',
    ],
    tip: '반죽에 얼음물을 쓰면 더 바삭해져요.',
  },
  {
    title: '제육볶음', cuisine: '한식', difficulty: '보통', timeMinutes: 30, servings: 2,
    ingredients: [
      { name: '돼지고기', amount: '300g' }, { name: '양파', amount: '1개' }, { name: '당근', amount: '반 개' },
      { name: '대파', amount: '1대' }, { name: '고추장', amount: '2큰술' }, { name: '간장', amount: '1큰술' },
      { name: '설탕', amount: '1큰술' },
    ],
    steps: [
      '고추장, 간장, 설탕을 섞어 양념장을 만든다.',
      '돼지고기를 양념장에 버무려 10분간 재운다.',
      '양파와 당근은 채 썰고, 대파는 어슷 썬다.',
      '달군 팬에 고기를 볶다가 반쯤 익으면 채소를 넣고 센불에서 볶아 마무리한다.',
    ],
    tip: '마지막에 참기름을 한 바퀴 두르면 향이 살아나요.',
  },
  {
    title: '토마토 달걀볶음', cuisine: '중식', difficulty: '쉬움', timeMinutes: 15, servings: 2,
    ingredients: [
      { name: '토마토', amount: '2개' }, { name: '달걀', amount: '3개' }, { name: '대파', amount: '약간' },
      { name: '설탕', amount: '1작은술' }, { name: '소금', amount: '약간' }, { name: '식용유', amount: '2큰술' },
    ],
    steps: [
      '토마토는 한입 크기로 썰고 달걀은 소금을 조금 넣어 푼다.',
      '기름을 넉넉히 두른 팬에 달걀을 반숙으로 볶아 덜어 둔다.',
      '같은 팬에 대파를 볶아 향을 내고 토마토와 설탕을 넣어 즙이 나올 때까지 볶는다.',
      '달걀을 다시 넣고 가볍게 섞어 마무리한다.',
    ],
    tip: '달걀은 완전히 익히지 말아야 부드러워요.',
  },
  {
    title: '마파두부', cuisine: '중식', difficulty: '보통', timeMinutes: 25, servings: 2,
    ingredients: [
      { name: '두부', amount: '1모' }, { name: '돼지고기', amount: '100g(다짐)' }, { name: '대파', amount: '반 대' },
      { name: '고추장', amount: '1큰술' }, { name: '간장', amount: '1큰술' }, { name: '전분', amount: '1큰술' },
      { name: '물', amount: '200ml' },
    ],
    steps: [
      '두부는 깍둑 썰어 끓는 물에 1분 데쳐 건진다.',
      '팬에 다진 대파와 돼지고기를 볶는다.',
      '고추장, 간장, 물을 넣고 끓으면 두부를 넣어 3분 끓인다.',
      '물에 푼 전분을 조금씩 넣어 농도를 맞춘다.',
    ],
    tip: '두부를 데치면 잘 부서지지 않아요.',
  },
  {
    title: '두부 스테이크', cuisine: '양식', difficulty: '보통', timeMinutes: 30, servings: 2,
    ingredients: [
      { name: '두부', amount: '1모' }, { name: '양파', amount: '반 개' }, { name: '당근', amount: '1/4개' },
      { name: '달걀', amount: '1개' }, { name: '빵가루', amount: '3큰술' }, { name: '소금', amount: '약간' },
    ],
    steps: [
      '두부는 면보로 물기를 꼭 짜서 으깬다.',
      '양파와 당근을 잘게 다져 두부, 달걀, 빵가루, 소금과 섞는다.',
      '손바닥 크기로 납작하게 빚는다.',
      '기름 두른 팬에 중약불로 앞뒤 5분씩 노릇하게 굽는다.',
    ],
    tip: '케첩과 간장을 1:1로 졸이면 간단한 소스가 돼요.',
  },
  {
    title: '돼지고기 토마토 스튜', cuisine: '양식', difficulty: '어려움', timeMinutes: 70, servings: 3,
    ingredients: [
      { name: '돼지고기', amount: '400g' }, { name: '토마토', amount: '3개' }, { name: '양파', amount: '1개' },
      { name: '당근', amount: '1개' }, { name: '우유', amount: '100ml' }, { name: '밀가루', amount: '1큰술' },
      { name: '소금', amount: '약간' }, { name: '후추', amount: '약간' },
    ],
    steps: [
      '돼지고기를 큼직하게 썰어 소금, 후추, 밀가루를 묻힌다.',
      '냄비에 고기 겉면을 노릇하게 지져 덜어 둔다.',
      '같은 냄비에 양파와 당근을 볶다가 다진 토마토를 넣어 으깨며 볶는다.',
      '고기를 다시 넣고 재료가 잠길 만큼 물을 부어 약불에서 50분 끓인다.',
      '우유를 넣고 5분 더 끓인 뒤 소금으로 간한다.',
    ],
    tip: '하루 지나면 맛이 더 깊어져요.',
  },
  {
    title: '부타동(돼지고기 덮밥)', cuisine: '일식', difficulty: '쉬움', timeMinutes: 20, servings: 1,
    ingredients: [
      { name: '돼지고기', amount: '150g' }, { name: '양파', amount: '반 개' }, { name: '밥', amount: '1공기' },
      { name: '간장', amount: '2큰술' }, { name: '설탕', amount: '1큰술' }, { name: '대파', amount: '약간' },
    ],
    steps: [
      '간장, 설탕, 물 3큰술을 섞어 소스를 만든다.',
      '팬에 채 썬 양파를 볶다가 얇게 썬 돼지고기를 넣고 볶는다.',
      '소스를 붓고 졸이듯 2~3분 더 볶는다.',
      '밥 위에 올리고 송송 썬 대파를 뿌린다.',
    ],
    tip: '달걀노른자를 올리면 더 부드러워요.',
  },
  {
    title: '다시마키 달걀말이', cuisine: '일식', difficulty: '보통', timeMinutes: 20, servings: 2,
    ingredients: [
      { name: '달걀', amount: '4개' }, { name: '우유', amount: '2큰술' }, { name: '설탕', amount: '1작은술' },
      { name: '간장', amount: '1작은술' }, { name: '식용유', amount: '약간' },
    ],
    steps: [
      '달걀에 우유, 설탕, 간장을 넣고 체에 걸러 곱게 푼다.',
      '약불로 달군 팬에 기름을 얇게 바르고 달걀물을 1/3만 붓는다.',
      '반쯤 익으면 한쪽 끝부터 돌돌 만다.',
      '남은 달걀물을 두 번 나눠 부으며 같은 방법으로 말아 모양을 잡는다.',
    ],
    tip: '김발로 감싸 5분 두면 모양이 단단하게 잡혀요.',
  },
];

module.exports = { SAMPLE_INGREDIENTS, SAMPLE_RECIPES };

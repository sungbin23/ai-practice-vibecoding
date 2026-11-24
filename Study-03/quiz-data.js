// 작성일: 2026-11-25 02:38 (수정됨)
// quiz-data.js — 4개 카테고리(한국사·과학·지리·예술과 문화) × 20문제 = 80문제
// 구조: { id, category, difficulty, question, options[4], correctAnswer(정답 보기의 0부터 시작하는 인덱스), explanation }
const quizData = [
    // --- 한국사 ---
    {
        id: 1,
        category: "한국사",
        difficulty: "easy",
        question: "임진왜란이 일어난 연도는?",
        options: ["1392년", "1592년", "1636년", "1910년"],
        correctAnswer: 1,
        explanation: "임진왜란은 1592년(선조 25년)에 일본의 침략으로 시작되었습니다."
    },
    {
        id: 2,
        category: "한국사",
        difficulty: "medium",
        question: "조선시대 4대 사화 중 첫 번째로 일어난 사화는?",
        options: ["무오사화", "갑자사화", "기묘사화", "을사사화"],
        correctAnswer: 0,
        explanation: "무오사화(1498년)는 연산군 때 사림파가 화를 입은 첫 번째 사화입니다."
    },
    {
        id: 3,
        category: "한국사",
        difficulty: "easy",
        question: "훈민정음을 창제한 조선의 왕은?",
        options: ["태종", "세종", "세조", "성종"],
        correctAnswer: 1,
        explanation: "세종은 1443년 훈민정음을 창제하고 1446년에 반포했습니다."
    },
    {
        id: 4,
        category: "한국사",
        difficulty: "easy",
        question: "고구려를 건국한 인물은?",
        options: ["온조", "박혁거세", "주몽", "김수로"],
        correctAnswer: 2,
        explanation: "고구려는 주몽(동명성왕)이 건국했습니다. 온조는 백제, 박혁거세는 신라, 김수로는 금관가야의 시조입니다."
    },
    {
        id: 5,
        category: "한국사",
        difficulty: "easy",
        question: "1919년 3월 1일, 일제의 식민 통치에 맞서 전국적으로 일어난 독립 만세 운동은?",
        options: ["3·1 운동", "6·10 만세 운동", "광주 학생 항일 운동", "4·19 혁명"],
        correctAnswer: 0,
        explanation: "3·1 운동은 1919년 3월 1일 민족 대표 33인의 독립 선언을 계기로 전국으로 퍼진 만세 운동입니다."
    },
    {
        id: 6,
        category: "한국사",
        difficulty: "hard",
        question: "676년 신라가 당나라 수군을 물리쳐 나당 전쟁을 마무리한 전투는?",
        options: ["살수 대첩", "황산벌 전투", "안시성 전투", "기벌포 전투"],
        correctAnswer: 3,
        explanation: "신라는 675년 매소성 전투에 이어 676년 기벌포 전투에서 당 수군을 격파하며 당 세력을 몰아냈습니다."
    },
    {
        id: 7,
        category: "한국사",
        difficulty: "easy",
        question: "918년 고려를 건국한 인물은?",
        options: ["왕건", "궁예", "견훤", "이성계"],
        correctAnswer: 0,
        explanation: "왕건은 918년 궁예를 몰아내고 고려를 세웠습니다. 이성계는 조선을 건국했습니다."
    },
    {
        id: 8,
        category: "한국사",
        difficulty: "easy",
        question: "1592년 한산도 대첩에서 학익진 전법으로 일본 수군을 크게 물리친 장수는?",
        options: ["권율", "이순신", "김시민", "곽재우"],
        correctAnswer: 1,
        explanation: "이순신은 1592년 한산도 앞바다에서 학익진을 펼쳐 일본 수군을 대파했습니다."
    },
    {
        id: 9,
        category: "한국사",
        difficulty: "medium",
        question: "조선 정조 때 축조되어 1796년에 완공된 성곽은?",
        options: ["남한산성", "북한산성", "수원 화성", "한양도성"],
        correctAnswer: 2,
        explanation: "수원 화성은 정조의 명으로 1794년 착공해 1796년 완공되었으며, 1997년 유네스코 세계유산에 등재되었습니다."
    },
    {
        id: 10,
        category: "한국사",
        difficulty: "medium",
        question: "1876년 조선이 일본과 맺은 불평등 조약으로, '조일수호조규'라고도 부르는 조약은?",
        options: ["강화도 조약", "을사늑약", "제물포 조약", "한일 병합 조약"],
        correctAnswer: 0,
        explanation: "강화도 조약(1876)은 운요호 사건을 계기로 체결된, 조선이 외국과 맺은 첫 근대적 조약이자 불평등 조약입니다."
    },
    {
        id: 41,
        category: "한국사",
        difficulty: "medium",
        question: "고려 광종이 958년 후주 출신 쌍기의 건의를 받아들여 시행한, 시험으로 관리를 뽑는 제도는?",
        options: ["음서제", "골품제", "독서삼품과", "과거제"],
        correctAnswer: 3,
        explanation: "광종은 958년 쌍기의 건의로 과거제를 시행해 호족 세력을 누르고 왕에게 충성하는 관리를 뽑았으며, 과거제는 1894년 갑오개혁 때 폐지되었습니다. 독서삼품과는 신라 원성왕 때(788년) 실시된 관리 선발 제도이고, 음서제는 공신·고위 관리의 자손을 시험 없이 등용하는 제도입니다."
    },
    {
        id: 42,
        category: "한국사",
        difficulty: "easy",
        question: "『삼국유사』에 고조선을 세운 인물로 기록된 사람은?",
        options: ["주몽", "온조", "단군왕검", "박혁거세"],
        correctAnswer: 2,
        explanation: "『삼국유사』에는 단군왕검이 고조선을 건국했다는 이야기가 실려 있습니다. 주몽은 고구려, 온조는 백제, 박혁거세는 신라의 시조입니다."
    },
    {
        id: 43,
        category: "한국사",
        difficulty: "medium",
        question: "고려 인종의 명으로 김부식 등이 1145년에 편찬한 역사서는?",
        options: ["삼국유사", "고려사", "동국통감", "삼국사기"],
        correctAnswer: 3,
        explanation: "『삼국사기』는 1145년(인종 23) 김부식 등이 편찬한 기전체 역사서입니다. 『삼국유사』는 고려 후기 승려 일연이 지었습니다."
    },
    {
        id: 44,
        category: "한국사",
        difficulty: "medium",
        question: "1377년 청주 흥덕사에서 금속 활자로 인쇄되었으며, 하권이 프랑스 국립도서관에 소장된 불교 서적은? (2024년 기준)",
        options: ["팔만대장경", "직지심체요절", "무구정광대다라니경", "용비어천가"],
        correctAnswer: 1,
        explanation: "『백운화상초록불조직지심체요절』(직지)은 1377년 청주 흥덕사에서 금속 활자로 찍었으며, 현재 하권 1책이 프랑스 국립도서관에 있습니다."
    },
    {
        id: 45,
        category: "한국사",
        difficulty: "easy",
        question: "1950년 6월 25일 북한의 남침으로 시작된 전쟁은?",
        options: ["청일 전쟁", "러일 전쟁", "6·25 전쟁", "베트남 전쟁"],
        correctAnswer: 2,
        explanation: "6·25 전쟁(한국 전쟁)은 1950년 6월 25일 북한의 남침으로 시작되어 1953년 7월 27일 정전 협정이 체결되었습니다."
    },
    {
        id: 46,
        category: "한국사",
        difficulty: "hard",
        question: "고구려 장수왕이 414년 아버지의 업적을 기리기 위해 세운 비석은?",
        options: ["진흥왕 순수비", "충주 고구려비", "사택지적비", "광개토대왕릉비"],
        correctAnswer: 3,
        explanation: "광개토대왕릉비는 414년(장수왕 3) 장수왕이 세운 비석으로, 중국 지린성 지안(집안)시에 있습니다."
    },
    {
        id: 47,
        category: "한국사",
        difficulty: "medium",
        question: "1894년 동학 농민 운동을 이끌었으며 '녹두 장군'으로 불린 인물은?",
        options: ["전봉준", "최제우", "김옥균", "최익현"],
        correctAnswer: 0,
        explanation: "전봉준은 1894년 고부 봉기를 시작으로 동학 농민 운동을 이끌었습니다. 최제우는 동학의 창시자이고, 김옥균은 1884년 갑신정변을 주도했습니다."
    },
    {
        id: 48,
        category: "한국사",
        difficulty: "medium",
        question: "1897년 고종이 환구단에서 황제 즉위식을 올리며 선포한 국호는?",
        options: ["조선", "대한민국", "대한제국", "고려"],
        correctAnswer: 2,
        explanation: "고종은 1897년 10월 환구단에서 하늘에 제사를 지내고 황제로 즉위하며 국호를 대한제국으로 정했습니다."
    },
    {
        id: 49,
        category: "한국사",
        difficulty: "hard",
        question: "고려 원종 때 개경 환도에 반대해 강화도·진도·제주도로 근거지를 옮기며 몽골에 맞선 군사 조직은?",
        options: ["별무반", "광군", "훈련도감", "삼별초"],
        correctAnswer: 3,
        explanation: "삼별초는 1270년 개경 환도에 반대해 봉기한 뒤 진도와 제주도로 옮겨 항쟁했고, 1273년 여몽 연합군에 진압되었습니다."
    },
    {
        id: 50,
        category: "한국사",
        difficulty: "medium",
        question: "조선 영조가 붕당 간의 대립을 줄이기 위해 여러 붕당의 인재를 고르게 등용한 정책은?",
        options: ["대동법", "탕평책", "균역법", "호패법"],
        correctAnswer: 1,
        explanation: "탕평책은 붕당의 폐해를 줄이려고 인재를 고르게 등용한 정책으로, 영조와 정조가 추진했습니다. 균역법은 영조 때의 군역 개혁입니다."
    },

    // --- 과학 ---
    {
        id: 11,
        category: "과학",
        difficulty: "easy",
        question: "주기율표에서 원자 번호 1번인 원소는?",
        options: ["수소(H)", "헬륨(He)", "리튬(Li)", "산소(O)"],
        correctAnswer: 0,
        explanation: "원자 번호 1번은 양성자를 1개 가진 수소(H)입니다."
    },
    {
        id: 12,
        category: "과학",
        difficulty: "hard",
        question: "빛의 속도(진공 상태 기준)는 약 얼마인가?",
        options: ["초속 30만 km", "초속 15만 km", "초속 50만 km", "초속 100만 km"],
        correctAnswer: 0,
        explanation: "진공 속 빛의 속도는 299,792,458 m/s(약 초속 30만 km)로 정의되어 있습니다."
    },
    {
        id: 13,
        category: "과학",
        difficulty: "easy",
        question: "물의 화학식은?",
        options: ["CO₂", "H₂O", "O₂", "NaCl"],
        correctAnswer: 1,
        explanation: "물 분자는 수소 원자 2개와 산소 원자 1개로 이루어진 H₂O입니다."
    },
    {
        id: 14,
        category: "과학",
        difficulty: "easy",
        question: "식물이 빛 에너지를 이용해 이산화탄소와 물로 포도당을 만드는 과정은?",
        options: ["호흡", "증산 작용", "광합성", "발효"],
        correctAnswer: 2,
        explanation: "광합성은 엽록체에서 빛 에너지를 이용해 이산화탄소와 물로 포도당과 산소를 만드는 과정입니다."
    },
    {
        id: 15,
        category: "과학",
        difficulty: "easy",
        question: "태양계 행성 중 태양과의 평균 거리가 가장 가까운 행성은?",
        options: ["금성", "수성", "지구", "화성"],
        correctAnswer: 1,
        explanation: "수성은 태양으로부터 평균 약 5,800만 km 떨어져 있어 태양계 행성 중 태양에 가장 가깝습니다."
    },
    {
        id: 16,
        category: "과학",
        difficulty: "easy",
        question: "1기압에서 순수한 물이 끓는 온도는 섭씨 몇 도인가?",
        options: ["0°C", "37°C", "100°C", "212°C"],
        correctAnswer: 2,
        explanation: "1기압에서 순수한 물의 끓는점은 100°C(화씨 212°F)입니다."
    },
    {
        id: 17,
        category: "과학",
        difficulty: "medium",
        question: "뉴턴의 운동 제2법칙(가속도의 법칙)을 나타내는 식은?",
        options: ["E = mc²", "V = IR", "PV = nRT", "F = ma"],
        correctAnswer: 3,
        explanation: "운동 제2법칙은 물체에 작용하는 힘(F)이 질량(m)과 가속도(a)의 곱과 같다는 F = ma입니다."
    },
    {
        id: 18,
        category: "과학",
        difficulty: "medium",
        question: "1953년 DNA의 이중 나선 구조 모델을 발표한 과학자는?",
        options: ["왓슨과 크릭", "멘델", "다윈", "파스퇴르"],
        correctAnswer: 0,
        explanation: "제임스 왓슨과 프랜시스 크릭은 1953년 학술지 Nature에 DNA 이중 나선 구조 모델을 발표했습니다."
    },
    {
        id: 19,
        category: "과학",
        difficulty: "medium",
        question: "사람의 정상 체세포 1개에 들어 있는 염색체 수는?",
        options: ["23개", "44개", "46개", "48개"],
        correctAnswer: 2,
        explanation: "사람의 체세포에는 상염색체 22쌍과 성염색체 1쌍, 모두 23쌍(46개)의 염색체가 있습니다."
    },
    {
        id: 20,
        category: "과학",
        difficulty: "medium",
        question: "다음 중 소리(음파)가 전달될 수 없는 곳은?",
        options: ["물속", "공기 중", "철 막대", "진공"],
        correctAnswer: 3,
        explanation: "소리는 매질의 진동으로 전달되는 파동이므로, 매질이 없는 진공에서는 전달되지 않습니다."
    },
    {
        id: 51,
        category: "과학",
        difficulty: "easy",
        question: "태양계 행성 중 지름 기준으로 가장 큰 행성은?",
        options: ["토성", "목성", "천왕성", "해왕성"],
        correctAnswer: 1,
        explanation: "목성은 적도 지름이 약 14만 3천 km로 태양계 행성 중 가장 크며, 질량도 가장 큽니다."
    },
    {
        id: 52,
        category: "과학",
        difficulty: "easy",
        question: "사람의 몸에서 수축과 이완을 반복하며 혈액을 온몸으로 내보내는 기관은?",
        options: ["심장", "폐", "간", "신장"],
        correctAnswer: 0,
        explanation: "심장은 근육으로 된 펌프로, 수축과 이완을 반복하며 혈액을 온몸으로 순환시킵니다."
    },
    {
        id: 53,
        category: "과학",
        difficulty: "easy",
        question: "원소 기호가 'Au'인 원소는?",
        options: ["은", "구리", "알루미늄", "금"],
        correctAnswer: 3,
        explanation: "Au는 라틴어 aurum에서 온 금의 원소 기호입니다. 은은 Ag, 구리는 Cu, 알루미늄은 Al입니다."
    },
    {
        id: 54,
        category: "과학",
        difficulty: "medium",
        question: "1905년 특수 상대성 이론을 발표한 과학자는?",
        options: ["아이작 뉴턴", "닐스 보어", "알베르트 아인슈타인", "제임스 맥스웰"],
        correctAnswer: 2,
        explanation: "아인슈타인은 1905년 특수 상대성 이론을, 1915년 일반 상대성 이론을 발표했습니다."
    },
    {
        id: 55,
        category: "과학",
        difficulty: "medium",
        question: "식초의 신맛을 내는 주성분인 산은?",
        options: ["염산", "아세트산", "황산", "질산"],
        correctAnswer: 1,
        explanation: "식초의 주성분은 아세트산(CH₃COOH)으로, 보통 식초에는 수 % 정도 들어 있습니다."
    },
    {
        id: 56,
        category: "과학",
        difficulty: "medium",
        question: "건조한 공기의 성분 중 부피 기준으로 가장 많은 기체는?",
        options: ["산소", "아르곤", "이산화탄소", "질소"],
        correctAnswer: 3,
        explanation: "건조한 공기는 부피 기준으로 질소 약 78%, 산소 약 21%, 아르곤 약 0.9%로 이루어져 있습니다."
    },
    {
        id: 57,
        category: "과학",
        difficulty: "medium",
        question: "1928년 푸른곰팡이에서 항생 물질 페니실린을 발견한 과학자는?",
        options: ["알렉산더 플레밍", "루이 파스퇴르", "로베르트 코흐", "에드워드 제너"],
        correctAnswer: 0,
        explanation: "플레밍은 1928년 런던 세인트메리 병원에서 페니실린을 발견했고, 1945년 플로리·체인과 함께 노벨 생리의학상을 받았습니다."
    },
    {
        id: 58,
        category: "과학",
        difficulty: "hard",
        question: "1869년 원소를 원자량 순으로 배열한 주기율표를 발표하고 미발견 원소의 존재를 예측한 과학자는?",
        options: ["존 돌턴", "앙투안 라부아지에", "드미트리 멘델레예프", "헨리 모즐리"],
        correctAnswer: 2,
        explanation: "멘델레예프는 1869년 주기율표를 발표했고, 그가 예측한 원소 중 갈륨·스칸듐·저마늄이 이후 발견되었습니다. 모즐리는 1913년 원자 번호 개념을 밝혔습니다."
    },
    {
        id: 59,
        category: "과학",
        difficulty: "medium",
        question: "세포 호흡이 일어나 에너지(ATP)를 만드는 세포 소기관은?",
        options: ["리보솜", "골지체", "핵", "미토콘드리아"],
        correctAnswer: 3,
        explanation: "미토콘드리아는 세포 호흡으로 양분을 분해해 ATP를 만듭니다. 리보솜은 단백질을 합성합니다."
    },
    {
        id: 60,
        category: "과학",
        difficulty: "hard",
        question: "절대 온도 0 K(절대 영도)를 섭씨온도로 나타내면?",
        options: ["-100°C", "-273.15°C", "0°C", "-459.67°C"],
        correctAnswer: 1,
        explanation: "0 K는 -273.15°C로 정의됩니다. -459.67은 0 K를 화씨온도(°F)로 나타낸 값입니다."
    },

    // --- 지리 ---
    {
        id: 21,
        category: "지리",
        difficulty: "medium",
        question: "세계에서 가장 긴 강은? (전통적 측정 기준)",
        options: ["아마존강", "나일강", "양쯔강", "미시시피강"],
        correctAnswer: 1,
        explanation: "나일강은 약 6,650km로 전통적 측정 기준에서 가장 긴 강으로 분류됩니다(측정 방식에 따라 아마존강이 더 길다는 주장도 있습니다)."
    },
    {
        id: 22,
        category: "지리",
        difficulty: "easy",
        question: "국토 면적 기준(2024년 기준)으로 세계에서 가장 넓은 국가는?",
        options: ["캐나다", "미국", "러시아", "중국"],
        correctAnswer: 2,
        explanation: "러시아는 약 1,710만 ㎢의 면적으로 세계에서 가장 넓은 국토를 가졌습니다."
    },
    {
        id: 23,
        category: "지리",
        difficulty: "easy",
        question: "오스트레일리아(호주)의 수도는?",
        options: ["시드니", "멜버른", "캔버라", "브리즈번"],
        correctAnswer: 2,
        explanation: "호주의 수도는 캔버라입니다. 시드니는 인구가 많은 대도시이지만 수도는 아닙니다."
    },
    {
        id: 24,
        category: "지리",
        difficulty: "easy",
        question: "해발 고도 기준으로 세계에서 가장 높은 산은?",
        options: ["K2", "에베레스트산", "칸첸중가", "킬리만자로산"],
        correctAnswer: 1,
        explanation: "에베레스트산은 2020년 네팔·중국 공동 측정 결과 해발 8,848.86m로 발표되었습니다."
    },
    {
        id: 25,
        category: "지리",
        difficulty: "easy",
        question: "면적 기준으로 대한민국에서 가장 큰 섬은?",
        options: ["거제도", "제주도", "강화도", "울릉도"],
        correctAnswer: 1,
        explanation: "제주도(본섬)는 면적 약 1,833㎢로 대한민국에서 가장 큰 섬이며, 두 번째는 거제도입니다. 부속 섬을 포함한 제주특별자치도 전체 면적은 약 1,850㎢입니다."
    },
    {
        id: 26,
        category: "지리",
        difficulty: "medium",
        question: "1884년 국제 자오선 회의에서 경도 0°(본초 자오선)의 기준으로 정한 천문대가 있는 영국 런던의 지역은?",
        options: ["옥스퍼드", "케임브리지", "맨체스터", "그리니치"],
        correctAnswer: 3,
        explanation: "1884년 국제 자오선 회의에서 런던 그리니치 천문대를 지나는 자오선이 경도 0°로 정해졌습니다. 오늘날 GPS 등에 쓰이는 IERS 기준 자오선은 이보다 약 100m 동쪽에 있습니다."
    },
    {
        id: 27,
        category: "지리",
        difficulty: "easy",
        question: "사하라 사막이 위치한 대륙은?",
        options: ["아프리카", "아시아", "남아메리카", "오세아니아"],
        correctAnswer: 0,
        explanation: "사하라 사막은 아프리카 북부에 펼쳐진 사막입니다."
    },
    {
        id: 28,
        category: "지리",
        difficulty: "medium",
        question: "브라질의 공용어는?",
        options: ["스페인어", "포르투갈어", "영어", "프랑스어"],
        correctAnswer: 1,
        explanation: "브라질은 포르투갈의 식민지였던 역사로 인해 포르투갈어를 공용어로 사용합니다."
    },
    {
        id: 29,
        category: "지리",
        difficulty: "easy",
        question: "면적 기준으로 세계에서 가장 넓은 대륙은?",
        options: ["아프리카", "북아메리카", "아시아", "남극"],
        correctAnswer: 2,
        explanation: "아시아는 약 4,400만 ㎢로 지구 육지 면적의 약 30%를 차지하는 가장 넓은 대륙입니다."
    },
    {
        id: 30,
        category: "지리",
        difficulty: "medium",
        question: "독도가 속한 대한민국의 행정 구역은?",
        options: ["경상북도 울릉군", "강원특별자치도 삼척시", "경상남도 거제시", "울산광역시 동구"],
        correctAnswer: 0,
        explanation: "독도의 주소는 경상북도 울릉군 울릉읍 독도리입니다."
    },
    {
        id: 61,
        category: "지리",
        difficulty: "medium",
        question: "캐나다의 수도는?",
        options: ["토론토", "밴쿠버", "몬트리올", "오타와"],
        correctAnswer: 3,
        explanation: "캐나다의 수도는 온타리오주의 오타와입니다. 토론토는 인구가 가장 많은 도시이지만 수도는 아닙니다."
    },
    {
        id: 62,
        category: "지리",
        difficulty: "easy",
        question: "면적 기준으로 세계에서 가장 넓은 대양은?",
        options: ["태평양", "대서양", "인도양", "북극해"],
        correctAnswer: 0,
        explanation: "태평양은 지구 표면의 약 3분의 1을 차지하는 가장 넓은 대양이며, 그다음은 대서양입니다."
    },
    {
        id: 63,
        category: "지리",
        difficulty: "easy",
        question: "기자의 대피라미드와 스핑크스가 있는 나라는?",
        options: ["멕시코", "페루", "이집트", "수단"],
        correctAnswer: 2,
        explanation: "기자의 대피라미드와 스핑크스는 이집트 카이로 근교 기자 지역에 있습니다."
    },
    {
        id: 64,
        category: "지리",
        difficulty: "medium",
        question: "남한(휴전선 이남)에서 해발 고도 기준으로 가장 높은 산은?",
        options: ["지리산", "설악산", "태백산", "한라산"],
        correctAnswer: 3,
        explanation: "한라산은 2016년 재측정 결과 해발 약 1,947m로 확인된 남한에서 가장 높은 산입니다. 내륙에서는 지리산(약 1,915m)이 가장 높습니다."
    },
    {
        id: 65,
        category: "지리",
        difficulty: "easy",
        question: "위도 0°를 이루는 선은?",
        options: ["적도", "본초 자오선", "북회귀선", "남회귀선"],
        correctAnswer: 0,
        explanation: "적도는 위도 0°인 선으로 지구를 북반구와 남반구로 나눕니다. 본초 자오선은 경도 0°인 선입니다."
    },
    {
        id: 66,
        category: "지리",
        difficulty: "hard",
        question: "국제 날짜 변경선은 대체로 경도 몇 도 선을 따라 정해져 있는가?",
        options: ["0°", "동경 90°", "서경 90°", "180°"],
        correctAnswer: 3,
        explanation: "국제 날짜 변경선은 대체로 경도 180° 선을 따르지만, 같은 나라 안에서 날짜가 갈리지 않도록 곳곳에서 꺾여 있습니다."
    },
    {
        id: 67,
        category: "지리",
        difficulty: "medium",
        question: "산호초 지대인 그레이트 배리어 리프가 있는 나라는?",
        options: ["필리핀", "오스트레일리아", "인도네시아", "뉴질랜드"],
        correctAnswer: 1,
        explanation: "그레이트 배리어 리프는 오스트레일리아 퀸즐랜드주 북동쪽 바다에 펼쳐진 산호초 지대로, 1981년 유네스코 세계유산에 등재되었습니다."
    },
    {
        id: 68,
        category: "지리",
        difficulty: "hard",
        question: "면적 기준으로 대한민국 17개 광역자치단체 중 가장 넓은 곳은? (국토교통부 지적통계 기준)",
        options: ["강원특별자치도", "전라남도", "경상북도", "경기도"],
        correctAnswer: 2,
        explanation: "경상북도는 국토의 약 18%를 차지해 광역자치단체 중 가장 넓고, 그다음은 강원특별자치도와 전라남도입니다."
    },
    {
        id: 69,
        category: "지리",
        difficulty: "medium",
        question: "튀르키예(터키)의 수도는?",
        options: ["앙카라", "이스탄불", "이즈미르", "안탈리아"],
        correctAnswer: 0,
        explanation: "튀르키예의 수도는 앙카라입니다. 이스탄불은 인구가 가장 많은 도시이지만 수도는 아닙니다."
    },
    {
        id: 70,
        category: "지리",
        difficulty: "medium",
        question: "이집트에 있으며 지중해와 홍해를 잇는 운하는?",
        options: ["파나마 운하", "키엘 운하", "코린트 운하", "수에즈 운하"],
        correctAnswer: 3,
        explanation: "수에즈 운하는 1869년 개통되어 지중해와 홍해를 잇습니다. 파나마 운하는 태평양과 대서양을 잇습니다."
    },

    // --- 예술과 문화 ---
    {
        id: 31,
        category: "예술과 문화",
        difficulty: "hard",
        question: "'게르니카'를 그린 화가는?",
        options: ["살바도르 달리", "파블로 피카소", "마르크 샤갈", "프란시스코 고야"],
        correctAnswer: 1,
        explanation: "파블로 피카소는 1937년 스페인 내전 중 게르니카 폭격의 참상을 다룬 대작 '게르니카'를 그렸습니다."
    },
    {
        id: 32,
        category: "예술과 문화",
        difficulty: "easy",
        question: "레오나르도 다 빈치의 대표작 '모나리자'가 소장되어 있는 박물관은?",
        options: ["대영박물관", "루브르 박물관", "바티칸 박물관", "메트로폴리탄 미술관"],
        correctAnswer: 1,
        explanation: "모나리자는 프랑스 파리의 루브르 박물관에 소장되어 있습니다."
    },
    {
        id: 33,
        category: "예술과 문화",
        difficulty: "easy",
        question: "1889년 작품 '별이 빛나는 밤'을 그린 화가는?",
        options: ["클로드 모네", "폴 세잔", "빈센트 반 고흐", "에드바르 뭉크"],
        correctAnswer: 2,
        explanation: "빈센트 반 고흐는 1889년 프랑스 생레미의 요양원에서 '별이 빛나는 밤'을 그렸습니다."
    },
    {
        id: 34,
        category: "예술과 문화",
        difficulty: "easy",
        question: "'운명'이라는 별칭으로 알려진 교향곡 제5번 다단조의 작곡가는?",
        options: ["루트비히 판 베토벤", "볼프강 아마데우스 모차르트", "요한 제바스티안 바흐", "요하네스 브람스"],
        correctAnswer: 0,
        explanation: "베토벤의 교향곡 제5번 다단조(Op. 67)는 '운명 교향곡'이라는 별칭으로 널리 알려져 있습니다."
    },
    {
        id: 35,
        category: "예술과 문화",
        difficulty: "medium",
        question: "셰익스피어의 4대 비극에 속하지 않는 작품은?",
        options: ["햄릿", "오셀로", "맥베스", "로미오와 줄리엣"],
        correctAnswer: 3,
        explanation: "셰익스피어의 4대 비극은 '햄릿', '오셀로', '리어왕', '맥베스'입니다."
    },
    {
        id: 36,
        category: "예술과 문화",
        difficulty: "medium",
        question: "2008년 방화로 크게 훼손되었다가 2013년에 복구된 서울의 성문은?",
        options: ["숭례문", "흥인지문", "광화문", "돈의문"],
        correctAnswer: 0,
        explanation: "숭례문(남대문)은 2008년 2월 방화로 누각이 크게 훼손되었고, 5년여의 복구 공사를 거쳐 2013년 공개되었습니다."
    },
    {
        id: 37,
        category: "예술과 문화",
        difficulty: "hard",
        question: "오늘날 전승되는 판소리 다섯 마당에 속하지 않는 것은?",
        options: ["춘향가", "수궁가", "적벽가", "변강쇠타령"],
        correctAnswer: 3,
        explanation: "전승되는 판소리 다섯 마당은 춘향가·심청가·흥보가·수궁가·적벽가입니다. 변강쇠타령은 판소리 열두 마당에 속하고 신재효가 정리한 사설은 남아 있지만, 창(소리)이 전승되지 않아 다섯 마당에서 빠졌습니다."
    },
    {
        id: 38,
        category: "예술과 문화",
        difficulty: "easy",
        question: "청동 조각 작품 '생각하는 사람'을 만든 조각가는?",
        options: ["미켈란젤로", "오귀스트 로댕", "도나텔로", "카미유 클로델"],
        correctAnswer: 1,
        explanation: "'생각하는 사람'은 프랑스 조각가 오귀스트 로댕이 '지옥의 문'의 일부로 구상한 작품입니다."
    },
    {
        id: 39,
        category: "예술과 문화",
        difficulty: "medium",
        question: "오페라 '마술피리'를 작곡한 음악가는?",
        options: ["주세페 베르디", "자코모 푸치니", "리하르트 바그너", "볼프강 아마데우스 모차르트"],
        correctAnswer: 3,
        explanation: "'마술피리'는 모차르트가 1791년에 완성한 독일어 오페라(징슈필)입니다."
    },
    {
        id: 40,
        category: "예술과 문화",
        difficulty: "medium",
        question: "조선 역대 왕과 왕비의 신주를 모신 사당으로, 1995년 유네스코 세계유산에 등재된 곳은?",
        options: ["경복궁", "창덕궁", "종묘", "불국사"],
        correctAnswer: 2,
        explanation: "종묘는 조선 왕과 왕비의 신주를 모시고 제례를 올리던 사당으로, 1995년 유네스코 세계유산에 등재되었습니다."
    },
    {
        id: 71,
        category: "예술과 문화",
        difficulty: "easy",
        question: "밀라노 산타 마리아 델레 그라치에 성당 식당 벽에 그려진 '최후의 만찬'의 화가는?",
        options: ["미켈란젤로", "라파엘로", "레오나르도 다 빈치", "산드로 보티첼리"],
        correctAnswer: 2,
        explanation: "'최후의 만찬'은 레오나르도 다 빈치가 1495~1498년경 밀라노의 산타 마리아 델레 그라치에 성당 식당 벽에 그린 작품입니다."
    },
    {
        id: 72,
        category: "예술과 문화",
        difficulty: "medium",
        question: "바티칸 시스티나 성당의 천장화 '천지창조'를 그린 화가는?",
        options: ["미켈란젤로", "레오나르도 다 빈치", "라파엘로", "도나텔로"],
        correctAnswer: 0,
        explanation: "미켈란젤로는 1508~1512년 시스티나 성당 천장화를 그렸고, 이후 제단 벽화 '최후의 심판'도 그렸습니다."
    },
    {
        id: 73,
        category: "예술과 문화",
        difficulty: "medium",
        question: "보물 '단원풍속도첩'에 실린 '씨름'과 '서당'을 그린 조선 후기 화가는?",
        options: ["신윤복", "김홍도", "정선", "안견"],
        correctAnswer: 1,
        explanation: "단원 김홍도는 서민의 일상을 그린 풍속화로 유명하며, '씨름'과 '서당'은 국립중앙박물관 소장 보물 '김홍도 필 풍속도 화첩'에 들어 있습니다."
    },
    {
        id: 74,
        category: "예술과 문화",
        difficulty: "hard",
        question: "1751년 비 갠 뒤의 인왕산을 그린 진경산수화 '인왕제색도'의 화가는?",
        options: ["김홍도", "신윤복", "안견", "정선"],
        correctAnswer: 3,
        explanation: "겸재 정선은 1751년 76세 때 '인왕제색도'를 그렸습니다. 이 작품은 국보로 지정되어 국립중앙박물관에 소장되어 있습니다."
    },
    {
        id: 75,
        category: "예술과 문화",
        difficulty: "medium",
        question: "바이올린 협주곡집 '사계'를 작곡한 이탈리아의 바로크 음악가는?",
        options: ["안토니오 비발디", "요한 제바스티안 바흐", "게오르크 프리드리히 헨델", "프란츠 슈베르트"],
        correctAnswer: 0,
        explanation: "'사계'는 비발디가 작곡한 바이올린 협주곡 4곡(봄·여름·가을·겨울)으로, 1725년 출판된 협주곡집에 실렸습니다."
    },
    {
        id: 76,
        category: "예술과 문화",
        difficulty: "medium",
        question: "소설 '돈키호테'를 쓴 스페인 작가는?",
        options: ["빅토르 위고", "레프 톨스토이", "미겔 데 세르반테스", "찰스 디킨스"],
        correctAnswer: 2,
        explanation: "'돈키호테'는 미겔 데 세르반테스가 1605년(1부)과 1615년(2부)에 발표한 소설입니다."
    },
    {
        id: 77,
        category: "예술과 문화",
        difficulty: "easy",
        question: "훈민정음 반포를 기념하는 대한민국 국경일인 한글날은 몇 월 며칠인가?",
        options: ["3월 1일", "10월 9일", "10월 3일", "8월 15일"],
        correctAnswer: 1,
        explanation: "한글날은 10월 9일입니다. 3월 1일은 삼일절, 10월 3일은 개천절, 8월 15일은 광복절입니다."
    },
    {
        id: 78,
        category: "예술과 문화",
        difficulty: "hard",
        question: "『삼국유사』 기록에 따르면 신라 재상 김대성이 짓기 시작한, 본존불을 모신 인공 석굴 사원은?",
        options: ["석굴암", "해인사", "부석사", "법주사"],
        correctAnswer: 0,
        explanation: "『삼국유사』는 김대성이 751년 불국사와 석불사(석굴암)를 짓기 시작했다고 전합니다(창건 연대에는 다른 견해도 있습니다). 석굴암은 1995년 불국사와 함께 유네스코 세계유산에 등재되었습니다."
    },
    {
        id: 79,
        category: "예술과 문화",
        difficulty: "hard",
        question: "1853년 베네치아 라 페니체 극장에서 초연된 오페라 '라 트라비아타'의 작곡가는?",
        options: ["자코모 푸치니", "조르주 비제", "주세페 베르디", "조아키노 로시니"],
        correctAnswer: 2,
        explanation: "'라 트라비아타'는 주세페 베르디의 오페라로, 1853년 3월 6일 베네치아 라 페니체 극장에서 초연되었습니다."
    },
    {
        id: 80,
        category: "예술과 문화",
        difficulty: "medium",
        question: "2024년 노벨 문학상을 받은 대한민국 작가는?",
        options: ["황석영", "신경숙", "김영하", "한강"],
        correctAnswer: 3,
        explanation: "스웨덴 한림원은 2024년 10월 10일 '채식주의자', '소년이 온다' 등을 쓴 한강을 노벨 문학상 수상자로 발표했습니다."
    }
];

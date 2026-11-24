# 작성일: 2026-11-25 02:38 (수정됨)
import re
import sys
from collections import Counter
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent / "quiz-data.js"
REQUIRED_KEYS = ["id", "category", "difficulty", "question", "options", "correctAnswer", "explanation"]
REQUIRED_CATEGORIES = ["한국사", "과학", "지리", "예술과 문화"]
MIN_PER_CATEGORY = 20
MIN_TOTAL = 80
SUPERLATIVE_KEYWORDS = ["가장", "최초", "최대", "세계에서"]


def parse_questions(content):
    """quiz-data.js의 각 문제 객체 블록을 dict로 추출한다."""
    blocks = re.findall(r"\{(.*?)\n\s*\}", content, re.S)
    questions = []
    for block in blocks:
        q = {"_keys": re.findall(r"^\s*(\w+)\s*:", block, re.M)}
        if m := re.search(r"\bid:\s*(\d+)", block):
            q["id"] = int(m.group(1))
        for key in ("category", "difficulty", "question", "explanation"):
            if m := re.search(rf'\b{key}:\s*"(.*?)"', block):
                q[key] = m.group(1)
        if m := re.search(r"\boptions:\s*\[(.*?)\]", block, re.S):
            q["options"] = re.findall(r'"(.*?)"', m.group(1))
        if m := re.search(r"\bcorrectAnswer:\s*(-?\d+)", block):
            q["correctAnswer"] = int(m.group(1))
        questions.append(q)
    return questions


def check_structure(questions):
    errors = []
    for i, q in enumerate(questions, 1):
        label = f"문제 {q.get('id', f'#{i}')}"
        missing = [k for k in REQUIRED_KEYS if k not in q]
        extra = [k for k in q["_keys"] if k not in REQUIRED_KEYS]
        if missing:
            errors.append(f"{label}: 필수 키 누락 {missing}")
        if extra:
            errors.append(f"{label}: 정의되지 않은 키 {extra}")
        options = q.get("options", [])
        if len(options) != 4:
            errors.append(f"{label}: 보기가 4개가 아님 ({len(options)}개)")
        if len(set(options)) != len(options):
            errors.append(f"{label}: 중복된 보기 존재")
        ans = q.get("correctAnswer")
        if ans is not None and not (0 <= ans < len(options)):
            errors.append(f"{label}: correctAnswer({ans})가 보기 범위를 벗어남")

    ids = [q["id"] for q in questions if "id" in q]
    dup_ids = [k for k, v in Counter(ids).items() if v > 1]
    if dup_ids:
        errors.append(f"중복된 id: {dup_ids}")

    dup_q = [k for k, v in Counter(q.get("question") for q in questions).items() if v > 1]
    if dup_q:
        errors.append(f"중복된 문제: {dup_q}")

    counts = Counter(q.get("category") for q in questions)
    for cat in REQUIRED_CATEGORIES:
        if counts[cat] < MIN_PER_CATEGORY:
            errors.append(f"카테고리 '{cat}' 문제 수 부족: {counts[cat]} / {MIN_PER_CATEGORY}")
    if len(questions) < MIN_TOTAL:
        errors.append(f"총 문제 수 부족: {len(questions)} / {MIN_TOTAL}")
    return counts, errors


def check_superlatives(questions):
    warnings = 0
    for q in questions:
        text = q.get("question", "")
        keyword = next((k for k in SUPERLATIVE_KEYWORDS if k in text), None)
        if keyword:
            print(f"⚠️ [문제 {q.get('id')} 점검 대상] 최상급/범위 표현 '{keyword}' 발견!")
            print(f"   내용: {text}")
            print("   가이드라인: 측정 기준(예: 2024년 기준, 전통적 측정 기준 등)이 제대로 밝혀졌는지 확인하세요.\n")
            warnings += 1
    return warnings


def validate_quiz():
    print("🔍 [Quiz Validator] quiz-data.js 구조와 할루시네이션 방지 가이드라인을 검증합니다...\n")
    try:
        content = DATA_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"❌ {DATA_FILE} 파일을 찾을 수 없습니다.")
        return 1

    questions = parse_questions(content)
    print(f"📋 총 {len(questions)}개의 문제 검사를 시작합니다.\n")

    counts, errors = check_structure(questions)
    print("📊 카테고리별 문제 수: " + ", ".join(f"{c} {n}" for c, n in counts.items()) + "\n")

    warnings = check_superlatives(questions)
    if warnings == 0:
        print("✅ 모호한 최상급 표현이 없습니다.")
    else:
        print(f"💡 총 {warnings}개의 문제에 명확한 측정 기준이 적용되었는지 확인하세요.")

    if errors:
        print("\n❌ 구조 검증 실패:")
        for e in errors:
            print(f"   - {e}")
        return 1
    print("\n✅ 구조 검증 통과: 필수 키, 4지선다, 정답 범위, 카테고리별/총 문제 수 조건을 모두 만족합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(validate_quiz())

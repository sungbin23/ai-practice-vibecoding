<!-- 작성일: 2026-11-25 02:09 -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 인공지능활용실습 - VibeCoding
과목 실습 결과물(Study-01~06)을 하위 폴더로 모은 저장소입니다. 각 Study 폴더는 독립된 프로젝트이며, 폴더별 규칙은 각 폴더의 CLAUDE.md를 따릅니다.

## Git 규칙
- **브랜치를 새로 만들지 않습니다.** 모든 작업은 항상 `main` 브랜치에서 하고, 커밋은 `main`에 바로 push합니다(`git push origin main`).
- 작업을 시작할 때 `main`이 아닌 브랜치에 있다면 `main`으로 옮긴 뒤 진행합니다.
- 커밋은 Study 폴더별로 나눕니다(한 커밋에 여러 Study의 변경을 섞지 않음).
- push 전에 `.env` 등 비밀값 파일이 커밋에 들어가지 않았는지 확인합니다(루트 `.gitignore`에 `.env`, `*.env` 포함).

## 작업 규칙
- 새로 만드는 파일 첫 줄에 작성 날짜·시간 주석을 넣고, 기존 파일을 수정하면 `(수정됨)`을 붙여 시각을 갱신합니다. JSON 등 주석을 지원하지 않는 형식은 예외입니다.

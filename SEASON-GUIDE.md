# 배드민턴 시즌 스케줄 관리 가이드

## 개요

배드민턴 경기 데이터 업데이트 주기를 자동으로 조정하는 시스템입니다.

### 업데이트 주기
- **경기 시즌 중**: 매일 3회 (오전 6시, 12시, 오후 6시 KST)
- **비시즌**: 2주마다 1회 (일요일 오전 9시 KST)

## 파일 구조

```
sports-dashboard/
├── season-config.json           # 시즌 설정 파일
├── season-manager.js            # 시즌 관리 스크립트
├── crawl-sports.js              # 업데이트된 크롤러 (시즌 체크 포함)
└── .github/workflows/
    └── update-data-smart.yml    # 스마트 스케줄링 워크플로우
```

## 사용 방법

### 1. 경기 시즌 시작

새로운 대회가 시작될 때:

```bash
node season-manager.js start "대회명" "시작일" "종료일"
```

**예시:**
```bash
node season-manager.js start "2025 BWF 월드투어 파이널스" "2025-12-17" "2025-12-21"
```

이렇게 하면:
- ✅ 시즌이 활성화됨
- ✅ 매일 3회 자동 업데이트 시작 (6시, 12시, 18시)
- ✅ `season-config.json` 파일이 자동 업데이트됨

### 2. 경기 시즌 종료

대회가 끝났을 때 (또는 자동으로 종료됨):

```bash
node season-manager.js end
```

이렇게 하면:
- ✅ 시즌이 비활성화됨
- ✅ 2주마다 1회 업데이트로 전환 (일요일 9시)

### 3. 예정 대회 추가

미리 다음 대회 일정 등록:

```bash
node season-manager.js add "대회명" "시작일" "종료일"
```

**예시:**
```bash
node season-manager.js add "2026 말레이시아 마스터스" "2026-01-14" "2026-01-19"
```

### 4. 현재 상태 확인

```bash
node season-manager.js status
```

**출력 예시:**
```
========================================
배드민턴 시즌 상태
========================================
현재 시간: 2025-12-18 10:30:00 KST
시즌 활성화: ✅ 예

현재 대회: 2025 BWF 월드투어 파이널스
기간: 2025-12-17 ~ 2025-12-21
업데이트 주기: 매일 3회 (6시, 12시, 18시 KST)

예정된 대회:
1. 2026 말레이시아 마스터스
   2026-01-14 ~ 2026-01-19

마지막 업데이트: 2025-12-18T01:30:00.000Z
========================================
```

## 자동화

### GitHub Actions 자동 실행

워크플로우가 다음을 자동으로 수행합니다:

1. **시즌 체크**: 매번 실행 전에 현재 시즌 상태 확인
2. **자동 시즌 전환**: 대회 시작/종료일에 자동으로 업데이트 주기 변경
3. **조건부 업데이트**: 
   - 시즌 중: 매일 6시, 12시, 18시만 실행
   - 비시즌: 일요일만 실행

### 수동 실행

GitHub에서 수동으로 강제 업데이트:

1. GitHub 저장소 → **Actions** 탭
2. **Update Sports Data (Smart Schedule)** 선택
3. **Run workflow** 버튼 클릭
4. `force_update`를 `true`로 설정 (시즌 체크 무시)

## 설정 파일 (season-config.json)

```json
{
  "badminton": {
    "seasonActive": true,
    "currentTournament": {
      "name": "2025 BWF 월드투어 파이널스",
      "startDate": "2025-12-17",
      "endDate": "2025-12-21",
      "updateFrequency": "daily"
    },
    "upcomingTournaments": [
      {
        "name": "2026 말레이시아 마스터스",
        "startDate": "2026-01-14",
        "endDate": "2026-01-19",
        "updateFrequency": "daily"
      }
    ],
    "offSeasonUpdateFrequency": "biweekly"
  },
  "lastUpdated": "2025-12-18T00:00:00Z"
}
```

### 필드 설명

- `seasonActive`: 현재 시즌 활성화 여부 (true/false)
- `currentTournament`: 현재 진행 중인 대회 정보
  - `name`: 대회명
  - `startDate`: 시작일 (YYYY-MM-DD)
  - `endDate`: 종료일 (YYYY-MM-DD)
  - `updateFrequency`: 업데이트 주기 ("daily")
- `upcomingTournaments`: 예정된 대회 목록 (배열)
- `offSeasonUpdateFrequency`: 비시즌 업데이트 주기 ("biweekly")

## 실전 사용 시나리오

### 시나리오 1: 새 대회 시작

```bash
# 1. 대회 시작 전날 또는 당일
node season-manager.js start "2026 전영오픈" "2026-03-11" "2026-03-16"

# 2. 상태 확인
node season-manager.js status

# 3. Git에 커밋
git add season-config.json
git commit -m "시즌 시작: 2026 전영오픈"
git push
```

이후 자동으로:
- ✅ 매일 6시, 12시, 18시에 데이터 업데이트
- ✅ 대회 종료일 지나면 자동으로 비시즌 전환

### 시나리오 2: 여러 대회 미리 등록

```bash
# 1월부터 3월까지 대회 일정 미리 등록
node season-manager.js add "2026 말레이시아 마스터스" "2026-01-14" "2026-01-19"
node season-manager.js add "2026 인도오픈" "2026-01-21" "2026-01-26"
node season-manager.js add "2026 전영오픈" "2026-03-11" "2026-03-16"

# Git에 커밋
git add season-config.json
git commit -m "2026 Q1 대회 일정 등록"
git push
```

이후:
- ✅ 각 대회 시작일에 자동으로 시즌 활성화
- ✅ 각 대회 종료일에 자동으로 비시즌 전환

### 시나리오 3: 긴급 업데이트

경기 중 중요한 결과가 나왔을 때:

```bash
# 1. 로컬에서 수동 실행
node crawl-sports.js

# 2. Git에 커밋
git add public/data/
git commit -m "긴급 업데이트: 안세영 결승 진출"
git push
```

또는 GitHub에서:
1. Actions → Run workflow
2. `force_update: true` 선택
3. Run workflow 버튼 클릭

## Package.json 스크립트

편의를 위한 npm 스크립트 추가:

```json
{
  "scripts": {
    "season:start": "node season-manager.js start",
    "season:end": "node season-manager.js end",
    "season:add": "node season-manager.js add",
    "season:status": "node season-manager.js status",
    "season:auto": "node season-manager.js auto",
    "crawl": "node crawl-sports.js"
  }
}
```

사용:
```bash
npm run season:status
npm run season:start "BWF 파이널스" "2025-12-17" "2025-12-21"
npm run crawl
```

## 문제 해결

### 업데이트가 실행되지 않음

1. **시즌 상태 확인**
   ```bash
   node season-manager.js status
   ```

2. **수동 시즌 체크**
   ```bash
   node season-manager.js auto
   ```

3. **강제 업데이트**
   ```bash
   node crawl-sports.js
   ```

### 설정 파일 초기화

```bash
# 설정 파일 삭제
rm season-config.json

# 크롤러 실행 (자동으로 기본 설정 생성)
node crawl-sports.js
```

## 주의사항

1. **날짜 형식**: 반드시 `YYYY-MM-DD` 형식 사용
2. **시간대**: 모든 시간은 KST (한국 표준시) 기준
3. **Git 커밋**: 설정 변경 후 반드시 커밋 & 푸시
4. **자동 전환**: 대회 종료일이 지나면 자동으로 비시즌 전환

## 향후 개선 계획

- [ ] BWF 공식 캘린더 API 연동 (자동 대회 일정 가져오기)
- [ ] 웹 UI로 시즌 관리
- [ ] 경기 시작 30분 전 자동 알림
- [ ] 실시간 스코어 추적 (경기 진행 중)

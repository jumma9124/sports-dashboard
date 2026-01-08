// public/js/volleyball.js
// 배구팀 (현대캐피탈) 데이터 로딩 및 표시

let volleyballSeasonConfig = null;

// 시즌 설정 로드
async function loadVolleyballSeasonConfig() {
  try {
    const response = await fetch('./public/data/season-config.json');
    const config = await response.json();
    volleyballSeasonConfig = config.volleyball;
    return volleyballSeasonConfig;
  } catch (error) {
    console.error('🏐 [배구] 시즌 설정 로드 실패:', error);
    return null;
  }
}

// 시즌 체크 (season-config.json 우선, 없으면 월 기반)
function isVolleyballSeason() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  
  if (volleyballSeasonConfig && volleyballSeasonConfig.seasons) {
    // 설정 파일에서 시즌 확인
    const seasons = volleyballSeasonConfig.seasons;
    for (const [key, season] of Object.entries(seasons)) {
      const start = new Date(season.start);
      const end = new Date(season.end);
      if (now >= start && now <= end) {
        return true;
      }
    }
    return false;
  }
  
  // 기본값: 10월~4월
  return month >= 10 || month <= 4;
}

async function loadVolleyballData() {
  console.log('🏐 [배구] 데이터 로딩 시작...');
  
  try {
    // 시즌 설정 먼저 로드
    await loadVolleyballSeasonConfig();
    
    const response = await fetch('./public/data/sports.json');
    console.log('🏐 [배구] API 응답:', response.status);
    
    const data = await response.json();
    const volleyball = data.volleyball;
    
    console.log('🏐 [배구] 데이터:', volleyball);
    console.log('🏐 [배구] 시즌 중:', isVolleyballSeason());

    if (isVolleyballSeason()) {
      // 시즌 중 UI
      updateVolleyballSeasonMode(volleyball);
    } else {
      // 시즌 종료 UI
      updateVolleyballOffseasonMode(volleyball);
    }
    
    console.log('🏐 [배구] 데이터 로딩 완료!');
    
  } catch (error) {
    console.error('❌ [배구] 데이터 로딩 실패:', error);
    displayVolleyballError();
  }
}

// 시즌 중 UI (현재 상태)
function updateVolleyballSeasonMode(volleyball) {
  // 팀 정보 표시
  updateVolleyballTeamInfo(volleyball);
  
  // 최근 경기 표시
  displayVolleyballRecentMatch(volleyball.pastMatches);
  
  // 다음 경기 로딩
  loadVolleyballNextMatch();
}

// 시즌 종료 UI (야구처럼)
function updateVolleyballOffseasonMode(volleyball) {
  // 순위 (최종 순위)
  const rankElement = document.getElementById('volleyball-rank');
  if (rankElement && volleyball.rank) {
    rankElement.textContent = volleyball.rank;
  }

  // 전적/승률/승점으로 변경
  const statRowElement = document.querySelector('.volleyball-card .stat-row');
  if (statRowElement && volleyball.record) {
    statRowElement.innerHTML = `
      <span class="stat-label">전적 / 승률 / 승점</span>
      <span class="stat-value">
        <span>${volleyball.record}</span>
        <span style="margin: 0 8px; color: rgba(255,255,255,0.4);">/</span>
        <span>승률 ${volleyball.winRate || '-'}</span>
        <span style="margin: 0 8px; color: rgba(255,255,255,0.4);">/</span>
        <span>${volleyball.points || '-'}점</span>
      </span>
    `;
  }

  // 최근 경기 영역을 마지막 시리즈로 변경
  const recentMatchElement = document.getElementById('volleyball-recent-match');
  if (recentMatchElement) {
    // 마지막 시리즈 데이터 (시즌 종료 시 설정 필요)
    const lastSeries = volleyball.lastSeries || {
      name: '2024-25 V-리그',
      opponent: '-',
      result: '-'
    };

    recentMatchElement.innerHTML = `
      <div class="recent-match-label">마지막 시리즈</div>
      <div class="recent-match-info" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="opponent" style="margin-bottom: 0;">vs ${lastSeries.opponent}</span>
          <span class="result ${lastSeries.wins > lastSeries.losses ? 'win' : 'loss'}">${lastSeries.wins || 0}승 ${lastSeries.losses || 0}패</span>
        </div>
        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6);">${lastSeries.name}</div>
      </div>
    `;
  }

  // 다음 경기 영역을 시즌 정보로 변경
  const nextMatchElement = document.getElementById('volleyball-next-match');
  if (nextMatchElement) {
    nextMatchElement.innerHTML = `
      <div class="season-note" style="text-align: center; padding: 10px; color: rgba(255,255,255,0.6); font-size: 0.9rem;">
        2024-25 시즌 최종 순위 (2025년 10월 재개)
      </div>
    `;
  }
}

function updateVolleyballTeamInfo(volleyball) {
  // 순위
  const rankElement = document.getElementById('volleyball-rank');
  if (rankElement && volleyball.rank) {
    rankElement.textContent = volleyball.rank;
  }

  // 전적
  const recordElement = document.getElementById('volleyball-record');
  if (recordElement && volleyball.record) {
    recordElement.textContent = volleyball.record;
  }

  // 승률
  const winRateElement = document.getElementById('volleyball-winrate');
  if (winRateElement && volleyball.winRate) {
    winRateElement.textContent = `승률 ${volleyball.winRate}`;
  }

  // 세트득실률
  const setRatioElement = document.getElementById('volleyball-setratio');
  if (setRatioElement && volleyball.setRatio) {
    setRatioElement.textContent = volleyball.setRatio;
  }
}

async function loadVolleyballNextMatch() {
  console.log('🏐 [배구 다음 경기] 로딩 시작...');
  
  try {
    // sports.json에서 다음 경기 정보 가져오기
    const response = await fetch('./public/data/sports.json');
    const data = await response.json();
    
    if (data.volleyball && data.volleyball.nextMatch) {
      console.log('🏐 [배구 다음 경기] 데이터:', data.volleyball.nextMatch);
      displayVolleyballNextMatch(data.volleyball.nextMatch);
    } else {
      console.log('⚠️ [배구 다음 경기] 크롤링된 데이터 없음');
      displayVolleyballNextMatch(null);
    }
    
    console.log('🏐 [배구 다음 경기] 로딩 완료!');
    
  } catch (error) {
    console.error('❌ [배구 다음 경기] 로딩 실패:', error);
    displayVolleyballNextMatch(null);
  }
}

function displayVolleyballNextMatch(match) {
  const nextMatchElement = document.getElementById('volleyball-next-match');
  if (!nextMatchElement || !match) return;

  const matchDate = new Date(match.date);
  matchDate.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 오늘 이후 경기만 표시 (오늘 포함)
  if (matchDate >= today) {
    // YY.MM.DD 형식
    const shortDate = `${String(matchDate.getFullYear()).slice(2)}.${String(matchDate.getMonth() + 1).padStart(2, '0')}.${String(matchDate.getDate()).padStart(2, '0')}`;
    const location = match.location || '장소 미정';
    
    nextMatchElement.innerHTML = `
      <div class="next-match-label">다음 경기</div>
      <div class="next-match-info" style="display: flex; align-items: center; justify-content: space-between;">
        <div class="opponent">vs ${match.opponent} (${location})</div>
        <div class="match-date" style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">${shortDate}</div>
      </div>
    `;
  } else {
    nextMatchElement.innerHTML = `
      <div class="next-match-label">다음 경기</div>
      <div class="next-match-info">
        <div class="no-match">예정된 경기 없음</div>
      </div>
    `;
  }
}

function displayVolleyballRecentMatch(pastMatches) {
  const recentMatchElement = document.getElementById('volleyball-recent-match');
  if (!recentMatchElement) return;

  if (pastMatches && pastMatches.length > 0) {
    const match = pastMatches[0]; // 가장 최근 경기
    const matchDate = new Date(match.date);
    const shortDate = `${String(matchDate.getFullYear()).slice(2)}.${String(matchDate.getMonth() + 1).padStart(2, '0')}.${String(matchDate.getDate()).padStart(2, '0')}`;
    
    // 상대팀 이름 (현대캐피탈이 아닌 팀)
    const opponent = match.homeTeam.includes('현대캐피탈') ? match.awayTeam : match.homeTeam;
    const resultClass = match.result === '승' ? 'win' : 'loss';
    
    recentMatchElement.innerHTML = `
      <div class="recent-match-label">최근 경기</div>
      <div class="recent-match-info" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="opponent" style="margin-bottom: 0;">vs ${opponent}</span>
          <span class="result ${resultClass}">${match.result} (${match.score})</span>
        </div>
        <div class="match-date" style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">${shortDate}</div>
      </div>
    `;
    console.log('🏐 [배구 최근 경기]', opponent, match.result, match.score);
  } else {
    recentMatchElement.innerHTML = `
      <div class="recent-match-label">최근 경기</div>
      <div class="recent-match-info">
        <div class="no-data">최근 경기 기록 없음</div>
      </div>
    `;
  }
}

function displayVolleyballError() {
  const container = document.querySelector('.volleyball-card');
  if (container) {
    container.innerHTML += '<div class="error-message">데이터를 불러올 수 없습니다</div>';
  }
}

// 페이지 로드 시 자동 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadVolleyballData);
} else {
  loadVolleyballData();
}

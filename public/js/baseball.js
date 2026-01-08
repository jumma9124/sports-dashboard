// public/js/baseball.js
// 야구팀 (한화 이글스) 데이터 로딩 및 표시

// 시즌 체크 (3월~10월이 시즌)
function isBaseballSeason() {
  const month = new Date().getMonth() + 1; // 1-12
  return month >= 3 && month <= 10;
}

async function loadBaseballData() {
  console.log('⚾ [야구] 데이터 로딩 시작...');
  
  try {
    const response = await fetch('./public/data/sports.json');
    console.log('⚾ [야구] API 응답:', response.status);
    
    const data = await response.json();
    const baseball = data.baseball;
    
    console.log('⚾ [야구] 데이터:', baseball);
    console.log('⚾ [야구] 시즌 중:', isBaseballSeason());

    if (isBaseballSeason()) {
      // 시즌 중 UI
      updateBaseballSeasonMode(baseball);
    } else {
      // 시즌 종료 UI
      updateBaseballOffseasonMode(baseball);
    }
    
    console.log('⚾ [야구] 데이터 로딩 완료!');
    
  } catch (error) {
    console.error('❌ [야구] 데이터 로딩 실패:', error);
    displayBaseballError();
  }
}

// 시즌 중 UI 표시
function updateBaseballSeasonMode(baseball) {
  // 테스트용 목업 데이터 (2025년 7월 3일 기준)
  const mockData = {
    rank: '1위',
    yesterdayGame: {
      date: '2025-07-02',
      opponent: '키움',
      score: '8:3',
      result: '승',
      location: '대전'
    },
    nextGame: {
      date: '2025-07-03',
      opponent: '삼성',
      time: '18:30',
      location: '대전'
    },
    weekGames: [
      { date: '2025-06-30', opponent: '키움', score: '5:2', result: '승' },
      { date: '2025-07-01', opponent: '키움', score: '4:3', result: '승' },
      { date: '2025-07-02', opponent: '키움', score: '8:3', result: '승' }
    ]
  };

  // 테스트 모드: 실제 데이터가 없으면 목업 사용
  const data = baseball.yesterdayGame ? baseball : mockData;

  // 순위 (항상 현재 순위)
  const rankElement = document.getElementById('baseball-rank');
  if (rankElement) {
    rankElement.textContent = data.rank || baseball.rank;
  }

  // 어제 경기 결과 표시 (stat-row 영역 대체) - 날짜 포함
  const statRowElement = document.querySelector('.baseball-card .stat-row');
  if (statRowElement && data.yesterdayGame) {
    const game = data.yesterdayGame;
    const resultClass = game.result === '승' ? 'win' : 'loss';
    const dateStr = game.date ? `(${game.date.substring(5).replace('-', '/')})` : '';
    statRowElement.innerHTML = `
      <span class="stat-label">어제 경기</span>
      <span class="stat-value">
        ${game.opponent} ${game.score} 
        <span class="result ${resultClass}" style="margin-left: 8px;">${game.result}</span>
        <span style="margin-left: 8px; color: rgba(255,255,255,0.6);">${game.location} ${dateStr}</span>
      </span>
    `;
  } else if (statRowElement) {
    statRowElement.innerHTML = `
      <span class="stat-label">어제 경기</span>
      <span class="stat-value" style="color: rgba(255,255,255,0.5);">경기 없음</span>
    `;
  }

  // 다음 경기 표시
  const nextMatchElement = document.getElementById('baseball-next-match');
  if (nextMatchElement && data.nextGame) {
    const game = data.nextGame;
    const dateStr = game.date ? game.date.substring(5).replace('-', '.') : '';
    nextMatchElement.style.display = 'block';
    nextMatchElement.innerHTML = `
      <div class="next-match-label">다음 경기</div>
      <div class="next-match-info" style="display: flex; align-items: center; justify-content: space-between;">
        <div class="opponent">vs ${game.opponent}</div>
        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">${dateStr}</div>
      </div>
    `;
  } else if (nextMatchElement) {
    nextMatchElement.style.display = 'none';
  }

  // 마지막 시리즈 영역을 지난주 경기로 대체
  const lastSeriesElement = document.getElementById('baseball-last-series');
  if (lastSeriesElement && data.weekGames && data.weekGames.length > 0) {
    const gamesHTML = data.weekGames.map(game => {
      const resultClass = game.result === '승' ? 'win' : 'loss';
      const dateStr = game.date.substring(5).replace('-', '/'); // MM/DD 형식
      return `
        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
          <span style="color: rgba(255,255,255,0.6); font-size: 0.8rem; min-width: 45px;">${dateStr}</span>
          <span style="font-weight: 500;">${game.opponent}</span>
          <span>${game.score}</span>
          <span class="result ${resultClass}">${game.result}</span>
        </div>
      `;
    }).join('');

    lastSeriesElement.innerHTML = `
      <div class="recent-match-label">지난주 경기</div>
      <div class="recent-match-info" style="padding: 8px 10px;">
        ${gamesHTML}
      </div>
    `;
  } else if (lastSeriesElement) {
    lastSeriesElement.innerHTML = `
      <div class="recent-match-label">지난주 경기</div>
      <div class="recent-match-info">
        <div class="no-data">경기 기록 없음</div>
      </div>
    `;
  }

  // 시즌 정보 숨기기
  const seasonInfoElement = document.getElementById('baseball-season-info');
  if (seasonInfoElement) {
    seasonInfoElement.style.display = 'none';
  }
}

// 시즌 종료 UI 표시 (현재 상태)
function updateBaseballOffseasonMode(baseball) {
  // 순위
  const rankElement = document.getElementById('baseball-rank');
  if (rankElement && baseball.rank) {
    rankElement.textContent = baseball.rank;
  }

  // 전적
  const recordElement = document.getElementById('baseball-record');
  if (recordElement && baseball.record) {
    recordElement.textContent = baseball.record;
  }

  // 승률
  const winRateElement = document.getElementById('baseball-winrate');
  if (winRateElement && baseball.winRate) {
    winRateElement.textContent = `승률 ${baseball.winRate}`;
  }

  // 시즌 정보 표시
  const seasonInfoElement = document.getElementById('baseball-season-info');
  if (seasonInfoElement && baseball.note) {
    seasonInfoElement.innerHTML = `
      <div class="season-note">${baseball.note}</div>
    `;
  }

  // 마지막 시리즈 표시 (2025 한국시리즈)
  displayLastSeries();
}

function displayLastSeries() {
  const lastSeriesElement = document.getElementById('baseball-last-series');
  if (!lastSeriesElement) return;

  // 2025 한국시리즈 데이터 (한화 vs LG, 1승 4패 패배)
  const lastSeries = {
    name: '2025 한국시리즈',
    opponent: 'LG 트윈스',
    wins: 1,
    losses: 4,
    result: '준우승'
  };

  const resultClass = lastSeries.wins > lastSeries.losses ? 'win' : 'loss';
  const resultText = `${lastSeries.wins}승 ${lastSeries.losses}패`;

  lastSeriesElement.innerHTML = `
    <div class="recent-match-label">마지막 시리즈</div>
    <div class="recent-match-info" style="display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="opponent" style="margin-bottom: 0;">vs ${lastSeries.opponent}</span>
        <span class="result ${resultClass}">${resultText}</span>
      </div>
      <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6);">${lastSeries.name}</div>
    </div>
  `;
  
  console.log('⚾ [야구 마지막 시리즈]', lastSeries.opponent, resultText);
}

function displayBaseballError() {
  const container = document.querySelector('.baseball-card');
  if (container) {
    container.innerHTML += '<div class="error-message">데이터를 불러올 수 없습니다</div>';
  }
}

// 페이지 로드 시 자동 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadBaseballData);
} else {
  loadBaseballData();
}

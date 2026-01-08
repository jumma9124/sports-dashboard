// public/js/baseball.js
// 야구팀 (한화 이글스) 데이터 로딩 및 표시

async function loadBaseballData() {
  console.log('⚾ [야구] 데이터 로딩 시작...');
  
  try {
    const response = await fetch('./public/data/sports.json');
    console.log('⚾ [야구] API 응답:', response.status);
    
    const data = await response.json();
    const baseball = data.baseball;
    
    console.log('⚾ [야구] 데이터:', baseball);

    updateBaseballTeamInfo(baseball);
    
    console.log('⚾ [야구] 데이터 로딩 완료!');
    
  } catch (error) {
    console.error('❌ [야구] 데이터 로딩 실패:', error);
    displayBaseballError();
  }
}

function updateBaseballTeamInfo(baseball) {
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
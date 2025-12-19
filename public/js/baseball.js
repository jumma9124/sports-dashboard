// public/js/baseball.js
// 야구팀 (SSG 랜더스) 데이터 로딩 및 표시

async function loadBaseballData() {
  try {
    const response = await fetch('./public/data/sports.json');
    const data = await response.json();
    const baseball = data.baseball;

    updateBaseballTeamInfo(baseball);
    
  } catch (error) {
    console.error('야구 데이터 로딩 실패:', error);
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

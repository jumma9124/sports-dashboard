// public/js/volleyball.js
// 배구팀 (현대캐피탈) 데이터 로딩 및 표시

async function loadVolleyballData() {
  try {
    const response = await fetch('./public/data/sports.json');
    const data = await response.json();
    const volleyball = data.volleyball;

    // 팀 정보 표시
    updateVolleyballTeamInfo(volleyball);
    
    // 다음 경기 로딩
    await loadVolleyballNextMatch();
    
  } catch (error) {
    console.error('배구 데이터 로딩 실패:', error);
    displayVolleyballError();
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
    setRatioElement.textContent = `세트득실률 ${volleyball.setRatio}`;
  }
}

async function loadVolleyballNextMatch() {
  try {
    // 배구 일정은 별도 JSON 파일이나 크롤링으로 가져올 수 있음
    // 현재는 하드코딩된 예시
    const nextMatch = {
      date: '2025-12-21',
      time: '14:00',
      opponent: 'OK저축은행',
      location: '안산상록수체육관'
    };

    displayVolleyballNextMatch(nextMatch);
    
  } catch (error) {
    console.error('배구 다음 경기 로딩 실패:', error);
  }
}

function displayVolleyballNextMatch(match) {
  const nextMatchElement = document.getElementById('volleyball-next-match');
  if (!nextMatchElement || !match) return;

  const matchDate = new Date(match.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 오늘 이후 경기만 표시
  if (matchDate >= today) {
    const formattedDate = `${matchDate.getMonth() + 1}월 ${matchDate.getDate()}일`;
    const formattedTime = match.time || '19:00';
    
    nextMatchElement.innerHTML = `
      <div class="next-match-label">다음 경기</div>
      <div class="next-match-info">
        <div class="opponent">vs ${match.opponent}</div>
        <div class="match-details">
          <span class="match-date">${formattedDate}</span>
          <span class="match-separator">•</span>
          <span class="match-time">${formattedTime}</span>
        </div>
        <div class="match-location">${match.location}</div>
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
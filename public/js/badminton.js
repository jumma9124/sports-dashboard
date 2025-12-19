// public/js/badminton.js
// 안세영 선수 데이터 로딩 및 표시

async function loadBadmintonData() {
  try {
    const response = await fetch('./public/data/ahn-seyoung-matches.json');
    const data = await response.json();

    updateBadmintonRanking();
    updateRecentMatch(data.recent || []);
    updateNextMatch(data.upcoming || []);
    
  } catch (error) {
    console.error('안세영 데이터 로딩 실패:', error);
    displayBadmintonError();
  }
}

function updateBadmintonRanking() {
  // 랭킹은 헤더에 이미 "세계 1위"로 표시되어 있음
  
  const pointsElement = document.getElementById('badminton-points');
  if (pointsElement) {
    pointsElement.innerHTML = `
      <div class="stat-row">
        <span class="stat-label">포인트</span>
        <div style="text-align: right;">
          <div class="stat-value">111,490</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6);">최근 대회 17개</div>
        </div>
      </div>
    `;
  }
}

function updateRecentMatch(recentMatches) {
  const recentMatchElement = document.getElementById('badminton-recent-match');
  
  if (!recentMatches || recentMatches.length === 0) {
    if (recentMatchElement) {
      recentMatchElement.innerHTML = '<div class="no-data">최근 경기 없음</div>';
    }
    return;
  }

  const lastMatch = recentMatches[0];
  const matchDate = new Date(lastMatch.date);
  const formattedDate = `${matchDate.getMonth() + 1}.${matchDate.getDate()}`;
  
  if (recentMatchElement) {
    const resultClass = lastMatch.result === 'WIN' ? 'win' : 'loss';
    const resultText = lastMatch.result === 'WIN' ? '승' : '패';
    
    recentMatchElement.innerHTML = `
      <div class="recent-match-label">최근 경기</div>
      <div class="recent-match-info">
        <div class="result ${resultClass}">${resultText}</div>
        <div class="opponent">vs ${lastMatch.opponent}</div>
        <div class="score">${lastMatch.score}</div>
        <div class="match-date">${formattedDate}</div>
      </div>
    `;
  }
}

function updateNextMatch(upcomingMatches) {
  const nextMatchElement = document.getElementById('badminton-next-match');
  
  if (!nextMatchElement) return;

  // upcomingMatches가 배열이 아니거나 비어있는 경우 처리
  if (!Array.isArray(upcomingMatches) || upcomingMatches.length === 0) {
    nextMatchElement.innerHTML = `
      <div class="next-match-label">다음 경기</div>
      <div class="next-match-info">
        <div class="no-match">예정된 경기 없음</div>
      </div>
    `;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 오늘 이후 경기만 필터링
  const futureMatches = upcomingMatches
    .map(match => ({
      ...match,
      dateObj: new Date(match.date)
    }))
    .filter(match => match.dateObj >= today)
    .sort((a, b) => a.dateObj - b.dateObj);
  
  if (futureMatches.length === 0) {
    nextMatchElement.innerHTML = `
      <div class="next-match-label">다음 경기</div>
      <div class="next-match-info">
        <div class="no-match">예정된 경기 없음</div>
      </div>
    `;
    return;
  }

  const nextMatch = futureMatches[0];
  const matchDate = nextMatch.dateObj;
  const formattedDate = `${matchDate.getFullYear()}.${matchDate.getMonth() + 1}.${matchDate.getDate()}`;
  
  nextMatchElement.innerHTML = `
    <div class="next-match-label">다음 경기</div>
    <div class="next-match-info">
      <div class="tournament-name">${nextMatch.tournament}</div>
      <div class="opponent">vs ${nextMatch.opponent}</div>
      <div class="match-details">
        <span class="match-date">${formattedDate}</span>
        ${nextMatch.time ? `<span class="match-separator">•</span><span class="match-time">${nextMatch.time}</span>` : ''}
      </div>
    </div>
  `;
}

function displayBadmintonError() {
  const container = document.querySelector('.badminton-card');
  if (container) {
    container.innerHTML += '<div class="error-message">데이터를 불러올 수 없습니다</div>';
  }
}

// 페이지 로드 시 자동 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadBadmintonData);
} else {
  loadBadmintonData();
}

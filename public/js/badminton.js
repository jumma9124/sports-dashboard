// 안세영 배드민턴 데이터 로딩
async function loadBadmintonData() {
    console.log('🏸 [안세영] 데이터 로딩 시작...');
    
    try {
        const response = await fetch('./public/data/ahn-seyoung-matches.json');
        const data = await response.json();
        
        console.log('🏸 [안세영] 데이터:', data);
        
        // 포인트 표시
        const pointsHtml = `
            <div class="stat-row">
                <span class="stat-label">포인트</span>
                <span class="stat-value">${data.points ? data.points.toLocaleString() : '111,490'}</span>
            </div>
            <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); text-align: right; margin-top: 3px;">
                최근 대회 17개
            </div>
        `;
        document.getElementById('badminton-points').innerHTML = pointsHtml;
        
        // 최근 경기
        if (data.recent && data.recent.length > 0) {
            const match = data.recent[0];
            const recentHtml = `
                <div class="recent-match-label">최근 경기</div>
                <div class="recent-match-info">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="result ${match.result === '승' ? 'win' : 'loss'}">${match.result}</span>
                        <span style="font-size: 0.9rem; font-weight: 600;">vs ${match.opponent}</span>
                    </div>
                    <div class="match-details">
                        <span>${match.score}</span>
                        <span class="match-separator">·</span>
                        <span>${match.date}</span>
                    </div>
                </div>
            `;
            document.getElementById('badminton-recent-match').innerHTML = recentHtml;
        }
        
        // 다음 경기/대회
        if (data.nextTournament) {
            // BWF 대회 일정이 있는 경우
            const tournament = data.nextTournament;
            const daysInfo = data.tournamentDays;
            
            const statusClass = daysInfo.type === 'ongoing' ? 'ongoing' : 'upcoming';
            const statusText = daysInfo.type === 'ongoing' ? '진행중' : '예정';
            
            const upcomingHtml = `
                <div class="next-match-label">다음 대회</div>
                <div class="next-match-info">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 600; font-size: 0.95rem;">${tournament.name}</span>
                        <span class="dday ${statusClass}">${daysInfo.text}</span>
                    </div>
                    <div class="match-details">
                        <span>${tournament.category}</span>
                        <span class="match-separator">·</span>
                        <span>${tournament.country}</span>
                    </div>
                </div>
            `;
            document.getElementById('badminton-next-match').innerHTML = upcomingHtml;
        } else if (data.upcoming && data.upcoming.length > 0) {
            // 기존 upcoming 경기 표시
            const match = data.upcoming[0];
            const upcomingHtml = `
                <div class="next-match-label">다음 경기</div>
                <div class="next-match-info">
                    <div class="opponent">${match.tournament}</div>
                    <div class="match-details">
                        <span>${match.date}</span>
                        ${match.opponent ? `<span class="match-separator">·</span><span>vs ${match.opponent}</span>` : ''}
                    </div>
                </div>
            `;
            document.getElementById('badminton-next-match').innerHTML = upcomingHtml;
        } else {
            const noMatchHtml = `
                <div class="next-match-label">다음 대회</div>
                <div class="next-match-info">
                    <div class="no-match">예정된 대회 없음</div>
                </div>
            `;
            document.getElementById('badminton-next-match').innerHTML = noMatchHtml;
        }
        
        console.log('✅ [안세영] 데이터 로딩 완료');
    } catch (error) {
        console.error('❌ [안세영] 데이터 로딩 실패:', error);
    }
}

// 페이지 로드 시 실행
loadBadmintonData();
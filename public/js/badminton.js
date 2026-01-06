// 배드민턴 데이터 로드 및 표시
async function loadBadmintonData() {
    console.log('🏸 [배드민턴] 데이터 로딩 시작...');
    
    try {
        const response = await fetch('./public/data/ahn-seyoung-matches.json');
        const data = await response.json();
        
        console.log('🏸 [배드민턴] 데이터:', data);
        
        // 포인트 표시
        if (data.currentRanking) {
            document.getElementById('badminton-points').innerHTML = `
                <div class="stat-item">
                    <div class="stat-label">현재 랭킹</div>
                    <div class="stat-value">#${data.currentRanking}</div>
                </div>
            `;
        }
        
        // 최근 경기 표시
        if (data.recentMatch) {
            const match = data.recentMatch;
            const resultClass = match.result === '승' ? 'win' : 'loss';
            
            document.getElementById('badminton-recent-match').innerHTML = `
                <div class="recent-match-label">최근 경기</div>
                <div class="recent-match-info">
                    <div class="match-tournament">${match.tournament}</div>
                    <div class="match-opponent">vs ${match.opponent}</div>
                    <div class="match-result ${resultClass}">${match.result}</div>
                </div>
            `;
            
            console.log('🏸 [배드민턴] 최근 경기 표시 완료');
        } else {
            document.getElementById('badminton-recent-match').innerHTML = `
                <div class="recent-match-label">최근 경기</div>
                <div class="recent-match-info">
                    <div class="no-data">최근 경기 정보 없음</div>
                </div>
            `;
        }
        
        // 다음 경기 표시
        if (data.nextMatch) {
            const match = data.nextMatch;
            
            // D-day 계산
            const matchDate = new Date(match.startDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            matchDate.setHours(0, 0, 0, 0);
            
            const daysUntil = Math.ceil((matchDate - today) / (1000 * 60 * 60 * 24));
            
            let dDayText;
            if (daysUntil === 0) {
                dDayText = 'D-day';  // ✅ D-0 대신 D-day 사용
            } else if (daysUntil > 0) {
                dDayText = `D-${daysUntil}`;
            } else {
                dDayText = `D+${Math.abs(daysUntil)}`;
            }
            
            document.getElementById('badminton-next-match').innerHTML = `
                <div class="next-match-label">다음 경기</div>
                <div class="next-match-info">
                    <div class="match-tournament">${match.tournament}</div>
                    <div class="match-date">${match.startDate} ~ ${match.endDate || match.startDate}</div>
                    <div class="match-location">${match.location}</div>
                    <div class="d-day ${daysUntil === 0 ? 'today' : ''}">${dDayText}</div>
                </div>
            `;
            
            console.log('🏸 [배드민턴] 다음 경기 표시 완료:', dDayText);
        } else {
            document.getElementById('badminton-next-match').innerHTML = `
                <div class="next-match-label">다음 경기</div>
                <div class="next-match-info">
                    <div class="no-match">예정된 경기 없음</div>
                </div>
            `;
        }
        
        console.log('🏸 [배드민턴] 데이터 로딩 완료!');
    } catch (error) {
        console.error('❌ [배드민턴] 데이터 로딩 실패:', error);
        
        document.getElementById('badminton-recent-match').innerHTML = `
            <div class="recent-match-label">최근 경기</div>
            <div class="recent-match-info">
                <div class="no-data">데이터를 불러올 수 없습니다</div>
            </div>
        `;
        
        document.getElementById('badminton-next-match').innerHTML = `
            <div class="next-match-label">다음 경기</div>
            <div class="next-match-info">
                <div class="no-match">데이터를 불러올 수 없습니다</div>
            </div>
        `;
    }
}

// 페이지 로드 시 실행
loadBadmintonData();
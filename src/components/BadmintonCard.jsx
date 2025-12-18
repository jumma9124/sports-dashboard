import React, { useState, useEffect } from 'react';
import './BadmintonCard.css';

function BadmintonCard() {
  const [rankingData, setRankingData] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
    // 5분마다 자동 갱신
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 랭킹 데이터 가져오기
      const rankingResponse = await fetch('/sports-dashboard/data/badminton-rankings.json');
      const rankingJson = await rankingResponse.json();
      setRankingData(rankingJson);

      // 경기 데이터 가져오기
      const matchResponse = await fetch('/sports-dashboard/data/ahn-seyoung-matches.json');
      const matchJson = await matchResponse.json();
      setMatchData(matchJson);

      setError(null);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
      setError('데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !rankingData) {
    return (
      <div className="sport-card badminton-card">
        <div className="card-header">
          <h2>🏸 안세영 배드민턴</h2>
        </div>
        <div className="card-body loading">
          <p>데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sport-card badminton-card">
        <div className="card-header">
          <h2>🏸 안세영 배드민턴</h2>
        </div>
        <div className="card-body error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const { ahnSeYoung } = rankingData || {};
  const { recentResults, upcomingMatches } = matchData || {};
  const lastUpdated = new Date(rankingData?.lastUpdated || Date.now());

  return (
    <div className="sport-card badminton-card">
      <div className="card-header">
        <h2>🏸 안세영 배드민턴</h2>
        <span className="last-updated">
          {lastUpdated.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>

      <div className="card-body">
        {/* 세계 랭킹 */}
        <div className="ranking-section">
          <h3>세계 랭킹</h3>
          <div className="ranking-badge">
            <span className="rank-number">{ahnSeYoung?.rank || 1}</span>
            <span className="rank-label">위</span>
          </div>
          {ahnSeYoung?.points > 0 && (
            <div className="ranking-points">
              {ahnSeYoung.points.toLocaleString()} 포인트
            </div>
          )}
        </div>

        {/* 다음 경기 */}
        {upcomingMatches && upcomingMatches.length > 0 && (
          <div className="next-match-section">
            <h3>다음 경기</h3>
            <div className="next-match">
              <div className="match-tournament">
                {upcomingMatches[0].tournament}
              </div>
              <div className="match-details">
                <span className="match-date">{upcomingMatches[0].date}</span>
                {upcomingMatches[0].round && (
                  <span className="match-round"> · {upcomingMatches[0].round}</span>
                )}
              </div>
              {upcomingMatches[0].opponent && (
                <div className="match-opponent">
                  vs {upcomingMatches[0].opponent}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 최근 경기 결과 */}
        {recentResults && recentResults.length > 0 && (
          <div className="recent-results-section">
            <h3>최근 경기</h3>
            <div className="results-list">
              {recentResults.slice(0, 3).map((match, index) => (
                <div key={index} className={`result-item ${match.result === '승' ? 'win' : 'loss'}`}>
                  <div className="result-header">
                    <span className={`result-badge ${match.result === '승' ? 'win' : 'loss'}`}>
                      {match.result}
                    </span>
                    <span className="result-date">{match.date}</span>
                  </div>
                  <div className="result-tournament">{match.tournament}</div>
                  {match.opponent && (
                    <div className="result-opponent">vs {match.opponent}</div>
                  )}
                  {match.score && (
                    <div className="result-score">{match.score}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 경기 정보가 없을 때 */}
        {(!recentResults || recentResults.length === 0) && 
         (!upcomingMatches || upcomingMatches.length === 0) && (
          <div className="no-matches">
            <p>최근 경기 정보가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BadmintonCard;

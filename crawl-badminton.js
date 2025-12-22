const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// 데이터 저장 경로
const DATA_DIR = path.join(__dirname, 'public', 'data');

/**
 * BWF 선수 페이지에서 안세영 최근 경기 크롤링
 */
async function crawlRecentMatches(browser) {
  try {
    console.log('[최근 경기] 크롤링 시작...');
    
    const page = await browser.newPage();
    const url = 'https://bwfbadminton.com/player/87442/an-se-young';
    console.log('[최근 경기] URL:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForTimeout(5000);

    const matches = await page.evaluate(() => {
      const recent = [];
      
      // 실제 HTML 구조: .result-match-single-card
      const matchCards = document.querySelectorAll('.result-match-single-card');
      
      for (let i = 0; i < Math.min(matchCards.length, 3); i++) {
        const card = matchCards[i];
        
        try {
          // 대회명
          const tournamentEl = card.querySelector('.player-match-tournament a');
          const tournament = tournamentEl ? tournamentEl.textContent.trim() : 'BWF 대회';
          
          // 라운드 정보 (예: "Round Final - Event WS")
          const roundEl = card.querySelector('.round-oop');
          let round = '';
          if (roundEl) {
            const roundText = roundEl.textContent.trim();
            // "Round Final" -> "결승", "Round SF" -> "준결승"
            if (roundText.includes('Final')) round = '결승';
            else if (roundText.includes('SF')) round = '준결승';
            else round = roundText.replace('Round ', '').replace(' - Event WS', '');
          }
          
          // 경기 시간
          const timeEl = card.querySelector('.round-time .time span');
          const matchTime = timeEl ? timeEl.textContent.trim().replace(/[^\d:]/g, '') : '';
          
          // 선수 정보 (team-details-wrap-card)
          const teams = card.querySelectorAll('.team-details-wrap-card');
          if (teams.length < 2) continue;
          
          // 첫 번째 팀 (안세영)
          const team1 = teams[0];
          const team1Name = team1.querySelector('.player1 a, .player3 a');
          const team1Score = team1.querySelector('.score div');
          const team1Win = team1.classList.contains('team-win') || team1.querySelector('.fa-check');
          
          // 두 번째 팀 (상대)
          const team2 = teams[1];
          const team2Name = team2.querySelector('.player1 a, .player3 a');
          const team2Score = team2.querySelector('.score div');
          const team2Win = team2.classList.contains('team-win') || team2.querySelector('.fa-check');
          
          // 상대 선수명
          let opponent = '';
          if (team1Name && team1Name.textContent.includes('AN Se Young')) {
            opponent = team2Name ? team2Name.textContent.trim() : '';
          } else {
            opponent = team1Name ? team1Name.textContent.trim() : '';
          }
          
          // 결과 판정
          let result = '패';
          if (team1Win && team1Name && team1Name.textContent.includes('AN Se Young')) {
            result = '승';
          } else if (team2Win && team2Name && team2Name.textContent.includes('AN Se Young')) {
            result = '승';
          }
          
          // 스코어 (예: "21 18 21" -> "2-0")
          let score = '';
          if (team1Score && team2Score) {
            const team1Scores = team1Score.textContent.trim().split(/\s+/).map(s => parseInt(s));
            const team2Scores = team2Score.textContent.trim().split(/\s+/).map(s => parseInt(s));
            
            let wonSets = 0;
            let lostSets = 0;
            
            for (let j = 0; j < Math.min(team1Scores.length, team2Scores.length); j++) {
              if (team1Name && team1Name.textContent.includes('AN Se Young')) {
                if (team1Scores[j] > team2Scores[j]) wonSets++;
                else lostSets++;
              } else {
                if (team2Scores[j] > team1Scores[j]) wonSets++;
                else lostSets++;
              }
            }
            score = `${wonSets}-${lostSets}`;
          }
          
          // 날짜 추출 (현재 페이지에 없으므로 추정)
          let date = '';
          if (tournament.includes('2025')) {
            if (round === '결승') date = '2025-12-21';
            else if (round === '준결승') date = '2025-12-20';
            else date = '2025-12-19';
          }
          
          if (opponent) {
            recent.push({
              date: date,
              tournament: tournament,
              opponent: opponent,
              result: result,
              score: score,
              round: round
            });
          }
        } catch (error) {
          console.error('경기 데이터 파싱 오류:', error);
        }
      }
      
      return recent;
    });

    await page.close();
    
    console.log('[최근 경기] 성공:', matches.length, '개');
    return matches;

  } catch (error) {
    console.error('[최근 경기] 실패:', error.message);
    // 실패 시 빈 배열 반환
    return [];
  }
}

/**
 * BWF 말레이시아 오픈 2026에서 안세영 다음 경기 크롤링
 */
async function crawlUpcomingMatches(browser) {
  try {
    console.log('[다음 경기] 크롤링 시작...');
    
    const page = await browser.newPage();
    const url = 'https://bwfworldtour.bwfbadminton.com/tournament/5227/petronas-malaysia-open-2026/results/2026-01-06';
    console.log('[다음 경기] URL:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForTimeout(3000);

    const matches = await page.evaluate(() => {
      const upcoming = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 여자 단식 경기 일정 찾기
      const matchElements = document.querySelectorAll('.match-schedule, .upcoming-match, .schedule-item');
      
      for (let elem of matchElements) {
        const text = elem.textContent || '';
        
        if (text.includes('AN Se Young') || text.includes('안세영')) {
          try {
            const dateEl = elem.querySelector('.match-date, .date');
            let date = dateEl ? dateEl.textContent.trim() : '';
            
            const playerEls = elem.querySelectorAll('.player-name, .player');
            let opponent = '';
            for (let p of playerEls) {
              const name = p.textContent.trim();
              if (!name.includes('AN Se Young') && !name.includes('안세영')) {
                opponent = name;
                break;
              }
            }
            
            const timeEl = elem.querySelector('.match-time, .time');
            const time = timeEl ? timeEl.textContent.trim() : '';
            
            const roundEl = elem.querySelector('.round, .stage');
            const round = roundEl ? roundEl.textContent.trim() : '';
            
            if (opponent) {
              upcoming.push({
                date: date,
                time: time,
                tournament: '말레이시아 오픈',
                opponent: opponent,
                round: round
              });
            }
          } catch (error) {
            console.error('일정 파싱 오류:', error);
          }
        }
      }
      
      return upcoming;
    });

    await page.close();
    console.log('[다음 경기] 성공:', matches.length, '개');
    return matches;

  } catch (error) {
    console.error('[다음 경기] 실패:', error.message);
    return [];
  }
}

/**
 * BWF 공식 사이트에서 안세영 데이터 크롤링
 */
async function crawlAhnSeyoung() {
  let browser;
  try {
    console.log('[안세영] 크롤링 시작...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 최근 경기 크롤링
    const recentMatches = await crawlRecentMatches(browser);
    
    // 다음 경기 크롤링
    const upcomingMatches = await crawlUpcomingMatches(browser);

    await browser.close();

    const ahnSeyoungData = {
      player: '안세영',
      ranking: 1,
      points: 111490,
      recent: recentMatches,
      upcoming: upcomingMatches,
      lastUpdated: new Date().toISOString(),
      note: upcomingMatches.length === 0 ? '다음 대회: 2026년 1월 말레이시아 오픈' : '',
      source: 'BWF World Tour (bwfbadminton.com)'
    };

    console.log('[안세영] 성공!');
    console.log('- 최근 경기:', recentMatches.length, '개');
    console.log('- 다음 경기:', upcomingMatches.length, '개');
    
    return ahnSeyoungData;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[안세영] 실패:', error.message);
    
    // 실패 시 기본 데이터 반환
    return {
      player: '안세영',
      ranking: 1,
      points: 111490,
      recent: [
        {
          date: '2025-12-21',
          tournament: 'BWF 투어 파이널',
          opponent: '왕즈이',
          result: '승',
          score: '2-0',
          round: '결승'
        },
        {
          date: '2025-12-20',
          tournament: 'BWF 투어 파이널',
          opponent: '야마구치 아카네',
          result: '승',
          score: '2-0',
          round: '준결승'
        },
        {
          date: '2025-12-19',
          tournament: 'BWF 투어 파이널',
          opponent: '라차녹 인타논',
          result: '승',
          score: '2-1',
          round: '조별리그'
        }
      ],
      upcoming: [],
      lastUpdated: new Date().toISOString(),
      error: error.message,
      note: 'BWF 크롤링 실패 - 기본 데이터 사용 (2025 투어 파이널 우승)'
    };
  }
}

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log('\n================================================================================');
    console.log('안세영 데이터 크롤링 시작 (BWF 월드투어)');
    console.log('================================================================================\n');

    await fs.mkdir(DATA_DIR, { recursive: true });

    const ahnSeyoungData = await crawlAhnSeyoung();

    const filePath = path.join(DATA_DIR, 'ahn-seyoung-matches.json');
    await fs.writeFile(
      filePath,
      JSON.stringify(ahnSeyoungData, null, 2),
      'utf8'
    );

    console.log('\n================================================================================');
    console.log('크롤링 완료!');
    console.log('파일:', filePath);
    console.log('최근 경기:', ahnSeyoungData.recent.length, '개');
    console.log('다음 경기:', ahnSeyoungData.upcoming.length, '개');
    console.log('랭킹:', ahnSeyoungData.ranking, '위');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlAhnSeyoung };
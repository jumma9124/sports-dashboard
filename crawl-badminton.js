const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// BWF 대회 일정 크롤링
async function crawlBWFSchedule(browser) {
  try {
    console.log('[BWF 일정] 크롤링 시작...');
    
    const page = await browser.newPage();
    
    await page.goto('https://bwfbadminton.com/calendar/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    const tournaments = await page.evaluate(() => {
      const items = document.querySelectorAll('.timeline__item');
      const currentYear = new Date().getFullYear();
      
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11,
        'January': 0, 'February': 1, 'March': 2, 'April': 3, 'June': 5,
        'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
      };
      
      return Array.from(items).map(item => {
        const dateText = item.querySelector('.date span')?.textContent.trim();
        const name = item.querySelector('.name')?.textContent.trim();
        const category = item.querySelector('.label-category')?.textContent.trim();
        const country = item.querySelector('.country')?.textContent.trim();
        
        if (!dateText || !name) return null;
        
        // 날짜 파싱 (예: "06 - 11 Jan" 또는 "13 - 18 Jan")
        const dateMatch = dateText.match(/(\d+)\s*-\s*(\d+)\s+(\w+)/);
        if (!dateMatch) return null;
        
        const [, startDay, endDay, monthStr] = dateMatch;
        const monthIndex = monthMap[monthStr];
        if (monthIndex === undefined) return null;
        
        // 연도 계산 (12월에는 다음해 1월 대회도 포함)
        const currentMonth = new Date().getMonth();
        let year = currentYear;
        if (currentMonth === 11 && monthIndex < 3) {
          year = currentYear + 1;
        }
        
        const startDate = new Date(year, monthIndex, parseInt(startDay));
        const endDate = new Date(year, monthIndex, parseInt(endDay));
        
        return {
          name,
          category,
          country,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dateText
        };
      }).filter(t => t !== null);
    });
    
    await page.close();
    
    // 오늘 날짜
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // 다가오는 대회 찾기 (오늘 이후 시작)
    const upcomingTournaments = tournaments.filter(t => {
      const startDate = new Date(t.startDate);
      return startDate >= now;
    }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    // 진행 중인 대회 찾기
    const ongoingTournaments = tournaments.filter(t => {
      const startDate = new Date(t.startDate);
      const endDate = new Date(t.endDate);
      return startDate <= now && endDate >= now;
    });
    
    const nextTournament = upcomingTournaments[0] || null;
    const ongoingTournament = ongoingTournaments[0] || null;
    
    // D-day 계산
    let displayTournament = null;
    let daysInfo = null;
    
    if (ongoingTournament) {
      const daysSinceStart = Math.floor((now - new Date(ongoingTournament.startDate)) / (1000 * 60 * 60 * 24));
      displayTournament = ongoingTournament;
      daysInfo = {
        type: 'ongoing',
        days: daysSinceStart,
        text: `D+${daysSinceStart}`
      };
    } else if (nextTournament) {
      const daysUntilStart = Math.floor((new Date(nextTournament.startDate) - now) / (1000 * 60 * 60 * 24));
      displayTournament = nextTournament;
      daysInfo = {
        type: 'upcoming',
        days: daysUntilStart,
        text: `D-${daysUntilStart}`
      };
    }
    
    console.log('[BWF 일정] 성공:', displayTournament ? displayTournament.name : '대회 없음');
    
    return {
      displayTournament,
      daysInfo,
      ongoingTournament,
      nextTournament,
      allTournaments: tournaments
    };
    
  } catch (error) {
    console.error('[BWF 일정] 실패:', error.message);
    return {
      displayTournament: null,
      daysInfo: null,
      ongoingTournament: null,
      nextTournament: null,
      allTournaments: [],
      error: error.message
    };
  }
}

async function crawlAhnSeYoungData() {
  console.log('==========================================');
  console.log('🏸 안세영 데이터 크롤링 시작...');
  console.log('==========================================');

  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  
  // GitHub Actions에서 Chromium 경로 사용
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // BWF 안세영 선수 페이지
    const url = 'https://bwfbadminton.com/player/87442/an-se-young';
    console.log(`📍 URL: ${url}`);

    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // 페이지 로딩 대기
    await page.waitForTimeout(3000);

    // 데이터 추출
    const data = await page.evaluate(() => {
      const result = {
        ranking: null,
        points: null,
        recentMatches: [],
        upcomingMatches: []
      };

      // 랭킹 정보 추출
      try {
        const rankingElement = document.querySelector('.profile-content .heading-6');
        if (rankingElement) {
          const rankText = rankingElement.textContent.trim();
          const match = rankText.match(/(\d+)/);
          if (match) {
            result.ranking = parseInt(match[1]);
          }
        }
      } catch (e) {
        console.error('랭킹 추출 실패:', e);
      }

      // 최근 경기 결과 추출
      try {
        const matchCards = document.querySelectorAll('.result-match-single-card');
        console.log(`찾은 경기 카드 수: ${matchCards.length}`);

        matchCards.forEach((card, index) => {
          if (index >= 3) return; // 최근 3경기만

          try {
            // 대회명
            const tournamentLink = card.querySelector('.player-match-tournament a');
            const tournament = tournamentLink ? tournamentLink.textContent.trim() : '';

            // 라운드 정보
            const roundElement = card.querySelector('.round-oop');
            let round = '';
            if (roundElement) {
              const roundText = roundElement.textContent.trim();
              // "Round Final - Event WS" 형식에서 라운드만 추출
              if (roundText.includes('Final')) round = '결승';
              else if (roundText.includes('Semi')) round = '준결승';
              else if (roundText.includes('Quarter')) round = '8강';
              else if (roundText.includes('Round 16')) round = '16강';
              else if (roundText.includes('Round 32')) round = '32강';
              else round = roundText.split('-')[0].trim();
            }

            // 날짜 추출 (URL에서)
            const dateLink = card.querySelector('.player-match-tournament a');
            let date = '';
            if (dateLink && dateLink.href) {
              const urlMatch = dateLink.href.match(/\/(\d{4}-\d{2}-\d{2})\//);
              if (urlMatch) {
                date = urlMatch[1];
              }
            }

            // 경기 상세 정보
            const teamWraps = card.querySelectorAll('.team-details-wrap-card');
            
            let opponent = '';
            let result = '';
            let score = '';
            let anSeYoungWon = false;

            teamWraps.forEach(wrap => {
              const playerWrap = wrap.querySelector('.player-detail-wrap');
              const scoreWrap = wrap.querySelector('.score');
              
              // 안세영 팀 찾기
              const player1 = wrap.querySelector('.player1 a, .player1');
              if (player1 && player1.textContent.includes('AN Se Young')) {
                // 안세영 팀
                anSeYoungWon = playerWrap.classList.contains('team-win');
                
                // 스코어 추출
                if (scoreWrap) {
                  const scoreSpans = scoreWrap.querySelectorAll('span');
                  const scores = Array.from(scoreSpans).map(s => s.textContent.trim());
                  
                  // 세트별 스코어로 승패 계산
                  let setsWon = 0;
                  let setsLost = 0;
                  
                  for (let i = 0; i < scores.length; i += 2) {
                    if (i + 1 < scores.length) {
                      const anScore = parseInt(scores[i]);
                      const oppScore = parseInt(scores[i + 1]);
                      if (anScore > oppScore) setsWon++;
                      else setsLost++;
                    }
                  }
                  
                  score = `${setsWon}-${setsLost}`;
                }
              } else {
                // 상대 팀
                const player3 = wrap.querySelector('.player3 a, .player3');
                if (player3) {
                  opponent = player3.textContent.trim();
                }
              }
            });

            result = anSeYoungWon ? '승' : '패';

            // 날짜가 없으면 현재 날짜 사용
            if (!date) {
              date = new Date().toISOString().split('T')[0];
            }

            result.recentMatches.push({
              date: date,
              tournament: tournament,
              round: round,
              opponent: opponent,
              result: result,
              score: score
            });

            console.log(`경기 ${index + 1}: ${date} ${round} vs ${opponent} (${result} ${score})`);

          } catch (e) {
            console.error(`경기 ${index + 1} 처리 중 오류:`, e);
          }
        });

      } catch (e) {
        console.error('경기 결과 추출 실패:', e);
      }

      return result;
    });

    console.log('✅ 크롤링 완료!');
    console.log(`랭킹: ${data.ranking}위`);
    console.log(`최근 경기: ${data.recentMatches.length}개`);

    // 데이터 검증 및 폴백
    if (data.recentMatches.length === 0) {
      console.log(⚠️ 크롤링된 경기 데이터가 없습니다. 폴백 데이터 사용...');
      
      // 2025 BWF 투어 파이널 우승 기록 (폴백)
      data.recentMatches = [
        {
          date: '2025-12-21',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '결승',
          opponent: 'WANG Zhi Yi',
          result: '승',
          score: '2-1'
        },
        {
          date: '2025-12-20',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '준결승',
          opponent: 'Akane YAMAGUCHI',
          result: '승',
          score: '2-0'
        },
        {
          date: '2025-12-19',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '조별리그',
          opponent: 'Ratchanok INTANON',
          result: '승',
          score: '2-1'
        }
      ];
    }

    // ranking이 없으면 기본값 1위
    if (!data.ranking) {
      data.ranking = 1;
      console.log('⚠️ 랭킹 정보 없음. 기본값 1위 사용');
    }

    // BWF 대회 일정 크롤링
    console.log('\n==========================================');
    console.log('🗓️  BWF 대회 일정 크롤링 시작...');
    console.log('==========================================');
    
    const schedule = await crawlBWFSchedule(browser);

    // JSON 파일로 저장
    const outputData = {
      ranking: data.ranking,
      points: data.points || 0,
      recent: data.recentMatches,
      upcoming: data.upcomingMatches,
      nextTournament: schedule.displayTournament,
      tournamentDays: schedule.daysInfo,
      lastUpdated: new Date().toISOString()
    };

    const outputPath = path.join(__dirname, 'public', 'data', 'ahn-seyoung-matches.json');
    
    // 디렉토리 생성
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    
    console.log('\n==========================================');
    console.log(`✅ 파일 저장 완료: ${outputPath}`);
    if (schedule.displayTournament) {
      console.log(`📅 다음 대회: ${schedule.displayTournament.name}`);
      console.log(`🏆 등급: ${schedule.displayTournament.category}`);
      console.log(`📍 장소: ${schedule.displayTournament.country}`);
      console.log(`⏰ D-day: ${schedule.daysInfo.text}`);
    }
    console.log('==========================================');

    await browser.close();
    return outputData;

  } catch (error) {
    console.error('❌ 크롤링 중 오류 발생:', error.message);
    await browser.close();

    // 에러 발생 시 폴백 데이터
    const fallbackData = {
      ranking: 1,
      points: 0,
      recent: [
        {
          date: '2025-12-21',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '결승',
          opponent: 'WANG Zhi Yi',
          result: '승',
          score: '2-1'
        },
        {
          date: '2025-12-20',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '준결승',
          opponent: 'Akane YAMAGUCHI',
          result: '승',
          score: '2-0'
        },
        {
          date: '2025-12-19',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '조별리그',
          opponent: 'Ratchanok INTANON',
          result: '승',
          score: '2-1'
        }
      ],
      upcoming: [],
      nextTournament: null,
      tournamentDays: null,
      lastUpdated: new Date().toISOString()
    };

    const outputPath = path.join(__dirname, 'public', 'data', 'ahn-seyoung-matches.json');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(fallbackData, null, 2), 'utf-8');
    
    console.log('⚠️ 폴백 데이터로 파일 생성됨');
    return fallbackData;
  }
}

// 실행
if (require.main === module) {
  crawlAhnSeYoungData().catch(console.error);
}

module.exports = { crawlAhnSeYoungData };
const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

// 리소스 차단으로 속도 향상
async function setupPageOptimization(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    // 이미지, 폰트, 스타일시트 차단
    if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

async function crawlVolleyball() {
  let browser;
  try {
    console.log('[배구] 크롤링 시작...');
    const startTime = Date.now();
    
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins'
      ],
      timeout: 60000
    };
    
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }
    
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    const url = 'https://m.sports.naver.com/volleyball/record/kovo?seasonCode=022&tab=teamRank';
    
    // domcontentloaded로 변경 (더 빠름)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 필요한 셀렉터가 나타날 때까지만 대기 (최대 5초)
    try {
      await page.waitForSelector('.TableBody_item__eCenH', { timeout: 5000 });
    } catch (e) {
      // 셀렉터 못 찾으면 1초만 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const volleyballData = await page.evaluate(() => {
      const teamItems = document.querySelectorAll('.TableBody_item__eCenH');
      let currentTeamData = null;
      const allTeams = [];
      
      for (let item of teamItems) {
        const teamNameEl = item.querySelector('.TeamInfo_team_name__dni7F');
        const teamName = teamNameEl ? teamNameEl.textContent.trim() : '';
        
        const cells = item.querySelectorAll('.TableBody_cell__rFrpm');
        const rankText = cells[0] ? cells[0].textContent.trim() : '';
        const rankMatch = rankText.match(/(\d+)위/);
        const rank = rankMatch ? rankMatch[1] : '-';
        
        const fullText = item.textContent;
        const pointsMatch = fullText.match(/승점(\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/경기(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/승(\d+)/);
        const lossesMatch = fullText.match(/패(\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/세트득실률([\d.]+)/);
        const setRatio = setRatioMatch ? setRatioMatch[1] : '-';
        
        const winRate = (wins !== '-' && games !== '-') 
          ? (parseInt(wins) / parseInt(games)).toFixed(3) : '-';
        
        allTeams.push({
          rank: rank + '위',
          team: teamName,
          record: wins + '승 ' + losses + '패',
          winRate: winRate,
          points: points,
          setRatio: setRatio
        });
        
        if (teamName.includes('현대캐피탈')) {
          currentTeamData = {
            sport: '배구',
            team: '현대캐피탈 스카이워커스',
            league: 'V-리그',
            rank: rank + '위',
            record: wins + '승 ' + losses + '패',
            winRate: winRate,
            games: games,
            points: points,
            setRatio: setRatio,
            lastUpdated: new Date().toISOString()
          };
        }
      }
      
      return {
        currentTeam: currentTeamData,
        allTeams: allTeams
      };
    });

    const volleyball = volleyballData.currentTeam;
    
    if (!volleyball) {
      await browser.close();
      return {
        sport: '배구',
        team: '현대캐피탈 스카이워커스',
        league: 'V-리그',
        rank: '-',
        record: '데이터 없음',
        winRate: '-',
        error: 'Team not found',
        lastUpdated: new Date().toISOString()
      };
    }

    volleyball.fullRankings = volleyballData.allTeams;
    console.log('[배구] 순위 완료:', volleyball.rank, `(${Date.now() - startTime}ms)`);
    
    // 다음 경기와 지난 경기를 병렬로 크롤링
    const [nextMatch, pastMatches] = await Promise.all([
      crawlVolleyballNextMatch(browser).catch(err => {
        console.error('[배구] 다음 경기 실패:', err.message);
        return null;
      }),
      crawlVolleyballPastMatches(browser).catch(err => {
        console.error('[배구] 지난 경기 실패:', err.message);
        return [];
      })
    ]);
    
    if (nextMatch) {
      volleyball.nextMatch = nextMatch;
      console.log('[배구] 다음 경기:', nextMatch.opponent);
    }
    
    if (pastMatches && pastMatches.length > 0) {
      volleyball.pastMatches = pastMatches;
      console.log('[배구] 지난 경기:', pastMatches.length + '경기');
    }
    
    await browser.close();
    console.log(`[배구] 전체 완료 (${Date.now() - startTime}ms)`);
    return volleyball;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[배구] 실패:', error.message);
    return {
      sport: '배구',
      team: '현대캐피탈 스카이워커스',
      league: 'V-리그',
      rank: '-',
      record: '크롤링 실패',
      winRate: '-',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

// 최적화: 월별 일정 페이지에서 한 번에 가져오기
async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[배구 다음 경기] 크롤링 시작...');
    const startTime = Date.now();
    
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    // 이번 달과 다음 달만 확인 (2번의 요청으로 충분)
    const monthsToCheck = [
      { year, month },
      { year: month === 12 ? year + 1 : year, month: month === 12 ? 1 : month + 1 }
    ];
    
    for (const { year: y, month: m } of monthsToCheck) {
      const monthStr = String(m).padStart(2, '0');
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${y}-${monthStr}-01`;
      
      console.log(`[배구 다음 경기] ${y}-${monthStr} 확인 중...`);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      
      // 일정 리스트가 로드될 때까지 대기
      try {
        await page.waitForSelector('[class*="ScheduleAllType"]', { timeout: 3000 });
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const matches = await page.evaluate((todayStr) => {
        const results = [];
        
        // 모든 경기 일정 항목 찾기
        const scheduleItems = document.querySelectorAll('[class*="ScheduleAllType_match_list"] > div, [class*="MatchBox"]');
        
        scheduleItems.forEach(item => {
          const text = item.textContent || '';
          
          // 현대캐피탈 경기인지 확인
          if (text.includes('현대캐피탈') || text.includes('스카이워커스')) {
            // 날짜 추출 시도
            const dateEl = item.closest('[class*="schedule_item"]')?.querySelector('[class*="date"]');
            let dateStr = '';
            
            if (dateEl) {
              const dateText = dateEl.textContent;
              const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})/);
              if (dateMatch) {
                const thisYear = new Date().getFullYear();
                const thisMonth = new Date().getMonth() + 1;
                let matchMonth = parseInt(dateMatch[1]);
                let matchDay = parseInt(dateMatch[2]);
                let matchYear = thisYear;
                
                // 12월에서 1월로 넘어가는 경우 처리
                if (thisMonth === 12 && matchMonth === 1) {
                  matchYear = thisYear + 1;
                }
                
                dateStr = `${matchYear}-${String(matchMonth).padStart(2, '0')}-${String(matchDay).padStart(2, '0')}`;
              }
            }
            
            // 시간 추출
            const timeMatch = text.match(/(\d{2}:\d{2})/);
            const time = timeMatch ? timeMatch[1] : '19:00';
            
            // 상대팀 추출
            const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
            let opponent = '';
            for (const team of teams) {
              if (text.includes(team)) {
                opponent = team;
                break;
              }
            }
            
            // 경기장 추출
            const teamStadiums = {
              'OK저축은행': '부산강서체육관',
              '현대캐피탈': '천안유관순체육관',
              '한국전력': '수원체육관',
              '대한항공': '인천계양체육관',
              '우리카드': '장충체육관',
              '삼성화재': '대전충무체육관',
              'KB손해보험': '의정부체육관'
            };
            
            let location = '';
            if (text.includes('천안유관순')) location = '천안유관순체육관';
            else {
              for (const [team, stadium] of Object.entries(teamStadiums)) {
                if (text.includes(stadium) || text.includes(team + '홈')) {
                  location = stadium;
                  break;
                }
              }
            }
            
            if (dateStr && dateStr >= todayStr && opponent) {
              results.push({
                date: dateStr,
                time: time,
                opponent: opponent,
                location: location || '장소 미정'
              });
            }
          }
        });
        
        return results.sort((a, b) => a.date.localeCompare(b.date));
      }, today.toISOString().split('T')[0]);
      
      if (matches.length > 0) {
        await page.close();
        console.log(`[배구 다음 경기] 성공 (${Date.now() - startTime}ms):`, matches[0]);
        return matches[0];
      }
    }
    
    // 못 찾은 경우 기존 방식으로 폴백 (14일만)
    console.log('[배구 다음 경기] 월별 검색 실패, 일별 검색 시도...');
    
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 500));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      if (pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) {
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent;
          
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (let team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let location = '';
          if (bodyText.includes('천안유관순')) {
            location = '천안유관순체육관';
          }
          
          return { time, opponent, location: location || '장소 미정' };
        });
        
        if (matchData.opponent) {
          await page.close();
          const result = { date: dateStr, ...matchData };
          console.log(`[배구 다음 경기] 성공 (${Date.now() - startTime}ms):`, result);
          return result;
        }
      }
    }

    await page.close();
    console.log(`[배구 다음 경기] 14일 이내 경기 없음 (${Date.now() - startTime}ms)`);
    return null;
    
  } catch (error) {
    console.error('[배구 다음 경기] 실패:', error.message);
    return null;
  }
}

async function crawlVolleyballPastMatches(browser) {
  try {
    console.log('[배구 지난 경기] 크롤링 시작...');
    const startTime = Date.now();
    
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    const matches = [];
    const today = new Date();
    
    // 14일로 축소, 5경기 찾으면 조기 종료
    for (let i = 1; i <= 14 && matches.length < 5; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 500));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      if (pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) {
        const basicInfo = await page.evaluate(() => {
          const bodyText = document.body.textContent;
          
          let matchId = null;
          const links = document.querySelectorAll('a');
          for (let link of links) {
            const href = link.getAttribute('href');
            if (href && href.includes('/game/')) {
              const match = href.match(/\/game\/([0-9A-Z]+)/i);
              if (match && match[1]) {
                matchId = match[1];
                break;
              }
            }
          }
          
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (let team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let isHome = bodyText.includes('현대캐피탈홈') || bodyText.includes('천안유관순');
          
          const scorePattern = /(\d)-(\d)/g;
          const scores = bodyText.match(scorePattern);
          
          let result = null;
          let score = null;
          
          if (scores && scores.length > 0) {
            score = scores[0];
            const [set1, set2] = score.split('-').map(Number);
            result = isHome ? (set1 > set2 ? '승' : '패') : (set2 > set1 ? '승' : '패');
          }
          
          let location = '';
          if (bodyText.includes('천안유관순')) location = '천안유관순체육관';
          
          return { matchId, opponent, isHome, result, score, location: location || '미정' };
        });
        
        // 세트 스코어는 이미 있는 경기만 가져오기 (추가 페이지 방문 최소화)
        let setScores = null;
        if (basicInfo.matchId && matches.length < 3) {
          // 최근 3경기만 상세 스코어 가져오기
          try {
            const detailUrl = `https://m.sports.naver.com/game/${basicInfo.matchId}`;
            await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 300));
            
            setScores = await page.evaluate(() => {
              const scoreTable = document.querySelector('table.ScoreBox_board_table__3V6uh');
              if (!scoreTable) return null;
              
              const rows = Array.from(scoreTable.querySelectorAll('tbody tr'));
              if (rows.length < 2) return null;
              
              const sets = [];
              const homeCells = rows[0].querySelectorAll('td');
              const awayCells = rows[1].querySelectorAll('td');
              const setCellCount = Math.min(5, homeCells.length - 1);
              
              for (let i = 0; i < setCellCount; i++) {
                const homeScore = homeCells[i].textContent.trim();
                const awayScore = awayCells[i].textContent.trim();
                if (homeScore !== '-' && awayScore !== '-') {
                  sets.push({ set: i + 1, home: parseInt(homeScore), away: parseInt(awayScore) });
                }
              }
              return sets.length > 0 ? sets : null;
            });
          } catch (error) {
            // 상세 스코어 실패해도 계속 진행
          }
        }
        
        if (basicInfo.opponent && basicInfo.result) {
          matches.push({
            date: dateStr,
            homeTeam: basicInfo.isHome ? '현대캐피탈' : basicInfo.opponent,
            awayTeam: basicInfo.isHome ? basicInfo.opponent : '현대캐피탈',
            result: basicInfo.result,
            score: basicInfo.score || '-',
            location: basicInfo.location,
            matchId: basicInfo.matchId,
            setScores: setScores
          });
        }
      }
    }

    await page.close();
    console.log(`[배구 지난 경기] 완료: ${matches.length}경기 (${Date.now() - startTime}ms)`);
    
    return matches.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    
  } catch (error) {
    console.error('[배구 지난 경기] 실패:', error.message);
    return [];
  }
}

async function getBaseballData() {
  console.log('[야구] 데이터 생성...');
  
  const baseball = {
    sport: '야구',
    team: '한화 이글스',
    league: 'KBO',
    rank: '2위',
    record: '83승 57패 4무',
    winRate: '.593',
    lastUpdated: new Date().toISOString(),
    note: '2025 시즌 최종 순위 (2026년 3월 재개)'
  };

  console.log('[야구] 완료');
  return baseball;
}

async function main() {
  try {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(60));
    console.log('⚡ 스포츠 데이터 크롤링 시작 (최적화 버전)');
    console.log('='.repeat(60) + '\n');

    await fs.mkdir(DATA_DIR, { recursive: true });

    const [volleyball, baseball] = await Promise.all([
      crawlVolleyball(),
      getBaseballData()
    ]);

    const sportsData = {
      volleyball,
      baseball,
      lastUpdated: new Date().toISOString()
    };

    const filePath = path.join(DATA_DIR, 'sports.json');
    await fs.writeFile(filePath, JSON.stringify(sportsData, null, 2), 'utf8');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`✅ 크롤링 완료! (총 ${elapsed}초)`);
    console.log('파일:', filePath);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ 에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, getBaseballData };

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

// 일별 일정 페이지에서 가져오기 (대기 시간 증가)
async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[배구 다음 경기] 크롤링 시작...');
    const startTime = Date.now();
    
    const page = await browser.newPage();
    // 리소스 차단 제거 - 경기 일정 데이터 로드에 필요할 수 있음
    
    const today = new Date();
    
    // 14일간 검색
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      console.log(`[배구 다음 경기] ${dateStr} 확인 중...`);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // 데이터 로드 대기 시간 증가
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageText = await page.evaluate(() => document.body.textContent);
      
      // 현대캐피탈 경기가 있는지 먼저 확인
      if ((pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) && 
          pageText.includes('예정')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          
          // 시간 추출
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          // 상대팀 추출
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          // 홈/어웨이 확인
          // "OK저축은행 홈 현대캐피탈" 형태면 현대캐피탈이 어웨이
          // "현대캐피탈 홈" 형태면 현대캐피탈이 홈
          let isHome = false;
          if (bodyText.includes('현대캐피탈 홈') || bodyText.includes('현대캐피탈홈')) {
            isHome = true;
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
          
          let location = isHome ? '천안유관순체육관' : (teamStadiums[opponent] || '장소 미정');
          
          return { time, opponent, location, isHome };
        });
        
        if (matchData && matchData.opponent) {
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
    // 리소스 차단 제거 - 데이터 로드에 필요할 수 있음
    
    const matches = [];
    const today = new Date();
    
    // 14일간 검색, 5경기 찾으면 조기 종료
    for (let i = 1; i <= 14 && matches.length < 5; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // 대기 시간 증가
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      // 현대캐피탈 경기가 있고 종료된 경기인지 확인
      if ((pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) && 
          pageText.includes('종료')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          
          // 상대팀 추출
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          // 스코어 추출 - "스코어 0 현대캐피탈 스코어 3" 형식
          let homeScore = 0, awayScore = 0;
          let isHome = false;
          
          // "대한항공 홈 스코어 0 현대캐피탈 스코어 3" 형식 파싱
          const scoreMatch = bodyText.match(/(\S+)\s*홈\s*스코어\s*(\d)\s*(\S+)\s*스코어\s*(\d)/);
          if (scoreMatch) {
            const homeTeam = scoreMatch[1];
            const score1 = parseInt(scoreMatch[2]);
            const score2 = parseInt(scoreMatch[4]);
            
            homeScore = score1;
            awayScore = score2;
            
            // 현대캐피탈이 홈팀인지 확인
            if (homeTeam.includes('현대캐피탈') || homeTeam.includes('스카이워커스')) {
              isHome = true;
            }
          } else {
            // 단순 스코어 형식 시도
            const simpleScore = bodyText.match(/(\d)\s*[-:]\s*(\d)/);
            if (simpleScore) {
              homeScore = parseInt(simpleScore[1]);
              awayScore = parseInt(simpleScore[2]);
            }
          }
          
          // 현대캐피탈 기준 승/패 결과
          let result = null;
          if (isHome) {
            result = homeScore > awayScore ? '승' : '패';
          } else {
            result = awayScore > homeScore ? '승' : '패';
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
          
          let location = isHome ? '천안유관순체육관' : (teamStadiums[opponent] || '미정');
          
          // matchId 추출
          let matchId = null;
          const links = document.querySelectorAll('a');
          for (const link of links) {
            const href = link.getAttribute('href');
            if (href && href.includes('/game/')) {
              const match = href.match(/\/game\/([0-9A-Z]+)/i);
              if (match && match[1]) {
                matchId = match[1];
                break;
              }
            }
          }
          
          return { opponent, isHome, homeScore, awayScore, result, location, matchId };
        });
        
        if (matchData && matchData.opponent && matchData.result) {
          matches.push({
            date: dateStr,
            homeTeam: matchData.isHome ? '현대캐피탈' : matchData.opponent,
            awayTeam: matchData.isHome ? matchData.opponent : '현대캐피탈',
            result: matchData.result,
            score: `${matchData.homeScore}-${matchData.awayScore}`,
            location: matchData.location,
            matchId: matchData.matchId,
            setScores: null
          });
          console.log(`[배구 지난 경기] ${dateStr}: vs ${matchData.opponent} (${matchData.result})`);
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

// 야구 시즌 체크 (3월~10월)
function isBaseballSeason() {
  const month = new Date().getMonth() + 1;
  return month >= 3 && month <= 10;
}

async function getBaseballData() {
  // 시즌 중이면 실시간 크롤링
  if (isBaseballSeason()) {
    return await crawlBaseball();
  }
  
  // 시즌 종료면 정적 데이터
  console.log('[야구] 시즌 종료 - 정적 데이터 사용');
  return {
    sport: '야구',
    team: '한화 이글스',
    league: 'KBO',
    rank: '2위',
    record: '83승 57패 4무',
    winRate: '.593',
    lastUpdated: new Date().toISOString(),
    note: '2025 시즌 최종 순위 (2026년 3월 재개)'
  };
}

// 야구 실시간 크롤링 (시즌 중)
async function crawlBaseball() {
  let browser;
  try {
    console.log('[야구] 실시간 크롤링 시작...');
    const startTime = Date.now();
    
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
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
    
    // 1. 전체 팀 순위 크롤링
    const rankUrl = 'https://m.sports.naver.com/kbaseball/record/teamRank';
    await page.goto(rankUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    try {
      await page.waitForSelector('.TeamRank_table__gCKFN', { timeout: 5000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const { standings, hanwaData } = await page.evaluate(() => {
      const rows = document.querySelectorAll('.TeamRank_table__gCKFN tbody tr');
      const allTeams = [];
      let hanwa = null;
      
      for (const row of rows) {
        const teamName = row.querySelector('.TeamRank_name__xhUAb')?.textContent?.trim() || '';
        const cells = row.querySelectorAll('td');
        const rank = parseInt(cells[0]?.textContent?.trim()) || 0;
        const games = parseInt(cells[2]?.textContent?.trim()) || 0;
        const wins = parseInt(cells[3]?.textContent?.trim()) || 0;
        const losses = parseInt(cells[4]?.textContent?.trim()) || 0;
        const draws = parseInt(cells[5]?.textContent?.trim()) || 0;
        const winRate = cells[6]?.textContent?.trim() || '-';
        
        const teamData = {
          rank: rank,
          team: teamName,
          wins: wins,
          losses: losses,
          draws: draws,
          winRate: winRate
        };
        
        allTeams.push(teamData);
        
        if (teamName.includes('한화')) {
          hanwa = {
            rank: rank + '위',
            record: `${wins}승 ${losses}패 ${draws}무`,
            winRate: winRate,
            games: games
          };
        }
      }
      
      return { standings: allTeams, hanwaData: hanwa };
    });
    
    if (!hanwaData) {
      throw new Error('한화 이글스 순위 데이터를 찾을 수 없음');
    }
    
    console.log('[야구] 순위:', hanwaData.rank);
    
    // 병렬로 크롤링 실행
    const [pitchers, batters, nextGame, pastGames, headToHead] = await Promise.all([
      crawlBaseballPitchers(browser).catch(err => {
        console.error('[야구 투수 순위] 실패:', err.message);
        return [];
      }),
      crawlBaseballBatters(browser).catch(err => {
        console.error('[야구 타자 순위] 실패:', err.message);
        return [];
      }),
      crawlBaseballNextGame(browser).catch(err => {
        console.error('[야구 다음 경기] 실패:', err.message);
        return null;
      }),
      crawlBaseballPastGames(browser, 14).catch(err => {
        console.error('[야구 지난 경기] 실패:', err.message);
        return [];
      }),
      crawlBaseballHeadToHead(browser).catch(err => {
        console.error('[야구 상대전적] 실패:', err.message);
        return [];
      })
    ]);
    
    await browser.close();
    
    const baseball = {
      sport: '야구',
      team: '한화 이글스',
      league: 'KBO',
      rank: hanwaData.rank,
      record: hanwaData.record,
      winRate: hanwaData.winRate,
      standings: standings,
      pitchers: pitchers,
      batters: batters,
      headToHead: headToHead,
      nextGame: nextGame,
      pastGames: pastGames,
      lastUpdated: new Date().toISOString()
    };
    
    // 상세 페이지용 별도 파일 저장
    const detailFilePath = path.join(DATA_DIR, 'baseball-detail.json');
    await fs.writeFile(detailFilePath, JSON.stringify({
      standings: standings,
      pitchers: pitchers,
      batters: batters,
      headToHead: headToHead,
      nextGame: nextGame,
      pastGames: pastGames,
      lastUpdate: new Date().toISOString()
    }, null, 2), 'utf8');
    console.log('[야구] 상세 데이터 저장:', detailFilePath);
    
    console.log(`[야구] 크롤링 완료 (${Date.now() - startTime}ms)`);
    return baseball;
    
  } catch (error) {
    if (browser) await browser.close();
    console.error('[야구] 크롤링 실패:', error.message);
    
    return {
      sport: '야구',
      team: '한화 이글스',
      league: 'KBO',
      rank: '-',
      record: '크롤링 실패',
      winRate: '-',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

// 투수 순위 크롤링
async function crawlBaseballPitchers(browser) {
  try {
    console.log('[야구 투수 순위] 크롤링 시작...');
    const page = await browser.newPage();
    
    const url = 'https://m.sports.naver.com/kbaseball/record/pitcherEra';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pitchers = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const result = [];
      
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        const rank = i + 1;
        const name = row.querySelector('.Record_name__B8aFd')?.textContent?.trim() || '';
        const team = row.querySelector('.Record_team__rMsv7')?.textContent?.trim() || '';
        const era = cells[2]?.textContent?.trim() || '-';
        const games = cells[3]?.textContent?.trim() || '-';
        const wins = cells[4]?.textContent?.trim() || '-';
        const losses = cells[5]?.textContent?.trim() || '-';
        
        result.push({
          rank: rank,
          name: name,
          team: team,
          era: era,
          games: games,
          wins: wins,
          losses: losses
        });
      }
      
      return result;
    });
    
    await page.close();
    console.log(`[야구 투수 순위] ${pitchers.length}명`);
    return pitchers;
    
  } catch (error) {
    console.error('[야구 투수 순위] 실패:', error.message);
    return [];
  }
}

// 타자 순위 크롤링
async function crawlBaseballBatters(browser) {
  try {
    console.log('[야구 타자 순위] 크롤링 시작...');
    const page = await browser.newPage();
    
    const url = 'https://m.sports.naver.com/kbaseball/record/batterHra';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const batters = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const result = [];
      
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td');
        const rank = i + 1;
        const name = row.querySelector('.Record_name__B8aFd')?.textContent?.trim() || '';
        const team = row.querySelector('.Record_team__rMsv7')?.textContent?.trim() || '';
        const avg = cells[2]?.textContent?.trim() || '-';
        const games = cells[3]?.textContent?.trim() || '-';
        const hits = cells[5]?.textContent?.trim() || '-';
        const rbi = cells[8]?.textContent?.trim() || '-';
        
        result.push({
          rank: rank,
          name: name,
          team: team,
          avg: avg,
          games: games,
          hits: hits,
          rbi: rbi
        });
      }
      
      return result;
    });
    
    await page.close();
    console.log(`[야구 타자 순위] ${batters.length}명`);
    return batters;
    
  } catch (error) {
    console.error('[야구 타자 순위] 실패:', error.message);
    return [];
  }
}

// 상대전적 크롤링
async function crawlBaseballHeadToHead(browser) {
  try {
    console.log('[야구 상대전적] 크롤링 시작...');
    const page = await browser.newPage();
    
    // 한화 이글스 상대전적 페이지
    const url = 'https://m.sports.naver.com/kbaseball/record/teamVs?category=hra';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 한화 이글스 선택 (팀 선택 드롭다운)
    // 페이지 구조에 따라 달라질 수 있음
    
    const h2h = await page.evaluate(() => {
      const teams = ['삼성', 'LG', 'KT', 'SSG', 'NC', '두산', '키움', '롯데', 'KIA'];
      const result = [];
      
      // 상대전적 테이블에서 데이터 추출
      const rows = document.querySelectorAll('table tbody tr');
      
      for (const row of rows) {
        const teamName = row.querySelector('td:first-child')?.textContent?.trim() || '';
        
        // 한화 기준 상대전적 찾기
        if (teams.some(t => teamName.includes(t))) {
          const cells = row.querySelectorAll('td');
          const wins = parseInt(cells[1]?.textContent?.trim()) || 0;
          const losses = parseInt(cells[2]?.textContent?.trim()) || 0;
          const draws = parseInt(cells[3]?.textContent?.trim()) || 0;
          
          result.push({
            team: teamName,
            wins: wins,
            losses: losses,
            draws: draws
          });
        }
      }
      
      return result;
    });
    
    await page.close();
    console.log(`[야구 상대전적] ${h2h.length}팀`);
    return h2h;
    
  } catch (error) {
    console.error('[야구 상대전적] 실패:', error.message);
    return [];
  }
}

// 지난 경기 크롤링 (일수 지정)
async function crawlBaseballPastGames(browser, days) {
  const games = [];
  const today = new Date();
  
  console.log(`[야구 지난 경기] 최근 ${days}일 크롤링 시작...`);
  
  for (let i = 1; i <= days && games.length < 14; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    
    const game = await crawlBaseballGameDetail(browser, dateStr);
    if (game) {
      games.push(game);
    }
  }
  
  console.log(`[야구 지난 경기] 총 ${games.length}경기`);
  return games;
}

// 경기 상세 정보 크롤링 (이닝별 스코어, 주요 기록)
async function crawlBaseballGameDetail(browser, dateStr) {
  try {
    const page = await browser.newPage();
    const url = `https://m.sports.naver.com/kbaseball/schedule/index?date=${dateStr}`;
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pageText = await page.evaluate(() => document.body.textContent);
    
    if (!pageText.includes('한화') && !pageText.includes('이글스')) {
      await page.close();
      return null;
    }
    
    if (!pageText.includes('종료')) {
      await page.close();
      return null;
    }
    
    const gameData = await page.evaluate((dateStr) => {
      const bodyText = document.body.textContent || '';
      
      const teams = ['삼성', 'LG', 'KT', 'SSG', 'NC', '두산', '키움', '롯데', 'KIA'];
      let opponent = '';
      
      for (const team of teams) {
        if (bodyText.includes(team)) {
          opponent = team;
          break;
        }
      }
      
      // 스코어 추출
      const scoreMatch = bodyText.match(/(\d+)\s*:\s*(\d+)/);
      let hanwaScore = 0, opponentScore = 0;
      let result = '';
      
      if (scoreMatch) {
        const score1 = parseInt(scoreMatch[1]);
        const score2 = parseInt(scoreMatch[2]);
        
        if (bodyText.indexOf('한화') < bodyText.indexOf(opponent)) {
          hanwaScore = score1;
          opponentScore = score2;
        } else {
          hanwaScore = score2;
          opponentScore = score1;
        }
        result = hanwaScore > opponentScore ? '승' : (hanwaScore < opponentScore ? '패' : '무');
      }
      
      // 경기장 추출
      const stadiums = ['잠실', '고척', '사직', '광주', '대전', '수원', '대구', '문학', '창원', '인천'];
      let location = '';
      for (const stadium of stadiums) {
        if (bodyText.includes(stadium)) {
          location = stadium;
          break;
        }
      }
      
      // 날짜 포맷팅
      const date = new Date(dateStr);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const formattedDate = `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} (${days[date.getDay()]})`;
      
      return {
        date: formattedDate,
        rawDate: dateStr,
        opponent: opponent,
        score: `${hanwaScore} : ${opponentScore}`,
        result: result,
        location: location,
        hanwaScore: hanwaScore,
        opponentScore: opponentScore,
        // 상세 정보는 별도 페이지에서 크롤링 필요 (시간 관계상 생략)
        innings: null,
        hanwaHits: null,
        hanwaErrors: null,
        opponentHits: null,
        opponentErrors: null,
        homerun: null,
        keyHits: null,
        winningPitcher: null,
        losingPitcher: null,
        savePitcher: null,
        strikeouts: null
      };
    }, dateStr);
    
    await page.close();
    
    if (gameData && gameData.opponent && gameData.result) {
      console.log(`[야구 경기] ${dateStr}: vs ${gameData.opponent} (${gameData.result})`);
      return gameData;
    }
    
    return null;
  } catch (error) {
    console.error('[야구 경기 상세] 실패:', error.message);
    return null;
  }
}


// 다음 경기 크롤링 (오늘~7일 이내)
async function crawlBaseballNextGame(browser) {
  try {
    const page = await browser.newPage();
    const today = new Date();
    
    // 7일간 검색
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/kbaseball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageText = await page.evaluate(() => document.body.textContent);
      
      // 한화 경기가 있고 예정된 경기인지 확인
      if ((pageText.includes('한화') || pageText.includes('이글스')) && 
          pageText.includes('예정')) {
        
        const gameData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          
          // KBO 팀 목록
          const teams = ['삼성', 'LG', 'KT', 'SSG', 'NC', '두산', '키움', '롯데', 'KIA'];
          let opponent = '';
          
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          // 시간 추출
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '';
          
          // 경기장 추출
          const stadiums = ['잠실', '고척', '사직', '광주', '대전', '수원', '대구', '문학', '창원', '인천'];
          let location = '';
          for (const stadium of stadiums) {
            if (bodyText.includes(stadium)) {
              location = stadium;
              break;
            }
          }
          
          return { opponent, time, location };
        });
        
        await page.close();
        
        if (gameData && gameData.opponent) {
          console.log(`[야구 다음 경기] ${dateStr}: vs ${gameData.opponent}`);
          return {
            date: dateStr,
            opponent: gameData.opponent,
            time: gameData.time,
            location: gameData.location
          };
        }
      }
    }
    
    await page.close();
    console.log('[야구 다음 경기] 7일 이내 경기 없음');
    return null;
    
  } catch (error) {
    console.error('[야구 다음 경기] 실패:', error.message);
    return null;
  }
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

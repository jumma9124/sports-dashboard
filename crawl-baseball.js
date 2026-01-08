// crawl-baseball.js
// 야구 (한화 이글스) 전용 크롤링

const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

// 시즌 설정 로드
async function loadSeasonConfig() {
  try {
    const configPath = path.join(DATA_DIR, 'season-config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('[야구] 시즌 설정 파일 없음, 기본값 사용');
    return null;
  }
}

// 시즌 체크 (3월~10월이 시즌)
function isBaseballSeason(config = null) {
  const now = new Date();
  const month = now.getMonth() + 1;
  
  if (config && config.baseball) {
    const seasons = config.baseball.seasons;
    for (const [key, season] of Object.entries(seasons)) {
      const start = new Date(season.start);
      const end = new Date(season.end);
      if (now >= start && now <= end) {
        return true;
      }
    }
    return false;
  }
  
  // 기본값: 3월~10월
  return month >= 3 && month <= 10;
}

// 리소스 차단으로 속도 향상
async function setupPageOptimization(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

// 브라우저 실행 옵션
function getLaunchOptions() {
  const options = {
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
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else {
    options.executablePath = '/usr/bin/chromium-browser';
  }
  
  return options;
}

// 메인 크롤링 함수
async function crawlBaseball() {
  let browser;
  try {
    console.log('[야구] 크롤링 시작...');
    const startTime = Date.now();
    
    const config = await loadSeasonConfig();
    const isSeason = isBaseballSeason(config);
    console.log('[야구] 시즌 중:', isSeason);
    
    // 시즌 종료면 정적 데이터 반환
    if (!isSeason) {
      console.log('[야구] 시즌 종료 - 정적 데이터 사용');
      return getOffseasonData();
    }
    
    browser = await puppeteer.launch(getLaunchOptions());
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
        
        allTeams.push({
          rank: rank,
          team: teamName,
          wins: wins,
          losses: losses,
          draws: draws,
          winRate: winRate
        });
        
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
      nextGame: nextGame,
      isSeason: true,
      lastUpdated: new Date().toISOString()
    };
    
    // 상세 페이지용 별도 파일 저장
    const detailData = {
      standings: standings,
      pitchers: pitchers,
      batters: batters,
      headToHead: headToHead,
      nextGame: nextGame,
      pastGames: pastGames,
      lastUpdate: new Date().toISOString()
    };
    
    const detailFilePath = path.join(DATA_DIR, 'baseball-detail.json');
    await fs.writeFile(detailFilePath, JSON.stringify(detailData, null, 2), 'utf8');
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

// 시즌 종료 시 정적 데이터
function getOffseasonData() {
  return {
    sport: '야구',
    team: '한화 이글스',
    league: 'KBO',
    rank: '2위',
    record: '83승 57패 4무',
    winRate: '.593',
    isSeason: false,
    note: '2025 시즌 최종 순위 (2026년 3월 재개)',
    lastUpdated: new Date().toISOString()
  };
}

// 투수 순위 크롤링
async function crawlBaseballPitchers(browser) {
  try {
    console.log('[야구 투수 순위] 크롤링...');
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
        const name = row.querySelector('.Record_name__B8aFd')?.textContent?.trim() || '';
        const team = row.querySelector('.Record_team__rMsv7')?.textContent?.trim() || '';
        const era = cells[2]?.textContent?.trim() || '-';
        const wins = cells[4]?.textContent?.trim() || '-';
        const losses = cells[5]?.textContent?.trim() || '-';
        
        result.push({
          rank: i + 1,
          name: name,
          team: team,
          era: era,
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
    console.log('[야구 타자 순위] 크롤링...');
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
        const name = row.querySelector('.Record_name__B8aFd')?.textContent?.trim() || '';
        const team = row.querySelector('.Record_team__rMsv7')?.textContent?.trim() || '';
        const avg = cells[2]?.textContent?.trim() || '-';
        const hits = cells[5]?.textContent?.trim() || '-';
        const rbi = cells[8]?.textContent?.trim() || '-';
        
        result.push({
          rank: i + 1,
          name: name,
          team: team,
          avg: avg,
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
    console.log('[야구 상대전적] 크롤링...');
    const page = await browser.newPage();
    
    const url = 'https://m.sports.naver.com/kbaseball/record/teamVs?category=hra';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const h2h = await page.evaluate(() => {
      const teams = ['삼성', 'LG', 'KT', 'SSG', 'NC', '두산', '키움', '롯데', 'KIA'];
      const result = [];
      
      const rows = document.querySelectorAll('table tbody tr');
      
      for (const row of rows) {
        const teamName = row.querySelector('td:first-child')?.textContent?.trim() || '';
        
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

// 다음 경기 크롤링
async function crawlBaseballNextGame(browser) {
  try {
    console.log('[야구 다음 경기] 크롤링...');
    const page = await browser.newPage();
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/kbaseball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageText = await page.evaluate(() => document.body.textContent);
      
      if ((pageText.includes('한화') || pageText.includes('이글스')) && 
          pageText.includes('예정')) {
        
        const gameData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          const teams = ['삼성', 'LG', 'KT', 'SSG', 'NC', '두산', '키움', '롯데', 'KIA'];
          let opponent = '';
          
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '';
          
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

// 지난 경기 크롤링
async function crawlBaseballPastGames(browser, days) {
  const games = [];
  const today = new Date();
  
  console.log(`[야구 지난 경기] 최근 ${days}일 크롤링...`);
  
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

// 경기 상세 정보 크롤링
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
      
      const stadiums = ['잠실', '고척', '사직', '광주', '대전', '수원', '대구', '문학', '창원', '인천'];
      let location = '';
      for (const stadium of stadiums) {
        if (bodyText.includes(stadium)) {
          location = stadium;
          break;
        }
      }
      
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
        opponentScore: opponentScore
      };
    }, dateStr);
    
    await page.close();
    
    if (gameData && gameData.opponent && gameData.result) {
      return gameData;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// 독립 실행
async function main() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const result = await crawlBaseball();
    console.log('\n[야구] 결과:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlBaseball, isBaseballSeason };


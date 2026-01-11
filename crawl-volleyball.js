// crawl-volleyball.js
// 배구 (현대캐피탈 스카이워커스) 전용 크롤링

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
    console.log('[배구] 시즌 설정 파일 없음, 기본값 사용');
    return null;
  }
}

// 시즌 체크 (10월~4월이 시즌)
function isVolleyballSeason(config = null) {
  const now = new Date();
  const month = now.getMonth() + 1;
  
  if (config && config.volleyball) {
    // 설정 파일에서 시즌 확인
    const seasons = config.volleyball.seasons;
    for (const [key, season] of Object.entries(seasons)) {
      const start = new Date(season.start);
      const end = new Date(season.end);
      if (now >= start && now <= end) {
        return true;
      }
    }
    return false;
  }
  
  // 기본값: 10월~4월
  return month >= 10 || month <= 4;
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
      '--disable-gpu',
      '--disable-extensions',
      '--disable-plugins'
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
async function crawlVolleyball() {
  let browser;
  try {
    console.log('[배구] 크롤링 시작...');
    const startTime = Date.now();
    
    const config = await loadSeasonConfig();
    const isSeason = isVolleyballSeason(config);
    console.log('[배구] 시즌 중:', isSeason);
    
    browser = await puppeteer.launch(getLaunchOptions());
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    // 1. 순위 크롤링
    const url = 'https://m.sports.naver.com/volleyball/record/kovo?seasonCode=022&tab=teamRank';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    try {
      await page.waitForSelector('.TableBody_item__eCenH', { timeout: 5000 });
    } catch (e) {
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
          rank: parseInt(rank),
          team: teamName,
          wins: parseInt(wins) || 0,
          losses: parseInt(losses) || 0,
          points: parseInt(points) || 0,
          winRate: winRate,
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
            setRatio: setRatio
          };
        }
      }
      
      return { currentTeam: currentTeamData, allTeams: allTeams };
    });

    const volleyball = volleyballData.currentTeam || {
      sport: '배구',
      team: '현대캐피탈 스카이워커스',
      league: 'V-리그',
      rank: '-',
      record: '데이터 없음',
      winRate: '-'
    };
    
    volleyball.fullRankings = volleyballData.allTeams;
    console.log('[배구] 순위 완료:', volleyball.rank);
    
    // 2. 다음 경기와 지난 경기 병렬 크롤링
    const [nextMatch, pastMatches] = await Promise.all([
      crawlVolleyballNextMatch(browser).catch(err => {
        console.error('[배구] 다음 경기 실패:', err.message);
        return null;
      }),
      crawlVolleyballPastMatches(browser, 5).catch(err => {
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
    
    volleyball.lastUpdated = new Date().toISOString();
    volleyball.isSeason = isSeason;
    
    await browser.close();
    
    // 상세 페이지용 데이터 저장
    const detailData = {
      standings: volleyballData.allTeams,
      nextMatch: nextMatch,
      pastMatches: pastMatches,
      lastUpdate: new Date().toISOString()
    };
    
    const detailPath = path.join(DATA_DIR, 'volleyball-detail.json');
    await fs.writeFile(detailPath, JSON.stringify(detailData, null, 2), 'utf8');
    console.log('[배구] 상세 데이터 저장:', detailPath);
    
    // 메인 페이지용 sports.json 업데이트
    const sportsPath = path.join(DATA_DIR, 'sports.json');
    let sportsData = { volleyball, lastUpdated: new Date().toISOString() };
    
    try {
      // 기존 파일이 있으면 읽어서 baseball 데이터 유지
      const existingData = await fs.readFile(sportsPath, 'utf8');
      const existing = JSON.parse(existingData);
      sportsData = {
        ...existing,
        volleyball: volleyball,
        lastUpdated: new Date().toISOString()
      };
    } catch (err) {
      // 파일이 없으면 새로 생성 (baseball 데이터 없이)
      console.log('[배구] sports.json 파일 없음, 새로 생성');
    }
    
    await fs.writeFile(sportsPath, JSON.stringify(sportsData, null, 2), 'utf8');
    console.log('[배구] 메인 데이터 저장:', sportsPath);
    
    console.log(`[배구] 크롤링 완료 (${Date.now() - startTime}ms)`);
    return volleyball;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[배구] 크롤링 실패:', error.message);
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

// 다음 경기 크롤링
async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[배구 다음 경기] 크롤링 시작...');
    const page = await browser.newPage();
    const today = new Date();
    
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageText = await page.evaluate(() => document.body.textContent);
      
      if ((pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) && 
          pageText.includes('예정')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let isHome = bodyText.includes('현대캐피탈 홈') || bodyText.includes('현대캐피탈홈');
          
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
          return { date: dateStr, ...matchData };
        }
      }
    }

    await page.close();
    return null;
    
  } catch (error) {
    console.error('[배구 다음 경기] 실패:', error.message);
    return null;
  }
}

// 지난 경기 크롤링
async function crawlVolleyballPastMatches(browser, count = 5) {
  try {
    console.log('[배구 지난 경기] 크롤링 시작...');
    const page = await browser.newPage();
    const matches = [];
    const today = new Date();
    
    for (let i = 1; i <= 14 && matches.length < count; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      if ((pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) && 
          pageText.includes('종료')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let homeScore = 0, awayScore = 0;
          let isHome = false;
          
          const scoreMatch = bodyText.match(/(\S+)\s*홈\s*스코어\s*(\d)\s*(\S+)\s*스코어\s*(\d)/);
          if (scoreMatch) {
            const homeTeam = scoreMatch[1];
            homeScore = parseInt(scoreMatch[2]);
            awayScore = parseInt(scoreMatch[4]);
            
            if (homeTeam.includes('현대캐피탈') || homeTeam.includes('스카이워커스')) {
              isHome = true;
            }
          }
          
          let result = null;
          if (isHome) {
            result = homeScore > awayScore ? '승' : '패';
          } else {
            result = awayScore > homeScore ? '승' : '패';
          }
          
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
          
          return { opponent, isHome, homeScore, awayScore, result, location };
        });
        
        if (matchData && matchData.opponent && matchData.result) {
          matches.push({
            date: dateStr,
            homeTeam: matchData.isHome ? '현대캐피탈' : matchData.opponent,
            awayTeam: matchData.isHome ? matchData.opponent : '현대캐피탈',
            result: matchData.result,
            score: `${matchData.homeScore}-${matchData.awayScore}`,
            location: matchData.location
          });
        }
      }
    }

    await page.close();
    return matches.sort((a, b) => new Date(b.date) - new Date(a.date));
    
  } catch (error) {
    console.error('[배구 지난 경기] 실패:', error.message);
    return [];
  }
}

// 독립 실행
async function main() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const result = await crawlVolleyball();
    console.log('\n[배구] 결과:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, isVolleyballSeason };


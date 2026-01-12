// crawl-volleyball.js
// 배구 (?��?캐피???�카?�워커스) ?�용 ?�롤�?

const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

// ?�즌 ?�정 로드
async function loadSeasonConfig() {
  try {
    const configPath = path.join(DATA_DIR, 'season-config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('[배구] ?�즌 ?�정 ?�일 ?�음, 기본�??�용');
    return null;
  }
}

// ?�즌 체크 (10??4?�이 ?�즌)
function isVolleyballSeason(config = null) {
  const now = new Date();
  const month = now.getMonth() + 1;
  
  if (config && config.volleyball) {
    // ?�정 ?�일?�서 ?�즌 ?�인
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
  
  // 기본�? 10??4??
  return month >= 10 || month <= 4;
}

// 리소??차단?�로 ?�도 ?�상
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

// 브라?��? ?�행 ?�션
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

// 메인 ?�롤�??�수
async function crawlVolleyball() {
  let browser;
  try {
    console.log('[배구] ?�롤�??�작...');
    const startTime = Date.now();
    
    const config = await loadSeasonConfig();
    const isSeason = isVolleyballSeason(config);
    console.log('[배구] ?�즌 �?', isSeason);
    
    browser = await puppeteer.launch(getLaunchOptions());
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    // 1. ?�위 ?�롤�?
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
        const rankMatch = rankText.match(/(\d+)??);
        const rank = rankMatch ? rankMatch[1] : '-';
        
        const fullText = item.textContent;
        const pointsMatch = fullText.match(/?�점(\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/경기(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/??\d+)/);
        const lossesMatch = fullText.match(/??\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/?�트?�실�?[\d.]+)/);
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
        
        if (teamName.includes('?��?캐피??)) {
          currentTeamData = {
            sport: '배구',
            team: '?��?캐피???�카?�워커스',
            league: 'V-리그',
            rank: rank + '??,
            record: wins + '??' + losses + '??,
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
      team: '?��?캐피???�카?�워커스',
      league: 'V-리그',
      rank: '-',
      record: '?�이???�음',
      winRate: '-'
    };
    
    volleyball.fullRankings = volleyballData.allTeams;
    console.log('[배구] ?�자부 ?�위 ?�료:', volleyball.rank);
    
    // 1-2. ?�자부 ?�위 ?�롤�?
    const womenRankings = await crawlWomenRankings(browser).catch(err => {
      console.error('[배구] ?�자부 ?�위 ?�패:', err.message);
      return [];
    });
    volleyball.womenRankings = womenRankings;
    console.log('[배구] ?�자부 ?�위 ?�료:', womenRankings.length + '?�?);
    
    // 2. ?�음 경기?�?지??경기 병렬 ?�롤�?
    const [nextMatch, pastMatches] = await Promise.all([
      crawlVolleyballNextMatch(browser).catch(err => {
        console.error('[배구] ?�음 경기 ?�패:', err.message);
        return null;
      }),
      crawlVolleyballPastMatches(browser, 5).catch(err => {
        console.error('[배구] 지??경기 ?�패:', err.message);
        return [];
      })
    ]);
    
    if (nextMatch) {
      volleyball.nextMatch = nextMatch;
      console.log('[배구] ?�음 경기:', nextMatch.opponent);
    }
    
    if (pastMatches && pastMatches.length > 0) {
      volleyball.pastMatches = pastMatches;
      console.log('[배구] 지??경기:', pastMatches.length + '경기');
    }
    
    volleyball.lastUpdated = new Date().toISOString();
    volleyball.isSeason = isSeason;
    
    await browser.close();
    
    // ?�세 ?�이지???�이???�??
    const detailData = {
      standings: volleyballData.allTeams,
      womenStandings: womenRankings,
      womenStandings: womenRankings,
      nextMatch: nextMatch,
      pastMatches: pastMatches,
      lastUpdate: new Date().toISOString()
    };
    
    const detailPath = path.join(DATA_DIR, 'volleyball-detail.json');
    await fs.writeFile(detailPath, JSON.stringify(detailData, null, 2), 'utf8');
    console.log('[배구] ?�세 ?�이???�??', detailPath);
    
    // 메인 ?�이지??sports.json ?�데?�트
    const sportsPath = path.join(DATA_DIR, 'sports.json');
    let sportsData = { volleyball, lastUpdated: new Date().toISOString() };
    
    try {
      // 기존 ?�일???�으�??�어??baseball ?�이???��?
      const existingData = await fs.readFile(sportsPath, 'utf8');
      const existing = JSON.parse(existingData);
      sportsData = {
        ...existing,
        volleyball: volleyball,
        lastUpdated: new Date().toISOString()
      };
    } catch (err) {
      // ?�일???�으�??�로 ?�성 (baseball ?�이???�이)
      console.log('[배구] sports.json ?�일 ?�음, ?�로 ?�성');
    }
    
    await fs.writeFile(sportsPath, JSON.stringify(sportsData, null, 2), 'utf8');
    console.log('[배구] 메인 ?�이???�??', sportsPath);
    
    console.log(`[배구] ?�롤�??�료 (${Date.now() - startTime}ms)`);
    return volleyball;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[배구] ?�롤�??�패:', error.message);
    return {
      sport: '배구',
      team: '?��?캐피???�카?�워커스',
      league: 'V-리그',
      rank: '-',
      record: '?�롤�??�패',
      winRate: '-',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

// ?�자부 ?�위 ?�롤�?
async function crawlWomenRankings(browser) {
  try {
    console.log('[배구 ?�자부 ?�위] ?�롤�??�작...');
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    // ?�자부 ?�위 URL (seasonCode=023???�자부)
    const url = 'https://m.sports.naver.com/volleyball/record/kovo?seasonCode=023&tab=teamRank';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    try {
      await page.waitForSelector('.TableBody_item__eCenH', { timeout: 5000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const womenData = await page.evaluate(() => {
      const teamItems = document.querySelectorAll('.TableBody_item__eCenH');
      const allTeams = [];
      
      for (let item of teamItems) {
        const teamNameEl = item.querySelector('.TeamInfo_team_name__dni7F');
        const teamName = teamNameEl ? teamNameEl.textContent.trim() : '';
        
        const cells = item.querySelectorAll('.TableBody_cell__rFrpm');
        const rankText = cells[0] ? cells[0].textContent.trim() : '';
        const rankMatch = rankText.match(/(\d+)??);
        const rank = rankMatch ? rankMatch[1] : '-';
        
        const fullText = item.textContent;
        const pointsMatch = fullText.match(/?�점(\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/경기(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/??\d+)/);
        const lossesMatch = fullText.match(/??\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/?�트?�실�?[\d.]+)/);
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
      }
      
      return allTeams;
    });

    await page.close();
    return womenData;

  } catch (error) {
    console.error('[배구 ?�자부 ?�위] ?�패:', error.message);
    return [];
  }
}

// ?�음 경기 ?�롤�?
async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[배구 ?�음 경기] ?�롤�??�작...');
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
      
      if ((pageText.includes('?��?캐피??) || pageText.includes('?�카?�워커스')) && 
          pageText.includes('?�정')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          const teams = ['?�리카드', 'OK?�축�???, '?�?�항�?, '?�국?�력', '?�성?�재', 'KB?�해보험'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let isHome = bodyText.includes('?��?캐피????) || bodyText.includes('?��?캐피?�홈');
          
          const teamStadiums = {
            'OK?�축�???: '부?�강?�체?��?',
            '?��?캐피??: '천안?��??�체?��?',
            '?�국?�력': '?�원체육관',
            '?�?�항�?: '?�천계양체육관',
            '?�리카드': '?�충체육관',
            '?�성?�재': '?�?�충무체?��?',
            'KB?�해보험': '?�정부체육관'
          };
          
          let location = isHome ? '천안?��??�체?��?' : (teamStadiums[opponent] || '?�소 미정');
          
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
    console.error('[배구 ?�음 경기] ?�패:', error.message);
    return null;
  }
}

// 지??경기 ?�롤�?
async function crawlVolleyballPastMatches(browser, count = 5) {
  try {
    console.log('[배구 지??경기] ?�롤�??�작...');
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
      
      if ((pageText.includes('?��?캐피??) || pageText.includes('?�카?�워커스')) && 
          pageText.includes('종료')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          
          const teams = ['?�리카드', 'OK?�축�???, '?�?�항�?, '?�국?�력', '?�성?�재', 'KB?�해보험'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let homeScore = 0, awayScore = 0;
          let isHome = false;
          
          const scoreMatch = bodyText.match(/(\S+)\s*??s*?�코??s*(\d)\s*(\S+)\s*?�코??s*(\d)/);
          if (scoreMatch) {
            const homeTeam = scoreMatch[1];
            homeScore = parseInt(scoreMatch[2]);
            awayScore = parseInt(scoreMatch[4]);
            
            if (homeTeam.includes('?��?캐피??) || homeTeam.includes('?�카?�워커스')) {
              isHome = true;
            }
          }
          
          let result = null;
          if (isHome) {
            result = homeScore > awayScore ? '?? : '??;
          } else {
            result = awayScore > homeScore ? '?? : '??;
          }
          
          const teamStadiums = {
            'OK?�축�???: '부?�강?�체?��?',
            '?��?캐피??: '천안?��??�체?��?',
            '?�국?�력': '?�원체육관',
            '?�?�항�?: '?�천계양체육관',
            '?�리카드': '?�충체육관',
            '?�성?�재': '?�?�충무체?��?',
            'KB?�해보험': '?�정부체육관'
          };
          
          let location = isHome ? '천안?��??�체?��?' : (teamStadiums[opponent] || '미정');
          
          return { opponent, isHome, homeScore, awayScore, result, location };
        });
        
        if (matchData && matchData.opponent && matchData.result) {
          matches.push({
            date: dateStr,
            homeTeam: matchData.isHome ? '?��?캐피?? : matchData.opponent,
            awayTeam: matchData.isHome ? matchData.opponent : '?��?캐피??,
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
    console.error('[배구 지??경기] ?�패:', error.message);
    return [];
  }
}

// ?�립 ?�행
async function main() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const result = await crawlVolleyball();
    console.log('\n[배구] 결과:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('?�러:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, isVolleyballSeason };


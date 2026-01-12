// crawl-volleyball.js
// 諛곌뎄 (?占쏙옙?罹먰뵾???占쎌뭅?占쎌썙而ㅼ뒪) ?占쎌슜 ?占쎈·占?

const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

// ?占쎌쫵 ?占쎌젙 濡쒕뱶
async function loadSeasonConfig() {
  try {
    const configPath = path.join(DATA_DIR, 'season-config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('[諛곌뎄] ?占쎌쫵 ?占쎌젙 ?占쎌씪 ?占쎌쓬, 湲곕낯占??占쎌슜');
    return null;
  }
}

// ?占쎌쫵 泥댄겕 (10??4?占쎌씠 ?占쎌쫵)
function isVolleyballSeason(config = null) {
  const now = new Date();
  const month = now.getMonth() + 1;
  
  if (config && config.volleyball) {
    // ?占쎌젙 ?占쎌씪?占쎌꽌 ?占쎌쫵 ?占쎌씤
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
  
  // 湲곕낯占? 10??4??
  return month >= 10 || month <= 4;
}

// 由ъ냼??李⑤떒?占쎈줈 ?占쎈룄 ?占쎌긽
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

// 釉뚮씪?占쏙옙? ?占쏀뻾 ?占쎌뀡
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

// 硫붿씤 ?占쎈·占??占쎌닔
async function crawlVolleyball() {
  let browser;
  try {
    console.log('[諛곌뎄] ?占쎈·占??占쎌옉...');
    const startTime = Date.now();
    
    const config = await loadSeasonConfig();
    const isSeason = isVolleyballSeason(config);
    console.log('[諛곌뎄] ?占쎌쫵 占?', isSeason);
    
    browser = await puppeteer.launch(getLaunchOptions());
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    // 1. ?占쎌쐞 ?占쎈·占?
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
        const rankMatch = rankText.match(/(\d+)위/;
        const rank = rankMatch ? rankMatch[1] : '-';
        
        const fullText = item.textContent;
        const pointsMatch = fullText.match(/?占쎌젏(\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/寃쎄린(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/??\d+)/);
        const lossesMatch = fullText.match(/??\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/?占쏀듃?占쎌떎占?[\d.]+)/);
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
        
        if (teamName.includes('?占쏙옙?罹먰뵾??)) {
          currentTeamData = {
            sport: '諛곌뎄',
            team: '?占쏙옙?罹먰뵾???占쎌뭅?占쎌썙而ㅼ뒪',
            league: 'V-由ш렇',
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
      sport: '諛곌뎄',
      team: '?占쏙옙?罹먰뵾???占쎌뭅?占쎌썙而ㅼ뒪',
      league: 'V-由ш렇',
      rank: '-',
      record: '?占쎌씠???占쎌쓬',
      winRate: '-'
    };
    
    volleyball.fullRankings = volleyballData.allTeams;
    console.log('[諛곌뎄] ?占쎌옄遺 ?占쎌쐞 ?占쎈즺:', volleyball.rank);
    
    // 1-2. ?占쎌옄遺 ?占쎌쐞 ?占쎈·占?
    const womenRankings = await crawlWomenRankings(browser).catch(err => {
      console.error('[諛곌뎄] ?占쎌옄遺 ?占쎌쐞 ?占쏀뙣:', err.message);
      return [];
    });
    volleyball.womenRankings = womenRankings;
    console.log('[諛곌뎄] ?占쎌옄遺 ?占쎌쐞 ?占쎈즺:', womenRankings.length + '?占?);
    
    // 2. ?占쎌쓬 寃쎄린?占?吏??寃쎄린 蹂묐젹 ?占쎈·占?
    const [nextMatch, pastMatches] = await Promise.all([
      crawlVolleyballNextMatch(browser).catch(err => {
        console.error('[諛곌뎄] ?占쎌쓬 寃쎄린 ?占쏀뙣:', err.message);
        return null;
      }),
      crawlVolleyballPastMatches(browser, 5).catch(err => {
        console.error('[諛곌뎄] 吏??寃쎄린 ?占쏀뙣:', err.message);
        return [];
      })
    ]);
    
    if (nextMatch) {
      volleyball.nextMatch = nextMatch;
      console.log('[諛곌뎄] ?占쎌쓬 寃쎄린:', nextMatch.opponent);
    }
    
    if (pastMatches && pastMatches.length > 0) {
      volleyball.pastMatches = pastMatches;
      console.log('[諛곌뎄] 吏??寃쎄린:', pastMatches.length + '寃쎄린');
    }
    
    volleyball.lastUpdated = new Date().toISOString();
    volleyball.isSeason = isSeason;
    
    await browser.close();
    
    // ?占쎌꽭 ?占쎌씠吏???占쎌씠???占??
    const detailData = {
      standings: volleyballData.allTeams,
      womenStandings: womenRankings,
      nextMatch: nextMatch,
      pastMatches: pastMatches,
      lastUpdate: new Date().toISOString()
    };
    
    const detailPath = path.join(DATA_DIR, 'volleyball-detail.json');
    await fs.writeFile(detailPath, JSON.stringify(detailData, null, 2), 'utf8');
    console.log('[諛곌뎄] ?占쎌꽭 ?占쎌씠???占??', detailPath);
    
    // 硫붿씤 ?占쎌씠吏??sports.json ?占쎈뜲?占쏀듃
    const sportsPath = path.join(DATA_DIR, 'sports.json');
    let sportsData = { volleyball, lastUpdated: new Date().toISOString() };
    
    try {
      // 湲곗〈 ?占쎌씪???占쎌쑝占??占쎌뼱??baseball ?占쎌씠???占쏙옙?
      const existingData = await fs.readFile(sportsPath, 'utf8');
      const existing = JSON.parse(existingData);
      sportsData = {
        ...existing,
        volleyball: volleyball,
        lastUpdated: new Date().toISOString()
      };
    } catch (err) {
      // ?占쎌씪???占쎌쑝占??占쎈줈 ?占쎌꽦 (baseball ?占쎌씠???占쎌씠)
      console.log('[諛곌뎄] sports.json ?占쎌씪 ?占쎌쓬, ?占쎈줈 ?占쎌꽦');
    }
    
    await fs.writeFile(sportsPath, JSON.stringify(sportsData, null, 2), 'utf8');
    console.log('[諛곌뎄] 硫붿씤 ?占쎌씠???占??', sportsPath);
    
    console.log(`[諛곌뎄] ?占쎈·占??占쎈즺 (${Date.now() - startTime}ms)`);
    return volleyball;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[諛곌뎄] ?占쎈·占??占쏀뙣:', error.message);
    return {
      sport: '諛곌뎄',
      team: '?占쏙옙?罹먰뵾???占쎌뭅?占쎌썙而ㅼ뒪',
      league: 'V-由ш렇',
      rank: '-',
      record: '?占쎈·占??占쏀뙣',
      winRate: '-',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

// ?占쎌옄遺 ?占쎌쐞 ?占쎈·占?
async function crawlWomenRankings(browser) {
  try {
    console.log('[諛곌뎄 ?占쎌옄遺 ?占쎌쐞] ?占쎈·占??占쎌옉...');
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    // ?占쎌옄遺 ?占쎌쐞 URL (seasonCode=023???占쎌옄遺)
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
        const rankMatch = rankText.match(/(\d+)위/;
        const rank = rankMatch ? rankMatch[1] : '-';
        
        const fullText = item.textContent;
        const pointsMatch = fullText.match(/?占쎌젏(\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/寃쎄린(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/??\d+)/);
        const lossesMatch = fullText.match(/??\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/?占쏀듃?占쎌떎占?[\d.]+)/);
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
    console.error('[諛곌뎄 ?占쎌옄遺 ?占쎌쐞] ?占쏀뙣:', error.message);
    return [];
  }
}

// ?占쎌쓬 寃쎄린 ?占쎈·占?
async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[諛곌뎄 ?占쎌쓬 寃쎄린] ?占쎈·占??占쎌옉...');
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
      
      if ((pageText.includes('?占쏙옙?罹먰뵾??) || pageText.includes('?占쎌뭅?占쎌썙而ㅼ뒪')) && 
          pageText.includes('?占쎌젙')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          const teams = ['?占쎈━移대뱶', 'OK?占쎌텞占???, '?占?占쏀빆占?, '?占쎄뎅?占쎈젰', '?占쎌꽦?占쎌옱', 'KB?占쏀빐蹂댄뿕'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let isHome = bodyText.includes('?占쏙옙?罹먰뵾????) || bodyText.includes('?占쏙옙?罹먰뵾?占쏀솃');
          
          const teamStadiums = {
            'OK?占쎌텞占???: '遺?占쎄컯?占쎌껜?占쏙옙?',
            '?占쏙옙?罹먰뵾??: '泥쒖븞?占쏙옙??占쎌껜?占쏙옙?',
            '?占쎄뎅?占쎈젰': '?占쎌썝泥댁쑁愿',
            '?占?占쏀빆占?: '?占쎌쿇怨꾩뼇泥댁쑁愿',
            '?占쎈━移대뱶': '?占쎌땐泥댁쑁愿',
            '?占쎌꽦?占쎌옱': '?占?占쎌땐臾댁껜?占쏙옙?',
            'KB?占쏀빐蹂댄뿕': '?占쎌젙遺泥댁쑁愿'
          };
          
          let location = isHome ? '泥쒖븞?占쏙옙??占쎌껜?占쏙옙?' : (teamStadiums[opponent] || '?占쎌냼 誘몄젙');
          
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
    console.error('[諛곌뎄 ?占쎌쓬 寃쎄린] ?占쏀뙣:', error.message);
    return null;
  }
}

// 吏??寃쎄린 ?占쎈·占?
async function crawlVolleyballPastMatches(browser, count = 5) {
  try {
    console.log('[諛곌뎄 吏??寃쎄린] ?占쎈·占??占쎌옉...');
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
      
      if ((pageText.includes('?占쏙옙?罹먰뵾??) || pageText.includes('?占쎌뭅?占쎌썙而ㅼ뒪')) && 
          pageText.includes('醫낅즺')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          
          const teams = ['?占쎈━移대뱶', 'OK?占쎌텞占???, '?占?占쏀빆占?, '?占쎄뎅?占쎈젰', '?占쎌꽦?占쎌옱', 'KB?占쏀빐蹂댄뿕'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let homeScore = 0, awayScore = 0;
          let isHome = false;
          
          const scoreMatch = bodyText.match(/(\S+)\s*??s*?占쎌퐫??s*(\d)\s*(\S+)\s*?占쎌퐫??s*(\d)/);
          if (scoreMatch) {
            const homeTeam = scoreMatch[1];
            homeScore = parseInt(scoreMatch[2]);
            awayScore = parseInt(scoreMatch[4]);
            
            if (homeTeam.includes('?占쏙옙?罹먰뵾??) || homeTeam.includes('?占쎌뭅?占쎌썙而ㅼ뒪')) {
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
            'OK?占쎌텞占???: '遺?占쎄컯?占쎌껜?占쏙옙?',
            '?占쏙옙?罹먰뵾??: '泥쒖븞?占쏙옙??占쎌껜?占쏙옙?',
            '?占쎄뎅?占쎈젰': '?占쎌썝泥댁쑁愿',
            '?占?占쏀빆占?: '?占쎌쿇怨꾩뼇泥댁쑁愿',
            '?占쎈━移대뱶': '?占쎌땐泥댁쑁愿',
            '?占쎌꽦?占쎌옱': '?占?占쎌땐臾댁껜?占쏙옙?',
            'KB?占쏀빐蹂댄뿕': '?占쎌젙遺泥댁쑁愿'
          };
          
          let location = isHome ? '泥쒖븞?占쏙옙??占쎌껜?占쏙옙?' : (teamStadiums[opponent] || '誘몄젙');
          
          return { opponent, isHome, homeScore, awayScore, result, location };
        });
        
        if (matchData && matchData.opponent && matchData.result) {
          matches.push({
            date: dateStr,
            homeTeam: matchData.isHome ? '?占쏙옙?罹먰뵾?? : matchData.opponent,
            awayTeam: matchData.isHome ? matchData.opponent : '?占쏙옙?罹먰뵾??,
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
    console.error('[諛곌뎄 吏??寃쎄린] ?占쏀뙣:', error.message);
    return [];
  }
}

// ?占쎈┰ ?占쏀뻾
async function main() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const result = await crawlVolleyball();
    console.log('\n[諛곌뎄] 寃곌낵:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('?占쎈윭:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, isVolleyballSeason };


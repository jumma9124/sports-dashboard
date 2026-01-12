// crawl-volleyball.js
// ë°°êµ¬ (?„ë?ìºí”¼???¤ì¹´?´ì›Œì»¤ìŠ¤) ?„ìš© ?¬ë¡¤ë§?

const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

// ?œì¦Œ ?¤ì • ë¡œë“œ
async function loadSeasonConfig() {
  try {
    const configPath = path.join(DATA_DIR, 'season-config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('[ë°°êµ¬] ?œì¦Œ ?¤ì • ?Œì¼ ?†ìŒ, ê¸°ë³¸ê°??¬ìš©');
    return null;
  }
}

// ?œì¦Œ ì²´í¬ (10??4?”ì´ ?œì¦Œ)
function isVolleyballSeason(config = null) {
  const now = new Date();
  const month = now.getMonth() + 1;
  
  if (config && config.volleyball) {
    // ?¤ì • ?Œì¼?ì„œ ?œì¦Œ ?•ì¸
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
  
  // ê¸°ë³¸ê°? 10??4??
  return month >= 10 || month <= 4;
}

// ë¦¬ì†Œ??ì°¨ë‹¨?¼ë¡œ ?ë„ ?¥ìƒ
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

// ë¸Œë¼?°ì? ?¤í–‰ ?µì…˜
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

// ë©”ì¸ ?¬ë¡¤ë§??¨ìˆ˜
async function crawlVolleyball() {
  let browser;
  try {
    console.log('[ë°°êµ¬] ?¬ë¡¤ë§??œì‘...');
    const startTime = Date.now();
    
    const config = await loadSeasonConfig();
    const isSeason = isVolleyballSeason(config);
    console.log('[ë°°êµ¬] ?œì¦Œ ì¤?', isSeason);
    
    browser = await puppeteer.launch(getLaunchOptions());
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    // 1. ?œìœ„ ?¬ë¡¤ë§?
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
        const pointsMatch = fullText.match(/?¹ì (\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/ê²½ê¸°(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/??\d+)/);
        const lossesMatch = fullText.match(/??\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/?¸íŠ¸?ì‹¤ë¥?[\d.]+)/);
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
        
        if (teamName.includes('?„ë?ìºí”¼??)) {
          currentTeamData = {
            sport: 'ë°°êµ¬',
            team: '?„ë?ìºí”¼???¤ì¹´?´ì›Œì»¤ìŠ¤',
            league: 'V-ë¦¬ê·¸',
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
      sport: 'ë°°êµ¬',
      team: '?„ë?ìºí”¼???¤ì¹´?´ì›Œì»¤ìŠ¤',
      league: 'V-ë¦¬ê·¸',
      rank: '-',
      record: '?°ì´???†ìŒ',
      winRate: '-'
    };
    
    volleyball.fullRankings = volleyballData.allTeams;
    console.log('[ë°°êµ¬] ?¨ìë¶€ ?œìœ„ ?„ë£Œ:', volleyball.rank);
    
    // 1-2. ?¬ìë¶€ ?œìœ„ ?¬ë¡¤ë§?
    const womenRankings = await crawlWomenRankings(browser).catch(err => {
      console.error('[ë°°êµ¬] ?¬ìë¶€ ?œìœ„ ?¤íŒ¨:', err.message);
      return [];
    });
    volleyball.womenRankings = womenRankings;
    console.log('[ë°°êµ¬] ?¬ìë¶€ ?œìœ„ ?„ë£Œ:', womenRankings.length + '?€');
    
    // 2. ?¤ìŒ ê²½ê¸°?€ ì§€??ê²½ê¸° ë³‘ë ¬ ?¬ë¡¤ë§?
    const [nextMatch, pastMatches] = await Promise.all([
      crawlVolleyballNextMatch(browser).catch(err => {
        console.error('[ë°°êµ¬] ?¤ìŒ ê²½ê¸° ?¤íŒ¨:', err.message);
        return null;
      }),
      crawlVolleyballPastMatches(browser, 5).catch(err => {
        console.error('[ë°°êµ¬] ì§€??ê²½ê¸° ?¤íŒ¨:', err.message);
        return [];
      })
    ]);
    
    if (nextMatch) {
      volleyball.nextMatch = nextMatch;
      console.log('[ë°°êµ¬] ?¤ìŒ ê²½ê¸°:', nextMatch.opponent);
    }
    
    if (pastMatches && pastMatches.length > 0) {
      volleyball.pastMatches = pastMatches;
      console.log('[ë°°êµ¬] ì§€??ê²½ê¸°:', pastMatches.length + 'ê²½ê¸°');
    }
    
    volleyball.lastUpdated = new Date().toISOString();
    volleyball.isSeason = isSeason;
    
    await browser.close();
    
    // ?ì„¸ ?˜ì´ì§€???°ì´???€??
    const detailData = {
      standings: volleyballData.allTeams,
      womenStandings: womenRankings,
      nextMatch: nextMatch,
      pastMatches: pastMatches,
      lastUpdate: new Date().toISOString()
    };
    
    const detailPath = path.join(DATA_DIR, 'volleyball-detail.json');
    await fs.writeFile(detailPath, JSON.stringify(detailData, null, 2), 'utf8');
    console.log('[ë°°êµ¬] ?ì„¸ ?°ì´???€??', detailPath);
    
    // ë©”ì¸ ?˜ì´ì§€??sports.json ?…ë°?´íŠ¸
    const sportsPath = path.join(DATA_DIR, 'sports.json');
    let sportsData = { volleyball, lastUpdated: new Date().toISOString() };
    
    try {
      // ê¸°ì¡´ ?Œì¼???ˆìœ¼ë©??½ì–´??baseball ?°ì´??? ì?
      const existingData = await fs.readFile(sportsPath, 'utf8');
      const existing = JSON.parse(existingData);
      sportsData = {
        ...existing,
        volleyball: volleyball,
        lastUpdated: new Date().toISOString()
      };
    } catch (err) {
      // ?Œì¼???†ìœ¼ë©??ˆë¡œ ?ì„± (baseball ?°ì´???†ì´)
      console.log('[ë°°êµ¬] sports.json ?Œì¼ ?†ìŒ, ?ˆë¡œ ?ì„±');
    }
    
    await fs.writeFile(sportsPath, JSON.stringify(sportsData, null, 2), 'utf8');
    console.log('[ë°°êµ¬] ë©”ì¸ ?°ì´???€??', sportsPath);
    
    console.log(`[ë°°êµ¬] ?¬ë¡¤ë§??„ë£Œ (${Date.now() - startTime}ms)`);
    return volleyball;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[ë°°êµ¬] ?¬ë¡¤ë§??¤íŒ¨:', error.message);
    return {
      sport: 'ë°°êµ¬',
      team: '?„ë?ìºí”¼???¤ì¹´?´ì›Œì»¤ìŠ¤',
      league: 'V-ë¦¬ê·¸',
      rank: '-',
      record: '?¬ë¡¤ë§??¤íŒ¨',
      winRate: '-',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

// ?¬ìë¶€ ?œìœ„ ?¬ë¡¤ë§?
async function crawlWomenRankings(browser) {
  try {
    console.log('[ë°°êµ¬ ?¬ìë¶€ ?œìœ„] ?¬ë¡¤ë§??œì‘...');
    const page = await browser.newPage();
    await setupPageOptimization(page);
    
    // ?¬ìë¶€ ?œìœ„ URL (seasonCode=023???¬ìë¶€)
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
        const pointsMatch = fullText.match(/?¹ì (\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/ê²½ê¸°(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/??\d+)/);
        const lossesMatch = fullText.match(/??\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/?¸íŠ¸?ì‹¤ë¥?[\d.]+)/);
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
    console.error('[ë°°êµ¬ ?¬ìë¶€ ?œìœ„] ?¤íŒ¨:', error.message);
    return [];
  }
}

// ?¤ìŒ ê²½ê¸° ?¬ë¡¤ë§?
async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[ë°°êµ¬ ?¤ìŒ ê²½ê¸°] ?¬ë¡¤ë§??œì‘...');
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
      
      if ((pageText.includes('?„ë?ìºí”¼??) || pageText.includes('?¤ì¹´?´ì›Œì»¤ìŠ¤')) && 
          pageText.includes('?ˆì •')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          const teams = ['?°ë¦¬ì¹´ë“œ', 'OK?€ì¶•ì???, '?€?œí•­ê³?, '?œêµ­?„ë ¥', '?¼ì„±?”ì¬', 'KB?í•´ë³´í—˜'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let isHome = bodyText.includes('?„ë?ìºí”¼????) || bodyText.includes('?„ë?ìºí”¼?ˆí™ˆ');
          
          const teamStadiums = {
            'OK?€ì¶•ì???: 'ë¶€?°ê°•?œì²´?¡ê?',
            '?„ë?ìºí”¼??: 'ì²œì•ˆ? ê??œì²´?¡ê?',
            '?œêµ­?„ë ¥': '?˜ì›ì²´ìœ¡ê´€',
            '?€?œí•­ê³?: '?¸ì²œê³„ì–‘ì²´ìœ¡ê´€',
            '?°ë¦¬ì¹´ë“œ': '?¥ì¶©ì²´ìœ¡ê´€',
            '?¼ì„±?”ì¬': '?€?„ì¶©ë¬´ì²´?¡ê?',
            'KB?í•´ë³´í—˜': '?˜ì •ë¶€ì²´ìœ¡ê´€'
          };
          
          let location = isHome ? 'ì²œì•ˆ? ê??œì²´?¡ê?' : (teamStadiums[opponent] || '?¥ì†Œ ë¯¸ì •');
          
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
    console.error('[ë°°êµ¬ ?¤ìŒ ê²½ê¸°] ?¤íŒ¨:', error.message);
    return null;
  }
}

// ì§€??ê²½ê¸° ?¬ë¡¤ë§?
async function crawlVolleyballPastMatches(browser, count = 5) {
  try {
    console.log('[ë°°êµ¬ ì§€??ê²½ê¸°] ?¬ë¡¤ë§??œì‘...');
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
      
      if ((pageText.includes('?„ë?ìºí”¼??) || pageText.includes('?¤ì¹´?´ì›Œì»¤ìŠ¤')) && 
          pageText.includes('ì¢…ë£Œ')) {
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent || '';
          
          const teams = ['?°ë¦¬ì¹´ë“œ', 'OK?€ì¶•ì???, '?€?œí•­ê³?, '?œêµ­?„ë ¥', '?¼ì„±?”ì¬', 'KB?í•´ë³´í—˜'];
          let opponent = '';
          for (const team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let homeScore = 0, awayScore = 0;
          let isHome = false;
          
          const scoreMatch = bodyText.match(/(\S+)\s*??s*?¤ì½”??s*(\d)\s*(\S+)\s*?¤ì½”??s*(\d)/);
          if (scoreMatch) {
            const homeTeam = scoreMatch[1];
            homeScore = parseInt(scoreMatch[2]);
            awayScore = parseInt(scoreMatch[4]);
            
            if (homeTeam.includes('?„ë?ìºí”¼??) || homeTeam.includes('?¤ì¹´?´ì›Œì»¤ìŠ¤')) {
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
            'OK?€ì¶•ì???: 'ë¶€?°ê°•?œì²´?¡ê?',
            '?„ë?ìºí”¼??: 'ì²œì•ˆ? ê??œì²´?¡ê?',
            '?œêµ­?„ë ¥': '?˜ì›ì²´ìœ¡ê´€',
            '?€?œí•­ê³?: '?¸ì²œê³„ì–‘ì²´ìœ¡ê´€',
            '?°ë¦¬ì¹´ë“œ': '?¥ì¶©ì²´ìœ¡ê´€',
            '?¼ì„±?”ì¬': '?€?„ì¶©ë¬´ì²´?¡ê?',
            'KB?í•´ë³´í—˜': '?˜ì •ë¶€ì²´ìœ¡ê´€'
          };
          
          let location = isHome ? 'ì²œì•ˆ? ê??œì²´?¡ê?' : (teamStadiums[opponent] || 'ë¯¸ì •');
          
          return { opponent, isHome, homeScore, awayScore, result, location };
        });
        
        if (matchData && matchData.opponent && matchData.result) {
          matches.push({
            date: dateStr,
            homeTeam: matchData.isHome ? '?„ë?ìºí”¼?? : matchData.opponent,
            awayTeam: matchData.isHome ? matchData.opponent : '?„ë?ìºí”¼??,
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
    console.error('[ë°°êµ¬ ì§€??ê²½ê¸°] ?¤íŒ¨:', error.message);
    return [];
  }
}

// ?…ë¦½ ?¤í–‰
async function main() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const result = await crawlVolleyball();
    console.log('\n[ë°°êµ¬] ê²°ê³¼:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('?ëŸ¬:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, isVolleyballSeason };


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

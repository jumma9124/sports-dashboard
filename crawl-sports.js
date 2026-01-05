const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

async function crawlVolleyball() {
  let browser;
  try {
    console.log('[배구] 크롤링 시작...');
    
    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    // GitHub Actions에서 Chromium 경로 사용
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }
    
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    const url = 'https://m.sports.naver.com/volleyball/record/kovo?seasonCode=022&tab=teamRank';
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

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
        
        // 전체 팀 순위 저장
        allTeams.push({
          rank: rank + '위',
          team: teamName,
          record: wins + '승 ' + losses + '패',
          winRate: winRate,
          points: points,
          setRatio: setRatio
        });
        
        // 현대캐피탈 데이터 저장
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

    // 전체 팀 순위 추가
    volleyball.fullRankings = volleyballData.allTeams;

    console.log('[배구] 성공:', volleyball);
    
    try {
      const nextMatch = await crawlVolleyballNextMatch(browser);
      if (nextMatch) {
        volleyball.nextMatch = nextMatch;
        console.log('[배구] 다음 경기 추가:', nextMatch);
      }
    } catch (error) {
      console.error('[배구] 다음 경기 실패:', error.message);
    }
    
    // 지난 경기 크롤링 추가 (상세 정보 포함)
    try {
      const pastMatches = await crawlVolleyballPastMatches(browser);
      if (pastMatches && pastMatches.length > 0) {
        volleyball.pastMatches = pastMatches;
        console.log('[배구] 지난 경기 추가:', pastMatches.length + '경기');
      }
    } catch (error) {
      console.error('[배구] 지난 경기 실패:', error.message);
    }
    
    await browser.close();
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

async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[배구 다음 경기] 크롤링 시작...');
    
    const page = await browser.newPage();
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      console.log('[배구 다음 경기] 확인:', dateStr);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      try {
        await page.waitForSelector('[class*="stadium"]', { timeout: 10000 });
      } catch (e) {
        console.log('[배구 다음 경기] 경기장 정보 대기 타임아웃 (계속 진행)');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      if (pageText.includes('현대캐피탈') || pageText.includes('스카이워커스') || pageText.includes('천안유관순')) {
        console.log('[배구 다음 경기] 매치 발견!');
        
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
          
          const teamStadiums = {
            'OK저축은행': '부산강서체육관',
            '현대캐피탈': '천안유관순체육관',
            '한국전력': '수원체육관',
            '대한항공': '인천계양체육관',
            '우리카드': '장충체육관',
            '삼성화재': '대전충무체육관',
            'KB손해보험': '의정부체육관'
          };
          
          for (let [team, stadium] of Object.entries(teamStadiums)) {
            if (bodyText.includes(team + '홈')) {
              location = stadium;
              break;
            }
          }
          
          if (!location) {
            if (bodyText.includes('천안유관순')) {
              location = '천안유관순체육관';
            } else {
              const stadiumPatterns = [
                { pattern: /부산강서\s*체육관/, name: '부산강서체육관' },
                { pattern: /부산사직\s*체육관/, name: '부산사직체육관' },
                { pattern: /수원\s*체육관/, name: '수원체육관' },
                { pattern: /의정부\s*체육관/, name: '의정부체육관' },
                { pattern: /장충\s*체육관/, name: '장충체육관' },
                { pattern: /김천실내\s*체육관/, name: '김천실내체육관' },
                { pattern: /대전충무\s*체육관/, name: '대전충무체육관' },
                { pattern: /인천계양\s*체육관/, name: '인천계양체육관' },
                { pattern: /화성실내\s*체육관/, name: '화성실내체육관' }
              ];
              
              for (let stadium of stadiumPatterns) {
                if (stadium.pattern.test(bodyText)) {
                  location = stadium.name;
                  break;
                }
              }
            }
          }
          
          return {
            time: time,
            opponent: opponent,
            location: location || '장소 미정'
          };
        });
        
        if (matchData.opponent) {
          await page.close();
          const result = {
            date: dateStr,
            time: matchData.time,
            opponent: matchData.opponent,
            location: matchData.location
          };
          console.log('[배구 다음 경기] 성공:', result);
          return result;
        }
      }
    }

    await page.close();
    console.log('[배구 다음 경기] 30일 이내 경기 없음');
    return null;
    
  } catch (error) {
    console.error('[배구 다음 경기] 실패:', error.message);
    return null;
  }
}

async function crawlVolleyballPastMatches(browser) {
  try {
    console.log('[배구 지난 경기] 크롤링 시작...');
    
    const page = await browser.newPage();
    const matches = [];
    
    // 최근 30일 동안의 경기 확인
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      // 이미 5경기 찾았으면 중단
      if (matches.length >= 5) break;
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      // 현대캐피탈 경기가 있는지 확인
      if (pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) {
        console.log('[배구 지난 경기] 발견:', dateStr);
        
        // 경기 ID 찾기 (상세 페이지 접근용)
        const matchId = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="/game/"]');
          for (let link of links) {
            const href = link.getAttribute('href');
            if (href && href.includes('/game/')) {
              const match = href.match(/game\/(\d+)/);
              return match ? match[1] : null;
            }
          }
          return null;
        });
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent;
          
          // 상대팀 찾기
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (let team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          // 홈/원정 확인
          let isHome = false;
          if (bodyText.includes('현대캐피탈홈') || bodyText.includes('천안유관순')) {
            isHome = true;
          }
          
          // 결과 찾기
          const scorePattern = /(\d)-(\d)/g;
          const scores = bodyText.match(scorePattern);
          
          let result = null;
          let score = null;
          
          if (scores && scores.length > 0) {
            score = scores[0];
            const [set1, set2] = score.split('-').map(Number);
            
            if (isHome) {
              result = set1 > set2 ? '승' : '패';
            } else {
              result = set2 > set1 ? '승' : '패';
            }
          }
          
          // 경기장 찾기
          let location = '';
          const teamStadiums = {
            'OK저축은행': '부산강서체육관',
            '현대캐피탈': '천안유관순체육관',
            '한국전력': '수원체육관',
            '대한항공': '인천계양체육관',
            '우리카드': '장충체육관',
            '삼성화재': '대전충무체육관',
            'KB손해보험': '의정부체육관'
          };
          
          for (let [team, stadium] of Object.entries(teamStadiums)) {
            if (bodyText.includes(team + '홈')) {
              location = stadium;
              break;
            }
          }
          
          if (!location && bodyText.includes('천안유관순')) {
            location = '천안유관순체육관';
          }
          
          return {
            opponent: opponent,
            isHome: isHome,
            result: result,
            score: score,
            location: location || '미정'
          };
        });
        
        // 상세 정보 크롤링 (경기 ID가 있을 때만)
        let detailInfo = null;
        if (matchId) {
          try {
            const detailUrl = `https://m.sports.naver.com/volleyball/game/${matchId}/record`;
            await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 20000 });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            detailInfo = await page.evaluate(() => {
              const bodyText = document.body.textContent;
              
              // 세트별 스코어 찾기
              const setScores = [];
              const setPattern = /(\d+)-(\d+)/g;
              let match;
              let count = 0;
              while ((match = setPattern.exec(bodyText)) !== null && count < 5) {
                setScores.push(`${match[1]}-${match[2]}`);
                count++;
              }
              
              // 경기 시간 찾기
              const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
              const time = timeMatch ? timeMatch[1] : null;
              
              return {
                setScores: setScores.length > 0 ? setScores : null,
                time: time
              };
            });
            
            console.log('[배구 지난 경기] 상세 정보:', detailInfo);
          } catch (error) {
            console.log('[배구 지난 경기] 상세 정보 실패:', error.message);
          }
        }
        
        // 결과가 확정된 경기만 추가
        if (matchData.opponent && matchData.result) {
          const matchRecord = {
            date: dateStr,
            homeTeam: matchData.isHome ? '현대캐피탈' : matchData.opponent,
            awayTeam: matchData.isHome ? matchData.opponent : '현대캐피탈',
            result: matchData.result,
            score: matchData.score || '-',
            location: matchData.location,
            matchId: matchId
          };
          
          // 상세 정보 추가
          if (detailInfo) {
            if (detailInfo.setScores) {
              matchRecord.setScores = detailInfo.setScores;
            }
            if (detailInfo.time) {
              matchRecord.time = detailInfo.time;
            }
          }
          
          matches.push(matchRecord);
          console.log('[배구 지난 경기] 추가:', matchRecord);
        }
      }
    }

    await page.close();
    console.log('[배구 지난 경기] 완료:', matches.length + '경기');
    
    // 최신순 정렬
    matches.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return matches.slice(0, 5);
    
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

  console.log('[야구] 완료:', baseball);
  return baseball;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('스포츠 데이터 크롤링 시작');
    console.log('='.repeat(80) + '\n');

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

    console.log('\n' + '='.repeat(80));
    console.log('크롤링 완료!');
    console.log('파일:', filePath);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, getBaseballData };
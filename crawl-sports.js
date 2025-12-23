const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

async function crawlVolleyball() {
  let browser;
  try {
    console.log('[배구] 크롤링 시작...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const url = 'https://m.sports.naver.com/volleyball/record/kovo?seasonCode=022&tab=teamRank';
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(5000);

    const volleyball = await page.evaluate(() => {
      const teamItems = document.querySelectorAll('.TableBody_item__eCenH');
      
      for (let item of teamItems) {
        const teamNameEl = item.querySelector('.TeamInfo_team_name__dni7F');
        const teamName = teamNameEl ? teamNameEl.textContent.trim() : '';
        
        if (teamName.includes('현대캐피탈')) {
          const cells = item.querySelectorAll('.TableBody_cell__rFrpm');
          const rankText = cells[0] ? cells[0].textContent.trim() : '';
          const rankMatch = rankText.match(/(\d+)위/);
          const rank = rankMatch ? rankMatch[1] + '위' : '-';
          
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
          
          return {
            sport: '배구',
            team: '현대캐피탈 스카이워커스',
            league: 'V-리그',
            rank: rank,
            record: wins + '승 ' + losses + '패',
            winRate: winRate,
            games: games,
            points: points,
            setRatio: setRatio,
            lastUpdated: new Date().toISOString()
          };
        }
      }
      return null;
    });

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
    
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}&teamCode=2003`;
      console.log('[배구 다음 경기] 확인:', dateStr);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(3000);

      // 페이지 전체 텍스트 가져오기
      const pageText = await page.evaluate(() => document.body.textContent);
      
      // 현대캐피탈 또는 천안유관순이 있는지 확인
      if (pageText.includes('현대캐피탈') || pageText.includes('천안유관순')) {
        console.log('[배구 다음 경기] 매치 발견!');
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent;
          
          // 시간 찾기
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          // 상대팀 찾기
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (let team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          // 경기장 찾기
          let location = '';
          if (bodyText.includes('천안유관순')) {
            location = '천안유관순체육관';
          } else {
            const stadiums = ['수원체육관', '의정부체육관', '장충체육관', '김천실내체육관', '대전충무체육관'];
            for (let stadium of stadiums) {
              if (bodyText.includes(stadium)) {
                location = stadium;
                break;
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
    console.log('[배구 다음 경기] 14일 이내 경기 없음');
    return null;
    
  } catch (error) {
    console.error('[배구 다음 경기] 실패:', error.message);
    return null;
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
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// 데이터 저장 경로
const DATA_DIR = path.join(__dirname, 'public', 'data');

/**
 * 네이버 스포츠에서 배구 순위 크롤링
 */
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
    console.log('[배구] URL:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

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
            ? (parseInt(wins) / parseInt(games)).toFixed(3)
            : '-';
          
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

    await browser.close();

    if (!volleyball) {
      console.log('[배구] 경고: 현대캐피탈 데이터를 찾을 수 없습니다');
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
    
    // 다음 경기 크롤링 (browser를 전달)
    try {
      const nextMatch = await crawlVolleyballNextMatch(browser);
      if (nextMatch) {
        volleyball.nextMatch = nextMatch;
        console.log('[배구] 다음 경기 추가됨:', nextMatch);
      } else {
        console.log('[배구] 다음 경기 데이터 없음 - 기본값 사용');
        // 기본값 설정 (임시)
        volleyball.nextMatch = {
          date: '2025-12-26',
          time: '19:00',
          opponent: 'OK저축은행',
          location: '천안유관순체육관'
        };
      }
    } catch (error) {
      console.error('[배구] 다음 경기 크롤링 실패:', error.message);
      // 에러 시에도 기본값 설정
      volleyball.nextMatch = {
        date: '2025-12-26',
        time: '19:00',
        opponent: 'OK저축은행',
        location: '천안유관순체육관'
      };
    }
    
    // 모든 크롤링 완료 후 브라우저 닫기
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

/**
 * 배구 다음 경기 크롤링
 */
async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[배구 다음 경기] 크롤링 시작...');
    
    const page = await browser.newPage();
    const url = 'https://m.sports.naver.com/volleyball/schedule/index?date=&teamCode=2003';
    console.log('[배구 다음 경기] URL:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForTimeout(3000);

    const nextMatch = await page.evaluate(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 경기 목록에서 미래 경기 찾기
      const matchItems = document.querySelectorAll('.ScheduleAllListItem_match_item__1jros');
      
      for (let item of matchItems) {
        const dateEl = item.querySelector('.ScheduleAllListItem_game_date__3_0_u');
        if (!dateEl) continue;
        
        const dateText = dateEl.textContent.trim();
        const dateMatch = dateText.match(/(\d+)\.(\d+)/);
        if (!dateMatch) continue;
        
        const month = parseInt(dateMatch[1]);
        const day = parseInt(dateMatch[2]);
        const year = new Date().getFullYear();
        
        const matchDate = new Date(year, month - 1, day);
        matchDate.setHours(0, 0, 0, 0);
        
        // 오늘 이후 경기만
        if (matchDate >= today) {
          const timeEl = item.querySelector('.ScheduleAllListItem_game_time__26pq6');
          const time = timeEl ? timeEl.textContent.trim() : '19:00';
          
          // 상대팀 찾기
          const teamEls = item.querySelectorAll('.TeamInfo_team_name__dni7F');
          let opponent = '';
          
          for (let teamEl of teamEls) {
            const teamName = teamEl.textContent.trim();
            if (!teamName.includes('현대캐피탈')) {
              opponent = teamName;
              break;
            }
          }
          
          // 경기장
          const locationEl = item.querySelector('.ScheduleAllListItem_stadium__3kOcW');
          const location = locationEl ? locationEl.textContent.trim() : '장소 미정';
          
          return {
            date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            time: time,
            opponent: opponent || '상대 미정',
            location: location
          };
        }
      }
      
      return null;
    });

    await page.close();
    
    if (nextMatch) {
      console.log('[배구 다음 경기] 성공:', nextMatch);
    } else {
      console.log('[배구 다음 경기] 예정된 경기 없음');
    }
    
    return nextMatch;
    
  } catch (error) {
    console.error('[배구 다음 경기] 실패:', error.message);
    return null;
  }
}

/**
 * 야구 데이터
 */
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

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log('\n================================================================================');
    console.log('스포츠 데이터 크롤링 시작');
    console.log('================================================================================\n');

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
    await fs.writeFile(
      filePath,
      JSON.stringify(sportsData, null, 2),
      'utf8'
    );

    console.log('\n================================================================================');
    console.log('크롤링 완료!');
    console.log('파일:', filePath);
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, getBaseballData };
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// 데이터 저장 경로
const DATA_DIR = path.join(__dirname, 'public', 'data');

/**
 * 네이버 스포츠에서 배구 순위 크롤링 (Puppeteer)
 */
async function crawlVolleyball() {
  let browser;
  try {
    console.log('🏐 배구 데이터 크롤링 시작...');
    
    // Puppeteer 브라우저 실행
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // 네이버 스포츠 배구 순위 페이지
    const url = 'https://m.sports.naver.com/volleyball/record/kovo?seasonCode=022&tab=teamRank';
    console.log('📍 URL:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // 페이지가 로드될 때까지 대기
    await page.waitForTimeout(3000);

    // HTML 구조 파악을 위한 스크린샷 (디버깅용)
    // await page.screenshot({ path: 'volleyball-ranking.png' });

    // 순위 테이블에서 현대캐피탈 데이터 추출
    const volleyball = await page.evaluate(() => {
      // 순위 테이블 찾기
      const rows = document.querySelectorAll('table tbody tr');
      
      for (let row of rows) {
        const teamName = row.querySelector('td:nth-child(2)')?.textContent.trim();
        
        if (teamName && teamName.includes('현대캐피탈')) {
          const rank = row.querySelector('td:nth-child(1)')?.textContent.trim() || '-';
          const games = row.querySelector('td:nth-child(3)')?.textContent.trim() || '-';
          const wins = row.querySelector('td:nth-child(4)')?.textContent.trim() || '-';
          const losses = row.querySelector('td:nth-child(5)')?.textContent.trim() || '-';
          const winRate = row.querySelector('td:nth-child(6)')?.textContent.trim() || '-';
          
          return {
            sport: '배구',
            team: '현대캐피탈 스카이워커스',
            league: 'V-리그',
            rank: rank,
            record: `${wins}승 ${losses}패`,
            winRate: winRate,
            games: games,
            lastUpdated: new Date().toISOString()
          };
        }
      }
      
      return null;
    });

    await browser.close();

    if (!volleyball) {
      console.warn('⚠️ 현대캐피탈 데이터를 찾을 수 없습니다');
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

    console.log('✅ 배구:', volleyball);
    return volleyball;

  } catch (error) {
    if (browser) await browser.close();
    console.error('❌ 배구 크롤링 실패:', error.message);
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
 * 야구 데이터 (시즌 종료)
 */
async function getBaseballData() {
  console.log('⚾ 야구 데이터 생성...');
  
  const baseball = {
    sport: '야구',
    team: 'SSG 랜더스',
    league: 'KBO',
    rank: '6위',
    record: '시즌 종료',
    winRate: '.471',
    lastUpdated: new Date().toISOString(),
    note: '2024 시즌 종료 (2025년 3월 재개)'
  };

  console.log('✅ 야구:', baseball);
  return baseball;
}

/**
 * 모든 스포츠 데이터 수집 및 저장
 */
async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 스포츠 데이터 크롤링 시작 (Puppeteer)');
    console.log('='.repeat(80) + '\n');

    // 데이터 디렉토리 확인
    await fs.mkdir(DATA_DIR, { recursive: true });

    // 배구 & 야구 데이터 수집
    const [volleyball, baseball] = await Promise.all([
      crawlVolleyball(),
      getBaseballData()
    ]);

    // sports.json 저장
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

    console.log('\n' + '='.repeat(80));
    console.log('✅ 크롤링 완료!');
    console.log('파일:', filePath);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ 크롤링 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, getBaseballData };

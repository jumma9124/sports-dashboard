const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function crawlBaseballDetail() {
  console.log('야구 상세 데이터 크롤링 시작...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812 });

    const data = {
      lastUpdate: new Date().toISOString(),
      standings: [],
      pitchers: [],
      batters: []
    };

    // 1. 순위 크롤링
    console.log('\n팀 순위 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/index?category=kbo', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    const standings = await page.evaluate(() => {
      const rows = document.querySelectorAll('.StandingsTable_row__3q5-D');
      const result = [];
      
      rows.forEach((row, index) => {
        if (index === 0) return; // 헤더 제외
        
        const cells = row.querySelectorAll('.StandingsTable_cell__16aYp');
        if (cells.length >= 8) {
          result.push({
            rank: cells[0].textContent.trim(),
            team: cells[1].textContent.trim(),
            games: cells[2].textContent.trim(),
            wins: cells[3].textContent.trim(),
            losses: cells[4].textContent.trim(),
            draws: cells[5].textContent.trim(),
            winRate: cells[6].textContent.trim(),
            gameBehind: cells[7].textContent.trim()
          });
        }
      });
      
      return result;
    });

    data.standings = standings;
    console.log(`순위: ${standings.length}팀 수집 완료`);

    // 2. 투수 기록 크롤링 (수정된 선택자)
    console.log('\n투수 기록 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&tab=pitcher', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    const pitchers = await page.evaluate(() => {
      const items = document.querySelectorAll('.TableBody_item__PeA\\+h');
      const result = [];
      
      items.forEach((item, index) => {
        if (index >= 10) return; // 상위 10명만
        
        const nameEl = item.querySelector('.PlayerInfo_name__GG7ms');
        const teamEl = item.querySelector('.PlayerInfo_team__OYuwW');
        const statCells = item.querySelectorAll('.TextInfo_text__y5AWv');
        
        if (nameEl && statCells.length >= 8) {
          result.push({
            rank: index + 1,
            name: nameEl.textContent.trim(),
            team: teamEl ? teamEl.textContent.trim() : '',
            era: statCells[0].textContent.trim(),
            games: statCells[1].textContent.trim(),
            wins: statCells[2].textContent.trim(),
            losses: statCells[3].textContent.trim(),
            saves: statCells[4].textContent.trim(),
            holds: statCells[5].textContent.trim(),
            innings: statCells[6].textContent.trim(),
            strikeouts: statCells[7].textContent.trim()
          });
        }
      });
      
      return result;
    });

    data.pitchers = pitchers;
    console.log(`투수: ${pitchers.length}명 수집 완료`);

    // 3. 타자 기록 크롤링 (동일한 방식으로 수정)
    console.log('\n타자 기록 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&tab=batter', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    const batters = await page.evaluate(() => {
      const items = document.querySelectorAll('.TableBody_item__PeA\\+h');
      const result = [];
      
      items.forEach((item, index) => {
        if (index >= 10) return; // 상위 10명만
        
        const nameEl = item.querySelector('.PlayerInfo_name__GG7ms');
        const teamEl = item.querySelector('.PlayerInfo_team__OYuwW');
        const statCells = item.querySelectorAll('.TextInfo_text__y5AWv');
        
        if (nameEl && statCells.length >= 8) {
          result.push({
            rank: index + 1,
            name: nameEl.textContent.trim(),
            team: teamEl ? teamEl.textContent.trim() : '',
            avg: statCells[0].textContent.trim(),    // 타율
            games: statCells[1].textContent.trim(),  // 경기수
            ab: statCells[2].textContent.trim(),     // 타수
            hits: statCells[3].textContent.trim(),   // 안타
            doubles: statCells[4].textContent.trim(), // 2루타
            triples: statCells[5].textContent.trim(), // 3루타
            hr: statCells[6].textContent.trim(),     // 홈런
            rbi: statCells[7].textContent.trim()     // 타점
          });
        }
      });
      
      return result;
    });

    data.batters = batters;
    console.log(`타자: ${batters.length}명 수집 완료`);

    // 4. JSON 파일 저장
    const outputDir = path.join(__dirname, 'public', 'data');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, 'baseball-detail.json');
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log(`\n크롤링 완료!`);
    console.log(`저장 위치: ${outputPath}`);
    console.log(`총 데이터: 순위 ${data.standings.length}팀, 투수 ${data.pitchers.length}명, 타자 ${data.batters.length}명`);

  } catch (error) {
    console.error('크롤링 오류:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// 실행
if (require.main === module) {
  crawlBaseballDetail()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = crawlBaseballDetail;
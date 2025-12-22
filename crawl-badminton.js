const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// 데이터 저장 경로
const DATA_DIR = path.join(__dirname, 'public', 'data');

/**
 * BWF 공식 사이트에서 안세영 경기 데이터 크롤링
 */
async function crawlAhnSeyoung() {
  let browser;
  try {
    console.log('[안세영] 크롤링 시작...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // BWF 공식 사이트 - 안세영 선수 페이지
    // 랭킹 페이지에서 안세영 정보 확인
    const rankingUrl = 'https://bwf.tournamentsoftware.com/ranking/category.aspx?id=42867&category=472&C472FOC=&p=1&ps=100';
    console.log('[안세영] 랭킹 URL:', rankingUrl);
    
    await page.goto(rankingUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForTimeout(3000);

    // 랭킹 정보 가져오기
    const rankingData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.ruler tr');
      
      for (let row of rows) {
        const nameCell = row.querySelector('td a');
        if (nameCell && nameCell.textContent.includes('AN Se Young')) {
          const cells = row.querySelectorAll('td');
          const ranking = cells[0]?.textContent.trim() || '1';
          const points = cells[5]?.textContent.trim().replace(/,/g, '') || '111490';
          const playerLink = nameCell.getAttribute('href');
          
          return {
            ranking: parseInt(ranking),
            points: parseInt(points),
            playerUrl: playerLink
          };
        }
      }
      
      return { ranking: 1, points: 111490, playerUrl: null };
    });

    console.log('[안세영] 랭킹 정보:', rankingData);

    let playerData = { recent: [], upcoming: [] };

    // 선수 페이지가 있으면 경기 이력 크롤링
    if (rankingData.playerUrl) {
      const playerPageUrl = 'https://bwf.tournamentsoftware.com' + rankingData.playerUrl;
      console.log('[안세영] 선수 페이지:', playerPageUrl);
      
      await page.goto(playerPageUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      playerData = await page.evaluate(() => {
        const recent = [];
        const matchRows = document.querySelectorAll('table.ruler tr');
        
        for (let i = 1; i < Math.min(matchRows.length, 4); i++) {
          const cells = matchRows[i].querySelectorAll('td');
          if (cells.length < 5) continue;
          
          try {
            const date = cells[0]?.textContent.trim() || '';
            const tournament = cells[1]?.textContent.trim() || '';
            const round = cells[2]?.textContent.trim() || '';
            const opponentText = cells[3]?.textContent.trim() || '';
            const opponent = opponentText.split('(')[0].trim();
            const resultText = cells[4]?.textContent.trim() || '';
            
            let result = '패';
            let score = '';
            
            if (resultText.toLowerCase().includes('won') || resultText.includes('승')) {
              result = '승';
            }
            
            // 스코어 파싱 (21-18, 19-21, 21-8 형식)
            const scoreMatches = resultText.match(/\d+-\d+/g);
            if (scoreMatches && scoreMatches.length > 0) {
              let wonSets = 0;
              let lostSets = 0;
              
              scoreMatches.forEach(set => {
                const [a, b] = set.split('-').map(Number);
                if (a > b) wonSets++;
                else lostSets++;
              });
              
              score = `${wonSets}-${lostSets}`;
            }
            
            if (date && opponent) {
              recent.push({
                date: date,
                tournament: tournament,
                opponent: opponent,
                result: result,
                score: score,
                round: round
              });
            }
          } catch (error) {
            console.error('경기 파싱 오류:', error);
          }
        }
        
        return { recent, upcoming: [] };
      });
    }

    await browser.close();

    // 날짜 형식 변환
    playerData.recent = playerData.recent.map(match => {
      if (match.date.includes('/')) {
        const parts = match.date.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          const fullYear = year.length === 2 ? '20' + year : year;
          match.date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      } else if (match.date.includes('-') && match.date.length === 10) {
        // 이미 YYYY-MM-DD 형식
      } else {
        // 다른 형식 처리
        const currentYear = new Date().getFullYear();
        match.date = `${currentYear}-01-01`;
      }
      return match;
    });

    const ahnSeyoungData = {
      player: '안세영',
      ranking: rankingData.ranking,
      points: rankingData.points,
      recent: playerData.recent,
      upcoming: playerData.upcoming,
      lastUpdated: new Date().toISOString(),
      note: playerData.recent.length === 0 ? '시즌 종료 또는 휴식기' : '',
      source: 'BWF Official (bwfbadminton.com)'
    };

    console.log('[안세영] 성공:', ahnSeyoungData);
    return ahnSeyoungData;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[안세영] 실패:', error.message);
    
    // 실패 시 기존 데이터 유지 또는 기본값 반환
    return {
      player: '안세영',
      ranking: 1,
      points: 111490,
      recent: [
        {
          date: '2025-12-21',
          tournament: 'BWF 투어 파이널',
          opponent: '왕즈이',
          result: '승',
          score: '2-0',
          round: '결승'
        }
      ],
      upcoming: [],
      lastUpdated: new Date().toISOString(),
      error: error.message,
      note: 'BWF 크롤링 실패 - 기본 데이터 사용'
    };
  }
}

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log('\n================================================================================');
    console.log('안세영 데이터 크롤링 시작 (BWF 공식 사이트)');
    console.log('================================================================================\n');

    await fs.mkdir(DATA_DIR, { recursive: true });

    const ahnSeyoungData = await crawlAhnSeyoung();

    const filePath = path.join(DATA_DIR, 'ahn-seyoung-matches.json');
    await fs.writeFile(
      filePath,
      JSON.stringify(ahnSeyoungData, null, 2),
      'utf8'
    );

    console.log('\n================================================================================');
    console.log('크롤링 완료!');
    console.log('파일:', filePath);
    console.log('최근 경기:', ahnSeyoungData.recent.length, '개');
    console.log('랭킹:', ahnSeyoungData.ranking, '위');
    console.log('포인트:', ahnSeyoungData.points);
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\n에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlAhnSeyoung };
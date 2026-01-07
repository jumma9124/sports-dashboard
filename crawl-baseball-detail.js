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

    // 2. 투수 기록 크롤링 (개선: 텍스트 파싱)
    console.log('\n투수 기록 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&tab=pitcher', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    const pitchers = await page.evaluate(() => {
      const result = [];
      
      // 투수 기록 테이블의 각 행을 찾음
      const rows = document.querySelectorAll('li[class*="TableBody_item"], [class*="RecordList"] > li');
      
      rows.forEach((row, index) => {
        if (index >= 10) return;
        
        const text = row.innerText || row.textContent || '';
        
        // "1 위 폰세 한화 평균자책 1.89 경기 29 승 17 패 1..." 형식 파싱
        const match = text.match(/(\d+)\s*(?:위)?\s*(\S+)\s+(\S+)\s+(?:평균자책)?[\s]*([\d.]+)\s+(?:경기)?[\s]*(\d+)\s+(?:승)?[\s]*(\d+)\s+(?:패)?[\s]*(\d+)/);
        
        if (match) {
          result.push({
            rank: parseInt(match[1]),
            name: match[2],
            team: match[3],
            era: match[4],
            games: match[5],
            wins: match[6],
            losses: match[7]
          });
        }
      });
      
      // 방법 2: 테이블 구조에서 직접 추출
      if (result.length === 0) {
        const items = document.querySelectorAll('[class*="TableBody_item"]');
        items.forEach((item, index) => {
          if (index >= 10) return;
          
          // 이름, 팀 찾기
          const nameEl = item.querySelector('[class*="name"], [class*="Name"]');
          const teamEl = item.querySelector('[class*="team"], [class*="Team"]');
          
          // 스탯 값들 추출 - 숫자만 찾기
          const allText = item.innerText || '';
          const numbers = allText.match(/[\d.]+/g) || [];
          
          if (nameEl && numbers.length >= 4) {
            result.push({
              rank: index + 1,
              name: nameEl.textContent.trim(),
              team: teamEl ? teamEl.textContent.trim() : '',
              era: numbers[0] || '',
              games: numbers[1] || '',
              wins: numbers[2] || '',
              losses: numbers[3] || ''
            });
          }
        });
      }
      
      return result;
    });

    data.pitchers = pitchers;
    console.log(`투수: ${pitchers.length}명 수집 완료`);

    // 3. 타자 기록 크롤링 (수정: tab=hitter 사용)
    console.log('\n타자 기록 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&tab=hitter', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    const batters = await page.evaluate(() => {
      const result = [];
      
      // 방법 1: 테이블 형식의 데이터 (타자 기록 섹션)
      const tableRows = document.querySelectorAll('li[class*="TableBody_item"], [class*="RecordList"] > li');
      
      tableRows.forEach((row, index) => {
        if (index >= 10 || result.length >= 10) return;
        
        const text = row.innerText || row.textContent || '';
        
        // "1 위 양의지 두산 타율 0.337 경기 124 타수 453 안타 153 홈런 18 ... 타점 77" 형식 파싱
        const match = text.match(/(\d+)\s*(?:위)?\s*(\S+)\s+(\S+)\s+(?:타율)?[\s]*(0\.\d+)\s+(?:경기)?[\s]*(\d+)\s+(?:타수)?[\s]*(\d+)\s+(?:안타)?[\s]*(\d+)\s+(?:홈런)?[\s]*(\d+)/);
        
        if (match) {
          // 타점 추출 (별도)
          const rbiMatch = text.match(/타점[\s]*(\d+)/);
          
          result.push({
            rank: parseInt(match[1]),
            name: match[2],
            team: match[3],
            avg: match[4],
            games: match[5],
            ab: match[6],
            hits: match[7],
            hr: match[8],
            rbi: rbiMatch ? rbiMatch[1] : ''
          });
        }
      });
      
      // 방법 2: 테이블 구조에서 직접 추출 (셀렉터 기반)
      if (result.length === 0) {
        const items = document.querySelectorAll('[class*="TableBody_item"]');
        items.forEach((item, index) => {
          if (index >= 10) return;
          
          const nameEl = item.querySelector('[class*="name"], [class*="Name"]');
          const teamEl = item.querySelector('[class*="team"], [class*="Team"]');
          
          // 스탯 값들 추출 - 숫자만 찾기
          const allText = item.innerText || '';
          // 0.xxx 형태의 타율과 정수들 추출
          const avgMatch = allText.match(/0\.\d+/);
          const intNumbers = allText.match(/\b\d+\b/g) || [];
          
          if (nameEl && avgMatch && intNumbers.length >= 5) {
            result.push({
              rank: index + 1,
              name: nameEl.textContent.trim(),
              team: teamEl ? teamEl.textContent.trim() : '',
              avg: avgMatch[0],
              games: intNumbers[1] || '',
              ab: intNumbers[2] || '',
              hits: intNumbers[3] || '',
              hr: intNumbers[4] || '',
              rbi: intNumbers[5] || ''
            });
          }
        });
      }
      
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
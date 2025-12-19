/**
 * 네이버 스포츠 주요 이벤트 페이지 크롤링
 * - WBC, 올림픽, 월드컵 등 주요 이벤트 자동 감지 및 크롤링
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * 네이버 이벤트 페이지 존재 여부 확인
 */
async function checkEventPageExists(url) {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    await page.waitForTimeout(2000);
    
    // 페이지가 정상적으로 로드되고, 404가 아닌지 확인
    const isValid = response.status() === 200;
    
    // 실제 콘텐츠가 있는지 확인 (빈 페이지가 아닌지)
    const hasContent = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.length > 100; // 최소 100자 이상이어야 유효한 페이지
    });
    
    return isValid && hasContent;
    
  } catch (error) {
    console.log(`[이벤트 페이지 체크 실패] ${url}: ${error.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

/**
 * 주요 이벤트 크롤링 (네이버 특집 페이지)
 */
async function crawlNaverEventPage(event) {
  console.log(`\n[크롤링 시작] ${event.name}`);
  console.log(`URL: ${event.naverUrl}`);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(event.naverUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.waitForTimeout(5000);
    
    // 이벤트 정보 크롤링
    const eventData = await page.evaluate((eventInfo) => {
      const data = {
        name: eventInfo.name,
        date: eventInfo.date,
        endDate: eventInfo.endDate,
        icon: eventInfo.icon,
        isActive: true, // 페이지가 존재하면 진행 중
        lastUpdated: new Date().toISOString()
      };
      
      // 메달 순위 크롤링 (올림픽인 경우)
      if (eventInfo.name.includes('올림픽')) {
        const medalTable = document.querySelector('.medal_table, .ranking_table');
        if (medalTable) {
          data.medals = {
            korea: {
              gold: 0,
              silver: 0,
              bronze: 0,
              total: 0,
              rank: '-'
            }
          };
          
          // 한국 메달 정보 추출 로직
          const rows = medalTable.querySelectorAll('tr');
          rows.forEach(row => {
            const country = row.querySelector('.country, .team_name');
            if (country && country.textContent.includes('한국')) {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 4) {
                data.medals.korea.gold = parseInt(cells[1].textContent) || 0;
                data.medals.korea.silver = parseInt(cells[2].textContent) || 0;
                data.medals.korea.bronze = parseInt(cells[3].textContent) || 0;
                data.medals.korea.total = parseInt(cells[4].textContent) || 0;
                data.medals.korea.rank = cells[0].textContent.trim();
              }
            }
          });
        }
      }
      
      // 경기 일정 크롤링 (WBC, 월드컵인 경우)
      if (eventInfo.name.includes('WBC') || eventInfo.name.includes('월드컵')) {
        data.schedule = [];
        
        const scheduleItems = document.querySelectorAll('.schedule_item, .match_item, .game_item');
        scheduleItems.forEach((item, index) => {
          if (index < 5) { // 최대 5경기만
            const dateEl = item.querySelector('.date, .match_date');
            const teamEl = item.querySelector('.team, .opponent');
            const timeEl = item.querySelector('.time, .match_time');
            
            if (dateEl && teamEl) {
              data.schedule.push({
                date: dateEl.textContent.trim(),
                opponent: teamEl.textContent.trim(),
                time: timeEl ? timeEl.textContent.trim() : ''
              });
            }
          }
        });
      }
      
      return data;
      
    }, event);
    
    console.log(`[크롤링 성공] ${event.name}`);
    return eventData;
    
  } catch (error) {
    console.error(`[크롤링 실패] ${event.name}:`, error.message);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * 이벤트 진행 상태 확인 및 크롤링
 */
async function checkAndCrawlEvents() {
  console.log('\n================================================================================');
  console.log('네이버 스포츠 주요 이벤트 크롤링 시작');
  console.log('================================================================================\n');
  
  // major-events.json 읽기
  const eventsPath = path.join(__dirname, 'public', 'data', 'major-events.json');
  const eventsData = JSON.parse(await fs.readFile(eventsPath, 'utf-8'));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const results = [];
  
  for (const event of eventsData) {
    const startDate = new Date(event.date);
    const endDate = new Date(event.endDate);
    
    // D-7 체크 (이벤트 7일 전부터 페이지 확인)
    const daysUntilStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
    const isBeforeEvent = daysUntilStart <= 7 && daysUntilStart >= 0;
    const isDuringEvent = today >= startDate && today <= endDate;
    
    console.log(`\n[${event.name}]`);
    console.log(`시작: ${event.date}, 종료: ${event.endDate}`);
    console.log(`D-${daysUntilStart > 0 ? daysUntilStart : 'day'}`);
    console.log(`진행 중: ${isDuringEvent ? 'YES' : 'NO'}`);
    
    if (isBeforeEvent || isDuringEvent) {
      // 네이버 페이지 존재 여부 확인
      if (event.naverUrl) {
        console.log(`네이버 페이지 확인 중...`);
        const pageExists = await checkEventPageExists(event.naverUrl);
        
        if (pageExists) {
          console.log(`✅ 네이버 특집 페이지 발견! 크롤링 시작...`);
          const crawledData = await crawlNaverEventPage(event);
          
          if (crawledData) {
            results.push(crawledData);
          }
        } else {
          console.log(`⏳ 네이버 특집 페이지 아직 없음 (기본 정보 사용)`);
          results.push({
            ...event,
            isActive: false,
            lastUpdated: new Date().toISOString()
          });
        }
      } else {
        // naverUrl이 없으면 기본 정보만 사용
        results.push({
          ...event,
          isActive: false,
          lastUpdated: new Date().toISOString()
        });
      }
    } else {
      console.log(`⏸️  이벤트 기간 아님 (기본 정보 사용)`);
      results.push({
        ...event,
        isActive: false,
        lastUpdated: new Date().toISOString()
      });
    }
    
    // 다음 이벤트 확인 전 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 결과 저장
  const outputPath = path.join(__dirname, 'public', 'data', 'major-events-updated.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  
  console.log('\n================================================================================');
  console.log(`✅ 크롤링 완료! 결과 저장: ${outputPath}`);
  console.log('================================================================================\n');
  
  return results;
}

/**
 * 메인 실행
 */
async function main() {
  try {
    await checkAndCrawlEvents();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 크롤링 중 오류 발생:', error);
    process.exit(1);
  }
}

// 직접 실행 시
if (require.main === module) {
  main();
}

module.exports = { checkAndCrawlEvents, crawlNaverEventPage, checkEventPageExists };

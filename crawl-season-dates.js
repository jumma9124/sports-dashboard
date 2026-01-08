// crawl-season-dates.js
// 시즌 시작/종료 날짜 자동 크롤링

const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'season-config.json');

// 브라우저 실행 옵션
function getLaunchOptions() {
  const options = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    timeout: 60000
  };
  
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else {
    options.executablePath = '/usr/bin/chromium-browser';
  }
  
  return options;
}

// 현재 시즌 설정 로드
async function loadSeasonConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('시즌 설정 파일 없음, 새로 생성');
    return {
      volleyball: { name: 'V-리그', seasons: {}, crawlMonth: 9, crawlUrl: 'https://www.kovo.co.kr' },
      baseball: { name: 'KBO 리그', seasons: {}, crawlMonth: 2, crawlUrl: 'https://www.koreabaseball.com' },
      lastUpdated: null
    };
  }
}

// 시즌 설정 저장
async function saveSeasonConfig(config) {
  config.lastUpdated = new Date().toISOString();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  console.log('시즌 설정 저장 완료:', CONFIG_PATH);
}

// 야구 시즌 날짜 크롤링 (KBO 공식 사이트)
async function crawlBaseballSeasonDates(browser) {
  try {
    console.log('[야구] 시즌 날짜 크롤링...');
    const page = await browser.newPage();
    
    // KBO 일정 페이지
    const url = 'https://www.koreabaseball.com/Schedule/Schedule.aspx';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const dates = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      
      // "개막일: 2026.03.28" 형식 찾기
      const openingMatch = bodyText.match(/개막[일]?\s*[:\s]*(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
      
      // "정규시즌 종료: 2026.10.13" 형식 찾기
      const closingMatch = bodyText.match(/정규시즌\s*종료\s*[:\s]*(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
      
      let start = null;
      let end = null;
      
      if (openingMatch) {
        start = `${openingMatch[1]}-${openingMatch[2].padStart(2, '0')}-${openingMatch[3].padStart(2, '0')}`;
      }
      
      if (closingMatch) {
        end = `${closingMatch[1]}-${closingMatch[2].padStart(2, '0')}-${closingMatch[3].padStart(2, '0')}`;
      }
      
      return { start, end };
    });
    
    await page.close();
    
    if (dates.start || dates.end) {
      console.log('[야구] 시즌 날짜:', dates);
      return dates;
    }
    
    console.log('[야구] 시즌 날짜를 찾지 못함, 기본값 사용');
    return null;
    
  } catch (error) {
    console.error('[야구] 시즌 날짜 크롤링 실패:', error.message);
    return null;
  }
}

// 배구 시즌 날짜 크롤링 (KOVO 공식 사이트)
async function crawlVolleyballSeasonDates(browser) {
  try {
    console.log('[배구] 시즌 날짜 크롤링...');
    const page = await browser.newPage();
    
    // KOVO 일정 페이지
    const url = 'https://www.kovo.co.kr/game/v-league/11110_schedule.asp';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const dates = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      
      // "2025-26시즌" 또는 "25-26시즌" 형식에서 시즌 정보 추출
      const seasonMatch = bodyText.match(/(\d{2,4})[-~](\d{2})\s*시즌/);
      
      // 개막일 찾기
      const openingMatch = bodyText.match(/개막[일]?\s*[:\s]*(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
      
      let start = null;
      let end = null;
      
      if (openingMatch) {
        start = `${openingMatch[1]}-${openingMatch[2].padStart(2, '0')}-${openingMatch[3].padStart(2, '0')}`;
      }
      
      return { start, end, seasonMatch: seasonMatch ? seasonMatch[0] : null };
    });
    
    await page.close();
    
    if (dates.start) {
      console.log('[배구] 시즌 날짜:', dates);
      return dates;
    }
    
    console.log('[배구] 시즌 날짜를 찾지 못함, 기본값 사용');
    return null;
    
  } catch (error) {
    console.error('[배구] 시즌 날짜 크롤링 실패:', error.message);
    return null;
  }
}

// 메인 함수
async function main() {
  let browser;
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📅 시즌 날짜 자동 업데이트 시작');
    console.log('='.repeat(60) + '\n');
    
    const config = await loadSeasonConfig();
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    browser = await puppeteer.launch(getLaunchOptions());
    
    // 2월: 야구 시즌 날짜 업데이트
    if (currentMonth === 2 || currentMonth === 3) {
      console.log('🔄 야구 시즌 날짜 업데이트 중...');
      const baseballDates = await crawlBaseballSeasonDates(browser);
      
      if (baseballDates) {
        const seasonKey = String(currentYear);
        if (!config.baseball.seasons[seasonKey]) {
          config.baseball.seasons[seasonKey] = {};
        }
        
        if (baseballDates.start) {
          config.baseball.seasons[seasonKey].start = baseballDates.start;
        }
        if (baseballDates.end) {
          config.baseball.seasons[seasonKey].end = baseballDates.end;
        }
        config.baseball.seasons[seasonKey].confirmed = true;
        
        console.log(`✅ 야구 ${seasonKey} 시즌 날짜 업데이트 완료`);
      }
    }
    
    // 9월: 배구 시즌 날짜 업데이트
    if (currentMonth === 9 || currentMonth === 10) {
      console.log('🔄 배구 시즌 날짜 업데이트 중...');
      const volleyballDates = await crawlVolleyballSeasonDates(browser);
      
      if (volleyballDates) {
        // 배구는 25-26 형식의 시즌 키 사용
        const seasonKey = `${currentYear}-${(currentYear + 1) % 100}`;
        if (!config.volleyball.seasons[seasonKey]) {
          config.volleyball.seasons[seasonKey] = {};
        }
        
        if (volleyballDates.start) {
          config.volleyball.seasons[seasonKey].start = volleyballDates.start;
        }
        // 배구 시즌 종료는 보통 4월 (다음 해)
        if (!config.volleyball.seasons[seasonKey].end) {
          config.volleyball.seasons[seasonKey].end = `${currentYear + 1}-04-15`;
        }
        config.volleyball.seasons[seasonKey].confirmed = true;
        
        console.log(`✅ 배구 ${seasonKey} 시즌 날짜 업데이트 완료`);
      }
    }
    
    await browser.close();
    await saveSeasonConfig(config);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 시즌 날짜 업데이트 완료');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    if (browser) await browser.close();
    console.error('❌ 에러:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlBaseballSeasonDates, crawlVolleyballSeasonDates };


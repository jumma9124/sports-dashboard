const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Wikipedia에서 주요 국제 대회 일정 크롤링
async function crawlMajorEvents() {
  console.log('🌍 국제 대회 일정 크롤링 시작...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const events = [];
  
  // Wikipedia 페이지 목록
  const wikiPages = [
    {
      url: 'https://en.wikipedia.org/wiki/2026_Winter_Olympics',
      type: 'olympics-winter',
      title: '동계올림픽',
      emoji: '⛷️'
    },
    {
      url: 'https://en.wikipedia.org/wiki/2028_Summer_Olympics',
      type: 'olympics-summer',
      title: '하계올림픽',
      emoji: '🏃'
    },
    {
      url: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup',
      type: 'worldcup',
      title: 'FIFA 월드컵',
      emoji: '⚽'
    },
    {
      url: 'https://en.wikipedia.org/wiki/2026_Asian_Games',
      type: 'asian-games',
      title: '아시안게임',
      emoji: '🏅'
    }
  ];
  
  for (const wiki of wikiPages) {
    try {
      console.log(`📖 크롤링 중: ${wiki.title}`);
      await page.goto(wiki.url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await page.waitForTimeout(2000);
      
      const eventData = await page.evaluate((wikiInfo) => {
        // Infobox에서 날짜 정보 추출
        const infobox = document.querySelector('.infobox');
        if (!infobox) return null;
        
        // 다양한 패턴으로 날짜 찾기
        const rows = infobox.querySelectorAll('tr');
        let startDate = null;
        let endDate = null;
        let location = '';
        let fullTitle = '';
        
        // 제목 추출
        const titleElement = document.querySelector('h1.firstHeading');
        if (titleElement) {
          fullTitle = titleElement.textContent.trim();
        }
        
        for (const row of rows) {
          const header = row.querySelector('th');
          const data = row.querySelector('td');
          
          if (!header || !data) continue;
          
          const headerText = header.textContent.toLowerCase();
          const dataText = data.textContent.trim();
          
          // 개막일 찾기
          if (headerText.includes('opening') || headerText.includes('dates')) {
            // 날짜 패턴: "6 February – 22 February 2026"
            const dateMatch = dataText.match(/(\d{1,2})\s+([A-Za-z]+)\s*(?:–|-)?\s*(\d{1,2})?\s*([A-Za-z]+)?\s*(\d{4})/);
            if (dateMatch) {
              const monthMap = {
                january: '01', february: '02', march: '03', april: '04',
                may: '05', june: '06', july: '07', august: '08',
                september: '09', october: '10', november: '11', december: '12'
              };
              
              const startDay = dateMatch[1].padStart(2, '0');
              const startMonth = monthMap[dateMatch[2].toLowerCase()];
              const year = dateMatch[5];
              
              if (startMonth && year) {
                startDate = `${year}-${startMonth}-${startDay}`;
                
                // 종료일
                if (dateMatch[3] && dateMatch[4]) {
                  const endDay = dateMatch[3].padStart(2, '0');
                  const endMonth = monthMap[dateMatch[4].toLowerCase()];
                  if (endMonth) {
                    endDate = `${year}-${endMonth}-${endDay}`;
                  }
                }
              }
            }
          }
          
          // 장소 찾기
          if (headerText.includes('host') || headerText.includes('location')) {
            location = dataText.split('\n')[0].trim();
          }
        }
        
        return {
          startDate,
          endDate,
          location,
          fullTitle
        };
      }, wiki);
      
      if (eventData && eventData.startDate) {
        events.push({
          id: `${wiki.type}-${eventData.startDate.substring(0, 4)}`,
          type: wiki.type,
          title: eventData.fullTitle || wiki.title,
          emoji: wiki.emoji,
          startDate: eventData.startDate,
          endDate: eventData.endDate || eventData.startDate,
          location: eventData.location,
          source: 'wikipedia',
          crawledAt: new Date().toISOString()
        });
        
        console.log(`✅ ${wiki.title}: ${eventData.startDate} ~ ${eventData.endDate}`);
      } else {
        console.log(`⚠️ ${wiki.title}: 날짜 정보를 찾지 못했습니다.`);
        
        // 폴백: 하드코딩된 날짜
        const fallbackDates = {
          'olympics-winter': { start: '2026-02-06', end: '2026-02-22', location: 'Milan-Cortina, Italy' },
          'olympics-summer': { start: '2028-07-21', end: '2028-08-06', location: 'Los Angeles, USA' },
          'worldcup': { start: '2026-06-11', end: '2026-07-19', location: 'USA, Canada, Mexico' },
          'asian-games': { start: '2026-09-19', end: '2026-10-04', location: 'Nagoya, Japan' }
        };
        
        if (fallbackDates[wiki.type]) {
          events.push({
            id: `${wiki.type}-${fallbackDates[wiki.type].start.substring(0, 4)}`,
            type: wiki.type,
            title: wiki.title,
            emoji: wiki.emoji,
            startDate: fallbackDates[wiki.type].start,
            endDate: fallbackDates[wiki.type].end,
            location: fallbackDates[wiki.type].location,
            source: 'fallback',
            crawledAt: new Date().toISOString()
          });
          console.log(`📊 ${wiki.title}: 폴백 데이터 사용`);
        }
      }
      
    } catch (error) {
      console.error(`❌ ${wiki.title} 크롤링 실패:`, error.message);
    }
  }
  
  await browser.close();
  
  // 결과 저장
  const result = {
    lastUpdated: new Date().toISOString(),
    events: events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
  };
  
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const outputPath = path.join(dataDir, 'major-events.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  
  console.log('✅ 국제 대회 일정 크롤링 완료!');
  console.log(`📁 저장 위치: ${outputPath}`);
  console.log(JSON.stringify(result, null, 2));
}

// 실행
crawlMajorEvents().catch(console.error);

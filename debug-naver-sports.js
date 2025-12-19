const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function debugNaverSports() {
  let browser;
  try {
    console.log('🔍 네이버 스포츠 페이지 구조 분석 시작...\n');
    
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

    // 페이지 로딩 대기
    await page.waitForTimeout(5000);

    // 스크린샷 저장
    await page.screenshot({ path: 'volleyball-ranking.png', fullPage: true });
    console.log('✅ 스크린샷 저장: volleyball-ranking.png\n');

    // HTML 전체 저장
    const html = await page.content();
    await fs.writeFile('volleyball-page.html', html, 'utf8');
    console.log('✅ HTML 저장: volleyball-page.html\n');

    // 페이지 구조 분석
    const analysis = await page.evaluate(() => {
      const result = {
        title: document.title,
        tables: [],
        teamNames: [],
        possibleSelectors: []
      };

      // 모든 테이블 찾기
      const tables = document.querySelectorAll('table');
      console.log('테이블 개수:', tables.length);
      
      tables.forEach((table, index) => {
        const rows = table.querySelectorAll('tr');
        result.tables.push({
          index: index,
          rows: rows.length,
          preview: table.textContent.substring(0, 200)
        });
      });

      // "현대캐피탈" 텍스트가 있는 모든 요소 찾기
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const text = el.textContent;
        if (text && (text.includes('현대캐피탈') || text.includes('스카이워커스'))) {
          result.teamNames.push({
            tag: el.tagName,
            className: el.className,
            text: text.substring(0, 100)
          });
        }
      });

      // 가능한 셀렉터들
      result.possibleSelectors = [
        { 
          selector: 'table tbody tr',
          count: document.querySelectorAll('table tbody tr').length 
        },
        { 
          selector: '.RecordTable_row__2xOV4',
          count: document.querySelectorAll('.RecordTable_row__2xOV4').length 
        },
        { 
          selector: '[class*="RecordTable"]',
          count: document.querySelectorAll('[class*="RecordTable"]').length 
        },
        { 
          selector: '[class*="record"]',
          count: document.querySelectorAll('[class*="record"]').length 
        }
      ];

      return result;
    });

    console.log('='.repeat(80));
    console.log('📊 페이지 분석 결과:');
    console.log('='.repeat(80));
    console.log('\n제목:', analysis.title);
    console.log('\n테이블 개수:', analysis.tables.length);
    
    analysis.tables.forEach((table, i) => {
      console.log(`\n[테이블 ${i + 1}]`);
      console.log('  행 개수:', table.rows);
      console.log('  미리보기:', table.preview.substring(0, 150).replace(/\n/g, ' '));
    });

    console.log('\n' + '='.repeat(80));
    console.log('🏐 현대캐피탈 관련 요소:');
    console.log('='.repeat(80));
    analysis.teamNames.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.tag}.${item.className}`);
      console.log('   텍스트:', item.text);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🎯 가능한 셀렉터:');
    console.log('='.repeat(80));
    analysis.possibleSelectors.forEach(s => {
      console.log(`${s.selector} → ${s.count}개`);
    });

    // 실제 테이블 데이터 샘플 추출
    console.log('\n' + '='.repeat(80));
    console.log('📋 테이블 데이터 샘플 (첫 3행):');
    console.log('='.repeat(80));
    
    const sampleData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const samples = [];
      
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const cells = rows[i].querySelectorAll('td, th');
        const rowData = [];
        cells.forEach(cell => {
          rowData.push(cell.textContent.trim());
        });
        samples.push(rowData);
      }
      
      return samples;
    });

    sampleData.forEach((row, i) => {
      console.log(`\n행 ${i + 1}:`, row.join(' | '));
    });

    await browser.close();
    console.log('\n✅ 분석 완료!\n');

  } catch (error) {
    if (browser) await browser.close();
    console.error('❌ 에러:', error.message);
  }
}

debugNaverSports();

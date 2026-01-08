// crawl-all.js
// 모든 스포츠 데이터 통합 크롤링

const fs = require('fs').promises;
const path = require('path');

const { crawlVolleyball } = require('./crawl-volleyball');
const { crawlBaseball } = require('./crawl-baseball');

const DATA_DIR = path.join(__dirname, 'public', 'data');

async function main() {
  try {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(60));
    console.log('⚡ 스포츠 데이터 통합 크롤링 시작');
    console.log('='.repeat(60) + '\n');

    await fs.mkdir(DATA_DIR, { recursive: true });

    // 배구, 야구 병렬 크롤링
    const [volleyball, baseball] = await Promise.all([
      crawlVolleyball().catch(err => {
        console.error('[배구] 크롤링 실패:', err.message);
        return {
          sport: '배구',
          team: '현대캐피탈 스카이워커스',
          league: 'V-리그',
          rank: '-',
          record: '크롤링 실패',
          error: err.message,
          lastUpdated: new Date().toISOString()
        };
      }),
      crawlBaseball().catch(err => {
        console.error('[야구] 크롤링 실패:', err.message);
        return {
          sport: '야구',
          team: '한화 이글스',
          league: 'KBO',
          rank: '-',
          record: '크롤링 실패',
          error: err.message,
          lastUpdated: new Date().toISOString()
        };
      })
    ]);

    // 메인 데이터 저장
    const sportsData = {
      volleyball,
      baseball,
      lastUpdated: new Date().toISOString()
    };

    const filePath = path.join(DATA_DIR, 'sports.json');
    await fs.writeFile(filePath, JSON.stringify(sportsData, null, 2), 'utf8');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`✅ 크롤링 완료! (총 ${elapsed}초)`);
    console.log('저장된 파일:');
    console.log('  - sports.json (메인 페이지용)');
    console.log('  - volleyball-detail.json (배구 상세 페이지용)');
    console.log('  - baseball-detail.json (야구 상세 페이지용)');
    console.log('='.repeat(60) + '\n');

    // 결과 요약
    console.log('📊 크롤링 결과 요약:');
    console.log(`  🏐 배구: ${volleyball.rank} (${volleyball.record})`);
    console.log(`  ⚾ 야구: ${baseball.rank} (${baseball.record})`);

  } catch (error) {
    console.error('\n❌ 에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };


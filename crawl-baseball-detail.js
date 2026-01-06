const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

/**
 * 한화 이글스 상세 정보 크롤링
 */
async function crawlBaseballDetail() {
  let browser;
  try {
    console.log('⚾ [야구 상세] 크롤링 시작...');
    
    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }
    
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // 1. 전체 순위 크롤링 (모바일 최신 버전)
    console.log('[순위] 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&tab=teamRank', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    const standings = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const result = [];
      
      rows.forEach(row => {
        const rankTd = row.querySelector('td:nth-child(1)');
        const teamTd = row.querySelector('td:nth-child(2)');
        const winsTd = row.querySelector('td:nth-child(3)');
        const lossesTd = row.querySelector('td:nth-child(4)');
        const drawsTd = row.querySelector('td:nth-child(5)');
        const winRateTd = row.querySelector('td:nth-child(6)');
        const gameDiffTd = row.querySelector('td:nth-child(7)');
        
        if (rankTd && teamTd) {
          const rank = rankTd.textContent.trim();
          const team = teamTd.textContent.trim();
          const wins = winsTd?.textContent.trim();
          const losses = lossesTd?.textContent.trim();
          const draws = drawsTd?.textContent.trim();
          const winRate = winRateTd?.textContent.trim();
          const gameDiff = gameDiffTd?.textContent.trim();
          
          result.push({
            rank: parseInt(rank) || 0,
            team,
            wins: parseInt(wins) || 0,
            losses: parseInt(losses) || 0,
            draws: parseInt(draws) || 0,
            winRate: winRate || '.000',
            gameDiff: gameDiff || '-'
          });
        }
      });
      
      return result;
    });

    console.log(`[순위] ${standings.length}개 팀 크롤링 완료`);

    // 한화 이글스 정보 추출
    const hanwhaStanding = standings.find(t => t.team === '한화');
    
    if (!hanwhaStanding) {
      console.warn('[경고] 한화 이글스 순위를 찾을 수 없습니다');
    }

    // 2. 한화 선수 명단 크롤링 (KBO 공식)
    console.log('[선수] 크롤링 중...');
    await page.goto('https://www.koreabaseball.com/Player/RegisterAll.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    const players = await page.evaluate(() => {
      const result = [];
      
      // 한화 선수 찾기
      const teamHeaders = document.querySelectorAll('h3.tit');
      let hanwhaTable = null;
      
      for (const header of teamHeaders) {
        if (header.textContent.includes('한화')) {
          hanwhaTable = header.nextElementSibling;
          break;
        }
      }
      
      if (!hanwhaTable) return result;
      
      const rows = hanwhaTable.querySelectorAll('tbody tr');
      
      rows.forEach(row => {
        const backNumber = row.querySelector('td:nth-child(1)')?.textContent.trim();
        const name = row.querySelector('td:nth-child(2)')?.textContent.trim();
        const position = row.querySelector('td:nth-child(3)')?.textContent.trim();
        
        if (name) {
          let positionType = '외야수';
          
          if (position) {
            if (position.includes('투수')) positionType = '투수';
            else if (position.includes('포수')) positionType = '포수';
            else if (['내야수', '1루수', '2루수', '3루수', '유격수'].some(p => position.includes(p))) {
              positionType = '내야수';
            } else if (position.includes('외야수')) {
              positionType = '외야수';
            }
          }
          
          result.push({
            backNumber: backNumber || '-',
            name,
            position: positionType,
            // 기록은 나중에 추가 크롤링 필요
            wins: 0,
            losses: 0,
            era: '-',
            avg: '.000',
            hits: 0
          });
        }
      });
      
      return result;
    });

    console.log(`[선수] ${players.length}명 크롤링 완료`);

    // 3. 선수 기록 크롤링 (네이버 스포츠)
    if (players.length > 0) {
      console.log('[기록] 선수 기록 크롤링 중...');
      
      // 투수 기록
      await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&category=pitcher&tab=player&teamId=6', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.waitForTimeout(2000);

      const pitcherStats = await page.evaluate(() => {
        const stats = {};
        const rows = document.querySelectorAll('table tbody tr');
        
        rows.forEach(row => {
          const name = row.querySelector('td:nth-child(2)')?.textContent.trim();
          const wins = row.querySelector('td:nth-child(5)')?.textContent.trim();
          const losses = row.querySelector('td:nth-child(6)')?.textContent.trim();
          const era = row.querySelector('td:nth-child(8)')?.textContent.trim();
          
          if (name) {
            stats[name] = {
              wins: parseInt(wins) || 0,
              losses: parseInt(losses) || 0,
              era: era || '-'
            };
          }
        });
        
        return stats;
      });

      // 타자 기록
      await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&category=hitter&tab=player&teamId=6', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.waitForTimeout(2000);

      const hitterStats = await page.evaluate(() => {
        const stats = {};
        const rows = document.querySelectorAll('table tbody tr');
        
        rows.forEach(row => {
          const name = row.querySelector('td:nth-child(2)')?.textContent.trim();
          const avg = row.querySelector('td:nth-child(4)')?.textContent.trim();
          const hits = row.querySelector('td:nth-child(6)')?.textContent.trim();
          
          if (name) {
            stats[name] = {
              avg: avg || '.000',
              hits: parseInt(hits) || 0
            };
          }
        });
        
        return stats;
      });

      // 선수 기록 병합
      players.forEach(player => {
        if (player.position === '투수' && pitcherStats[player.name]) {
          Object.assign(player, pitcherStats[player.name]);
        } else if (hitterStats[player.name]) {
          Object.assign(player, hitterStats[player.name]);
        }
      });

      console.log('[기록] 선수 기록 크롤링 완료');
    }

    await browser.close();

    // 데이터 조합
    const detailData = {
      teamInfo: hanwhaStanding || {
        rank: 0,
        team: '한화',
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: '.000',
        gameDiff: '-'
      },
      players: players.sort((a, b) => {
        const order = { '투수': 1, '포수': 2, '내야수': 3, '외야수': 4 };
        return (order[a.position] || 5) - (order[b.position] || 5);
      }),
      leagueStandings: standings,
      lastUpdated: new Date().toISOString()
    };

    console.log('[성공] 야구 상세 데이터 크롤링 완료');
    return detailData;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[실패] 야구 상세 크롤링 오류:', error.message);
    
    // 폴백 데이터
    return {
      teamInfo: {
        rank: 0,
        team: '한화',
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: '.000',
        gameDiff: '-'
      },
      players: [],
      leagueStandings: [],
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * 메인 실행
 */
async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('야구 상세 데이터 크롤링 시작');
    console.log('='.repeat(80) + '\n');

    await fs.mkdir(DATA_DIR, { recursive: true });

    const detailData = await crawlBaseballDetail();

    const filePath = path.join(DATA_DIR, 'baseball-detail.json');
    await fs.writeFile(filePath, JSON.stringify(detailData, null, 2), 'utf8');

    console.log('\n' + '='.repeat(80));
    console.log('크롤링 완료!');
    console.log('파일:', filePath);
    console.log('팀 순위:', detailData.teamInfo.rank + '위');
    console.log('선수 수:', detailData.players.length + '명');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlBaseballDetail };
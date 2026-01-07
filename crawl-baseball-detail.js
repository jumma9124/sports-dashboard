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
    await new Promise(resolve => setTimeout(resolve, 2000));

    const standings = await page.evaluate(() => {
      // 첫 번째 테이블만 선택 (팀 순위)
      const firstTable = document.querySelector('.TeamRanking_team_ranking__RxzeY .TableBody_table_body__DlwwS');
      if (!firstTable) return [];
      
      const items = firstTable.querySelectorAll('li.TableBody_item__eCenH');
      const result = [];
      
      items.forEach(item => {
        const rankEm = item.querySelector('.TeamInfo_ranking__MqHpq');
        const teamDiv = item.querySelector('.TeamInfo_team_name__dni7F');
        const cells = item.querySelectorAll('.TableBody_cell__rFrpm .TextInfo_text__ysEqh');
        
        if (rankEm && teamDiv && cells.length >= 6) {
          const rankText = rankEm.textContent.trim();
          const rank = parseInt(rankText.replace(/[^0-9]/g, ''));
          const team = teamDiv.textContent.trim();
          
          // cells 순서: 승률, 게임차, 승, 무, 패, 경기, ...
          const winRate = cells[0]?.textContent.trim() || '.000';
          const gameDiff = cells[1]?.textContent.trim() || '0';
          const wins = cells[2]?.textContent.trim() || '0';
          const draws = cells[3]?.textContent.trim() || '0';
          const losses = cells[4]?.textContent.trim() || '0';
          
          result.push({
            rank: rank || 0,
            team,
            wins: parseInt(wins) || 0,
            losses: parseInt(losses) || 0,
            draws: parseInt(draws) || 0,
            winRate: winRate,
            gameDiff: gameDiff
          });
        }
      });
      
      return result;
    });

    console.log(`[순위] ${standings.length}개 팀 크롤링 완료`);

    // 2. 한화 선수 기록 크롤링 (투수)
    console.log('[기록] 투수 기록 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&category=pitcher&tab=player&teamId=6', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pitchers = await page.evaluate(() => {
      const items = document.querySelectorAll('.TableBody_item__eCenH');
      const result = [];
      
      items.forEach(item => {
        const nameDiv = item.querySelector('.PlayerInfo_player_name__m+tSp');
        const cells = item.querySelectorAll('.TableBody_cell__rFrpm .TextInfo_text__ysEqh');
        
        if (nameDiv && cells.length >= 3) {
          const name = nameDiv.textContent.trim();
          const wins = cells[1]?.textContent.trim() || '0';
          const losses = cells[2]?.textContent.trim() || '0';
          const era = cells[3]?.textContent.trim() || '0.00';
          
          result.push({
            name,
            position: '투수',
            wins: parseInt(wins) || 0,
            losses: parseInt(losses) || 0,
            era: era,
            avg: '-',
            hits: '-'
          });
        }
      });
      
      return result;
    });

    console.log(`[기록] 투수 ${pitchers.length}명 크롤링 완료`);

    // 3. 한화 선수 기록 크롤링 (타자)
    console.log('[기록] 타자 기록 크롤링 중...');
    await page.goto('https://m.sports.naver.com/kbaseball/record/kbo?seasonCode=2025&category=hitter&tab=player&teamId=6', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const hitters = await page.evaluate(() => {
      const items = document.querySelectorAll('.TableBody_item__eCenH');
      const result = [];
      
      items.forEach(item => {
        const nameDiv = item.querySelector('.PlayerInfo_player_name__m+tSp');
        const cells = item.querySelectorAll('.TableBody_cell__rFrpm .TextInfo_text__ysEqh');
        
        if (nameDiv && cells.length >= 2) {
          const name = nameDiv.textContent.trim();
          const avg = cells[1]?.textContent.trim() || '.000';
          const hits = cells[2]?.textContent.trim() || '0';
          
          result.push({
            name,
            position: '타자',
            wins: '-',
            losses: '-',
            era: '-',
            avg: avg,
            hits: parseInt(hits) || 0
          });
        }
      });
      
      return result;
    });

    console.log(`[기록] 타자 ${hitters.length}명 크롤링 완료`);

    // 선수 합치기
    const players = [...pitchers, ...hitters];


    // 4. 상대전적 크롤링 (임시로 빈 배열)
    console.log('[상대전적] 크롤링 중...');
    const headToHead = [];
    console.log(`[상대전적] ${headToHead.length}개 팀 크롤링 완료`);

    // 5. 지난주 경기결과 크롤링 (임시로 빈 배열)
    console.log('[경기결과] 크롤링 중...');
    const lastWeekMatches = [];
    console.log(`[경기결과] ${lastWeekMatches.length}경기 크롤링 완료`);

    await browser.close();

    // 데이터 조합
    const detailData = {
      leagueStandings: standings,
      players: players.sort((a, b) => {
        const order = { '투수': 1, '포수': 2, '내야수': 3, '외야수': 4 };
        return (order[a.position] || 5) - (order[b.position] || 5);
      }),
      headToHead: headToHead,
      lastWeekMatches: lastWeekMatches.map(m => ({
        ...m,
        date: new Date(m.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
      })),
      lastUpdated: new Date().toISOString()
    };

    console.log('[성공] 야구 상세 데이터 크롤링 완료');
    return detailData;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[실패] 야구 상세 크롤링 오류:', error.message);
    
    // 폴백 데이터
    return {
      leagueStandings: [],
      players: [],
      headToHead: [],
      lastWeekMatches: [],
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
    const hanwha = detailData.leagueStandings.find(t => t.team === '한화');
    console.log('한화 순위:', hanwha ? hanwha.rank + '위' : '정보 없음');
    console.log('선수 수:', detailData.players.length + '명');
    console.log('상대전적:', detailData.headToHead.length + '개 팀');
    console.log('지난주 경기:', detailData.lastWeekMatches.length + '경기');
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
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// 데이터 저장 경로
const DATA_DIR = path.join(__dirname, 'public', 'data');

/**
 * 네이버 스포츠에서 안세영 경기 데이터 크롤링
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
    
    // 네이버 스포츠 배드민턴 - 안세영 선수 페이지
    const url = 'https://m.sports.naver.com/badminton/player/result/index?id=26418';
    console.log('[안세영] URL:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForTimeout(3000);

    const playerData = await page.evaluate(() => {
      const recent = [];
      const upcoming = [];
      
      // 최근 경기 크롤링
      const matchItems = document.querySelectorAll('.MatchBoxPlayerResult_match_item__3F7Jk');
      
      for (let i = 0; i < Math.min(matchItems.length, 3); i++) {
        const item = matchItems[i];
        
        try {
          // 날짜
          const dateEl = item.querySelector('.MatchBoxPlayerResult_date__1I_UD');
          const dateText = dateEl ? dateEl.textContent.trim() : '';
          
          // 대회명
          const tournamentEl = item.querySelector('.MatchBoxPlayerResult_competition__2Smhn');
          const tournament = tournamentEl ? tournamentEl.textContent.trim() : '';
          
          // 상대
          const opponentEl = item.querySelector('.MatchBoxPlayerResult_name__nP5J_');
          const opponent = opponentEl ? opponentEl.textContent.trim() : '';
          
          // 결과 (승/패)
          const resultEl = item.querySelector('.MatchBoxPlayerResult_result__1q_FH');
          const resultText = resultEl ? resultEl.textContent.trim() : '';
          const result = resultText.includes('승') ? '승' : '패';
          
          // 스코어
          const scoreEls = item.querySelectorAll('.MatchBoxPlayerResult_score__1XK0b');
          let score = '';
          if (scoreEls.length >= 2) {
            const myScore = scoreEls[0].textContent.trim();
            const oppScore = scoreEls[1].textContent.trim();
            score = `${myScore}-${oppScore}`;
          }
          
          // 라운드
          const roundEl = item.querySelector('.MatchBoxPlayerResult_round__2YyLw');
          const round = roundEl ? roundEl.textContent.trim() : '';
          
          if (dateText && opponent) {
            recent.push({
              date: dateText,
              tournament: tournament,
              opponent: opponent,
              result: result,
              score: score,
              round: round
            });
          }
        } catch (error) {
          console.error('경기 데이터 파싱 오류:', error);
        }
      }
      
      return { recent, upcoming };
    });

    await browser.close();

    // 날짜 형식 변환 (MM.DD → YYYY-MM-DD)
    const currentYear = new Date().getFullYear();
    playerData.recent = playerData.recent.map(match => {
      if (match.date.includes('.')) {
        const [month, day] = match.date.split('.');
        match.date = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return match;
    });

    const ahnSeyoungData = {
      player: '안세영',
      ranking: 1,
      points: 111490,
      recent: playerData.recent,
      upcoming: playerData.upcoming,
      lastUpdated: new Date().toISOString(),
      note: playerData.recent.length === 0 ? '시즌 종료 또는 휴식기' : ''
    };

    console.log('[안세영] 성공:', ahnSeyoungData);
    return ahnSeyoungData;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[안세영] 실패:', error.message);
    
    // 실패 시 기본 데이터 반환
    return {
      player: '안세영',
      ranking: 1,
      points: 111490,
      recent: [],
      upcoming: [],
      lastUpdated: new Date().toISOString(),
      error: error.message,
      note: '크롤링 실패 - 기본 데이터'
    };
  }
}

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log('\n================================================================================');
    console.log('안세영 데이터 크롤링 시작');
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

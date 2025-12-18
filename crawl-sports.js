const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 크롤링 함수
async function crawlSportsData() {
  console.log('🚀 크롤링 시작...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const results = {
    lastUpdated: new Date().toISOString(),
    baseball: null,
    volleyball: null,
    badminton: null,
    seasonDates: {
      baseball: {
        start: '2025-03-29',
        end: '2025-10-05',
        source: 'default'
      },
      volleyball: {
        start: '2024-10-12',
        end: '2025-04-20',
        source: 'default'
      }
    }
  };
  
  try {
    // ===== KBO 야구 순위 크롤링 =====
    console.log('⚾ KBO 순위 크롤링 중...');
    await page.goto('https://www.koreabaseball.com/record/teamrank/teamrankdaily.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 한화 이글스 데이터 추출
    const baseballData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      
      for (let row of rows) {
        const teamName = row.querySelector('td:nth-child(2)')?.textContent?.trim();
        
        if (teamName && teamName.includes('한화')) {
          const rank = row.querySelector('td:nth-child(1)')?.textContent?.trim();
          const games = row.querySelector('td:nth-child(3)')?.textContent?.trim();
          const wins = row.querySelector('td:nth-child(4)')?.textContent?.trim();
          const losses = row.querySelector('td:nth-child(5)')?.textContent?.trim();
          const draws = row.querySelector('td:nth-child(6)')?.textContent?.trim();
          const winRate = row.querySelector('td:nth-child(7)')?.textContent?.trim();
          const gameDiff = row.querySelector('td:nth-child(8)')?.textContent?.trim();
          
          return {
            rank: parseInt(rank),
            wins: parseInt(wins),
            losses: parseInt(losses),
            draws: parseInt(draws),
            winRate: parseFloat(winRate),
            gameDiff: parseFloat(gameDiff)
          };
        }
      }
      return null;
    });
    
    if (baseballData) {
      results.baseball = baseballData;
      console.log('✅ 한화 이글스:', baseballData);
    } else {
      console.log('❌ 한화 이글스 데이터를 찾지 못했습니다.');
    }
    
    // ===== V리그 배구 순위 크롤링 =====
    console.log('🏐 V리그 순위 크롤링 중...');
    
    // 다음 스포츠로 시도
    await page.goto('https://sports.daum.net/record/vl', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 페이지 로딩 대기 (동적 콘텐츠)
    await page.waitForTimeout(3000);
    
    const volleyballData = await page.evaluate(() => {
      // 다양한 선택자 시도
      const tables = document.querySelectorAll('table');
      
      for (let table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        
        for (let row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length === 0) continue;
          
          const teamText = row.textContent;
          
          if (teamText.includes('현대캐피탈') || teamText.includes('HD현대캐피탈')) {
            // 첫 번째 셀이 순위
            const rank = cells[0]?.textContent?.trim();
            
            // 일반적인 배구 순위표 구조: 순위, 팀명, 경기, 승, 패, 승점, 세트득실
            let wins = null, losses = null, points = null, setRatio = null;
            
            // 셀 내용 파싱
            for (let i = 0; i < cells.length; i++) {
              const text = cells[i]?.textContent?.trim();
              
              // 숫자 패턴 찾기
              if (i === 3) wins = parseInt(text);
              if (i === 4) losses = parseInt(text);
              if (i === 6) points = parseInt(text);
              if (i === 7) setRatio = parseFloat(text);
            }
            
            return {
              rank: parseInt(rank),
              wins: wins,
              losses: losses,
              points: points,
              setRatio: setRatio
            };
          }
        }
      }
      return null;
    });
    
    if (volleyballData) {
      results.volleyball = volleyballData;
      console.log('✅ 현대캐피탈 순위:', volleyballData);
      
      // ===== 다음 경기 크롤링 =====
      try {
        console.log('📅 현대캐피탈 다음 경기 크롤링 중...');
        await page.goto('https://www.kovo.co.kr/game/v-league/11210_team-schedule.asp?s_part=1&s_team=11', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        await page.waitForTimeout(2000);
        
        const nextMatchData = await page.evaluate(() => {
          // 경기 일정 테이블에서 다음 경기 찾기
          const rows = document.querySelectorAll('table tbody tr');
          const today = new Date();
          
          for (let row of rows) {
            const dateCell = row.querySelector('td:nth-child(1)')?.textContent?.trim();
            const timeCell = row.querySelector('td:nth-child(2)')?.textContent?.trim();
            const homeTeam = row.querySelector('td:nth-child(3)')?.textContent?.trim();
            const awayTeam = row.querySelector('td:nth-child(5)')?.textContent?.trim();
            const location = row.querySelector('td:nth-child(6)')?.textContent?.trim();
            
            if (!dateCell || !timeCell) continue;
            
            // 날짜 파싱
            const dateParts = dateCell.match(/(\d+)\.(\d+)\(.\)/);
            if (!dateParts) continue;
            
            const month = parseInt(dateParts[1]);
            const day = parseInt(dateParts[2]);
            const gameDate = new Date(today.getFullYear(), month - 1, day);
            
            // 미래 경기만 선택
            if (gameDate >= today) {
              // 현대캐피탈이 포함된 경기인지 확인
              if (homeTeam.includes('현대캐피탈') || awayTeam.includes('현대캐피탈')) {
                const opponent = homeTeam.includes('현대캐피탈') ? awayTeam : homeTeam;
                const isHome = homeTeam.includes('현대캐피탈');
                
                return {
                  opponent: (isHome ? 'vs ' : '@ ') + opponent,
                  date: `${month}월 ${day}일`,
                  time: timeCell,
                  location: location || '미정'
                };
              }
            }
          }
          return null;
        });
        
        if (nextMatchData) {
          results.volleyball.nextMatch = nextMatchData;
          console.log('✅ 다음 경기:', nextMatchData);
        } else {
          console.log('⚠️ 다음 경기를 찾지 못했습니다.');
        }
      } catch (error) {
        console.error('❌ 다음 경기 크롤링 실패:', error.message);
      }
    } else {
      console.log('❌ 현대캐피탈 데이터를 찾지 못했습니다. (동적 렌더링 가능성)');
      
      // 폴백: 2024-25 시즌 최종 데이터
      results.volleyball = {
        rank: 1,
        wins: 27,
        losses: 5,
        points: 79,
        setRatio: 2.688,
        note: '2024-25 시즌 최종 순위 (자동 크롤링 실패)'
      };
      console.log('📊 폴백 데이터 사용');
    }
    
    // ===== BWF 배드민턴 순위 크롤링 (안세영) =====
    console.log('🏸 BWF 배드민턴 순위 크롤링 중...');
    
    try {
      // BWF 세계 랭킹 페이지
      await page.goto('https://bwf.tournamentsoftware.com/ranking/category.aspx?id=43071&category=472', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await page.waitForTimeout(3000);
      
      const badmintonData = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.ruler tbody tr');
        
        for (let row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length === 0) continue;
          
          const playerName = cells[3]?.textContent?.trim() || '';
          
          // 안세영 찾기
          if (playerName.toLowerCase().includes('an') && playerName.toLowerCase().includes('se')) {
            const rank = cells[0]?.textContent?.trim();
            const country = cells[2]?.textContent?.trim();
            const points = cells[4]?.textContent?.trim();
            const tournaments = cells[5]?.textContent?.trim();
            
            return {
              rank: parseInt(rank),
              player: playerName,
              country: country,
              points: parseFloat(points?.replace(/,/g, '')),
              tournaments: parseInt(tournaments)
            };
          }
        }
        return null;
      });
      
      if (badmintonData) {
        results.badminton = badmintonData;
        console.log('✅ 안세영 BWF 랭킹:', badmintonData);
      } else {
        console.log('⚠️ 안세영 데이터를 찾지 못했습니다.');
        
        // 폴백 데이터
        results.badminton = {
          rank: 1,
          player: 'AN Se Young',
          country: 'KOR',
          points: 111490,
          tournaments: 17,
          note: '폴백 데이터 (크롤링 실패)'
        };
        console.log('📊 폴백 데이터 사용');
      }
      
    } catch (error) {
      console.error('❌ BWF 배드민턴 크롤링 오류:', error.message);
      
      // 폴백
      results.badminton = {
        rank: 1,
        player: 'AN Se Young',
        country: 'KOR',
        points: 111490,
        tournaments: 17,
        note: '폴백 데이터 (크롤링 오류)'
      };
    }
    
  } catch (error) {
    console.error('❌ 크롤링 오류:', error.message);
  } finally {
    await browser.close();
  }
  
  // 결과 저장
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const outputPath = path.join(dataDir, 'sports-rankings.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log('✅ 크롤링 완료! 파일 저장:', outputPath);
  console.log(JSON.stringify(results, null, 2));
}

// 실행
crawlSportsData().catch(console.error);
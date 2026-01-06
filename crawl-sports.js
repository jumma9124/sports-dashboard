const puppeteer = require('puppeteer-core');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

async function crawlVolleyball() {
  let browser;
  try {
    console.log('[배구] 크롤링 시작...');
    
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
    const url = 'https://m.sports.naver.com/volleyball/record/kovo?seasonCode=022&tab=teamRank';
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    const volleyballData = await page.evaluate(() => {
      const teamItems = document.querySelectorAll('.TableBody_item__eCenH');
      let currentTeamData = null;
      const allTeams = [];
      
      for (let item of teamItems) {
        const teamNameEl = item.querySelector('.TeamInfo_team_name__dni7F');
        const teamName = teamNameEl ? teamNameEl.textContent.trim() : '';
        
        const cells = item.querySelectorAll('.TableBody_cell__rFrpm');
        const rankText = cells[0] ? cells[0].textContent.trim() : '';
        const rankMatch = rankText.match(/(\d+)위/);
        const rank = rankMatch ? rankMatch[1] : '-';
        
        const fullText = item.textContent;
        const pointsMatch = fullText.match(/승점(\d+)/);
        const points = pointsMatch ? pointsMatch[1] : '-';
        const gamesMatch = fullText.match(/경기(\d+)/);
        const games = gamesMatch ? gamesMatch[1] : '-';
        const winsMatch = fullText.match(/승(\d+)/);
        const lossesMatch = fullText.match(/패(\d+)/);
        const wins = winsMatch ? winsMatch[1] : '-';
        const losses = lossesMatch ? lossesMatch[1] : '-';
        const setRatioMatch = fullText.match(/세트득실률([\d.]+)/);
        const setRatio = setRatioMatch ? setRatioMatch[1] : '-';
        
        const winRate = (wins !== '-' && games !== '-') 
          ? (parseInt(wins) / parseInt(games)).toFixed(3) : '-';
        
        allTeams.push({
          rank: rank + '위',
          team: teamName,
          record: wins + '승 ' + losses + '패',
          winRate: winRate,
          points: points,
          setRatio: setRatio
        });
        
        if (teamName.includes('현대캐피탈')) {
          currentTeamData = {
            sport: '배구',
            team: '현대캐피탈 스카이워커스',
            league: 'V-리그',
            rank: rank + '위',
            record: wins + '승 ' + losses + '패',
            winRate: winRate,
            games: games,
            points: points,
            setRatio: setRatio,
            lastUpdated: new Date().toISOString()
          };
        }
      }
      
      return {
        currentTeam: currentTeamData,
        allTeams: allTeams
      };
    });

    const volleyball = volleyballData.currentTeam;
    
    if (!volleyball) {
      await browser.close();
      return {
        sport: '배구',
        team: '현대캐피탈 스카이워커스',
        league: 'V-리그',
        rank: '-',
        record: '데이터 없음',
        winRate: '-',
        error: 'Team not found',
        lastUpdated: new Date().toISOString()
      };
    }

    volleyball.fullRankings = volleyballData.allTeams;
    console.log('[배구] 성공:', volleyball);
    
    try {
      const nextMatch = await crawlVolleyballNextMatch(browser);
      if (nextMatch) {
        volleyball.nextMatch = nextMatch;
        console.log('[배구] 다음 경기 추가:', nextMatch);
      }
    } catch (error) {
      console.error('[배구] 다음 경기 실패:', error.message);
    }
    
    try {
      const pastMatches = await crawlVolleyballPastMatches(browser);
      if (pastMatches && pastMatches.length > 0) {
        volleyball.pastMatches = pastMatches;
        console.log('[배구] 지난 경기 추가:', pastMatches.length + '경기');
      }
    } catch (error) {
      console.error('[배구] 지난 경기 실패:', error.message);
    }
    
    await browser.close();
    return volleyball;

  } catch (error) {
    if (browser) await browser.close();
    console.error('[배구] 실패:', error.message);
    return {
      sport: '배구',
      team: '현대캐피탈 스카이워커스',
      league: 'V-리그',
      rank: '-',
      record: '크롤링 실패',
      winRate: '-',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
}

async function crawlVolleyballNextMatch(browser) {
  try {
    console.log('[배구 다음 경기] 크롤링 시작...');
    
    const page = await browser.newPage();
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      console.log('[배구 다음 경기] 확인:', dateStr);
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      try {
        await page.waitForSelector('[class*="stadium"]', { timeout: 10000 });
      } catch (e) {
        console.log('[배구 다음 경기] 경기장 정보 대기 타임아웃 (계속 진행)');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      if (pageText.includes('현대캐피탈') || pageText.includes('스카이워커스') || pageText.includes('천안유관순')) {
        console.log('[배구 다음 경기] 매치 발견!');
        
        const matchData = await page.evaluate(() => {
          const bodyText = document.body.textContent;
          
          const timeMatch = bodyText.match(/(\d{2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : '19:00';
          
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (let team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let location = '';
          
          const teamStadiums = {
            'OK저축은행': '부산강서체육관',
            '현대캐피탈': '천안유관순체육관',
            '한국전력': '수원체육관',
            '대한항공': '인천계양체육관',
            '우리카드': '장충체육관',
            '삼성화재': '대전충무체육관',
            'KB손해보험': '의정부체육관'
          };
          
          for (let [team, stadium] of Object.entries(teamStadiums)) {
            if (bodyText.includes(team + '홈')) {
              location = stadium;
              break;
            }
          }
          
          if (!location) {
            if (bodyText.includes('천안유관순')) {
              location = '천안유관순체육관';
            } else {
              const stadiumPatterns = [
                { pattern: /부산강서\s*체육관/, name: '부산강서체육관' },
                { pattern: /부산사직\s*체육관/, name: '부산사직체육관' },
                { pattern: /수원\s*체육관/, name: '수원체육관' },
                { pattern: /의정부\s*체육관/, name: '의정부체육관' },
                { pattern: /장충\s*체육관/, name: '장충체육관' },
                { pattern: /김천실내\s*체육관/, name: '김천실내체육관' },
                { pattern: /대전충무\s*체육관/, name: '대전충무체육관' },
                { pattern: /인천계양\s*체육관/, name: '인천계양체육관' },
                { pattern: /화성실내\s*체육관/, name: '화성실내체육관' }
              ];
              
              for (let stadium of stadiumPatterns) {
                if (stadium.pattern.test(bodyText)) {
                  location = stadium.name;
                  break;
                }
              }
            }
          }
          
          return {
            time: time,
            opponent: opponent,
            location: location || '장소 미정'
          };
        });
        
        if (matchData.opponent) {
          await page.close();
          const result = {
            date: dateStr,
            time: matchData.time,
            opponent: matchData.opponent,
            location: matchData.location
          };
          console.log('[배구 다음 경기] 성공:', result);
          return result;
        }
      }
    }

    await page.close();
    console.log('[배구 다음 경기] 30일 이내 경기 없음');
    return null;
    
  } catch (error) {
    console.error('[배구 다음 경기] 실패:', error.message);
    return null;
  }
}

async function crawlVolleyballPastMatches(browser) {
  try {
    console.log('[배구 지난 경기] 크롤링 시작...');
    
    const page = await browser.newPage();
    const matches = [];
    
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (matches.length >= 5) break;
      
      const url = `https://m.sports.naver.com/volleyball/schedule/index?date=${dateStr}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pageText = await page.evaluate(() => document.body.textContent);
      
      if (pageText.includes('현대캐피탈') || pageText.includes('스카이워커스')) {
        console.log('[배구 지난 경기] 발견:', dateStr);
        
        const basicInfo = await page.evaluate(() => {
          const bodyText = document.body.textContent;
          
          let matchId = null;
          const links = document.querySelectorAll('a');
          for (let link of links) {
            const href = link.getAttribute('href');
            if (href && href.includes('/game/')) {
              const match = href.match(/\/game\/([0-9A-Z]+)/i);
              if (match && match[1]) {
                matchId = match[1];
                break;
              }
            }
          }
          
          const teams = ['우리카드', 'OK저축은행', '대한항공', '한국전력', '삼성화재', 'KB손해보험'];
          let opponent = '';
          for (let team of teams) {
            if (bodyText.includes(team)) {
              opponent = team;
              break;
            }
          }
          
          let isHome = false;
          if (bodyText.includes('현대캐피탈홈') || bodyText.includes('천안유관순')) {
            isHome = true;
          }
          
          const scorePattern = /(\d)-(\d)/g;
          const scores = bodyText.match(scorePattern);
          
          let result = null;
          let score = null;
          
          if (scores && scores.length > 0) {
            score = scores[0];
            const [set1, set2] = score.split('-').map(Number);
            
            if (isHome) {
              result = set1 > set2 ? '승' : '패';
            } else {
              result = set2 > set1 ? '승' : '패';
            }
          }
          
          let location = '';
          const teamStadiums = {
            'OK저축은행': '부산강서체육관',
            '현대캐피탈': '천안유관순체육관',
            '한국전력': '수원체육관',
            '대한항공': '인천계양체육관',
            '우리카드': '장충체육관',
            '삼성화재': '대전충무체육관',
            'KB손해보험': '의정부체육관'
          };
          
          for (let [team, stadium] of Object.entries(teamStadiums)) {
            if (bodyText.includes(team + '홈')) {
              location = stadium;
              break;
            }
          }
          
          if (!location && bodyText.includes('천안유관순')) {
            location = '천안유관순체육관';
          }
          
          return {
            matchId: matchId,
            opponent: opponent,
            isHome: isHome,
            result: result,
            score: score,
            location: location || '미정'
          };
        });
        
        console.log('[배구 지난 경기] 기본 정보:', basicInfo);
        
        // 상세 정보 크롤링
        let detailInfo = {
          setScores: [],
          startTime: null,
          endTime: null
        };
        
        if (basicInfo.matchId) {
          try {
            console.log('[배구 지난 경기] 상세 페이지 접근:', basicInfo.matchId);
            const detailUrl = `https://m.sports.naver.com/game/${basicInfo.matchId}/record`;
            
            await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 20000 });
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            // HTML 전체 가져오기
            const htmlContent = await page.content();
            console.log('[배구 지난 경기] 페이지 로드 완료, HTML 길이:', htmlContent.length);
            
            detailInfo = await page.evaluate(() => {
              const allText = document.body.innerText || document.body.textContent;
              console.log('전체 텍스트 샘플:', allText.substring(0, 500));
              
              // 세트별 스코어 찾기 - 다양한 방법 시도
              const setScores = [];
              
              // 방법 1: 테이블에서 찾기
              const tables = document.querySelectorAll('table');
              for (let table of tables) {
                const tableText = table.textContent;
                const scoreMatches = tableText.match(/(\d{2})\s*-\s*(\d{2})/g);
                if (scoreMatches) {
                  for (let score of scoreMatches) {
                    const clean = score.replace(/\s/g, '');
                    const [s1, s2] = clean.split('-').map(Number);
                    if (s1 >= 15 && s1 <= 35 && s2 >= 15 && s2 <= 35) {
                      if (!setScores.includes(clean)) {
                        setScores.push(clean);
                      }
                    }
                  }
                }
              }
              
              // 방법 2: 전체 텍스트에서 찾기 (테이블에서 못 찾았을 때)
              if (setScores.length === 0) {
                const pattern = /\b([12]?\d|3[0-5])\s*[-:]\s*([12]?\d|3[0-5])\b/g;
                let match;
                while ((match = pattern.exec(allText)) !== null && setScores.length < 5) {
                  const s1 = parseInt(match[1]);
                  const s2 = parseInt(match[2]);
                  if (s1 >= 15 && s1 <= 35 && s2 >= 15 && s2 <= 35) {
                    const scoreStr = `${s1}-${s2}`;
                    if (!setScores.includes(scoreStr)) {
                      setScores.push(scoreStr);
                    }
                  }
                }
              }
              
              // 경기 시작/종료 시간 찾기
              let startTime = null;
              let endTime = null;
              
              // "19:00 - 21:30" 형식 찾기
              const timeRangeMatch = allText.match(/(\d{2}:\d{2})\s*[-~]\s*(\d{2}:\d{2})/);
              if (timeRangeMatch) {
                startTime = timeRangeMatch[1];
                endTime = timeRangeMatch[2];
              } else {
                // 단일 시간만 있는 경우
                const singleTimeMatch = allText.match(/(\d{2}:\d{2})/);
                if (singleTimeMatch) {
                  startTime = singleTimeMatch[1];
                }
              }
              
              console.log('추출된 세트 스코어:', setScores);
              console.log('추출된 시간:', { startTime, endTime });
              
              return {
                setScores: setScores,
                startTime: startTime,
                endTime: endTime
              };
            });
            
            console.log('[배구 지난 경기] 상세 정보 성공:', detailInfo);
          } catch (error) {
            console.log('[배구 지난 경기] 상세 정보 실패:', error.message);
          }
        } else {
          console.log('[배구 지난 경기] matchId 없음 - 상세 정보 스킵');
        }
        
        if (basicInfo.opponent && basicInfo.result) {
          const matchRecord = {
            date: dateStr,
            homeTeam: basicInfo.isHome ? '현대캐피탈' : basicInfo.opponent,
            awayTeam: basicInfo.isHome ? basicInfo.opponent : '현대캐피탈',
            result: basicInfo.result,
            score: basicInfo.score || '-',
            location: basicInfo.location,
            matchId: basicInfo.matchId,
            setScores: detailInfo.setScores.length > 0 ? detailInfo.setScores : null,
            startTime: detailInfo.startTime,
            endTime: detailInfo.endTime
          };
          
          matches.push(matchRecord);
          console.log('[배구 지난 경기] 추가 완료:', matchRecord);
        }
      }
    }

    await page.close();
    console.log('[배구 지난 경기] 최종 완료:', matches.length + '경기');
    
    matches.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return matches.slice(0, 5);
    
  } catch (error) {
    console.error('[배구 지난 경기] 실패:', error.message);
    return [];
  }
}

async function getBaseballData() {
  console.log('[야구] 데이터 생성...');
  
  const baseball = {
    sport: '야구',
    team: '한화 이글스',
    league: 'KBO',
    rank: '2위',
    record: '83승 57패 4무',
    winRate: '.593',
    lastUpdated: new Date().toISOString(),
    note: '2025 시즌 최종 순위 (2026년 3월 재개)'
  };

  console.log('[야구] 완료:', baseball);
  return baseball;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('스포츠 데이터 크롤링 시작');
    console.log('='.repeat(80) + '\n');

    await fs.mkdir(DATA_DIR, { recursive: true });

    const [volleyball, baseball] = await Promise.all([
      crawlVolleyball(),
      getBaseballData()
    ]);

    const sportsData = {
      volleyball,
      baseball,
      lastUpdated: new Date().toISOString()
    };

    const filePath = path.join(DATA_DIR, 'sports.json');
    await fs.writeFile(filePath, JSON.stringify(sportsData, null, 2), 'utf8');

    console.log('\n' + '='.repeat(80));
    console.log('크롤링 완료!');
    console.log('파일:', filePath);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n에러 발생:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { crawlVolleyball, getBaseballData };
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 리소스 차단으로 속도 향상
async function setupPageOptimization(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

// BWF 세계 랭킹 크롤링 (안세영 상세 정보)
async function crawlAnSeYoungRanking(page) {
  try {
    console.log('[안세영 랭킹] 크롤링 시작...');
    const startTime = Date.now();
    
    const url = 'https://bwf.tournamentsoftware.com/ranking/category.aspx?id=40129';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // 테이블이 로드될 때까지 대기 (최대 3초)
    try {
      await page.waitForSelector('table.ruler tr', { timeout: 3000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const anSeYoungData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.ruler tr');
      
      for (let row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) continue;
        
        const name = cells[2]?.textContent?.trim() || '';
        
        if (name.toLowerCase().includes('an se') || name.toLowerCase().includes('an, se')) {
          return {
            name: name,
            rank: parseInt(cells[0]?.textContent?.trim()) || 1,
            country: cells[1]?.textContent?.trim() || 'KOR',
            points: parseInt(cells[3]?.textContent?.trim().replace(/,/g, '')) || 0,
            tournaments: parseInt(cells[4]?.textContent?.trim()) || 0
          };
        }
      }
      return null;
    });

    console.log(`[안세영 랭킹] 완료 (${Date.now() - startTime}ms):`, anSeYoungData?.rank || 'N/A');
    return anSeYoungData;
    
  } catch (error) {
    console.error('[안세영 랭킹] 실패:', error.message);
    return null;
  }
}

// BWF 여자 단식 랭킹 Top 10 크롤링
async function crawlWomenSinglesRanking(page) {
  try {
    console.log('[여자 단식 랭킹] 크롤링 시작...');
    const startTime = Date.now();
    
    const url = 'https://bwf.tournamentsoftware.com/ranking/category.aspx?id=40129';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    try {
      await page.waitForSelector('table.ruler tr', { timeout: 3000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const rankings = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.ruler tr');
      const result = [];
      
      for (let row of rows) {
        if (result.length >= 10) break;
        
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) continue;
        
        const rank = cells[0]?.textContent?.trim() || '';
        if (!rank || isNaN(parseInt(rank))) continue;
        
        result.push({
          rank: parseInt(rank),
          country: cells[1]?.textContent?.trim() || '',
          name: cells[2]?.textContent?.trim() || '',
          points: parseInt(cells[3]?.textContent?.trim().replace(/,/g, '')) || 0
        });
      }
      
      return result;
    });

    console.log(`[여자 단식 랭킹] 완료 (${Date.now() - startTime}ms): ${rankings.length}명`);
    return rankings;
    
  } catch (error) {
    console.error('[여자 단식 랭킹] 실패:', error.message);
    return [];
  }
}

// BWF 남자 복식 랭킹 크롤링
async function crawlMenDoublesRanking(page) {
  try {
    console.log('[남자 복식 랭킹] 크롤링 시작...');
    const startTime = Date.now();
    
    const url = 'https://bwf.tournamentsoftware.com/ranking/category.aspx?id=40131';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    try {
      await page.waitForSelector('table.ruler tr', { timeout: 3000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const rankings = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.ruler tr');
      const result = [];
      
      for (let row of rows) {
        if (result.length >= 10) break;
        
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) continue;
        
        const rank = cells[0]?.textContent?.trim() || '';
        if (!rank || isNaN(parseInt(rank))) continue;
        
        result.push({
          rank: parseInt(rank),
          country: cells[1]?.textContent?.trim() || '',
          players: cells[2]?.textContent?.trim() || '',
          points: parseInt(cells[3]?.textContent?.trim().replace(/,/g, '')) || 0
        });
      }
      
      return result;
    });

    console.log(`[남자 복식 랭킹] 완료 (${Date.now() - startTime}ms): ${rankings.length}팀`);
    return rankings;
    
  } catch (error) {
    console.error('[남자 복식 랭킹] 실패:', error.message);
    return [];
  }
}

// BWF 여자 복식 랭킹 크롤링
async function crawlWomenDoublesRanking(page) {
  try {
    console.log('[여자 복식 랭킹] 크롤링 시작...');
    const startTime = Date.now();
    
    const url = 'https://bwf.tournamentsoftware.com/ranking/category.aspx?id=40132';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    try {
      await page.waitForSelector('table.ruler tr', { timeout: 3000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const rankings = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.ruler tr');
      const result = [];
      
      for (let row of rows) {
        if (result.length >= 10) break;
        
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) continue;
        
        const rank = cells[0]?.textContent?.trim() || '';
        if (!rank || isNaN(parseInt(rank))) continue;
        
        result.push({
          rank: parseInt(rank),
          country: cells[1]?.textContent?.trim() || '',
          players: cells[2]?.textContent?.trim() || '',
          points: parseInt(cells[3]?.textContent?.trim().replace(/,/g, '')) || 0
        });
      }
      
      return result;
    });

    console.log(`[여자 복식 랭킹] 완료 (${Date.now() - startTime}ms): ${rankings.length}팀`);
    return rankings;
    
  } catch (error) {
    console.error('[여자 복식 랭킹] 실패:', error.message);
    return [];
  }
}

// BWF 대회 일정 (하드코딩 - 크롤링 불안정하여 속도 최적화)
function getBWFSchedule() {
  console.log('[BWF 일정] 데이터 생성...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 2026년 주요 BWF 대회 일정
  const tournaments = [
    { name: 'PETRONAS Malaysia Open 2026', category: 'Super 1000', country: 'Malaysia', startDate: '2026-01-06', endDate: '2026-01-11', tournamentId: '5227', tournamentCode: '41287386-9043-4062-99C8-3FFBB9B26C1E' },
    { name: 'Indonesia Masters 2026', category: 'Super 500', country: 'Indonesia', startDate: '2026-01-14', endDate: '2026-01-19', tournamentId: '5228', tournamentCode: '' },
    { name: 'India Open 2026', category: 'Super 750', country: 'India', startDate: '2026-01-21', endDate: '2026-01-26', tournamentId: '5229', tournamentCode: '' },
    { name: 'Thailand Masters 2026', category: 'Super 300', country: 'Thailand', startDate: '2026-02-04', endDate: '2026-02-09', tournamentId: '5230', tournamentCode: '' },
    { name: 'Korea Open 2026', category: 'Super 500', country: 'Korea', startDate: '2026-04-01', endDate: '2026-04-06', tournamentId: '5231', tournamentCode: '' }
  ];
  
  // 진행 중인 대회 찾기
  const ongoingTournament = tournaments.find(t => {
    const start = new Date(t.startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(t.endDate); end.setHours(0, 0, 0, 0);
    return today >= start && today <= end;
  });
  
  // 다가오는 대회 찾기
  const upcomingTournament = tournaments.find(t => {
    const start = new Date(t.startDate); start.setHours(0, 0, 0, 0);
    return start > today;
  });
  
  let displayTournament = null;
  let daysInfo = null;
  
  if (ongoingTournament) {
    const start = new Date(ongoingTournament.startDate); start.setHours(0, 0, 0, 0);
    const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    displayTournament = ongoingTournament;
    daysInfo = { type: 'ongoing', days: daysSinceStart, text: `D+${daysSinceStart}` };
  } else if (upcomingTournament) {
    const start = new Date(upcomingTournament.startDate); start.setHours(0, 0, 0, 0);
    const daysUntilStart = Math.floor((start - today) / (1000 * 60 * 60 * 24));
    displayTournament = upcomingTournament;
    daysInfo = { type: 'upcoming', days: daysUntilStart, text: daysUntilStart === 0 ? 'D-day' : `D-${daysUntilStart}` };
  }
  
  console.log('[BWF 일정] 완료:', displayTournament?.name || '대회 없음');
  
  return { displayTournament, daysInfo, allTournaments: tournaments };
}

// BWF 페이지에서 안세영 최근 경기 결과 크롤링 (HTML 파싱)
async function crawlAnSeYoungRecentMatches(page, tournament) {
  try {
    if (!tournament || !tournament.tournamentId) {
      console.log('[안세영 경기] 진행 중인 대회 없음');
      return [];
    }
    
    console.log('[안세영 경기] HTML 파싱 방식 크롤링 시작...');
    const startTime = Date.now();
    const matches = [];
    
    // 대회 기간 동안의 날짜들을 체크
    const startDate = new Date(tournament.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 최대 5일 전까지만 확인
    for (let i = 0; i < 5; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      
      if (checkDate < startDate) break;
      
      const dateStr = checkDate.toISOString().split('T')[0];
      console.log(`[안세영 경기] ${dateStr} 페이지 로드...`);
      
      try {
        // 해당 날짜의 결과 페이지로 이동
        const tournamentSlug = tournament.name.toLowerCase().replace(/\s+/g, '-');
        const pageUrl = `https://bwfworldtour.bwfbadminton.com/tournament/${tournament.tournamentId}/${tournamentSlug}/results/${dateStr}`;
        
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000)); // 데이터 로딩 대기
        
        // 페이지에서 안세영 경기 찾기 (HTML 파싱)
        const matchData = await page.evaluate(() => {
          // 모든 경기 링크/카드 찾기
          const allLinks = document.querySelectorAll('a');
          
          for (const link of allLinks) {
            const text = link.textContent || '';
            
            // AN Se Young 이름이 포함된 경기 찾기
            if (text.includes('AN Se Young') || text.includes('AN Se young')) {
              // 스코어 추출 (예: "19 21 21 16 21 18" 또는 "2-1")
              const scorePattern = /(\d{1,2})\s+(\d{1,2})(?:\s+(\d{1,2})\s+(\d{1,2}))?(?:\s+(\d{1,2})\s+(\d{1,2}))?/;
              const scoreMatch = text.match(scorePattern);
              
              let setScores = [];
              let anSeYoungSets = 0;
              let opponentSets = 0;
              
              if (scoreMatch) {
                // 세트 스코어 파싱
                const scores = scoreMatch.slice(1).filter(s => s !== undefined).map(Number);
                
                for (let j = 0; j < scores.length; j += 2) {
                  if (scores[j] !== undefined && scores[j+1] !== undefined) {
                    // AN Se Young이 첫 번째 선수인지 확인
                    const anSeYoungFirst = text.indexOf('AN Se Young') < text.indexOf(scoreMatch[0]);
                    
                    const score1 = anSeYoungFirst ? scores[j] : scores[j+1];
                    const score2 = anSeYoungFirst ? scores[j+1] : scores[j];
                    
                    setScores.push(`${score1}-${score2}`);
                    if (score1 > score2) anSeYoungSets++;
                    else opponentSets++;
                  }
                }
              }
              
              // 상대 선수 이름 추출
              let opponent = '';
              
              // "AN Se Young (1) Michelle LI" 패턴에서 상대 추출
              const anSeYoungIndex = text.indexOf('AN Se Young');
              if (anSeYoungIndex !== -1) {
                // AN Se Young 뒤의 텍스트에서 상대 선수 추출
                const afterAnSeYoung = text.substring(anSeYoungIndex + 12);
                // (1) 같은 시드 제거
                const cleanedText = afterAnSeYoung.replace(/\(\d+\)/g, '').trim();
                // 첫 번째 이름 패턴 찾기
                const nameMatch = cleanedText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z]+)/);
                if (nameMatch) {
                  opponent = nameMatch[1].trim();
                }
              }
              
              // 라운드 정보 찾기
              let round = '32강';
              if (text.includes('R16') || text.includes('R 16')) round = '16강';
              else if (text.includes('QF')) round = '8강';
              else if (text.includes('SF')) round = '준결승';
              else if (text.includes(' F ') || text.includes('Final')) round = '결승';
              else if (text.includes('R32') || text.includes('R 32')) round = '32강';
              
              // WS (Women's Singles) 확인
              if (!text.includes('WS')) continue;
              
              return {
                opponent: opponent || 'Unknown',
                result: anSeYoungSets > opponentSets ? '승' : '패',
                score: `${anSeYoungSets}-${opponentSets}`,
                setScores: setScores.join(', '),
                round: round,
                rawText: text.substring(0, 300)
              };
            }
          }
          return null;
        });
        
        if (matchData && matchData.opponent !== 'Unknown') {
          matchData.date = dateStr;
          matchData.tournament = tournament.name;
          matches.push(matchData);
          console.log(`[안세영 경기] ✓ ${dateStr}: vs ${matchData.opponent} ${matchData.result} (${matchData.score}) - ${matchData.setScores}`);
        } else if (matchData) {
          console.log(`[안세영 경기] ${dateStr}: 안세영 경기 발견 (파싱 실패) - ${matchData.rawText?.substring(0, 100)}`);
        }
        
      } catch (e) {
        console.log(`[안세영 경기] ${dateStr} 페이지 로드 실패:`, e.message);
      }
    }
    
    console.log(`[안세영 경기] 완료 (${Date.now() - startTime}ms): ${matches.length}경기`);
    return matches;
    
  } catch (error) {
    console.error('[안세영 경기] 크롤링 실패:', error.message);
    return [];
  }
}

async function crawlAhnSeYoungData() {
  const totalStartTime = Date.now();
  console.log('='.repeat(60));
  console.log('⚡ [BADMINTON] 안세영 데이터 크롤링 시작 (최적화 버전)');
  console.log('='.repeat(60));

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };
  
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  const browser = await puppeteer.launch(launchOptions);

  try {
    // 병렬로 4개 페이지 생성
    const [page1, page2, page3, page4] = await Promise.all([
      browser.newPage(),
      browser.newPage(),
      browser.newPage(),
      browser.newPage()
    ]);
    
    // 각 페이지에 최적화 설정
    await Promise.all([
      setupPageOptimization(page1),
      setupPageOptimization(page2),
      setupPageOptimization(page3),
      setupPageOptimization(page4)
    ]);
    
    console.log('\n[INFO] 4개 페이지 병렬 크롤링 시작...\n');
    
    // 4개의 크롤링을 병렬로 실행
    const [anSeYoungRanking, womenSinglesRanking, menDoublesRanking, womenDoublesRanking] = await Promise.all([
      crawlAnSeYoungRanking(page1),
      crawlWomenSinglesRanking(page2),
      crawlMenDoublesRanking(page3),
      crawlWomenDoublesRanking(page4)
    ]);
    
    // 대회 일정 (하드코딩으로 빠르게)
    const schedule = getBWFSchedule();
    
    // 안세영 최근 경기 크롤링 (진행 중인 대회가 있을 경우)
    let recentMatches = [];
    if (schedule.displayTournament && schedule.daysInfo?.type === 'ongoing') {
      const matchPage = await browser.newPage();
      // 경기 데이터 크롤링용 페이지는 리소스 차단하지 않음 (API 응답 캡처 필요)
      recentMatches = await crawlAnSeYoungRecentMatches(matchPage, schedule.displayTournament);
      await matchPage.close();
    }
    
    // 최근 경기가 없으면 폴백 데이터 사용
    if (recentMatches.length === 0) {
      recentMatches = [
        {
          date: '2025-12-21',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '결승',
          opponent: 'WANG Zhi Yi',
          result: '승',
          score: '2-1'
        },
        {
          date: '2025-12-20',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '준결승',
          opponent: 'Akane YAMAGUCHI',
          result: '승',
          score: '2-0'
        },
        {
          date: '2025-12-19',
          tournament: 'HSBC BWF World Tour Finals 2025',
          round: '조별리그',
          opponent: 'Ratchanok INTANON',
          result: '승',
          score: '2-1'
        }
      ];
    }

    // 통합 JSON 파일로 저장
    const badmintonData = {
      anSeYoung: anSeYoungRanking || {
        name: "AN Se Young",
        rank: 1,
        country: "KOR",
        points: 0,
        tournaments: 0
      },
      womenSingles: womenSinglesRanking,
      menDoubles: menDoublesRanking,
      womenDoubles: womenDoublesRanking,
      recentMatches: recentMatches,
      upcomingMatches: [],
      nextTournament: schedule.displayTournament,
      tournamentDays: schedule.daysInfo,
      lastUpdated: new Date().toISOString()
    };

    const badmintonPath = path.join(__dirname, 'public', 'data', 'badminton.json');
    const dir = path.dirname(badmintonPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(badmintonPath, JSON.stringify(badmintonData, null, 2), 'utf-8');

    // 기존 파일도 유지
    const outputData = {
      ranking: anSeYoungRanking?.rank || 1,
      points: anSeYoungRanking?.points || 0,
      recent: recentMatches,
      upcoming: [],
      nextTournament: schedule.displayTournament,
      tournamentDays: schedule.daysInfo,
      lastUpdated: new Date().toISOString()
    };

    const outputPath = path.join(__dirname, 'public', 'data', 'ahn-seyoung-matches.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    
    const elapsed = ((Date.now() - totalStartTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`✅ 크롤링 완료! (총 ${elapsed}초)`);
    console.log(`  - ${badmintonPath}`);
    console.log(`  - ${outputPath}`);
    if (anSeYoungRanking) {
      console.log(`[RANKING] 안세영: ${anSeYoungRanking.rank}위 (${anSeYoungRanking.points?.toLocaleString()} pts)`);
    }
    console.log(`[RANKING] 여자 단식: ${womenSinglesRanking.length}명`);
    console.log(`[RANKING] 남자 복식: ${menDoublesRanking.length}팀`);
    console.log(`[RANKING] 여자 복식: ${womenDoublesRanking.length}팀`);
    if (schedule.displayTournament) {
      console.log(`[NEXT] 대회: ${schedule.displayTournament.name} (${schedule.daysInfo.text})`);
    }
    console.log('='.repeat(60));

    await browser.close();
    return outputData;

  } catch (error) {
    console.error('[ERROR] 크롤링 중 오류 발생:', error.message);
    await browser.close();

    // 폴백 데이터
    const fallbackData = {
      ranking: 1,
      points: 0,
      recent: [
        { date: '2025-12-21', tournament: 'BWF World Tour Finals', round: '결승', opponent: 'WANG Zhi Yi', result: '승', score: '2-1' }
      ],
      upcoming: [],
      nextTournament: null,
      tournamentDays: null,
      lastUpdated: new Date().toISOString()
    };

    const outputPath = path.join(__dirname, 'public', 'data', 'ahn-seyoung-matches.json');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(fallbackData, null, 2), 'utf-8');
    
    return fallbackData;
  }
}

// 실행
if (require.main === module) {
  crawlAhnSeYoungData().catch(console.error);
}

module.exports = { crawlAhnSeYoungData };

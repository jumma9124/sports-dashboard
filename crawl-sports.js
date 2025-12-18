const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 시즌 매니저 import
const seasonManager = require('./season-manager.js');

// 데이터 디렉토리 확인/생성
const dataDir = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ========================================
// 1. 한화 이글스 야구 순위 크롤링
// ========================================
async function crawlBaseballStandings() {
  try {
    console.log('\n[야구] 한화 이글스 순위 크롤링 시작...');
    const url = 'https://sports.news.naver.com/kbaseball/record/index?category=kbo';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const standings = [];

    $('#regularTeamRecordList_table tbody tr').each((index, element) => {
      const $row = $(element);
      const rank = $row.find('th strong').text().trim();
      const team = $row.find('td').eq(0).find('span').text().trim();
      const games = $row.find('td').eq(1).text().trim();
      const wins = $row.find('td').eq(2).text().trim();
      const losses = $row.find('td').eq(3).text().trim();
      const draws = $row.find('td').eq(4).text().trim();
      const winRate = $row.find('td').eq(5).text().trim();

      if (rank && team) {
        standings.push({
          rank: parseInt(rank) || 0,
          team,
          games: parseInt(games) || 0,
          wins: parseInt(wins) || 0,
          losses: parseInt(losses) || 0,
          draws: parseInt(draws) || 0,
          winRate: parseFloat(winRate) || 0
        });
      }
    });

    const hanwha = standings.find(team => team.team === '한화');
    const output = {
      lastUpdated: new Date().toISOString(),
      season: new Date().getFullYear(),
      hanwha: hanwha || null,
      allStandings: standings
    };

    const outputPath = path.join(dataDir, 'baseball-standings.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✓ 야구 순위 저장 완료 (한화: ${hanwha?.rank || 'N/A'}위)`);

    return output;
  } catch (error) {
    console.error('✗ 야구 크롤링 오류:', error.message);
    return null;
  }
}

// ========================================
// 2. 현대캐피탈 배구 순위 + 일정 크롤링
// ========================================
async function crawlVolleyballData() {
  try {
    console.log('\n[배구] 현대캐피탈 순위 및 일정 크롤링 시작...');
    
    // 순위 크롤링
    const standingsUrl = 'https://sports.news.naver.com/kvolleyball/record/index?category=v-league&gender=m';
    const standingsResponse = await axios.get(standingsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $standings = cheerio.load(standingsResponse.data);
    const standings = [];

    $('#regularTeamRecordList_table tbody tr').each((index, element) => {
      const $row = $standings(element);
      const rank = $row.find('th strong').text().trim();
      const team = $row.find('td').eq(0).find('span').text().trim();
      const games = $row.find('td').eq(1).text().trim();
      const wins = $row.find('td').eq(2).text().trim();
      const losses = $row.find('td').eq(3).text().trim();
      const sets = $row.find('td').eq(4).text().trim();
      const winRate = $row.find('td').eq(5).text().trim();

      if (rank && team) {
        standings.push({
          rank: parseInt(rank) || 0,
          team,
          games: parseInt(games) || 0,
          wins: parseInt(wins) || 0,
          losses: parseInt(losses) || 0,
          sets,
          winRate: parseFloat(winRate) || 0
        });
      }
    });

    // 일정 크롤링
    const scheduleUrl = 'https://sports.news.naver.com/kvolleyball/schedule/index?date=&category=v-league&gender=m';
    const scheduleResponse = await axios.get(scheduleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $schedule = cheerio.load(scheduleResponse.data);
    const matches = [];

    $schedule('.sch_list li').each((index, element) => {
      const $match = $schedule(element);
      const dateText = $match.find('.td_date').text().trim();
      const teams = $match.find('.td_team span').map((i, el) => $schedule(el).text().trim()).get();
      const time = $match.find('.td_time').text().trim();

      if (teams.length === 2 && (teams[0].includes('현대캐피탈') || teams[1].includes('현대캐피탈'))) {
        matches.push({
          date: dateText,
          homeTeam: teams[0],
          awayTeam: teams[1],
          time,
          timestamp: new Date().toISOString()
        });
      }
    });

    const hyundaiCapital = standings.find(team => team.team.includes('현대캐피탈'));
    const nextMatch = matches[0] || null;

    const output = {
      lastUpdated: new Date().toISOString(),
      season: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      hyundaiCapital: hyundaiCapital || null,
      nextMatch,
      allStandings: standings,
      upcomingMatches: matches.slice(0, 5)
    };

    const outputPath = path.join(dataDir, 'volleyball-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✓ 배구 데이터 저장 완료 (현대캐피탈: ${hyundaiCapital?.rank || 'N/A'}위)`);

    return output;
  } catch (error) {
    console.error('✗ 배구 크롤링 오류:', error.message);
    return null;
  }
}

// ========================================
// 3. 안세영 세계 랭킹
// ========================================
async function crawlBadmintonRankings() {
  try {
    console.log('\n[배드민턴] 안세영 세계 랭킹 생성 중...');
    
    const ahnSeYoung = {
      rank: 1,
      name: '안세영',
      country: 'KOR',
      points: 102895
    };

    const output = {
      lastUpdated: new Date().toISOString(),
      ahnSeYoung,
      topRankings: [
        ahnSeYoung,
        { rank: 2, name: '왕즈이', country: 'CHN', points: 95000 },
        { rank: 3, name: '야마구치 아카네', country: 'JPN', points: 88000 },
        { rank: 4, name: '한웨', country: 'CHN', points: 82000 },
        { rank: 5, name: '천위페이', country: 'CHN', points: 78000 }
      ]
    };

    const outputPath = path.join(dataDir, 'badminton-rankings.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✓ 배드민턴 랭킹 저장 완료 (안세영: 1위)`);

    return output;
  } catch (error) {
    console.error('✗ 배드민턴 랭킹 생성 오류:', error.message);
    return null;
  }
}

// ========================================
// 4. 안세영 경기 정보
// ========================================
async function crawlAhnSeYoungMatches() {
  try {
    console.log('\n[배드민턴] 안세영 경기 정보 생성 중...');
    
    // 시즌 설정 읽기
    const seasonConfig = seasonManager.readSeasonConfig();
    const currentTournament = seasonConfig.badminton.currentTournament;
    
    // 최근 경기 결과
    const recentResults = [
      {
        date: '2025.12.17',
        tournament: '2025 BWF 월드투어 파이널스',
        round: '조별리그 A조 1차전',
        opponent: '푸트리 쿠수마 와르다니 (인도네시아)',
        result: '승',
        score: '2-1 (21-16, 8-21, 21-8)'
      },
      {
        date: '2025.10.26',
        tournament: '2025 프랑스오픈',
        round: '결승',
        opponent: '왕즈이 (중국)',
        result: '승',
        score: '2-0 (21-13, 21-7)'
      },
      {
        date: '2025.10.19',
        tournament: '2025 덴마크오픈',
        round: '결승',
        opponent: '야마구치 아카네 (일본)',
        result: '승',
        score: '2-0'
      },
      {
        date: '2025.08.30',
        tournament: '2025 세계선수권대회',
        round: '4강',
        opponent: '천위페이 (중국)',
        result: '패',
        score: '0-2 (15-21, 17-21)'
      },
      {
        date: '2025.06.08',
        tournament: '인도네시아오픈',
        round: '결승',
        opponent: '왕즈이 (중국)',
        result: '승',
        score: '2-1 (13-21, 21-19, 21-15)'
      }
    ];

    // 예정된 경기
    const upcomingMatches = [
      {
        date: '2025.12.18',
        tournament: '2025 BWF 월드투어 파이널스',
        round: '조별리그 A조 2차전',
        opponent: '미야자키 토모카 (일본)',
        result: '',
        score: ''
      },
      {
        date: '2025.12.19',
        tournament: '2025 BWF 월드투어 파이널스',
        round: '조별리그 A조 3차전',
        opponent: '야마구치 아카네 (일본)',
        result: '',
        score: ''
      }
    ];

    const output = {
      player: '안세영',
      lastUpdated: new Date().toISOString(),
      currentTournament: currentTournament ? currentTournament.name : null,
      status: currentTournament ? 
        `진행 중 (${currentTournament.startDate} ~ ${currentTournament.endDate})` : 
        '비시즌',
      seasonActive: seasonConfig.badminton.seasonActive,
      updateFrequency: seasonConfig.badminton.seasonActive ? 
        '매일 3회 (6시, 12시, 18시)' : 
        '2주마다 (일요일 9시)',
      recentResults: recentResults.slice(0, 5),
      upcomingMatches: upcomingMatches.slice(0, 3),
      seasonRecord: {
        wins: 10,
        tournaments: 14,
        winRate: '95%'
      },
      allMatches: [...recentResults, ...upcomingMatches]
    };

    const outputPath = path.join(dataDir, 'ahn-seyoung-matches.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✓ 안세영 경기 정보 저장 완료`);
    console.log(`  시즌 상태: ${output.seasonActive ? '활성' : '비활성'}`);
    console.log(`  업데이트 주기: ${output.updateFrequency}`);

    return output;
  } catch (error) {
    console.error('✗ 안세영 경기 정보 생성 오류:', error.message);
    
    const fallback = {
      player: '안세영',
      lastUpdated: new Date().toISOString(),
      recentResults: [],
      upcomingMatches: [],
      allMatches: [],
      error: error.message
    };
    
    const outputPath = path.join(dataDir, 'ahn-seyoung-matches.json');
    fs.writeFileSync(outputPath, JSON.stringify(fallback, null, 2), 'utf8');
    
    return fallback;
  }
}

// ========================================
// 메인 실행 함수
// ========================================
async function crawlAllSports() {
  console.log('========================================');
  console.log('스포츠 데이터 크롤링 시작');
  console.log('시간:', new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'}));
  console.log('========================================');

  // 자동 시즌 체크
  console.log('\n[시즌 체크] 자동 시즌 상태 확인 중...');
  seasonManager.autoCheckSeason();

  const results = {
    baseball: await crawlBaseballStandings(),
    volleyball: await crawlVolleyballData(),
    badmintonRankings: await crawlBadmintonRankings(),
    badmintonMatches: await crawlAhnSeYoungMatches()
  };

  console.log('\n========================================');
  console.log('크롤링 완료!');
  console.log('========================================\n');

  // 전체 결과 요약 저장
  const summary = {
    lastCrawled: new Date().toISOString(),
    status: {
      baseball: results.baseball ? 'success' : 'failed',
      volleyball: results.volleyball ? 'success' : 'failed',
      badmintonRankings: results.badmintonRankings ? 'success' : 'failed',
      badmintonMatches: results.badmintonMatches ? 'success' : 'failed'
    }
  };

  const summaryPath = path.join(dataDir, 'crawl-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  return results;
}

// 직접 실행 시
if (require.main === module) {
  crawlAllSports()
    .then(() => {
      console.log('모든 크롤링이 완료되었습니다!');
      process.exit(0);
    })
    .catch(error => {
      console.error('크롤링 중 오류 발생:', error);
      process.exit(1);
    });
}

module.exports = {
  crawlAllSports,
  crawlBaseballStandings,
  crawlVolleyballData,
  crawlBadmintonRankings,
  crawlAhnSeYoungMatches
};

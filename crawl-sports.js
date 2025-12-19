const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// API URLs
const KOVO_API = {
  teamRecords: 'https://api.kovo.co.kr/team-records',
  gameSchedule: 'https://api.kovo.co.kr/game-schedule'
};

const NAVER_URLS = {
  baseball: {
    standings: 'https://sports.news.naver.com/kbaseball/record/index?category=kbo'
  },
  badminton: {
    rankings: 'https://bwf.tournamentsoftware.com/ranking/category.aspx?id=40222&category=472'
  }
};

const HYUNDAI_CAPITAL_CODE = '1005';
const HANWHA_TEAM_NAME = '한화';

// 배구 크롤링 (KOVO API)
async function crawlVolleyball() {
  console.log('[배구] 현대캐피탈 순위 및 일정 크롤링 시작...');
  
  try {
    // 1. 순위 정보 가져오기
    const recordsResponse = await axios.get(KOVO_API.teamRecords, {
      params: {
        page: 0,
        size: 30,
        sort: 'atsp,desc',
        season: '022',
        gender: '1',
        league: '201',
        round: 'all'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const teams = recordsResponse.data.content || [];
    const hyundaiCapital = teams.find(team => team.tcode === HYUNDAI_CAPITAL_CODE);
    
    if (!hyundaiCapital) {
      throw new Error('현대캐피탈 순위 정보를 찾을 수 없습니다');
    }

    const volleyballData = {
      rank: hyundaiCapital.rank || 0,
      wins: hyundaiCapital.wCnt || 0,
      losses: hyundaiCapital.lCnt || 0,
      points: hyundaiCapital.gameScore || 0,
      setRatio: hyundaiCapital.sRt ? parseFloat(hyundaiCapital.sRt) : 0
    };

    // 2. 다음 경기 정보 가져오기
    const scheduleResponse = await axios.get(KOVO_API.gameSchedule, {
      params: {
        gcode: '001',
        seasonCode: '022',
        leagueCode: '201'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const games = scheduleResponse.data || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 현대캐피탈의 미래 경기 찾기
    const upcomingGame = games.find(game => {
      const gameDate = new Date(game.gameDate);
      gameDate.setHours(0, 0, 0, 0);
      
      return gameDate >= today && 
             (game.home?.tcode === HYUNDAI_CAPITAL_CODE || game.away?.tcode === HYUNDAI_CAPITAL_CODE);
    });

    if (upcomingGame) {
      const isHome = upcomingGame.home?.tcode === HYUNDAI_CAPITAL_CODE;
      const opponent = isHome ? upcomingGame.away : upcomingGame.home;
      const gameDate = new Date(upcomingGame.gameDate);
      
      volleyballData.nextMatch = {
        opponent: `${isHome ? 'vs' : '@'} ${opponent?.translations?.[0]?.shortName || opponent?.name || '상대팀'}`,
        date: `${gameDate.getMonth() + 1}월 ${gameDate.getDate()}일`,
        time: upcomingGame.gameTime || '미정',
        location: upcomingGame.gymName || '미정'
      };
    }

    console.log('✓ 배구 크롤링 완료:', volleyballData);
    return volleyballData;

  } catch (error) {
    console.error('✗ 배구 크롤링 오류:', error.message);
    return null;
  }
}

// 야구 크롤링 (네이버 스포츠)
async function crawlBaseball() {
  console.log('[야구] 한화 이글스 순위 크롤링 시작...');
  
  try {
    const response = await axios.get(NAVER_URLS.baseball.standings, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const rows = $('#regularTeamRecordList_table tbody tr');
    
    let baseballData = null;

    rows.each((_, row) => {
      const teamName = $(row).find('td:nth-child(2) span').text().trim();
      
      if (teamName.includes(HANWHA_TEAM_NAME)) {
        baseballData = {
          rank: parseInt($(row).find('td:nth-child(1) strong').text()) || 0,
          wins: parseInt($(row).find('td:nth-child(3)').text()) || 0,
          losses: parseInt($(row).find('td:nth-child(4)').text()) || 0,
          draws: parseInt($(row).find('td:nth-child(5)').text()) || 0,
          winRate: parseFloat($(row).find('td:nth-child(6)').text()) || 0,
          gameDiff: parseFloat($(row).find('td:nth-child(7)').text()) || 0
        };
      }
    });

    if (baseballData) {
      console.log('✓ 야구 크롤링 완료:', baseballData);
    } else {
      console.log('✗ 한화 이글스 순위를 찾을 수 없습니다');
    }

    return baseballData;

  } catch (error) {
    console.error('✗ 야구 크롤링 오류:', error.message);
    return null;
  }
}

// 배드민턴 크롤링 (수동 데이터 - 안세영)
async function crawlBadminton() {
  console.log('[배드민턴] 안세영 랭킹 정보 (수동 데이터)...');
  
  // BWF 공식 랭킹은 수동으로 업데이트
  const badmintonData = {
    rank: 1,
    player: 'AN Se Young',
    country: 'KOR',
    points: 111490,
    tournaments: 17
  };

  console.log('✓ 배드민턴 데이터 로드 완료:', badmintonData);
  return badmintonData;
}

// 메인 실행
async function main() {
  console.log('=== 스포츠 데이터 크롤링 시작 ===\n');
  
  const [volleyball, baseball, badminton] = await Promise.all([
    crawlVolleyball(),
    crawlBaseball(),
    crawlBadminton()
  ]);

  const sportsRankings = {
    volleyball,
    baseball,
    badminton,
    lastUpdated: new Date().toISOString(),
    seasonDates: {
      baseball: {
        start: '2025-03-29',
        end: '2025-10-05'
      },
      volleyball: {
        start: '2024-10-12',
        end: '2025-04-20'
      }
    }
  };

  // 데이터 저장
  const dataDir = path.join(__dirname, 'public', 'data');
  await fs.mkdir(dataDir, { recursive: true });
  
  const outputPath = path.join(dataDir, 'sports-rankings.json');
  await fs.writeFile(
    outputPath,
    JSON.stringify(sportsRankings, null, 2),
    'utf-8'
  );

  console.log(`\n✓ 크롤링 완료! 데이터 저장됨: ${outputPath}`);
  console.log('=== 크롤링 종료 ===');
}

main().catch(console.error);

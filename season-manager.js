const fs = require('fs');
const path = require('path');

// 시즌 설정 파일 경로
const CONFIG_PATH = path.join(__dirname, 'season-config.json');

// 기본 설정
const DEFAULT_CONFIG = {
  badminton: {
    seasonActive: false,
    currentTournament: null,
    upcomingTournaments: [],
    offSeasonUpdateFrequency: 'biweekly'
  },
  lastUpdated: new Date().toISOString()
};

/**
 * 현재 시즌 설정 읽기
 */
function readSeasonConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return DEFAULT_CONFIG;
    }
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('설정 파일 읽기 오류:', error.message);
    return DEFAULT_CONFIG;
  }
}

/**
 * 시즌 설정 저장
 */
function writeSeasonConfig(config) {
  try {
    config.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log('✓ 설정이 저장되었습니다.');
    return true;
  } catch (error) {
    console.error('✗ 설정 저장 오류:', error.message);
    return false;
  }
}

/**
 * 경기 시즌 시작
 */
function startSeason(tournamentName, startDate, endDate) {
  const config = readSeasonConfig();
  
  config.badminton.seasonActive = true;
  config.badminton.currentTournament = {
    name: tournamentName,
    startDate,
    endDate,
    updateFrequency: 'daily'
  };
  
  writeSeasonConfig(config);
  console.log(`\n🏸 경기 시즌 시작: ${tournamentName}`);
  console.log(`   기간: ${startDate} ~ ${endDate}`);
  console.log(`   업데이트: 매일 3회 (6시, 12시, 18시 KST)`);
}

/**
 * 경기 시즌 종료
 */
function endSeason() {
  const config = readSeasonConfig();
  
  config.badminton.seasonActive = false;
  config.badminton.currentTournament = null;
  
  writeSeasonConfig(config);
  console.log('\n🏸 경기 시즌 종료');
  console.log('   업데이트: 2주마다 1회 (일요일 9시 KST)');
}

/**
 * 예정된 대회 추가
 */
function addUpcomingTournament(tournamentName, startDate, endDate) {
  const config = readSeasonConfig();
  
  config.badminton.upcomingTournaments.push({
    name: tournamentName,
    startDate,
    endDate,
    updateFrequency: 'daily'
  });
  
  writeSeasonConfig(config);
  console.log(`\n✓ 예정 대회 추가: ${tournamentName}`);
  console.log(`   기간: ${startDate} ~ ${endDate}`);
}

/**
 * 현재 상태 확인
 */
function checkStatus() {
  const config = readSeasonConfig();
  const now = new Date();
  
  console.log('\n========================================');
  console.log('배드민턴 시즌 상태');
  console.log('========================================');
  console.log(`현재 시간: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`);
  console.log(`시즌 활성화: ${config.badminton.seasonActive ? '✅ 예' : '❌ 아니오'}`);
  
  if (config.badminton.currentTournament) {
    const t = config.badminton.currentTournament;
    console.log(`\n현재 대회: ${t.name}`);
    console.log(`기간: ${t.startDate} ~ ${t.endDate}`);
    console.log(`업데이트 주기: 매일 3회 (6시, 12시, 18시 KST)`);
  } else {
    console.log(`\n현재 진행 중인 대회: 없음`);
    console.log(`업데이트 주기: 2주마다 1회 (일요일 9시 KST)`);
  }
  
  if (config.badminton.upcomingTournaments.length > 0) {
    console.log('\n예정된 대회:');
    config.badminton.upcomingTournaments.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`);
      console.log(`   ${t.startDate} ~ ${t.endDate}`);
    });
  }
  
  console.log('\n마지막 업데이트:', config.lastUpdated);
  console.log('========================================\n');
}

/**
 * 자동 시즌 체크 (대회 시작/종료 감지)
 */
function autoCheckSeason() {
  const config = readSeasonConfig();
  const today = new Date().toISOString().split('T')[0];
  
  let updated = false;
  
  // 현재 대회 종료 체크
  if (config.badminton.currentTournament) {
    const endDate = config.badminton.currentTournament.endDate;
    if (today > endDate) {
      console.log(`\n⏰ 현재 대회(${config.badminton.currentTournament.name}) 종료됨`);
      config.badminton.currentTournament = null;
      config.badminton.seasonActive = false;
      updated = true;
    }
  }
  
  // 예정 대회 시작 체크
  if (!config.badminton.seasonActive && config.badminton.upcomingTournaments.length > 0) {
    const nextTournament = config.badminton.upcomingTournaments[0];
    if (today >= nextTournament.startDate && today <= nextTournament.endDate) {
      console.log(`\n🎉 새 대회(${nextTournament.name}) 시작!`);
      config.badminton.currentTournament = nextTournament;
      config.badminton.seasonActive = true;
      config.badminton.upcomingTournaments.shift(); // 배열에서 제거
      updated = true;
    }
  }
  
  if (updated) {
    writeSeasonConfig(config);
    checkStatus();
  } else {
    console.log('⏱️  시즌 상태 변경 없음');
  }
  
  return updated;
}

// CLI 명령어 처리
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'start':
      if (args.length < 4) {
        console.log('사용법: node season-manager.js start "대회명" "시작일(YYYY-MM-DD)" "종료일(YYYY-MM-DD)"');
        console.log('예시: node season-manager.js start "BWF 월드투어 파이널스" "2025-12-17" "2025-12-21"');
      } else {
        startSeason(args[1], args[2], args[3]);
      }
      break;
    
    case 'end':
      endSeason();
      break;
    
    case 'add':
      if (args.length < 4) {
        console.log('사용법: node season-manager.js add "대회명" "시작일(YYYY-MM-DD)" "종료일(YYYY-MM-DD)"');
        console.log('예시: node season-manager.js add "말레이시아 마스터스" "2026-01-14" "2026-01-19"');
      } else {
        addUpcomingTournament(args[1], args[2], args[3]);
      }
      break;
    
    case 'status':
      checkStatus();
      break;
    
    case 'auto':
      autoCheckSeason();
      break;
    
    default:
      console.log('\n배드민턴 시즌 관리 도구');
      console.log('=========================\n');
      console.log('사용법:');
      console.log('  node season-manager.js start "대회명" "시작일" "종료일"  - 경기 시즌 시작');
      console.log('  node season-manager.js end                              - 경기 시즌 종료');
      console.log('  node season-manager.js add "대회명" "시작일" "종료일"    - 예정 대회 추가');
      console.log('  node season-manager.js status                           - 현재 상태 확인');
      console.log('  node season-manager.js auto                             - 자동 시즌 체크');
      console.log('\n예시:');
      console.log('  node season-manager.js start "BWF 월드투어 파이널스" "2025-12-17" "2025-12-21"');
      console.log('  node season-manager.js add "말레이시아 마스터스" "2026-01-14" "2026-01-19"');
      console.log('  node season-manager.js status');
      console.log('');
  }
}

module.exports = {
  readSeasonConfig,
  writeSeasonConfig,
  startSeason,
  endSeason,
  addUpcomingTournament,
  checkStatus,
  autoCheckSeason
};

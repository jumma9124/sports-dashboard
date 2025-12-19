const axios = require('axios');

async function debugKOVO() {
  try {
    console.log('🏐 KOVO API 테스트 시작...\n');

    // 1. 순위 데이터 조회
    console.log('📊 순위 데이터 조회 중...');
    try {
      const rankingRes = await axios.get('https://api.kovo.co.kr/team-records', {
        params: {
          season: '079',  // 2024-25 시즌
          league: 'V',    // V-리그
          gender: 'M'     // 남자부
        },
        timeout: 10000
      });
      console.log('✅ 순위 응답 성공!');
      console.log('응답 데이터 구조:', JSON.stringify(rankingRes.data, null, 2));
    } catch (error) {
      console.error('❌ 순위 조회 실패:', error.message);
      if (error.response) {
        console.error('   상태 코드:', error.response.status);
        console.error('   응답 데이터:', error.response.data);
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // 2. 일정 데이터 조회
    console.log('📅 일정 데이터 조회 중...');
    try {
      const scheduleRes = await axios.get('https://api.kovo.co.kr/game-schedule', {
        params: {
          season: '079',
          team: '1005'  // 현대캐피탈
        },
        timeout: 10000
      });
      console.log('✅ 일정 응답 성공!');
      console.log('응답 데이터 구조:', JSON.stringify(scheduleRes.data, null, 2));
    } catch (error) {
      console.error('❌ 일정 조회 실패:', error.message);
      if (error.response) {
        console.error('   상태 코드:', error.response.status);
        console.error('   응답 데이터:', error.response.data);
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // 3. 다른 가능한 엔드포인트 시도
    console.log('🔍 대체 API 엔드포인트 테스트...');
    const alternativeEndpoints = [
      'https://www.kovo.co.kr/api/team-records',
      'https://www.kovo.co.kr/api/game-schedule',
      'https://api.kovo.co.kr/records',
      'https://api.kovo.co.kr/schedule'
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        const res = await axios.get(endpoint, { timeout: 5000 });
        console.log(`✅ ${endpoint} - 성공!`);
        console.log('   응답:', JSON.stringify(res.data).substring(0, 200) + '...');
      } catch (error) {
        console.log(`❌ ${endpoint} - 실패: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ 전체 프로세스 에러:', error.message);
  }
}

console.log('KOVO API 디버깅 도구');
console.log('현대캐피탈 스카이워커스 팀 코드: 1005');
console.log('2024-25 시즌 코드: 079');
console.log('='.repeat(80) + '\n');

debugKOVO();

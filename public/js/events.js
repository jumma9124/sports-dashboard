// public/js/events.js
// 주요 스포츠 이벤트 데이터 로딩 및 표시

async function loadEventsData() {
  console.log('📅 [주요 이벤트] 데이터 로딩 시작...');
  
  try {
    const response = await fetch('./public/data/major-events.json');
    console.log('📅 [주요 이벤트] API 응답:', response.status);
    
    const events = await response.json();
    console.log('📅 [주요 이벤트] 데이터:', events);

    if (!events || events.length === 0) {
      console.log('⚠️ [주요 이벤트] 이벤트 없음');
      displayNoEvents();
      return;
    }

    displayUpcomingEvent(events);
    console.log('📅 [주요 이벤트] 데이터 로딩 완료!');
    
  } catch (error) {
    console.error('❌ [주요 이벤트] 데이터 로딩 실패:', error);
    displayEventsError();
  }
}

function displayUpcomingEvent(events) {
  const eventElement = document.getElementById('major-event');
  if (!eventElement) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 오늘 이후 이벤트만 필터링
  const upcomingEvents = events
    .map(event => ({
      ...event,
      dateObj: new Date(event.date)
    }))
    .filter(event => event.dateObj >= today)
    .sort((a, b) => a.dateObj - b.dateObj);

  if (upcomingEvents.length === 0) {
    displayNoEvents();
    return;
  }

  const nextEvent = upcomingEvents[0];
  const eventDate = nextEvent.dateObj;
  
  // D-day 계산
  const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
  const dDayText = daysUntil === 0 ? 'D-day' : `D-${daysUntil}`;

  const icon = nextEvent.icon || '📅';

  eventElement.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px;">
      <div style="font-size: 2.5rem;">${icon}</div>
      <div style="flex: 1;">
        <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 5px;">${nextEvent.name}</div>
        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">개막 ${dDayText}</div>
      </div>
    </div>
  `;
}

function displayNoEvents() {
  const eventElement = document.getElementById('major-event');
  if (eventElement) {
    eventElement.innerHTML = `
      <div class="event-icon">📅</div>
      <div class="event-info">
        <div class="no-event">예정된 주요 이벤트 없음</div>
      </div>
    `;
  }
}

function displayEventsError() {
  const eventElement = document.getElementById('major-event');
  if (eventElement) {
    eventElement.innerHTML = `
      <div class="event-icon">⚠️</div>
      <div class="event-info">
        <div class="error-message">데이터를 불러올 수 없습니다</div>
      </div>
    `;
  }
}

// 페이지 로드 시 자동 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadEventsData);
} else {
  loadEventsData();
}
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

  // 최대 3개 이벤트 표시
  const top3Events = upcomingEvents.slice(0, 3);
  
  const eventsHTML = top3Events.map((event, index) => {
    const eventDate = event.dateObj;
    const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
    const dDayText = daysUntil === 0 ? 'D-day' : `D-${daysUntil}`;
    const icon = event.icon || '📅';
    
    // 첫 번째 이벤트는 크게, 나머지는 작게
    const isFirst = index === 0;
    const fontSize = isFirst ? '1.1rem' : '0.9rem';
    const iconSize = isFirst ? '2.5rem' : '1.8rem';
    const padding = isFirst ? '15px' : '10px';
    const marginTop = index > 0 ? '8px' : '0';
    
    return `
      <div style="display: flex; align-items: center; gap: 12px; padding: ${padding}; background: rgba(255,255,255,0.05); border-radius: 10px; margin-top: ${marginTop}; border-left: 3px solid ${isFirst ? '#4CAF50' : 'transparent'};">
        <div style="font-size: ${iconSize}; flex-shrink: 0;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: ${fontSize}; font-weight: ${isFirst ? '600' : '500'}; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${event.name}</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.7);">개막 ${dDayText}</div>
        </div>
      </div>
    `;
  }).join('');

  eventElement.innerHTML = eventsHTML;
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
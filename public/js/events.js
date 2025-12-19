// public/js/events.js
// 주요 스포츠 이벤트 데이터 로딩 및 표시

async function loadEventsData() {
  try {
    const response = await fetch('./public/data/major-events.json');
    const events = await response.json();

    if (!events || events.length === 0) {
      displayNoEvents();
      return;
    }

    displayUpcomingEvent(events);
    
  } catch (error) {
    console.error('이벤트 데이터 로딩 실패:', error);
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

  eventElement.innerHTML = `
    <div class="event-icon">⛷️</div>
    <div class="event-info">
      <div class="event-name">${nextEvent.name}</div>
      <div class="event-details">
        <span class="event-date">개막 ${dDayText}</span>
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

const DB_NAME = 'workout_pwa_db';
const DB_VERSION = 2;
let db = null;

/* -------------------------------------------------------------
   1. NATIVE SYNTHESIZED SOUNDS (Zero external assets)
------------------------------------------------------------- */
const AudioEngine = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playCheck() {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {}
  },
  playTada() {
    try {
      this.init();
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.08);
        osc.stop(this.ctx.currentTime + i * 0.08 + 0.3);
      });
    } catch (e) {}
  }
};

/* -------------------------------------------------------------
   2. CELEBRATION CONFETTI
------------------------------------------------------------- */
function fireCelebration() {
  const canvas = document.getElementById('fx-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 75 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.4,
    vx: (Math.random() - 0.5) * 16,
    vy: (Math.random() - 1.2) * 14,
    size: Math.random() * 6 + 4,
    color: ['#00f0ff', '#ccff00', '#ff007a', '#00ff88', '#ff0033'][Math.floor(Math.random() * 5)],
    alpha: 1
  }));

  let frames = 0;
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.alpha -= 0.015;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    frames++;
    if (frames < 70) {
      requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  loop();
}

/* -------------------------------------------------------------
   3. INDEXEDDB SETUP
------------------------------------------------------------- */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains('exercises')) {
        const store = dbInstance.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatUrl(url) {
  if (!url) return '';
  let cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'https://' + cleanUrl;
  }
  return cleanUrl;
}

/* -------------------------------------------------------------
   4. NAVIGATION & VIEW LOGIC
------------------------------------------------------------- */
function switchTab(tab) {
  const trackerSec = document.getElementById('section-tracker');
  const scheduleSec = document.getElementById('section-schedule');
  const trackerBtn = document.getElementById('btn-tab-tracker');
  const scheduleBtn = document.getElementById('btn-tab-schedule');

  if (tab === 'tracker') {
    trackerSec.style.display = 'block';
    scheduleSec.style.display = 'none';
    trackerBtn.classList.add('active');
    scheduleBtn.classList.remove('active');
    const selectedDate = document.getElementById('tracker-date').value || getTodayString();
    loadExercisesForDate(selectedDate);
  } else {
    trackerSec.style.display = 'none';
    scheduleSec.style.display = 'block';
    scheduleBtn.classList.add('active');
    trackerBtn.classList.remove('active');
  }
}

/* -------------------------------------------------------------
   5. STREAK ENGINE & 7-DAY HORIZON VISUALIZATION
------------------------------------------------------------- */
async function renderStreakHorizon(selectedDateStr) {
  const container = document.getElementById('days-horizon-container');
  if (!container || !db) return;

  const todayStr = getTodayString();
  const today = new Date();

  // Generate 7 days: 5 days back, Today, 1 day forward
  const days = [];
  for (let i = -5; i <= 1; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }

  // Fetch all exercises to calculate status and streak
  const tx = db.transaction('exercises', 'readonly');
  const store = tx.objectStore('exercises');
  const allExercises = await new Promise((res) => {
    store.getAll().onsuccess = (e) => res(e.target.result || []);
  });

  // Group exercises by date
  const grouped = {};
  allExercises.forEach((item) => {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date].push(item);
  });

  // Calculate current uninterrupted streak
  let currentStreak = 0;
  let checkDay = new Date(today);

  while (true) {
    const key = formatDateKey(checkDay);
    const dayTasks = grouped[key] || [];

    if (dayTasks.length > 0) {
      const allDone = dayTasks.every((t) => t.completed);
      if (allDone) {
        currentStreak++;
      } else {
        // If today is incomplete, don't break streak if yesterday was completed
        if (key !== todayStr) break;
      }
    } else {
      // If there are no workouts scheduled on today, check if yesterday had streak
      if (key !== todayStr) break;
    }

    checkDay.setDate(checkDay.getDate() - 1);
  }

  document.getElementById('streak-days-count').innerText = currentStreak;
  document.getElementById('streak-active-label').innerText = currentStreak > 0 ? '🔥 On Fire' : 'Consistency';

  // Render the 7-day horizon bubbles
  container.innerHTML = '';
  days.forEach((dateObj) => {
    const dateKey = formatDateKey(dateObj);
    const isToday = dateKey === todayStr;
    const isSelected = dateKey === selectedDateStr;
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
    const dayNum = dateObj.getDate();

    const tasks = grouped[dateKey] || [];
    let icon = '•';
    let statusClass = 'status-rest';

    if (dateKey > todayStr) {
      statusClass = tasks.length > 0 ? 'status-partial' : 'status-future';
      icon = tasks.length > 0 ? '○' : '·';
    } else if (tasks.length > 0) {
      const doneCount = tasks.filter((t) => t.completed).length;
      if (doneCount === tasks.length) {
        statusClass = 'status-completed';
        icon = '✓';
      } else if (doneCount > 0) {
        statusClass = 'status-partial';
        icon = '⚡';
      } else {
        statusClass = isToday ? 'status-partial' : 'status-missed';
        icon = isToday ? '○' : '✕';
      }
    } else {
      statusClass = 'status-rest';
      icon = '—';
    }

    const bubble = document.createElement('div');
    bubble.className = `day-bubble ${isSelected ? 'selected' : ''}`;
    bubble.title = `${dateKey} (${statusClass.replace('status-', '')})`;
    bubble.innerHTML = `
      <span class="day-name">${isToday ? 'TODAY' : dayName}</span>
      <span class="day-number">${dayNum}</span>
      <div class="day-status-icon ${statusClass}">${icon}</div>
    `;

    bubble.addEventListener('click', () => {
      document.getElementById('tracker-date').value = dateKey;
      loadExercisesForDate(dateKey);
    });

    container.appendChild(bubble);
  });
}

/* -------------------------------------------------------------
   6. EXERCISE LIST RENDERING & ACTIONS
------------------------------------------------------------- */
function loadExercisesForDate(dateStr) {
  const listContainer = document.getElementById('exercise-list');
  listContainer.innerHTML = '';

  if (!db) return;

  const tx = db.transaction('exercises', 'readonly');
  const store = tx.objectStore('exercises');
  const index = store.index('date');
  const req = index.getAll(dateStr);

  req.onsuccess = () => {
    const items = req.result || [];
    updateProgress(items);
    renderStreakHorizon(dateStr);

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          ⚡ Rest day or no tasks programmed yet.<br/>Tap <b>Insert Schedule</b> below to set up your protocol.
        </div>`;
      return;
    }

    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = `exercise-item ${item.completed ? 'completed' : ''}`;

      let ytBadgeHtml = '';
      if (item.videoUrl && item.videoUrl.trim() !== '') {
        const validLink = formatUrl(item.videoUrl);
        ytBadgeHtml = `
          <a href="${validLink}" target="_blank" rel="noopener noreferrer" class="yt-link-btn" title="Open Demonstration Video">
            <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span>Watch Form / Demo</span>
          </a>
        `;
      }

      el.innerHTML = `
        <div class="exercise-info">
          <h4>${item.name}</h4>
          <div class="exercise-specs">
            <span class="tag-badge">${item.category}</span>
            <span>${item.sets} sets × ${item.reps}</span>
            ${item.weight > 0 ? `<span>@ <b>${item.weight} kg</b></span>` : ''}
          </div>
          ${ytBadgeHtml}
        </div>
        <div style="display:flex; align-items:center;">
          <button class="check-btn" data-action="toggle" data-id="${item.id}" data-completed="${item.completed}">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </button>
          <button class="del-btn" data-action="delete" data-id="${item.id}">✕</button>
        </div>
      `;
      listContainer.appendChild(el);
    });
  };
}

function updateProgress(items) {
  const total = items.length;
  const completed = items.filter((i) => i.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('progress-bar').style.width = `${percent}%`;
  document.getElementById('progress-percent').innerText = `${percent}%`;
  document.getElementById('streak-counter').innerText = `🔥 ${completed}/${total} Done`;

  if (total > 0 && completed === total) {
    AudioEngine.playTada();
    fireCelebration();
  }
}

function toggleComplete(id, nextState) {
  if (!db) return;
  const tx = db.transaction('exercises', 'readwrite');
  const store = tx.objectStore('exercises');
  const req = store.get(id);

  req.onsuccess = (e) => {
    const data = e.target.result;
    if (data) {
      data.completed = nextState;
      store.put(data);
      if (nextState) AudioEngine.playCheck();
    }
  };

  tx.oncomplete = () => {
    loadExercisesForDate(document.getElementById('tracker-date').value);
  };
}

function deleteExercise(id) {
  if (!db) return;
  const tx = db.transaction('exercises', 'readwrite');
  tx.objectStore('exercises').delete(id);
  tx.oncomplete = () => {
    loadExercisesForDate(document.getElementById('tracker-date').value);
  };
}

/* -------------------------------------------------------------
   7. INITIALIZATION & LISTENERS
------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', async () => {
  await initDB();

  const today = getTodayString();
  const scheduleDateInput = document.getElementById('schedule-date');
  const trackerDateInput = document.getElementById('tracker-date');

  scheduleDateInput.value = today;
  trackerDateInput.value = today;

  document.getElementById('btn-tab-tracker').addEventListener('click', () => switchTab('tracker'));
  document.getElementById('btn-tab-schedule').addEventListener('click', () => switchTab('schedule'));

  trackerDateInput.addEventListener('change', (e) => {
    loadExercisesForDate(e.target.value);
  });

  const pills = document.querySelectorAll('.pill');
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      pills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      document.getElementById('ex-category').value = pill.getAttribute('data-cat');
    });
  });

  const workoutForm = document.getElementById('workout-form');
  workoutForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const targetDate = scheduleDateInput.value || today;
    const exercise = {
      date: targetDate,
      name: document.getElementById('ex-name').value.trim(),
      category: document.getElementById('ex-category').value,
      sets: parseInt(document.getElementById('ex-sets').value, 10) || 3,
      reps: document.getElementById('ex-reps').value.trim() || '10',
      weight: parseFloat(document.getElementById('ex-weight').value) || 0,
      videoUrl: document.getElementById('ex-video').value.trim(),
      completed: false
    };

    const tx = db.transaction('exercises', 'readwrite');
    tx.objectStore('exercises').add(exercise);

    tx.oncomplete = () => {
      workoutForm.reset();
      document.getElementById('ex-sets').value = 3;
      scheduleDateInput.value = targetDate;
      trackerDateInput.value = targetDate;
      switchTab('tracker');
    };
  });

  document.getElementById('exercise-list').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;

    const target = e.target.closest('button');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = parseInt(target.getAttribute('data-id'), 10);

    if (action === 'toggle') {
      const isDone = target.getAttribute('data-completed') === 'true';
      toggleComplete(id, !isDone);
    } else if (action === 'delete') {
      deleteExercise(id);
    }
  });

  loadExercisesForDate(today);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
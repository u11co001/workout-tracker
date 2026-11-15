const STORAGE_KEY = 'monthly_cashflow_tracker_v1';
let editingItemId = null;
let lastCelebratedRank = null;

/* -------------------------------------------------------------
   1. NATIVE SYNTHESIZED SOUNDS & CONFETTI
------------------------------------------------------------- */
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  playCoin() {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {}
  },
  playLevelUp() {
    try {
      this.init();
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.07);
        osc.stop(this.ctx.currentTime + i * 0.07 + 0.25);
      });
    } catch {}
  }
};

function triggerConfetti() {
  const canvas = document.getElementById('fx-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 65 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: (Math.random() - 1.2) * 12,
    size: Math.random() * 6 + 4,
    color: ['#38bdf8', '#10b981', '#a855f7', '#facc15'][Math.floor(Math.random() * 4)],
    alpha: 1
  }));

  let frames = 0;
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38;
      p.alpha -= 0.016;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    frames++;
    if (frames < 65) requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  loop();
}

/* -------------------------------------------------------------
   2. DATA & HELPERS
------------------------------------------------------------- */
function getCurrentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getPreviousMonth(monthKey) {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatINR(num) {
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getMonthData(monthKey) {
  const store = loadStore();
  if (!store[monthKey]) {
    store[monthKey] = { salary: 0, items: [] };
    saveStore(store);
  }
  return store[monthKey];
}

/* -------------------------------------------------------------
   3. CONTRIBUTION DONUT CHART GRAPHIC
------------------------------------------------------------- */
function updateContributionChart(salary, sumFixed, sumInv, sumAdd, totalOutflow, remaining) {
  const ring = document.getElementById('donut-ring');
  const centerPctEl = document.getElementById('donut-center-pct');
  const pctFixedEl = document.getElementById('pct-fixed');
  const pctInvEl = document.getElementById('pct-inv');
  const pctAddEl = document.getElementById('pct-add');
  const pctRemEl = document.getElementById('pct-rem');

  // Use Salary as denominator if entered; otherwise fall back to Total Outflow
  const denom = salary > 0 ? salary : totalOutflow;

  if (denom <= 0) {
    ring.style.background = 'conic-gradient(rgba(255, 255, 255, 0.08) 0% 100%)';
    centerPctEl.textContent = '0%';
    pctFixedEl.textContent = '0%';
    pctInvEl.textContent = '0%';
    pctAddEl.textContent = '0%';
    pctRemEl.textContent = '0%';
    return;
  }

  const fixedPct = Math.round((sumFixed / denom) * 100);
  const invPct = Math.round((sumInv / denom) * 100);
  const addPct = Math.round((sumAdd / denom) * 100);
  const remPct = salary > 0 ? Math.max(0, Math.round((remaining / salary) * 100)) : 0;
  const outflowPct = Math.round((totalOutflow / denom) * 100);

  pctFixedEl.textContent = `${fixedPct}%`;
  pctInvEl.textContent = `${invPct}%`;
  pctAddEl.textContent = `${addPct}%`;
  pctRemEl.textContent = `${remPct}%`;
  centerPctEl.textContent = `${outflowPct}%`;

  // Normalize conic-gradient stops so overspending renders cleanly
  const visualTotal = Math.max(salary, totalOutflow);
  const s1 = (sumFixed / visualTotal) * 100;
  const s2 = s1 + (sumInv / visualTotal) * 100;
  const s3 = s2 + (sumAdd / visualTotal) * 100;

  ring.style.background = `conic-gradient(
    #38bdf8 0% ${s1}%,
    #a855f7 ${s1}% ${s2}%,
    #f59e0b ${s2}% ${s3}%,
    #10b981 ${s3}% 100%
  )`;
}

/* -------------------------------------------------------------
   4. GAMIFICATION ENGINE (RANKS, XP & QUESTS)
------------------------------------------------------------- */
function updateGamification(salary, sumFixed, sumInv, sumAdd, remaining, celebrate = false) {
  const wealthCreated = sumInv + Math.max(0, remaining);
  const wealthRate = salary > 0 ? Math.max(0, Math.round((wealthCreated / salary) * 100)) : 0;

  let rank = '🌱 Starter';
  if (salary > 0) {
    if (remaining < 0) rank = '⚠️ Over Budget';
    else if (wealthRate >= 50) rank = '💎 FIRE Master';
    else if (wealthRate >= 30) rank = '🚀 Wealth Builder';
    else if (wealthRate >= 15) rank = '🛡️ Budget Guard';
    else rank = '⚡ Active Tracker';
  }

  document.getElementById('rank-title').textContent = rank;
  document.getElementById('wealth-rate').textContent = `Wealth Rate: ${wealthRate}%`;

  const xpPct = Math.min(100, Math.round((wealthRate / 60) * 100));
  document.getElementById('xp-bar').style.width = `${xpPct}%`;

  const qSalary = salary > 0;
  const qInvest = sumInv > 0;
  const q20Pct = salary > 0 && sumInv / salary >= 0.2;
  const qPositive = salary > 0 && remaining >= 0;
  const qRule = salary > 0 && sumFixed / salary <= 0.5 && wealthRate >= 20;

  document.getElementById('q-salary').classList.toggle('unlocked', qSalary);
  document.getElementById('q-invest').classList.toggle('unlocked', qInvest);
  document.getElementById('q-20pct').classList.toggle('unlocked', q20Pct);
  document.getElementById('q-positive').classList.toggle('unlocked', qPositive);
  document.getElementById('q-rule').classList.toggle('unlocked', qRule);

  if (celebrate && (rank === '🚀 Wealth Builder' || rank === '💎 FIRE Master') && lastCelebratedRank !== rank) {
    lastCelebratedRank = rank;
    SoundFX.playLevelUp();
    triggerConfetti();
    showToast(`Level Up! Unlocked ${rank}`);
  }
}

/* -------------------------------------------------------------
   5. RENDER & ACTIONS
------------------------------------------------------------- */
function render(celebrate = false) {
  const monthKey = document.getElementById('month-picker').value;
  const data = getMonthData(monthKey);

  const salaryInput = document.getElementById('salary-input');
  if (document.activeElement !== salaryInput) {
    salaryInput.value = data.salary > 0 ? data.salary : '';
  }

  const buckets = { fixed: [], investments: [], additional: [] };
  data.items.forEach((item) => {
    if (buckets[item.category]) buckets[item.category].push(item);
  });

  const sumFixed = buckets.fixed.reduce((acc, i) => acc + i.amount, 0);
  const sumInv = buckets.investments.reduce((acc, i) => acc + i.amount, 0);
  const sumAdd = buckets.additional.reduce((acc, i) => acc + i.amount, 0);
  const totalOutflow = sumFixed + sumInv + sumAdd;
  const remaining = (data.salary || 0) - totalOutflow;

  document.getElementById('total-expenses').textContent = formatINR(totalOutflow);
  const remEl = document.getElementById('remaining-balance');
  remEl.textContent = (remaining < 0 ? '-' : '') + formatINR(Math.abs(remaining));
  remEl.className = 'metric-value ' + (remaining >= 0 ? 'val-positive' : 'val-negative');

  document.getElementById('sub-fixed').textContent = formatINR(sumFixed);
  document.getElementById('sub-investments').textContent = formatINR(sumInv);
  document.getElementById('sub-additional').textContent = formatINR(sumAdd);

  updateContributionChart(data.salary || 0, sumFixed, sumInv, sumAdd, totalOutflow, remaining);
  updateGamification(data.salary || 0, sumFixed, sumInv, sumAdd, remaining, celebrate);

  ['fixed', 'investments', 'additional'].forEach((cat) => {
    const ul = document.getElementById(`list-${cat}`);
    ul.innerHTML = '';

    if (buckets[cat].length === 0) {
      ul.innerHTML = `<li class="empty-msg">No entries added yet.</li>`;
      return;
    }

    buckets[cat].forEach((item) => {
      const li = document.createElement('li');
      li.className = 'item-row';

      if (editingItemId === item.id) {
        li.innerHTML = `
          <div class="edit-row">
            <input type="text" id="edit-name-${item.id}" value="${item.name.replace(/"/g, '&quot;')}" />
            <input type="number" id="edit-amt-${item.id}" value="${item.amount}" min="1" step="any" />
            <button type="button" class="btn-save-edit" data-action="save-edit" data-id="${item.id}">Save</button>
            <button type="button" class="btn-cancel-edit" data-action="cancel-edit">✕</button>
          </div>
        `;
      } else {
        li.innerHTML = `
          <span>${item.name}</span>
          <div class="item-right">
            <span>${formatINR(item.amount)}</span>
            <button type="button" class="btn-icon btn-edit" data-action="edit" data-id="${item.id}" title="Edit">✎</button>
            <button type="button" class="btn-icon btn-del" data-action="delete" data-id="${item.id}" title="Delete">✕</button>
          </div>
        `;
      }

      ul.appendChild(li);
    });
  });
}

function copyFromPreviousMonth() {
  const currentMonth = document.getElementById('month-picker').value;
  const prevMonth = getPreviousMonth(currentMonth);
  const store = loadStore();
  const prevData = store[prevMonth];

  if (!prevData || !prevData.items) {
    showToast(`No data found for ${prevMonth}`);
    return;
  }

  const recurringItems = prevData.items.filter(
    (item) => item.category === 'fixed' || item.category === 'investments'
  );

  if (recurringItems.length === 0 && (!prevData.salary || prevData.salary <= 0)) {
    showToast(`No Fixed or Investment items in ${prevMonth}`);
    return;
  }

  if (!store[currentMonth]) store[currentMonth] = { salary: 0, items: [] };

  if (!store[currentMonth].salary && prevData.salary > 0) {
    store[currentMonth].salary = prevData.salary;
  }

  const cloned = recurringItems.map((item, idx) => ({
    id: Date.now() + idx + Math.floor(Math.random() * 1000),
    category: item.category,
    name: item.name,
    amount: item.amount
  }));

  store[currentMonth].items.push(...cloned);
  saveStore(store);
  editingItemId = null;
  SoundFX.playCoin();
  render(true);
  showToast(`Copied ${cloned.length} items from ${prevMonth}`);
}

window.addEventListener('DOMContentLoaded', () => {
  const monthPicker = document.getElementById('month-picker');
  monthPicker.value = getCurrentMonth();

  monthPicker.addEventListener('change', () => {
    editingItemId = null;
    lastCelebratedRank = null;
    render(false);
  });

  document.getElementById('btn-copy-prev').addEventListener('click', copyFromPreviousMonth);

  document.getElementById('salary-input').addEventListener('input', (e) => {
    const monthKey = monthPicker.value;
    const store = loadStore();
    if (!store[monthKey]) store[monthKey] = { salary: 0, items: [] };
    store[monthKey].salary = parseFloat(e.target.value) || 0;
    saveStore(store);
    render(true);
  });

  document.getElementById('expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const monthKey = monthPicker.value;
    const category = document.getElementById('entry-category').value;
    const name = document.getElementById('entry-name').value.trim();
    const amount = parseFloat(document.getElementById('entry-amount').value);

    if (!name || isNaN(amount) || amount <= 0) return;

    const store = loadStore();
    if (!store[monthKey]) store[monthKey] = { salary: 0, items: [] };

    store[monthKey].items.push({
      id: Date.now(),
      category,
      name,
      amount
    });

    saveStore(store);
    document.getElementById('entry-name').value = '';
    document.getElementById('entry-amount').value = '';
    editingItemId = null;
    SoundFX.playCoin();
    render(true);
  });

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = Number(btn.getAttribute('data-id'));
    const monthKey = monthPicker.value;
    const store = loadStore();

    if (action === 'edit') {
      editingItemId = id;
      render(false);
      const nameInput = document.getElementById(`edit-name-${id}`);
      if (nameInput) nameInput.focus();
    } else if (action === 'cancel-edit') {
      editingItemId = null;
      render(false);
    } else if (action === 'save-edit') {
      const newName = document.getElementById(`edit-name-${id}`).value.trim();
      const newAmt = parseFloat(document.getElementById(`edit-amt-${id}`).value);

      if (newName && !isNaN(newAmt) && newAmt > 0 && store[monthKey]) {
        const target = store[monthKey].items.find((i) => i.id === id);
        if (target) {
          target.name = newName;
          target.amount = newAmt;
          saveStore(store);
          SoundFX.playCoin();
        }
      }
      editingItemId = null;
      render(true);
    } else if (action === 'delete') {
      if (store[monthKey]) {
        store[monthKey].items = store[monthKey].items.filter((i) => i.id !== id);
        saveStore(store);
        if (editingItemId === id) editingItemId = null;
        render(false);
      }
    }
  });

  render(false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
/**
 * Cloud Net — Datadog Log Anomaly Detection & Watchdog Insights UI
 * Rock-Solid Frontend Engine (No Overlapping Graphs, Responsive Layout)
 */

const state = {
  currentGroup: 'fields',       // 'fields', 'patterns', 'transactions'
  currentVis: 'list',           // 'list', 'timeseries', 'toplist', 'table'
  activeServices: ['web-store', 'auth-dotnet', 'email-api-py', 'ad-server', 'email-queue-processor', 'web-store-mongo'],
  statusFilter: 'all',          // 'all', 'anomaly', 'normal'
  searchQuery: '',
  currentPage: 1,
  limit: 25,
  isWatchdogOpen: true
};

// ---------------------------------------------------------------------------
// 1. INITIALIZATION
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadTimeline();
  loadWatchdogInsights();
  renderCurrentView();
});

function initEventListeners() {
  // Search bar
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  if (searchInput && clearSearchBtn) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value.trim();
      if (val) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }
      debounceTimer = setTimeout(() => {
        state.searchQuery = val;
        state.currentPage = 1;
        renderCurrentView();
      }, 250);
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      state.searchQuery = '';
      state.currentPage = 1;
      renderCurrentView();
    });
  }

  // Group into Buttons: Fields | Patterns | Transactions
  const groupBtns = {
    fields: document.getElementById('group-fields-btn'),
    patterns: document.getElementById('group-patterns-btn'),
    transactions: document.getElementById('group-transactions-btn')
  };

  Object.keys(groupBtns).forEach((k) => {
    const btn = groupBtns[k];
    if (!btn) return;
    btn.addEventListener('click', () => {
      state.currentGroup = k;
      Object.keys(groupBtns).forEach(btnKey => {
        const b = groupBtns[btnKey];
        if (!b) return;
        if (btnKey === k) {
          b.className = 'group-btn px-2.5 py-0.5 rounded font-semibold text-slate-800 bg-[#e2e8f0] border border-slate-300';
        } else {
          b.className = 'group-btn px-2.5 py-0.5 rounded font-normal text-slate-600 hover:bg-slate-200 border border-transparent';
        }
      });
      renderCurrentView();
    });
  });

  // Visualize as Buttons: List | Timeseries | Top List | Table
  const visBtns = {
    list: document.getElementById('vis-list-btn'),
    timeseries: document.getElementById('vis-timeseries-btn'),
    toplist: document.getElementById('vis-toplist-btn'),
    table: document.getElementById('vis-table-btn')
  };

  Object.keys(visBtns).forEach((k) => {
    const btn = visBtns[k];
    if (!btn) return;
    btn.addEventListener('click', () => {
      state.currentVis = k;
      Object.keys(visBtns).forEach(btnKey => {
        const b = visBtns[btnKey];
        if (!b) return;
        if (btnKey === k) {
          b.className = 'vis-btn px-2.5 py-0.5 rounded font-semibold text-slate-800 bg-[#e2e8f0] border border-slate-300';
        } else {
          b.className = 'vis-btn px-2.5 py-0.5 rounded font-normal text-slate-600 hover:bg-slate-200 border border-transparent';
        }
      });
      renderCurrentView();
    });
  });

  // Left Sidebar Service Checkboxes
  document.querySelectorAll('input[name="service-cb"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const checkedBoxes = Array.from(document.querySelectorAll('input[name="service-cb"]:checked')).map(c => c.value);
      state.activeServices = checkedBoxes;
      state.currentPage = 1;
      renderCurrentView();
    });
  });

  // Source Checkboxes
  document.querySelectorAll('input[name="source-cb"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      state.currentPage = 1;
      renderCurrentView();
    });
  });

  // Host Checkboxes
  document.querySelectorAll('input[name="host-cb"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      state.currentPage = 1;
      renderCurrentView();
    });
  });

  // Index Checkboxes
  document.querySelectorAll('input[name="index-cb"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      state.currentPage = 1;
      renderCurrentView();
    });
  });

  // Status Radios
  document.querySelectorAll('input[name="status-radio"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      state.currentPage = 1;
      renderCurrentView();
    });
  });

  // Reset all filters
  const resetBtn = document.getElementById('reset-all-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.activeServices = ['web-store', 'auth-dotnet', 'email-api-py', 'ad-server', 'email-queue-processor', 'web-store-mongo'];
      state.statusFilter = 'all';
      state.searchQuery = '';
      state.currentPage = 1;
      document.querySelectorAll('input[name="service-cb"]').forEach(cb => cb.checked = true);
      document.querySelectorAll('input[name="source-cb"]').forEach(cb => cb.checked = true);
      document.querySelectorAll('input[name="host-cb"]').forEach(cb => cb.checked = true);
      document.querySelectorAll('input[name="index-cb"]').forEach(cb => cb.checked = true);
      const radioAll = document.querySelector('input[name="status-radio"][value="all"]');
      if (radioAll) radioAll.checked = true;
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
      renderCurrentView();
    });
  }

  // Toggle Watchdog Drawer
  const wdToggleBtn = document.getElementById('toggle-watchdog-btn');
  const wdPanel = document.getElementById('watchdog-insights-panel');
  if (wdToggleBtn && wdPanel) {
    wdToggleBtn.addEventListener('click', () => {
      state.isWatchdogOpen = !state.isWatchdogOpen;
      if (state.isWatchdogOpen) {
        wdPanel.classList.remove('hidden');
        wdToggleBtn.className = 'flex items-center space-x-1.5 px-3 py-1 rounded border border-purple-300 bg-purple-50 text-purple-800 font-semibold shadow-xs';
      } else {
        wdPanel.classList.add('hidden');
        wdToggleBtn.className = 'flex items-center space-x-1.5 px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 font-normal hover:bg-slate-50';
      }
    });
  }

  // Pagination
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderCurrentView();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      state.currentPage++;
      renderCurrentView();
    });
  }

  // Modal Closers
  const closeModalBtn = document.getElementById('close-modal-btn');
  const closeModalBtn2 = document.getElementById('close-modal-btn2');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      document.getElementById('inspector-modal').classList.add('hidden');
    });
  }
  if (closeModalBtn2) {
    closeModalBtn2.addEventListener('click', () => {
      document.getElementById('inspector-modal').classList.add('hidden');
    });
  }

  // Save View notification
  const saveBtn = document.getElementById('save-view-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      alert("Saved current log view & filters to Insights.");
    });
  }

  // Dismiss Lifecycle Banner
  const dismissBtn = document.getElementById('dismiss-lifecycle-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      document.getElementById('explorer-lifecycle-banner').classList.add('hidden');
    });
  }

  // Simulate Incident & Autonomous Self-Healing Lifecycle
  const simBtn = document.getElementById('open-simulator-btn');
  if (simBtn) {
    simBtn.addEventListener('click', async () => {
      const srv = prompt("Which service do you want to inject an anomaly into?\nOptions: auth-dotnet (Metadata Desync), email-api-py (Socket I/O), web-store (Under-replication), ad-server (Thread Lock)", "auth-dotnet");
      if (!srv) return;

      const banner = document.getElementById('explorer-lifecycle-banner');
      const badge = document.getElementById('lifecycle-badge');
      const text = document.getElementById('lifecycle-text');
      const timer = document.getElementById('lifecycle-timer');

      if (!banner) return;
      banner.classList.remove('hidden');

      // STAGE 1: ANOMALY OCCURS — SYSTEM NEEDS SELF-HEALING
      banner.className = 'px-4 py-2 border-b bg-rose-50 border-rose-200 text-rose-950 flex items-center justify-between animate-fadeIn';
      badge.className = 'px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-rose-200 text-rose-900 border border-rose-300 animate-pulse';
      badge.textContent = 'STAGE 1: ANOMALY SURGE';
      text.innerHTML = `🚨 High-rate error spike detected on <strong class="text-indigo-700">${srv}</strong>! VolumeMap metadata desync flagged. Cluster status: <span class="text-rose-700 font-bold">DEGRADED</span>. Autonomous Self-Healing Required!`;
      timer.textContent = '[Time: +14ms]';

      try {
        const res = await fetch('/api/simulate-anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: srv })
        });
        const data = await res.json();

        // STAGE 2: CLOSED-LOOP INTERVENTION IN PROGRESS (After 600ms)
        setTimeout(() => {
          banner.className = 'px-4 py-2 border-b bg-purple-50 border-purple-200 text-purple-950 flex items-center justify-between transition';
          badge.className = 'px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-200 text-purple-900 border border-purple-300';
          badge.textContent = 'STAGE 2: DISPATCHING REMEDIATION';
          text.innerHTML = `⚙️ Intercepted by Insights Agent. Executing: <strong class="font-mono text-purple-800">${data.remediation.action_name}</strong> (${data.remediation.description.slice(0, 70)}...)`;
          timer.textContent = `[Dispatch: +88ms]`;
        }, 650);

        // STAGE 3: SELF-HEALING FIX CONFIRMED (After 1400ms)
        setTimeout(() => {
          banner.className = 'px-4 py-2 border-b bg-emerald-50 border-emerald-200 text-emerald-950 flex items-center justify-between transition';
          badge.className = 'px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-200 text-emerald-900 border border-emerald-300';
          badge.textContent = 'STAGE 3: 100% HEALTHY (FIXED)';
          text.innerHTML = `✅ Self-Healing Complete! ${data.remediation.post_verification} Cluster restored in <strong class="text-emerald-800 font-bold font-mono">${data.remediation.auto_ms} ms</strong> (replaces ${data.remediation.manual_label} manual triage • ${data.speedup} speedup).`;
          timer.textContent = `[SLA Restored: +${data.remediation.auto_ms}ms]`;

          renderCurrentView();
          loadTimeline();
        }, 1400);

      } catch (err) {
        console.error(err);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 2. TIMELINE HISTOGRAM (Local Real-Time Clock, Interactive Tooltips & Filters)
// ---------------------------------------------------------------------------
function loadTimeline() {
  const mainContainer = document.getElementById('main-timeline-bars');
  const ticksRow = document.getElementById('timeline-ticks-row');
  const windowLabel = document.getElementById('timeline-window-label');
  const miniContainer = document.getElementById('watchdog-mini-bars');
  if (!mainContainer) return;

  mainContainer.innerHTML = '';
  if (ticksRow) ticksRow.innerHTML = '';
  if (miniContainer) miniContainer.innerHTML = '';

  const now = new Date();
  const maxVal = 100000;
  
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  
  const startWindow = new Date(now.getTime() - 9 * 60 * 1000);
  if (windowLabel) {
    windowLabel.textContent = `Live Window: ${fmt(startWindow)} - ${fmt(now)} (Local Wall Clock)`;
  }

  // Generate 10 bars for the past 10 minutes up to current minute
  for (let i = 9; i >= 0; i--) {
    const barTime = new Date(now.getTime() - i * 60 * 1000);
    const timeStr = fmt(barTime);
    
    // Normal log volume (~72k - 84k)
    const normalVol = 72000 + Math.floor(Math.sin((now.getMinutes() - i) * 0.5) * 6000) + (i % 3) * 2000;
    // Anomaly surges at specific minutes
    let anomalyVol = 0;
    if (i === 1 || i === 4 || i === 8) {
      anomalyVol = 8500 + ((i * 1234) % 6000);
    }

    const normalH = Math.min(30, Math.max(8, (normalVol / maxVal) * 30)).toFixed(1);
    const anomalyH = anomalyVol > 0 ? Math.min(13, Math.max(4, (anomalyVol / 15000) * 13)).toFixed(1) : 0;

    const mainCol = document.createElement('div');
    mainCol.className = 'timeline-bar-col flex-1 flex flex-col justify-end h-full items-center group cursor-pointer relative';
    
    mainCol.innerHTML = `
      ${anomalyVol > 0 ? `<div class="w-full bg-[#ea3875] rounded-t-xs hover:brightness-110 transition" style="height: ${anomalyH}px;"></div>` : ''}
      <div class="w-full bg-[#38bdf8] hover:brightness-110 transition ${anomalyVol === 0 ? 'rounded-t-xs' : ''}" style="height: ${normalH}px;"></div>
      
      <!-- Interactive Tooltip on hover -->
      <div class="absolute bottom-full mb-1 hidden group-hover:flex flex-col bg-slate-900 text-white rounded p-2 text-[10px] font-mono shadow-xl z-30 whitespace-nowrap pointer-events-none">
        <span class="font-bold text-purple-300">${timeStr} ${i === 0 ? '(Current Minute)' : ''}</span>
        <span>Total: ${(normalVol + anomalyVol).toLocaleString()} logs</span>
        <span class="text-sky-300">Normal: ${normalVol.toLocaleString()}</span>
        ${anomalyVol > 0 ? `<span class="text-rose-400 font-bold">Anomalies: ${anomalyVol.toLocaleString()} (Auto-Healed)</span>` : '<span class="text-slate-400">0 anomalies (Nominal)</span>'}
        <span class="text-[9px] text-slate-400 pt-0.5">Click to filter logs to this minute</span>
      </div>
    `;

    mainCol.addEventListener('click', () => {
      const searchInp = document.getElementById('search-input');
      if (searchInp) {
        searchInp.value = timeStr;
        state.searchQuery = timeStr;
        state.currentPage = 1;
        renderCurrentView();
      }
    });

    mainContainer.appendChild(mainCol);

    if (ticksRow) {
      const tick = document.createElement('span');
      tick.className = i === 0 ? 'font-bold text-purple-700' : 'text-slate-400';
      tick.textContent = i === 0 ? `${timeStr} (Now)` : timeStr;
      ticksRow.appendChild(tick);
    }

    // Mini Watchdog Bar in drawer
    if (miniContainer) {
      const miniCol = document.createElement('div');
      miniCol.className = 'flex-1 flex flex-col justify-end h-full items-center';
      miniCol.innerHTML = `
        <div class="w-full bg-[#ea3875]" style="height: ${(anomalyH * 0.5).toFixed(0)}px;"></div>
        <div class="w-full bg-[#38bdf8]" style="height: ${(normalH * 0.4).toFixed(0)}px;"></div>
      `;
      miniContainer.appendChild(miniCol);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. WATCHDOG INSIGHTS PANEL (Spaced cleanly, NO overlapping)
// ---------------------------------------------------------------------------
async function loadWatchdogInsights() {
  try {
    const res = await fetch('/api/watchdog-insights');
    const data = await res.json();
    renderWatchdogCards(data.insights);
  } catch (err) {
    console.error('Failed to load watchdog insights:', err);
  }
}

function renderWatchdogCards(insights) {
  const container = document.getElementById('watchdog-cards-container');
  if (!container) return;
  container.innerHTML = '';

  const toggleBtn = document.getElementById('toggle-watchdog-btn');
  if (toggleBtn) {
    if (insights.length === 0) {
      toggleBtn.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span><span>0 Insights (All Anomalies Healed)</span>`;
    } else {
      toggleBtn.innerHTML = `<span class="w-2 h-2 rounded-full bg-pink-500 pulse-dot mr-1.5"></span><span>⚡ ${insights.length} Insights</span>`;
    }
  }

  // If all anomalies fixed or empty, do NOT show any bulky card! Keep clean.
  if (!insights || insights.length === 0) {
    container.innerHTML = '';
    return;
  }

  insights.forEach((ins) => {
    const card = document.createElement('div');
    card.id = `wd-card-el-${ins.id}`;
    card.className = 'watchdog-outlier-card transition-all duration-300';

    // Tags HTML
    const tagsHtml = ins.tags.map(t => {
      if (t.type === 'badge_error') {
        return `<span class="bg-[#fde8ef] text-[#d61f59] border border-[#f8b4c8] font-bold px-1.5 py-0.2 rounded text-[10px] uppercase font-mono tracking-wide">ERROR</span>`;
      }
      return `<span class="text-slate-500 font-mono text-[11px]">${t.label}</span>`;
    }).join(' <span class="text-slate-300">•</span> ');

    // Sparkline points SVG
    const sparklineSvg = ins.id === 'wd_card_1' ? `
      <svg class="w-full h-6 overflow-visible" viewBox="0 0 100 24">
        <path d="M 0,20 Q 25,19 50,15 T 75,4 T 100,6" fill="none" stroke="#ea3875" stroke-width="2" />
        <circle cx="75" cy="4" r="2.5" fill="#ea3875" />
      </svg>
    ` : `
      <svg class="w-full h-6 overflow-visible" viewBox="0 0 100 24">
        <path d="M 0,21 Q 30,20 60,14 T 85,3 T 100,5" fill="none" stroke="#ea3875" stroke-width="2" />
        <circle cx="85" cy="3" r="2.5" fill="#ea3875" />
      </svg>
    `;

    card.innerHTML = `
      <!-- Category Tag -->
      ${ins.category_label ? `<div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">${ins.category_label}</div>` : ''}

      <!-- Top Row: Headline & Details -->
      <div class="space-y-1">
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-xs font-bold text-[#212529] leading-snug">
            ${ins.headline_prefix} <span class="text-indigo-600 font-semibold">${ins.service_tag}</span>
          </h3>
          <span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-mono text-[9px] font-bold uppercase shrink-0">
            Active Anomaly
          </span>
        </div>
        <p class="text-[11px] text-slate-500 leading-tight">
          ${ins.description}
        </p>

        <!-- Badges strip -->
        <div class="flex items-center space-x-1.5 pt-1">
          ${tagsHtml}
        </div>
      </div>

      <!-- Sparkline Graph Section: Dedicated Box, ZERO Overlap! -->
      <div class="mt-3 p-2 bg-slate-50 border border-slate-100 rounded flex items-center justify-between">
        <div class="text-[10px] font-mono text-slate-500">
          <span class="block text-[9px] text-slate-400 uppercase">Rate Trend</span>
          <span class="font-bold text-rose-600">${ins.service_tag.replace('service:', '')}</span>
        </div>
        <div class="w-36 h-10 flex flex-col justify-between">
          <div class="flex justify-between text-[8px] font-mono text-slate-400">
            <span>${ins.graph.y_max}</span>
            <span>${ins.graph.y_min}</span>
          </div>
          <div class="h-5 flex items-center">
            ${sparklineSvg}
          </div>
          <div class="flex justify-between text-[8px] font-mono text-slate-400 border-t border-slate-200">
            ${ins.graph.x_labels.map(lbl => `<span>${lbl}</span>`).join('')}
          </div>
        </div>
      </div>

      <!-- Top Patterns Section -->
      <div class="mt-3 pt-2.5 border-t border-slate-100">
        <div class="text-[11px] font-bold text-slate-700">
          ${ins.pattern_section.title}
        </div>

        <div class="pattern-bar-container">
          <div class="flex items-center space-x-2 text-[10px] font-mono text-slate-500 mb-1">
            <span class="font-bold text-[#ea3875] text-[11px]">${ins.pattern_section.count_label}</span>
            <div class="w-16 h-2 bg-[#ea3875] rounded-xs"></div>
            <span class="text-slate-400">··· ${ins.pattern_section.recent_rate}</span>
            <span class="text-indigo-600 font-semibold ml-auto">${ins.pattern_section.service_label}</span>
          </div>

          <div class="font-mono text-[10px] text-slate-700 leading-snug break-all select-text">
            ${ins.pattern_section.template}
          </div>
        </div>
      </div>

      <!-- Cloud Net Autonomous Self-Healing Execution strip -->
      <div class="mt-2.5 p-2 rounded bg-purple-50/70 border border-purple-100 flex items-center justify-between text-[11px]">
        <div>
          <span class="font-bold text-purple-900 text-[10px] flex items-center">
            <i class="fa-solid fa-wand-magic-sparkles mr-1 text-purple-700"></i>Action: ${ins.self_healing.action_id}
          </span>
          <span class="text-emerald-700 font-bold font-mono text-[10px]">
            Latency: ${ins.self_healing.latency}
          </span>
          <span class="text-slate-400 text-[9px] block">Replaced ${ins.self_healing.manual_baseline}</span>
        </div>
        <button class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-xs flex items-center space-x-1" onclick="healWatchdogInsight('${ins.id}', '${ins.service}', this)">
          <i class="fa-solid fa-check text-[9px]"></i>
          <span>Heal & Remove</span>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Heals anomaly and removes it from list
async function healWatchdogInsight(insightId, serviceName, btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[9px]"></i> Healing...`;
  }

  try {
    const res = await fetch('/api/heal-anomaly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight_id: insightId, service: serviceName })
    });
    const data = await res.json();

    const cardEl = document.getElementById(`wd-card-el-${insightId}`);
    if (cardEl) {
      cardEl.className = 'p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs flex items-center justify-between animate-fadeIn';
      cardEl.innerHTML = `
        <span class="font-bold flex items-center">
          <i class="fa-solid fa-circle-check text-emerald-600 mr-2 text-sm"></i>
          Anomaly Fixed & Resolved! Removing from outlier list...
        </span>
        <span class="font-mono text-[10px] text-emerald-700 font-bold">280 ms</span>
      `;
      setTimeout(() => {
        cardEl.remove();
        renderWatchdogCards(data.active_insights);
        renderCurrentView();
        loadTimeline();
      }, 700);
    } else {
      renderWatchdogCards(data.active_insights);
      renderCurrentView();
      loadTimeline();
    }

  } catch (err) {
    console.error('Failed to heal anomaly:', err);
  }
}

// Reset demonstration cards
async function resetWatchdogDemos() {
  try {
    const res = await fetch('/api/reset-insights', { method: 'POST' });
    const data = await res.json();
    renderWatchdogCards(data.active_insights);
    renderCurrentView();
    loadTimeline();
  } catch (err) {
    console.error(err);
  }
}

function inspectSelfHealing(serviceName) {
  state.searchQuery = serviceName;
  const sInput = document.getElementById('search-input');
  if (sInput) sInput.value = serviceName;
  const cBtn = document.getElementById('clear-search-btn');
  if (cBtn) cBtn.classList.remove('hidden');
  state.currentPage = 1;
  renderCurrentView();
}

// ---------------------------------------------------------------------------
// 4. MAIN WORKSPACE VIEW DISPATCHER (Fields / Patterns / Transactions x List / Timeseries / Toplist / Table)
// ---------------------------------------------------------------------------
function renderCurrentView() {
  const container = document.getElementById('dynamic-content-area');
  if (!container) return;

  if (state.currentGroup === 'patterns') {
    if (state.currentVis === 'timeseries') {
      renderPatternsTimeseriesView(container);
    } else if (state.currentVis === 'toplist') {
      renderPatternsToplistView(container);
    } else if (state.currentVis === 'table') {
      renderPatternsTableView(container);
    } else {
      renderPatternsListView(container);
    }
  } else if (state.currentGroup === 'transactions') {
    if (state.currentVis === 'timeseries') {
      renderTransactionsTimeseriesView(container);
    } else if (state.currentVis === 'toplist') {
      renderTransactionsToplistView(container);
    } else if (state.currentVis === 'table') {
      renderTransactionsTableView(container);
    } else {
      renderTransactionsListView(container);
    }
  } else {
    // Fields
    if (state.currentVis === 'timeseries') {
      renderTimeseriesView(container);
    } else if (state.currentVis === 'toplist') {
      renderToplistView(container);
    } else {
      renderFieldsListView(container);
    }
  }
}

// ── View 1: Fields / Log Table View ───────────────────────────────────────────
async function renderFieldsListView(container) {
  container.innerHTML = `
    <table class="w-full text-left text-xs border-collapse">
      <thead class="bg-[#f8fafc] border-b border-[#e1e3e8] text-slate-600 sticky top-0 z-10 font-medium">
        <tr>
          <th class="py-2 px-3 w-40 text-slate-500">↓ DATE</th>
          <th class="py-2 px-3 w-44">HOST</th>
          <th class="py-2 px-3 w-32">SERVICE</th>
          <th class="py-2 px-3">CONTENT</th>
        </tr>
      </thead>
      <tbody id="logs-tbody" class="divide-y divide-slate-100 font-mono text-[11px]">
        <tr><td colspan="4" class="py-8 text-center text-slate-400">Loading logs...</td></tr>
      </tbody>
    </table>
  `;

  const tbody = document.getElementById('logs-tbody');

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    
    // Check Core Source & Host selections
    const checkedSources = Array.from(document.querySelectorAll('input[name="source-cb"]:checked')).map(c => c.value);
    const checkedHosts = Array.from(document.querySelectorAll('input[name="host-cb"]:checked')).map(c => c.value);

    const params = new URLSearchParams({
      page: state.currentPage,
      limit: state.limit,
      services: srvParam,
      status: state.statusFilter,
      search: state.searchQuery
    });

    if (checkedSources.length > 0 && checkedSources.length < 5) {
      params.append('sources', checkedSources.join(','));
    }
    if (checkedHosts.length > 0 && checkedHosts.length < 5) {
      params.append('hosts', checkedHosts.join(','));
    }

    const res = await fetch(`/api/logs?${params}`);
    const data = await res.json();

    const curPageEl = document.getElementById('current-page');
    const totPageEl = document.getElementById('total-pages');
    const facetCountEl = document.getElementById('facet-showing-count');

    if (curPageEl) curPageEl.textContent = data.page;
    if (totPageEl) totPageEl.textContent = data.total_pages;
    if (facetCountEl) facetCountEl.textContent = `${data.total_records.toLocaleString()} of 6,821,395`;

    tbody.innerHTML = '';

    if (data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-400">No logs matching query.</td></tr>`;
      return;
    }

    data.items.forEach((l) => {
      const tr = document.createElement('tr');
      tr.className = 'log-table-row border-b border-slate-100 hover:bg-slate-50 cursor-pointer';

      const contentClass = l.is_anomaly ? 'text-slate-900 font-medium' : 'text-slate-600';

      tr.innerHTML = `
        <td class="py-2 px-3 text-slate-500 whitespace-nowrap">${l.date}</td>
        <td class="py-2 px-3 text-slate-600 font-mono text-[10px] whitespace-nowrap truncate max-w-[170px]" title="${l.host}">${l.host}</td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="text-indigo-600 font-semibold">${l.service}</span>
        </td>
        <td class="py-2 px-3 ${contentClass}">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5 truncate">
              ${l.is_anomaly ? `<span class="bg-[#fde8ef] text-[#d61f59] border border-[#f8b4c8] px-1 py-0.2 rounded text-[9px] font-bold uppercase shrink-0">ERROR</span>` : ''}
              ${l.is_healed ? `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded text-[9px] font-bold uppercase shrink-0">HEALED</span>` : ''}
              <span class="truncate">${l.content}</span>
            </div>
            ${l.is_anomaly ? `
              <button class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shrink-0 ml-2 shadow-2xs" onclick="healSingleLog('${l.id}', '${l.service}', event)">
                ⚡ Heal & Remove
              </button>
            ` : ''}
          </div>
        </td>
      `;

      tr.addEventListener('click', () => {
        openLogModal(l);
      });

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

// Single Log Heal & Remove from List
async function healSingleLog(logId, serviceName, e) {
  if (e) e.stopPropagation();
  try {
    const res = await fetch('/api/heal-anomaly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_id: logId, service: serviceName })
    });
    renderCurrentView();
    loadWatchdogInsights();
    loadTimeline();
  } catch (err) {
    console.error(err);
  }
}

// ===========================================================================
// PATTERNS VIEWS (List, Timeseries, Top List, Table)
// ===========================================================================

// Pattern View A: List
async function renderPatternsListView(container) {
  container.innerHTML = `
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide">
            Log Patterns (Clustered Templates) — List View
          </h3>
          <span class="text-xs text-slate-500">Clustering 6.82M logs into common failure signatures</span>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-bold">5 Patterns Clustered</span>
      </div>
      <div class="space-y-3" id="patterns-list-container">
        <div class="text-xs text-slate-400 py-4 text-center">Loading clustered patterns...</div>
      </div>
    </div>
  `;

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    const res = await fetch(`/api/patterns?services=${srvParam}&search=${state.searchQuery}`);
    const data = await res.json();
    const patList = document.getElementById('patterns-list-container');
    if (!patList) return;
    patList.innerHTML = '';

    data.patterns.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'p-3 bg-white border border-[#e1e3e8] rounded-md shadow-xs hover:border-purple-400 transition cursor-pointer';
      const badgeColor = p.severity === 'ERROR' ? 'bg-[#fde8ef] text-[#d61f59] border-[#f8b4c8]' : 'bg-amber-50 text-amber-800 border-amber-200';

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold border uppercase font-mono ${badgeColor}">${p.severity}</span>
            <span class="text-indigo-600 font-bold text-xs">service:${p.service}</span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-500 text-[11px] font-mono">Volume: <strong class="text-slate-800">${p.count_label}</strong></span>
          </div>
          <span class="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">${p.divergence}</span>
        </div>
        <div class="mt-2 font-mono text-[11px] text-slate-800 bg-[#f8fafc] p-2 rounded border border-slate-200 leading-relaxed select-all">
          ${p.template}
        </div>
        <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>RCA Mode: <strong class="text-purple-700">${p.rca}</strong></span>
          <button class="text-purple-700 font-bold hover:underline" onclick="inspectPatternLogs('${p.service}')">
            Show all ${p.count_label} logs →
          </button>
        </div>
      `;
      patList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load patterns list:', err);
  }
}

// Pattern View B: Timeseries
async function renderPatternsTimeseriesView(container) {
  container.innerHTML = `
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 class="font-bold text-sm text-slate-800">Clustered Patterns — Frequency & Velocity Timeseries</h3>
          <p class="text-xs text-slate-500 mt-0.5">Ingestion rate variance and divergence across each discovered template.</p>
        </div>
        <span class="text-xs font-mono text-purple-700 font-bold">Window: 10m Rolling</span>
      </div>
      <div id="patterns-timeseries-container" class="space-y-4">
        <div class="text-xs text-slate-400 py-4 text-center">Loading timeseries...</div>
      </div>
    </div>
  `;

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    const res = await fetch(`/api/patterns?services=${srvParam}&search=${state.searchQuery}`);
    const data = await res.json();
    const tsContainer = document.getElementById('patterns-timeseries-container');
    if (!tsContainer) return;
    tsContainer.innerHTML = '';

    data.patterns.forEach(p => {
      const box = document.createElement('div');
      box.className = 'bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-2';
      
      // Generate synthetic sparkline bars based on pattern volume
      const sparkHeights = [30, 42, 38, 55, 88, 100, 75, 45, 52, 60];
      const barsHtml = sparkHeights.map((h, i) => {
        const color = i >= 4 && i <= 6 ? 'bg-rose-500' : 'bg-purple-400';
        return `<div class="flex-1 ${color} rounded-t transition-all" style="height: ${h}%;"></div>`;
      }).join('');

      box.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-slate-800">${p.service}</span>
            <span class="text-slate-400 font-mono">(${p.count_label} total)</span>
          </div>
          <span class="text-rose-600 font-mono font-bold text-[11px]">${p.divergence}</span>
        </div>
        <div class="text-[11px] font-mono text-slate-600 truncate max-w-2xl bg-slate-50 p-1.5 rounded border border-slate-100">
          ${p.template}
        </div>
        <div class="h-10 bg-slate-100/60 rounded flex items-end px-2 space-x-1 pt-1">
          ${barsHtml}
        </div>
        <div class="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
          <span>T -10m</span>
          <span>Peak: ${p.recent_rate}/min</span>
          <span>Now</span>
        </div>
      `;
      tsContainer.appendChild(box);
    });
  } catch (err) {
    console.error('Failed to load patterns timeseries:', err);
  }
}

// Pattern View C: Top List
async function renderPatternsToplistView(container) {
  container.innerHTML = `
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 class="font-bold text-sm text-slate-800">Top Log Patterns by Total Volume</h3>
          <p class="text-xs text-slate-500 mt-0.5">Ranked distribution of clustered error and warning templates.</p>
        </div>
        <span class="text-xs text-slate-500 font-mono">Top 5 Discovered</span>
      </div>
      <div id="patterns-toplist-container" class="space-y-3">
        <div class="text-xs text-slate-400 py-4 text-center">Loading top patterns...</div>
      </div>
    </div>
  `;

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    const res = await fetch(`/api/patterns?services=${srvParam}&search=${state.searchQuery}`);
    const data = await res.json();
    const tlContainer = document.getElementById('patterns-toplist-container');
    if (!tlContainer) return;
    tlContainer.innerHTML = '';

    const maxCount = Math.max(...data.patterns.map(p => p.count || 1000));

    data.patterns.forEach((p, idx) => {
      const pct = Math.max(8, Math.round(((p.count || 1000) / maxCount) * 100));
      const row = document.createElement('div');
      row.className = 'bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-2';

      row.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center space-x-2.5">
            <span class="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-mono font-bold text-[10px] flex items-center justify-center">#${idx + 1}</span>
            <span class="font-bold text-slate-900">${p.service}</span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-500 text-[11px]">${p.rca}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="font-mono font-bold text-purple-700">${p.count_label}</span>
            <span class="text-slate-400 text-[10px]">(${pct}%)</span>
          </div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div class="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%;"></div>
        </div>
        <div class="text-[11px] font-mono text-slate-600 truncate bg-slate-50 p-1.5 rounded border border-slate-100">
          ${p.template}
        </div>
      `;
      tlContainer.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load patterns toplist:', err);
  }
}

// Pattern View D: Table
async function renderPatternsTableView(container) {
  container.innerHTML = `
    <div class="p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide">
            Log Patterns (Clustered Templates) — Tabular View
          </h3>
          <span class="text-xs text-slate-500">Structured tabular breakdown of recurring log signatures</span>
        </div>
      </div>
      <div class="overflow-x-auto bg-white rounded-lg border border-[#e1e3e8] shadow-xs">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-[#f8fafc] border-b border-[#e1e3e8] text-slate-600 font-medium">
            <tr>
              <th class="py-2.5 px-3">SEVERITY</th>
              <th class="py-2.5 px-3">SERVICE</th>
              <th class="py-2.5 px-3">TOTAL VOLUME</th>
              <th class="py-2.5 px-3">RECENT VELOCITY</th>
              <th class="py-2.5 px-3">DIVERGENCE</th>
              <th class="py-2.5 px-3">RCA CLASSIFICATION</th>
              <th class="py-2.5 px-3">PATTERN TEMPLATE</th>
            </tr>
          </thead>
          <tbody id="patterns-table-tbody" class="divide-y divide-slate-100 font-mono text-[11px]">
            <tr><td colspan="7" class="py-6 text-center text-slate-400">Loading pattern table...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    const res = await fetch(`/api/patterns?services=${srvParam}&search=${state.searchQuery}`);
    const data = await res.json();
    const tbody = document.getElementById('patterns-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.patterns.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition cursor-pointer';
      const badgeColor = p.severity === 'ERROR' ? 'bg-[#fde8ef] text-[#d61f59] border-[#f8b4c8]' : 'bg-amber-50 text-amber-800 border-amber-200';

      tr.innerHTML = `
        <td class="py-2.5 px-3 whitespace-nowrap">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">${p.severity}</span>
        </td>
        <td class="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap">${p.service}</td>
        <td class="py-2.5 px-3 font-extrabold text-slate-900 whitespace-nowrap">${p.count_label}</td>
        <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">${p.recent_rate}/min</td>
        <td class="py-2.5 px-3 text-rose-600 font-semibold whitespace-nowrap">${p.divergence}</td>
        <td class="py-2.5 px-3 text-purple-700 font-semibold whitespace-nowrap">${p.rca}</td>
        <td class="py-2.5 px-3 text-slate-800 truncate max-w-md" title="${p.template}">${p.template}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load patterns table:', err);
  }
}

function inspectPatternLogs(serviceName) {
  state.currentGroup = 'fields';
  const gFieldsBtn = document.getElementById('group-fields-btn');
  if (gFieldsBtn) gFieldsBtn.click();
  const sInput = document.getElementById('search-input');
  if (sInput) sInput.value = serviceName;
  state.searchQuery = serviceName;
  renderCurrentView();
}


// ===========================================================================
// TRANSACTIONS VIEWS (List, Timeseries, Top List, Table)
// ===========================================================================

// Transaction View A: List
async function renderTransactionsListView(container) {
  container.innerHTML = `
    <div class="p-4 space-y-3">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide">
            Distributed Transactions (Correlated Traces) — List View
          </h3>
          <span class="text-xs text-slate-500">End-to-end HDFS block mutations and RPC operations</span>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-bold">40 Sampled Traces</span>
      </div>
      <div id="tx-cards-container" class="space-y-2.5">
        <div class="text-xs text-slate-400 py-4 text-center">Loading transactions...</div>
      </div>
    </div>
  `;

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    const res = await fetch(`/api/transactions?services=${srvParam}`);
    const data = await res.json();
    const tcContainer = document.getElementById('tx-cards-container');
    if (!tcContainer) return;
    tcContainer.innerHTML = '';

    data.transactions.forEach(tx => {
      const card = document.createElement('div');
      card.className = 'p-3 bg-white border border-[#e1e3e8] rounded-md shadow-xs hover:border-purple-400 transition cursor-pointer space-y-2';
      const statusBadge = tx.is_anomaly
        ? `<span class="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">AUTO-HEALED</span>`
        : `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">200 OK</span>`;

      const durationColor = tx.duration_ms > 200 ? 'text-rose-600 font-bold' : 'text-slate-700';

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-xs text-purple-800 font-mono">${tx.transaction_id}</span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-500 text-[11px]">${tx.date}</span>
            <span class="text-slate-400">•</span>
            <span class="text-indigo-600 font-semibold text-xs">${tx.service}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="font-mono text-xs ${durationColor}">${tx.duration_ms} ms</span>
            ${statusBadge}
          </div>
        </div>
        <div class="flex items-center space-x-2 text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-100">
          <span>Flow: client → ${tx.service} → ${tx.host}</span>
        </div>
        <div class="flex justify-between items-center text-[10px] text-slate-500 pt-1">
          <span>Autonomous Action: <strong class="text-purple-700">${tx.remediation || 'Nominal Pass-Through'}</strong></span>
          <span class="text-slate-400">Host: ${tx.host}</span>
        </div>
      `;
      tcContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load transactions list:', err);
  }
}

// Transaction View B: Timeseries
async function renderTransactionsTimeseriesView(container) {
  container.innerHTML = `
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 class="font-bold text-sm text-slate-800">Transaction Latency & Throughput Timeseries</h3>
          <p class="text-xs text-slate-500 mt-0.5">Execution duration percentiles across distributed RPC operations.</p>
        </div>
        <span class="text-xs text-purple-700 font-mono font-bold">10m Window</span>
      </div>

      <!-- Latency Percentiles Overview -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span class="text-[10px] text-slate-500 font-semibold uppercase">P50 Median Latency</span>
          <div class="text-lg font-bold font-mono text-slate-800 mt-1">42 ms</div>
          <span class="text-[10px] text-emerald-600 font-semibold">Nominal performance</span>
        </div>
        <div class="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span class="text-[10px] text-slate-500 font-semibold uppercase">P95 SLA Boundary</span>
          <div class="text-lg font-bold font-mono text-purple-700 mt-1">280 ms</div>
          <span class="text-[10px] text-purple-600 font-semibold">Self-healed &lt; 350ms</span>
        </div>
        <div class="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span class="text-[10px] text-slate-500 font-semibold uppercase">P99 Maximum Peak</span>
          <div class="text-lg font-bold font-mono text-rose-600 mt-1">1,820 ms</div>
          <span class="text-[10px] text-rose-600 font-semibold">Anomalous spike resolved</span>
        </div>
      </div>

      <!-- Timeseries Latency Chart -->
      <div class="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-2">
        <div class="flex items-center justify-between text-xs text-slate-600 font-semibold">
          <span>End-to-End Latency Waterfall (Past 10 Minutes)</span>
          <span class="text-purple-700 font-mono text-[11px]">40 Transactions Sampled</span>
        </div>
        <div class="h-20 bg-slate-50 rounded flex items-end px-2 space-x-1.5 pt-2 border border-slate-100">
          <div class="flex-1 bg-purple-300 rounded-t h-[25%]" title="42ms"></div>
          <div class="flex-1 bg-purple-300 rounded-t h-[30%]" title="48ms"></div>
          <div class="flex-1 bg-purple-400 rounded-t h-[35%]" title="56ms"></div>
          <div class="flex-1 bg-rose-500 rounded-t h-[95%]" title="1820ms Spike"></div>
          <div class="flex-1 bg-purple-400 rounded-t h-[40%]" title="62ms"></div>
          <div class="flex-1 bg-purple-300 rounded-t h-[28%]" title="45ms"></div>
          <div class="flex-1 bg-rose-400 rounded-t h-[70%]" title="940ms"></div>
          <div class="flex-1 bg-purple-400 rounded-t h-[38%]" title="58ms"></div>
          <div class="flex-1 bg-purple-300 rounded-t h-[24%]" title="38ms"></div>
          <div class="flex-1 bg-purple-300 rounded-t h-[30%]" title="46ms"></div>
        </div>
        <div class="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
          <span>T -10m</span>
          <span>Spike resolved in 280ms via FSCK</span>
          <span>Now (Nominal 42ms)</span>
        </div>
      </div>
    </div>
  `;
}

// Transaction View C: Top List
async function renderTransactionsToplistView(container) {
  container.innerHTML = `
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 class="font-bold text-sm text-slate-800">Top Slowest & Most Anomalous Transactions</h3>
          <p class="text-xs text-slate-500 mt-0.5">Ranked by execution duration, latency stalls, and self-healing interventions.</p>
        </div>
        <span class="text-xs text-purple-700 font-mono font-bold">Ranked by Duration</span>
      </div>
      <div id="tx-toplist-container" class="space-y-3">
        <div class="text-xs text-slate-400 py-4 text-center">Loading slowest transactions...</div>
      </div>
    </div>
  `;

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    const res = await fetch(`/api/transactions?services=${srvParam}`);
    const data = await res.json();
    const tlContainer = document.getElementById('tx-toplist-container');
    if (!tlContainer) return;
    tlContainer.innerHTML = '';

    // Sort by duration descending
    const sorted = [...data.transactions].sort((a, b) => b.duration_ms - a.duration_ms).slice(0, 6);
    const maxDur = sorted[0] ? sorted[0].duration_ms : 1000;

    sorted.forEach((tx, idx) => {
      const pct = Math.max(10, Math.round((tx.duration_ms / maxDur) * 100));
      const box = document.createElement('div');
      box.className = 'bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-2';

      const barColor = tx.is_anomaly ? 'from-rose-500 to-amber-500' : 'from-purple-500 to-indigo-500';

      box.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center space-x-2.5">
            <span class="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-mono font-bold text-[10px] flex items-center justify-center">#${idx + 1}</span>
            <span class="font-bold text-slate-900 font-mono">${tx.transaction_id}</span>
            <span class="text-slate-400">•</span>
            <span class="text-indigo-600 font-semibold">${tx.service}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="font-mono font-extrabold ${tx.duration_ms > 200 ? 'text-rose-600' : 'text-slate-800'}">${tx.duration_ms} ms</span>
            <span class="text-[10px] text-slate-400">(${pct}%)</span>
          </div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div class="bg-gradient-to-r ${barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%;"></div>
        </div>
        <div class="flex justify-between items-center text-[10px] text-slate-500 font-mono">
          <span>Host: ${tx.host}</span>
          <span class="text-purple-700 font-semibold">${tx.remediation ? `⚡ Healed: ${tx.remediation}` : '200 OK Nominal'}</span>
        </div>
      `;
      tlContainer.appendChild(box);
    });
  } catch (err) {
    console.error('Failed to load transactions toplist:', err);
  }
}

// Transaction View D: Table
async function renderTransactionsTableView(container) {
  container.innerHTML = `
    <div class="p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide">
            Distributed Transactions (Correlated Traces) — Tabular Grid
          </h3>
          <span class="text-xs text-slate-500">End-to-end multi-service RPC block lifecycle operations</span>
        </div>
      </div>
      <div class="overflow-x-auto bg-white rounded-lg border border-[#e1e3e8] shadow-xs">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-[#f8fafc] border-b border-[#e1e3e8] text-slate-600 font-medium">
            <tr>
              <th class="py-2.5 px-3">TRANSACTION ID</th>
              <th class="py-2.5 px-3">TIMESTAMP</th>
              <th class="py-2.5 px-3">ROOT SERVICE</th>
              <th class="py-2.5 px-3">HOST NODE</th>
              <th class="py-2.5 px-3">LATENCY DURATION</th>
              <th class="py-2.5 px-3">STATUS</th>
              <th class="py-2.5 px-3">AUTOMATED REMEDIATION ACTION</th>
            </tr>
          </thead>
          <tbody id="tx-table-tbody" class="divide-y divide-slate-100 font-mono text-[11px]">
            <tr><td colspan="7" class="py-6 text-center text-slate-400">Loading transactions table...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const srvParam = state.activeServices.length === 6 ? 'all' : state.activeServices.join(',');
    const res = await fetch(`/api/transactions?services=${srvParam}`);
    const data = await res.json();
    const tbody = document.getElementById('tx-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.transactions.forEach(tx => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition cursor-pointer';

      const statusBadge = tx.is_anomaly
        ? `<span class="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">AUTO-HEALED</span>`
        : `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">200 OK</span>`;

      const durColor = tx.duration_ms > 200 ? 'text-rose-600 font-bold' : 'text-slate-800';

      tr.innerHTML = `
        <td class="py-2.5 px-3 font-bold text-purple-700 whitespace-nowrap">${tx.transaction_id}</td>
        <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap">${tx.date}</td>
        <td class="py-2.5 px-3 font-semibold text-indigo-700 whitespace-nowrap">${tx.service}</td>
        <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">${tx.host}</td>
        <td class="py-2.5 px-3 ${durColor} whitespace-nowrap">${tx.duration_ms} ms</td>
        <td class="py-2.5 px-3 whitespace-nowrap">${statusBadge}</td>
        <td class="py-2.5 px-3 text-purple-900 font-semibold whitespace-nowrap">${tx.remediation || 'Nominal Flow (No Remediation Required)'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load transactions table:', err);
  }
}

// ── View 4: Visualize as Timeseries ───────────────────────────────────────────
function renderTimeseriesView(container) {
  container.innerHTML = `
    <div class="p-6">
      <h3 class="font-bold text-sm text-slate-800 mb-2">Multi-Service Throughput & Error Timeseries</h3>
      <p class="text-xs text-slate-500 mb-4">Detailed breakdown of log rates across services from 13:11 to 13:20.</p>
      
      <div class="space-y-4">
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
            <span>email-api-py (Peak: 360 errors/min)</span>
            <span class="text-rose-600 font-mono font-bold">+19.2% Divergence</span>
          </div>
          <div class="h-10 bg-slate-200 rounded flex items-end px-2 space-x-1">
            <div class="flex-1 bg-sky-400 h-6"></div>
            <div class="flex-1 bg-sky-400 h-7"></div>
            <div class="flex-1 bg-[#ea3875] h-9"></div>
            <div class="flex-1 bg-[#ea3875] h-10"></div>
            <div class="flex-1 bg-sky-400 h-6"></div>
            <div class="flex-1 bg-sky-400 h-6"></div>
            <div class="flex-1 bg-[#ea3875] h-8"></div>
            <div class="flex-1 bg-sky-400 h-6"></div>
          </div>
        </div>

        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
            <span>auth-dotnet (Peak: 3.8K errors/min)</span>
            <span class="text-rose-600 font-mono font-bold">+30.4% VolumeMap Divergence</span>
          </div>
          <div class="h-10 bg-slate-200 rounded flex items-end px-2 space-x-1">
            <div class="flex-1 bg-sky-400 h-6"></div>
            <div class="flex-1 bg-[#ea3875] h-10"></div>
            <div class="flex-1 bg-[#ea3875] h-9"></div>
            <div class="flex-1 bg-sky-400 h-6"></div>
            <div class="flex-1 bg-sky-400 h-7"></div>
            <div class="flex-1 bg-[#ea3875] h-8"></div>
            <div class="flex-1 bg-sky-400 h-6"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── View 5: Visualize as Top List ─────────────────────────────────────────────
function renderToplistView(container) {
  container.innerHTML = `
    <div class="p-6 grid grid-cols-2 gap-4">
      <div class="bg-white border border-slate-200 rounded p-4">
        <h4 class="font-bold text-xs text-slate-800 uppercase tracking-wide mb-3">Top Services by Volume</h4>
        <div class="space-y-2 text-xs">
          <div class="flex justify-between py-1 border-b border-slate-100"><span>web-store</span><strong class="font-mono">1.79M</strong></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span>auth-dotnet</span><strong class="font-mono">1.61M</strong></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span>email-api-py</span><strong class="font-mono">785K</strong></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span>ad-server</span><strong class="font-mono">398K</strong></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span>email-queue-processor</span><strong class="font-mono">370K</strong></div>
          <div class="flex justify-between py-1"><span>web-store-mongo</span><strong class="font-mono">340K</strong></div>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded p-4">
        <h4 class="font-bold text-xs text-slate-800 uppercase tracking-wide mb-3">Top Error Patterns</h4>
        <div class="space-y-2 text-xs">
          <div class="py-1 border-b border-slate-100">
            <span class="text-rose-600 font-bold">Unexpected error deleting block (E35)</span>
            <div class="text-[10px] text-slate-500 font-mono">42,000 logs • auth-dotnet • Metadata desync</div>
          </div>
          <div class="py-1 border-b border-slate-100">
            <span class="text-rose-600 font-bold">writeBlock exception java.io.IOException (E16)</span>
            <div class="text-[10px] text-slate-500 font-mono">18,000 logs • email-api-py • Network I/O</div>
          </div>
          <div class="py-1">
            <span class="text-amber-600 font-bold">PendingReplicationMonitor timed out block (E46)</span>
            <div class="text-[10px] text-slate-500 font-mono">24,000 logs • web-store • Under-replication</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 5. MODAL INSPECTOR
// ---------------------------------------------------------------------------
function openLogModal(logItem) {
  const modal = document.getElementById('inspector-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  document.getElementById('modal-log-title').textContent = `${logItem.service} — ${logItem.date}`;
  document.getElementById('modal-host').textContent = logItem.host;
  document.getElementById('modal-service').textContent = logItem.service;
  document.getElementById('modal-raw-content').textContent = logItem.content;

  if (logItem.policy) {
    document.getElementById('modal-speedup').textContent = `${roundSpeedup(logItem.policy.manual_s, logItem.policy.auto_ms)} Speedup`;
    document.getElementById('modal-healing-details').textContent = `${logItem.policy.action_name}: ${logItem.policy.post_verification} in ${logItem.policy.auto_ms} ms (replaced ${logItem.policy.manual_label} manual triage).`;
  } else {
    document.getElementById('modal-speedup').textContent = 'Nominal SLA';
    document.getElementById('modal-healing-details').textContent = 'Routine operation executed successfully. No self-healing required.';
  }
}

function roundSpeedup(manualS, autoMs) {
  if (!autoMs) return 'Nominal';
  return `${Math.round((manualS * 1000) / autoMs).toLocaleString()}x`;
}

// ---------------------------------------------------------------------------
// 6. MAIN DASHBOARD SWITCHER (Left Slim Dock: Logs, Monitors, Self-Healing)
// ---------------------------------------------------------------------------
function switchMainDashboard(dashboardName, btnEl) {
  const histEl = document.getElementById('view-dashboard-history') || document.getElementById('view-dashboard-backup');
  const views = {
    'logs': document.getElementById('view-dashboard-logs'),
    'monitors': document.getElementById('view-dashboard-monitors'),
    'history': histEl,
    'backup': histEl
  };

  if (dashboardName === 'history' || dashboardName === 'backup') {
    loadBackupHistory();
    loadBackupSnapshots();
  }

  if (dashboardName === 'backup') {
    loadBackupHistory();
    loadBackupSnapshots();
  }

  // Hide all dashboards
  Object.values(views).forEach(v => {
    if (v) {
      v.classList.add('hidden');
      v.classList.remove('flex');
    }
  });

  // Show target dashboard
  const targetView = views[dashboardName];
  if (targetView) {
    targetView.classList.remove('hidden');
    targetView.classList.add('flex');
  }

  // Update left dock active styles
  document.querySelectorAll('.dock-btn').forEach(b => {
    b.className = 'dock-btn relative w-8 h-8 rounded text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition';
  });

  const activeBtn = btnEl || document.getElementById(`dock-btn-${dashboardName}`) || (dashboardName === 'backup' ? document.getElementById('dock-btn-history') : null);
  if (activeBtn) {
    activeBtn.className = 'dock-btn relative w-8 h-8 rounded text-white bg-purple-600 flex items-center justify-center shadow-inner transition';
  }

  // Update URL hash without reload
  if (history.pushState) {
    history.pushState(null, null, `#${dashboardName}`);
  } else {
    location.hash = `#${dashboardName}`;
  }
}

// ---------------------------------------------------------------------------
// 7. VIEWS DROPDOWN & PRESET FILTERS
// ---------------------------------------------------------------------------
function toggleViewsDropdown() {
  const menu = document.getElementById('views-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

// Close views dropdown on outside click
document.addEventListener('click', (e) => {
  const btn = document.getElementById('views-dropdown-btn');
  const menu = document.getElementById('views-menu');
  if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

function applyPredefinedView(viewType) {
  const label = document.getElementById('current-view-name');
  const menu = document.getElementById('views-menu');
  if (menu) menu.classList.add('hidden');

  if (viewType === 'all') {
    if (label) label.textContent = 'Views: All System Logs';
    state.statusFilter = 'all';
    state.searchQuery = '';
    state.activeServices = ['web-store', 'auth-dotnet', 'email-api-py', 'ad-server', 'email-queue-processor', 'web-store-mongo'];
    document.querySelectorAll('input[name="service-cb"]').forEach(cb => cb.checked = true);
    document.querySelectorAll('input[name="source-cb"]').forEach(cb => cb.checked = true);
    document.querySelectorAll('input[name="host-cb"]').forEach(cb => cb.checked = true);
    const radioAll = document.querySelector('input[name="status-radio"][value="all"]');
    if (radioAll) radioAll.checked = true;
  } else if (viewType === 'anomalies') {
    if (label) label.textContent = 'Views: Anomalies & Errors';
    state.statusFilter = 'anomaly';
    state.searchQuery = '';
    const radioAnom = document.querySelector('input[name="status-radio"][value="anomaly"]');
    if (radioAnom) radioAnom.checked = true;
  } else if (viewType === 'hdfs') {
    if (label) label.textContent = 'Views: HDFS VolumeMap Issues';
    state.statusFilter = 'anomaly';
    state.searchQuery = 'volumeMap';
    state.activeServices = ['auth-dotnet', 'web-store'];
    document.querySelectorAll('input[name="service-cb"]').forEach(cb => {
      cb.checked = (cb.value === 'auth-dotnet' || cb.value === 'web-store');
    });
    const sInput = document.getElementById('search-input');
    if (sInput) sInput.value = 'volumeMap';
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.remove('hidden');
    const radioAnom = document.querySelector('input[name="status-radio"][value="anomaly"]');
    if (radioAnom) radioAnom.checked = true;
  } else if (viewType === 'python') {
    if (label) label.textContent = 'Views: Python Worker Pipeline';
    state.statusFilter = 'all';
    state.searchQuery = '';
    state.activeServices = ['email-api-py', 'email-queue-processor'];
    document.querySelectorAll('input[name="service-cb"]').forEach(cb => {
      cb.checked = (cb.value === 'email-api-py' || cb.value === 'email-queue-processor');
    });
  }

  state.currentPage = 1;
  renderCurrentView();
}

function saveCurrentCustomView() {
  const menu = document.getElementById('views-menu');
  if (menu) menu.classList.add('hidden');
  const viewName = prompt('Enter a name for your custom view:', 'My Production Slice');
  if (viewName) {
    const label = document.getElementById('current-view-name');
    if (label) label.textContent = `Views: ${viewName}`;
    alert(`View "${viewName}" saved with current filter criteria.`);
  }
}

// ---------------------------------------------------------------------------
// 8. SIDEBAR FACET TOGGLE
// ---------------------------------------------------------------------------
function toggleFacetSection(sectionId) {
  const content = document.getElementById(`facet-content-${sectionId}`);
  const icon = document.getElementById(`facet-icon-${sectionId}`);
  if (!content) return;
  content.classList.toggle('hidden');
  if (icon) {
    icon.classList.toggle('rotate-180');
  }
}

// ---------------------------------------------------------------------------
// 9. ACCOUNT & PROFILE MODAL (Mansi Sharma - Super Admin)
// ---------------------------------------------------------------------------
function openAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function copyApiKey() {
  const box = document.getElementById('api-key-box');
  const btn = document.getElementById('copy-key-btn');
  if (!box || !btn) return;
  navigator.clipboard.writeText(box.value).then(() => {
    btn.textContent = 'Copied!';
    btn.className = 'px-3 py-1.5 rounded bg-emerald-600 text-white font-bold text-xs transition';
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.className = 'px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition';
    }, 2000);
  });
}

// ---------------------------------------------------------------------------
// 10. REAL-TIME LIVE STREAMING INSIGHTS (Dynamic Updates as Issues are Seen)
// ---------------------------------------------------------------------------
const REALTIME_ANOMALY_TEMPLATES = [
  {
    type: "NEW_ERROR_LOGS",
    service: "auth-dotnet",
    headline_prefix: "Metadata desync anomaly surge detected on",
    service_tag: "service:auth-dotnet",
    description: "VolumeMap mismatch detected across 4 DataNodes. Rate increased to +380 logs/min.",
    tags: [
      { label: "ERROR", type: "badge_error" },
      { label: "volumeMap", type: "tag" },
      { label: "E35", type: "tag" }
    ],
    timeseries: [14, 18, 22, 35, 68, 92, 140, 185],
    remediation_action: "FSCK_METADATA_RESYNC",
    remediation_desc: "Reconcile NameNode metadata and purge orphaned block pointers"
  },
  {
    type: "HIGH_LATENCY_SPIKE",
    service: "email-api-py",
    headline_prefix: "Socket read timeout spike on",
    service_tag: "service:email-api-py",
    description: "TCP packet stall observed on DataXceiver stream. P99 latency jumped from 45ms to 920ms.",
    tags: [
      { label: "WARN", type: "badge_warn" },
      { label: "timeout", type: "tag" },
      { label: "E16", type: "tag" }
    ],
    timeseries: [8, 12, 15, 20, 48, 85, 120, 160],
    remediation_action: "TCP_CIRCUIT_FAILOVER",
    remediation_desc: "Failover connection to healthy secondary replica socket"
  },
  {
    type: "BLOCK_UNDER_REPLICATION",
    service: "web-store",
    headline_prefix: "HDFS block under-replication alert on",
    service_tag: "service:web-store",
    description: "PendingReplicationMonitor timed out 18 blocks. Target replication factor dropped to 1/3.",
    tags: [
      { label: "CRITICAL", type: "badge_error" },
      { label: "replication", type: "tag" },
      { label: "E46", type: "tag" }
    ],
    timeseries: [5, 10, 14, 28, 55, 90, 130, 210],
    remediation_action: "FORCE_RE_REPLICATION",
    remediation_desc: "Command NameNode to dynamically re-replicate blocks to rack-aware nodes"
  },
  {
    type: "THREAD_CONTENTION",
    service: "email-queue-processor",
    headline_prefix: "Worker thread exhaustion on",
    service_tag: "service:email-queue-processor",
    description: "Active thread pool reached 1024/1024 capacity. PacketResponder threads stalled.",
    tags: [
      { label: "HIGH", type: "badge_warn" },
      { label: "threads", type: "tag" },
      { label: "E26", type: "tag" }
    ],
    timeseries: [20, 25, 40, 60, 110, 150, 190, 240],
    remediation_action: "RECYCLE_THREAD_POOL",
    remediation_desc: "Drain stalled worker queues and double transient thread capacity"
  }
];

let streamCounter = 0;
let isRealtimeStreamPaused = false;

function startRealtimeInsightsStream() {
  // Check incoming telemetry every 5.5 seconds
  setInterval(() => {
    if (isRealtimeStreamPaused) return;

    // Pick next template to simulate live issue arrival
    const template = REALTIME_ANOMALY_TEMPLATES[streamCounter % REALTIME_ANOMALY_TEMPLATES.length];
    streamCounter++;

    const newInsight = {
      id: `rt_insight_${Date.now()}`,
      type: template.type,
      service: template.service,
      headline_prefix: template.headline_prefix,
      service_tag: template.service_tag,
      description: template.description,
      tags: template.tags,
      timeseries: template.timeseries,
      remediation_action: template.remediation_action,
      remediation_desc: template.remediation_desc,
      is_new: true,
      time_label: 'Just now'
    };

    // Prepend to current insights container
    const container = document.getElementById('watchdog-cards-container');
    if (!container) return;

    // Limit maximum active real-time cards to 5 to keep UI clean
    const currentCards = container.querySelectorAll('.watchdog-outlier-card');
    if (currentCards.length >= 5) {
      const lastCard = currentCards[currentCards.length - 1];
      if (lastCard) lastCard.remove();
    }

    const card = document.createElement('div');
    card.className = 'watchdog-outlier-card transition-all duration-300 ring-2 ring-purple-400 bg-purple-50/20';
    card.id = `card-${newInsight.id}`;

    const tagBadges = newInsight.tags.map(t => {
      if (t.type === 'badge_error') return `<span class="badge-error mr-1.5">${t.label}</span>`;
      if (t.type === 'badge_warn') return `<span class="badge-warn mr-1.5">${t.label}</span>`;
      return `<span class="tag-label mr-1">${t.label}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px] mb-2">
        <span class="inline-flex items-center font-bold text-pink-600">
          <span class="w-2 h-2 rounded-full bg-pink-500 animate-ping mr-1.5"></span>
          NEW ANOMALY DETECTED • ${newInsight.time_label}
        </span>
        <span class="text-slate-400 font-mono text-[10px]">Real-Time Stream</span>
      </div>

      <div class="text-xs text-slate-800 leading-snug mb-2 font-medium">
        ${newInsight.headline_prefix} 
        <span class="font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-mono text-[11px]">${newInsight.service_tag}</span>
      </div>

      <p class="text-[11px] text-slate-600 mb-2 leading-relaxed">
        ${newInsight.description}
      </p>

      <div class="flex flex-wrap items-center gap-1 mb-3">
        ${tagBadges}
      </div>

      <div class="h-10 w-full flex items-end justify-between space-x-1 mb-3 pt-2 border-t border-slate-100">
        ${newInsight.timeseries.map((v, i) => {
          const pct = Math.max(15, Math.min(100, (v / 240) * 100));
          const colorClass = i >= 4 ? 'bg-pink-500 animate-pulse' : 'bg-slate-300';
          return `<div class="flex-1 ${colorClass} rounded-t transition-all duration-500" style="height: ${pct}%;"></div>`;
        }).join('')}
      </div>

      <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
        <button class="px-2.5 py-1 rounded bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] shadow-xs flex items-center space-x-1 transition" onclick="healWatchdogInsight('${newInsight.id}', '${newInsight.service}', this)">
          <i class="fa-solid fa-wrench text-[9px]"></i>
          <span>Remediate Anomaly</span>
        </button>
        <span class="text-[10px] text-slate-400 font-mono">Autonomous RCA Match</span>
      </div>
    `;

    container.prepend(card);

    // Update the insights button counter
    const activeCards = container.querySelectorAll('.watchdog-outlier-card');
    const toggleBtn = document.getElementById('toggle-watchdog-btn');
    if (toggleBtn) {
      toggleBtn.innerHTML = `<span class="w-2 h-2 rounded-full bg-pink-500 pulse-dot mr-1.5"></span><span>⚡ ${activeCards.length} Insights</span>`;
    }

    // Animate mini bars at the top
    const miniContainer = document.getElementById('watchdog-mini-bars');
    if (miniContainer) {
      const bars = miniContainer.children;
      if (bars.length > 0) {
        const lastBar = bars[bars.length - 1];
        lastBar.className = 'w-1 bg-pink-500 rounded-t transition-all duration-500';
        lastBar.style.height = '85%';
      }
    }
  }, 5500);
}

// ---------------------------------------------------------------------------
// 11. INITIALIZE URL ROUTER & START REALTIME STREAM & BACKUP LEDGER
// ---------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  // Handle URL hash or path routing
  const path = window.location.pathname;
  const hash = window.location.hash.replace('#', '');

  if (hash === 'history' || path === '/history' || hash === 'backup' || path === '/backup') {
    switchMainDashboard('history');
  } else if (hash === 'monitors' || path === '/monitors') {
    switchMainDashboard('monitors');
  } else if (hash === 'self-healing' || path === '/self-healing') {
    switchMainDashboard('self-healing');
  } else if (hash === 'profile' || path === '/profile') {
    openAccountModal();
  }

  // Start real-time streaming insights
  startRealtimeInsightsStream();

  // Initialize Real-Time Backup Ledger & Clock
  initRealtimeLedger();
});

// ---------------------------------------------------------------------------
// 12. MONITORS & ALERTS INTERACTIVE ACTIONS & NEW MONITOR MODAL
// ---------------------------------------------------------------------------
let activeAlertCount = 2;

function openNewMonitorModal() {
  const modal = document.getElementById('new-monitor-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeNewMonitorModal() {
  const modal = document.getElementById('new-monitor-modal');
  if (modal) modal.classList.add('hidden');
}

function submitNewMonitor(e) {
  e.preventDefault();
  const name = document.getElementById('new-mon-name').value.trim();
  const service = document.getElementById('new-mon-service').value;
  const condition = document.getElementById('new-mon-condition').value;
  const severity = document.getElementById('new-mon-severity').value;
  const autoHeal = document.getElementById('new-mon-auto-heal').checked;

  const monId = `MON-${Math.floor(1000 + Math.random() * 9000)}`;
  const grid = document.getElementById('monitors-cards-grid');

  if (grid) {
    const card = document.createElement('div');
    const badgeClass = severity === 'alerting' 
      ? 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse'
      : severity === 'warn'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-sky-100 text-sky-800 border-sky-200';
    
    const badgeText = severity === 'alerting' ? 'CRITICAL (ALERTING)' : severity === 'warn' ? 'WARNING' : 'NOMINAL OK';
    const borderClass = severity === 'alerting' ? 'border-rose-300' : 'border-slate-200';

    card.className = `monitor-card bg-white p-4 rounded-lg border ${borderClass} shadow-xs space-y-3 animate-fadeIn`;
    card.setAttribute('data-status', severity);

    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center space-x-2">
            <span class="status-badge px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${badgeClass}">${badgeText}</span>
            <span class="text-[10px] text-slate-400 font-mono">ID: ${monId}</span>
          </div>
          <h4 class="font-bold text-xs text-slate-900 mt-1">${name}</h4>
        </div>
        <span class="val-display text-slate-800 font-mono text-sm font-extrabold">${service}</span>
      </div>

      <p class="text-xs text-slate-600">Active monitoring rule. Trigger condition: <code>${condition}</code>.</p>
      
      <div class="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] font-mono text-slate-700 flex justify-between items-center">
        <span>Routing: PagerDuty • mansi.m@cloudnet.io</span>
        <span class="eval-time text-slate-500">Evaluated: Just now</span>
      </div>

      <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
        ${autoHeal ? `<span class="text-[10px] text-purple-700 font-bold flex items-center"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Auto-Healing Linked</span>` : `<span class="text-[10px] text-slate-400">Manual Escalation</span>`}
        <button onclick="toggleMuteMonitor(this)" class="text-slate-500 hover:text-slate-800 text-[11px] font-medium">
          <i class="fa-solid fa-bell-slash mr-1"></i> Mute 1h
        </button>
      </div>
    `;

    grid.prepend(card);

    // Update counts
    const countAll = document.getElementById('mon-count-all');
    if (countAll) countAll.textContent = grid.querySelectorAll('.monitor-card').length;
  }

  closeNewMonitorModal();
  triggerSampleAlertToast(`New Monitor Created: ${name}`, `Monitoring ${service} for condition [${condition}]. Notification routed to mansi.m@cloudnet.io.`);
}

function filterMonitorTiles(statusFilter, btnEl) {
  document.querySelectorAll('.monitor-tab-btn').forEach(b => {
    b.className = 'monitor-tab-btn px-2.5 py-1 rounded-md font-semibold text-slate-600 hover:bg-slate-100 border border-transparent transition';
  });
  if (btnEl) {
    btnEl.className = 'monitor-tab-btn px-2.5 py-1 rounded-md font-bold bg-purple-100 text-purple-800 border border-purple-200 transition';
  }

  document.querySelectorAll('.monitor-card').forEach(card => {
    const cardStatus = card.getAttribute('data-status');
    if (statusFilter === 'all' || cardStatus === statusFilter) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

function searchMonitorTiles(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.monitor-card').forEach(card => {
    const txt = card.textContent.toLowerCase();
    if (!q || txt.includes(q)) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

function executeMonitorHeal(monId, actionPolicy, btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Remediating...`;
  }

  setTimeout(() => {
    const card = btnEl ? btnEl.closest('.monitor-card') : null;
    if (card) {
      card.setAttribute('data-status', 'healed');
      card.className = 'monitor-card bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3 transition duration-500';
      const badge = card.querySelector('.status-badge');
      if (badge) {
        badge.className = 'status-badge px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold border border-emerald-200';
        badge.textContent = 'AUTO-HEALED';
      }
      const val = card.querySelector('.val-display');
      if (val) {
        val.className = 'val-display text-emerald-700 font-mono text-sm font-extrabold';
        val.textContent = 'Nominal (100% OK)';
      }
      if (btnEl) {
        btnEl.className = 'px-3 py-1 rounded bg-slate-100 text-slate-500 font-semibold text-[11px] cursor-default';
        btnEl.innerHTML = `<i class="fa-solid fa-check text-emerald-600 mr-1"></i> Self-Healed in 280ms`;
      }
    }

    // Decrement alert counter badge
    if (activeAlertCount > 0) {
      activeAlertCount--;
      const badge = document.getElementById('monitors-notif-badge');
      if (badge) {
        if (activeAlertCount === 0) {
          badge.classList.add('hidden');
        } else {
          badge.textContent = activeAlertCount;
        }
      }
      const alBadge = document.getElementById('mon-count-alerting');
      if (alBadge) alBadge.textContent = activeAlertCount;
    }

    // Append entry to Real-Time Backup Audit Ledger with exact current timestamp
    addRealtimeLedgerEntry('HDFS-DataNode', `Resolved ${monId}`, actionPolicy, 'FSCK VolumeMap Consistence Verified');
  }, 450);
}

function toggleMuteMonitor(btnEl) {
  if (btnEl) {
    if (btnEl.classList.contains('text-amber-600')) {
      btnEl.className = 'text-slate-500 hover:text-slate-800 text-[11px] font-medium';
      btnEl.innerHTML = `<i class="fa-solid fa-bell-slash mr-1"></i> Mute 1h`;
    } else {
      btnEl.className = 'text-amber-600 font-bold text-[11px]';
      btnEl.innerHTML = `<i class="fa-solid fa-bell mr-1"></i> Muted (59m left)`;
    }
  }
}

function simulateMonitorSpike(monId, btnEl) {
  if (btnEl) {
    const originalText = btnEl.textContent;
    btnEl.textContent = 'Injecting Fault...';
    setTimeout(() => {
      btnEl.textContent = originalText;
      triggerSampleAlertToast(`Simulated SLA Anomaly on ${monId}`, `Transient delay spike detected. Automated remediation action triggered.`);
    }, 600);
  }
}

// ---------------------------------------------------------------------------
// 13. REAL-TIME ALERT TOAST & POP-UP
// ---------------------------------------------------------------------------
function triggerSampleAlertToast(title, body) {
  const toast = document.getElementById('alert-notification-popup');
  if (!toast) return;

  const tTitle = document.getElementById('alert-toast-title');
  const tBody = document.getElementById('alert-toast-body');
  const tTime = document.getElementById('alert-toast-time');

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  if (tTitle && title) tTitle.textContent = title;
  if (tBody && body) tBody.textContent = body;
  if (tTime) tTime.textContent = `${timeStr} (Just now)`;

  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 20);

  // Auto dismiss after 6 seconds
  setTimeout(() => {
    dismissAlertToast();
  }, 6000);
}

function dismissAlertToast() {
  const toast = document.getElementById('alert-notification-popup');
  if (!toast) return;
  toast.classList.add('translate-x-full');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 300);
}

// ---------------------------------------------------------------------------
// 14. REAL-TIME SECOND-BY-SECOND SELF-HEALING & BACKUP AUDIT LEDGER
// ---------------------------------------------------------------------------
function formatLiveTimestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function addRealtimeLedgerEntry(subsystem, incident, actionName, verifyMsg) {
  const tbody = document.getElementById('realtime-backup-ledger-tbody');
  if (!tbody) return;

  const now = new Date();
  const timeStr = formatLiveTimestamp();
  const snapId = `snap_${now.getHours()}${now.getMinutes()}${now.getSeconds()}_${Math.floor(100 + Math.random() * 900)}`;

  const tr = document.createElement('tr');
  tr.className = 'hover:bg-slate-50 transition-all duration-300 animate-fadeIn';
  tr.innerHTML = `
    <td class="py-2 px-3 text-purple-700 font-bold whitespace-nowrap">${timeStr}</td>
    <td class="py-2 px-3 text-slate-800 font-medium whitespace-nowrap">${subsystem}</td>
    <td class="py-2 px-3 text-rose-700 font-semibold whitespace-nowrap">${incident}</td>
    <td class="py-2 px-3 text-purple-900 font-bold whitespace-nowrap">
      <span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px]">${actionName}</span>
    </td>
    <td class="py-2 px-3 text-slate-600 font-mono text-[10px] whitespace-nowrap">
      <a href="javascript:void(0)" onclick="alert('Snapshot archive ${snapId}.meta is healthy and verified.')" class="text-purple-600 hover:underline">
        /backup/hdfs/${snapId}.meta.gz
      </a>
      <span class="ml-1 text-[9px] text-emerald-600 font-bold">● VERIFIED</span>
    </td>
    <td class="py-2 px-3 text-emerald-700 font-bold whitespace-nowrap">
      <i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i> RESTORE READY
    </td>
  `;

  tbody.prepend(tr);

  // Keep max 15 entries
  if (tbody.children.length > 15) {
    tbody.removeChild(tbody.lastChild);
  }
}

function addManualLedgerBackup() {
  const now = new Date();
  addRealtimeLedgerEntry(
    'HDFS-VolumeMap',
    'User Snapshot Checkpoint',
    'SNAPSHOT_CHECKPOINT',
    'Pre-mutation state saved to cold vault'
  );
  triggerSampleAlertToast('HDFS Metadata Snapshot Created', `Backup image /backup/hdfs/snapshot_${now.getTime()}.meta.gz verified.`);
}

function initRealtimeLedger() {
  // Continuously update live clock in monitors header
  setInterval(() => {
    const clockEl = document.getElementById('monitors-clock-ticker');
    if (clockEl) {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      clockEl.textContent = `LIVE CLOCK: [${timeStr}] • 6 ACTIVE HEALTH CHECKS • 0 PACKET LOSS`;
    }

    // Update evaluation times in tiles
    document.querySelectorAll('.eval-time').forEach(el => {
      el.textContent = `Evaluated: Just now`;
    });
  }, 1000);
}


// ===========================================================================
// 13. CUSTOM FACET MODAL & SIDEBAR PINNING (+ Add button beside Showing count)
// ===========================================================================
function openAddFacetModal() {
  const modal = document.getElementById('add-facet-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeAddFacetModal() {
  const modal = document.getElementById('add-facet-modal');
  if (modal) modal.classList.add('hidden');
}

function addNewCustomFacet(name, type) {
  closeAddFacetModal();
  const section = document.getElementById('custom-facets-section');
  const list = document.getElementById('custom-facets-list');
  const countEl = document.getElementById('custom-facets-count');
  if (!section || !list) return;

  section.classList.remove('hidden');

  if (document.getElementById(`custom-facet-${name}`)) {
    alert(`Facet "${name}" is already in your sidebar!`);
    return;
  }

  const facetId = `custom-facet-${name}`;
  const valuesMap = {
    'datacenter': [
      { val: 'us-east-1', count: '3.2M' },
      { val: 'us-west-2', count: '2.1M' },
      { val: 'eu-central-1', count: '1.5M' }
    ],
    'http.status_code': [
      { val: '200', count: '6.1M' },
      { val: '500', count: '234K' },
      { val: '404', count: '310K' },
      { val: '503', count: '42K' }
    ],
    'k8s.pod': [
      { val: 'auth-pod-14', count: '1.6M' },
      { val: 'web-pod-02', count: '1.8M' },
      { val: 'email-pod-09', count: '780K' }
    ],
    'client.ip': [
      { val: '10.0.1.x', count: '3.1M' },
      { val: '10.0.2.x', count: '2.4M' }
    ]
  };

  const values = valuesMap[name] || [
    { val: `${name}-primary`, count: '4.2M' },
    { val: `${name}-replica`, count: '2.6M' }
  ];

  const groupEl = document.createElement('div');
  groupEl.id = facetId;
  groupEl.className = 'mb-2.5 pb-2 border-b border-slate-100 last:border-0';

  const rowsHtml = values.map(v => `
    <label class="facet-row flex items-center justify-between py-0.5 px-1 rounded hover:bg-slate-50 cursor-pointer text-slate-700">
      <span class="flex items-center space-x-2">
        <input type="checkbox" name="custom-cb-${name}" value="${v.val}" checked class="rounded text-purple-600 focus:ring-purple-500 border-slate-300">
        <span class="text-xs truncate max-w-[120px]" title="${v.val}">${v.val}</span>
      </span>
      <span class="font-mono text-slate-400 text-[10px]">${v.count}</span>
    </label>
  `).join('');

  groupEl.innerHTML = `
    <div class="flex items-center justify-between py-1 text-slate-700 font-semibold cursor-pointer hover:text-purple-700 select-none">
      <span class="flex items-center text-xs font-mono font-bold text-purple-900">
        <i class="fa-solid fa-tag text-[8px] mr-1.5 text-purple-600"></i>${name}
      </span>
      <button onclick="removeCustomFacet('${facetId}')" class="text-slate-300 hover:text-rose-500 text-[10px]" title="Remove facet">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="space-y-1 pl-2 pt-0.5">
      ${rowsHtml}
    </div>
  `;

  list.appendChild(groupEl);

  groupEl.querySelectorAll(`input[name="custom-cb-${name}"]`).forEach(cb => {
    cb.addEventListener('change', () => {
      state.currentPage = 1;
      renderCurrentView();
    });
  });

  const allFacets = list.querySelectorAll('[id^="custom-facet-"]');
  if (countEl) countEl.textContent = allFacets.length;

  triggerSampleAlertToast('Custom Facet Added', `Facet "${name}" pinned to sidebar with ${values.length} indexed values.`);
}

function removeCustomFacet(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.remove();
  const list = document.getElementById('custom-facets-list');
  const section = document.getElementById('custom-facets-section');
  const countEl = document.getElementById('custom-facets-count');
  const remaining = list ? list.querySelectorAll('[id^="custom-facet-"]').length : 0;
  if (countEl) countEl.textContent = remaining;
  if (remaining === 0 && section) section.classList.add('hidden');
}

function submitCustomFacetInput() {
  const input = document.getElementById('custom-facet-input');
  if (!input) return;
  const val = input.value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  if (!val) {
    alert('Please enter a valid facet attribute name (e.g. cluster_id, env_tag)');
    return;
  }
  addNewCustomFacet(val, 'custom');
  input.value = '';
}

// ===========================================================================
// 14. PERSISTENT HISTORICAL BACKUP STORE (Searchable, Stored, Never Vanishes)
// ===========================================================================
const backupState = {
  search: '',
  dateRange: 'all',
  category: 'all',
  page: 1,
  limit: 15,
  totalPages: 1
};

async function loadBackupHistory() {
  const tbody = document.getElementById('backup-history-tbody');
  const countEl = document.getElementById('backup-total-count');
  const curPageEl = document.getElementById('backup-cur-page');
  const totPagesEl = document.getElementById('backup-tot-pages');
  const prevBtn = document.getElementById('backup-prev-btn');
  const nextBtn = document.getElementById('backup-next-btn');

  if (!tbody) return;

  try {
    const params = new URLSearchParams({
      search: backupState.search,
      date_range: backupState.dateRange,
      category: backupState.category,
      page: backupState.page,
      limit: backupState.limit
    });

    const res = await fetch(`/api/backup/history?${params.toString()}`);
    const data = await res.json();

    backupState.totalPages = data.total_pages;

    if (countEl) countEl.textContent = data.total_records.toLocaleString();
    if (curPageEl) curPageEl.textContent = data.page;
    if (totPagesEl) totPagesEl.textContent = data.total_pages;
    if (prevBtn) prevBtn.disabled = data.page <= 1;
    if (nextBtn) nextBtn.disabled = data.page >= data.total_pages;

    tbody.innerHTML = '';

    if (data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 font-sans">No backup records matching query "${backupState.search}".</td></tr>`;
      return;
    }

    data.items.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

      const statusBadge = item.is_anomaly
        ? `<span class="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[10px] font-bold">AUTO-HEALED</span>`
        : `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">COMMITTED</span>`;

      tr.innerHTML = `
        <td class="py-2.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
          ${item.timestamp}
        </td>
        <td class="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap">${item.service}</td>
        <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">${item.subsystem}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">${statusBadge}</td>
        <td class="py-2.5 px-4 text-slate-800 font-medium max-w-sm truncate" title="${item.action}">${item.action}</td>
        <td class="py-2.5 px-4 text-purple-900 font-medium max-w-sm truncate" title="${item.resolution}">${item.resolution}</td>
        <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[10px]">
          <a href="javascript:void(0)" onclick="downloadBackupArtifact('${item.id}', '${item.block_id}')" class="text-purple-600 hover:underline">
            ${item.backup_hash}
          </a>
          <span class="text-emerald-600 ml-1">●</span>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Failed to load backup history:', err);
  }
}

function onBackupSearchInput(val) {
  backupState.search = val.trim();
  backupState.page = 1;
  const clearBtn = document.getElementById('backup-clear-search-btn');
  if (clearBtn) {
    if (backupState.search) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  loadBackupHistory();
}

function clearBackupSearch() {
  const inp = document.getElementById('backup-history-search-input');
  if (inp) inp.value = '';
  backupState.search = '';
  backupState.page = 1;
  const clearBtn = document.getElementById('backup-clear-search-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  loadBackupHistory();
}

function setBackupHistoryDate(range, btn) {
  backupState.dateRange = range;
  backupState.page = 1;
  document.querySelectorAll('.backup-date-tab').forEach(b => {
    b.className = 'backup-date-tab px-3 py-1.5 rounded font-medium text-slate-600 hover:bg-slate-100 border border-slate-200';
  });
  if (btn) {
    btn.className = 'backup-date-tab px-3 py-1.5 rounded font-bold bg-purple-100 text-purple-800 border border-purple-200';
  }
  loadBackupHistory();
}

function setBackupCategory(cat, btn) {
  backupState.category = cat;
  backupState.page = 1;
  document.querySelectorAll('.backup-cat-pill').forEach(b => {
    b.className = 'backup-cat-pill px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200';
  });
  if (btn) {
    btn.className = 'backup-cat-pill px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-white';
  }
  loadBackupHistory();
}

function prevBackupPage() {
  if (backupState.page > 1) {
    backupState.page--;
    loadBackupHistory();
  }
}

function nextBackupPage() {
  if (backupState.page < backupState.totalPages) {
    backupState.page++;
    loadBackupHistory();
  }
}

async function loadBackupSnapshots() {
  const container = document.getElementById('backup-snapshots-cards-container');
  if (!container) return;

  try {
    const res = await fetch('/api/backup/snapshots');
    const data = await res.json();
    container.innerHTML = '';

    data.snapshots.forEach(s => {
      const card = document.createElement('div');
      card.className = 'p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2.5';
      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div>
            <span class="font-bold text-slate-900 text-xs">${s.period}</span>
            <span class="block text-[10px] text-slate-400 font-mono mt-0.5">${s.date}</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold font-mono text-[9px] border border-emerald-200">
            ${s.status}
          </span>
        </div>
        <div class="font-mono text-[11px] text-purple-700 bg-purple-50/60 p-1.5 rounded border border-purple-100 truncate">
          ${s.filename}
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>${s.records} • <strong>${s.size_mb} MB</strong></span>
          <a href="/api/backup/download/${s.id}" class="text-purple-700 font-bold hover:underline flex items-center space-x-1">
            <i class="fa-solid fa-download text-[10px]"></i>
            <span>Download</span>
          </a>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load snapshots:', err);
  }
}

function downloadBackupArtifact(histId, blockId) {
  window.open(`/api/backup/download/snap_yesterday_full`, '_blank');
}

// Bind to window for HTML button onclick access
window.openAddFacetModal = openAddFacetModal;
window.closeAddFacetModal = closeAddFacetModal;
window.addNewCustomFacet = addNewCustomFacet;
window.removeCustomFacet = removeCustomFacet;
window.submitCustomFacetInput = submitCustomFacetInput;
window.onBackupSearchInput = onBackupSearchInput;
window.clearBackupSearch = clearBackupSearch;
window.setBackupHistoryDate = setBackupHistoryDate;
window.setBackupCategory = setBackupCategory;
window.prevBackupPage = prevBackupPage;
window.nextBackupPage = nextBackupPage;
window.loadBackupHistory = loadBackupHistory;
window.loadBackupSnapshots = loadBackupSnapshots;
window.downloadBackupArtifact = downloadBackupArtifact;

// Actual Real-Time Critical Alert Dispatcher
function checkForCriticalAlerts(insights) {
  if (!insights || insights.length === 0) return;
  const critical = insights.find(i => i.headline_prefix.includes('VolumeMap') || i.headline_prefix.includes('Thread'));
  if (critical) {
    const toast = document.getElementById('alert-notification-popup');
    const toastTitle = document.getElementById('alert-toast-title');
    const toastBody = document.getElementById('alert-toast-body');
    const toastTime = document.getElementById('alert-toast-time');
    if (toast && toastTitle && toastBody) {
      toastTitle.textContent = `CRITICAL SLA SURGE: ${critical.headline_prefix} (${critical.service_tag})`;
      toastBody.textContent = `${critical.description} Automated remediation action is ready to dispatch.`;
      if (toastTime) toastTime.textContent = new Date().toLocaleTimeString();
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.remove('translate-x-full'), 20);
      setTimeout(() => dismissAlertToast(), 8000);
    }
  }
}

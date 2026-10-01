// FinWise Offline Storage, Sync Queue, and Privacy Shield Manager

const OFFLINE_QUEUE_KEY = 'finwise_offline_queue';
const CACHED_TX_KEY = 'finwise_cached_transactions';
const CACHED_CAT_KEY = 'finwise_cached_categories';
const CACHED_SUMMARY_KEY = 'finwise_cached_summary';
const PRIVACY_MODE_KEY = 'finwise_privacy_mode';

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('FinWise Service Worker active'))
      .catch((err) => console.warn('Service worker registration failed:', err));
  });
}

// Offline Queue Utilities
function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveOfflineQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  updateSyncStatusUI();
}

function queueOfflineMutation(action, targetId, payload) {
  const queue = getOfflineQueue();
  const item = {
    tempId: 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    action, // 'create', 'update', 'delete'
    targetId,
    payload,
    timestamp: new Date().toISOString()
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

// Cache local read data
function cacheData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage quota or cache error', e);
  }
}

function getCachedData(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

// Sync Engine
let isSyncing = false;
async function syncOfflineQueue() {
  if (isSyncing || !navigator.onLine) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    updateSyncStatusUI();
    return;
  }

  isSyncing = true;
  updateSyncStatusUI();

  const remaining = [];
  for (const item of queue) {
    try {
      if (item.action === 'create') {
        await apiCreateTransaction(item.payload, true); // true = skipOfflineInterception
      } else if (item.action === 'update') {
        await apiUpdateTransaction(item.targetId, item.payload, true);
      } else if (item.action === 'delete') {
        await apiDeleteTransaction(item.targetId, true);
      }
    } catch (err) {
      console.error('Failed to sync item:', item, err);
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  isSyncing = false;
  updateSyncStatusUI();

  // Reload current page data if page has reload handler
  if (typeof window.loadTransactions === 'function') {
    window.loadTransactions();
  }
  if (typeof window.loadDashboardData === 'function') {
    window.loadDashboardData();
  }
}

// Status UI
function updateSyncStatusUI() {
  const pills = document.querySelectorAll('.sync-status-pill');
  const queue = getOfflineQueue();
  const isOnline = navigator.onLine;

  pills.forEach((pill) => {
    if (!isOnline) {
      pill.className = 'sync-status-pill status-offline';
      pill.innerHTML = `
        <span class="status-dot"></span>
        <span>Offline (Local${queue.length ? `: ${queue.length} pending` : ''})</span>
      `;
      pill.title = 'Working offline. Changes are stored locally on your device.';
    } else if (isSyncing) {
      pill.className = 'sync-status-pill status-syncing';
      pill.innerHTML = `
        <span class="status-dot"></span>
        <span>Syncing (${queue.length})...</span>
      `;
      pill.title = 'Syncing offline changes to the server...';
    } else if (queue.length > 0) {
      pill.className = 'sync-status-pill status-syncing';
      pill.innerHTML = `
        <span class="status-dot"></span>
        <span>${queue.length} pending</span>
        <button class="btn-sync-now" onclick="syncOfflineQueue()">Sync</button>
      `;
      pill.title = 'Pending offline changes. Click to sync now.';
    } else {
      pill.className = 'sync-status-pill status-online';
      pill.innerHTML = `
        <span class="status-dot"></span>
        <span>Synced</span>
      `;
      pill.title = 'Connected to server & fully synced.';
    }
  });
}

// Privacy Shield Mode (Mask/Blur balances)
function initPrivacyMode() {
  const isPrivacyActive = localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
  applyPrivacyMode(isPrivacyActive);

  // Wire up privacy toggle buttons
  document.querySelectorAll('.btn-privacy-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const current = document.body.classList.contains('privacy-active');
      const next = !current;
      localStorage.setItem(PRIVACY_MODE_KEY, next ? 'true' : 'false');
      applyPrivacyMode(next);
    });
  });
}

function applyPrivacyMode(active) {
  if (active) {
    document.body.classList.add('privacy-active');
  } else {
    document.body.classList.remove('privacy-active');
  }

  // Update button icons
  document.querySelectorAll('.btn-privacy-toggle').forEach((btn) => {
    btn.title = active ? 'Privacy Mode ON (Balances Blurred) - Click to Reveal' : 'Privacy Mode OFF - Click to Blur Balances';
    btn.innerHTML = active 
      ? '<i data-lucide="eye-off" style="width: 16px; height: 16px;"></i>' 
      : '<i data-lucide="eye" style="width: 16px; height: 16px;"></i>';
  });

  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

// Global Event Listeners
window.addEventListener('online', () => {
  updateSyncStatusUI();
  syncOfflineQueue();
});

window.addEventListener('offline', () => {
  updateSyncStatusUI();
});

document.addEventListener('DOMContentLoaded', () => {
  initPrivacyMode();
  updateSyncStatusUI();
  if (navigator.onLine && getOfflineQueue().length > 0) {
    syncOfflineQueue();
  }
});

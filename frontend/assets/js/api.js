// Utility for making API requests
async function fetchApi(endpoint, options = {}) {
  const token = localStorage.getItem('finwise_token');
  const headers = {
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set default Content-Type to JSON if not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      localStorage.removeItem('finwise_token');
      localStorage.removeItem('finwise_user');
      window.location.href = 'index.html';
      throw new Error('Unauthorized');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'An error occurred');
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API
async function apiRegister(email, username, fullName, password) {
  return fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, full_name: fullName, password })
  });
}

async function apiLogin(email, password) {
  const formData = new FormData();
  formData.append('username', email);
  formData.append('password', password);
  return fetchApi('/auth/login', {
    method: 'POST',
    body: formData
  });
}

async function apiGetMe() {
  return fetchApi('/auth/me', { method: 'GET' });
}

// Categories API
async function apiGetCategories() {
  return fetchApi('/categories', { method: 'GET' });
}

async function apiCreateCategory(name, icon, color) {
  return fetchApi('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, icon, color })
  });
}

async function apiDeleteCategory(id) {
  return fetchApi(`/categories/${id}`, { method: 'DELETE' });
}

// Transactions API
async function apiGetTransactions(params = {}) {
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value);
    }
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  
  try {
    const res = await fetchApi(`/transactions${queryString}`, { method: 'GET' });
    if (res && res.items && (!params.page || params.page === 1) && !params.type && !params.category_id && !params.search) {
      cacheData('finwise_cached_transactions', res.items);
    }
    return res;
  } catch (err) {
    const cached = getCachedData('finwise_cached_transactions') || [];
    if (cached.length > 0) {
      console.warn('Returning cached transactions during offline mode');
      return {
        items: cached,
        total: cached.length,
        page: 1,
        limit: cached.length,
        pages: 1
      };
    }
    throw err;
  }
}

async function apiCreateTransaction(data, skipOffline = false) {
  if (!navigator.onLine && !skipOffline && typeof queueOfflineMutation === 'function') {
    const item = queueOfflineMutation('create', null, data);
    const cached = getCachedData('finwise_cached_transactions') || [];
    const optimisticTx = {
      id: item.tempId,
      amount: data.amount,
      type: data.type,
      category_id: data.category_id,
      category: { name: 'Category ' + data.category_id, icon: 'tag', color: '#10b981' },
      description: data.description,
      date: data.date,
      created_at: new Date().toISOString()
    };
    cached.unshift(optimisticTx);
    cacheData('finwise_cached_transactions', cached);
    return optimisticTx;
  }

  return fetchApi('/transactions', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiUpdateTransaction(id, data, skipOffline = false) {
  if (!navigator.onLine && !skipOffline && typeof queueOfflineMutation === 'function') {
    queueOfflineMutation('update', id, data);
    const cached = getCachedData('finwise_cached_transactions') || [];
    const tx = cached.find(t => t.id === id);
    if (tx) Object.assign(tx, data);
    cacheData('finwise_cached_transactions', cached);
    return tx || data;
  }

  return fetchApi(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiDeleteTransaction(id, skipOffline = false) {
  if (!navigator.onLine && !skipOffline && typeof queueOfflineMutation === 'function') {
    queueOfflineMutation('delete', id, null);
    const cached = getCachedData('finwise_cached_transactions') || [];
    const filtered = cached.filter(t => t.id !== id);
    cacheData('finwise_cached_transactions', filtered);
    return null;
  }

  return fetchApi(`/transactions/${id}`, { method: 'DELETE' });
}

async function apiBulkImportTransactions(transactions) {
  return fetchApi('/transactions/bulk-import', {
    method: 'POST',
    body: JSON.stringify({ transactions })
  });
}

// Reports API
async function apiGetSummary(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  try {
    const res = await fetchApi(`/reports/summary?${params.toString()}`, { method: 'GET' });
    if (!startDate && !endDate) cacheData('finwise_cached_summary', res);
    return res;
  } catch (err) {
    const cached = getCachedData('finwise_cached_summary');
    if (cached) return cached;
    throw err;
  }
}

async function apiByCategoryReport(startDate, endDate, type) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (type) params.append('type', type);
  return fetchApi(`/reports/by-category?${params.toString()}`, { method: 'GET' });
}

async function apiMonthlyTrend(months = 6) {
  return fetchApi(`/reports/monthly-trend?months=${months}`, { method: 'GET' });
}

async function apiDailyTrend(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  return fetchApi(`/reports/daily-trend?${params.toString()}`, { method: 'GET' });
}

// Data API
async function apiGetExchangeRates() {
  return fetchApi('/data/exchange-rates', { method: 'GET' });
}

async function apiTriggerCollection() {
  return fetchApi('/data/collect', { method: 'POST' });
}

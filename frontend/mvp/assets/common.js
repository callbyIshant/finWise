(() => {
  let csrfToken = null;
  async function csrf() {
    const response = await fetch('/api/v1/auth/csrf', {credentials: 'same-origin', cache: 'no-store'});
    if (!response.ok) throw new Error('Could not start a secure request. Please refresh.');
    csrfToken = (await response.json()).csrf_token;
    return csrfToken;
  }
  async function api(path, {method = 'GET', body, headers = {}} = {}) {
    const unsafe = !['GET', 'HEAD'].includes(method);
    if (unsafe && !csrfToken) await csrf();
    const send = () => fetch('/api/v1' + path, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: {...(body ? {'Content-Type': 'application/json'} : {}), ...(unsafe ? {'X-CSRF-Token': csrfToken} : {}), ...headers},
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    let response = await send();
    if (unsafe && response.status === 403) {
      let data = {};
      try { data = await response.clone().json(); } catch (_) {}
      if (data.code === 'csrf_rejected') {
        await csrf();
        response = await send();
      }
    }
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch (_) {}
      const error = new Error(data.message || data.detail || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = data.details;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  function fieldData(form) { return Object.fromEntries(new FormData(form).entries()); }
  function message(node, text, success = false) { node.textContent = text || ''; node.classList.toggle('success', success); }
  function money(value, currency = 'INR') { return new Intl.NumberFormat(undefined, {style: 'currency', currency}).format(Number(value)); }
  function localDate(timezone) {
    if (timezone) {
      const parts = new Intl.DateTimeFormat('en-US', {timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
  async function clearLegacyOffline() {
    try {
      if ('serviceWorker' in navigator) for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
      if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith('finwise')) await caches.delete(key);
    } catch (_) {}
  }
  clearLegacyOffline();
  window.FW = {api, csrf, fieldData, message, money, localDate, node};
})();

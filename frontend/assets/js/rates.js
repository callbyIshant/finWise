let currentRates = {};
const CURRENCIES = {
  'INR': { flag: '🇮🇳', name: 'Indian Rupee' },
  'EUR': { flag: '🇪🇺', name: 'Euro' },
  'GBP': { flag: '🇬🇧', name: 'British Pound' },
  'JPY': { flag: '🇯🇵', name: 'Japanese Yen' },
  'AUD': { flag: '🇦🇺', name: 'Australian Dollar' },
  'CAD': { flag: '🇨🇦', name: 'Canadian Dollar' },
  'SGD': { flag: '🇸🇬', name: 'Singapore Dollar' },
  'AED': { flag: '🇦🇪', name: 'UAE Dirham' },
  'CNY': { flag: '🇨🇳', name: 'Chinese Yuan' },
  'CHF': { flag: '🇨🇭', name: 'Swiss Franc' }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('finwise_token')) {
    window.location.href = 'index.html';
    return;
  }
  
  lucide.createIcons();
  setupCommonNav();

  document.getElementById('btn-refresh').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    btn.disabled = true;
    try {
      await apiTriggerCollection();
      await loadRates();
    } catch(err) {
      console.error(err);
    }
    btn.disabled = false;
  });

  const amountInput = document.getElementById('conv-amount');
  const currencySelect = document.getElementById('conv-currency');

  amountInput.addEventListener('input', calculateConversion);
  currencySelect.addEventListener('change', calculateConversion);

  await loadRates();
});

function setupCommonNav() {
  const user = JSON.parse(localStorage.getItem('finwise_user') || '{}');
  const greetingEl = document.getElementById('user-greeting');
  if (greetingEl) greetingEl.textContent = `Welcome back, ${user.username || 'User'}`;
  
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  if (hamburger && sidebar) hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('finwise_token');
    window.location.href = 'index.html';
  });
}

async function loadRates() {
  try {
    const data = await apiGetExchangeRates();
    
    // Process rates
    const grid = document.getElementById('rates-grid');
    const select = document.getElementById('conv-currency');
    
    grid.innerHTML = '';
    let selectOptions = '';
    let lastUpdated = data.last_updated ? new Date(data.last_updated).toLocaleString() : '';

    const ratesMap = data.rates || {};
    currentRates = ratesMap;

    const targetCodes = Object.keys(CURRENCIES);
    targetCodes.forEach(code => {
      const rateVal = ratesMap[code];
      const info = CURRENCIES[code];
      if (rateVal !== undefined) {
        grid.innerHTML += `
          <div class="card rate-card">
            <div class="rate-flag">${info.flag}</div>
            <div class="rate-info">
              <div class="rate-code">${code}</div>
              <div class="rate-name">${info.name}</div>
            </div>
            <div class="rate-value">${Number(rateVal).toFixed(2)}</div>
          </div>
        `;
        selectOptions += `<option value="${code}">${code} - ${info.name}</option>`;
      }
    });

    select.innerHTML = selectOptions;
    document.getElementById('last-updated').textContent = `Last updated: ${lastUpdated || 'Recently'}`;
    
    calculateConversion();
  } catch (e) {
    console.error("Error loading rates", e);
  }
}

function calculateConversion() {
  const amount = parseFloat(document.getElementById('conv-amount').value) || 0;
  const currency = document.getElementById('conv-currency').value;
  
  if (amount && currency && currentRates[currency]) {
    const rate = currentRates[currency];
    const result = amount * rate;
    
    // Format based on currency
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency });
    document.getElementById('conv-result').textContent = formatter.format(result);
  } else {
    document.getElementById('conv-result').textContent = '0.00';
  }
}

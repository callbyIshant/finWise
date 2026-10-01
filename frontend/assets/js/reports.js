document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('finwise_token')) {
    window.location.href = 'index.html';
    return;
  }
  
  lucide.createIcons();
  setupCommonNav();

  // Setup Date Presets
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const presetSelect = document.getElementById('date-preset');
  
  function applyPreset() {
    const val = presetSelect.value;
    const now = new Date();
    let start, end = new Date();

    if (val === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (val === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (val === 'last_3') {
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (val === 'last_6') {
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    } else if (val === 'this_year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      return;
    }

    startDateInput.value = start.toISOString().split('T')[0];
    endDateInput.value = end.toISOString().split('T')[0];
    loadReports();
  }

  presetSelect.addEventListener('change', applyPreset);
  document.getElementById('apply-dates').addEventListener('click', loadReports);

  // Set default (This Month)
  presetSelect.value = 'this_month';
  applyPreset();
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

let categoryChartInstance = null;
let trendChartInstance = null;

async function loadReports() {
  const start = document.getElementById('start-date').value;
  const end = document.getElementById('end-date').value;

  try {
    const [summary, catReport, trendReport, dailyReport] = await Promise.all([
      apiGetSummary(start, end),
      apiByCategoryReport(start, end, 'expense'),
      apiMonthlyTrend(12),
      apiDailyTrend(start, end)
    ]);

    // Summary Cards
    document.getElementById('rep-balance').textContent = formatCurrency(summary.net_balance);
    document.getElementById('rep-income').textContent = formatCurrency(summary.total_income);
    document.getElementById('rep-expense').textContent = formatCurrency(summary.total_expenses);
    document.getElementById('rep-tx-count').textContent = summary.transaction_count;

    renderCategoryBarChart(catReport);
    renderTrendLineChart(trendReport);
    renderHeatmap(dailyReport);

  } catch (e) {
    console.error("Error loading reports", e);
  }
}

function renderCategoryBarChart(data) {
  const ctx = document.getElementById('rep-category-chart');
  if (categoryChartInstance) categoryChartInstance.destroy();

  const defaultColors = [
    '#f43f5e', '#fb7185', '#fda4af', '#f43f5e', 
    '#e11d48', '#be123c', '#9f1239'
  ];

  categoryChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.category_name),
      datasets: [{
        label: 'Expenses',
        data: data.map(d => d.total_amount),
        backgroundColor: data.map((d, i) => d.category_color || defaultColors[i % defaultColors.length]),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#141a17',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          borderWidth: 1,
          titleColor: '#f0fdf4',
          bodyColor: '#a7c4b5',
          padding: 10,
          callbacks: {
            label: function(context) {
              return ` Total Spend: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#5c7a6a', font: { family: "'Inter', sans-serif", size: 11 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#a7c4b5', font: { family: "'Inter', sans-serif", size: 12 } }
        }
      }
    }
  });
}

function renderTrendLineChart(data) {
  const ctx = document.getElementById('rep-trend-chart');
  if (trendChartInstance) trendChartInstance.destroy();

  categoryChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.month),
      datasets: [
        {
          label: 'Money In',
          data: data.map(d => d.income),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#10b981',
          pointRadius: 4
        },
        {
          label: 'Money Out',
          data: data.map(d => d.expenses),
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#f43f5e',
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#a7c4b5',
            boxWidth: 12,
            font: { family: "'Inter', sans-serif", size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#141a17',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          borderWidth: 1,
          titleColor: '#f0fdf4',
          bodyColor: '#a7c4b5',
          padding: 10,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#5c7a6a', font: { family: "'Inter', sans-serif", size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#5c7a6a', font: { family: "'Inter', sans-serif", size: 11 } }
        }
      }
    }
  });
}

function renderHeatmap(data) {
  const container = document.getElementById('heatmap-container');
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem; text-align: center;">No daily spending data recorded in this range.</div>';
    return;
  }

  const daysHeader = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = '<table class="heatmap-table"><thead><tr>';
  daysHeader.forEach(d => {
    html += `<th style="text-align: center; padding: 6px; font-size: 11px; color: var(--text-muted);">${d}</th>`;
  });
  html += '</tr></thead><tbody>';

  let currentWeek = [];
  data.forEach(day => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      html += '<tr>' + currentWeek.map(d => generateHeatmapCell(d)).join('') + '</tr>';
      currentWeek = [];
    }
  });
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) { currentWeek.push(null); }
    html += '<tr>' + currentWeek.map(d => generateHeatmapCell(d)).join('') + '</tr>';
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function generateHeatmapCell(dayData) {
  if (!dayData) {
    return `<td class="heatmap-cell" style="background: rgba(255, 255, 255, 0.01); border-color: transparent;"></td>`;
  }
  
  const exp = parseFloat(dayData.expenses) || 0;
  const maxExpense = 5000;
  const intensity = Math.min(exp / maxExpense, 1);
  
  let bg;
  let textColor = '#5c7a6a';
  
  if (exp === 0) {
    bg = 'rgba(255, 255, 255, 0.02)';
  } else if (intensity < 0.25) {
    bg = 'rgba(16, 185, 129, 0.15)';
    textColor = '#34d399';
  } else if (intensity < 0.6) {
    bg = 'rgba(16, 185, 129, 0.35)';
    textColor = '#f0fdf4';
  } else {
    bg = 'rgba(16, 185, 129, 0.75)';
    textColor = '#0a0f0d';
  }
  
  const dayNum = new Date(dayData.date).getDate();
  
  return `
    <td class="heatmap-cell" style="background: ${bg};" title="${dayData.date}: ${formatCurrency(exp)}">
      <div class="heatmap-cell-content" style="color: ${textColor}; font-weight: 600;">
        <span>${dayNum}</span>
        ${exp > 0 ? `<span style="font-size: 9px; opacity: 0.85;">₹${Math.round(exp)}</span>` : ''}
      </div>
    </td>
  `;
}

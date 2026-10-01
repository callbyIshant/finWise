document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('finwise_token')) {
    window.location.href = 'index.html';
    return;
  }

  // Setup UI
  const user = JSON.parse(localStorage.getItem('finwise_user') || '{}');
  const greetingEl = document.getElementById('user-greeting');
  if (greetingEl) {
    greetingEl.textContent = `Welcome back, ${user.username || 'User'}`;
  }

  // Initialize Icons
  lucide.createIcons();

  // Sidebar toggle
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
  
  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('finwise_token');
      localStorage.removeItem('finwise_user');
      window.location.href = 'index.html';
    });
  }

  // Load Dashboard Data
  await loadDashboardData();
});

let currentCategoryReport = [];
window.cachedCategories = [];

async function loadDashboardData() {
  try {
    const [summary, categoryReport, trendReport, txResponse, categories] = await Promise.all([
      apiGetSummary(),
      apiByCategoryReport(null, null, 'expense'),
      apiMonthlyTrend(6),
      apiGetTransactions({ limit: 5 }),
      apiGetCategories()
    ]);

    currentCategoryReport = categoryReport || [];
    window.cachedCategories = categories || [];
    if (typeof cacheData === 'function') {
      cacheData('finwise_cached_categories', categories);
    }

    renderSummaryCards(summary);
    renderDoughnutChart(categoryReport);
    renderLineChart(trendReport);
    renderRecentTransactions(txResponse.items || []);

    const budgetsContainer = document.getElementById('dashboard-budgets-container');
    if (budgetsContainer && typeof CategoryBudgets !== 'undefined') {
      CategoryBudgets.renderBudgetsWidget(budgetsContainer, currentCategoryReport, window.cachedCategories);
    }

  } catch (error) {
    console.error("Dashboard error:", error);
    const existing = document.getElementById('dashboard-error-banner');
    if (!existing) {
      document.querySelector('.page-content').insertAdjacentHTML('afterbegin', 
        `<div id="dashboard-error-banner" class="card" style="margin-bottom: 24px; color: var(--expense); border-color: rgba(244,63,94,0.3);">Failed to fetch latest cloud data. Working in offline mode.</div>`
      );
    }
  }
}

window.loadDashboardData = loadDashboardData;
window.reloadBudgets = function() {
  const budgetsContainer = document.getElementById('dashboard-budgets-container');
  if (budgetsContainer && typeof CategoryBudgets !== 'undefined') {
    CategoryBudgets.renderBudgetsWidget(budgetsContainer, currentCategoryReport, window.cachedCategories);
  }
};

function renderSummaryCards(summary) {
  document.getElementById('stat-balance').textContent = formatCurrency(summary.net_balance);
  document.getElementById('stat-income').textContent = formatCurrency(summary.total_income);
  document.getElementById('stat-expense').textContent = formatCurrency(summary.total_expenses);
  document.getElementById('stat-tx-count').textContent = summary.transaction_count;
}

function renderDoughnutChart(categoryReport) {
  const ctx = document.getElementById('category-chart');
  if (!ctx || !categoryReport.length) return;

  const defaultColors = [
    '#10b981', '#34d399', '#f43f5e', '#eab308', 
    '#8b5cf6', '#06b6d4', '#3b82f6', '#ec4899'
  ];

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categoryReport.map(c => c.category_name),
      datasets: [{
        data: categoryReport.map(c => c.total_amount),
        backgroundColor: categoryReport.map((c, i) => c.category_color || defaultColors[i % defaultColors.length]),
        borderColor: '#16201b',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#a7c4b5',
            boxWidth: 12,
            boxHeight: 12,
            font: { family: "'Inter', sans-serif", size: 12 },
            padding: 14
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
              return ` ${context.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      cutout: '72%'
    }
  });
}

function renderLineChart(trendReport) {
  const ctx = document.getElementById('trend-chart');
  if (!ctx || !trendReport.length) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendReport.map(t => t.month),
      datasets: [
        {
          label: 'Money In',
          data: trendReport.map(t => t.income),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Money Out',
          data: trendReport.map(t => t.expenses),
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#f43f5e',
          pointRadius: 4,
          pointHoverRadius: 6
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
            font: { family: "'Inter', sans-serif", size: 12 },
            padding: 16
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

function renderRecentTransactions(transactions) {
  const tbody = document.getElementById('recent-tx-body');
  if (!tbody) return;
  
  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No recent transactions</td></tr>`;
    return;
  }

  tbody.innerHTML = transactions.map(tx => {
    const isIncome = tx.type === 'income';
    const amountCls = isIncome ? 'positive' : 'negative';
    const dateStr = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    return `
      <tr>
        <td style="color: var(--text-secondary); font-size: var(--font-size-xs);">${dateStr}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color: ${tx.category.color}"><i data-lucide="${tx.category.icon}"></i></span>
            <span style="font-weight: 500;">${tx.category.name}</span>
          </div>
        </td>
        <td><span class="badge badge-${tx.type}">${isIncome ? 'Money In' : 'Money Out'}</span></td>
        <td class="stat-change ${amountCls}" style="font-weight:600; font-family: var(--font-serif); font-size: 1rem;">
          ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
        </td>
      </tr>
    `;
  }).join('');
  
  lucide.createIcons();
}

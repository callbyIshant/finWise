// Pocket Clear Category Budgets Manager

const BUDGETS_STORAGE_KEY = 'finwise_category_budgets';

const CategoryBudgets = {
  getBudgets() {
    try {
      const data = localStorage.getItem(BUDGETS_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading budgets:', e);
    }
    // Default starting sensible budget limits for pre-seeded categories
    return {
      'Food & Dining': 12000,
      'Transportation': 4000,
      'Shopping': 6000,
      'Entertainment': 3000,
      'Utilities': 5000,
      'Housing': 25000
    };
  },

  saveBudgets(budgets) {
    localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(budgets));
  },

  setCategoryBudget(categoryKey, amount) {
    const budgets = this.getBudgets();
    budgets[categoryKey] = parseFloat(amount) || 0;
    this.saveBudgets(budgets);
  },

  renderBudgetsWidget(containerEl, categoryReport = [], categories = []) {
    if (!containerEl) return;
    const budgets = this.getBudgets();

    // Map spent by category name
    const spentMap = {};
    categoryReport.forEach((item) => {
      spentMap[item.category_name] = parseFloat(item.total_amount) || 0;
    });

    const categoriesWithBudgets = categories.filter(c => budgets[c.name] && budgets[c.name] > 0);

    if (categoriesWithBudgets.length === 0) {
      containerEl.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem; text-align: center;">
          <p style="color: var(--text-muted); margin-bottom: 12px;">No category budgets set yet.</p>
          <button class="btn btn-secondary btn-sm" onclick="CategoryBudgets.openBudgetModal()">
            <i data-lucide="sliders" style="width: 14px; height: 14px;"></i> Set Monthly Budgets
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    let cardsHtml = '';
    categoriesWithBudgets.forEach((cat) => {
      const budgetLimit = budgets[cat.name] || 0;
      const spent = spentMap[cat.name] || 0;
      const percentage = Math.min(Math.round((spent / budgetLimit) * 100), 100);
      const isOver = spent > budgetLimit;
      const overAmount = spent - budgetLimit;

      let statusCls = 'progress-safe';
      let statusText = `${percentage}% spent`;
      let barColor = '#10b981';

      if (isOver) {
        statusCls = 'progress-danger';
        statusText = `Over budget by ${formatCurrency(overAmount)}`;
        barColor = '#f43f5e';
      } else if (percentage >= 75) {
        statusCls = 'progress-warn';
        statusText = `${percentage}% used (${formatCurrency(budgetLimit - spent)} left)`;
        barColor = '#eab308';
      } else {
        statusText = `${formatCurrency(budgetLimit - spent)} left`;
      }

      cardsHtml += `
        <div class="budget-item-card">
          <div class="budget-item-header">
            <div class="budget-cat-name">
              <span class="cat-icon-chip" style="color: ${cat.color};">
                <i data-lucide="${cat.icon || 'tag'}" style="width:16px;height:16px;"></i>
              </span>
              <span>${cat.name}</span>
            </div>
            <div class="budget-amounts">
              <strong>${formatCurrency(spent)}</strong>
              <span class="budget-limit">/ ${formatCurrency(budgetLimit)}</span>
            </div>
          </div>
          <div class="budget-progress-track">
            <div class="budget-progress-fill ${statusCls}" style="width: ${Math.min(percentage, 100)}%; background-color: ${barColor};"></div>
          </div>
          <div class="budget-item-footer">
            <span class="budget-status-label ${statusCls}">${statusText}</span>
            <span class="budget-cap">${percentage}%</span>
          </div>
        </div>
      `;
    });

    containerEl.innerHTML = cardsHtml;
    if (window.lucide) lucide.createIcons();
  },

  openBudgetModal(categories = []) {
    let modal = document.getElementById('budget-modal');
    if (!modal) {
      this.createBudgetModal(categories);
      modal = document.getElementById('budget-modal');
    }
    this.populateBudgetModalFields(categories);
    modal.classList.add('active');
  },

  closeBudgetModal() {
    const modal = document.getElementById('budget-modal');
    if (modal) modal.classList.remove('active');
  },

  createBudgetModal(categories = []) {
    const div = document.createElement('div');
    div.id = 'budget-modal';
    div.className = 'modal-backdrop';
    div.innerHTML = `
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="brand-icon" style="width: 28px; height: 28px;"><i data-lucide="sliders" style="width: 16px; height: 16px;"></i></div>
            <h3 style="font-family: var(--font-serif); font-size: 1.25rem;">Category Monthly Budgets</h3>
          </div>
          <button class="btn btn-ghost" onclick="CategoryBudgets.closeBudgetModal()"><i data-lucide="x"></i></button>
        </div>
        <form id="budget-form">
          <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: 16px;">
            Set your target monthly spending caps. FinWise will monitor consumption and alert you when approaching limits.
          </p>
          <div id="budget-inputs-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 360px; overflow-y: auto; padding-right: 4px;">
            <!-- Category budget inputs populated dynamically -->
          </div>
          <div class="modal-footer" style="margin-top: 20px;">
            <button type="button" class="btn btn-secondary" onclick="CategoryBudgets.closeBudgetModal()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="check" style="width: 16px; height: 16px;"></i> Save Budgets</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(div);

    document.getElementById('budget-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const currentBudgets = this.getBudgets();
      const inputs = document.querySelectorAll('.budget-input-field');
      inputs.forEach((input) => {
        const catName = input.getAttribute('data-cat-name');
        const val = parseFloat(input.value) || 0;
        if (val > 0) {
          currentBudgets[catName] = val;
        } else {
          delete currentBudgets[catName];
        }
      });
      this.saveBudgets(currentBudgets);
      this.closeBudgetModal();

      // Trigger dashboard reload if on dashboard
      if (typeof window.reloadBudgets === 'function') {
        window.reloadBudgets();
      }
    });

    if (window.lucide) lucide.createIcons();
  },

  populateBudgetModalFields(categories = []) {
    const list = document.getElementById('budget-inputs-list');
    if (!list) return;
    const currentBudgets = this.getBudgets();

    list.innerHTML = categories.map((cat) => {
      const currentVal = currentBudgets[cat.name] || '';
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--bg-elevated); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: ${cat.color};"><i data-lucide="${cat.icon || 'tag'}" style="width: 16px; height: 16px;"></i></span>
            <span style="font-weight: 500; font-size: 13px;">${cat.name}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; width: 140px;">
            <span style="color: var(--text-muted); font-size: 12px;">₹</span>
            <input 
              type="number" 
              step="100" 
              min="0"
              class="budget-input-field form-input" 
              data-cat-name="${cat.name}" 
              value="${currentVal}" 
              placeholder="No limit" 
              style="padding: 6px 10px; font-size: 13px; text-align: right;"
            />
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }
};

window.CategoryBudgets = CategoryBudgets;

// Pocket Clear Style Financial Calculators Hub

const FinancialCalculators = {
  openCalculatorsModal() {
    let modal = document.getElementById('calculators-modal');
    if (!modal) {
      this.createCalculatorsModal();
      modal = document.getElementById('calculators-modal');
    }
    modal.classList.add('active');
  },

  closeCalculatorsModal() {
    const modal = document.getElementById('calculators-modal');
    if (modal) modal.classList.remove('active');
  },

  createCalculatorsModal() {
    const div = document.createElement('div');
    div.id = 'calculators-modal';
    div.className = 'modal-backdrop';
    div.innerHTML = `
      <div class="modal-card" style="max-width: 540px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="brand-icon" style="width: 28px; height: 28px;"><i data-lucide="calculator" style="width: 16px; height: 16px;"></i></div>
            <h3 style="font-family: var(--font-serif); font-size: 1.25rem;">Financial Tools & Calculators</h3>
          </div>
          <button class="btn btn-ghost" onclick="FinancialCalculators.closeCalculatorsModal()"><i data-lucide="x"></i></button>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
          <button class="btn btn-sm btn-primary calc-tab-btn" id="tab-503020" onclick="FinancialCalculators.switchTab('503020')">50/30/20 Rule</button>
          <button class="btn btn-sm btn-secondary calc-tab-btn" id="tab-emergency" onclick="FinancialCalculators.switchTab('emergency')">Emergency Fund</button>
          <button class="btn btn-sm btn-secondary calc-tab-btn" id="tab-debt" onclick="FinancialCalculators.switchTab('debt')">Debt Payoff</button>
        </div>

        <!-- 50/30/20 Rule Pane -->
        <div id="pane-503020" class="calc-pane" style="display: block;">
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Monthly Take-Home Income</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">₹</span>
              <input type="number" id="calc-income-input" class="form-input" value="60000" style="padding-left: 28px;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; background: var(--bg-elevated); padding: 16px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #10b981;">50% Needs</strong>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Rent, groceries, utilities, bills</p>
              </div>
              <span id="res-needs" style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 600;">₹30,000</span>
            </div>
            <div style="height: 1px; background: var(--border-subtle);"></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #eab308;">30% Wants</strong>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Dining, entertainment, shopping</p>
              </div>
              <span id="res-wants" style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 600;">₹18,000</span>
            </div>
            <div style="height: 1px; background: var(--border-subtle);"></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #3b82f6;">20% Savings & Debt</strong>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Investments, SIPs, debt prepay</p>
              </div>
              <span id="res-savings" style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 600;">₹12,000</span>
            </div>
          </div>
        </div>

        <!-- Emergency Fund Pane -->
        <div id="pane-emergency" class="calc-pane" style="display: none;">
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Monthly Living Expenses</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">₹</span>
              <input type="number" id="calc-expense-input" class="form-input" value="35000" style="padding-left: 28px;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; background: var(--bg-elevated); padding: 16px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #10b981;">3 Months (Starter Cushion)</strong>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Covers urgent shocks & minor disruptions</p>
              </div>
              <span id="res-ef-3" style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 600;">₹1,05,000</span>
            </div>
            <div style="height: 1px; background: var(--border-subtle);"></div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #3b82f6;">6 Months (Full Shield)</strong>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0;">Complete peace-of-mind safety buffer</p>
              </div>
              <span id="res-ef-6" style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 600;">₹2,10,000</span>
            </div>
          </div>
        </div>

        <!-- Debt Payoff Pane -->
        <div id="pane-debt" class="calc-pane" style="display: none;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">Total Debt Balance (₹)</label>
              <input type="number" id="calc-debt-bal" class="form-input" value="100000" />
            </div>
            <div class="form-group">
              <label class="form-label">Annual Interest Rate (%)</label>
              <input type="number" id="calc-debt-rate" class="form-input" value="12" step="0.5" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Monthly Payment Budget (₹)</label>
            <input type="number" id="calc-debt-pay" class="form-input" value="5000" />
          </div>

          <div style="background: var(--bg-elevated); padding: 14px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); text-align: center;">
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Estimated Time to Debt Freedom</p>
            <h3 id="res-debt-months" style="font-family: var(--font-serif); color: #10b981; font-size: 1.5rem; margin-bottom: 4px;">24 Months</h3>
            <p id="res-debt-interest" style="font-size: 11px; color: var(--text-muted); margin: 0;">Total interest paid: ₹12,800</p>
          </div>
        </div>

        <div class="modal-footer" style="margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="FinancialCalculators.closeCalculatorsModal()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    // Event listeners
    const incomeInp = div.querySelector('#calc-income-input');
    const update503020 = () => {
      const inc = parseFloat(incomeInp.value) || 0;
      div.querySelector('#res-needs').textContent = formatCurrency(inc * 0.5);
      div.querySelector('#res-wants').textContent = formatCurrency(inc * 0.3);
      div.querySelector('#res-savings').textContent = formatCurrency(inc * 0.2);
    };
    incomeInp.addEventListener('input', update503020);

    const expenseInp = div.querySelector('#calc-expense-input');
    const updateEF = () => {
      const exp = parseFloat(expenseInp.value) || 0;
      div.querySelector('#res-ef-3').textContent = formatCurrency(exp * 3);
      div.querySelector('#res-ef-6').textContent = formatCurrency(exp * 6);
    };
    expenseInp.addEventListener('input', updateEF);

    const balInp = div.querySelector('#calc-debt-bal');
    const rateInp = div.querySelector('#calc-debt-rate');
    const payInp = div.querySelector('#calc-debt-pay');

    const updateDebt = () => {
      let b = parseFloat(balInp.value) || 0;
      const r = (parseFloat(rateInp.value) || 0) / 100 / 12;
      const p = parseFloat(payInp.value) || 0;

      if (p <= b * r) {
        div.querySelector('#res-debt-months').textContent = 'Increase payment';
        div.querySelector('#res-debt-interest').textContent = 'Monthly payment does not cover monthly interest.';
        return;
      }

      let months = 0;
      let totalInterest = 0;
      while (b > 0 && months < 360) {
        const interest = b * r;
        totalInterest += interest;
        b = b + interest - p;
        months++;
      }

      div.querySelector('#res-debt-months').textContent = `${months} Months (${(months / 12).toFixed(1)} yrs)`;
      div.querySelector('#res-debt-interest').textContent = `Total estimated interest: ${formatCurrency(Math.round(totalInterest))}`;
    };

    balInp.addEventListener('input', updateDebt);
    rateInp.addEventListener('input', updateDebt);
    payInp.addEventListener('input', updateDebt);

    if (window.lucide) lucide.createIcons();
  },

  switchTab(tabId) {
    document.querySelectorAll('.calc-tab-btn').forEach(b => {
      b.classList.remove('btn-primary');
      b.classList.add('btn-secondary');
    });
    const activeBtn = document.getElementById(`tab-${tabId}`);
    if (activeBtn) {
      activeBtn.classList.remove('btn-secondary');
      activeBtn.classList.add('btn-primary');
    }

    document.querySelectorAll('.calc-pane').forEach(p => p.style.display = 'none');
    const activePane = document.getElementById(`pane-${tabId}`);
    if (activePane) activePane.style.display = 'block';
  }
};

window.FinancialCalculators = FinancialCalculators;

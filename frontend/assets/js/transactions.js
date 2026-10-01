let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let categoriesList = [];

// Quick amount increment helper
window.addAmount = function(val) {
  const input = document.getElementById('tx-amount');
  const current = parseFloat(input.value) || 0;
  input.value = (current + val).toFixed(2);
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('finwise_token')) {
    window.location.href = 'index.html';
    return;
  }
  
  if (window.lucide) lucide.createIcons();
  setupCommonNav();
  
  // Setup Transaction Modal
  const modal = document.getElementById('tx-modal');
  const btnAdd = document.getElementById('btn-add-tx');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  
  const openModal = () => {
    // Set default date to today
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    modal.classList.add('active');
  };

  const closeModal = () => {
    modal.classList.remove('active');
    document.getElementById('tx-form').reset();
    document.getElementById('tx-id').value = '';
    document.getElementById('tx-modal-title').textContent = 'Log a Transaction';
  };

  if (btnAdd) btnAdd.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Setup Quick Text / SMS Paste Modal
  setupQuickPasteModal();

  // Load Initial Data
  await loadCategories();
  await loadTransactions();

  // Setup Filters
  document.getElementById('filter-btn').addEventListener('click', () => {
    currentPage = 1;
    loadTransactions();
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-search').value = '';
    currentPage = 1;
    loadTransactions();
  });

  // Pagination
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadTransactions();
    }
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    currentPage++;
    loadTransactions();
  });

  // Form Submit
  document.getElementById('tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const data = {
      amount: parseFloat(document.getElementById('tx-amount').value),
      type: document.querySelector('input[name="tx-type"]:checked').value,
      category_id: parseInt(document.getElementById('tx-category').value),
      description: document.getElementById('tx-desc').value,
      date: document.getElementById('tx-date').value
    };

    try {
      if (id) {
        await apiUpdateTransaction(id, data);
      } else {
        await apiCreateTransaction(data);
      }
      closeModal();
      loadTransactions();
    } catch (err) {
      alert("Error saving transaction: " + err.message);
    }
  });

  // Global Keyboard Shortcuts (N for new, Esc to close)
  document.addEventListener('keydown', (e) => {
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if ((e.key === 'n' || e.key === 'N') && !isTyping && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      openModal();
    } else if (e.key === 'Escape') {
      closeModal();
      closeQuickPasteModal();
      if (typeof DataTransfer !== 'undefined') DataTransfer.closeImportModal();
    }
  });
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

// Quick Text / Bank SMS Paste Controller
let currentParsedData = null;

function setupQuickPasteModal() {
  const modal = document.getElementById('smart-paste-modal');
  const btnOpen = document.getElementById('btn-smart-paste');
  const btnClose = document.getElementById('btn-close-paste');
  const btnCancel = document.getElementById('btn-cancel-paste');
  const btnApply = document.getElementById('btn-apply-paste');
  const textarea = document.getElementById('paste-input');
  const previewBox = document.getElementById('paste-preview-box');

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener('click', () => {
    modal.classList.add('active');
    textarea.value = '';
    previewBox.style.display = 'none';
    btnApply.disabled = true;
    currentParsedData = null;
    textarea.focus();
  });

  const close = () => {
    modal.classList.remove('active');
  };

  window.closeQuickPasteModal = close;
  if (btnClose) btnClose.addEventListener('click', close);
  if (btnCancel) btnCancel.addEventListener('click', close);

  textarea.addEventListener('input', () => {
    const text = textarea.value.trim();
    if (text.length < 5) {
      previewBox.style.display = 'none';
      btnApply.disabled = true;
      currentParsedData = null;
      return;
    }

    if (typeof QuickCaptureParser !== 'undefined') {
      const parsed = QuickCaptureParser.parse(text, categoriesList);
      if (parsed && parsed.amount) {
        currentParsedData = parsed;
        previewBox.style.display = 'block';
        document.getElementById('parsed-amount').textContent = formatCurrency(parsed.amount);
        
        const typeBadge = document.getElementById('parsed-type');
        typeBadge.textContent = parsed.type === 'income' ? 'Money In' : 'Money Out';
        typeBadge.className = `badge badge-${parsed.type}`;

        document.getElementById('parsed-date').textContent = parsed.date;
        document.getElementById('parsed-category').textContent = parsed.categoryName || 'Unassigned';
        document.getElementById('parsed-desc').textContent = parsed.description;
        btnApply.disabled = false;
      } else {
        previewBox.style.display = 'none';
        btnApply.disabled = true;
        currentParsedData = null;
      }
    }
  });

  btnApply.addEventListener('click', async () => {
    if (!currentParsedData || !currentParsedData.amount) return;
    
    // If no category ID assigned, pick the first category
    const catId = currentParsedData.categoryId || (categoriesList[0] ? categoriesList[0].id : 1);

    const payload = {
      amount: currentParsedData.amount,
      type: currentParsedData.type,
      category_id: catId,
      description: currentParsedData.description,
      date: currentParsedData.date
    };

    try {
      await apiCreateTransaction(payload);
      close();
      loadTransactions();
    } catch (err) {
      alert("Error saving transaction: " + err.message);
    }
  });
}

async function loadCategories() {
  try {
    categoriesList = await apiGetCategories();
    const filterCat = document.getElementById('filter-category');
    const formCat = document.getElementById('tx-category');
    
    let options = '<option value="">All Categories</option>';
    let formOptions = '<option value="">Select Category</option>';
    
    categoriesList.forEach(c => {
      const opt = `<option value="${c.id}">${c.name}</option>`;
      options += opt;
      formOptions += opt;
    });
    
    if (filterCat) filterCat.innerHTML = options;
    if (formCat) formCat.innerHTML = formOptions;
  } catch (e) {
    console.error("Error loading categories", e);
  }
}

async function loadTransactions() {
  const params = {
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    type: document.getElementById('filter-type').value,
    category_id: document.getElementById('filter-category').value,
    search: document.getElementById('filter-search').value
  };

  try {
    const res = await apiGetTransactions(params);
    renderTable(res.items);
    
    document.getElementById('page-info').textContent = `Page ${currentPage}`;
    document.getElementById('btn-prev').disabled = currentPage === 1;
    document.getElementById('btn-next').disabled = res.items.length < ITEMS_PER_PAGE;
  } catch (e) {
    console.error("Error loading transactions", e);
  }
}

window.loadTransactions = loadTransactions;

function renderTable(items) {
  const tbody = document.getElementById('tx-table-body');
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No transactions found</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(tx => {
    const isIncome = tx.type === 'income';
    const amountCls = isIncome ? 'positive' : 'negative';
    const dateStr = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const desc = tx.description ? (tx.description.length > 40 ? tx.description.substring(0, 37) + '...' : tx.description) : 'No memo';
    const cat = tx.category || { name: 'Category', icon: 'tag', color: '#10b981' };

    return `
      <tr>
        <td>${dateStr}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color: ${cat.color}"><i data-lucide="${cat.icon || 'tag'}"></i></span>
            ${cat.name}
          </div>
        </td>
        <td title="${tx.description || ''}">${desc}</td>
        <td><span class="badge badge-${tx.type}">${isIncome ? 'Money In' : 'Money Out'}</span></td>
        <td class="stat-change ${amountCls}" style="font-weight:600; font-family: var(--font-serif);">
          ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
        </td>
        <td>
          <button class="btn btn-ghost" onclick="window.editTx('${tx.id}')" title="Edit" style="padding: 4px;"><i data-lucide="pencil" style="width:16px;height:16px;"></i></button>
          <button class="btn btn-ghost" onclick="window.deleteTx('${tx.id}')" title="Delete" style="color:var(--color-danger); padding: 4px;"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>
        </td>
      </tr>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();
}

// Global functions for inline handlers
window.editTx = async function(id) {
  try {
    const res = await apiGetTransactions({ page: 1, limit: 100 });
    const tx = res.items.find(t => String(t.id) === String(id));
    if (tx) {
      document.getElementById('tx-id').value = tx.id;
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-category').value = tx.category_id;
      document.getElementById('tx-desc').value = tx.description || '';
      document.getElementById('tx-date').value = tx.date;
      document.querySelector(`input[name="tx-type"][value="${tx.type}"]`).checked = true;
      
      document.getElementById('tx-modal-title').textContent = 'Edit Transaction';
      document.getElementById('tx-modal').classList.add('active');
    }
  } catch(e) { console.error(e); }
};

window.deleteTx = async function(id) {
  if (confirm("Are you sure you want to delete this transaction?")) {
    try {
      await apiDeleteTransaction(id);
      loadTransactions();
    } catch(e) {
      console.error(e);
      alert("Failed to delete transaction.");
    }
  }
};

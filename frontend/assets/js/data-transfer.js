// Data Transfer (Export & Import) Manager for FinWise (Pocket Clear style)

const DataTransfer = {
  // Export Transactions (CSV or JSON)
  async exportData(format = 'csv') {
    const token = localStorage.getItem('finwise_token');
    const today = new Date().toISOString().split('T')[0];
    const filename = `finwise_export_${today}.${format}`;

    // Try backend export first if online
    if (navigator.onLine && token) {
      try {
        const response = await fetch(`${API_BASE_URL}/transactions/export?format=${format}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const blob = await response.blob();
          this.triggerDownload(blob, filename);
          return;
        }
      } catch (err) {
        console.warn('Backend export failed, falling back to local client export', err);
      }
    }

    // Client-side fallback export (from cached data + offline queue)
    const cached = getCachedData('finwise_cached_transactions') || [];
    const queue = typeof getOfflineQueue === 'function' ? getOfflineQueue() : [];
    
    // Combine items
    const allItems = [...cached];
    queue.forEach(q => {
      if (q.action === 'create') {
        allItems.unshift({
          ...q.payload,
          id: q.tempId,
          category: { name: 'Offline' }
        });
      }
    });

    if (format === 'json') {
      const jsonStr = JSON.stringify(allItems, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      this.triggerDownload(blob, filename);
    } else {
      // RFC-4180 CSV
      let csv = 'Date,Type,Category,Amount,Description,ID\r\n';
      allItems.forEach(t => {
        const cat = t.category ? t.category.name : '';
        const desc = (t.description || '').replace(/"/g, '""');
        csv += `"${t.date}","${t.type}","${cat}","${t.amount}","${desc}","${t.id || ''}"\r\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      this.triggerDownload(blob, filename);
    }
  },

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // CSV Parser Utility (handles RFC-4180 quotes, commas, escapes)
  parseCSV(text) {
    const lines = [];
    let row = [''];
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
      i++;
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  },

  // Open CSV Import Flow
  openImportModal(categories = []) {
    let modal = document.getElementById('csv-import-modal');
    if (!modal) {
      this.createImportModal(categories);
      modal = document.getElementById('csv-import-modal');
    }
    modal.classList.add('active');
  },

  closeImportModal() {
    const modal = document.getElementById('csv-import-modal');
    if (modal) modal.classList.remove('active');
  },

  createImportModal(categories = []) {
    const div = document.createElement('div');
    div.id = 'csv-import-modal';
    div.className = 'modal-backdrop';
    div.innerHTML = `
      <div class="modal-card" style="max-width: 600px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="brand-icon" style="width: 28px; height: 28px;"><i data-lucide="file-up" style="width: 16px; height: 16px;"></i></div>
            <h3 style="font-family: var(--font-serif); font-size: 1.25rem;">Import Transactions CSV</h3>
          </div>
          <button class="btn btn-ghost" onclick="DataTransfer.closeImportModal()"><i data-lucide="x"></i></button>
        </div>

        <div id="import-step-upload" style="display: block;">
          <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin-bottom: 16px;">
            Upload your bank statement or expense tracker CSV file. Data is processed privately and securely.
          </p>
          <div class="file-dropzone" id="csv-dropzone" style="border: 2px dashed rgba(16, 185, 129, 0.3); border-radius: var(--radius-lg); padding: 32px 20px; text-align: center; cursor: pointer; background: var(--bg-elevated); transition: all 0.2s ease;">
            <i data-lucide="upload-cloud" style="width: 36px; height: 36px; color: var(--accent); margin-bottom: 12px;"></i>
            <h4 style="font-weight: 600; margin-bottom: 6px;">Click or Drag & Drop CSV here</h4>
            <p style="color: var(--text-muted); font-size: var(--font-size-xs);">Supports standard bank statements and FinWise CSV exports</p>
            <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display: none;" />
          </div>
        </div>

        <div id="import-step-preview" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 14px; font-weight: 600;">Match Columns & Preview</h4>
            <span id="preview-row-count" style="font-size: 12px; color: var(--accent);"></span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px;">
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Date Column</label>
              <select id="map-date" class="form-input form-select" style="padding: 6px; font-size: 12px;"></select>
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Amount Column</label>
              <select id="map-amount" class="form-input form-select" style="padding: 6px; font-size: 12px;"></select>
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Description</label>
              <select id="map-desc" class="form-input form-select" style="padding: 6px; font-size: 12px;"></select>
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Default Category</label>
              <select id="map-category" class="form-input form-select" style="padding: 6px; font-size: 12px;">
                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); margin-bottom: 16px;">
            <table class="data-table" style="font-size: 12px;">
              <thead id="preview-table-head"></thead>
              <tbody id="preview-table-body"></tbody>
            </table>
          </div>

          <div class="modal-footer" style="margin-top: 16px;">
            <button type="button" class="btn btn-secondary" onclick="DataTransfer.resetImportStep()">Back</button>
            <button type="button" class="btn btn-primary" id="btn-execute-import"><i data-lucide="check" style="width: 14px; height: 14px;"></i> Import Rows</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    // Setup Drag and Drop
    const dropzone = div.querySelector('#csv-dropzone');
    const fileInput = div.querySelector('#csv-file-input');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--accent)';
      dropzone.style.background = 'rgba(16,185,129,0.05)';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      dropzone.style.background = 'var(--bg-elevated)';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      dropzone.style.background = 'var(--bg-elevated)';
      if (e.dataTransfer.files.length) {
        this.handleFileUpload(e.dataTransfer.files[0], categories);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.handleFileUpload(e.target.files[0], categories);
      }
    });

    if (window.lucide) lucide.createIcons();
  },

  parsedData: null,
  handleFileUpload(file, categories) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = this.parseCSV(text);
      if (rows.length < 2) {
        alert("The selected CSV file has no transaction rows.");
        return;
      }
      this.parsedData = rows;
      this.showPreview(rows, categories);
    };
    reader.readAsText(file);
  },

  showPreview(rows, categories) {
    document.getElementById('import-step-upload').style.display = 'none';
    document.getElementById('import-step-preview').style.display = 'block';

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim().length > 0));

    document.getElementById('preview-row-count').textContent = `${dataRows.length} rows detected`;

    // Populate column mapping selectors
    const populateSelect = (selectId, guessKeywords) => {
      const select = document.getElementById(selectId);
      select.innerHTML = headers.map((h, idx) => `<option value="${idx}">${h}</option>`).join('');
      // Auto-guess
      const matchedIdx = headers.findIndex(h => guessKeywords.some(kw => h.toLowerCase().includes(kw)));
      if (matchedIdx !== -1) select.value = matchedIdx;
    };

    populateSelect('map-date', ['date', 'time', 'timestamp', 'day']);
    populateSelect('map-amount', ['amount', 'debit', 'value', 'price', 'inr', 'rs', 'sum']);
    populateSelect('map-desc', ['description', 'desc', 'narration', 'merchant', 'details', 'particulars', 'remark', 'note']);

    // Render Preview Table
    const thead = document.getElementById('preview-table-head');
    const tbody = document.getElementById('preview-table-body');
    thead.innerHTML = `<tr>${headers.map(h => `<th style="padding: 6px 10px;">${h}</th>`).join('')}</tr>`;

    tbody.innerHTML = dataRows.slice(0, 5).map(r => `
      <tr>${r.map(cell => `<td style="padding: 6px 10px; color: var(--text-secondary);">${cell}</td>`).join('')}</tr>
    `).join('');

    // Wire up Import button
    const btnExecute = document.getElementById('btn-execute-import');
    btnExecute.onclick = async () => {
      await this.executeImport(dataRows, categories);
    };

    if (window.lucide) lucide.createIcons();
  },

  resetImportStep() {
    document.getElementById('import-step-upload').style.display = 'block';
    document.getElementById('import-step-preview').style.display = 'none';
    const input = document.getElementById('csv-file-input');
    if (input) input.value = '';
  },

  async executeImport(dataRows, categories) {
    const dateIdx = parseInt(document.getElementById('map-date').value);
    const amountIdx = parseInt(document.getElementById('map-amount').value);
    const descIdx = parseInt(document.getElementById('map-desc').value);
    const defaultCatId = parseInt(document.getElementById('map-category').value);

    const validPayloads = [];
    const todayStr = new Date().toISOString().split('T')[0];

    dataRows.forEach(row => {
      let rawDate = row[dateIdx] ? row[dateIdx].trim() : todayStr;
      let rawAmount = row[amountIdx] ? row[amountIdx].replace(/[^\d.-]/g, '') : '0';
      let rawDesc = row[descIdx] ? row[descIdx].trim() : 'CSV Import';

      let amount = Math.abs(parseFloat(rawAmount) || 0);
      if (amount <= 0) return;

      // Determine date format
      let formattedDate = todayStr;
      if (rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        formattedDate = rawDate;
      } else {
        const parts = rawDate.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else {
            const yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            formattedDate = `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      }

      // Check future date
      if (new Date(formattedDate) > new Date()) {
        formattedDate = todayStr;
      }

      validPayloads.push({
        category_id: defaultCatId,
        amount: amount,
        type: 'expense',
        description: rawDesc || 'CSV Import',
        date: formattedDate
      });
    });

    if (validPayloads.length === 0) {
      alert("No valid rows could be parsed from the CSV.");
      return;
    }

    try {
      const res = await apiBulkImportTransactions(validPayloads);
      alert(`Successfully imported ${validPayloads.length} transactions!`);
      this.closeImportModal();
      this.resetImportStep();
      if (typeof window.loadTransactions === 'function') window.loadTransactions();
      if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
    } catch (err) {
      alert(`Import error: ${err.message}`);
    }
  }
};

window.DataTransfer = DataTransfer;

/* ============================================================================
   PCMC Washing Centre - Daily Entries Controller
   Spreadsheet grid management, real-time calculations, Excel export, and modal CRUD
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  await PCMC_AUTH.requireAuth();

  // 2. DOM Elements
  const dateFilterSelect = document.getElementById('entryDateFilter');
  const customBox = document.getElementById('entryCustomRangeBox');
  const customStart = document.getElementById('entryCustomStart');
  const customEnd = document.getElementById('entryCustomEnd');
  const btnApplyCustom = document.getElementById('btnApplyEntryCustom');
  const searchInput = document.getElementById('entrySearchInput');
  const tbody = document.getElementById('dailyEntriesTbody');
  const countLabel = document.getElementById('entriesCountLabel');
  const btnOpenAdd = document.getElementById('btnOpenAddModal');
  const btnExport = document.getElementById('btnExportEntries');

  // Modal Elements
  const entryModal = document.getElementById('entryModal');
  const modalTitle = document.getElementById('entryModalTitle');
  const btnCloseModal = document.getElementById('btnCloseEntryModal');
  const btnCancel = document.getElementById('btnCancelEntry');
  const btnSave = document.getElementById('btnSaveEntry');
  const formDate = document.getElementById('formRecordDate');
  const formDay = document.getElementById('formDayOfWeek');
  const formNotes = document.getElementById('formRecordNotes');
  const servicesContainer = document.getElementById('servicesFormContainer');
  const modalTotalVehicles = document.getElementById('modalTotalVehicles');
  const modalTotalIncome = document.getElementById('modalTotalIncome');

  // State
  let currentRecords = [];
  let currentExpensesMap = {};
  let editingDate = null;

  // Initialize Custom Dates
  const todayStr = PCMC_DB.formatDate(new Date());
  if (customStart) customStart.value = todayStr;
  if (customEnd) customEnd.value = todayStr;

  // Date Filter Events
  dateFilterSelect.addEventListener('change', () => {
    if (dateFilterSelect.value === 'custom') {
      customBox.style.display = 'inline-flex';
    } else {
      customBox.style.display = 'none';
      loadEntries(dateFilterSelect.value);
    }
  });

  if (btnApplyCustom) {
    btnApplyCustom.addEventListener('click', () => {
      if (!customStart.value || !customEnd.value) {
        PCMC_UI.toast('Please select both start and end dates', 'warning');
        return;
      }
      loadEntries('custom', customStart.value, customEnd.value);
    });
  }

  // Search filter
  searchInput.addEventListener('input', () => {
    renderTable();
  });

  // --------------------------------------------------------------------------
  // LOAD ENTRIES
  // --------------------------------------------------------------------------
  async function loadEntries(filterType = 'thisMonth', start = null, end = null) {
    tbody.innerHTML = '<tr><td colspan="15" style="padding: 2.5rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader" class="spin"></i> Loading daily records...</td></tr>';
    if (window.lucide) window.lucide.createIcons();

    try {
      const { startDate, endDate } = PCMC_DB.getDateRange(filterType, start, end);
      const [records, expenses] = await Promise.all([
        PCMC_DB.getDailyRecords(startDate, endDate),
        PCMC_DB.getExpenses(startDate, endDate)
      ]);

      // Map expenses by date
      currentExpensesMap = {};
      expenses.forEach(exp => {
        currentExpensesMap[exp.expense_date] = (currentExpensesMap[exp.expense_date] || 0) + (parseFloat(exp.amount) || 0);
      });

      currentRecords = records;
      renderTable();
    } catch (err) {
      console.error('Error loading daily records:', err);
      tbody.innerHTML = `<tr><td colspan="15" style="padding: 2rem; text-align: center; color: var(--accent-red);">Failed to load daily entries: ${err.message}</td></tr>`;
      PCMC_UI.toast('Failed to load records: ' + err.message, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // RENDER TABLE
  // --------------------------------------------------------------------------
  function renderTable() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let filtered = currentRecords;

    if (searchTerm) {
      filtered = filtered.filter(r => 
        (r.record_date && r.record_date.toLowerCase().includes(searchTerm)) ||
        (r.day_of_week && r.day_of_week.toLowerCase().includes(searchTerm)) ||
        (r.notes && r.notes.toLowerCase().includes(searchTerm))
      );
    }

    if (countLabel) countLabel.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="15" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No daily entries found for this selection. Click "+ Add Day Entry" to record today\'s business.</td></tr>';
      resetFooter();
      return;
    }

    // Totals accumulators
    const totals = {
      bike_scooter: 0,
      bike_sports: 0,
      car_water_wash: 0,
      car_only_body: 0,
      car_full_wash: 0,
      car_underbody_full: 0,
      rikshaw_full_wash: 0,
      tractor_tempo: 0,
      miscellaneous: 0,
      day_income: 0,
      expenses: 0,
      profit: 0,
      vehicles: 0
    };

    tbody.innerHTML = filtered.map(rec => {
      // Index entries for this record
      const entryMap = {};
      let dayIncome = 0;
      let dayVehicles = 0;

      if (rec.daily_income_entries) {
        rec.daily_income_entries.forEach(e => {
          const amt = parseFloat(e.amount) || 0;
          const qty = parseInt(e.quantity, 10) || (amt > 0 ? 1 : 0);
          entryMap[e.service_key] = { amount: amt, quantity: qty };
          dayIncome += amt;
          dayVehicles += qty;
          totals[e.service_key] = (totals[e.service_key] || 0) + amt;
        });
      }

      const dayExpenses = currentExpensesMap[rec.record_date] || 0;
      const dayProfit = dayIncome - dayExpenses;

      totals.day_income += dayIncome;
      totals.expenses += dayExpenses;
      totals.profit += dayProfit;
      totals.vehicles += dayVehicles;

      // Helper for cells
      const renderCell = (key) => {
        const item = entryMap[key];
        if (!item || item.amount === 0) return '<span style="color: var(--text-muted);">-</span>';
        return `
          <div>
            ${item.quantity > 0 ? `<span class="qty-badge">${item.quantity}</span>` : ''}
            <span>₹${item.amount.toLocaleString('en-IN')}</span>
          </div>
        `;
      };

      const profitClass = dayProfit >= 0 ? 'positive' : 'negative';

      return `
        <tr>
          <td style="font-weight: 700;">${PCMC_UI.formatDisplayDate(rec.record_date)}</td>
          <td style="color: var(--text-secondary);">${rec.day_of_week || PCMC_DB.getDayOfWeek(rec.record_date)}</td>
          
          <td class="cell-num">${renderCell('bike_scooter')}</td>
          <td class="cell-num">${renderCell('bike_sports')}</td>
          <td class="cell-num">${renderCell('car_water_wash')}</td>
          <td class="cell-num">${renderCell('car_only_body')}</td>
          <td class="cell-num">${renderCell('car_full_wash')}</td>
          <td class="cell-num">${renderCell('car_underbody_full')}</td>
          <td class="cell-num">${renderCell('rikshaw_full_wash')}</td>
          <td class="cell-num">${renderCell('tractor_tempo')}</td>
          <td class="cell-num">${renderCell('miscellaneous')}</td>

          <td class="cell-num highlight-income">₹${dayIncome.toLocaleString('en-IN')}</td>
          <td class="cell-num" style="color: var(--accent-red); font-weight: 600;">₹${dayExpenses.toLocaleString('en-IN')}</td>
          <td class="cell-num highlight-profit ${profitClass}">₹${dayProfit.toLocaleString('en-IN')}</td>

          <td class="text-left" style="font-size: 0.8rem; color: var(--text-secondary); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${rec.notes || ''}">
            ${rec.notes || '<span style="color: var(--text-muted);">-</span>'}
          </td>

          <td>
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              <button class="btn-icon btn-edit-entry" data-date="${rec.record_date}" title="Edit Record">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn-icon btn-delete-entry" data-date="${rec.record_date}" title="Delete Record" style="color: var(--accent-red);">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Update Footer Totals
    updateFooter(totals);

    if (window.lucide) window.lucide.createIcons();

    // Bind Edit and Delete Buttons
    document.querySelectorAll('.btn-edit-entry').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.date));
    });

    document.querySelectorAll('.btn-delete-entry').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteEntry(btn.dataset.date));
    });
  }

  function updateFooter(totals) {
    const fmt = (val) => val > 0 ? '₹' + val.toLocaleString('en-IN') : '-';
    document.getElementById('tot-bike-scooter').textContent = fmt(totals.bike_scooter);
    document.getElementById('tot-bike-sports').textContent = fmt(totals.bike_sports);
    document.getElementById('tot-car-water').textContent = fmt(totals.car_water_wash);
    document.getElementById('tot-car-body').textContent = fmt(totals.car_only_body);
    document.getElementById('tot-car-full').textContent = fmt(totals.car_full_wash);
    document.getElementById('tot-car-underbody').textContent = fmt(totals.car_underbody_full);
    document.getElementById('tot-rikshaw').textContent = fmt(totals.rikshaw_full_wash);
    document.getElementById('tot-tractor').textContent = fmt(totals.tractor_tempo);
    document.getElementById('tot-misc').textContent = fmt(totals.miscellaneous);

    document.getElementById('tot-day-income').textContent = '₹' + totals.day_income.toLocaleString('en-IN');
    document.getElementById('tot-expenses').textContent = '₹' + totals.expenses.toLocaleString('en-IN');
    
    const profitEl = document.getElementById('tot-profit');
    profitEl.textContent = '₹' + totals.profit.toLocaleString('en-IN');
    profitEl.className = 'cell-num highlight-profit ' + (totals.profit >= 0 ? 'positive' : 'negative');

    document.getElementById('tot-vehicle-count').textContent = `${totals.vehicles} vehicles washed`;
  }

  function resetFooter() {
    ['tot-bike-scooter','tot-bike-sports','tot-car-water','tot-car-body','tot-car-full','tot-car-underbody','tot-rikshaw','tot-tractor','tot-misc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '-';
    });
    document.getElementById('tot-day-income').textContent = '₹0';
    document.getElementById('tot-expenses').textContent = '₹0';
    document.getElementById('tot-profit').textContent = '₹0';
    document.getElementById('tot-vehicle-count').textContent = '0 vehicles total';
  }

  // --------------------------------------------------------------------------
  // MODAL: FORM GENERATION & LOGIC
  // --------------------------------------------------------------------------
  function buildServicesForm(existingEntries = []) {
    const existingMap = {};
    if (existingEntries) {
      existingEntries.forEach(e => {
        existingMap[e.service_key] = e;
      });
    }

    servicesContainer.innerHTML = PCMC_DB.SERVICE_KEYS.map(s => {
      const current = existingMap[s.key] || { quantity: '', amount: '' };
      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem 0.85rem;" data-service-key="${s.key}" data-default-rate="${s.defaultRate}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span style="font-weight: 600; font-size: 0.84rem; color: #fff;">${s.label}</span>
            <span style="font-size: 0.72rem; color: var(--accent-cyan); font-weight: 600;">₹${s.defaultRate} / wash</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 0.5rem;">
            <div>
              <label style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Count / Qty</label>
              <input type="number" min="0" class="form-control svc-qty" placeholder="0" value="${current.quantity || ''}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem;">
            </div>
            <div>
              <label style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Amount (₹)</label>
              <input type="number" min="0" step="any" class="form-control svc-amt" placeholder="0" value="${current.amount || ''}" style="padding: 0.35rem 0.5rem; font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan);">
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners for live multiplication & auto sum
    servicesContainer.querySelectorAll('[data-service-key]').forEach(row => {
      const qtyInput = row.querySelector('.svc-qty');
      const amtInput = row.querySelector('.svc-amt');
      const rate = parseFloat(row.dataset.defaultRate) || 0;

      qtyInput.addEventListener('input', () => {
        const qty = parseInt(qtyInput.value, 10);
        if (!isNaN(qty) && qty >= 0 && rate > 0) {
          amtInput.value = qty * rate;
        }
        recalcModalTotals();
      });

      amtInput.addEventListener('input', () => {
        recalcModalTotals();
      });
    });

    recalcModalTotals();
  }

  function recalcModalTotals() {
    let totalVehicles = 0;
    let totalIncome = 0;

    servicesContainer.querySelectorAll('[data-service-key]').forEach(row => {
      const qty = parseInt(row.querySelector('.svc-qty').value, 10) || 0;
      const amt = parseFloat(row.querySelector('.svc-amt').value) || 0;
      totalVehicles += qty;
      totalIncome += amt;
    });

    modalTotalVehicles.textContent = totalVehicles;
    modalTotalIncome.textContent = '₹' + totalIncome.toLocaleString('en-IN');
  }

  // Record Date Change Handler
  formDate.addEventListener('change', () => {
    if (formDate.value) {
      formDay.value = PCMC_DB.getDayOfWeek(formDate.value);
    } else {
      formDay.value = '';
    }
  });

  // Open Add Modal
  btnOpenAdd.addEventListener('click', () => {
    editingDate = null;
    modalTitle.textContent = 'Add Daily Business Entry';
    formDate.value = PCMC_DB.formatDate(new Date());
    formDay.value = PCMC_DB.getDayOfWeek(formDate.value);
    formNotes.value = '';
    formDate.disabled = false;
    buildServicesForm([]);
    entryModal.classList.add('active');
  });

  // Open Edit Modal
  async function openEditModal(dateStr) {
    editingDate = dateStr;
    modalTitle.textContent = `Edit Entry for ${PCMC_UI.formatDisplayDate(dateStr)}`;
    formDate.value = dateStr;
    formDay.value = PCMC_DB.getDayOfWeek(dateStr);
    formDate.disabled = true; // prevent changing primary date key in edit mode

    const record = currentRecords.find(r => r.record_date === dateStr);
    formNotes.value = (record && record.notes) || '';
    buildServicesForm(record ? record.daily_income_entries : []);
    entryModal.classList.add('active');
  }

  // Close Modal
  const closeModal = () => {
    entryModal.classList.remove('active');
  };
  btnCloseModal.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  entryModal.addEventListener('click', (e) => {
    if (e.target === entryModal) closeModal();
  });

  // Save Daily Record
  btnSave.addEventListener('click', async () => {
    const recordDate = formDate.value;
    if (!recordDate) {
      PCMC_UI.toast('Please select a valid record date', 'warning');
      return;
    }

    const notes = formNotes.value.trim();
    const serviceEntries = [];

    servicesContainer.querySelectorAll('[data-service-key]').forEach(row => {
      const key = row.dataset.serviceKey;
      const rate = parseFloat(row.dataset.defaultRate) || 0;
      const qty = parseInt(row.querySelector('.svc-qty').value, 10) || 0;
      const amt = parseFloat(row.querySelector('.svc-amt').value) || 0;

      if (amt > 0 || qty > 0) {
        serviceEntries.push({
          service_key: key,
          quantity: qty,
          unit_price: rate,
          amount: amt,
          payment_method: 'Cash',
          notes: ''
        });
      }
    });

    btnSave.disabled = true;
    btnSave.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
    if (window.lucide) window.lucide.createIcons();

    try {
      await PCMC_DB.saveDailyRecordWithEntries(recordDate, notes, serviceEntries);
      PCMC_UI.toast(`Record for ${PCMC_UI.formatDisplayDate(recordDate)} saved successfully!`, 'success');
      closeModal();
      await loadEntries(dateFilterSelect.value);
    } catch (err) {
      console.error('Error saving daily record:', err);
      PCMC_UI.toast('Failed to save record: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i data-lucide="check"></i> Save Daily Record';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Delete Record Confirmation
  function confirmDeleteEntry(dateStr) {
    PCMC_UI.confirm({
      title: 'Delete Daily Entry',
      message: `Are you sure you want to delete the business entry for ${PCMC_UI.formatDisplayDate(dateStr)}? This will remove all service breakdown entries for that day.`,
      confirmText: 'Delete Record',
      confirmBtnClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await PCMC_DB.deleteDailyRecord(dateStr);
          PCMC_UI.toast(`Daily record for ${PCMC_UI.formatDisplayDate(dateStr)} deleted.`, 'success');
          await loadEntries(dateFilterSelect.value);
        } catch (err) {
          console.error('Error deleting record:', err);
          PCMC_UI.toast('Failed to delete record: ' + err.message, 'error');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // EXPORT TO EXCEL (.xlsx)
  // --------------------------------------------------------------------------
  btnExport.addEventListener('click', () => {
    if (!currentRecords.length) {
      PCMC_UI.toast('No records to export in the current selection.', 'warning');
      return;
    }

    try {
      const exportData = currentRecords.map(rec => {
        const entryMap = {};
        let dayIncome = 0;
        if (rec.daily_income_entries) {
          rec.daily_income_entries.forEach(e => {
            entryMap[e.service_key] = parseFloat(e.amount) || 0;
            dayIncome += parseFloat(e.amount) || 0;
          });
        }
        const exp = currentExpensesMap[rec.record_date] || 0;
        const profit = dayIncome - exp;

        return {
          'Date': rec.record_date,
          'Day': rec.day_of_week || PCMC_DB.getDayOfWeek(rec.record_date),
          'Bikes - Commuter / Scooter': entryMap['bike_scooter'] || 0,
          'Bikes - Sports / Bullet': entryMap['bike_sports'] || 0,
          'Car - Water Wash': entryMap['car_water_wash'] || 0,
          'Car - Only Body': entryMap['car_only_body'] || 0,
          'Car - Full Wash': entryMap['car_full_wash'] || 0,
          'Car - Underbody + Full Body': entryMap['car_underbody_full'] || 0,
          'Rikshaw - Full Wash': entryMap['rikshaw_full_wash'] || 0,
          'Tractor / Tempo': entryMap['tractor_tempo'] || 0,
          'Miscellaneous': entryMap['miscellaneous'] || 0,
          'Day Income (INR)': dayIncome,
          'Operating Expense (INR)': exp,
          'Operating Profit (INR)': profit,
          'Daily Note': rec.notes || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Entries');

      const fileName = `PCMC_Daily_Entries_${PCMC_DB.formatDate(new Date())}.xlsx`;
      XLSX.writeFile(wb, fileName);
      PCMC_UI.toast('Exported daily records to ' + fileName, 'success');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  // Initial load
  loadEntries('thisMonth');
});

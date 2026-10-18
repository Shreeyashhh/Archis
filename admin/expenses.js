/* ============================================================================
   PCMC Washing Centre - Expenses & Capital Controller
   Dual-tab management, strict accounting separation, SheetJS export, modal CRUD
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  await PCMC_AUTH.requireAuth();

  // 2. Tab Navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  let activeTab = 'tab-expenses';

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      document.getElementById(targetId).classList.add('active');
      activeTab = targetId;

      if (activeTab === 'tab-expenses') {
        loadExpenses();
      } else {
        loadCapital();
      }
    });
  });

  // --------------------------------------------------------------------------
  // OPERATING EXPENSES SETUP
  // --------------------------------------------------------------------------
  const expDateFilter = document.getElementById('expenseDateFilter');
  const expCatFilter = document.getElementById('expenseCategoryFilter');
  const expCustomBox = document.getElementById('expenseCustomBox');
  const expCustomStart = document.getElementById('expenseCustomStart');
  const expCustomEnd = document.getElementById('expenseCustomEnd');
  const btnApplyExpCustom = document.getElementById('btnApplyExpenseCustom');
  const expSearchInput = document.getElementById('expenseSearchInput');
  const expTbody = document.getElementById('expensesTbody');

  const btnOpenExpModal = document.getElementById('btnOpenExpenseModal');
  const expModal = document.getElementById('expenseModal');
  const expModalTitle = document.getElementById('expenseModalTitle');
  const btnCloseExpModal = document.getElementById('btnCloseExpenseModal');
  const btnCancelExp = document.getElementById('btnCancelExpense');
  const btnSaveExp = document.getElementById('btnSaveExpense');

  const formExpId = document.getElementById('formExpenseId');
  const formExpDate = document.getElementById('formExpenseDate');
  const formExpCat = document.getElementById('formExpenseCategory');
  const formExpDesc = document.getElementById('formExpenseDesc');
  const formExpAmt = document.getElementById('formExpenseAmount');
  const formExpPay = document.getElementById('formExpensePayMethod');
  const formExpReceipt = document.getElementById('formExpenseReceipt');
  const formExpNotes = document.getElementById('formExpenseNotes');

  // Populate categories in filter and modal
  PCMC_DB.EXPENSE_CATEGORIES.forEach(cat => {
    const optFilter = document.createElement('option');
    optFilter.value = cat;
    optFilter.textContent = cat;
    expCatFilter.appendChild(optFilter);

    const optForm = document.createElement('option');
    optForm.value = cat;
    optForm.textContent = cat;
    formExpCat.appendChild(optForm);
  });

  // Add custom option to category dropdown
  const optCustom = document.createElement('option');
  optCustom.value = 'Custom Category';
  optCustom.textContent = '+ Custom / Other Category';
  formExpCat.appendChild(optCustom);

  let currentExpenses = [];

  // Filter events
  expDateFilter.addEventListener('change', () => {
    if (expDateFilter.value === 'custom') {
      expCustomBox.style.display = 'inline-flex';
    } else {
      expCustomBox.style.display = 'none';
      loadExpenses();
    }
  });

  expCatFilter.addEventListener('change', loadExpenses);
  if (btnApplyExpCustom) {
    btnApplyExpCustom.addEventListener('click', loadExpenses);
  }
  expSearchInput.addEventListener('input', renderExpensesTable);

  async function loadExpenses() {
    expTbody.innerHTML = '<tr><td colspan="8" style="padding: 2rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader" class="spin"></i> Loading expenses...</td></tr>';
    if (window.lucide) window.lucide.createIcons();

    try {
      const filterType = expDateFilter.value;
      const { startDate, endDate } = PCMC_DB.getDateRange(filterType, expCustomStart.value, expCustomEnd.value);
      const cat = expCatFilter.value;

      currentExpenses = await PCMC_DB.getExpenses(startDate, endDate, cat);
      renderExpensesTable();
    } catch (err) {
      console.error('Error loading expenses:', err);
      expTbody.innerHTML = `<tr><td colspan="8" style="padding: 2rem; text-align: center; color: var(--accent-red);">Failed to load expenses: ${err.message}</td></tr>`;
      PCMC_UI.toast('Failed to load expenses: ' + err.message, 'error');
    }
  }

  function renderExpensesTable() {
    const search = expSearchInput.value.trim().toLowerCase();
    let filtered = currentExpenses;

    if (search) {
      filtered = filtered.filter(e => 
        (e.description && e.description.toLowerCase().includes(search)) ||
        (e.category && e.category.toLowerCase().includes(search)) ||
        (e.receipt_no && e.receipt_no.toLowerCase().includes(search)) ||
        (e.notes && e.notes.toLowerCase().includes(search))
      );
    }

    if (filtered.length === 0) {
      expTbody.innerHTML = '<tr><td colspan="8" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No operating expenses found. Click "+ Add Expense" to record an outflow.</td></tr>';
      document.getElementById('kpi-expense-total').textContent = '₹0';
      document.getElementById('foot-expense-total').textContent = '₹0';
      return;
    }

    let totalAmt = 0;
    const catMap = {};
    const payMap = {};

    filtered.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      totalAmt += amt;
      catMap[e.category] = (catMap[e.category] || 0) + amt;
      payMap[e.payment_method] = (payMap[e.payment_method] || 0) + amt;
    });

    // Update KPIs
    document.getElementById('kpi-expense-total').textContent = PCMC_UI.formatINR(totalAmt);
    document.getElementById('foot-expense-total').textContent = PCMC_UI.formatINR(totalAmt);
    document.getElementById('kpi-expense-count-sub').textContent = `${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`;

    // Top Category
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      document.getElementById('kpi-expense-top-cat').textContent = topCat[0];
      document.getElementById('kpi-expense-top-cat-sub').textContent = PCMC_UI.formatINR(topCat[1]) + ' spent';
    }

    // Top Payment mode
    const topPay = Object.entries(payMap).sort((a, b) => b[1] - a[1])[0];
    if (topPay) {
      document.getElementById('kpi-expense-pay-mode').textContent = `${topPay[0]} (${Math.round((topPay[1]/totalAmt)*100)}%)`;
    }

    expTbody.innerHTML = filtered.map(e => `
      <tr>
        <td style="font-weight: 600;">${PCMC_UI.formatDisplayDate(e.expense_date)}</td>
        <td><span class="badge" style="background: rgba(255,42,95,0.12); color: #ff527b; border: 1px solid rgba(255,42,95,0.2);">${e.category}</span></td>
        <td>${e.description}</td>
        <td style="text-align: right; font-weight: 700; color: var(--accent-red);">${PCMC_UI.formatINR(e.amount)}</td>
        <td>${e.payment_method || 'Cash'}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${e.receipt_no || '-'}</td>
        <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.notes || '-'}</td>
        <td style="text-align: center;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button class="btn-icon btn-edit-exp" data-id="${e.id}" title="Edit Expense">
              <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="btn-icon btn-delete-exp" data-id="${e.id}" title="Delete Expense" style="color: var(--accent-red);">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind Edit and Delete
    document.querySelectorAll('.btn-edit-exp').forEach(btn => {
      btn.addEventListener('click', () => openEditExpense(btn.dataset.id));
    });
    document.querySelectorAll('.btn-delete-exp').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteExpense(btn.dataset.id));
    });
  }

  // Open Expense Modal
  btnOpenExpModal.addEventListener('click', () => {
    formExpId.value = '';
    expModalTitle.textContent = 'Add Operating Expense';
    formExpDate.value = PCMC_DB.formatDate(new Date());
    formExpCat.selectedIndex = 0;
    formExpDesc.value = '';
    formExpAmt.value = '';
    formExpPay.value = 'Cash';
    formExpReceipt.value = '';
    formExpNotes.value = '';
    expModal.classList.add('active');
  });

  function openEditExpense(id) {
    const exp = currentExpenses.find(e => e.id === id);
    if (!exp) return;

    formExpId.value = exp.id;
    expModalTitle.textContent = 'Edit Operating Expense';
    formExpDate.value = exp.expense_date;
    formExpCat.value = exp.category;
    formExpDesc.value = exp.description;
    formExpAmt.value = exp.amount;
    formExpPay.value = exp.payment_method || 'Cash';
    formExpReceipt.value = exp.receipt_no || '';
    formExpNotes.value = exp.notes || '';
    expModal.classList.add('active');
  }

  const closeExpModal = () => expModal.classList.remove('active');
  btnCloseExpModal.addEventListener('click', closeExpModal);
  btnCancelExp.addEventListener('click', closeExpModal);
  expModal.addEventListener('click', (e) => {
    if (e.target === expModal) closeExpModal();
  });

  // Save Expense
  btnSaveExp.addEventListener('click', async () => {
    const date = formExpDate.value;
    const cat = formExpCat.value;
    const desc = formExpDesc.value.trim();
    const amt = parseFloat(formExpAmt.value);
    const pay = formExpPay.value;
    const receipt = formExpReceipt.value.trim();
    const notes = formExpNotes.value.trim();

    if (!date || !cat || !desc || isNaN(amt) || amt <= 0) {
      PCMC_UI.toast('Please provide valid date, category, description, and amount greater than 0.', 'warning');
      return;
    }

    btnSaveExp.disabled = true;
    btnSaveExp.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
    if (window.lucide) window.lucide.createIcons();

    try {
      const payload = {
        expense_date: date,
        category: cat,
        description: desc,
        amount: amt,
        payment_method: pay,
        receipt_no: receipt || null,
        notes: notes || null
      };

      if (formExpId.value) {
        payload.id = formExpId.value;
      }

      await PCMC_DB.saveExpense(payload);
      PCMC_UI.toast('Expense saved successfully!', 'success');
      closeExpModal();
      await loadExpenses();
    } catch (err) {
      console.error('Error saving expense:', err);
      PCMC_UI.toast('Failed to save expense: ' + err.message, 'error');
    } finally {
      btnSaveExp.disabled = false;
      btnSaveExp.innerHTML = '<i data-lucide="check"></i> Save Expense';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Delete Expense
  function confirmDeleteExpense(id) {
    PCMC_UI.confirm({
      title: 'Delete Operating Expense',
      message: 'Are you sure you want to permanently delete this expense record? This will adjust your operating profit calculations.',
      confirmText: 'Delete Expense',
      confirmBtnClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await PCMC_DB.deleteExpense(id);
          PCMC_UI.toast('Expense deleted.', 'success');
          await loadExpenses();
        } catch (err) {
          console.error('Error deleting expense:', err);
          PCMC_UI.toast('Failed to delete expense: ' + err.message, 'error');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // CAPITAL & INVESTMENTS SETUP
  // --------------------------------------------------------------------------
  const capTbody = document.getElementById('capitalTbody');
  const btnOpenCapModal = document.getElementById('btnOpenCapitalModal');
  const capModal = document.getElementById('capitalModal');
  const capModalTitle = document.getElementById('capitalModalTitle');
  const btnCloseCapModal = document.getElementById('btnCloseCapitalModal');
  const btnCancelCap = document.getElementById('btnCancelCapital');
  const btnSaveCap = document.getElementById('btnSaveCapital');

  const formCapId = document.getElementById('formCapitalId');
  const formCapDate = document.getElementById('formCapitalDate');
  const formCapType = document.getElementById('formCapitalType');
  const formCapPurpose = document.getElementById('formCapitalPurpose');
  const formCapAmt = document.getElementById('formCapitalAmount');
  const formCapPay = document.getElementById('formCapitalPayMethod');
  const formCapNotes = document.getElementById('formCapitalNotes');

  // Populate capital types dropdown
  PCMC_DB.CAPITAL_TYPES.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    formCapType.appendChild(opt);
  });

  let currentCapital = [];

  async function loadCapital() {
    capTbody.innerHTML = '<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader" class="spin"></i> Loading capital transactions...</td></tr>';
    if (window.lucide) window.lucide.createIcons();

    try {
      currentCapital = await PCMC_DB.getCapitalTransactions(null, null);
      renderCapitalTable();
    } catch (err) {
      console.error('Error loading capital:', err);
      capTbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--accent-red);">Failed to load capital records: ${err.message}</td></tr>`;
      PCMC_UI.toast('Failed to load capital records: ' + err.message, 'error');
    }
  }

  function renderCapitalTable() {
    if (currentCapital.length === 0) {
      capTbody.innerHTML = '<tr><td colspan="7" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No capital transactions recorded yet. Click "+ Add Capital" to record an equipment purchase or owner equity injection.</td></tr>';
      document.getElementById('kpi-capital-total').textContent = '₹0';
      document.getElementById('foot-capital-total').textContent = '₹0';
      return;
    }

    let totalCap = 0;
    let machineryCap = 0;
    let ownerCap = 0;

    currentCapital.forEach(c => {
      const amt = parseFloat(c.amount) || 0;
      totalCap += amt;
      if (c.investment_type === 'Equipment / Machinery') machineryCap += amt;
      if (c.investment_type === 'Owner Capital') ownerCap += amt;
    });

    // Update KPIs
    document.getElementById('kpi-capital-total').textContent = PCMC_UI.formatINR(totalCap);
    document.getElementById('foot-capital-total').textContent = PCMC_UI.formatINR(totalCap);
    document.getElementById('kpi-capital-machinery').textContent = PCMC_UI.formatINR(machineryCap);
    document.getElementById('kpi-capital-owner').textContent = PCMC_UI.formatINR(ownerCap);

    capTbody.innerHTML = currentCapital.map(c => `
      <tr>
        <td style="font-weight: 600;">${PCMC_UI.formatDisplayDate(c.transaction_date)}</td>
        <td><span class="badge" style="background: rgba(139,92,246,0.15); color: var(--accent-purple); border: 1px solid rgba(139,92,246,0.3);">${c.investment_type}</span></td>
        <td style="font-weight: 600;">${c.purpose}</td>
        <td style="text-align: right; font-weight: 800; color: var(--accent-purple);">${PCMC_UI.formatINR(c.amount)}</td>
        <td>${c.payment_method}</td>
        <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.notes || '-'}</td>
        <td style="text-align: center;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button class="btn-icon btn-edit-cap" data-id="${c.id}" title="Edit Capital Entry">
              <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="btn-icon btn-delete-cap" data-id="${c.id}" title="Delete Capital Entry" style="color: var(--accent-red);">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind Edit and Delete
    document.querySelectorAll('.btn-edit-cap').forEach(btn => {
      btn.addEventListener('click', () => openEditCapital(btn.dataset.id));
    });
    document.querySelectorAll('.btn-delete-cap').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteCapital(btn.dataset.id));
    });
  }

  // Open Capital Modal
  btnOpenCapModal.addEventListener('click', () => {
    formCapId.value = '';
    capModalTitle.textContent = 'Add Capital / Asset Investment';
    formCapDate.value = PCMC_DB.formatDate(new Date());
    formCapType.selectedIndex = 0;
    formCapPurpose.value = '';
    formCapAmt.value = '';
    formCapPay.value = 'Bank Transfer';
    formCapNotes.value = '';
    capModal.classList.add('active');
  });

  function openEditCapital(id) {
    const cap = currentCapital.find(c => c.id === id);
    if (!cap) return;

    formCapId.value = cap.id;
    capModalTitle.textContent = 'Edit Capital / Asset Investment';
    formCapDate.value = cap.transaction_date;
    formCapType.value = cap.investment_type;
    formCapPurpose.value = cap.purpose;
    formCapAmt.value = cap.amount;
    formCapPay.value = cap.payment_method;
    formCapNotes.value = cap.notes || '';
    capModal.classList.add('active');
  }

  const closeCapModal = () => capModal.classList.remove('active');
  btnCloseCapModal.addEventListener('click', closeCapModal);
  btnCancelCap.addEventListener('click', closeCapModal);
  capModal.addEventListener('click', (e) => {
    if (e.target === capModal) closeCapModal();
  });

  // Save Capital
  btnSaveCap.addEventListener('click', async () => {
    const date = formCapDate.value;
    const type = formCapType.value;
    const purpose = formCapPurpose.value.trim();
    const amt = parseFloat(formCapAmt.value);
    const pay = formCapPay.value;
    const notes = formCapNotes.value.trim();

    if (!date || !type || !purpose || isNaN(amt) || amt <= 0) {
      PCMC_UI.toast('Please provide valid date, investment type, purpose, and amount.', 'warning');
      return;
    }

    btnSaveCap.disabled = true;
    btnSaveCap.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
    if (window.lucide) window.lucide.createIcons();

    try {
      const payload = {
        transaction_date: date,
        investment_type: type,
        purpose: purpose,
        amount: amt,
        payment_method: pay,
        notes: notes || null
      };

      if (formCapId.value) {
        payload.id = formCapId.value;
      }

      await PCMC_DB.saveCapitalTransaction(payload);
      PCMC_UI.toast('Capital investment saved successfully!', 'success');
      closeCapModal();
      await loadCapital();
    } catch (err) {
      console.error('Error saving capital:', err);
      PCMC_UI.toast('Failed to save capital: ' + err.message, 'error');
    } finally {
      btnSaveCap.disabled = false;
      btnSaveCap.innerHTML = '<i data-lucide="check"></i> Save Investment';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Delete Capital
  function confirmDeleteCapital(id) {
    PCMC_UI.confirm({
      title: 'Delete Capital Entry',
      message: 'Are you sure you want to delete this capital investment record?',
      confirmText: 'Delete Record',
      confirmBtnClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await PCMC_DB.deleteCapitalTransaction(id);
          PCMC_UI.toast('Capital record deleted.', 'success');
          await loadCapital();
        } catch (err) {
          console.error('Error deleting capital:', err);
          PCMC_UI.toast('Failed to delete capital: ' + err.message, 'error');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // EXPORT TO EXCEL
  // --------------------------------------------------------------------------
  document.getElementById('btnExportExpenses').addEventListener('click', () => {
    try {
      if (activeTab === 'tab-expenses') {
        if (!currentExpenses.length) {
          PCMC_UI.toast('No expenses to export.', 'warning');
          return;
        }
        const data = currentExpenses.map(e => ({
          'Date': e.expense_date,
          'Category': e.category,
          'Description': e.description,
          'Amount (INR)': e.amount,
          'Payment Method': e.payment_method,
          'Receipt No': e.receipt_no || '',
          'Notes': e.notes || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        XLSX.writeFile(wb, `PCMC_Expenses_${PCMC_DB.formatDate(new Date())}.xlsx`);
        PCMC_UI.toast('Exported expenses to Excel.', 'success');
      } else {
        if (!currentCapital.length) {
          PCMC_UI.toast('No capital records to export.', 'warning');
          return;
        }
        const data = currentCapital.map(c => ({
          'Date': c.transaction_date,
          'Investment Type': c.investment_type,
          'Purpose / Asset': c.purpose,
          'Amount (INR)': c.amount,
          'Payment Mode': c.payment_method,
          'Notes': c.notes || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Capital Investments');
        XLSX.writeFile(wb, `PCMC_Capital_${PCMC_DB.formatDate(new Date())}.xlsx`);
        PCMC_UI.toast('Exported capital records to Excel.', 'success');
      }
    } catch (err) {
      console.error('Export error:', err);
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  // Initial load
  loadExpenses();
});

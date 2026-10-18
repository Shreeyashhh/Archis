/* ============================================================================
   PCMC Washing Centre - Excel Import & Export Controller
   Fuzzy column matching, date/currency normalization, reconciliation, and SheetJS
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  await PCMC_AUTH.requireAuth();

  // 2. DOM Elements
  const dropzone = document.getElementById('fileDropzone');
  const fileInput = document.getElementById('excelFileInput');
  const fileNameDisplay = document.getElementById('selectedFileName');
  const targetTypeSelect = document.getElementById('importTargetType');
  const conflictSelect = document.getElementById('importConflictStrategy');

  const mappingSection = document.getElementById('mappingSection');
  const mappingContainer = document.getElementById('mappingFieldsContainer');
  const btnAutoMap = document.getElementById('btnAutoMap');

  const previewSection = document.getElementById('previewSection');
  const previewHead = document.getElementById('previewTableHead');
  const previewBody = document.getElementById('previewTableBody');
  const previewStats = document.getElementById('previewStatsLabel');
  const previewWarningBox = document.getElementById('previewWarningBox');

  const btnCancel = document.getElementById('btnCancelImport');
  const btnCommit = document.getElementById('btnCommitImport');
  const historyTbody = document.getElementById('importHistoryTbody');

  // State
  let rawWorkbook = null;
  let parsedRawRows = [];
  let detectedHeaders = [];
  let currentFile = null;
  let validatedRecords = [];

  // Dropzone drag-and-drop
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  targetTypeSelect.addEventListener('change', () => {
    if (rawWorkbook) {
      buildMappingUI();
    }
  });

  // --------------------------------------------------------------------------
  // HANDLE UPLOADED FILE
  // --------------------------------------------------------------------------
  function handleFileSelected(file) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      PCMC_UI.toast('Please select an Excel (.xlsx/.xls) or CSV file.', 'warning');
      return;
    }

    currentFile = file;
    fileNameDisplay.textContent = `Selected File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    fileNameDisplay.style.display = 'block';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        rawWorkbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Pick first sheet
        const firstSheetName = rawWorkbook.SheetNames[0];
        const sheet = rawWorkbook.Sheets[firstSheetName];
        
        // Parse rows as array of objects
        parsedRawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        
        if (!parsedRawRows.length) {
          PCMC_UI.toast('The uploaded worksheet appears to be empty.', 'warning');
          return;
        }

        // Detect all header columns
        detectedHeaders = Object.keys(parsedRawRows[0]);
        buildMappingUI();
        PCMC_UI.toast(`Loaded ${parsedRawRows.length} rows from sheet "${firstSheetName}". Verify column mappings below.`, 'success');
      } catch (err) {
        console.error('Error reading spreadsheet:', err);
        PCMC_UI.toast('Failed to read file: ' + err.message, 'error');
      }
    };

    reader.readAsBinaryString(file);
  }

  // --------------------------------------------------------------------------
  // FUZZY COLUMN MAPPING
  // --------------------------------------------------------------------------
  const TARGET_SCHEMAS = {
    daily_records: [
      { key: 'date', label: 'Record Date (Required)', patterns: ['date', 'dt', 'record date', 'day date'] },
      { key: 'bike_scooter', label: 'Bikes: Commuter / Scooter', patterns: ['commuter', 'scooter', 'scooty', 'commuter / scooter'] },
      { key: 'bike_sports', label: 'Bikes: Sports / Bullet', patterns: ['sports', 'bullet', 'sports / bullet'] },
      { key: 'car_water_wash', label: 'Car: Water Wash (Only Body)', patterns: ['car water wash', 'water wash', 'only body wash'] },
      { key: 'car_only_body', label: 'Car: Body Wash (Foam Wash)', patterns: ['only body', 'body wash', 'foam wash'] },
      { key: 'car_full_wash', label: 'Car: Full Wash', patterns: ['car full wash', 'full wash'] },
      { key: 'car_underbody_full', label: 'Car: Underbody + Full Body', patterns: ['underbody', 'underbody + full', 'underbody wash'] },
      { key: 'rikshaw_full_wash', label: 'Rikshaw: Full Wash', patterns: ['rikshaw', 'rickshaw', 'auto', 'rikshaw - full wash'] },
      { key: 'tractor_tempo', label: 'Tractor / Tempo Wash', patterns: ['tractor', 'tempo', 'tractor / tempo'] },
      { key: 'miscellaneous', label: 'Miscellaneous Wash', patterns: ['misc', 'miscellaneous', 'other'] },
      { key: 'day_income', label: 'Day Income (Direct Total)', patterns: ['day income', 'income', 'total income'] },
      { key: 'notes', label: 'Daily Notes / Remarks', patterns: ['note', 'notes', 'remarks', 'comment'] }
    ],
    expenses: [
      { key: 'expense_date', label: 'Expense Date (Required)', patterns: ['date', 'expense date', 'dt'] },
      { key: 'category', label: 'Expense Category (Required)', patterns: ['category', 'expense category', 'type'] },
      { key: 'description', label: 'Description / Purpose (Required)', patterns: ['description', 'purpose', 'item', 'details'] },
      { key: 'amount', label: 'Amount (Required)', patterns: ['amount', 'expense', 'expense (inr)', 'cost', 'total'] },
      { key: 'payment_method', label: 'Payment Mode', patterns: ['payment', 'mode', 'method', 'payment method'] },
      { key: 'notes', label: 'Notes / Remarks', patterns: ['notes', 'note', 'remarks'] }
    ],
    capital: [
      { key: 'transaction_date', label: 'Investment Date (Required)', patterns: ['date', 'transaction date', 'dt'] },
      { key: 'investment_type', label: 'Investment Type', patterns: ['type', 'investment type', 'category'] },
      { key: 'purpose', label: 'Purpose / Asset Purchased', patterns: ['purpose', 'asset', 'investment', 'purpose / investment', 'description'] },
      { key: 'amount', label: 'Amount (Required)', patterns: ['amount', 'capital', 'capital / investment', 'value'] },
      { key: 'payment_method', label: 'Payment Method', patterns: ['payment', 'mode', 'method'] },
      { key: 'notes', label: 'Notes', patterns: ['notes', 'note', 'remarks'] }
    ]
  };

  function findFuzzyMatch(fieldPatterns, headers) {
    for (const pattern of fieldPatterns) {
      const match = headers.find(h => {
        const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanP = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanH === cleanP || cleanH.includes(cleanP) || cleanP.includes(cleanH);
      });
      if (match) return match;
    }
    return '';
  }

  function buildMappingUI() {
    const target = targetTypeSelect.value;
    const schema = TARGET_SCHEMAS[target] || TARGET_SCHEMAS.daily_records;

    mappingContainer.innerHTML = schema.map(f => {
      const autoMatched = findFuzzyMatch(f.patterns, detectedHeaders);
      return `
        <div class="mapping-item">
          <label class="form-label" style="font-size: 0.8rem; font-weight: 700; color: #fff;">${f.label}</label>
          <select class="form-select field-mapper" data-field-key="${f.key}" style="width: 100%; font-size: 0.82rem;">
            <option value="">-- Do Not Import / Skip --</option>
            ${detectedHeaders.map(h => `<option value="${h}" ${h === autoMatched ? 'selected' : ''}>Excel: ${h}</option>`).join('')}
          </select>
        </div>
      `;
    }).join('');

    mappingSection.style.display = 'block';

    // When mappings change, re-generate preview
    mappingContainer.querySelectorAll('.field-mapper').forEach(sel => {
      sel.addEventListener('change', generatePreview);
    });

    generatePreview();
  }

  btnAutoMap.addEventListener('click', buildMappingUI);

  // --------------------------------------------------------------------------
  // GENERATE PREVIEW & VALIDATION
  // --------------------------------------------------------------------------
  function parseDateSafe(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) {
      return PCMC_DB.formatDate(val);
    }
    const str = String(val).trim();
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
    // Try standard JS Date
    const d = new Date(str);
    if (!isNaN(d)) return PCMC_DB.formatDate(d);
    return null;
  }

  function parseAmountSafe(val) {
    if (val === undefined || val === null || val === '') return 0;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.max(0, num);
  }

  function generatePreview() {
    const target = targetTypeSelect.value;
    const mappers = mappingContainer.querySelectorAll('.field-mapper');
    const mapping = {};

    mappers.forEach(m => {
      if (m.value) {
        mapping[m.dataset.fieldKey] = m.value;
      }
    });

    const rowsToPreview = parsedRawRows.slice(0, 50);
    validatedRecords = [];
    let validCount = 0;
    let errorCount = 0;

    const previewData = rowsToPreview.map((row, idx) => {
      const issues = [];
      const record = {};

      if (target === 'daily_records') {
        const rawDate = row[mapping.date];
        const parsedDate = parseDateSafe(rawDate);
        if (!parsedDate) {
          issues.push('Invalid Date');
        } else {
          record.record_date = parsedDate;
          record.day_of_week = PCMC_DB.getDayOfWeek(parsedDate);
        }

        record.notes = row[mapping.notes] || '';
        record.entries = [];

        // Map service entries
        const svcKeys = [
          'bike_scooter', 'bike_sports', 'car_water_wash', 'car_only_body',
          'car_full_wash', 'car_underbody_full', 'rikshaw_full_wash', 'tractor_tempo', 'miscellaneous'
        ];

        let computedDayIncome = 0;
        svcKeys.forEach(k => {
          const colHeader = mapping[k];
          if (colHeader && row[colHeader] !== undefined) {
            const val = parseAmountSafe(row[colHeader]);
            if (val > 0) {
              const def = PCMC_DB.SERVICE_KEYS.find(s => s.key === k);
              const rate = def ? def.defaultRate : 0;
              const qty = rate > 0 ? Math.round(val / rate) : 1;

              record.entries.push({
                service_key: k,
                quantity: qty,
                unit_price: rate,
                amount: val,
                payment_method: 'Cash',
                notes: ''
              });
              computedDayIncome += val;
            }
          }
        });

        // If direct day income column exists and entries were empty
        if (mapping.day_income && row[mapping.day_income] !== undefined) {
          const directDayInc = parseAmountSafe(row[mapping.day_income]);
          if (directDayInc > 0 && record.entries.length === 0) {
            record.entries.push({
              service_key: 'miscellaneous',
              quantity: 1,
              unit_price: directDayInc,
              amount: directDayInc,
              payment_method: 'Cash',
              notes: 'Imported from Day Income'
            });
            computedDayIncome = directDayInc;
          }
        }

        record.computedDayIncome = computedDayIncome;
      }

      if (issues.length === 0) {
        validCount++;
        validatedRecords.push(record);
      } else {
        errorCount++;
      }

      return {
        rowIdx: idx + 1,
        record,
        issues
      };
    });

    // Render Preview Table
    previewHead.innerHTML = `
      <tr>
        <th style="width: 50px;">Row</th>
        <th>Status</th>
        <th>Parsed Date</th>
        <th>Day</th>
        <th>Vehicle Services Count</th>
        <th>Calculated Day Income</th>
        <th>Notes / Remarks</th>
      </tr>
    `;

    previewBody.innerHTML = previewData.map(p => `
      <tr>
        <td style="color: var(--text-muted);">${p.rowIdx}</td>
        <td>
          ${p.issues.length === 0 
            ? '<span class="badge badge-paid"><i data-lucide="check" style="width:11px;height:11px;"></i> Valid</span>' 
            : `<span class="badge badge-unpaid">${p.issues.join(', ')}</span>`}
        </td>
        <td style="font-weight: 700;">${p.record.record_date || '<span style="color:var(--accent-red);">Missing</span>'}</td>
        <td style="color: var(--text-secondary);">${p.record.day_of_week || '-'}</td>
        <td>${p.record.entries ? `${p.record.entries.length} services` : '-'}</td>
        <td style="font-weight: 700; color: var(--accent-cyan);">${PCMC_UI.formatINR(p.record.computedDayIncome || 0)}</td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${p.record.notes || '-'}</td>
      </tr>
    `).join('');

    previewStats.textContent = `${validCount} valid / ${parsedRawRows.length} total rows`;
    if (errorCount > 0) {
      previewWarningBox.innerHTML = `<span style="color: var(--accent-red); font-weight: 700;"><i data-lucide="alert-triangle" style="width:14px;height:14px;vertical-align:middle;"></i> ${errorCount} rows have validation issues and will be skipped.</span>`;
    } else {
      previewWarningBox.innerHTML = `<span style="color: var(--accent-green); font-weight: 700;"><i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:middle;"></i> All ${validCount} rows passed validation.</span>`;
    }

    previewSection.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();
  }

  // --------------------------------------------------------------------------
  // COMMIT IMPORT
  // --------------------------------------------------------------------------
  btnCommit.addEventListener('click', async () => {
    if (!validatedRecords.length) {
      PCMC_UI.toast('No valid records to import.', 'warning');
      return;
    }

    const strategy = conflictSelect.value;
    btnCommit.disabled = true;
    btnCommit.innerHTML = '<i data-lucide="loader" class="spin"></i> Importing records...';
    if (window.lucide) window.lucide.createIcons();

    try {
      let importedCount = 0;
      let skippedCount = 0;

      for (const rec of validatedRecords) {
        if (strategy === 'skip') {
          const existing = await PCMC_DB.getDailyRecordByDate(rec.record_date);
          if (existing) {
            skippedCount++;
            continue;
          }
        }
        await PCMC_DB.saveDailyRecordWithEntries(rec.record_date, rec.notes, rec.entries);
        importedCount++;
      }

      // Log import history
      logImportHistory(currentFile ? currentFile.name : 'workbook.xlsx', importedCount, skippedCount);

      PCMC_UI.toast(`Successfully imported ${importedCount} records into database (${skippedCount} skipped).`, 'success');
      resetImportWorkflow();
      loadImportHistory();
    } catch (err) {
      console.error('Import commit error:', err);
      PCMC_UI.toast('Import failed: ' + err.message, 'error');
    } finally {
      btnCommit.disabled = false;
      btnCommit.innerHTML = '<i data-lucide="check-circle-2"></i> Commit Import to Database';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  btnCancel.addEventListener('click', resetImportWorkflow);

  function resetImportWorkflow() {
    rawWorkbook = null;
    parsedRawRows = [];
    detectedHeaders = [];
    currentFile = null;
    validatedRecords = [];
    fileInput.value = '';
    fileNameDisplay.style.display = 'none';
    mappingSection.style.display = 'none';
    previewSection.style.display = 'none';
  }

  // --------------------------------------------------------------------------
  // IMPORT HISTORY LOG
  // --------------------------------------------------------------------------
  function logImportHistory(fileName, imported, failed) {
    const raw = localStorage.getItem('pcmc_import_history');
    let list = raw ? JSON.parse(raw) : [];
    list.unshift({
      id: 'imp-' + Date.now(),
      file_name: fileName,
      import_type: targetTypeSelect.options[targetTypeSelect.selectedIndex].text,
      status: failed > 0 ? (imported > 0 ? 'Partial' : 'Failed') : 'Success',
      records_imported: imported,
      records_failed: failed,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('pcmc_import_history', JSON.stringify(list.slice(0, 20)));
  }

  function loadImportHistory() {
    const raw = localStorage.getItem('pcmc_import_history');
    const list = raw ? JSON.parse(raw) : [
      {
        file_name: 'PCMC_Sep2026_Accounts.xlsx',
        import_type: 'Daily Business Records',
        status: 'Success',
        records_imported: 30,
        records_failed: 0,
        created_at: new Date(Date.now() - 86400000 * 3).toISOString()
      }
    ];

    if (!list.length) {
      historyTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No previous imports logged.</td></tr>';
      return;
    }

    historyTbody.innerHTML = list.map(item => `
      <tr>
        <td style="font-weight: 600; font-size: 0.82rem;">${item.file_name}</td>
        <td style="font-size: 0.78rem; color: var(--text-secondary);">${item.import_type}</td>
        <td>
          <span class="badge ${item.status === 'Success' ? 'badge-completed' : 'badge-washing'}">${item.status}</span>
        </td>
        <td style="font-size: 0.8rem; font-weight: 700;">${item.records_imported} imported</td>
      </tr>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // ONE-CLICK EXPORTERS
  // --------------------------------------------------------------------------
  document.getElementById('btnExportAllDaily').addEventListener('click', async () => {
    try {
      const records = await PCMC_DB.getDailyRecords(null, null);
      if (!records.length) return PCMC_UI.toast('No daily records available to export.', 'warning');

      const data = records.map(r => {
        const m = {};
        let dayInc = 0;
        if (r.daily_income_entries) {
          r.daily_income_entries.forEach(e => {
            m[e.service_key] = e.amount;
            dayInc += parseFloat(e.amount) || 0;
          });
        }
        return {
          'Date': r.record_date,
          'Day': r.day_of_week,
          'Commuter / Scooter': m['bike_scooter'] || 0,
          'Sports / Bullet': m['bike_sports'] || 0,
          'Car - Water Wash': m['car_water_wash'] || 0,
          'Car - Only Body': m['car_only_body'] || 0,
          'Car - Full Wash': m['car_full_wash'] || 0,
          'Car - Underbody + Full': m['car_underbody_full'] || 0,
          'Rikshaw - Full Wash': m['rikshaw_full_wash'] || 0,
          'Tractor / Tempo': m['tractor_tempo'] || 0,
          'Miscellaneous': m['miscellaneous'] || 0,
          'Day Income (INR)': dayInc,
          'Notes': r.notes || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Records');
      XLSX.writeFile(wb, `PCMC_All_Daily_Records_${PCMC_DB.formatDate(new Date())}.xlsx`);
      PCMC_UI.toast('Exported all daily business records.', 'success');
    } catch (err) {
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  document.getElementById('btnExportAllExpenses').addEventListener('click', async () => {
    try {
      const list = await PCMC_DB.getExpenses(null, null);
      if (!list.length) return PCMC_UI.toast('No expenses to export.', 'warning');

      const data = list.map(e => ({
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
      XLSX.writeFile(wb, `PCMC_All_Expenses_${PCMC_DB.formatDate(new Date())}.xlsx`);
      PCMC_UI.toast('Exported all operating expenses.', 'success');
    } catch (err) {
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  document.getElementById('btnExportAllCapital').addEventListener('click', async () => {
    try {
      const list = await PCMC_DB.getCapitalTransactions(null, null);
      if (!list.length) return PCMC_UI.toast('No capital records to export.', 'warning');

      const data = list.map(c => ({
        'Date': c.transaction_date,
        'Type': c.investment_type,
        'Purpose': c.purpose,
        'Amount (INR)': c.amount,
        'Payment Mode': c.payment_method,
        'Notes': c.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Capital');
      XLSX.writeFile(wb, `PCMC_All_Capital_${PCMC_DB.formatDate(new Date())}.xlsx`);
      PCMC_UI.toast('Exported all capital records.', 'success');
    } catch (err) {
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  document.getElementById('btnExportAllOrders').addEventListener('click', async () => {
    try {
      const list = await PCMC_DB.getPickupOrders(null, null);
      if (!list.length) return PCMC_UI.toast('No orders to export.', 'warning');

      const data = list.map(o => ({
        'Booking ID': o.booking_id,
        'Customer Name': o.customer_name,
        'Mobile': o.customer_mobile,
        'Vehicle': `${o.vehicle_category} - ${o.vehicle_type}`,
        'Service': o.service_name,
        'Status': o.order_status,
        'Payment': o.payment_status,
        'Price (INR)': o.final_amount || o.service_price,
        'Address': o.pickup_address
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pickup Orders');
      XLSX.writeFile(wb, `PCMC_All_Orders_${PCMC_DB.formatDate(new Date())}.xlsx`);
      PCMC_UI.toast('Exported all pickup orders.', 'success');
    } catch (err) {
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  document.getElementById('btnExportFullJsonBackup').addEventListener('click', async () => {
    try {
      const [daily, exp, cap, ord] = await Promise.all([
        PCMC_DB.getDailyRecords(null, null),
        PCMC_DB.getExpenses(null, null),
        PCMC_DB.getCapitalTransactions(null, null),
        PCMC_DB.getPickupOrders(null, null)
      ]);

      const backupObj = {
        metadata: {
          system: 'PCMC Washing Centre ERP',
          backupDate: new Date().toISOString(),
          version: '1.0'
        },
        daily_records: daily,
        expense_transactions: exp,
        capital_transactions: cap,
        pickup_drop_orders: ord
      };

      const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonStr);
      downloadAnchor.setAttribute('download', `PCMC_ERP_Full_Backup_${PCMC_DB.formatDate(new Date())}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      PCMC_UI.toast('Downloaded complete JSON database snapshot.', 'success');
    } catch (err) {
      PCMC_UI.toast('Backup failed: ' + err.message, 'error');
    }
  });

  // Initial load
  loadImportHistory();
});

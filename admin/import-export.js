/* ============================================================================
   PCMC Washing Centre - Excel Data Export & Backup Controller
   Handles high-fidelity SheetJS Excel exports and complete JSON snapshots
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  await PCMC_AUTH.requireAuth();

  // 2. Load Live Counts
  loadRecordStats();

  async function loadRecordStats() {
    try {
      const [daily, expenses, capital, orders] = await Promise.all([
        PCMC_DB.getDailyRecords(null, null),
        PCMC_DB.getExpenses(null, null),
        PCMC_DB.getCapitalTransactions(null, null),
        PCMC_DB.getPickupOrders(null, null)
      ]);

      const statDaily = document.getElementById('stat-daily-count');
      const statExpenses = document.getElementById('stat-expenses-count');
      const statCapital = document.getElementById('stat-capital-count');
      const statOrders = document.getElementById('stat-orders-count');

      if (statDaily) statDaily.textContent = `${daily.length} Days`;
      if (statExpenses) statExpenses.textContent = `${expenses.length} Records`;
      if (statCapital) statCapital.textContent = `${capital.length} Records`;
      if (statOrders) statOrders.textContent = `${orders.length} Bookings`;
    } catch (err) {
      console.warn('Could not load live export counts:', err);
    }
  }

  // --------------------------------------------------------------------------
  // 1. EXPORT DAILY BUSINESS RECORDS
  // --------------------------------------------------------------------------
  const btnDaily = document.getElementById('btnExportAllDaily');
  if (btnDaily) {
    btnDaily.addEventListener('click', async () => {
      try {
        btnDaily.disabled = true;
        const records = await PCMC_DB.getDailyRecords(null, null);
        if (!records.length) {
          PCMC_UI.toast('No daily records available to export.', 'warning');
          return;
        }

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
            'Commuter / Scooter (₹)': m['bike_scooter'] || 0,
            'Sports / Bullet (₹)': m['bike_sports'] || 0,
            'Car - Water Wash (₹)': m['car_water_wash'] || 0,
            'Car - Only Body (₹)': m['car_only_body'] || 0,
            'Car - Full Wash (₹)': m['car_full_wash'] || 0,
            'Car - Underbody + Full (₹)': m['car_underbody_full'] || 0,
            'Rikshaw - Full Wash (₹)': m['rikshaw_full_wash'] || 0,
            'Tractor / Tempo (₹)': m['tractor_tempo'] || 0,
            'Miscellaneous (₹)': m['miscellaneous'] || 0,
            'Total Day Income (₹)': dayInc,
            'Daily Notes': r.notes || ''
          };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Daily Records');
        XLSX.writeFile(wb, `PCMC_Daily_Records_${PCMC_DB.formatDate(new Date())}.xlsx`);
        PCMC_UI.toast('Successfully exported all daily business records.', 'success');
      } catch (err) {
        console.error('Export daily failed:', err);
        PCMC_UI.toast('Export failed: ' + err.message, 'error');
      } finally {
        btnDaily.disabled = false;
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. EXPORT OPERATING EXPENSES
  // --------------------------------------------------------------------------
  const btnExpenses = document.getElementById('btnExportAllExpenses');
  if (btnExpenses) {
    btnExpenses.addEventListener('click', async () => {
      try {
        btnExpenses.disabled = true;
        const list = await PCMC_DB.getExpenses(null, null);
        if (!list.length) {
          PCMC_UI.toast('No expenses available to export.', 'warning');
          return;
        }

        const data = list.map(e => ({
          'Date': e.expense_date,
          'Category': e.category,
          'Description': e.description,
          'Amount (₹)': parseFloat(e.amount) || 0,
          'Payment Mode': e.payment_method || 'Cash',
          'Receipt / Invoice No': e.receipt_no || '',
          'Notes': e.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Operating Expenses');
        XLSX.writeFile(wb, `PCMC_Operating_Expenses_${PCMC_DB.formatDate(new Date())}.xlsx`);
        PCMC_UI.toast('Successfully exported operating expenses log.', 'success');
      } catch (err) {
        console.error('Export expenses failed:', err);
        PCMC_UI.toast('Export failed: ' + err.message, 'error');
      } finally {
        btnExpenses.disabled = false;
      }
    });
  }

  // --------------------------------------------------------------------------
  // 3. EXPORT CAPITAL & ASSETS
  // --------------------------------------------------------------------------
  const btnCapital = document.getElementById('btnExportAllCapital');
  if (btnCapital) {
    btnCapital.addEventListener('click', async () => {
      try {
        btnCapital.disabled = true;
        const list = await PCMC_DB.getCapitalTransactions(null, null);
        if (!list.length) {
          PCMC_UI.toast('No capital transactions to export.', 'warning');
          return;
        }

        const data = list.map(c => ({
          'Date': c.transaction_date,
          'Type': c.investment_type,
          'Purpose / Asset Name': c.purpose,
          'Amount (₹)': parseFloat(c.amount) || 0,
          'Payment Method': c.payment_method || 'Bank Transfer',
          'Remarks / Warranty': c.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Capital Investments');
        XLSX.writeFile(wb, `PCMC_Capital_Assets_${PCMC_DB.formatDate(new Date())}.xlsx`);
        PCMC_UI.toast('Successfully exported capital & asset investments.', 'success');
      } catch (err) {
        console.error('Export capital failed:', err);
        PCMC_UI.toast('Export failed: ' + err.message, 'error');
      } finally {
        btnCapital.disabled = false;
      }
    });
  }

  // --------------------------------------------------------------------------
  // 4. EXPORT PICKUP & DROP ORDERS
  // --------------------------------------------------------------------------
  const btnOrders = document.getElementById('btnExportAllOrders');
  if (btnOrders) {
    btnOrders.addEventListener('click', async () => {
      try {
        btnOrders.disabled = true;
        const list = await PCMC_DB.getPickupOrders(null, null);
        if (!list.length) {
          PCMC_UI.toast('No pickup orders to export.', 'warning');
          return;
        }

        const data = list.map(o => ({
          'Booking ID': o.booking_id,
          'Customer Name': o.customer_name,
          'Mobile': o.customer_mobile,
          'Vehicle Category': o.vehicle_category,
          'Vehicle Model': o.vehicle_type,
          'Registration No': o.vehicle_number || '',
          'Service Requested': o.service_name,
          'Order Status': o.order_status,
          'Payment Status': o.payment_status,
          'Amount (₹)': parseFloat(o.final_amount || o.service_price) || 0,
          'Pickup Address': o.pickup_address,
          'Preferred Slot': o.preferred_slot || '',
          'Created Date': o.created_at ? o.created_at.split('T')[0] : ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Doorstep Orders');
        XLSX.writeFile(wb, `PCMC_Pickup_Orders_${PCMC_DB.formatDate(new Date())}.xlsx`);
        PCMC_UI.toast('Successfully exported pickup & drop orders log.', 'success');
      } catch (err) {
        console.error('Export orders failed:', err);
        PCMC_UI.toast('Export failed: ' + err.message, 'error');
      } finally {
        btnOrders.disabled = false;
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. FULL ERP DATABASE BACKUP (.JSON)
  // --------------------------------------------------------------------------
  const exportFullJson = async () => {
    try {
      PCMC_UI.toast('Preparing full database snapshot...', 'info', 2000);
      const [daily, exp, cap, ord] = await Promise.all([
        PCMC_DB.getDailyRecords(null, null),
        PCMC_DB.getExpenses(null, null),
        PCMC_DB.getCapitalTransactions(null, null),
        PCMC_DB.getPickupOrders(null, null)
      ]);

      const backupObj = {
        metadata: {
          system: 'PCMC Washing Centre ERP',
          exportDate: new Date().toISOString(),
          version: '1.0',
          summary: {
            dailyRecordsCount: daily.length,
            expensesCount: exp.length,
            capitalCount: cap.length,
            ordersCount: ord.length
          }
        },
        daily_records: daily,
        expense_transactions: exp,
        capital_transactions: cap,
        pickup_drop_orders: ord
      };

      const jsonBlob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `PCMC_ERP_Full_Backup_${PCMC_DB.formatDate(new Date())}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      PCMC_UI.toast('Downloaded complete JSON database archive.', 'success');
    } catch (err) {
      console.error('JSON backup failed:', err);
      PCMC_UI.toast('Backup failed: ' + err.message, 'error');
    }
  };

  const btnJson = document.getElementById('btnExportFullJsonBackup');
  if (btnJson) btnJson.addEventListener('click', exportFullJson);

  const btnQuickTop = document.getElementById('btnQuickBackupTop');
  if (btnQuickTop) btnQuickTop.addEventListener('click', exportFullJson);
});

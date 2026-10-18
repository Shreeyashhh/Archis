/* ============================================================================
   PCMC Washing Centre - Financial Reports Controller
   Generates P&L statements, margin analysis, and multi-sheet SheetJS Excel exports
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  await PCMC_AUTH.requireAuth();

  // 2. DOM Elements
  const periodSelect = document.getElementById('reportPeriodSelect');
  const customBox = document.getElementById('reportCustomBox');
  const customStart = document.getElementById('reportCustomStart');
  const customEnd = document.getElementById('reportCustomEnd');
  const btnApplyCustom = document.getElementById('btnApplyReportCustom');
  const dateLabel = document.getElementById('reportDateLabel');
  const printDateLabel = document.getElementById('reportPrintDate');
  const btnExport = document.getElementById('btnExportFullReport');

  // Statement Elements
  const stmtBikeRev = document.getElementById('stmt-bike-rev');
  const stmtCarRev = document.getElementById('stmt-car-rev');
  const stmtCommRev = document.getElementById('stmt-comm-rev');
  const stmtMiscRev = document.getElementById('stmt-misc-rev');
  const stmtGrossRev = document.getElementById('stmt-gross-rev');
  const stmtExpRows = document.getElementById('stmt-expense-rows');
  const stmtTotalExp = document.getElementById('stmt-total-exp');
  const stmtNetProfit = document.getElementById('stmt-net-profit');
  const stmtMarginPct = document.getElementById('stmt-margin-pct');
  const stmtCapOwner = document.getElementById('stmt-cap-owner');
  const stmtCapAssets = document.getElementById('stmt-cap-assets');
  const stmtTotalCap = document.getElementById('stmt-total-cap');

  const catTbody = document.getElementById('categoryBreakdownTbody');
  const payTbody = document.getElementById('paymentBreakdownTbody');

  // Initialize Dates
  const todayStr = PCMC_DB.formatDate(new Date());
  if (customStart) customStart.value = todayStr;
  if (customEnd) customEnd.value = todayStr;
  if (printDateLabel) {
    printDateLabel.textContent = `Generated on: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }

  // State
  let currentReportData = null;

  // Filter Event
  periodSelect.addEventListener('change', () => {
    if (periodSelect.value === 'custom') {
      customBox.style.display = 'inline-flex';
    } else {
      customBox.style.display = 'none';
      generateReport(periodSelect.value);
    }
  });

  if (btnApplyCustom) {
    btnApplyCustom.addEventListener('click', () => {
      if (!customStart.value || !customEnd.value) {
        PCMC_UI.toast('Please select both start and end dates', 'warning');
        return;
      }
      generateReport('custom', customStart.value, customEnd.value);
    });
  }

  // --------------------------------------------------------------------------
  // GENERATE FINANCIAL REPORT
  // --------------------------------------------------------------------------
  async function generateReport(filterType = 'thisMonth', start = null, end = null) {
    try {
      const { startDate, endDate } = PCMC_DB.getDateRange(filterType, start, end);
      dateLabel.textContent = `Period: ${PCMC_UI.formatDisplayDate(startDate)} to ${PCMC_UI.formatDisplayDate(endDate)}`;

      // Fetch all required data
      const [dailyRecords, expenses, capitalList, orders] = await Promise.all([
        PCMC_DB.getDailyRecords(startDate, endDate),
        PCMC_DB.getExpenses(startDate, endDate),
        PCMC_DB.getCapitalTransactions(startDate, endDate),
        PCMC_DB.getPickupOrders(startDate, endDate)
      ]);

      // 1. Process Revenue
      let bikeRev = 0;
      let carRev = 0;
      let commRev = 0;
      let miscRev = 0;
      let grossRev = 0;

      const categoryRevenue = {
        'Bike': 0,
        'Car': 0,
        'Rickshaw & Tractor': 0,
        'Miscellaneous': 0
      };

      dailyRecords.forEach(rec => {
        if (rec.daily_income_entries) {
          rec.daily_income_entries.forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            grossRev += amt;

            if (['bike_scooter', 'bike_sports'].includes(e.service_key)) {
              bikeRev += amt;
              categoryRevenue['Bike'] += amt;
            } else if (['car_water_wash', 'car_only_body', 'car_full_wash', 'car_underbody_full'].includes(e.service_key)) {
              carRev += amt;
              categoryRevenue['Car'] += amt;
            } else if (['rikshaw_full_wash', 'tractor_tempo'].includes(e.service_key)) {
              commRev += amt;
              categoryRevenue['Rickshaw & Tractor'] += amt;
            } else {
              miscRev += amt;
              categoryRevenue['Miscellaneous'] += amt;
            }
          });
        }
      });

      // 2. Process Expenses
      let totalExp = 0;
      const expCategoryMap = {};
      const expPaymentMap = {};

      expenses.forEach(e => {
        const amt = parseFloat(e.amount) || 0;
        totalExp += amt;
        expCategoryMap[e.category] = (expCategoryMap[e.category] || 0) + amt;
        const pay = e.payment_method || 'Cash';
        expPaymentMap[pay] = (expPaymentMap[pay] || 0) + amt;
      });

      // 3. Process Profit
      const netProfit = grossRev - totalExp;
      const marginPct = grossRev > 0 ? ((netProfit / grossRev) * 100).toFixed(1) : '0.0';

      // 4. Process Capital
      let capOwner = 0;
      let capAssets = 0;
      let totalCap = 0;

      capitalList.forEach(c => {
        const amt = parseFloat(c.amount) || 0;
        totalCap += amt;
        if (c.investment_type === 'Owner Capital') {
          capOwner += amt;
        } else {
          capAssets += amt;
        }
      });

      // Populate Statement DOM
      stmtBikeRev.textContent = PCMC_UI.formatINR(bikeRev);
      stmtCarRev.textContent = PCMC_UI.formatINR(carRev);
      stmtCommRev.textContent = PCMC_UI.formatINR(commRev);
      stmtMiscRev.textContent = PCMC_UI.formatINR(miscRev);
      stmtGrossRev.textContent = PCMC_UI.formatINR(grossRev);

      // Render Expense Itemized Rows
      const sortedExpCats = Object.entries(expCategoryMap).sort((a, b) => b[1] - a[1]);
      if (sortedExpCats.length === 0) {
        stmtExpRows.innerHTML = `
          <tr>
            <td style="padding-left: 2rem; color: var(--text-muted);">No operating expenses recorded</td>
            <td>-</td>
            <td style="text-align: right; color: var(--text-muted);">₹0</td>
          </tr>
        `;
      } else {
        stmtExpRows.innerHTML = sortedExpCats.map(([cat, amt]) => `
          <tr>
            <td style="padding-left: 2rem;">${cat}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">Operating overhead</td>
            <td style="text-align: right; font-weight: 600; color: #ff527b;">${PCMC_UI.formatINR(amt)}</td>
          </tr>
        `).join('');
      }

      stmtTotalExp.textContent = PCMC_UI.formatINR(totalExp);
      stmtNetProfit.textContent = PCMC_UI.formatINR(netProfit);
      stmtMarginPct.textContent = `${marginPct}% ${netProfit >= 0 ? 'Net Operating Margin' : 'Deficit'}`;

      stmtCapOwner.textContent = PCMC_UI.formatINR(capOwner);
      stmtCapAssets.textContent = PCMC_UI.formatINR(capAssets);
      stmtTotalCap.textContent = PCMC_UI.formatINR(totalCap);

      // Populate Category Breakdown Table
      catTbody.innerHTML = Object.entries(categoryRevenue).map(([cat, rev]) => {
        const share = grossRev > 0 ? ((rev / grossRev) * 100).toFixed(1) : 0;
        return `
          <tr>
            <td style="font-weight: 600;">${cat}</td>
            <td style="text-align: right; font-weight: 700; color: var(--accent-cyan);">${PCMC_UI.formatINR(rev)}</td>
            <td style="text-align: right; color: var(--text-secondary);">${share}%</td>
          </tr>
        `;
      }).join('');

      // Populate Payment Mode Breakdown Table
      payTbody.innerHTML = Object.entries(expPaymentMap).map(([mode, amt]) => {
        const share = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(1) : 0;
        return `
          <tr>
            <td style="font-weight: 600;">${mode}</td>
            <td style="text-align: right; font-weight: 700;">${PCMC_UI.formatINR(amt)}</td>
            <td style="text-align: right; color: var(--text-secondary);">${share}%</td>
          </tr>
        `;
      }).join('');

      if (Object.keys(expPaymentMap).length === 0) {
        payTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No payment data recorded in range.</td></tr>';
      }

      // Store in memory for Excel export
      currentReportData = {
        dateRange: { startDate, endDate },
        grossRev,
        bikeRev,
        carRev,
        commRev,
        miscRev,
        categoryRevenue,
        totalExp,
        expCategoryMap,
        netProfit,
        marginPct,
        capOwner,
        capAssets,
        totalCap,
        dailyRecords,
        expenses,
        capitalList,
        orders
      };

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error generating report:', err);
      PCMC_UI.toast('Failed to generate report: ' + err.message, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // MULTI-SHEET EXCEL EXPORT
  // --------------------------------------------------------------------------
  btnExport.addEventListener('click', () => {
    if (!currentReportData) {
      PCMC_UI.toast('Please generate report first.', 'warning');
      return;
    }

    try {
      const {
        dateRange,
        grossRev,
        bikeRev,
        carRev,
        commRev,
        miscRev,
        totalExp,
        netProfit,
        marginPct,
        capOwner,
        capAssets,
        totalCap,
        expCategoryMap,
        categoryRevenue,
        dailyRecords,
        expenses,
        capitalList,
        orders
      } = currentReportData;

      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive Statement
      const summarySheetData = [
        ['PCMC WASHING CENTRE — FINANCIAL STATEMENT'],
        ['Statement Period', `${dateRange.startDate} to ${dateRange.endDate}`],
        ['Generated On', new Date().toISOString()],
        [],
        ['1. REVENUE BREAKDOWN', 'Amount (INR)'],
        ['Motorcycle / Bike Washing Revenue', bikeRev],
        ['Car Washing Revenue', carRev],
        ['Commercial (Rickshaw & Tractor)', commRev],
        ['Miscellaneous Wash Services', miscRev],
        ['GROSS OPERATING REVENUE', grossRev],
        [],
        ['2. OPERATING EXPENSES', 'Amount (INR)'],
        ...Object.entries(expCategoryMap).map(([cat, amt]) => [cat, amt]),
        ['TOTAL OPERATING EXPENSES', totalExp],
        [],
        ['3. PROFITABILITY', 'Amount (INR)'],
        ['NET OPERATING PROFIT', netProfit],
        ['Operating Profit Margin (%)', `${marginPct}%`],
        [],
        ['4. CAPITAL & INVESTMENTS', 'Amount (INR)'],
        ['Owner Capital Contributions', capOwner],
        ['Machinery & Equipment Assets', capAssets],
        ['TOTAL CAPITAL INVESTED', totalCap]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'P&L Statement');

      // Sheet 2: Daily Records Timeline
      const dailyData = dailyRecords.map(r => {
        let inc = 0;
        if (r.daily_income_entries) {
          inc = r.daily_income_entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        }
        return {
          'Date': r.record_date,
          'Day': r.day_of_week,
          'Day Income (INR)': inc,
          'Notes': r.notes || ''
        };
      });
      const wsDaily = XLSX.utils.json_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Income Log');

      // Sheet 3: Expenses Detail
      const expenseData = expenses.map(e => ({
        'Date': e.expense_date,
        'Category': e.category,
        'Description': e.description,
        'Amount (INR)': e.amount,
        'Payment Mode': e.payment_method,
        'Receipt No': e.receipt_no || '',
        'Notes': e.notes || ''
      }));
      const wsExp = XLSX.utils.json_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses Log');

      // Sheet 4: Capital Detail
      const capitalData = capitalList.map(c => ({
        'Date': c.transaction_date,
        'Type': c.investment_type,
        'Purpose': c.purpose,
        'Amount (INR)': c.amount,
        'Payment Mode': c.payment_method,
        'Notes': c.notes || ''
      }));
      const wsCap = XLSX.utils.json_to_sheet(capitalData);
      XLSX.utils.book_append_sheet(wb, wsCap, 'Capital & Assets');

      // Sheet 5: Orders Detail
      if (orders && orders.length) {
        const orderData = orders.map(o => ({
          'Booking ID': o.booking_id,
          'Customer': o.customer_name,
          'Mobile': o.customer_mobile,
          'Vehicle': `${o.vehicle_category} - ${o.vehicle_type}`,
          'Service': o.service_name,
          'Status': o.order_status,
          'Payment': o.payment_status,
          'Final Amount (INR)': o.final_amount || o.service_price
        }));
        const wsOrd = XLSX.utils.json_to_sheet(orderData);
        XLSX.utils.book_append_sheet(wb, wsOrd, 'Pickup Orders');
      }

      const fileName = `PCMC_Full_Financial_Report_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
      PCMC_UI.toast('Exported complete multi-sheet report to ' + fileName, 'success');
    } catch (err) {
      console.error('Error generating Excel export:', err);
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  // Initial load
  generateReport('thisMonth');
});

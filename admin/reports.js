/* ============================================================================
   PCMC Washing Centre - Financial Reports & Analytics Controller
   Easy-to-understand executive summary, visual charts, simple math, and SheetJS export
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
  const summaryPeriodName = document.getElementById('summaryPeriodName');
  const executiveSummaryText = document.getElementById('reportExecutiveSummaryText');
  const btnExport = document.getElementById('btnExportFullReport');

  // KPI Scorecard Elements
  const kpiRevenue = document.getElementById('kpi-report-revenue');
  const kpiRevenueSub = document.getElementById('kpi-report-revenue-sub');
  const kpiExpenses = document.getElementById('kpi-report-expenses');
  const kpiExpensesSub = document.getElementById('kpi-report-expenses-sub');
  const kpiProfit = document.getElementById('kpi-report-profit');
  const kpiProfitSub = document.getElementById('kpi-report-profit-sub');
  const kpiProfitCard = document.getElementById('kpi-profit-card');
  const kpiMargin = document.getElementById('kpi-report-margin');
  const kpiMarginSub = document.getElementById('kpi-report-margin-sub');

  // Math Formula Elements
  const formulaRevenue = document.getElementById('formulaRevenue');
  const formulaExpenses = document.getElementById('formulaExpenses');
  const formulaProfit = document.getElementById('formulaProfit');
  const formulaMargin = document.getElementById('formulaMargin');

  // Breakdown Containers
  const revenueStreamsList = document.getElementById('revenueStreamsList');
  const expenseStreamsList = document.getElementById('expenseStreamsList');
  const revenueTotalLabel = document.getElementById('revenueTotalLabel');
  const expenseTotalLabel = document.getElementById('expenseTotalLabel');

  // Capital Elements
  const stmtCapOwner = document.getElementById('stmt-cap-owner');
  const stmtCapAssets = document.getElementById('stmt-cap-assets');
  const stmtTotalCap = document.getElementById('stmt-total-cap');

  // Chart Instances
  let comparisonChartInstance = null;
  let categoryDonutChartInstance = null;

  // Initialize Dates
  const todayStr = PCMC_DB.formatDate(new Date());
  if (customStart) customStart.value = todayStr;
  if (customEnd) customEnd.value = todayStr;

  // Filter change handler
  periodSelect.addEventListener('change', () => {
    if (periodSelect.value === 'custom') {
      customBox.style.display = 'flex';
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
  // GENERATE INTUITIVE REPORT
  // --------------------------------------------------------------------------
  let currentReportData = null;

  async function generateReport(filterType = 'thisMonth', start = null, end = null) {
    try {
      const { startDate, endDate } = PCMC_DB.getDateRange(filterType, start, end);
      const periodLabelStr = `${PCMC_UI.formatDisplayDate(startDate)} to ${PCMC_UI.formatDisplayDate(endDate)}`;
      if (dateLabel) dateLabel.textContent = `Period: ${periodLabelStr}`;

      const selectedOptionText = periodSelect.options[periodSelect.selectedIndex].text;
      if (summaryPeriodName) summaryPeriodName.textContent = selectedOptionText;

      // Fetch all underlying data in parallel
      const [dailyRecords, expenses, capitalList, orders] = await Promise.all([
        PCMC_DB.getDailyRecords(startDate, endDate),
        PCMC_DB.getExpenses(startDate, endDate),
        PCMC_DB.getCapitalTransactions(startDate, endDate),
        PCMC_DB.getPickupOrders(startDate, endDate)
      ]);

      // 1. Calculate Revenue Breakdown
      let grossRev = 0;
      let totalVehicles = 0;
      let bikeRev = 0;
      let bikeCount = 0;
      let carRev = 0;
      let carCount = 0;
      let commRev = 0;
      let commCount = 0;
      let miscRev = 0;
      let miscCount = 0;

      dailyRecords.forEach(rec => {
        if (rec.daily_income_entries) {
          rec.daily_income_entries.forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            const qty = parseInt(e.quantity, 10) || (amt > 0 ? 1 : 0);
            grossRev += amt;
            totalVehicles += qty;

            if (['bike_scooter', 'bike_sports'].includes(e.service_key)) {
              bikeRev += amt;
              bikeCount += qty;
            } else if (['car_water_wash', 'car_only_body', 'car_full_wash', 'car_underbody_full'].includes(e.service_key)) {
              carRev += amt;
              carCount += qty;
            } else if (['rikshaw_full_wash', 'tractor_tempo'].includes(e.service_key)) {
              commRev += amt;
              commCount += qty;
            } else {
              miscRev += amt;
              miscCount += qty;
            }
          });
        }
      });

      // 2. Calculate Expenses Breakdown
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

      // 3. Profit & Margin Calculations
      const netProfit = grossRev - totalExp;
      const marginPctVal = grossRev > 0 ? (netProfit / grossRev) * 100 : 0;
      const marginPctStr = marginPctVal.toFixed(1);

      // 4. Capital Additions
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

      // ----------------------------------------------------------------------
      // POPULATE 4 TOP KPI CARDS
      // ----------------------------------------------------------------------
      kpiRevenue.textContent = PCMC_UI.formatINR(grossRev);
      kpiRevenueSub.textContent = `From ${totalVehicles.toLocaleString('en-IN')} vehicle washes`;

      kpiExpenses.textContent = PCMC_UI.formatINR(totalExp);
      kpiExpensesSub.textContent = `${expenses.length} operating overhead entries`;

      kpiProfit.textContent = PCMC_UI.formatINR(netProfit);
      if (netProfit >= 0) {
        kpiProfit.style.color = 'var(--accent-success)';
        kpiProfitSub.textContent = `Operating profitably (+${marginPctStr}% net margin)`;
        if (kpiProfitCard) {
          kpiProfitCard.className = 'kpi-card green';
        }
      } else {
        kpiProfit.style.color = 'var(--accent-danger)';
        kpiProfitSub.textContent = `Operating at a deficit (${marginPctStr}% deficit)`;
        if (kpiProfitCard) {
          kpiProfitCard.className = 'kpi-card red';
        }
      }

      kpiMargin.textContent = `${marginPctStr}%`;
      kpiMarginSub.textContent = grossRev > 0 
        ? `You keep ₹${Math.max(0, marginPctVal).toFixed(1)} per ₹100 earned`
        : 'No washing revenue in period';

      // ----------------------------------------------------------------------
      // POPULATE SIMPLE MATH FORMULA BOX
      // ----------------------------------------------------------------------
      formulaRevenue.textContent = PCMC_UI.formatINR(grossRev);
      formulaExpenses.textContent = PCMC_UI.formatINR(totalExp);
      formulaProfit.textContent = PCMC_UI.formatINR(netProfit);
      formulaProfit.style.color = netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';
      formulaMargin.textContent = `${marginPctStr}% Operating Margin (${netProfit >= 0 ? 'Surplus' : 'Deficit'})`;

      // ----------------------------------------------------------------------
      // POPULATE EXECUTIVE PLAIN-ENGLISH SUMMARY
      // ----------------------------------------------------------------------
      const categoryRevenue = {
        'Cars': carRev,
        'Motorcycles & Scooters': bikeRev,
        'Auto-Rickshaw & Tempo': commRev,
        'Detailing & Misc': miscRev
      };

      const topRevenueCat = Object.entries(categoryRevenue).sort((a, b) => b[1] - a[1])[0];
      const topRevenuePct = grossRev > 0 && topRevenueCat ? ((topRevenueCat[1] / grossRev) * 100).toFixed(0) : 0;

      const topExpCat = Object.entries(expCategoryMap).sort((a, b) => b[1] - a[1])[0];
      const topExpPct = totalExp > 0 && topExpCat ? ((topExpCat[1] / totalExp) * 100).toFixed(0) : 0;

      let summarySentence = `In <strong>${selectedOptionText}</strong>, PCMC Washing Centre serviced <strong>${totalVehicles} vehicles</strong>, generating <strong>${PCMC_UI.formatINR(grossRev)}</strong> in gross washing collections. `;
      summarySentence += `Day-to-day operating overheads were <strong>${PCMC_UI.formatINR(totalExp)}</strong>, leaving your business with a net operating profit of <strong style="color: ${netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">${PCMC_UI.formatINR(netProfit)}</strong> (<strong>${marginPctStr}%</strong> margin). `;
      
      if (topRevenueCat && topRevenueCat[1] > 0) {
        summarySentence += `Your highest revenue stream was <strong>${topRevenueCat[0]}</strong> (${topRevenuePct}% of total collections). `;
      }
      if (topExpCat && topExpCat[1] > 0) {
        summarySentence += `Your largest operational expense was <strong>${topExpCat[0]}</strong> (${topExpPct}% of total overheads).`;
      }

      executiveSummaryText.innerHTML = summarySentence;

      // ----------------------------------------------------------------------
      // POPULATE REVENUE STREAMS WITH PROGRESS BARS
      // ----------------------------------------------------------------------
      revenueTotalLabel.textContent = `Total: ${PCMC_UI.formatINR(grossRev)}`;

      const streams = [
        { name: 'Cars (Water, Body, Full, Underbody)', rev: carRev, count: carCount, icon: 'car', color: '#3b82f6' },
        { name: 'Motorcycles & Scooters (Commuter & Sports)', rev: bikeRev, count: bikeCount, icon: 'bike', color: '#0ea5e9' },
        { name: 'Commercial (Rickshaw & Tractor/Tempo)', rev: commRev, count: commCount, icon: 'truck', color: '#10b981' },
        { name: 'Detailing & Miscellaneous Add-ons', rev: miscRev, count: miscCount, icon: 'sparkles', color: '#8b5cf6' }
      ];

      revenueStreamsList.innerHTML = streams.map(s => {
        const share = grossRev > 0 ? ((s.rev / grossRev) * 100).toFixed(1) : 0;
        return `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.84rem; margin-bottom: 2px;">
              <span style="font-weight: 600; color: #fff;">${s.name}</span>
              <div style="text-align: right;">
                <span style="font-weight: 700; color: #fff;">${PCMC_UI.formatINR(s.rev)}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">(${share}%)</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted);">
              <span>${s.count} vehicles washed</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${share}%; background: ${s.color};"></div>
            </div>
          </div>
        `;
      }).join('');

      // ----------------------------------------------------------------------
      // POPULATE OPERATING EXPENSES WITH PROGRESS BARS
      // ----------------------------------------------------------------------
      expenseTotalLabel.textContent = `Total: ${PCMC_UI.formatINR(totalExp)}`;

      const sortedExpCats = Object.entries(expCategoryMap).sort((a, b) => b[1] - a[1]);
      if (sortedExpCats.length === 0) {
        expenseStreamsList.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            No operating expenses logged for this period.
          </div>
        `;
      } else {
        expenseStreamsList.innerHTML = sortedExpCats.map(([cat, amt]) => {
          const share = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(1) : 0;
          return `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.84rem; margin-bottom: 2px;">
                <span style="font-weight: 600; color: var(--text-primary);">${cat}</span>
                <div style="text-align: right;">
                  <span style="font-weight: 700; color: var(--accent-danger);">${PCMC_UI.formatINR(amt)}</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">(${share}%)</span>
                </div>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${share}%; background: var(--accent-danger);"></div>
              </div>
            </div>
          `;
        }).join('');
      }

      // ----------------------------------------------------------------------
      // POPULATE CAPITAL & ASSETS
      // ----------------------------------------------------------------------
      stmtTotalCap.textContent = PCMC_UI.formatINR(totalCap);
      stmtCapAssets.textContent = PCMC_UI.formatINR(capAssets);
      stmtCapOwner.textContent = PCMC_UI.formatINR(capOwner);

      // ----------------------------------------------------------------------
      // RENDER CHARTS
      // ----------------------------------------------------------------------
      renderFinancialComparisonChart(grossRev, totalExp, netProfit);
      renderCategoryDonutChart(carRev, bikeRev, commRev, miscRev);

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
        marginPct: marginPctStr,
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
  // CHART 1: COMPARISON BAR CHART
  // --------------------------------------------------------------------------
  function renderFinancialComparisonChart(revenue, expenses, profit) {
    const ctx = document.getElementById('financialComparisonChart');
    if (!ctx) return;

    if (comparisonChartInstance) {
      comparisonChartInstance.destroy();
    }

    comparisonChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Gross Revenue', 'Operating Expenses', 'Net Profit'],
        datasets: [{
          data: [revenue, expenses, Math.max(0, profit)],
          backgroundColor: [
            'rgba(59, 130, 246, 0.85)',
            'rgba(239, 68, 68, 0.85)',
            profit >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)'
          ],
          borderColor: [
            '#3b82f6',
            '#ef4444',
            profit >= 0 ? '#10b981' : '#ef4444'
          ],
          borderWidth: 1.5,
          borderRadius: 6,
          barThickness: window.innerWidth < 640 ? 32 : 48
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#121726',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            borderColor: '#242f47',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (item) => ` ${item.label}: ₹${item.raw.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: (v) => v >= 1000 ? '₹' + (v / 1000).toLocaleString('en-IN') + 'k' : '₹' + v
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // CHART 2: VEHICLE CATEGORY DONUT CHART
  // --------------------------------------------------------------------------
  function renderCategoryDonutChart(car, bike, comm, misc) {
    const ctx = document.getElementById('categoryDonutChart');
    if (!ctx) return;

    if (categoryDonutChartInstance) {
      categoryDonutChartInstance.destroy();
    }

    const hasData = (car + bike + comm + misc) > 0;
    const values = hasData ? [car, bike, comm, misc] : [1];

    categoryDonutChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? ['Cars', 'Motorcycles & Scooters', 'Rickshaw & Tempo', 'Detailing & Misc'] : ['No Data'],
        datasets: [{
          data: values,
          backgroundColor: hasData
            ? ['#3b82f6', '#0ea5e9', '#10b981', '#8b5cf6']
            : ['#1e293b'],
          borderColor: '#121726',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 10 }
          },
          tooltip: {
            backgroundColor: '#121726',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            borderColor: '#242f47',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (item) => hasData ? ` ${item.label}: ₹${item.raw.toLocaleString('en-IN')}` : ' No data recorded'
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // --------------------------------------------------------------------------
  // MULTI-SHEET AUDIT EXCEL EXPORT
  // --------------------------------------------------------------------------
  btnExport.addEventListener('click', () => {
    if (!currentReportData) {
      PCMC_UI.toast('Please generate report first.', 'warning');
      return;
    }

    try {
      btnExport.disabled = true;
      const wb = XLSX.utils.book_new();
      const r = currentReportData;

      // SHEET 1: Executive P&L Summary
      const summaryRows = [
        ['PCMC WASHING CENTRE - PROFIT & LOSS STATEMENT'],
        [`Reporting Period: ${r.dateRange.startDate} to ${r.dateRange.endDate}`],
        [`Generated On: ${new Date().toLocaleString('en-IN')}`],
        [],
        ['1. REVENUE STREAMS', 'AMOUNT (INR)'],
        ['Motorcycle & Scooter Wash Collections', r.bikeRev],
        ['Car Washing Collections (Water, Body, Full, Underbody)', r.carRev],
        ['Commercial Vehicles (Rickshaw & Tractor)', r.commRev],
        ['Miscellaneous & Detailing Add-ons', r.miscRev],
        ['TOTAL GROSS REVENUE (A)', r.grossRev],
        [],
        ['2. OPERATING OVERHEADS & EXPENSES', 'AMOUNT (INR)'],
        ...Object.entries(r.expCategoryMap).map(([k, v]) => [k, v]),
        ['TOTAL OPERATING EXPENSES (B)', r.totalExp],
        [],
        ['3. NET OPERATING PROFIT (A - B)', r.netProfit],
        ['OPERATING PROFIT MARGIN', `${r.marginPct}%`],
        [],
        ['4. CAPITAL ASSETS & INVESTMENTS (SEPARATE FROM DAY EXPENSES)', 'AMOUNT (INR)'],
        ['Owner Capital Equity Contributions', r.capOwner],
        ['Machinery, Equipment & Infrastructure Assets', r.capAssets],
        ['TOTAL CAPITAL ADDED', r.totalCap]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'P&L Statement');

      // SHEET 2: Daily Business Records
      if (r.dailyRecords.length) {
        const dailyData = r.dailyRecords.map(rec => {
          const m = {};
          let inc = 0;
          if (rec.daily_income_entries) {
            rec.daily_income_entries.forEach(e => {
              m[e.service_key] = e.amount;
              inc += parseFloat(e.amount) || 0;
            });
          }
          return {
            'Date': rec.record_date,
            'Day': rec.day_of_week,
            'Commuter / Scooty (₹)': m['bike_scooter'] || 0,
            'Sports / Bullet (₹)': m['bike_sports'] || 0,
            'Car - Water Wash (₹)': m['car_water_wash'] || 0,
            'Car - Only Body (₹)': m['car_only_body'] || 0,
            'Car - Full Wash (₹)': m['car_full_wash'] || 0,
            'Car - Underbody + Full (₹)': m['car_underbody_full'] || 0,
            'Rickshaw (₹)': m['rikshaw_full_wash'] || 0,
            'Tractor / Tempo (₹)': m['tractor_tempo'] || 0,
            'Misc (₹)': m['miscellaneous'] || 0,
            'Day Income (₹)': inc,
            'Notes': rec.notes || ''
          };
        });
        const wsDaily = XLSX.utils.json_to_sheet(dailyData);
        XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Wash Records');
      }

      // SHEET 3: Operating Expenses
      if (r.expenses.length) {
        const expData = r.expenses.map(e => ({
          'Date': e.expense_date,
          'Category': e.category,
          'Description': e.description,
          'Amount (INR)': e.amount,
          'Payment Method': e.payment_method,
          'Receipt No': e.receipt_no || '',
          'Notes': e.notes || ''
        }));
        const wsExp = XLSX.utils.json_to_sheet(expData);
        XLSX.utils.book_append_sheet(wb, wsExp, 'Operating Expenses');
      }

      // SHEET 4: Capital Assets
      if (r.capitalList.length) {
        const capData = r.capitalList.map(c => ({
          'Date': c.transaction_date,
          'Investment Type': c.investment_type,
          'Asset Purpose': c.purpose,
          'Amount (INR)': c.amount,
          'Payment Mode': c.payment_method,
          'Notes': c.notes || ''
        }));
        const wsCap = XLSX.utils.json_to_sheet(capData);
        XLSX.utils.book_append_sheet(wb, wsCap, 'Capital & Assets');
      }

      const fileName = `PCMC_Financial_Report_${r.dateRange.startDate}_to_${r.dateRange.endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
      PCMC_UI.toast('Exported complete multi-sheet Financial P&L workbook.', 'success');
    } catch (err) {
      console.error('Export error:', err);
      PCMC_UI.toast('Failed to export Excel workbook: ' + err.message, 'error');
    } finally {
      btnExport.disabled = false;
    }
  });

  // Initial Load (Default: This Month)
  generateReport('thisMonth');
});

/* ============================================================================
   PCMC Washing Centre - Dashboard Controller
   Calculates live metrics, powers Chart.js graphs, and handles date filters
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Route guard check
  const admin = await PCMC_AUTH.requireAuth();

  // 2. DOM elements
  const filterSelect = document.getElementById('dateFilterSelect');
  const customBox = document.getElementById('customDateRangeBox');
  const customStart = document.getElementById('customStartDate');
  const customEnd = document.getElementById('customEndDate');
  const btnApplyCustom = document.getElementById('btnApplyCustomDate');
  const dateRangeDisplay = document.getElementById('dateRangeDisplay');
  const todayLabel = document.getElementById('todayDateLabel');

  if (todayLabel) {
    todayLabel.textContent = PCMC_UI.formatDisplayDate(PCMC_DB.formatDate(new Date()));
  }

  // Set default custom dates
  const todayStr = PCMC_DB.formatDate(new Date());
  if (customStart) customStart.value = todayStr;
  if (customEnd) customEnd.value = todayStr;

  // Chart instances
  let trendChartInstance = null;
  let categoryChartInstance = null;
  let serviceChartInstance = null;

  // Filter change handler
  filterSelect.addEventListener('change', () => {
    if (filterSelect.value === 'custom') {
      customBox.style.display = 'inline-flex';
    } else {
      customBox.style.display = 'none';
      loadDashboard(filterSelect.value);
    }
  });

  if (btnApplyCustom) {
    btnApplyCustom.addEventListener('click', () => {
      if (!customStart.value || !customEnd.value) {
        PCMC_UI.toast('Please select both start and end dates', 'warning');
        return;
      }
      loadDashboard('custom', customStart.value, customEnd.value);
    });
  }

  // Load Dashboard Data
  async function loadDashboard(filterType = 'thisMonth', start = null, end = null) {
    try {
      const summary = await PCMC_DB.getDashboardSummary(filterType, start, end);

      // Update date range display
      if (dateRangeDisplay) {
        dateRangeDisplay.textContent = `${PCMC_UI.formatDisplayDate(summary.dateRange.startDate)} — ${PCMC_UI.formatDisplayDate(summary.dateRange.endDate)}`;
      }

      // Update Today's Snapshot KPIs
      document.getElementById('kpi-today-income').textContent = PCMC_UI.formatINR(summary.today.income);
      document.getElementById('kpi-today-expenses').textContent = PCMC_UI.formatINR(summary.today.expenses);
      document.getElementById('kpi-today-profit').textContent = PCMC_UI.formatINR(summary.today.profit);
      document.getElementById('kpi-today-vehicles').textContent = summary.today.vehicles;
      document.getElementById('kpi-pending-orders').textContent = summary.rangeTotal.pendingOrders;
      document.getElementById('kpi-total-capital').textContent = PCMC_UI.formatINR(summary.rangeTotal.capitalInvested);

      // Update pending badge in sidebar
      const navBadge = document.getElementById('nav-pending-badge');
      if (navBadge) {
        if (summary.rangeTotal.pendingOrders > 0) {
          navBadge.textContent = summary.rangeTotal.pendingOrders;
          navBadge.style.display = 'inline-block';
        } else {
          navBadge.style.display = 'none';
        }
      }

      // Update Range Summary KPIs
      document.getElementById('kpi-range-revenue').textContent = PCMC_UI.formatINR(summary.rangeTotal.revenue);
      document.getElementById('kpi-range-expenses').textContent = PCMC_UI.formatINR(summary.rangeTotal.expenses);
      document.getElementById('kpi-range-profit').textContent = PCMC_UI.formatINR(summary.rangeTotal.operatingProfit);
      document.getElementById('kpi-range-vehicles').textContent = summary.rangeTotal.vehiclesServiced;

      // Render Charts
      renderTrendChart(summary.dailyTrend);
      renderCategoryChart(summary.breakdowns.byCategory);
      renderServiceChart(summary.breakdowns.byService);

      // Render Tables
      renderRecentOrders(summary.recentOrders);
      renderRecentExpenses(summary.recentExpenses);

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
      PCMC_UI.toast('Failed to load dashboard data: ' + err.message, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // CHART: Daily Revenue & Operating Expenses Trend
  // --------------------------------------------------------------------------
  function renderTrendChart(dailyTrend) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    const labels = dailyTrend.map(d => PCMC_UI.formatDisplayDate(d.date));
    const revenueData = dailyTrend.map(d => d.revenue);
    const expenseData = dailyTrend.map(d => d.expenses);

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          {
            label: 'Daily Revenue (₹)',
            data: revenueData.length ? revenueData : [0],
            borderColor: '#00f0ff',
            backgroundColor: 'rgba(0, 240, 255, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointBackgroundColor: '#00f0ff',
            pointRadius: 4
          },
          {
            label: 'Operating Expenses (₹)',
            data: expenseData.length ? expenseData : [0],
            borderColor: '#ff2a5f',
            backgroundColor: 'rgba(255, 42, 95, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointBackgroundColor: '#ff2a5f',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } }
          },
          tooltip: {
            backgroundColor: '#0a0d16',
            titleColor: '#fff',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (item) => ` ${item.dataset.label}: ₹${item.raw.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'Outfit', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Outfit', size: 11 },
              callback: (val) => '₹' + val
            }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // CHART: Category Donut
  // --------------------------------------------------------------------------
  function renderCategoryChart(categoryMap) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    const labels = Object.keys(categoryMap);
    const dataValues = Object.values(categoryMap);
    const hasData = dataValues.some(v => v > 0);

    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: hasData ? dataValues : [1],
          backgroundColor: hasData
            ? ['#00f0ff', '#0a84ff', '#f59e0b', '#10b981', '#8b5cf6']
            : ['#1e293b'],
          borderWidth: 2,
          borderColor: '#0a0d16'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (item) => hasData ? ` ₹${item.raw.toLocaleString('en-IN')}` : ' No Data'
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  // --------------------------------------------------------------------------
  // CHART: Service Type Horizontal Bar
  // --------------------------------------------------------------------------
  function renderServiceChart(serviceMap) {
    const ctx = document.getElementById('serviceChart');
    if (!ctx) return;

    if (serviceChartInstance) {
      serviceChartInstance.destroy();
    }

    const sortedEntries = Object.entries(serviceMap).sort((a, b) => b[1] - a[1]);
    const labels = sortedEntries.map(e => e[0]);
    const values = sortedEntries.map(e => e[1]);

    serviceChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Revenue (₹)',
          data: values.length ? values : [0],
          backgroundColor: 'rgba(0, 240, 255, 0.65)',
          borderColor: '#00f0ff',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => ` Revenue: ₹${item.raw.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              callback: (v) => '₹' + v
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } }
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // RENDER TABLES
  // --------------------------------------------------------------------------
  function renderRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No pickup orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(ord => {
      const statusClass = 'badge-' + (ord.order_status || 'new').toLowerCase().replace(' ', '-');
      return `
        <tr>
          <td><strong style="font-family: monospace; color: var(--accent-cyan);">${ord.booking_id || '-'}</strong></td>
          <td>
            <div style="font-weight: 600;">${ord.customer_name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${ord.customer_mobile}</div>
          </td>
          <td>${ord.vehicle_category} • ${ord.vehicle_type}</td>
          <td><span class="badge ${statusClass}">${ord.order_status}</span></td>
          <td style="font-weight: 700;">${PCMC_UI.formatINR(ord.final_amount || ord.service_price)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderRecentExpenses(expenses) {
    const tbody = document.getElementById('recentExpensesBody');
    if (!tbody) return;

    if (!expenses || expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No recent expenses recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = expenses.map(exp => `
      <tr>
        <td>${PCMC_UI.formatDisplayDate(exp.expense_date)}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">${exp.category}</span></td>
        <td>${exp.description}</td>
        <td style="font-weight: 700; color: var(--accent-red);">${PCMC_UI.formatINR(exp.amount)}</td>
        <td>${exp.payment_method || 'Cash'}</td>
      </tr>
    `).join('');
  }

  // Initial load
  loadDashboard('thisMonth');
});

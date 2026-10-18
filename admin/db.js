/* ============================================================================
   PCMC Washing Centre - ERP Database Service Layer
   Handles Supabase queries, aggregations, accounting calculations, and fallback demo data
   ============================================================================ */

const PCMC_DB = {
  // Service Catalog Keys matching Excel & business services
  SERVICE_KEYS: [
    { key: 'bike_scooter', label: 'Commuter / Scooter', category: 'Bike', defaultRate: 80 },
    { key: 'bike_sports', label: 'Sports / Bullet', category: 'Bike', defaultRate: 100 },
    { key: 'car_water_wash', label: 'Car — Water Wash (Only Body)', category: 'Car', defaultRate: 130 },
    { key: 'car_only_body', label: 'Car — Body Wash (Foam Wash)', category: 'Car', defaultRate: 230 },
    { key: 'car_full_wash', label: 'Car — Full Wash', category: 'Car', defaultRate: 300 },
    { key: 'car_underbody_full', label: 'Car — Underbody + Full Body', category: 'Car', defaultRate: 350 },
    { key: 'rikshaw_full_wash', label: 'Rikshaw — Full Wash', category: 'Rickshaw', defaultRate: 150 },
    { key: 'tractor_tempo', label: 'Tractor / Tempo Wash', category: 'Tractor', defaultRate: 200 },
    { key: 'miscellaneous', label: 'Miscellaneous', category: 'Other', defaultRate: 0 }
  ],

  EXPENSE_CATEGORIES: [
    'Electricity',
    'Water Supply',
    'Cleaning Chemicals & Foam',
    'Salaries & Labor Wages',
    'Equipment Maintenance & Repairs',
    'Facility Rent',
    'Fuel & Transportation',
    'Tea & Refreshments',
    'Marketing & Printing',
    'Miscellaneous'
  ],

  CAPITAL_TYPES: [
    'Owner Capital',
    'Equipment / Machinery',
    'Infrastructure & Civil',
    'Business Loan / Debt',
    'Other Investment'
  ],

  ORDER_STATUSES: [
    'New',
    'Confirmed',
    'Picked Up',
    'Washing',
    'Ready',
    'Delivered',
    'Completed',
    'Cancelled'
  ],

  // Check if live Supabase is active
  isLive() {
    return window.PCMC_SUPABASE && window.PCMC_SUPABASE.isReady();
  },

  getClient() {
    return window.PCMC_SUPABASE ? window.PCMC_SUPABASE.client : null;
  },

  // Helper to format ISO date YYYY-MM-DD
  formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  },

  // Helper to get day of week string
  getDayOfWeek(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  },

  // --------------------------------------------------------------------------
  // DATE RANGE HELPER
  // --------------------------------------------------------------------------
  getDateRange(filterType, customStart = null, customEnd = null) {
    const today = new Date();
    const todayStr = this.formatDate(today);

    let start = todayStr;
    let end = todayStr;

    switch (filterType) {
      case 'today':
        start = todayStr;
        end = todayStr;
        break;
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        start = this.formatDate(y);
        end = start;
        break;
      }
      case 'last7': {
        const d7 = new Date(today);
        d7.setDate(d7.getDate() - 6);
        start = this.formatDate(d7);
        end = todayStr;
        break;
      }
      case 'thisMonth': {
        const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
        start = this.formatDate(mStart);
        end = todayStr;
        break;
      }
      case 'prevMonth': {
        const pStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const pEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        start = this.formatDate(pStart);
        end = this.formatDate(pEnd);
        break;
      }
      case 'custom':
        start = customStart || todayStr;
        end = customEnd || todayStr;
        break;
      case 'all':
        start = '2020-01-01';
        end = '2099-12-31';
        break;
      default:
        start = todayStr;
        end = todayStr;
    }

    return { startDate: start, endDate: end };
  },

  // --------------------------------------------------------------------------
  // DAILY RECORDS & INCOME ENTRIES
  // --------------------------------------------------------------------------
  async getDailyRecords(startDate, endDate) {
    if (this.isLive()) {
      const client = this.getClient();
      // Fetch daily records
      let query = client
        .from('daily_records')
        .select(`
          *,
          daily_income_entries (*)
        `)
        .order('record_date', { ascending: false });

      if (startDate) query = query.gte('record_date', startDate);
      if (endDate) query = query.lte('record_date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else {
      // Mock Demo Data
      return this._mockGetDailyRecords(startDate, endDate);
    }
  },

  async getDailyRecordByDate(dateStr) {
    if (this.isLive()) {
      const client = this.getClient();
      const { data, error } = await client
        .from('daily_records')
        .select(`
          *,
          daily_income_entries (*)
        `)
        .eq('record_date', dateStr)
        .maybeSingle();

      if (error) throw error;
      return data;
    } else {
      const records = this._mockGetDailyRecords(dateStr, dateStr);
      return records.length ? records[0] : null;
    }
  },

  async saveDailyRecordWithEntries(recordDate, notes, serviceEntries) {
    const dayOfWeek = this.getDayOfWeek(recordDate);

    if (this.isLive()) {
      const client = this.getClient();

      // 1. Upsert daily_record
      const { data: record, error: recordErr } = await client
        .from('daily_records')
        .upsert(
          { record_date: recordDate, day_of_week: dayOfWeek, notes: notes || '' },
          { onConflict: 'record_date' }
        )
        .select()
        .single();

      if (recordErr) throw recordErr;

      // 2. Prepare entries
      const entriesToInsert = serviceEntries.map(e => ({
        record_date: recordDate,
        service_key: e.service_key,
        quantity: parseInt(e.quantity, 10) || 0,
        unit_price: parseFloat(e.unit_price) || 0,
        amount: parseFloat(e.amount) || 0,
        payment_method: e.payment_method || 'Cash',
        notes: e.notes || ''
      }));

      // Delete existing entries for this date to avoid duplicate conflicts
      await client.from('daily_income_entries').delete().eq('record_date', recordDate);

      // Insert fresh entries
      if (entriesToInsert.length > 0) {
        const { error: entriesErr } = await client
          .from('daily_income_entries')
          .insert(entriesToInsert);
        if (entriesErr) throw entriesErr;
      }

      return record;
    } else {
      return this._mockSaveDailyRecord(recordDate, dayOfWeek, notes, serviceEntries);
    }
  },

  async deleteDailyRecord(recordDate) {
    if (this.isLive()) {
      const client = this.getClient();
      const { error } = await client
        .from('daily_records')
        .delete()
        .eq('record_date', recordDate);
      if (error) throw error;
      return true;
    } else {
      return this._mockDeleteDailyRecord(recordDate);
    }
  },

  // --------------------------------------------------------------------------
  // EXPENSES
  // --------------------------------------------------------------------------
  async getExpenses(startDate, endDate, category = null) {
    if (this.isLive()) {
      const client = this.getClient();
      let query = client
        .from('expense_transactions')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('expense_date', startDate);
      if (endDate) query = query.lte('expense_date', endDate);
      if (category && category !== 'all') query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else {
      return this._mockGetExpenses(startDate, endDate, category);
    }
  },

  async saveExpense(expenseData) {
    if (this.isLive()) {
      const client = this.getClient();
      if (expenseData.id) {
        // Update
        const { data, error } = await client
          .from('expense_transactions')
          .update(expenseData)
          .eq('id', expenseData.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await client
          .from('expense_transactions')
          .insert(expenseData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    } else {
      return this._mockSaveExpense(expenseData);
    }
  },

  async deleteExpense(id) {
    if (this.isLive()) {
      const client = this.getClient();
      const { error } = await client
        .from('expense_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } else {
      return this._mockDeleteExpense(id);
    }
  },

  // --------------------------------------------------------------------------
  // CAPITAL & INVESTMENTS
  // --------------------------------------------------------------------------
  async getCapitalTransactions(startDate, endDate, type = null) {
    if (this.isLive()) {
      const client = this.getClient();
      let query = client
        .from('capital_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('transaction_date', startDate);
      if (endDate) query = query.lte('transaction_date', endDate);
      if (type && type !== 'all') query = query.eq('investment_type', type);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else {
      return this._mockGetCapitalTransactions(startDate, endDate, type);
    }
  },

  async saveCapitalTransaction(capitalData) {
    if (this.isLive()) {
      const client = this.getClient();
      if (capitalData.id) {
        const { data, error } = await client
          .from('capital_transactions')
          .update(capitalData)
          .eq('id', capitalData.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await client
          .from('capital_transactions')
          .insert(capitalData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    } else {
      return this._mockSaveCapitalTransaction(capitalData);
    }
  },

  async deleteCapitalTransaction(id) {
    if (this.isLive()) {
      const client = this.getClient();
      const { error } = await client
        .from('capital_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } else {
      return this._mockDeleteCapitalTransaction(id);
    }
  },

  // --------------------------------------------------------------------------
  // PICKUP & DROP ORDERS
  // --------------------------------------------------------------------------
  async getPickupOrders(startDate = null, endDate = null, status = null) {
    if (this.isLive()) {
      const client = this.getClient();
      let query = client
        .from('pickup_drop_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('pickup_date', startDate);
      if (endDate) query = query.lte('pickup_date', endDate);
      if (status && status !== 'all') query = query.eq('order_status', status);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else {
      return this._mockGetPickupOrders(startDate, endDate, status);
    }
  },

  async savePickupOrder(orderData) {
    if (this.isLive()) {
      const client = this.getClient();
      if (orderData.id) {
        const { data, error } = await client
          .from('pickup_drop_orders')
          .update(orderData)
          .eq('id', orderData.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await client
          .from('pickup_drop_orders')
          .insert(orderData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    } else {
      return this._mockSavePickupOrder(orderData);
    }
  },

  async updateOrderStatus(orderId, newStatus, paymentStatus = null, finalAmount = null, adminNotes = null) {
    const updatePayload = { order_status: newStatus };
    if (paymentStatus) updatePayload.payment_status = paymentStatus;
    if (finalAmount !== null) updatePayload.final_amount = parseFloat(finalAmount) || 0;
    if (adminNotes !== null) updatePayload.admin_notes = adminNotes;

    if (this.isLive()) {
      const client = this.getClient();
      const { data, error } = await client
        .from('pickup_drop_orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      return this._mockUpdateOrderStatus(orderId, updatePayload);
    }
  },

  // --------------------------------------------------------------------------
  // FINANCIAL CALCULATIONS & AGGREGATIONS
  // Calculates all metrics based on actual database records
  // --------------------------------------------------------------------------
  async getDashboardSummary(filterType, customStart = null, customEnd = null) {
    const { startDate, endDate } = this.getDateRange(filterType, customStart, customEnd);
    const todayStr = this.formatDate(new Date());

    // 1. Fetch records in range
    const [dailyRecords, expenses, capitalList, allOrders] = await Promise.all([
      this.getDailyRecords(startDate, endDate),
      this.getExpenses(startDate, endDate),
      this.getCapitalTransactions(startDate, endDate),
      this.getPickupOrders(null, null) // get all to check pending
    ]);

    // Calculate revenue & vehicles serviced
    let totalRevenue = 0;
    let vehiclesServiced = 0;
    const revenueByCategory = { Bike: 0, Car: 0, Rickshaw: 0, Tractor: 0, Other: 0 };
    const revenueByService = {};
    const dailyTrendMap = {};

    dailyRecords.forEach(rec => {
      let dayTotal = 0;
      let dayVehicles = 0;
      if (rec.daily_income_entries) {
        rec.daily_income_entries.forEach(entry => {
          const amt = parseFloat(entry.amount) || 0;
          const qty = parseInt(entry.quantity, 10) || (amt > 0 ? 1 : 0);
          totalRevenue += amt;
          dayTotal += amt;
          vehiclesServiced += qty;
          dayVehicles += qty;

          // Categorize
          const svcDef = PCMC_DB.SERVICE_KEYS.find(s => s.key === entry.service_key);
          const cat = svcDef ? svcDef.category : 'Other';
          revenueByCategory[cat] = (revenueByCategory[cat] || 0) + amt;

          const svcName = svcDef ? svcDef.label : entry.service_key;
          revenueByService[svcName] = (revenueByService[svcName] || 0) + amt;
        });
      }
      dailyTrendMap[rec.record_date] = {
        date: rec.record_date,
        dayOfWeek: rec.day_of_week,
        revenue: dayTotal,
        expenses: 0,
        vehicles: dayVehicles
      };
    });

    // Calculate expenses
    let totalExpenses = 0;
    const expensesByCategory = {};
    expenses.forEach(exp => {
      const amt = parseFloat(exp.amount) || 0;
      totalExpenses += amt;
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + amt;

      if (!dailyTrendMap[exp.expense_date]) {
        dailyTrendMap[exp.expense_date] = {
          date: exp.expense_date,
          dayOfWeek: PCMC_DB.getDayOfWeek(exp.expense_date),
          revenue: 0,
          expenses: 0,
          vehicles: 0
        };
      }
      dailyTrendMap[exp.expense_date].expenses += amt;
    });

    // Calculate Capital & Investments
    let totalCapital = 0;
    capitalList.forEach(cap => {
      totalCapital += parseFloat(cap.amount) || 0;
    });

    // Calculate Pending Orders
    const pendingOrdersCount = allOrders.filter(o =>
      !['Completed', 'Cancelled'].includes(o.order_status)
    ).length;

    // Operating Profit
    const operatingProfit = totalRevenue - totalExpenses;

    // Today's specific figures
    const todayRecord = dailyRecords.find(r => r.record_date === todayStr);
    let todayIncome = 0;
    let todayVehicles = 0;
    if (todayRecord && todayRecord.daily_income_entries) {
      todayRecord.daily_income_entries.forEach(e => {
        todayIncome += parseFloat(e.amount) || 0;
        todayVehicles += parseInt(e.quantity, 10) || (e.amount > 0 ? 1 : 0);
      });
    }

    const todayExpensesList = expenses.filter(e => e.expense_date === todayStr);
    const todayExpenses = todayExpensesList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const todayProfit = todayIncome - todayExpenses;

    // Daily sorted trend array
    const dailyTrend = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      dateRange: { startDate, endDate },
      today: {
        income: todayIncome,
        expenses: todayExpenses,
        profit: todayProfit,
        vehicles: todayVehicles
      },
      rangeTotal: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        operatingProfit: operatingProfit,
        capitalInvested: totalCapital,
        vehiclesServiced: vehiclesServiced,
        pendingOrders: pendingOrdersCount
      },
      breakdowns: {
        byCategory: revenueByCategory,
        byService: revenueByService,
        expensesByCategory: expensesByCategory
      },
      dailyTrend,
      recentExpenses: expenses.slice(0, 5),
      recentOrders: allOrders.slice(0, 5)
    };
  },

  // --------------------------------------------------------------------------
  // MOCK DEMO DATA STORE (Used when Supabase is not yet configured)
  // --------------------------------------------------------------------------
  _mockGetDailyRecords(startDate, endDate) {
    const raw = localStorage.getItem('pcmc_mock_daily_records');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockDaily();
    if (startDate) list = list.filter(r => r.record_date >= startDate);
    if (endDate) list = list.filter(r => r.record_date <= endDate);
    return list.sort((a, b) => b.record_date.localeCompare(a.record_date));
  },

  _mockSaveDailyRecord(recordDate, dayOfWeek, notes, entries) {
    const raw = localStorage.getItem('pcmc_mock_daily_records');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockDaily();

    const formattedEntries = entries.map(e => ({
      id: 'mock-entry-' + Math.random().toString(36).substr(2, 9),
      record_date: recordDate,
      service_key: e.service_key,
      quantity: parseInt(e.quantity, 10) || 0,
      unit_price: parseFloat(e.unit_price) || 0,
      amount: parseFloat(e.amount) || 0,
      payment_method: e.payment_method || 'Cash',
      notes: e.notes || ''
    }));

    const existingIndex = list.findIndex(r => r.record_date === recordDate);
    const recordObj = {
      id: existingIndex >= 0 ? list[existingIndex].id : 'mock-rec-' + Date.now(),
      record_date: recordDate,
      day_of_week: dayOfWeek,
      notes: notes || '',
      daily_income_entries: formattedEntries,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      list[existingIndex] = recordObj;
    } else {
      list.push(recordObj);
    }

    localStorage.setItem('pcmc_mock_daily_records', JSON.stringify(list));
    return recordObj;
  },

  _mockDeleteDailyRecord(recordDate) {
    const raw = localStorage.getItem('pcmc_mock_daily_records');
    if (!raw) return true;
    let list = JSON.parse(raw);
    list = list.filter(r => r.record_date !== recordDate);
    localStorage.setItem('pcmc_mock_daily_records', JSON.stringify(list));
    return true;
  },

  _mockGetExpenses(startDate, endDate, category) {
    const raw = localStorage.getItem('pcmc_mock_expenses');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockExpenses();
    if (startDate) list = list.filter(e => e.expense_date >= startDate);
    if (endDate) list = list.filter(e => e.expense_date <= endDate);
    if (category && category !== 'all') list = list.filter(e => e.category === category);
    return list.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
  },

  _mockSaveExpense(expenseData) {
    const raw = localStorage.getItem('pcmc_mock_expenses');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockExpenses();

    if (expenseData.id) {
      const idx = list.findIndex(e => e.id === expenseData.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...expenseData, updated_at: new Date().toISOString() };
    } else {
      const newExp = {
        ...expenseData,
        id: 'mock-exp-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      list.unshift(newExp);
    }

    localStorage.setItem('pcmc_mock_expenses', JSON.stringify(list));
    return expenseData;
  },

  _mockDeleteExpense(id) {
    const raw = localStorage.getItem('pcmc_mock_expenses');
    if (!raw) return true;
    let list = JSON.parse(raw);
    list = list.filter(e => e.id !== id);
    localStorage.setItem('pcmc_mock_expenses', JSON.stringify(list));
    return true;
  },

  _mockGetCapitalTransactions(startDate, endDate, type) {
    const raw = localStorage.getItem('pcmc_mock_capital');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockCapital();
    if (startDate) list = list.filter(c => c.transaction_date >= startDate);
    if (endDate) list = list.filter(c => c.transaction_date <= endDate);
    if (type && type !== 'all') list = list.filter(c => c.investment_type === type);
    return list.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  },

  _mockSaveCapitalTransaction(capitalData) {
    const raw = localStorage.getItem('pcmc_mock_capital');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockCapital();

    if (capitalData.id) {
      const idx = list.findIndex(c => c.id === capitalData.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...capitalData, updated_at: new Date().toISOString() };
    } else {
      const newCap = {
        ...capitalData,
        id: 'mock-cap-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      list.unshift(newCap);
    }

    localStorage.setItem('pcmc_mock_capital', JSON.stringify(list));
    return capitalData;
  },

  _mockDeleteCapitalTransaction(id) {
    const raw = localStorage.getItem('pcmc_mock_capital');
    if (!raw) return true;
    let list = JSON.parse(raw);
    list = list.filter(c => c.id !== id);
    localStorage.setItem('pcmc_mock_capital', JSON.stringify(list));
    return true;
  },

  _mockGetPickupOrders(startDate, endDate, status) {
    const raw = localStorage.getItem('pcmc_mock_orders');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockOrders();
    if (startDate) list = list.filter(o => o.pickup_date >= startDate);
    if (endDate) list = list.filter(o => o.pickup_date <= endDate);
    if (status && status !== 'all') list = list.filter(o => o.order_status === status);
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  _mockSavePickupOrder(orderData) {
    const raw = localStorage.getItem('pcmc_mock_orders');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockOrders();

    if (orderData.id) {
      const idx = list.findIndex(o => o.id === orderData.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...orderData, updated_at: new Date().toISOString() };
    } else {
      const newOrder = {
        ...orderData,
        id: 'mock-ord-' + Date.now(),
        booking_id: orderData.booking_id || 'PCMC-' + Math.floor(100000 + Math.random() * 900000),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      list.unshift(newOrder);
    }

    localStorage.setItem('pcmc_mock_orders', JSON.stringify(list));
    return orderData;
  },

  _mockUpdateOrderStatus(orderId, updatePayload) {
    const raw = localStorage.getItem('pcmc_mock_orders');
    let list = raw ? JSON.parse(raw) : this._generateDefaultMockOrders();
    const idx = list.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatePayload, updated_at: new Date().toISOString() };
      localStorage.setItem('pcmc_mock_orders', JSON.stringify(list));
      return list[idx];
    }
    return null;
  },

  // Seed realistic mock data reflecting PCMC Washing Centre operations for smooth preview
  _generateDefaultMockDaily() {
    const records = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const dayOfWeek = this.getDayOfWeek(dateStr);

      const entries = [
        { service_key: 'bike_scooter', quantity: 6 + (i % 4), unit_price: 80, amount: (6 + (i % 4)) * 80 },
        { service_key: 'bike_sports', quantity: 4 + (i % 3), unit_price: 100, amount: (4 + (i % 3)) * 100 },
        { service_key: 'car_water_wash', quantity: 2 + (i % 2), unit_price: 130, amount: (2 + (i % 2)) * 130 },
        { service_key: 'car_only_body', quantity: 3 + (i % 3), unit_price: 230, amount: (3 + (i % 3)) * 230 },
        { service_key: 'car_full_wash', quantity: 5 + (i % 4), unit_price: 300, amount: (5 + (i % 4)) * 300 },
        { service_key: 'car_underbody_full', quantity: 2 + (i % 3), unit_price: 350, amount: (2 + (i % 3)) * 350 },
        { service_key: 'rikshaw_full_wash', quantity: 2 + (i % 2), unit_price: 150, amount: (2 + (i % 2)) * 150 },
        { service_key: 'tractor_tempo', quantity: (i % 3 === 0 ? 1 : 0), unit_price: 200, amount: (i % 3 === 0 ? 200 : 0) },
        { service_key: 'miscellaneous', quantity: 1, unit_price: 150, amount: 150 }
      ];

      records.push({
        id: 'mock-rec-' + i,
        record_date: dateStr,
        day_of_week: dayOfWeek,
        notes: i === 0 ? 'Busy weekend shift, great foam wash demand' : '',
        daily_income_entries: entries
      });
    }

    localStorage.setItem('pcmc_mock_daily_records', JSON.stringify(records));
    return records;
  },

  _generateDefaultMockExpenses() {
    const todayStr = this.formatDate(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.formatDate(yesterday);

    const expenses = [
      { id: 'exp-1', expense_date: todayStr, category: 'Cleaning Chemicals & Foam', description: 'WaveX Snow Foam Shampoo 5L Can', amount: 1450, payment_method: 'UPI', notes: 'Supplier delivery' },
      { id: 'exp-2', expense_date: todayStr, category: 'Tea & Refreshments', description: 'Staff evening tea and biscuits', amount: 120, payment_method: 'Cash', notes: '' },
      { id: 'exp-3', expense_date: yesterdayStr, category: 'Equipment Maintenance & Repairs', description: 'Pressure washer hose brass connector replacement', amount: 650, payment_method: 'Cash', notes: 'Local hardware store' },
      { id: 'exp-4', expense_date: yesterdayStr, category: 'Electricity', description: 'MSEDCL Washing Center Commercial Power Bill', amount: 4820, payment_method: 'UPI', notes: 'Bill paid online' },
      { id: 'exp-5', expense_date: this.formatDate(new Date(Date.now() - 4 * 86400000)), category: 'Salaries & Labor Wages', description: 'Advance payment to lead washer technician', amount: 3000, payment_method: 'Bank Transfer', notes: 'Weekly advance' }
    ];

    localStorage.setItem('pcmc_mock_expenses', JSON.stringify(expenses));
    return expenses;
  },

  _generateDefaultMockCapital() {
    const capital = [
      { id: 'cap-1', transaction_date: '2026-09-15', investment_type: 'Owner Capital', purpose: 'Initial Working Capital & Cash Reserve', amount: 50000, payment_method: 'Bank Transfer', notes: 'Owner injection' },
      { id: 'cap-2', transaction_date: '2026-09-20', investment_type: 'Equipment / Machinery', purpose: 'Industrial High Pressure Triple Ceramic Piston Pump (180 Bar)', amount: 42000, payment_method: 'Bank Transfer', notes: '3-phase motor included' },
      { id: 'cap-3', transaction_date: '2026-10-02', investment_type: 'Infrastructure & Civil', purpose: 'Ramp fabrication and water recycling drainage grid', amount: 18500, payment_method: 'Cheque', notes: 'Welding and cement' }
    ];

    localStorage.setItem('pcmc_mock_capital', JSON.stringify(capital));
    return capital;
  },

  _generateDefaultMockOrders() {
    const todayStr = this.formatDate(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = this.formatDate(tomorrow);

    const orders = [
      {
        id: 'ord-101',
        booking_id: 'PCMC-20261018-4921',
        customer_name: 'Amit Deshmukh',
        customer_mobile: '9822014589',
        customer_whatsapp: '9822014589',
        vehicle_category: 'Car',
        vehicle_type: 'Hatchback',
        vehicle_model: 'Tata Altroz',
        vehicle_reg_number: 'MH 14 HU 8821',
        service_name: 'Full Wash',
        service_price: 300,
        pickup_address: 'Flat 402, Ganga Kingston, Ravet',
        pickup_landmark: 'Near D-Mart Ravet',
        drop_address: 'Flat 402, Ganga Kingston, Ravet',
        pickup_date: todayStr,
        pickup_time_slot: '10:00 AM - 12:00 PM',
        customer_notes: 'Please clean underbody carefully after monsoon drive.',
        order_status: 'Washing',
        payment_status: 'Paid',
        final_amount: 350,
        payment_method: 'UPI',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'ord-102',
        booking_id: 'PCMC-20261018-7712',
        customer_name: 'Pooja Kulkarni',
        customer_mobile: '9850112233',
        customer_whatsapp: '9850112233',
        vehicle_category: 'Bike',
        vehicle_type: 'Scooty / Commuter',
        vehicle_model: 'Honda Activa 6G',
        vehicle_reg_number: 'MH 14 JP 3012',
        service_name: 'Foam Wash',
        service_price: 80,
        pickup_address: 'B-6, Swapna Nagari, Ravet',
        pickup_landmark: 'Opposite Shinde Petrol Pump',
        drop_address: 'B-6, Swapna Nagari, Ravet',
        pickup_date: todayStr,
        pickup_time_slot: '02:00 PM - 04:00 PM',
        customer_notes: 'Call 10 mins before reaching.',
        order_status: 'Confirmed',
        payment_status: 'Unpaid',
        final_amount: 80,
        payment_method: 'Pending',
        created_at: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 'ord-103',
        booking_id: 'PCMC-20261018-9104',
        customer_name: 'Vikram Salunkhe',
        customer_mobile: '9765443322',
        customer_whatsapp: '9765443322',
        vehicle_category: 'Car',
        vehicle_type: 'MPV / SUV (7 Seater)',
        vehicle_model: 'Mahindra XUV700',
        vehicle_reg_number: 'MH 12 TS 9900',
        service_name: 'Full Wash',
        service_price: 400,
        pickup_address: 'Row House 14, Silver Crest, Kiwale',
        pickup_landmark: 'Near Mukai Chowk',
        drop_address: 'Row House 14, Silver Crest, Kiwale',
        pickup_date: tomorrowStr,
        pickup_time_slot: '08:00 AM - 10:00 AM',
        customer_notes: 'Interior deep vacuum needed.',
        order_status: 'New',
        payment_status: 'Unpaid',
        final_amount: 450,
        payment_method: 'Pending',
        created_at: new Date(Date.now() - 10800000).toISOString()
      }
    ];

    localStorage.setItem('pcmc_mock_orders', JSON.stringify(orders));
    return orders;
  }
};

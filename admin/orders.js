/* ============================================================================
   PCMC Washing Centre - Pickup & Drop Orders Controller
   Pipeline tracking, status transitions, payment recording, and WhatsApp chat handoff
   ============================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Auth Guard
  await PCMC_AUTH.requireAuth();

  // 2. DOM Elements
  const statusPills = document.querySelectorAll('.status-pill');
  const searchInput = document.getElementById('orderSearchInput');
  const paymentFilter = document.getElementById('paymentFilterSelect');
  const tbody = document.getElementById('ordersTbody');
  const summaryLabel = document.getElementById('ordersSummaryLabel');
  const btnExport = document.getElementById('btnExportOrders');

  // Modal Elements
  const orderModal = document.getElementById('orderManageModal');
  const btnCloseModal = document.getElementById('btnCloseOrderModal');
  const btnCancel = document.getElementById('btnCancelOrder');
  const btnSave = document.getElementById('btnSaveOrder');
  const btnModalWA = document.getElementById('btnModalChatWA');

  const manageOrderId = document.getElementById('manageOrderId');
  const modalCustName = document.getElementById('modalCustName');
  const modalCustPhone = document.getElementById('modalCustPhone');
  const modalVehicle = document.getElementById('modalVehicle');
  const modalStatusBadge = document.getElementById('modalStatusBadge');
  const modalBookingId = document.getElementById('modalBookingId');
  const modalPickupAddress = document.getElementById('modalPickupAddress');
  const modalPickupLandmark = document.getElementById('modalPickupLandmark');
  const modalMapsLinkContainer = document.getElementById('modalMapsLinkContainer');
  const modalDropAddress = document.getElementById('modalDropAddress');
  const modalScheduleTime = document.getElementById('modalScheduleTime');
  const modalCustNotes = document.getElementById('modalCustNotes');

  const formStatus = document.getElementById('formOrderStatus');
  const formPayment = document.getElementById('formPaymentStatus');
  const formAmount = document.getElementById('formFinalAmount');
  const formPayMethod = document.getElementById('formOrderPayMethod');
  const formAdminNotes = document.getElementById('formAdminNotes');

  // State
  let allOrders = [];
  let activeStatus = 'all';

  // Status Pill Click
  statusPills.forEach(pill => {
    pill.addEventListener('click', () => {
      statusPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeStatus = pill.dataset.status;
      renderTable();
    });
  });

  // Filter handlers
  searchInput.addEventListener('input', renderTable);
  paymentFilter.addEventListener('change', renderTable);

  // --------------------------------------------------------------------------
  // LOAD ORDERS
  // --------------------------------------------------------------------------
  async function loadOrders() {
    tbody.innerHTML = '<tr><td colspan="8" style="padding: 2.5rem; text-align: center; color: var(--text-muted);"><i data-lucide="loader" class="spin"></i> Loading pickup orders...</td></tr>';
    if (window.lucide) window.lucide.createIcons();

    try {
      allOrders = await PCMC_DB.getPickupOrders(null, null, null);
      updateStatusCounts();
      renderTable();
    } catch (err) {
      console.error('Error loading orders:', err);
      tbody.innerHTML = `<tr><td colspan="8" style="padding: 2rem; text-align: center; color: var(--accent-red);">Failed to load orders: ${err.message}</td></tr>`;
      PCMC_UI.toast('Failed to load orders: ' + err.message, 'error');
    }
  }

  // Update Status Pill Badges & Nav Badge
  function updateStatusCounts() {
    const counts = { all: allOrders.length };
    PCMC_DB.ORDER_STATUSES.forEach(st => {
      counts[st] = 0;
    });

    allOrders.forEach(o => {
      if (counts[o.order_status] !== undefined) {
        counts[o.order_status]++;
      }
    });

    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-New').textContent = counts['New'] || 0;
    document.getElementById('count-Confirmed').textContent = counts['Confirmed'] || 0;
    document.getElementById('count-Picked-Up').textContent = counts['Picked Up'] || 0;
    document.getElementById('count-Washing').textContent = counts['Washing'] || 0;
    document.getElementById('count-Ready').textContent = counts['Ready'] || 0;
    document.getElementById('count-Delivered').textContent = counts['Delivered'] || 0;
    document.getElementById('count-Completed').textContent = counts['Completed'] || 0;
    document.getElementById('count-Cancelled').textContent = counts['Cancelled'] || 0;

    // Sidebar pending badge
    const pendingCount = allOrders.filter(o => !['Completed', 'Cancelled'].includes(o.order_status)).length;
    const navBadge = document.getElementById('nav-pending-badge');
    if (navBadge) {
      if (pendingCount > 0) {
        navBadge.textContent = pendingCount;
        navBadge.style.display = 'inline-block';
      } else {
        navBadge.style.display = 'none';
      }
    }
  }

  // --------------------------------------------------------------------------
  // RENDER TABLE
  // --------------------------------------------------------------------------
  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const payStatus = paymentFilter.value;

    let filtered = allOrders;

    // Filter by status pill
    if (activeStatus !== 'all') {
      filtered = filtered.filter(o => o.order_status === activeStatus);
    }

    // Filter by payment status
    if (payStatus !== 'all') {
      filtered = filtered.filter(o => o.payment_status === payStatus);
    }

    // Search filter
    if (search) {
      filtered = filtered.filter(o => 
        (o.booking_id && o.booking_id.toLowerCase().includes(search)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
        (o.customer_mobile && o.customer_mobile.includes(search)) ||
        (o.vehicle_reg_number && o.vehicle_reg_number.toLowerCase().includes(search)) ||
        (o.vehicle_model && o.vehicle_model.toLowerCase().includes(search)) ||
        (o.pickup_address && o.pickup_address.toLowerCase().includes(search)) ||
        (o.service_name && o.service_name.toLowerCase().includes(search))
      );
    }

    if (summaryLabel) {
      summaryLabel.textContent = `Showing ${filtered.length} of ${allOrders.length} orders`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">No orders match the current filter criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(ord => {
      const statusClass = 'badge-' + (ord.order_status || 'new').toLowerCase().replace(' ', '-');
      const payClass = ord.payment_status === 'Paid' ? 'badge-paid' : 'badge-unpaid';
      const cleanPhone = (ord.customer_mobile || '').replace(/\D/g, '');

      return `
        <tr>
          <td>
            <div style="font-family: monospace; font-weight: 700; color: var(--accent-cyan);">${ord.booking_id}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN') : '-'}</div>
          </td>

          <td>
            <div style="font-weight: 600;">${ord.customer_name}</div>
            <div style="font-size: 0.8rem; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
              <span style="color: var(--text-secondary);">${ord.customer_mobile}</span>
              <a href="https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(ord.customer_name)}%2C%20regarding%20your%20PCMC%20Washing%20Centre%20booking%20${ord.booking_id}..." target="_blank" class="btn-icon" style="width: 22px; height: 22px; color: var(--whatsapp-green);" title="Chat on WhatsApp">
                <i data-lucide="message-circle" style="width: 13px; height: 13px;"></i>
              </a>
            </div>
          </td>

          <td>
            <div style="font-weight: 600;">${ord.vehicle_category} • ${ord.vehicle_type}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${ord.vehicle_model || ''} ${ord.vehicle_reg_number ? `(${ord.vehicle_reg_number})` : ''}</div>
          </td>

          <td>
            <div style="font-weight: 600;">${ord.service_name}</div>
            <div style="font-size: 0.82rem; color: var(--accent-cyan); font-weight: 700;">Listed: ${PCMC_UI.formatINR(ord.service_price)}</div>
          </td>

          <td>
            <div style="font-size: 0.82rem; font-weight: 600;">${PCMC_UI.formatDisplayDate(ord.pickup_date)}</div>
            <div style="font-size: 0.75rem; color: var(--accent-yellow);">${ord.pickup_time_slot}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ord.pickup_address}">
              ${ord.pickup_address}
            </div>
          </td>

          <td>
            <span class="badge ${statusClass}">${ord.order_status}</span>
          </td>

          <td>
            <span class="badge ${payClass}">${ord.payment_status}</span>
            <div style="font-size: 0.82rem; font-weight: 700; margin-top: 2px;">${PCMC_UI.formatINR(ord.final_amount || ord.service_price)}</div>
          </td>

          <td style="text-align: center;">
            <button class="btn btn-secondary btn-xs btn-manage-order" data-id="${ord.id}">
              <i data-lucide="sliders"></i> Manage
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind Manage Buttons
    document.querySelectorAll('.btn-manage-order').forEach(btn => {
      btn.addEventListener('click', () => openManageModal(btn.dataset.id));
    });
  }

  // --------------------------------------------------------------------------
  // MODAL: ORDER FULFILLMENT MANAGEMENT
  // --------------------------------------------------------------------------
  let currentActiveOrder = null;

  function openManageModal(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    currentActiveOrder = order;
    manageOrderId.value = order.id;

    modalCustName.textContent = order.customer_name;
    modalCustPhone.textContent = order.customer_mobile;
    modalVehicle.textContent = `${order.vehicle_category} • ${order.vehicle_type} (${order.vehicle_model || 'Standard'} — ${order.vehicle_reg_number || 'No Reg'})`;
    modalBookingId.textContent = `ID: ${order.booking_id}`;

    const statusClass = 'badge-' + (order.order_status || 'new').toLowerCase().replace(' ', '-');
    modalStatusBadge.className = `badge ${statusClass}`;
    modalStatusBadge.textContent = order.order_status;

    modalPickupAddress.textContent = order.pickup_address;
    modalPickupLandmark.textContent = order.pickup_landmark ? `Area: ${order.pickup_landmark}` : '';

    if (order.pickup_maps_link && order.pickup_maps_link.startsWith('http')) {
      modalMapsLinkContainer.innerHTML = `<a href="${order.pickup_maps_link}" target="_blank" class="btn btn-secondary btn-xs" style="padding: 2px 6px; font-size: 0.7rem;"><i data-lucide="navigation-2" style="width: 11px; height: 11px;"></i> Open Map Link</a>`;
    } else {
      modalMapsLinkContainer.innerHTML = '';
    }

    modalDropAddress.textContent = order.drop_address;
    modalScheduleTime.textContent = `${PCMC_UI.formatDisplayDate(order.pickup_date)} • ${order.pickup_time_slot}`;
    modalCustNotes.textContent = order.customer_notes || 'No specific instructions provided.';

    // Populate Form Controls
    formStatus.value = order.order_status || 'New';
    formPayment.value = order.payment_status || 'Unpaid';
    formAmount.value = order.final_amount !== undefined && order.final_amount !== null ? order.final_amount : order.service_price;
    formPayMethod.value = order.payment_method || 'Pending';
    formAdminNotes.value = order.admin_notes || '';

    // WhatsApp quick chat button in modal
    btnModalWA.onclick = () => {
      const cleanPhone = (order.customer_mobile || '').replace(/\D/g, '');
      const text = `Hello ${order.customer_name}! Updating you regarding your PCMC Washing Centre booking (${order.booking_id}).\n` +
        `Current Status: ${formStatus.value}\n` +
        `Vehicle: ${order.vehicle_category} (${order.vehicle_type})\n` +
        `Final Amount: ₹${formAmount.value}\n\n` +
        `Please let us know if you need anything else. Thank you!`;
      window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    orderModal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }

  const closeModal = () => orderModal.classList.remove('active');
  btnCloseModal.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  orderModal.addEventListener('click', (e) => {
    if (e.target === orderModal) closeModal();
  });

  // Save Order Updates
  btnSave.addEventListener('click', async () => {
    if (!currentActiveOrder) return;

    const newStatus = formStatus.value;
    const newPayment = formPayment.value;
    const finalAmt = parseFloat(formAmount.value) || 0;
    const payMethod = formPayMethod.value;
    const adminNotes = formAdminNotes.value.trim();

    btnSave.disabled = true;
    btnSave.innerHTML = '<i data-lucide="loader" class="spin"></i> Updating...';
    if (window.lucide) window.lucide.createIcons();

    try {
      const updatedPayload = {
        id: currentActiveOrder.id,
        order_status: newStatus,
        payment_status: newPayment,
        final_amount: finalAmt,
        payment_method: payMethod,
        admin_notes: adminNotes || null
      };

      await PCMC_DB.savePickupOrder(updatedPayload);
      PCMC_UI.toast(`Booking ${currentActiveOrder.booking_id} updated successfully!`, 'success');
      closeModal();
      await loadOrders();
    } catch (err) {
      console.error('Error updating order:', err);
      PCMC_UI.toast('Failed to update order: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i data-lucide="check"></i> Save Order Changes';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // --------------------------------------------------------------------------
  // EXPORT ORDERS TO EXCEL
  // --------------------------------------------------------------------------
  btnExport.addEventListener('click', () => {
    if (!allOrders.length) {
      PCMC_UI.toast('No orders available to export.', 'warning');
      return;
    }

    try {
      const exportData = allOrders.map(o => ({
        'Booking ID': o.booking_id,
        'Booking Date': o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '',
        'Customer Name': o.customer_name,
        'Mobile': o.customer_mobile,
        'WhatsApp': o.customer_whatsapp || o.customer_mobile,
        'Vehicle Category': o.vehicle_category,
        'Vehicle Type': o.vehicle_type,
        'Vehicle Model': o.vehicle_model || '',
        'Registration No': o.vehicle_reg_number || '',
        'Service Name': o.service_name,
        'Listed Price (INR)': o.service_price,
        'Final Amount (INR)': o.final_amount || o.service_price,
        'Order Status': o.order_status,
        'Payment Status': o.payment_status,
        'Payment Method': o.payment_method || '',
        'Pickup Date': o.pickup_date,
        'Pickup Time Slot': o.pickup_time_slot,
        'Pickup Address': o.pickup_address,
        'Pickup Landmark': o.pickup_landmark,
        'Drop Address': o.drop_address,
        'Customer Instructions': o.customer_notes || '',
        'Admin Notes': o.admin_notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pickup Orders');
      XLSX.writeFile(wb, `PCMC_Pickup_Orders_${PCMC_DB.formatDate(new Date())}.xlsx`);
      PCMC_UI.toast('Exported orders to Excel.', 'success');
    } catch (err) {
      console.error('Export error:', err);
      PCMC_UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  // Initial load
  loadOrders();
});

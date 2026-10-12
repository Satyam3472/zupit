/**
 * Zupit Desktop Admin Workbench - 1440px
 * Supports: Orders, Order Detail, Create Order, Riders, Cash, Customers, Reports, Settings
 */

(function () {
  'use strict';

  // State Management
  const state = {
    currentScreen: 'orders',
    currentAdmin: null,
    orders: {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 1,
      items: [],
      selectedStatus: ['placed', 'rider_assigned', 'buying', 'out_for_delivery', 'delivered', 'cancelled'],
      selectedRider: 'all',
      search: '',
      startDate: '',
      endDate: '',
      activeOrderId: null,
      orderDetail: null,
      countdown: 15,
      timer: null,
    },
    riders: {
      items: [],
      tab: 'all', // 'all' | 'pending'
      activeRiderId: null,
    },
    cash: {
      riders: [],
      activeRider: null,
      activeLedger: [],
    },
    customers: {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 1,
      items: [],
      search: '',
      activeCustomer: null,
    },
    reports: {
      startDate: '',
      endDate: '',
      kpis: null,
      charts: null,
    },
    settings: {
      data: null,
      templates: [],
      templateLang: 'en',
    },
    blockTarget: null, // { type: 'rider' | 'customer', id: string, name: string }
  };

  /* ========================================================================
     TOAST UTILITY
     ======================================================================== */
  function showToast(message, type = 'success') {
    const shelf = document.getElementById('toast-shelf');
    if (!shelf) return;

    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast-${type}`;
    
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `<span style="font-weight: 700; font-size: 16px;">${icon}</span> <span>${message}</span>`;
    shelf.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  /* ========================================================================
     SCREEN SWITCHING & BREADCRUMBS
     ======================================================================== */
  function setScreen(screenName, subTitle = '') {
    state.currentScreen = screenName;

    // Hide all screens
    document.querySelectorAll('.admin-screen').forEach((el) => {
      el.style.display = 'none';
    });

    // Deactivate all sidebar items
    document.querySelectorAll('.admin-menu-item').forEach((btn) => {
      btn.classList.remove('active');
    });

    const activeNavBtn = document.getElementById(`nav-btn-${screenName}`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    const screenEl = document.getElementById(`screen-${screenName}`);
    if (screenEl) screenEl.style.display = 'block';

    const crumbCurrent = document.getElementById('crumb-current');
    const headerTitle = document.getElementById('header-title');
    const headerActions = document.getElementById('header-actions');

    // Update Header and CTAs per screen
    switch (screenName) {
      case 'orders':
        crumbCurrent.textContent = 'Orders';
        headerTitle.textContent = 'Live Orders Dashboard';
        headerActions.innerHTML = `
          <button type="button" class="btn-primary" id="btn-header-create-order" style="height: 40px; padding: 0 18px; font-size: 13px; width: auto;">
            + Create order
          </button>
        `;
        document.getElementById('btn-header-create-order').addEventListener('click', () => setScreen('create-order'));
        loadOrders();
        break;

      case 'order-detail':
        crumbCurrent.innerHTML = `<a href="#" id="crumb-link-orders">Orders</a> <span>/</span> <span>${subTitle || 'Order Details'}</span>`;
        headerTitle.textContent = subTitle || 'Order Details';
        document.getElementById('crumb-link-orders')?.addEventListener('click', (e) => {
          e.preventDefault();
          setScreen('orders');
        });
        headerActions.innerHTML = `
          <button type="button" class="btn-secondary" id="btn-header-back-orders" style="height: 38px; padding: 0 14px; font-size: 13px;">
            ← Back to Orders
          </button>
        `;
        document.getElementById('btn-header-back-orders').addEventListener('click', () => setScreen('orders'));
        break;

      case 'create-order':
        crumbCurrent.innerHTML = `<a href="#" id="crumb-link-orders-co">Orders</a> <span>/</span> <span>Create Order</span>`;
        headerTitle.textContent = 'Create Manual Order (Phone / WhatsApp)';
        document.getElementById('crumb-link-orders-co')?.addEventListener('click', (e) => {
          e.preventDefault();
          setScreen('orders');
        });
        headerActions.innerHTML = '';
        break;

      case 'riders':
        crumbCurrent.textContent = 'Riders';
        headerTitle.textContent = 'Fleet Riders Management';
        headerActions.innerHTML = `
          <button type="button" class="btn-primary" id="btn-header-add-rider" style="height: 40px; padding: 0 18px; font-size: 13px; width: auto;">
            + Add Rider
          </button>
        `;
        document.getElementById('btn-header-add-rider').addEventListener('click', () => openModal('modal-add-rider'));
        loadRiders();
        break;

      case 'cash':
        crumbCurrent.textContent = 'Cash';
        headerTitle.textContent = 'Per-Rider Cash Balances & Ledger';
        headerActions.innerHTML = `
          <button type="button" class="btn-primary" id="btn-header-add-cash" style="height: 40px; padding: 0 18px; font-size: 13px; width: auto;">
            + Add Cash Entry
          </button>
        `;
        document.getElementById('btn-header-add-cash').addEventListener('click', openAddCashModal);
        loadCash();
        break;

      case 'customers':
        crumbCurrent.textContent = 'Customers';
        headerTitle.textContent = 'Customer Directory & Order History';
        headerActions.innerHTML = '';
        loadCustomers();
        break;

      case 'reports':
        crumbCurrent.textContent = 'Reports';
        headerTitle.textContent = 'Fulfillment Performance & Analytics';
        headerActions.innerHTML = `
          <button type="button" class="btn-primary" id="btn-header-export-csv" style="height: 40px; padding: 0 18px; font-size: 13px; width: auto;">
            Export Orders CSV
          </button>
        `;
        document.getElementById('btn-header-export-csv').addEventListener('click', exportReportsCsv);
        loadReports();
        break;

      case 'settings':
        crumbCurrent.textContent = 'Settings';
        headerTitle.textContent = 'Platform Settings & Message Templates';
        headerActions.innerHTML = '';
        loadSettings();
        loadTemplates();
        break;
    }
  }

  /* ========================================================================
     AUTHENTICATION & RBAC
     ======================================================================== */
  async function initAuth() {
    try {
      const res = await fetch('/api/v1/admin/auth/me');
      if (!res.ok) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!data.success || !data.admin) {
        window.location.href = '/admin/login';
        return;
      }

      state.currentAdmin = data.admin;
      document.getElementById('sidebar-admin-name').textContent = data.admin.name;
      document.getElementById('sidebar-admin-email').textContent = data.admin.email;
      
      const badge = document.getElementById('sidebar-role-badge');
      badge.textContent = data.admin.role.toUpperCase();
      if (data.admin.role === 'owner') {
        badge.style.backgroundColor = '#EEF2FB';
        badge.style.color = '#1D3F8F';
      } else {
        badge.style.backgroundColor = '#FEF3C7';
        badge.style.color = '#92400E';
      }

      // Check role enforcement for OPS:
      // "Roles: owner can do everything, ops cannot edit settings or admins."
      if (data.admin.role === 'ops') {
        applyOpsRestrictions();
      }

    } catch (err) {
      window.location.href = '/admin/login';
    }
  }

  function applyOpsRestrictions() {
    // Show banner on settings
    const roleAlert = document.getElementById('settings-role-alert');
    if (roleAlert) roleAlert.style.display = 'block';

    // Disable settings form fields
    const settingsForm = document.getElementById('form-platform-settings');
    if (settingsForm) {
      const inputs = settingsForm.querySelectorAll('input, select, textarea');
      inputs.forEach((input) => (input.disabled = true));
    }

    const saveBarBtn = document.getElementById('btn-save-settings-bar');
    if (saveBarBtn) {
      saveBarBtn.disabled = true;
      saveBarBtn.title = 'Ops accounts cannot modify settings';
      saveBarBtn.style.opacity = '0.5';
    }

    const statusText = document.getElementById('txt-settings-save-status');
    if (statusText) {
      statusText.textContent = '🔒 Read-only view (Ops accounts cannot edit platform settings).';
      statusText.style.color = '#B45309';
    }
  }

  /* ========================================================================
     SCREEN 1: ORDERS IMPLEMENTATION
     ======================================================================== */
  async function loadOrders() {
    const tbody = document.getElementById('tbody-orders');
    tbody.innerHTML = `<tr><td colspan="9" class="admin-table-state">Loading live orders...</td></tr>`;

    const o = state.orders;
    const params = new URLSearchParams({
      page: String(o.page),
      limit: String(o.limit),
    });

    if (o.selectedStatus.length > 0 && o.selectedStatus.length < 6) {
      params.set('status', o.selectedStatus.join(','));
    }
    if (o.selectedRider !== 'all') {
      params.set('riderId', o.selectedRider);
    }
    if (o.search) {
      params.set('search', o.search);
    }
    if (o.startDate) {
      params.set('startDate', o.startDate);
    }
    if (o.endDate) {
      params.set('endDate', o.endDate);
    }

    try {
      const res = await fetch(`/api/v1/admin/orders?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        tbody.innerHTML = `<tr><td colspan="9" class="admin-table-state" style="color: #DC2626;">Error loading orders: ${data.message || 'Server error'}</td></tr>`;
        return;
      }

      o.items = data.orders || [];
      o.total = data.pagination.total;
      o.totalPages = data.pagination.totalPages;

      // Update badge in sidebar
      const liveBadge = document.getElementById('sidebar-live-orders-badge');
      if (data.statusCounts?.placed > 0) {
        liveBadge.textContent = data.statusCounts.placed;
        liveBadge.style.display = 'inline-flex';
      } else {
        liveBadge.style.display = 'none';
      }

      renderOrdersTable(data.orders, data.acceptTimeoutMinutes);
      renderOrdersPagination(data.pagination);

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="admin-table-state" style="color: #DC2626;">Failed to connect to server. Check network connection.</td></tr>`;
    }
  }

  function renderOrdersTable(orderList, timeoutMins = 5) {
    const tbody = document.getElementById('tbody-orders');
    if (!orderList || orderList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="admin-table-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <div style="font-weight: 600; color: #1E293B;">No matching orders found</div>
            <div style="font-size: 13px;">Try adjusting filters or date range</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = orderList.map((ord) => {
      const dt = new Date(ord.createdAt);
      const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Overdue alert check:
      // "Rows waiting for a rider longer than accept_timeout_minutes get an amber left border."
      const isOverdue = ord.isOverdue;
      const rowClass = isOverdue ? 'row-overdue' : '';

      const statusBadge = getStatusBadge(ord.status, ord.minutesWaiting, isOverdue);
      const riderBadge = ord.assignedRider
        ? `<span style="font-weight: 500; color: #1D3F8F;">${escapeHtml(ord.assignedRider.name)}</span>`
        : `<span class="pill-status pill-offline" style="font-size: 11px;">Unassigned</span>`;

      const totalVal = ord.finalAmount || ord.totalAmount || '0.00';
      const itemsInfo = `${ord.itemsCount} med${ord.prescriptionsCount > 0 ? ` + ${ord.prescriptionsCount} Rx` : ''}`;

      return `
        <tr class="${rowClass}" data-order-id="${ord.id}" style="cursor: pointer;">
          <td>
            <strong style="color: #1D3F8F; font-size: 14px;">${escapeHtml(ord.orderNumber)}</strong>
            ${isOverdue ? `<span title="Waiting for rider longer than ${timeoutMins} minutes!" style="color: #D97706; margin-left: 4px; font-weight: 700;">⚠️</span>` : ''}
          </td>
          <td>
            <div style="font-weight: 500;">${timeStr}</div>
            <div style="font-size: 11px; color: #64748B;">${dateStr}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(ord.deliveryName)}</div>
            <div style="font-size: 12px; color: #64748B;">${escapeHtml(ord.deliveryPhone)}</div>
          </td>
          <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(ord.deliveryAddress)}">
            <div>${escapeHtml(ord.deliveryAddress)}</div>
            ${ord.deliveryLandmark ? `<div style="font-size: 11px; color: #64748B;">${escapeHtml(ord.deliveryLandmark)}</div>` : ''}
          </td>
          <td><span style="font-size: 13px; color: #475569;">${itemsInfo}</span></td>
          <td>${riderBadge}</td>
          <td class="col-num" style="font-weight: 700; color: #0F172A;">₹${parseFloat(totalVal).toFixed(2)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-secondary btn-view-order-row" data-id="${ord.id}" style="height: 30px; padding: 0 10px; font-size: 12px;">
              View →
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row click handlers to open order detail
    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', (e) => {
        const id = row.getAttribute('data-order-id');
        if (id) openOrderDetail(id);
      });
    });
  }

  function getStatusBadge(status, minutesWaiting = 0, isOverdue = false) {
    switch (status) {
      case 'placed':
        if (isOverdue) {
          return `<span class="pill-status" style="background-color: #FEF3C7; color: #B45309; border: 1px solid #F59E0B;" title="Waiting ${minutesWaiting}m (overdue)">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #D97706;"></span> Placed (${minutesWaiting}m)
          </span>`;
        }
        return `<span class="pill-status pill-placed">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #1D3F8F;"></span> Placed
        </span>`;
      case 'rider_assigned':
        return `<span class="pill-status pill-rider_assigned">Assigned</span>`;
      case 'buying':
        return `<span class="pill-status pill-buying">Buying at Chemist</span>`;
      case 'out_for_delivery':
        return `<span class="pill-status pill-out_for_delivery">Out for Delivery</span>`;
      case 'delivered':
        return `<span class="pill-status pill-delivered">✓ Delivered</span>`;
      case 'cancelled':
        return `<span class="pill-status pill-cancelled">Cancelled</span>`;
      case 'delivery_failed':
        return `<span class="pill-status pill-delivery_failed">Delivery Failed</span>`;
      default:
        return `<span class="pill-status pill-offline">${escapeHtml(status)}</span>`;
    }
  }

  function renderOrdersPagination(pag) {
    const info = document.getElementById('orders-pagination-info');
    const pageNum = document.getElementById('orders-page-num');
    const btnPrev = document.getElementById('btn-orders-prev');
    const btnNext = document.getElementById('btn-orders-next');

    const start = pag.total === 0 ? 0 : (pag.page - 1) * pag.limit + 1;
    const end = Math.min(pag.page * pag.limit, pag.total);
    info.textContent = `Showing ${start}-${end} of ${pag.total} orders`;
    pageNum.textContent = `Page ${pag.page} of ${pag.totalPages || 1}`;

    btnPrev.disabled = pag.page <= 1;
    btnNext.disabled = pag.page >= pag.totalPages;
  }

  // 15-second Polling Loop
  function startOrdersPolling() {
    if (state.orders.timer) clearInterval(state.orders.timer);
    state.orders.countdown = 15;

    state.orders.timer = setInterval(() => {
      if (state.currentScreen === 'orders') {
        state.orders.countdown -= 1;
        const countdownEl = document.getElementById('val-refresh-countdown');
        if (countdownEl) countdownEl.textContent = state.orders.countdown;

        if (state.orders.countdown <= 0) {
          state.orders.countdown = 15;
          loadOrders();
        }
      }
    }, 1000);
  }

  /* ========================================================================
     SCREEN 2: ORDER DETAIL IMPLEMENTATION
     ======================================================================== */
  async function openOrderDetail(orderId) {
    state.orders.activeOrderId = orderId;
    setScreen('order-detail', `Order ...`);

    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        showToast(data.message || 'Failed to load order details', 'error');
        setScreen('orders');
        return;
      }

      state.orders.orderDetail = data.order;
      setScreen('order-detail', `Order #${data.order.orderNumber}`);
      renderOrderDetailView(data.order);

    } catch (err) {
      showToast('Error loading order details', 'error');
      setScreen('orders');
    }
  }

  function renderOrderDetailView(ord) {
    // Header
    document.getElementById('detail-order-number').textContent = ord.orderNumber;
    const statusPill = document.getElementById('detail-order-status-pill');
    statusPill.outerHTML = getStatusBadge(ord.status);
    document.getElementById('detail-order-source').textContent = `Source: ${ord.source.toUpperCase()}`;
    document.getElementById('detail-order-date').textContent = `Placed: ${new Date(ord.createdAt).toLocaleString()}`;
    document.getElementById('detail-order-code').textContent = ord.deliveryCode || '----';

    // Customer
    document.getElementById('detail-customer-name').textContent = ord.deliveryName;
    const phoneEl = document.getElementById('detail-customer-phone');
    phoneEl.textContent = ord.deliveryPhone;
    phoneEl.href = `tel:${ord.deliveryPhone}`;
    document.getElementById('detail-customer-address').textContent = `${ord.deliveryAddress}, Jamui - ${ord.deliveryPincode}`;
    document.getElementById('detail-customer-landmark').textContent = ord.deliveryLandmark ? `Landmark: ${ord.deliveryLandmark}` : 'No landmark provided';
    document.getElementById('detail-order-notes').textContent = ord.notes ? `"${ord.notes}"` : 'No customer notes.';

    // Prescriptions (Viewer logs each view to audit_logs)
    const rxContainer = document.getElementById('detail-rx-container');
    const rxCountEl = document.getElementById('detail-rx-count');
    const rxs = ord.prescriptions || [];
    rxCountEl.textContent = `${rxs.length} prescription${rxs.length === 1 ? '' : 's'}`;

    if (rxs.length === 0) {
      rxContainer.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">No physical prescription attached to this order.</p>`;
    } else {
      rxContainer.innerHTML = rxs.map((rx, idx) => `
        <div class="rx-thumbnail-card" data-rx-id="${rx.id}" data-rx-url="${escapeHtml(rx.fileUrl)}" data-notes="${escapeHtml(rx.notes || '')}" style="border: 1px solid #CBD5E1; border-radius: 8px; padding: 6px; cursor: pointer; background: #F8FAFC; text-align: center; width: 120px;">
          <img src="${escapeHtml(rx.fileUrl)}" alt="Rx #${idx + 1}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 4px;" onerror="this.src='/public/uploads/sample-rx-1.jpg'">
          <span style="font-size: 11px; font-weight: 600; color: #1D3F8F; display: block; margin-top: 4px;">Rx #${idx + 1} (View)</span>
        </div>
      `).join('');

      rxContainer.querySelectorAll('.rx-thumbnail-card').forEach((card) => {
        card.addEventListener('click', () => {
          const rxId = card.getAttribute('data-rx-id');
          const rxUrl = card.getAttribute('data-rx-url');
          const notes = card.getAttribute('data-notes');
          openPrescriptionViewer(rxId, rxUrl, notes);
        });
      });
    }

    // Bills
    const billsContainer = document.getElementById('detail-bills-container');
    const billsCountEl = document.getElementById('detail-bills-count');
    const bList = ord.bills || [];
    billsCountEl.textContent = `${bList.length} bill${bList.length === 1 ? '' : 's'}`;

    if (bList.length === 0) {
      billsContainer.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">No chemist pharmacy bills uploaded yet.</p>`;
    } else {
      billsContainer.innerHTML = bList.map((b, idx) => `
        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; display: flex; gap: 12px; align-items: center;">
          <img src="${escapeHtml(b.billImageUrl)}" alt="Bill #${idx + 1}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #CBD5E1; cursor: pointer;" onclick="window.open('${escapeHtml(b.billImageUrl)}', '_blank')">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px;">${escapeHtml(b.pharmacyName || 'Local Pharmacy')}</div>
            <div style="font-size: 12px; color: #64748B;">Bill #${escapeHtml(b.billNumber || 'N/A')}</div>
          </div>
          <div style="text-align: right;">
            <strong style="font-size: 15px; color: #1D3F8F;">₹${parseFloat(b.amount).toFixed(2)}</strong>
            <span style="font-size: 11px; color: #10B981; display: block;">Verified</span>
          </div>
        </div>
      `).join('');
    }

    // Timeline
    const timelineContainer = document.getElementById('detail-timeline-container');
    const events = ord.timeline || [];
    if (events.length === 0) {
      timelineContainer.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">No timeline events recorded.</p>`;
    } else {
      timelineContainer.innerHTML = events.map((ev, i) => {
        const evDt = new Date(ev.createdAt);
        const isLast = i === events.length - 1;
        return `
          <div style="display: flex; gap: 12px; align-items: flex-start; position: relative;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${isLast ? '#1D3F8F' : '#94A3B8'}; margin-top: 5px; z-index: 2;"></div>
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 13px; text-transform: uppercase; color: #1E293B;">${escapeHtml(ev.status.replace('_', ' '))}</strong>
                <span style="font-size: 11px; color: #64748B;">${evDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p style="font-size: 13px; color: #475569; margin: 2px 0 0;">${escapeHtml(ev.notes || '')}</p>
              <span style="font-size: 11px; color: #94A3B8;">Actor: ${escapeHtml(ev.actorType)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Medicines Checklist (Editable before buying)
    renderDetailItems(ord);

    // Assigned Rider Card
    const riderInfoContainer = document.getElementById('detail-rider-info');
    if (ord.assignedRider) {
      const r = ord.assignedRider;
      riderInfoContainer.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #EEF2FB; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #1D3F8F;">
            ${escapeHtml(r.name.slice(0, 2).toUpperCase())}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px;">${escapeHtml(r.name)}</div>
            <div style="font-size: 12px; color: #64748B;">${escapeHtml(r.phone)}</div>
            <div style="font-size: 11px; color: #475569;">${escapeHtml(r.vehicleType || 'Two Wheeler')} (${escapeHtml(r.vehicleNumber || 'Jamui Hub')})</div>
          </div>
          <button type="button" class="btn-secondary" id="btn-reassign-quick" style="height: 32px; padding: 0 10px; font-size: 12px;">
            Reassign
          </button>
        </div>
      `;
      document.getElementById('btn-reassign-quick')?.addEventListener('click', openAssignRiderDialog);
    } else {
      riderInfoContainer.innerHTML = `
        <p style="font-size: 13px; color: #94A3B8; margin-bottom: 10px;">No rider assigned to this order yet.</p>
        <button type="button" class="btn-primary" id="btn-assign-rider-now" style="width: 100%; height: 38px; font-size: 13px;">
          Assign Approved Rider Now
        </button>
      `;
      document.getElementById('btn-assign-rider-now')?.addEventListener('click', openAssignRiderDialog);
    }

    // Payment Totals
    document.getElementById('detail-pay-subtotal').textContent = `₹${parseFloat(ord.subtotalAmount || '0.00').toFixed(2)}`;
    const feeVal = parseFloat(ord.deliveryFee || '0.00');
    document.getElementById('detail-pay-delivery').textContent = feeVal === 0 ? 'FREE' : `₹${feeVal.toFixed(2)}`;
    const finalVal = ord.finalAmount || ord.totalAmount || '0.00';
    document.getElementById('detail-pay-total').textContent = `₹${parseFloat(finalVal).toFixed(2)}`;
    document.getElementById('detail-pay-method').textContent = ord.paymentMethod.toUpperCase();
    const payStatus = document.getElementById('detail-pay-status');
    payStatus.textContent = ord.paymentStatus.toUpperCase();
    payStatus.className = `pill-status ${ord.paymentStatus === 'paid' ? 'pill-delivered' : 'pill-placed'}`;
  }

  function renderDetailItems(ord) {
    const isEditable = ord.isItemsEditable; // status is 'placed' or 'rider_assigned'
    const itemsBadge = document.getElementById('detail-items-editable-badge');
    const helper = document.getElementById('detail-items-helper');
    const addSection = document.getElementById('detail-items-add-section');
    const itemsList = document.getElementById('detail-items-list');

    if (isEditable) {
      itemsBadge.textContent = 'Editable';
      itemsBadge.style.backgroundColor = '#EEF2FB';
      itemsBadge.style.color = '#1D3F8F';
      helper.textContent = 'Order items can be edited before rider starts purchasing from chemist.';
      addSection.style.display = 'block';
    } else {
      itemsBadge.textContent = 'Locked';
      itemsBadge.style.backgroundColor = '#F1F5F9';
      itemsBadge.style.color = '#64748B';
      helper.textContent = `Locked: Rider has already progressed to ${ord.status.replace('_', ' ')}.`;
      addSection.style.display = 'none';
    }

    const items = ord.items || [];
    if (items.length === 0) {
      itemsList.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">No medicine items listed.</p>`;
      return;
    }

    itemsList.innerHTML = items.map((it, idx) => `
      <div class="detail-item-row" data-item-idx="${idx}" style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; background: #FFFFFF;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <input type="text" class="form-input item-name" value="${escapeHtml(it.name)}" ${!isEditable ? 'disabled' : ''} style="font-weight: 600; font-size: 14px; border: ${isEditable ? '1px solid #CBD5E1' : 'none'}; padding: 4px 8px; height: 32px; flex: 1; margin-right: 8px;">
          ${isEditable ? `<button type="button" class="btn-remove-detail-item" data-idx="${idx}" style="background: none; border: none; color: #DC2626; cursor: pointer; font-size: 14px;">✕</button>` : ''}
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" class="form-input item-strength" placeholder="Strength" value="${escapeHtml(it.strength || '')}" ${!isEditable ? 'disabled' : ''} style="font-size: 12px; height: 28px; width: 100px; padding: 2px 6px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 12px; color: #64748B;">Qty:</span>
            <input type="number" class="form-input item-qty" min="1" value="${it.quantity}" ${!isEditable ? 'disabled' : ''} style="font-size: 12px; height: 28px; width: 60px; padding: 2px 6px;">
          </div>
          <span class="pill-status pill-${it.status || 'pending'}" style="margin-left: auto; font-size: 11px;">${it.status || 'pending'}</span>
        </div>
      </div>
    `).join('');

    // Remove item listeners
    if (isEditable) {
      itemsList.querySelectorAll('.btn-remove-detail-item').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          ord.items.splice(idx, 1);
          renderDetailItems(ord);
        });
      });
    }
  }

  // Save updated items handler
  document.getElementById('btn-save-items')?.addEventListener('click', async () => {
    const ord = state.orders.orderDetail;
    if (!ord || !ord.isItemsEditable) return;

    const rows = document.querySelectorAll('.detail-item-row');
    const newItems = [];
    rows.forEach((r) => {
      const name = r.querySelector('.item-name')?.value.trim();
      const strength = r.querySelector('.item-strength')?.value.trim();
      const qty = parseInt(r.querySelector('.item-qty')?.value, 10) || 1;
      if (name) {
        newItems.push({ name, strength, quantity: qty });
      }
    });

    if (newItems.length === 0) {
      showToast('Order must contain at least one medicine', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/orders/${ord.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItems }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Medicines updated successfully', 'success');
        openOrderDetail(ord.id); // Reload order
      } else {
        showToast(data.message || 'Failed to update items', 'error');
      }
    } catch (err) {
      showToast('Error saving items', 'error');
    }
  });

  // Add another item row in detail view
  document.getElementById('btn-add-item-row')?.addEventListener('click', () => {
    const ord = state.orders.orderDetail;
    if (!ord) return;
    if (!ord.items) ord.items = [];
    ord.items.push({ name: '', strength: '', quantity: 1, status: 'pending' });
    renderDetailItems(ord);
  });

  /* ========================================================================
     PRESCRIPTION VIEWER & MANDATORY AUDIT LOGGING
     ======================================================================== */
  async function openPrescriptionViewer(rxId, rxUrl, notes = '') {
    const imgEl = document.getElementById('prescription-viewer-img');
    const notesEl = document.getElementById('prescription-viewer-notes');
    imgEl.src = rxUrl;
    notesEl.textContent = notes ? `Doctor Notes: ${notes}` : 'No notes attached';

    openModal('modal-prescription-viewer');

    // Requirement: "prescription viewer (log each view to audit_logs)"
    try {
      await fetch(`/api/v1/admin/orders/${state.orders.activeOrderId}/view-rx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rxId, rxUrl }),
      });
    } catch (err) {
      console.warn('Could not record rx view audit:', err);
    }
  }

  /* ========================================================================
     ASSIGN / REASSIGN RIDER DIALOG
     ======================================================================== */
  async function openAssignRiderDialog() {
    const modal = document.getElementById('modal-assign-rider');
    const list = document.getElementById('assign-riders-list');
    list.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">Loading approved riders from Jamui hub...</p>`;

    openModal('modal-assign-rider');

    try {
      const res = await fetch('/api/v1/admin/riders?status=approved');
      const data = await res.json();
      if (!res.ok || !data.riders) {
        list.innerHTML = `<p style="color: #DC2626; font-size: 13px;">Failed to load fleet riders.</p>`;
        return;
      }

      // Requirement: "approved riders, online first"
      const approvedRiders = data.riders.sort((a, b) => {
        if (a.isOnline === b.isOnline) return 0;
        return a.isOnline ? -1 : 1;
      });

      if (approvedRiders.length === 0) {
        list.innerHTML = `<p style="color: #B45309; font-size: 13px;">No approved riders available in hub.</p>`;
        return;
      }

      list.innerHTML = approvedRiders.map((r) => `
        <label class="assign-rider-card" style="border: 1px solid #CBD5E1; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; background: #FFFFFF;">
          <input type="radio" name="assign_rider_radio" value="${r.id}" ${r.isOnline ? 'checked' : ''}>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 14px;">${escapeHtml(r.name)}</strong>
              ${r.isOnline ? '<span class="pill-status pill-online" style="font-size: 11px;">Online</span>' : '<span class="pill-status pill-offline" style="font-size: 11px;">Offline</span>'}
            </div>
            <div style="font-size: 12px; color: #64748B;">${escapeHtml(r.phone)} • ${escapeHtml(r.vehicleType || 'Two Wheeler')}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            <span>Active: <strong>${r.activeOrdersCount || 0}</strong></span>
          </div>
        </label>
      `).join('');

    } catch (err) {
      list.innerHTML = `<p style="color: #DC2626; font-size: 13px;">Error fetching riders.</p>`;
    }
  }

  document.getElementById('btn-confirm-assign-rider')?.addEventListener('click', async () => {
    const selected = document.querySelector('input[name="assign_rider_radio"]:checked');
    if (!selected) {
      showToast('Please select a rider from the list', 'error');
      return;
    }

    const riderId = selected.value;
    const orderId = state.orders.activeOrderId;

    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Rider assigned successfully', 'success');
        closeModal('modal-assign-rider');
        openOrderDetail(orderId);
      } else {
        showToast(data.message || 'Failed to assign rider', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  });

  /* ========================================================================
     CANCEL ORDER DIALOG (Required Reason)
     ======================================================================== */
  function openCancelOrderDialog() {
    document.getElementById('cancel-order-reason').value = '';
    document.getElementById('cancel-reason-preset').value = '';
    openModal('modal-cancel-order');
  }

  document.getElementById('cancel-reason-preset')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val && val !== 'Other') {
      document.getElementById('cancel-order-reason').value = val;
    }
  });

  document.getElementById('btn-confirm-cancel-order')?.addEventListener('click', async () => {
    const reason = document.getElementById('cancel-order-reason').value.trim();
    if (!reason) {
      showToast('A cancellation reason is strictly required', 'error');
      return;
    }

    const orderId = state.orders.activeOrderId;
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Order has been cancelled', 'success');
        closeModal('modal-cancel-order');
        openOrderDetail(orderId);
      } else {
        showToast(data.message || 'Failed to cancel order', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  });

  /* ========================================================================
     SCREEN 3: CREATE ORDER (Phone Lookup & Source Dropdown)
     ======================================================================== */
  // Auto-lookup phone when 10 digits entered
  const coPhoneInput = document.getElementById('co-phone');
  let lookupDebounce = null;
  coPhoneInput?.addEventListener('input', () => {
    const clean = coPhoneInput.value.replace(/\D/g, '');
    coPhoneInput.value = clean;
    if (clean.length === 10) {
      clearTimeout(lookupDebounce);
      lookupDebounce = setTimeout(() => performCustomerLookup(clean), 300);
    }
  });

  async function performCustomerLookup(phone) {
    const spinner = document.getElementById('co-lookup-spinner');
    const helper = document.getElementById('co-phone-helper');
    if (spinner) spinner.style.display = 'inline';

    try {
      const res = await fetch(`/api/v1/admin/customers/lookup?phone=${phone}`);
      const data = await res.json();
      if (spinner) spinner.style.display = 'none';

      if (data.success && data.found && data.customer) {
        helper.textContent = `✓ Known customer found: ${data.customer.name}`;
        helper.style.color = '#10B981';

        // Pre-fill
        document.getElementById('co-name').value = data.customer.name || '';
        if (data.lastAddress) {
          document.getElementById('co-address').value = data.lastAddress.streetArea || data.lastAddress.houseFlat || '';
          document.getElementById('co-landmark').value = data.lastAddress.landmark || '';
          document.getElementById('co-pincode').value = data.lastAddress.pincode || '811307';
        }
      } else {
        helper.textContent = 'New customer profile will be created.';
        helper.style.color = '#64748B';
      }
    } catch (err) {
      if (spinner) spinner.style.display = 'none';
    }
  }

  // Dynamic medicine rows in create order form
  document.getElementById('btn-co-add-med')?.addEventListener('click', () => {
    const container = document.getElementById('co-medicines-container');
    const row = document.createElement('div');
    row.className = 'co-med-row';
    row.style = 'display: grid; grid-template-columns: 2fr 1fr 80px 36px; gap: 8px; align-items: center;';
    row.innerHTML = `
      <input type="text" class="form-input co-med-name" placeholder="Medicine name" required>
      <input type="text" class="form-input co-med-strength" placeholder="Strength">
      <input type="number" class="form-input co-med-qty" value="1" min="1" required>
      <button type="button" class="btn-remove-co-med" style="background: none; border: none; color: #DC2626; cursor: pointer; font-size: 16px;">✕</button>
    `;
    container.appendChild(row);

    row.querySelector('.btn-remove-co-med')?.addEventListener('click', () => row.remove());
  });

  // Create order submit handler
  document.getElementById('form-create-order')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-create-order');
    btn.disabled = true;
    btn.textContent = 'Placing Order...';

    const source = document.getElementById('co-source').value;
    const phone = document.getElementById('co-phone').value.trim();
    const name = document.getElementById('co-name').value.trim();
    const houseArea = document.getElementById('co-address').value.trim();
    const landmark = document.getElementById('co-landmark').value.trim();
    const pincode = document.getElementById('co-pincode').value.trim();
    const notes = document.getElementById('co-notes').value.trim();
    const paymentMethod = document.getElementById('co-payment').value;
    const rxUrl = document.getElementById('co-rx-url').value.trim();

    const medicines = [];
    document.querySelectorAll('.co-med-row').forEach((r) => {
      const medName = r.querySelector('.co-med-name')?.value.trim();
      const medStrength = r.querySelector('.co-med-strength')?.value.trim();
      const medQty = parseInt(r.querySelector('.co-med-qty')?.value, 10) || 1;
      if (medName) {
        medicines.push({ name: medName, strength: medStrength, quantity: medQty });
      }
    });

    const prescriptions = rxUrl ? [{ fileUrl: rxUrl, notes: 'Attached during admin order creation' }] : [];

    if (medicines.length === 0 && prescriptions.length === 0) {
      showToast('Add at least one medicine or prescription', 'error');
      btn.disabled = false;
      btn.textContent = 'Place Order as Administrator';
      return;
    }

    try {
      const res = await fetch('/api/v1/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          name,
          mobile: phone,
          houseArea,
          landmark,
          pincode,
          notes,
          paymentMethod,
          medicines,
          prescriptions,
        }),
      });

      const data = await res.json();
      btn.disabled = false;
      btn.textContent = 'Place Order as Administrator';

      if (res.ok && data.success) {
        showToast(`Order ${data.orderNumber} created successfully!`, 'success');
        openOrderDetail(data.orderId);
      } else {
        showToast(data.message || 'Failed to create order', 'error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Place Order as Administrator';
      showToast('Network error placing order', 'error');
    }
  });

  /* ========================================================================
     SCREEN 4: RIDERS IMPLEMENTATION
     ======================================================================== */
  async function loadRiders() {
    const tbody = document.getElementById('tbody-riders');
    tbody.innerHTML = `<tr><td colspan="8" class="admin-table-state">Loading fleet riders...</td></tr>`;

    try {
      const res = await fetch('/api/v1/admin/riders');
      const data = await res.json();
      if (!res.ok || !data.success) {
        tbody.innerHTML = `<tr><td colspan="8" class="admin-table-state" style="color: #DC2626;">Error: ${data.message || 'Failed to load riders'}</td></tr>`;
        return;
      }

      state.riders.items = data.riders || [];
      const pendingCount = data.riders.filter((r) => r.status === 'pending_approval').length;

      // Update badges
      const pendingBadge = document.getElementById('sidebar-pending-riders-badge');
      const queueBadge = document.getElementById('badge-pending-count');
      if (pendingCount > 0) {
        pendingBadge.textContent = pendingCount;
        pendingBadge.style.display = 'inline-flex';
        queueBadge.textContent = pendingCount;
        queueBadge.style.display = 'inline-flex';
      } else {
        pendingBadge.style.display = 'none';
        queueBadge.style.display = 'none';
      }

      renderRidersTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="admin-table-state" style="color: #DC2626;">Connection error loading riders.</td></tr>`;
    }
  }

  function renderRidersTable() {
    const tbody = document.getElementById('tbody-riders');
    const isPendingTab = state.riders.tab === 'pending';
    const ridersToRender = isPendingTab
      ? state.riders.items.filter((r) => r.status === 'pending_approval')
      : state.riders.items;

    if (ridersToRender.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="admin-table-state">
            <div style="font-weight: 600;">No riders in this section</div>
            <div style="font-size: 13px;">${isPendingTab ? 'Approval queue is currently empty.' : 'No fleet riders registered.'}</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = ridersToRender.map((r) => {
      const statusPill = `<span class="pill-status pill-${r.status}">${r.status.replace('_', ' ')}</span>`;
      const dutyPill = r.isOnline
        ? `<span class="pill-status pill-online">● Online</span>`
        : `<span class="pill-status pill-offline">○ Offline</span>`;

      let actionButtons = '';
      if (r.status === 'pending_approval') {
        actionButtons = `
          <button type="button" class="btn-primary btn-approve-rider" data-id="${r.id}" style="height: 30px; padding: 0 10px; font-size: 12px; width: auto; background-color: #10B981;">
            Approve
          </button>
        `;
      } else if (r.status === 'approved') {
        actionButtons = `
          <button type="button" class="btn-secondary btn-block-rider" data-id="${r.id}" data-name="${escapeHtml(r.name)}" style="height: 30px; padding: 0 8px; font-size: 12px; color: #DC2626;">
            Block
          </button>
        `;
      } else if (r.status === 'blocked') {
        actionButtons = `
          <button type="button" class="btn-secondary btn-unblock-rider" data-id="${r.id}" style="height: 30px; padding: 0 8px; font-size: 12px; color: #10B981;">
            Unblock
          </button>
        `;
      }

      return `
        <tr>
          <td>
            <strong style="font-size: 14px; color: #1E293B;">${escapeHtml(r.name)}</strong>
            ${r.idProofUrl ? `<span title="ID Document on file" style="cursor: pointer; color: #1D3F8F; font-size: 11px; margin-left: 4px;" onclick="window.open('${escapeHtml(r.idProofUrl)}', '_blank')">📎 ID</span>` : ''}
          </td>
          <td><a href="tel:${r.phone}" style="color: #1D3F8F; text-decoration: none;">${escapeHtml(r.phone)}</a></td>
          <td>
            <div style="font-size: 13px;">${escapeHtml(r.vehicleType || 'Two Wheeler')}</div>
            <div style="font-size: 11px; color: #64748B;">${escapeHtml(r.vehicleNumber || 'No plate')}</div>
          </td>
          <td>${statusPill}</td>
          <td>${dutyPill}</td>
          <td class="col-num" style="font-weight: 700; color: #1E293B;">₹${parseFloat(r.cashBalance || '0.00').toFixed(2)}</td>
          <td style="text-align: center;"><span style="font-weight: 600;">${r.activeOrdersCount || 0}</span></td>
          <td style="text-align: right;">${actionButtons}</td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('.btn-approve-rider').forEach((btn) => {
      btn.addEventListener('click', () => approveRider(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-block-rider').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        openBlockModal('rider', id, name);
      });
    });

    tbody.querySelectorAll('.btn-unblock-rider').forEach((btn) => {
      btn.addEventListener('click', () => unblockRider(btn.getAttribute('data-id')));
    });
  }

  async function approveRider(riderId) {
    try {
      const res = await fetch(`/api/v1/admin/riders/${riderId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Rider approved', 'success');
        loadRiders();
      } else {
        showToast(data.message || 'Failed to approve rider', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    }
  }

  async function unblockRider(riderId) {
    try {
      const res = await fetch(`/api/v1/admin/riders/${riderId}/unblock`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Rider unblocked', 'success');
        loadRiders();
      } else {
        showToast(data.message || 'Failed to unblock rider', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    }
  }

  // Add rider form submit handler
  document.getElementById('form-add-rider')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-add-rider');
    btn.disabled = true;

    const payload = {
      name: document.getElementById('ar-name').value.trim(),
      phone: document.getElementById('ar-phone').value.trim(),
      vehicleType: document.getElementById('ar-vehicle-type').value.trim(),
      vehicleNumber: document.getElementById('ar-vehicle-num').value.trim(),
      idProofUrl: document.getElementById('ar-id-proof').value.trim(),
      status: 'approved',
    };

    try {
      const res = await fetch('/api/v1/admin/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      btn.disabled = false;

      if (res.ok && data.success) {
        showToast('Rider added successfully', 'success');
        closeModal('modal-add-rider');
        loadRiders();
      } else {
        showToast(data.message || 'Failed to add rider', 'error');
      }
    } catch (err) {
      btn.disabled = false;
      showToast('Connection error adding rider', 'error');
    }
  });

  /* ========================================================================
     SCREEN 5: CASH MANAGEMENT IMPLEMENTATION
     ======================================================================== */
  async function loadCash() {
    const tbody = document.getElementById('tbody-cash');
    tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state">Loading cash accounts...</td></tr>`;

    try {
      const res = await fetch('/api/v1/admin/cash/riders');
      const data = await res.json();
      if (!res.ok || !data.success) {
        tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state" style="color: #DC2626;">Error loading cash balances.</td></tr>`;
        return;
      }

      state.cash.riders = data.riders || [];
      document.getElementById('kpi-cash-total').textContent = `₹${parseFloat(data.totalCashHeld || '0.00').toFixed(2)}`;
      document.getElementById('kpi-cash-riders-count').textContent = data.riders.filter((r) => r.balance > 0).length;

      renderCashTable(data.riders);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state" style="color: #DC2626;">Connection error loading cash.</td></tr>`;
    }
  }

  function renderCashTable(list) {
    const tbody = document.getElementById('tbody-cash');
    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state">No fleet riders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((r) => {
      const bal = r.balance;
      const balColor = bal > 2000 ? '#DC2626' : (bal > 0 ? '#1D3F8F' : '#64748B');
      const lastAct = r.lastActivity ? new Date(r.lastActivity).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

      return `
        <tr>
          <td><strong style="color: #1E293B;">${escapeHtml(r.name)}</strong></td>
          <td>${escapeHtml(r.phone)}</td>
          <td>${escapeHtml(r.vehicleType || 'Two Wheeler')}</td>
          <td><span class="pill-status pill-${r.status}">${r.status}</span></td>
          <td class="col-num" style="font-size: 15px; font-weight: 700; color: ${balColor};">
            ₹${bal.toFixed(2)}
          </td>
          <td style="font-size: 12px; color: #64748B;">${lastAct}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-secondary btn-cash-drawer" data-id="${r.id}" style="height: 30px; padding: 0 10px; font-size: 12px; margin-right: 6px;">
              History Drawer →
            </button>
            <button type="button" class="btn-primary btn-quick-cash-entry" data-id="${r.id}" style="height: 30px; padding: 0 10px; font-size: 12px; width: auto;">
              + Entry
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-cash-drawer').forEach((btn) => {
      btn.addEventListener('click', () => openRiderCashDrawer(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-quick-cash-entry').forEach((btn) => {
      btn.addEventListener('click', () => {
        openAddCashModal(btn.getAttribute('data-id'));
      });
    });
  }

  function openAddCashModal(preselectedRiderId = '') {
    const select = document.getElementById('ce-rider-select');
    select.innerHTML = `<option value="">-- Choose Rider --</option>` + state.cash.riders.map((r) => `
      <option value="${r.id}" ${r.id === preselectedRiderId ? 'selected' : ''}>${escapeHtml(r.name)} (Current: ₹${r.balance.toFixed(2)})</option>
    `).join('');

    document.getElementById('ce-amount').value = '';
    document.getElementById('ce-notes').value = '';
    openModal('modal-cash-entry');
  }

  // Cash entry submit handler
  document.getElementById('form-cash-entry')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-cash-entry');
    btn.disabled = true;

    const payload = {
      riderId: document.getElementById('ce-rider-select').value,
      type: document.getElementById('ce-type-select').value,
      amount: parseFloat(document.getElementById('ce-amount').value),
      notes: document.getElementById('ce-notes').value.trim(),
    };

    try {
      const res = await fetch('/api/v1/admin/cash/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      btn.disabled = false;

      if (res.ok && data.success) {
        showToast(data.message || 'Cash entry recorded successfully', 'success');
        closeModal('modal-cash-entry');
        loadCash();
        if (state.cash.activeRider?.id === payload.riderId) {
          openRiderCashDrawer(payload.riderId);
        }
      } else {
        showToast(data.message || 'Failed to record entry', 'error');
      }
    } catch (err) {
      btn.disabled = false;
      showToast('Error recording cash entry', 'error');
    }
  });

  /* ========================================================================
     SLIDE-OVER HISTORY DRAWER PER RIDER (Cash Ledger)
     ======================================================================== */
  async function openRiderCashDrawer(riderId) {
    const drawer = document.getElementById('drawer-rider-ledger');
    const overlay = document.getElementById('drawer-overlay');
    const txList = document.getElementById('drawer-transactions-list');
    txList.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">Loading transactions...</p>`;

    drawer.classList.add('open');
    overlay.classList.add('open');

    try {
      const res = await fetch(`/api/v1/admin/cash/ledger/${riderId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        txList.innerHTML = `<p style="color: #DC2626; font-size: 13px;">Error loading ledger history.</p>`;
        return;
      }

      state.cash.activeRider = data.rider;
      document.getElementById('drawer-rider-name').textContent = data.rider.name;
      document.getElementById('drawer-rider-phone').textContent = `Mobile: ${data.rider.phone}`;
      document.getElementById('drawer-rider-balance').textContent = `₹${parseFloat(data.rider.cashBalance || '0.00').toFixed(2)}`;

      const txs = data.transactions || [];
      if (txs.length === 0) {
        txList.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">No cash transactions logged for this rider.</p>`;
        return;
      }

      txList.innerHTML = txs.map((t) => {
        const dt = new Date(t.createdAt);
        const amt = parseFloat(t.amount);
        const isPositive = t.type === 'float_given' || t.type === 'cash_collected';
        const amtStr = `${isPositive ? '+' : '-'}₹${amt.toFixed(2)}`;
        const amtColor = isPositive ? '#10B981' : '#DC2626';

        return `
          <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; background: #FFFFFF;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="pill-status pill-placed" style="font-size: 11px; text-transform: uppercase;">${t.type.replace('_', ' ')}</span>
              <strong style="font-size: 15px; color: ${amtColor};">${amtStr}</strong>
            </div>
            <div style="font-size: 13px; color: #475569; margin-top: 6px;">${escapeHtml(t.notes || 'No description')}</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8; margin-top: 6px; border-top: 1px dashed #E2E8F0; padding-top: 4px;">
              <span>Balance After: <strong>₹${parseFloat(t.balanceAfter).toFixed(2)}</strong></span>
              <span>${dt.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      txList.innerHTML = `<p style="color: #DC2626; font-size: 13px;">Error fetching ledger.</p>`;
    }
  }

  function closeCashDrawer() {
    document.getElementById('drawer-rider-ledger')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('open');
  }

  document.getElementById('btn-close-drawer')?.addEventListener('click', closeCashDrawer);
  document.getElementById('drawer-overlay')?.addEventListener('click', closeCashDrawer);
  document.getElementById('btn-drawer-add-entry')?.addEventListener('click', () => {
    if (state.cash.activeRider) {
      openAddCashModal(state.cash.activeRider.id);
    }
  });

  /* ========================================================================
     SCREEN 6: CUSTOMERS IMPLEMENTATION
     ======================================================================== */
  async function loadCustomers() {
    const tbody = document.getElementById('tbody-customers');
    tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state">Loading customers...</td></tr>`;

    const c = state.customers;
    const params = new URLSearchParams({
      page: String(c.page),
      limit: String(c.limit),
    });
    if (c.search) params.set('search', c.search);

    try {
      const res = await fetch(`/api/v1/admin/customers?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state" style="color: #DC2626;">Error: ${data.message}</td></tr>`;
        return;
      }

      c.items = data.customers || [];
      c.total = data.pagination.total;
      c.totalPages = data.pagination.totalPages;

      document.getElementById('customers-count-label').textContent = `${data.pagination.total} registered customer accounts`;
      renderCustomersTable(data.customers);
      renderCustomersPagination(data.pagination);

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state" style="color: #DC2626;">Connection error loading customers.</td></tr>`;
    }
  }

  function renderCustomersTable(list) {
    const tbody = document.getElementById('tbody-customers');
    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-table-state">No matching customers found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((cust) => {
      const statusBadge = cust.isActive
        ? `<span class="pill-status pill-approved">Active</span>`
        : `<span class="pill-status pill-blocked" title="${escapeHtml(cust.blockReason || 'Blocked')}">Blocked</span>`;

      const blockBtn = cust.isActive
        ? `<button type="button" class="btn-secondary btn-block-cust" data-id="${cust.id}" data-name="${escapeHtml(cust.name)}" style="height: 30px; padding: 0 8px; font-size: 12px; color: #DC2626;">Block</button>`
        : `<button type="button" class="btn-secondary btn-unblock-cust" data-id="${cust.id}" style="height: 30px; padding: 0 8px; font-size: 12px; color: #10B981;">Unblock</button>`;

      const regDate = new Date(cust.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      return `
        <tr>
          <td>
            <strong style="color: #1E293B;">${escapeHtml(cust.name)}</strong>
            ${cust.blockReason ? `<div style="font-size: 11px; color: #DC2626;">Reason: ${escapeHtml(cust.blockReason)}</div>` : ''}
          </td>
          <td><a href="tel:${cust.phone}" style="color: #1D3F8F; text-decoration: none;">${escapeHtml(cust.phone)}</a></td>
          <td>${statusBadge}</td>
          <td style="text-align: center;"><span style="font-weight: 600;">${cust.orderCount || 0}</span></td>
          <td class="col-num" style="font-weight: 700; color: #1E293B;">₹${parseFloat(cust.totalSpend || '0.00').toFixed(2)}</td>
          <td style="font-size: 12px; color: #64748B;">${regDate}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-secondary btn-view-cust-hist" data-id="${cust.id}" style="height: 30px; padding: 0 10px; font-size: 12px; margin-right: 6px;">
              Order History
            </button>
            ${blockBtn}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-view-cust-hist').forEach((btn) => {
      btn.addEventListener('click', () => openCustomerHistoryModal(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-block-cust').forEach((btn) => {
      btn.addEventListener('click', () => {
        openBlockModal('customer', btn.getAttribute('data-id'), btn.getAttribute('data-name'));
      });
    });

    tbody.querySelectorAll('.btn-unblock-cust').forEach((btn) => {
      btn.addEventListener('click', () => unblockCustomer(btn.getAttribute('data-id')));
    });
  }

  function renderCustomersPagination(pag) {
    const info = document.getElementById('customers-pagination-info');
    const pageNum = document.getElementById('customers-page-num');
    const btnPrev = document.getElementById('btn-customers-prev');
    const btnNext = document.getElementById('btn-customers-next');

    const start = pag.total === 0 ? 0 : (pag.page - 1) * pag.limit + 1;
    const end = Math.min(pag.page * pag.limit, pag.total);
    info.textContent = `Showing ${start}-${end} of ${pag.total} customers`;
    pageNum.textContent = `Page ${pag.page} of ${pag.totalPages || 1}`;

    btnPrev.disabled = pag.page <= 1;
    btnNext.disabled = pag.page >= pag.totalPages;
  }

  async function openCustomerHistoryModal(customerId) {
    const profile = document.getElementById('cust-hist-profile');
    const tbody = document.getElementById('tbody-cust-history');
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-state">Loading history...</td></tr>`;

    openModal('modal-customer-history');

    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        tbody.innerHTML = `<tr><td colspan="6" class="admin-table-state" style="color: #DC2626;">Error loading history.</td></tr>`;
        return;
      }

      const cust = data.customer;
      profile.innerHTML = `
        <div><span style="color: #64748B;">Name:</span> <strong>${escapeHtml(cust.name)}</strong></div>
        <div><span style="color: #64748B;">Phone:</span> <strong>${escapeHtml(cust.phone)}</strong></div>
        <div><span style="color: #64748B;">Orders:</span> <strong>${data.orders.length}</strong></div>
      `;

      if (data.orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="admin-table-state">No past orders on file.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.orders.map((o) => `
        <tr>
          <td><strong style="color: #1D3F8F;">${escapeHtml(o.orderNumber)}</strong></td>
          <td>${new Date(o.createdAt).toLocaleDateString()}</td>
          <td style="font-weight: 700;">₹${parseFloat(o.finalAmount || o.totalAmount || '0').toFixed(2)}</td>
          <td>${o.paymentMethod.toUpperCase()} (${o.paymentStatus})</td>
          <td>${getStatusBadge(o.status)}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-secondary" style="height: 28px; padding: 0 8px; font-size: 11px;" onclick="AntigravityAdmin.viewOrderFromModal('${o.id}')">
              View Order
            </button>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-table-state" style="color: #DC2626;">Error fetching history.</td></tr>`;
    }
  }

  async function unblockCustomer(customerId) {
    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}/unblock`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Customer unblocked', 'success');
        loadCustomers();
      } else {
        showToast(data.message || 'Failed to unblock customer', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    }
  }

  /* ========================================================================
     MODAL 5: UNIVERSAL BLOCK CONFIRMATION (Rider or Customer)
     ======================================================================== */
  function openBlockModal(type, id, name) {
    state.blockTarget = { type, id, name };
    document.getElementById('txt-block-modal-title').textContent = `Block ${type === 'rider' ? 'Fleet Rider' : 'Customer'}: ${name}`;
    document.getElementById('block-action-reason').value = '';
    openModal('modal-block-action');
  }

  document.getElementById('btn-confirm-block-action')?.addEventListener('click', async () => {
    if (!state.blockTarget) return;
    const reason = document.getElementById('block-action-reason').value.trim();
    if (!reason) {
      showToast('A mandatory reason is required to block an account', 'error');
      return;
    }

    const { type, id } = state.blockTarget;
    const endpoint = type === 'rider' ? `/api/v1/admin/riders/${id}/block` : `/api/v1/admin/customers/${id}/block`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Account blocked successfully', 'success');
        closeModal('modal-block-action');
        if (type === 'rider') loadRiders();
        if (type === 'customer') loadCustomers();
      } else {
        showToast(data.message || 'Failed to block account', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    }
  });

  /* ========================================================================
     SCREEN 7: REPORTS IMPLEMENTATION (KPIs, 3 Charts, CSV Export)
     ======================================================================== */
  async function loadReports() {
    const params = new URLSearchParams();
    if (state.reports.startDate) params.set('startDate', state.reports.startDate);
    if (state.reports.endDate) params.set('endDate', state.reports.endDate);

    try {
      const res = await fetch(`/api/v1/admin/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('Failed to generate report metrics', 'error');
        return;
      }

      state.reports.kpis = data.kpis;
      state.reports.charts = data.charts;

      // Update KPI Tiles:
      // "tiles for orders, delivered, cancellation rate, average minutes from placed to delivered"
      document.getElementById('rep-kpi-orders').textContent = data.kpis.totalOrders;
      document.getElementById('rep-kpi-delivered').textContent = data.kpis.deliveredOrders;
      document.getElementById('rep-kpi-cancel-rate').textContent = data.kpis.cancellationRate;
      document.getElementById('rep-kpi-avg-time').textContent = data.kpis.avgDeliveryMinutes;

      renderDailyVolumeChart(data.charts.dailyTrend);
      renderSourcesChart(data.charts.sourceBreakdown, data.kpis.totalOrders);
      renderHourlyChart(data.charts.hourlyDistribution);

    } catch (err) {
      showToast('Connection error generating reports', 'error');
    }
  }

  // Chart 1: Daily Trend SVG chart
  function renderDailyVolumeChart(trend) {
    const svg = document.getElementById('svg-chart-daily');
    if (!svg) return;
    svg.innerHTML = '';

    if (!trend || trend.length === 0) {
      svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#94A3B8" font-size="13">No order data for selected period</text>`;
      return;
    }

    const width = svg.clientWidth || 600;
    const height = 220;
    const maxVal = Math.max(...trend.map((t) => t.total), 5);
    const barWidth = Math.min(36, Math.max(16, (width - 60) / trend.length - 12));

    let markup = `
      <line x1="40" y1="20" x2="40" y2="${height - 30}" stroke="#E2E8F0" stroke-width="1"/>
      <line x1="40" y1="${height - 30}" x2="${width - 20}" y2="${height - 30}" stroke="#E2E8F0" stroke-width="1"/>
    `;

    trend.forEach((d, i) => {
      const x = 50 + i * ((width - 70) / trend.length);
      const totalH = ((d.total / maxVal) * (height - 60));
      const delivH = ((d.delivered / maxVal) * (height - 60));
      const y = height - 30 - totalH;
      const yDeliv = height - 30 - delivH;

      markup += `
        <!-- Total bar -->
        <rect x="${x}" y="${y}" width="${barWidth}" height="${totalH}" rx="4" fill="#EEF2FB" stroke="#BFD2F8" stroke-width="1"/>
        <!-- Delivered bar overlay -->
        <rect x="${x}" y="${yDeliv}" width="${barWidth}" height="${delivH}" rx="4" fill="#10B981"/>
        <!-- Date label -->
        <text x="${x + barWidth / 2}" y="${height - 12}" text-anchor="middle" font-size="11" fill="#64748B">${d.date.slice(5)}</text>
        <!-- Value count -->
        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="11" font-weight="600" fill="#1D3F8F">${d.total}</text>
      `;
    });

    markup += `
      <g transform="translate(${width - 160}, 10)">
        <rect x="0" y="0" width="10" height="10" rx="2" fill="#10B981"/>
        <text x="16" y="9" font-size="11" fill="#475569">Delivered</text>
        <rect x="75" y="0" width="10" height="10" rx="2" fill="#EEF2FB" stroke="#BFD2F8"/>
        <text x="91" y="9" font-size="11" fill="#475569">Total</text>
      </g>
    `;

    svg.innerHTML = markup;
  }

  // Chart 2: Sources breakdown
  function renderSourcesChart(sources, total) {
    const container = document.getElementById('chart-sources-container');
    if (!container) return;

    if (!sources || total === 0) {
      container.innerHTML = `<p style="font-size: 13px; color: #94A3B8; text-align: center;">No order source data</p>`;
      return;
    }

    container.innerHTML = sources.map((s) => {
      const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
      let color = '#1D3F8F';
      if (s.key === 'phone') color = '#F59E0B';
      if (s.key === 'whatsapp') color = '#10B981';

      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
            <strong style="color: #1E293B;">${s.name}</strong>
            <span style="color: #64748B;">${s.count} orders (${pct}%)</span>
          </div>
          <div style="width: 100%; height: 8px; background: #F1F5F9; border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 4px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Chart 3: Hourly performance distribution SVG
  function renderHourlyChart(hours) {
    const svg = document.getElementById('svg-chart-hourly');
    if (!svg) return;
    svg.innerHTML = '';

    if (!hours || hours.length === 0) return;

    const width = svg.clientWidth || 900;
    const height = 180;
    const maxOrders = Math.max(...hours.map((h) => h.orders), 3);
    const colW = (width - 60) / 24;

    let markup = `
      <line x1="30" y1="${height - 25}" x2="${width - 10}" y2="${height - 25}" stroke="#E2E8F0" stroke-width="1"/>
    `;

    hours.forEach((h, i) => {
      const x = 35 + i * colW;
      const barH = (h.orders / maxOrders) * (height - 50);
      const y = height - 25 - barH;
      const isPeak = h.orders > 0 && h.orders === maxOrders;

      markup += `
        <rect x="${x}" y="${y}" width="${colW - 4}" height="${barH}" rx="2" fill="${isPeak ? '#1D3F8F' : '#93C5FD'}"/>
        ${i % 3 === 0 ? `<text x="${x + (colW - 4) / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#64748B">${h.hour}</text>` : ''}
        ${h.orders > 0 ? `<text x="${x + (colW - 4) / 2}" y="${y - 4}" text-anchor="middle" font-size="10" font-weight="600" fill="#1D3F8F">${h.orders}</text>` : ''}
      `;
    });

    svg.innerHTML = markup;
  }

  function exportReportsCsv() {
    const params = new URLSearchParams();
    if (state.reports.startDate) params.set('startDate', state.reports.startDate);
    if (state.reports.endDate) params.set('endDate', state.reports.endDate);
    window.location.href = `/api/v1/admin/reports/csv?${params.toString()}`;
  }

  /* ========================================================================
     SCREEN 8: SETTINGS IMPLEMENTATION (Zod validation & Tabs)
     ======================================================================== */
  async function loadSettings() {
    try {
      const res = await fetch('/api/v1/admin/settings');
      const data = await res.json();
      if (!res.ok || !data.success) return;

      const s = data.settings;
      state.settings.data = s;

      document.getElementById('st-delivery-fee').value = s.delivery_fee;
      document.getElementById('st-service-fee').value = s.service_fee;
      document.getElementById('st-cod-limit').value = s.cod_limit;
      document.getElementById('st-confirm-threshold').value = s.bill_confirm_threshold;
      document.getElementById('st-accept-timeout').value = s.accept_timeout_minutes;
      document.getElementById('st-otp-attempts').value = s.otp_max_attempts;
      document.getElementById('st-cod-enabled').checked = s.cod_enabled;

    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }

  document.getElementById('form-platform-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.currentAdmin?.role === 'ops') {
      showToast('Ops role cannot edit settings (Owner only)', 'error');
      return;
    }

    const saveBtn = document.getElementById('btn-save-settings-bar');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const payload = {
      delivery_fee: Number(document.getElementById('st-delivery-fee').value),
      service_fee: Number(document.getElementById('st-service-fee').value),
      cod_limit: Number(document.getElementById('st-cod-limit').value),
      bill_confirm_threshold: Number(document.getElementById('st-confirm-threshold').value),
      accept_timeout_minutes: Number(document.getElementById('st-accept-timeout').value),
      otp_max_attempts: Number(document.getElementById('st-otp-attempts').value),
      cod_enabled: document.getElementById('st-cod-enabled').checked,
    };

    try {
      const res = await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';

      if (res.ok && data.success) {
        showToast('Platform settings saved and logged in audit ledger', 'success');
      } else {
        showToast(data.message || 'Validation error saving settings', 'error');
      }
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
      showToast('Connection error saving settings', 'error');
    }
  });

  async function loadTemplates() {
    try {
      const res = await fetch('/api/v1/admin/templates');
      const data = await res.json();
      if (!res.ok || !data.success) return;

      state.settings.templates = data.templates || [];
      renderTemplatesList();
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  }

  function renderTemplatesList() {
    const container = document.getElementById('templates-list-container');
    const lang = state.settings.templateLang;
    const filtered = state.settings.templates.filter((t) => t.language === lang);

    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `<p style="font-size: 13px; color: #94A3B8;">No templates found for ${lang.toUpperCase()}.</p>`;
      return;
    }

    const isOps = state.currentAdmin?.role === 'ops';

    container.innerHTML = filtered.map((tmpl) => `
      <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; background: #FFFFFF; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="font-size: 14px; color: #1E293B;">${escapeHtml(tmpl.title || tmpl.key)}</strong>
            <span style="font-size: 12px; color: #64748B; margin-left: 8px;">(Trigger: <code>${escapeHtml(tmpl.key)}</code>)</span>
          </div>
          <span class="pill-status pill-${tmpl.isActive ? 'approved' : 'offline'}" style="font-size: 11px;">${tmpl.isActive ? 'Active' : 'Disabled'}</span>
        </div>

        <textarea class="form-input template-body-input" data-id="${tmpl.id}" rows="2" ${isOps ? 'disabled' : ''} style="font-size: 13px;">${escapeHtml(tmpl.templateBody)}</textarea>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span style="font-size: 11px; color: #94A3B8;">Variables: <code>{customer_name}</code>, <code>{order_number}</code>, <code>{amount}</code>, <code>{tracking_url}</code></span>
          ${!isOps ? `
            <button type="button" class="btn-secondary btn-save-template" data-id="${tmpl.id}" style="height: 30px; padding: 0 12px; font-size: 12px;">
              Save Template
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-save-template').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const textarea = container.querySelector(`.template-body-input[data-id="${id}"]`);
        if (textarea) saveMessageTemplate(id, textarea.value.trim());
      });
    });
  }

  async function saveMessageTemplate(id, bodyText) {
    if (state.currentAdmin?.role === 'ops') {
      showToast('Ops role cannot edit templates', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateBody: bodyText }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Message template updated and logged in audit trail', 'success');
        loadTemplates();
      } else {
        showToast(data.message || 'Failed to update template', 'error');
      }
    } catch (err) {
      showToast('Error saving template', 'error');
    }
  }

  /* ========================================================================
     MODAL CONTROLS & EVENT LISTENERS
     ======================================================================== */
  function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('open');
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('open');
  }

  // Global escape key and close buttons
  document.querySelectorAll('.btn-close-modal, [data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      if (targetId) closeModal(targetId);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-overlay.open').forEach((m) => m.classList.remove('open'));
      closeCashDrawer();
    }
  });

  // Sidebar navigation bindings
  ['orders', 'riders', 'cash', 'customers', 'reports', 'settings'].forEach((s) => {
    document.getElementById(`nav-btn-${s}`)?.addEventListener('click', () => setScreen(s));
  });

  // Breadcrumbs
  document.getElementById('crumb-root')?.addEventListener('click', (e) => {
    e.preventDefault();
    setScreen('orders');
  });

  // Orders Filter Events
  document.getElementById('filter-order-search')?.addEventListener('input', (e) => {
    state.orders.search = e.target.value.trim();
    state.orders.page = 1;
    loadOrders();
  });

  document.getElementById('filter-order-rider')?.addEventListener('change', (e) => {
    state.orders.selectedRider = e.target.value;
    state.orders.page = 1;
    loadOrders();
  });

  document.getElementById('filter-order-start-date')?.addEventListener('change', (e) => {
    state.orders.startDate = e.target.value;
    state.orders.page = 1;
    loadOrders();
  });

  document.getElementById('filter-order-end-date')?.addEventListener('change', (e) => {
    state.orders.endDate = e.target.value;
    state.orders.page = 1;
    loadOrders();
  });

  document.getElementById('btn-clear-order-filters')?.addEventListener('click', () => {
    document.getElementById('filter-order-search').value = '';
    document.getElementById('filter-order-rider').value = 'all';
    document.getElementById('filter-order-start-date').value = '';
    document.getElementById('filter-order-end-date').value = '';
    state.orders.search = '';
    state.orders.selectedRider = 'all';
    state.orders.startDate = '';
    state.orders.endDate = '';
    state.orders.page = 1;
    loadOrders();
  });

  // Status multiselect dropdown toggle
  const statusMultiselectBtn = document.getElementById('btn-status-multiselect');
  const statusMultiselectDropdown = document.getElementById('dropdown-status-multiselect');
  statusMultiselectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    statusMultiselectDropdown?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!statusMultiselectDropdown?.contains(e.target) && e.target !== statusMultiselectBtn) {
      statusMultiselectDropdown?.classList.remove('open');
    }
  });

  document.getElementById('btn-status-apply')?.addEventListener('click', () => {
    const checked = Array.from(statusMultiselectDropdown.querySelectorAll('input:checked')).map((i) => i.value);
    state.orders.selectedStatus = checked;
    document.getElementById('txt-status-filter-label').textContent = checked.length === 6 ? 'All Statuses' : `${checked.length} selected`;
    statusMultiselectDropdown.classList.remove('open');
    state.orders.page = 1;
    loadOrders();
  });

  document.getElementById('btn-status-select-all')?.addEventListener('click', () => {
    statusMultiselectDropdown.querySelectorAll('input').forEach((i) => (i.checked = true));
  });

  // Pagination navigation
  document.getElementById('btn-orders-prev')?.addEventListener('click', () => {
    if (state.orders.page > 1) {
      state.orders.page -= 1;
      loadOrders();
    }
  });

  document.getElementById('btn-orders-next')?.addEventListener('click', () => {
    if (state.orders.page < state.orders.totalPages) {
      state.orders.page += 1;
      loadOrders();
    }
  });

  document.getElementById('btn-manual-refresh-orders')?.addEventListener('click', () => {
    state.orders.countdown = 15;
    loadOrders();
    showToast('Orders refreshed', 'info');
  });

  // Detail actions
  document.getElementById('btn-back-to-orders')?.addEventListener('click', () => setScreen('orders'));
  document.getElementById('btn-detail-reassign')?.addEventListener('click', openAssignRiderDialog);
  document.getElementById('btn-detail-cancel')?.addEventListener('click', openCancelOrderDialog);
  document.getElementById('btn-cancel-create-order')?.addEventListener('click', () => setScreen('orders'));

  // Riders Sub-tabs
  document.getElementById('tab-riders-all')?.addEventListener('click', () => {
    state.riders.tab = 'all';
    document.getElementById('tab-riders-all').classList.add('active');
    document.getElementById('tab-riders-pending').classList.remove('active');
    renderRidersTable();
  });

  document.getElementById('tab-riders-pending')?.addEventListener('click', () => {
    state.riders.tab = 'pending';
    document.getElementById('tab-riders-pending').classList.add('active');
    document.getElementById('tab-riders-all').classList.remove('active');
    renderRidersTable();
  });

  document.getElementById('btn-open-add-rider')?.addEventListener('click', () => openModal('modal-add-rider'));
  document.getElementById('btn-open-cash-entry')?.addEventListener('click', () => openAddCashModal());

  // Customer search & pagination
  document.getElementById('filter-customer-search')?.addEventListener('input', (e) => {
    state.customers.search = e.target.value.trim();
    state.customers.page = 1;
    loadCustomers();
  });

  document.getElementById('btn-customers-prev')?.addEventListener('click', () => {
    if (state.customers.page > 1) {
      state.customers.page -= 1;
      loadCustomers();
    }
  });

  document.getElementById('btn-customers-next')?.addEventListener('click', () => {
    if (state.customers.page < state.customers.totalPages) {
      state.customers.page += 1;
      loadCustomers();
    }
  });

  // Reports Filter & Export
  document.getElementById('btn-filter-reports')?.addEventListener('click', () => {
    state.reports.startDate = document.getElementById('report-start-date').value;
    state.reports.endDate = document.getElementById('report-end-date').value;
    loadReports();
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', exportReportsCsv);

  // Settings Sub-tabs
  document.getElementById('tab-settings-params')?.addEventListener('click', () => {
    document.getElementById('tab-settings-params').classList.add('active');
    document.getElementById('tab-settings-templates').classList.remove('active');
    document.getElementById('pane-settings-params').style.display = 'block';
    document.getElementById('pane-settings-templates').style.display = 'none';
  });

  document.getElementById('tab-settings-templates')?.addEventListener('click', () => {
    document.getElementById('tab-settings-templates').classList.add('active');
    document.getElementById('tab-settings-params').classList.remove('active');
    document.getElementById('pane-settings-params').style.display = 'none';
    document.getElementById('pane-settings-templates').style.display = 'block';
  });

  // Template Language toggles
  document.getElementById('btn-tmpl-lang-en')?.addEventListener('click', () => {
    state.settings.templateLang = 'en';
    document.getElementById('btn-tmpl-lang-en').style.background = '#FFFFFF';
    document.getElementById('btn-tmpl-lang-en').style.fontWeight = '600';
    document.getElementById('btn-tmpl-lang-hi').style.background = 'transparent';
    document.getElementById('btn-tmpl-lang-hi').style.fontWeight = '400';
    renderTemplatesList();
  });

  document.getElementById('btn-tmpl-lang-hi')?.addEventListener('click', () => {
    state.settings.templateLang = 'hi';
    document.getElementById('btn-tmpl-lang-hi').style.background = '#FFFFFF';
    document.getElementById('btn-tmpl-lang-hi').style.fontWeight = '600';
    document.getElementById('btn-tmpl-lang-en').style.background = 'transparent';
    document.getElementById('btn-tmpl-lang-en').style.fontWeight = '400';
    renderTemplatesList();
  });

  // Logout button
  document.getElementById('btn-sidebar-logout')?.addEventListener('click', async () => {
    try {
      await fetch('/api/v1/admin/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin/login';
    }
  });

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose global methods for modal onclick callbacks
  window.AntigravityAdmin = {
    viewOrderFromModal: (orderId) => {
      closeModal('modal-customer-history');
      openOrderDetail(orderId);
    },
  };

  // Populate fleet riders dropdown into orders filter
  async function populateRidersFilter() {
    try {
      const res = await fetch('/api/v1/admin/riders');
      const data = await res.json();
      if (res.ok && data.riders) {
        const select = document.getElementById('filter-order-rider');
        if (select) {
          select.innerHTML = `
            <option value="all">All Riders</option>
            <option value="unassigned">Unassigned Only</option>
            ${data.riders.map((r) => `<option value="${r.id}">${escapeHtml(r.name)} (${r.isOnline ? 'Online' : 'Offline'})</option>`).join('')}
          `;
        }
      }
    } catch (err) {
      console.warn('Could not populate riders filter:', err);
    }
  }

  // Initialization
  async function init() {
    await initAuth();
    populateRidersFilter();
    setScreen('orders');
    startOrdersPolling();
  }

  init();

})();

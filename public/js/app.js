/**
 * ESTIMATE PRO - MAIN FRONTEND APP LOGIC
 * Matching estimate_generator_page.dart specification & features
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let estimates = [];
  let currentFilterStatus = 'all';
  let currentSearchQuery = '';
  let activeEditingId = null;

  // DOM Elements
  const dbStatusText = document.getElementById('dbStatusText');
  const dbStatus = document.getElementById('dbStatus');
  
  // Metric Elements
  const metricTotalCount = document.getElementById('metricTotalCount');
  const metricTotalValue = document.getElementById('metricTotalValue');
  const metricDraftCount = document.getElementById('metricDraftCount');
  const metricFinalCount = document.getElementById('metricFinalCount');

  // Toolbar & Table Elements
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const filterPills = document.querySelectorAll('.pill-btn');
  const estimatesTableBody = document.getElementById('estimatesTableBody');
  const recordsCount = document.getElementById('recordsCount');

  // Modal Elements
  const btnNewEstimate = document.getElementById('btnNewEstimate');
  const estimateModal = document.getElementById('estimateModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const estimateForm = document.getElementById('estimateForm');
  const modalTitle = document.getElementById('modalTitle');
  const estimateIdInput = document.getElementById('estimateId');
  const isGstEnabledCheckbox = document.getElementById('isGstEnabled');

  // Items Table Elements
  const itemsTableBody = document.getElementById('itemsTableBody');
  const btnAddItem = document.getElementById('btnAddItem');

  // Calculation Summary Elements
  const calcTotalQty = document.getElementById('calcTotalQty');
  const calcSubtotal = document.getElementById('calcSubtotal');
  const calcTotalGst = document.getElementById('calcTotalGst');
  const calcGrandTotal = document.getElementById('calcGrandTotal');

  // Print Modal Elements
  const printModal = document.getElementById('printModal');
  const btnClosePrintModal = document.getElementById('btnClosePrintModal');
  const printableInvoiceContent = document.getElementById('printableInvoiceContent');

  // Utility: Format Currency (INR)
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  }

  // Convert Number to Words (Rupees & Paise) - Matching Flutter estimate_generator_page.dart
  function numberToWords(amount) {
    if (!amount || amount === 0) return 'Zero Rupees only';

    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertLessThanOneThousand(number) {
      if (number <= 0) return '';
      let soFar = '';
      if (number % 100 < 20) {
        soFar = units[number % 100];
        number = Math.floor(number / 100);
      } else {
        soFar = units[number % 10];
        number = Math.floor(number / 10);
        soFar = tens[number % 10] + (soFar ? ' ' + soFar : '');
        number = Math.floor(number / 10);
      }
      if (number === 0) return soFar;
      return units[number] + ' Hundred' + (soFar ? ' and ' + soFar : '');
    }

    let numVal = Math.floor(amount);
    let words = '';

    const crores = Math.floor(numVal / 10000000);
    numVal %= 10000000;

    const lakhs = Math.floor(numVal / 100000);
    numVal %= 100000;

    const thousands = Math.floor(numVal / 1000);
    numVal %= 1000;

    const hundreds = numVal;

    if (crores > 0) words += convertLessThanOneThousand(crores) + ' Crore ';
    if (lakhs > 0) words += convertLessThanOneThousand(lakhs) + ' Lakh ';
    if (thousands > 0) words += convertLessThanOneThousand(thousands) + ' Thousand ';
    if (hundreds > 0) words += convertLessThanOneThousand(hundreds) + ' ';

    words = words.trim();

    const paise = Math.round((amount - Math.floor(amount)) * 100);
    let paiseStr = '';
    if (paise > 0) {
      paiseStr = ' and ' + convertLessThanOneThousand(paise) + ' Paise';
    }

    return (words ? words + ' Rupees' : '') + paiseStr + ' only';
  }

  // 1. Health Check & Server Status
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.status === 'ok') {
        if (data.dbState === 'connected') {
          dbStatusText.textContent = 'MongoDB Connected';
          dbStatus.classList.remove('disconnected');
        } else {
          dbStatusText.textContent = 'DB Disconnected (Fallback)';
          dbStatus.classList.add('disconnected');
        }
      }
    } catch (err) {
      dbStatusText.textContent = 'Server Offline';
      dbStatus.classList.add('disconnected');
    }
  }

  // 2. Fetch Estimates from API
  async function loadEstimates() {
    try {
      let url = `/api/estimates?status=${currentFilterStatus}`;
      if (currentSearchQuery.trim()) {
        url += `&search=${encodeURIComponent(currentSearchQuery.trim())}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        estimates = data.estimates || [];
        updateMetrics(data.stats);
        renderTable(estimates);
      } else {
        showTableError(data.message || 'Failed to load estimates');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showTableError('Network error connecting to backend API');
    }
  }

  // Update Dashboard Cards
  function updateMetrics(stats) {
    if (!stats) return;
    metricTotalCount.textContent = stats.totalCount || 0;
    metricTotalValue.textContent = formatCurrency(stats.totalValue || 0);
    metricDraftCount.textContent = stats.draftCount || 0;
    metricFinalCount.textContent = stats.finalizedCount || 0;
  }

  // Render Estimates Table
  function renderTable(dataList) {
    recordsCount.textContent = `Showing ${dataList.length} record${dataList.length === 1 ? '' : 's'}`;

    if (dataList.length === 0) {
      estimatesTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4" style="color: var(--text-muted);">
            <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>
            No estimates found matching criteria.
          </td>
        </tr>
      `;
      return;
    }

    estimatesTableBody.innerHTML = dataList.map(est => {
      const dateStr = est.estimateDate ? new Date(est.estimateDate).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric'
      }) : '-';

      const statusClass = est.status === 'finalized' ? 'finalized' : 'draft';
      const statusIcon = est.status === 'finalized' ? 'fa-circle-check' : 'fa-pen-ruler';

      return `
        <tr>
          <td><span class="estimate-no-badge">${est.estimateNo}</span></td>
          <td>${dateStr}</td>
          <td><strong>${est.clientName}</strong></td>
          <td>${est.companyName || 'KRISHIKRANTI'}</td>
          <td>${est.totalQty || 0}</td>
          <td><strong style="color: var(--accent-emerald);">${formatCurrency(est.grandTotal)}</strong></td>
          <td>
            <span class="status-badge ${statusClass}">
              <i class="fa-solid ${statusIcon}"></i> ${est.status}
            </span>
          </td>
          <td class="text-right">
            <div class="action-btns">
              <button class="btn btn-icon-only btn-view" title="Print / View Invoice" onclick="viewEstimate('${est._id}')">
                <i class="fa-solid fa-print"></i>
              </button>
              <button class="btn btn-icon-only btn-edit" title="Edit Estimate" onclick="editEstimate('${est._id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn btn-icon-only btn-delete" title="Delete Estimate" onclick="deleteEstimate('${est._id}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function showTableError(msg) {
    estimatesTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4" style="color: var(--accent-rose);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 8px; display: block;"></i>
          ${msg}
        </td>
      </tr>
    `;
  }

  // 3. Dynamic Items Table in Modal
  function addItemRow(item = {}) {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;
    const defaultGst = item.gst !== undefined ? item.gst : (isGstOn ? 18 : 0);

    tr.innerHTML = `
      <td>
        <input type="text" class="item-name" placeholder="Product or Service Name" value="${item.name || ''}" required />
      </td>
      <td>
        <input type="number" class="item-qty" min="1" step="any" placeholder="1" value="${item.quantity || 1}" required />
      </td>
      <td>
        <input type="text" class="item-unit" placeholder="liter / kg / PCS" value="${item.unit || 'liter'}" />
      </td>
      <td>
        <input type="number" class="item-price" min="0" step="any" placeholder="0.00" value="${item.price || ''}" required />
      </td>
      <td>
        <input type="number" class="item-gst" min="0" step="any" placeholder="0" value="${defaultGst}" ${!isGstOn ? 'disabled' : ''} />
      </td>
      <td>
        <input type="number" class="item-amount" placeholder="0.00" value="${item.amount || ''}" readonly />
      </td>
      <td class="text-center">
        <button type="button" class="btn-remove-row" title="Remove Item"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;

    // Add calculation listeners
    const inputs = tr.querySelectorAll('.item-qty, .item-price, .item-gst');
    inputs.forEach(input => {
      input.addEventListener('input', () => updateRowAmount(tr));
    });

    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
      if (itemsTableBody.children.length > 1) {
        tr.remove();
        calculateSummary();
      } else {
        alert('Estimate must contain at least one line item.');
      }
    });

    itemsTableBody.appendChild(tr);
    updateRowAmount(tr);
  }

  function updateRowAmount(row) {
    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const gstInput = row.querySelector('.item-gst');
    const gstPct = isGstOn ? (parseFloat(gstInput.value) || 0) : 0;

    const baseAmount = qty * price;
    const gstAmount = (baseAmount * gstPct) / 100;
    const totalAmount = baseAmount + gstAmount;

    row.querySelector('.item-amount').value = totalAmount.toFixed(2);
    calculateSummary();
  }

  function calculateSummary() {
    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;
    let totalQty = 0;
    let subtotal = 0;
    let totalGst = 0;
    let grandTotal = 0;

    const rows = itemsTableBody.querySelectorAll('.item-row');
    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      const gstInput = row.querySelector('.item-gst');
      if (!isGstOn) {
        gstInput.disabled = true;
      } else {
        gstInput.disabled = false;
      }
      const gstPct = isGstOn ? (parseFloat(gstInput.value) || 0) : 0;

      const baseAmount = qty * price;
      const gstAmount = (baseAmount * gstPct) / 100;

      totalQty += qty;
      subtotal += baseAmount;
      totalGst += gstAmount;
      grandTotal += (baseAmount + gstAmount);
    });

    calcTotalQty.textContent = totalQty;
    calcSubtotal.textContent = formatCurrency(subtotal);
    calcTotalGst.textContent = formatCurrency(isGstOn ? totalGst : 0);
    calcGrandTotal.textContent = formatCurrency(grandTotal);
  }

  if (isGstEnabledCheckbox) {
    isGstEnabledCheckbox.addEventListener('change', () => {
      calculateSummary();
    });
  }

  // 4. Modal Handlers (Create & Edit)
  function openEstimateModal(estimateData = null) {
    activeEditingId = estimateData ? estimateData._id : null;
    estimateIdInput.value = activeEditingId || '';
    itemsTableBody.innerHTML = '';

    if (estimateData) {
      modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Estimate (${estimateData.estimateNo})`;
      document.getElementById('estimateNo').value = estimateData.estimateNo || '';
      document.getElementById('estimateDate').value = estimateData.estimateDate || new Date().toISOString().split('T')[0];
      document.getElementById('status').value = estimateData.status || 'draft';
      if (isGstEnabledCheckbox) {
        isGstEnabledCheckbox.checked = estimateData.isGstEnabled !== undefined ? estimateData.isGstEnabled : true;
      }

      document.getElementById('companyName').value = estimateData.companyName || 'KRISHIKRANTI ORGANICS';
      document.getElementById('companyGst').value = estimateData.companyGst || '23ABEFK9255G1Z9';
      document.getElementById('companyState').value = estimateData.companyState || '23-Madhya Pradesh';
      document.getElementById('companyPhone').value = estimateData.companyPhone || '9399022060';
      document.getElementById('companyEmail').value = estimateData.companyEmail || 'krishikrantiorganics@gmail.com';
      document.getElementById('companyAddress').value = estimateData.companyAddress || 'EWS - 101, The Bellaire Appartment, Gondermau Gandhi Nagar, Bhopal 462036, Madhya Pradesh';

      document.getElementById('clientName').value = estimateData.clientName || '';
      document.getElementById('clientPhone').value = estimateData.clientPhone || '';
      document.getElementById('clientAddress').value = estimateData.clientAddress || '';
      document.getElementById('estimateNotes').value = estimateData.notes || 'Quotations valid for 15 days.';

      const saveBtn = document.getElementById('btnSaveEstimate');
      if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Estimate';

      if (estimateData.items && estimateData.items.length > 0) {
        estimateData.items.forEach(item => addItemRow(item));
      } else {
        addItemRow();
      }
    } else {
      modalTitle.innerHTML = `<i class="fa-solid fa-file-signature"></i> Create New Estimate`;
      estimateForm.reset();
      document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
      if (isGstEnabledCheckbox) isGstEnabledCheckbox.checked = true;

      const saveBtn = document.getElementById('btnSaveEstimate');
      if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Estimate';

      document.getElementById('companyName').value = 'KRISHIKRANTI ORGANICS';
      document.getElementById('companyGst').value = '23ABEFK9255G1Z9';
      document.getElementById('companyState').value = '23-Madhya Pradesh';
      document.getElementById('companyPhone').value = '9399022060';
      document.getElementById('companyEmail').value = 'krishikrantiorganics@gmail.com';
      document.getElementById('companyAddress').value = 'EWS - 101, The Bellaire Appartment, Gondermau Gandhi Nagar, Bhopal 462036, Madhya Pradesh';
      document.getElementById('estimateNotes').value = 'Quotations valid for 15 days.';
      
      addItemRow();
    }

    calculateSummary();
    estimateModal.classList.add('active');
  }

  function closeModal() {
    estimateModal.classList.remove('active');
    activeEditingId = null;
  }

  // 5. Submit Form (Save or Update)
  estimateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;

    // Extract item rows
    const items = [];
    const rows = itemsTableBody.querySelectorAll('.item-row');
    rows.forEach(row => {
      const gstVal = isGstOn ? (parseFloat(row.querySelector('.item-gst').value) || 0) : 0;
      items.push({
        name: row.querySelector('.item-name').value.trim(),
        quantity: parseFloat(row.querySelector('.item-qty').value) || 0,
        unit: row.querySelector('.item-unit').value.trim() || 'liter',
        price: parseFloat(row.querySelector('.item-price').value) || 0,
        gst: gstVal,
        amount: parseFloat(row.querySelector('.item-amount').value) || 0
      });
    });

    if (items.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    const payload = {
      estimateNo: document.getElementById('estimateNo').value.trim(),
      estimateDate: document.getElementById('estimateDate').value,
      status: document.getElementById('status').value,
      isGstEnabled: isGstOn,
      companyName: document.getElementById('companyName').value.trim(),
      companyGst: document.getElementById('companyGst').value.trim(),
      companyState: document.getElementById('companyState').value.trim(),
      companyPhone: document.getElementById('companyPhone').value.trim(),
      companyEmail: document.getElementById('companyEmail').value.trim(),
      companyAddress: document.getElementById('companyAddress').value.trim(),
      clientName: document.getElementById('clientName').value.trim(),
      clientPhone: document.getElementById('clientPhone').value.trim(),
      clientAddress: document.getElementById('clientAddress').value.trim(),
      items: items,
      notes: document.getElementById('estimateNotes').value.trim()
    };

    try {
      const isEdit = !!activeEditingId;
      const url = isEdit ? `/api/estimates/${activeEditingId}` : '/api/estimates';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        closeModal();
        loadEstimates();
      } else {
        alert(`Error saving estimate: ${data.message}`);
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      alert('Failed to connect to server when saving estimate.');
    }
  });

  // Global functions attached to window for inline HTML handlers
  window.editEstimate = function(id) {
    const est = estimates.find(e => e._id === id);
    if (est) openEstimateModal(est);
  };

  window.deleteEstimate = async function(id) {
    const est = estimates.find(e => e._id === id);
    const confirmName = est ? est.estimateNo : 'this estimate';
    if (!confirm(`Are you sure you want to delete ${confirmName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/estimates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadEstimates();
      } else {
        alert(`Failed to delete estimate: ${data.message}`);
      }
    } catch (err) {
      alert('Failed to execute delete request.');
    }
  };

  // Render Printable Invoice Preview matching Flutter estimate_generator_page.dart layout
  window.viewEstimate = function(id) {
    const est = estimates.find(e => e._id === id);
    if (!est) return;

    let subtotal = 0;
    let totalGst = 0;
    const isGstOn = est.isGstEnabled !== undefined ? est.isGstEnabled : true;

    const itemsHtml = (est.items || []).map((item, idx) => {
      const base = item.quantity * item.price;
      const gstAmt = isGstOn ? ((base * (item.gst || 0)) / 100) : 0;
      subtotal += base;
      totalGst += gstAmt;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${item.name}</strong></td>
          <td>${item.quantity} ${item.unit || 'liter'}</td>
          <td>₹${item.price ? item.price.toFixed(2) : '0.00'}</td>
          <td>${isGstOn ? (item.gst || 0) + '%' : '0%'}</td>
          <td class="text-right">₹${(item.amount || (base + gstAmt)).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const wordsText = numberToWords(est.grandTotal || (subtotal + totalGst));

    printableInvoiceContent.innerHTML = `
      <!-- Top Branding Container: Red Banner + Navy Block matching estimate_generator_page.dart -->
      <div style="background: #ffffff; padding: 24px; font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid #e2e8f0; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #c21820; padding-bottom: 16px;">
          <div>
            <h2 style="font-size: 24px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">${est.companyName || 'KRISHIKRANTI ORGANICS'}</h2>
            <p style="font-size: 12px; color: #475569; margin-top: 4px; max-width: 450px;">${est.companyAddress || 'EWS - 101, The Bellaire Appartment, Gondermau Gandhi Nagar, Bhopal 462036'}</p>
            <p style="font-size: 12px; color: #475569;">Ph: ${est.companyPhone || '9399022060'} | Email: ${est.companyEmail || 'krishikrantiorganics@gmail.com'}</p>
            ${isGstOn ? `<p style="font-size: 12px; color: #1e293b; font-weight: 600;">GSTIN: ${est.companyGst || '23ABEFK9255G1Z9'} | State: ${est.companyState || '23-Madhya Pradesh'}</p>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="background: #c21820; color: #ffffff; padding: 6px 18px; border-radius: 4px; display: inline-block; font-size: 18px; font-weight: 800; letter-spacing: 1px;">QUOTATION</div>
            <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 8px;">Est No: <span style="color: #2563eb;">${est.estimateNo}</span></div>
            <div style="font-size: 12px; color: #64748b;">Date: ${est.estimateDate}</div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Status: <strong>${est.status}</strong></div>
          </div>
        </div>

        <!-- Customer Bill To Box -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
          <h4 style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">CUSTOMER DETAILS (BILLED TO)</h4>
          <strong style="font-size: 16px; color: #0f172a;">${est.clientName}</strong>
          <p style="font-size: 13px; color: #334155; margin-top: 2px;">${est.clientAddress ? est.clientAddress.replace(/\n/g, '<br>') : 'N/A'}</p>
          <p style="font-size: 12px; color: #475569; margin-top: 2px;">Ph: ${est.clientPhone || 'N/A'}</p>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; font-size: 11px; text-transform: uppercase;">
              <th style="padding: 10px; text-align: left; width: 5%;">#</th>
              <th style="padding: 10px; text-align: left; width: 45%;">Item / Product Description</th>
              <th style="padding: 10px; text-align: left; width: 15%;">Qty</th>
              <th style="padding: 10px; text-align: left; width: 15%;">Rate (₹)</th>
              <th style="padding: 10px; text-align: left; width: 10%;">GST %</th>
              <th style="padding: 10px; text-align: right; width: 10%;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody style="font-size: 13px;">
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Amount in Words & Totals Summary -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px;">
          <div style="flex: 1; padding-right: 20px;">
            <div style="background: #f1f5f9; border-left: 4px solid #c21820; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #1e293b;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">AMOUNT IN WORDS:</span>
              <strong style="font-size: 13px; color: #0f172a;">${wordsText}</strong>
            </div>
            ${est.notes ? `
              <div style="margin-top: 14px; font-size: 12px; color: #475569;">
                <strong style="color: #1e293b;">Terms & Conditions:</strong>
                <p style="margin-top: 2px;">${est.notes.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}
          </div>

          <div style="width: 280px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #475569;">
              <span>Total Quantity:</span>
              <strong>${est.totalQty || 0}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #475569;">
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${isGstOn ? `
              <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #475569;">
                <span>Total GST:</span>
                <span>₹${totalGst.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 2px solid #1e293b; margin-top: 6px; padding-top: 8px; color: #0f172a;">
              <span>Grand Total:</span>
              <span style="color: #059669;">₹${(est.grandTotal || (subtotal + totalGst)).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Signature Block -->
        <div style="margin-top: 40px; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 220px;">
            <p style="font-size: 12px; font-weight: 700; color: #1e293b;">For ${est.companyName || 'KRISHIKRANTI ORGANICS'}</p>
            <div style="height: 45px;"></div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 4px; font-size: 11px; color: #64748b;">Authorised Signatory</div>
          </div>
        </div>
      </div>
    `;

    printModal.classList.add('active');
  };

  // Event Listeners
  btnNewEstimate.addEventListener('click', () => openEstimateModal());
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);
  btnAddItem.addEventListener('click', () => addItemRow());

  btnClosePrintModal.addEventListener('click', () => {
    printModal.classList.remove('active');
  });

  // Search input debouncing
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    btnClearSearch.style.display = currentSearchQuery ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadEstimates();
    }, 300);
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    btnClearSearch.style.display = 'none';
    loadEstimates();
  });

  // Filter Pills
  filterPills.forEach(btn => {
    btn.addEventListener('click', () => {
      filterPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilterStatus = btn.dataset.status;
      loadEstimates();
    });
  });

  // Initialize
  checkHealth();
  loadEstimates();
});

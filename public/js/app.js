/**
 * ESTIMATE PRO - MAIN FRONTEND APP LOGIC
 * Full-Screen Split Studio View & Real-Time Live Preview Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let estimates = [];
  let currentFilterStatus = 'all';
  let currentSearchQuery = '';
  let activeEditingId = null;

  // DOM Elements - Views & Header
  const mainHeader = document.getElementById('mainHeader');
  const historyView = document.getElementById('historyView');
  const studioView = document.getElementById('studioView');
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

  // Buttons & Controls
  const btnNewEstimate = document.getElementById('btnNewEstimate');
  const btnBackToHistory = document.getElementById('btnBackToHistory');
  const btnSaveDraft = document.getElementById('btnSaveDraft');
  const btnPrintStudio = document.getElementById('btnPrintStudio');
  const studioTitle = document.getElementById('studioTitle');
  const estimateIdInput = document.getElementById('estimateId');
  const isGstEnabledCheckbox = document.getElementById('isGstEnabled');

  // Form Fields
  const studioForm = document.getElementById('studioForm');
  const itemsTableBody = document.getElementById('itemsTableBody');
  const btnAddItem = document.getElementById('btnAddItem');
  const livePreviewContainer = document.getElementById('livePreviewContainer');

  // Utility: Format Currency (INR)
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  }

  // Convert Number to Words (Rupees & Paise)
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

  function updateMetrics(stats) {
    if (!stats) return;
    metricTotalCount.textContent = stats.totalCount || 0;
    metricTotalValue.textContent = formatCurrency(stats.totalValue || 0);
    metricDraftCount.textContent = stats.draftCount || 0;
    metricFinalCount.textContent = stats.finalizedCount || 0;
  }

  function renderTable(dataList) {
    recordsCount.textContent = `Showing ${dataList.length} record${dataList.length === 1 ? '' : 's'}`;

    if (dataList.length === 0) {
      estimatesTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4" style="color: var(--text-muted);">
            <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 8px; display: block;"></i>
            No estimates found. Click "Create Estimate" above to make your first estimate.
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
              <button class="btn btn-icon-only btn-view" title="Open Studio Preview" onclick="editEstimate('${est._id}')">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="btn btn-icon-only btn-edit" title="Edit in Studio" onclick="editEstimate('${est._id}')">
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

  // 3. Dynamic Item Row Addition
  function addItemRow(item = {}) {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;
    const defaultGst = item.gst !== undefined ? item.gst : (isGstOn ? 18 : 0);

    tr.innerHTML = `
      <td>
        <input type="text" class="item-name" placeholder="Product / Service Name" value="${item.name || ''}" required />
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

    // Real-time recalculation and live preview trigger
    const inputs = tr.querySelectorAll('.item-name, .item-qty, .item-unit, .item-price, .item-gst');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        updateRowAmount(tr);
        updateLivePreview();
      });
    });

    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
      if (itemsTableBody.children.length > 1) {
        tr.remove();
        updateLivePreview();
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
  }

  // 4. Real-Time Live Preview Renderer (Right Column Studio Panel)
  function updateLivePreview() {
    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;

    const companyName = document.getElementById('companyName').value.trim() || 'KRISHIKRANTI ORGANICS';
    const companyGst = document.getElementById('companyGst').value.trim() || '23ABEFK9255G1Z9';
    const companyState = document.getElementById('companyState').value.trim() || '23-Madhya Pradesh';
    const companyPhone = document.getElementById('companyPhone').value.trim() || '9399022060';
    const companyEmail = document.getElementById('companyEmail').value.trim() || 'krishikrantiorganics@gmail.com';
    const companyAddress = document.getElementById('companyAddress').value.trim() || 'EWS - 101, The Bellaire Appartment, Gondermau Gandhi Nagar, Bhopal 462036';

    const estimateNo = document.getElementById('estimateNo').value.trim() || 'EBS/26-27/EST/PREVIEW';
    const estimateDate = document.getElementById('estimateDate').value || new Date().toISOString().split('T')[0];
    const status = document.getElementById('status').value || 'draft';

    const clientName = document.getElementById('clientName').value.trim() || 'Customer Name (Type in left panel)';
    const clientPhone = document.getElementById('clientPhone').value.trim() || '-';
    const clientAddress = document.getElementById('clientAddress').value.trim() || 'Customer Address';
    const notes = document.getElementById('estimateNotes').value.trim() || '';

    // Collect Items
    let subtotal = 0;
    let totalGst = 0;
    let totalQty = 0;
    const rows = itemsTableBody.querySelectorAll('.item-row');

    const itemsHtml = Array.from(rows).map((row, idx) => {
      const name = row.querySelector('.item-name').value.trim() || `Item #${idx + 1}`;
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const unit = row.querySelector('.item-unit').value.trim() || 'liter';
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
      const rowTotal = baseAmount + gstAmount;

      subtotal += baseAmount;
      totalGst += gstAmount;
      totalQty += qty;

      return `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${idx + 1}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;"><strong>${name}</strong></td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${qty} ${unit}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">₹${price.toFixed(2)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${isGstOn ? gstPct + '%' : '0%'}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${rowTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const grandTotal = subtotal + (isGstOn ? totalGst : 0);
    const wordsText = numberToWords(grandTotal);

    livePreviewContainer.innerHTML = `
      <div style="background: #ffffff; padding: 24px; font-family: 'Plus Jakarta Sans', sans-serif; color: #1e293b; border-radius: 6px;">
        <!-- Header Branding Bar -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #c21820; padding-bottom: 16px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; margin: 0;">${companyName}</h2>
            <p style="font-size: 11px; color: #475569; margin-top: 4px; max-width: 420px;">${companyAddress}</p>
            <p style="font-size: 11px; color: #475569;">Ph: ${companyPhone} | Email: ${companyEmail}</p>
            ${isGstOn ? `<p style="font-size: 11px; color: #1e293b; font-weight: 600;">GSTIN: ${companyGst} | State: ${companyState}</p>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="background: #c21820; color: #ffffff; padding: 5px 16px; border-radius: 4px; display: inline-block; font-size: 16px; font-weight: 800; letter-spacing: 1px;">QUOTATION</div>
            <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-top: 6px;">Est No: <span style="color: #2563eb;">${estimateNo}</span></div>
            <div style="font-size: 11px; color: #64748b;">Date: ${estimateDate}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Status: <strong>${status}</strong></div>
          </div>
        </div>

        <!-- Billed To Box -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px;">
          <h4 style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin: 0 0 4px 0;">CUSTOMER DETAILS (BILLED TO)</h4>
          <strong style="font-size: 15px; color: #0f172a;">${clientName}</strong>
          <p style="font-size: 12px; color: #334155; margin-top: 2px;">${clientAddress ? clientAddress.replace(/\n/g, '<br>') : 'N/A'}</p>
          <p style="font-size: 11px; color: #475569; margin-top: 2px;">Ph: ${clientPhone}</p>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; font-size: 11px; text-transform: uppercase;">
              <th style="padding: 8px 10px; text-align: left; width: 5%;">#</th>
              <th style="padding: 8px 10px; text-align: left; width: 45%;">Item / Product Description</th>
              <th style="padding: 8px 10px; text-align: left; width: 15%;">Qty</th>
              <th style="padding: 8px 10px; text-align: left; width: 15%;">Rate (₹)</th>
              <th style="padding: 8px 10px; text-align: left; width: 10%;">GST %</th>
              <th style="padding: 8px 10px; text-align: right; width: 10%;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody style="font-size: 12px;">
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Amount in Words & Totals -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
          <div style="flex: 1;">
            <div style="background: #f1f5f9; border-left: 4px solid #c21820; padding: 10px 14px; border-radius: 4px; font-size: 11px; color: #1e293b;">
              <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block;">AMOUNT IN WORDS:</span>
              <strong style="font-size: 12px; color: #0f172a;">${wordsText}</strong>
            </div>
            ${notes ? `
              <div style="margin-top: 12px; font-size: 11px; color: #475569;">
                <strong style="color: #1e293b;">Terms & Conditions:</strong>
                <p style="margin-top: 2px;">${notes.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}
          </div>

          <div style="width: 250px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; color: #475569;">
              <span>Total Quantity:</span>
              <strong>${totalQty}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; color: #475569;">
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${isGstOn ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; color: #475569;">
                <span>Total GST:</span>
                <span>₹${totalGst.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; border-top: 2px solid #1e293b; margin-top: 6px; padding-top: 6px; color: #0f172a;">
              <span>Grand Total:</span>
              <span style="color: #059669;">₹${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Signature Block -->
        <div style="margin-top: 32px; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 200px;">
            <p style="font-size: 11px; font-weight: 700; color: #1e293b; margin: 0;">For ${companyName}</p>
            <div style="height: 35px;"></div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 4px; font-size: 10px; color: #64748b;">Authorised Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  // Attach real-time input listeners to all form inputs in studio
  const formInputIds = [
    'clientName', 'clientPhone', 'clientAddress',
    'estimateNo', 'estimateDate', 'status', 'isGstEnabled',
    'companyName', 'companyGst', 'companyState', 'companyPhone', 'companyEmail', 'companyAddress',
    'estimateNotes'
  ];

  formInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLivePreview);
      el.addEventListener('change', updateLivePreview);
    }
  });

  // 5. Open Studio Editor View
  function openStudioView(estimateData = null) {
    activeEditingId = estimateData ? estimateData._id : null;
    estimateIdInput.value = activeEditingId || '';
    itemsTableBody.innerHTML = '';

    if (estimateData) {
      studioTitle.textContent = `Edit Estimate (${estimateData.estimateNo})`;
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

      if (estimateData.items && estimateData.items.length > 0) {
        estimateData.items.forEach(item => addItemRow(item));
      } else {
        addItemRow();
      }
    } else {
      studioTitle.textContent = 'Create New Estimate';
      studioForm.reset();
      document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
      if (isGstEnabledCheckbox) isGstEnabledCheckbox.checked = true;

      document.getElementById('companyName').value = 'KRISHIKRANTI ORGANICS';
      document.getElementById('companyGst').value = '23ABEFK9255G1Z9';
      document.getElementById('companyState').value = '23-Madhya Pradesh';
      document.getElementById('companyPhone').value = '9399022060';
      document.getElementById('companyEmail').value = 'krishikrantiorganics@gmail.com';
      document.getElementById('companyAddress').value = 'EWS - 101, The Bellaire Appartment, Gondermau Gandhi Nagar, Bhopal 462036, Madhya Pradesh';
      document.getElementById('estimateNotes').value = 'Quotations valid for 15 days.';
      
      addItemRow();
    }

    // Switch View
    mainHeader.style.display = 'none';
    historyView.style.display = 'none';
    studioView.style.display = 'flex';

    updateLivePreview();
  }

  function showHistoryView() {
    studioView.style.display = 'none';
    mainHeader.style.display = 'flex';
    historyView.style.display = 'block';
    activeEditingId = null;
    loadEstimates();
  }

  // 6. Save Estimate Handler (API call)
  async function saveEstimateFromStudio() {
    const clientNameVal = document.getElementById('clientName').value.trim();
    if (!clientNameVal) {
      alert('Please enter customer name.');
      document.getElementById('clientName').focus();
      return;
    }

    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;
    const items = [];
    const rows = itemsTableBody.querySelectorAll('.item-row');
    rows.forEach(row => {
      const name = row.querySelector('.item-name').value.trim();
      if (name) {
        const gstVal = isGstOn ? (parseFloat(row.querySelector('.item-gst').value) || 0) : 0;
        items.push({
          name: name,
          quantity: parseFloat(row.querySelector('.item-qty').value) || 0,
          unit: row.querySelector('.item-unit').value.trim() || 'liter',
          price: parseFloat(row.querySelector('.item-price').value) || 0,
          gst: gstVal,
          amount: parseFloat(row.querySelector('.item-amount').value) || 0
        });
      }
    });

    if (items.length === 0) {
      alert('Please add at least one line item with description.');
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
      clientName: clientNameVal,
      clientPhone: document.getElementById('clientPhone').value.trim(),
      clientAddress: document.getElementById('clientAddress').value.trim(),
      items: items,
      notes: document.getElementById('estimateNotes').value.trim()
    };

    try {
      const isEdit = !!activeEditingId;
      const url = isEdit ? `/api/estimates/${activeEditingId}` : '/api/estimates';
      const method = isEdit ? 'PUT' : 'POST';

      btnSaveDraft.disabled = true;
      btnSaveDraft.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      btnSaveDraft.disabled = false;
      btnSaveDraft.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Estimate`;

      if (data.success) {
        showHistoryView();
      } else {
        alert(`Error saving estimate: ${data.message}`);
      }
    } catch (err) {
      btnSaveDraft.disabled = false;
      btnSaveDraft.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Estimate`;
      console.error('Error submitting form:', err);
      alert('Failed to connect to server when saving estimate.');
    }
  }

  // Global Handlers
  window.editEstimate = function(id) {
    const est = estimates.find(e => e._id === id);
    if (est) openStudioView(est);
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

  // Event Listeners
  btnNewEstimate.addEventListener('click', () => openStudioView());
  btnBackToHistory.addEventListener('click', showHistoryView);
  btnSaveDraft.addEventListener('click', saveEstimateFromStudio);
  btnPrintStudio.addEventListener('click', () => window.print());
  btnAddItem.addEventListener('click', () => addItemRow());

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

/**
 * ESTIMATE PRO - MAIN FRONTEND APP LOGIC
 * Exact mirror of Flutter export_helper_web.dart & estimate_generator_page.dart
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

  // Exact Currency Formatter from export_helper_web.dart (Indian Numbering System)
  function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return '₹ 0.00';
    const stringValue = Number(value).toFixed(2);
    const parts = stringValue.split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];

    if (integerPart.length <= 3) {
      return '₹ ' + integerPart + '.' + decimalPart;
    }

    const lastThree = integerPart.substring(integerPart.length - 3);
    const remaining = integerPart.substring(0, integerPart.length - 3);

    let formattedRemaining = '';
    let count = 0;
    for (let i = remaining.length - 1; i >= 0; i--) {
      formattedRemaining = remaining[i] + formattedRemaining;
      count++;
      if (count === 2 && i > 0) {
        formattedRemaining = ',' + formattedRemaining;
        count = 0;
      }
    }

    return '₹ ' + formattedRemaining + ',' + lastThree + '.' + decimalPart;
  }

  // Exact Number to Words from export_helper_web.dart
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

  // 4. Exact HTML Generator matching export_helper_web.dart
  function updateLivePreview() {
    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;

    const companyName = document.getElementById('companyName').value.trim() || 'KRISHIKRANTI ORGANICS';
    const companyGst = document.getElementById('companyGst').value.trim() || '23ABEFK9255G1Z9';
    const companyState = document.getElementById('companyState').value.trim() || '23-Madhya Pradesh';
    const companyPhone = document.getElementById('companyPhone').value.trim() || '9399022060';
    const companyEmail = document.getElementById('companyEmail').value.trim() || 'krishikrantiorganics@gmail.com';
    const companyAddress = document.getElementById('companyAddress').value.trim() || 'EWS - 101, The Bellaire Appartment, Gondermau Gandhi Nagar, Bhopal 462036, Madhya Pradesh';

    const estimateNo = document.getElementById('estimateNo').value.trim() || 'EBS/25-26/EST/02689';
    const date = document.getElementById('estimateDate').value || new Date().toLocaleDateString('en-GB');

    const clientName = document.getElementById('clientName').value.trim() || 'Customer Name (Type in left panel)';
    const clientPhone = document.getElementById('clientPhone').value.trim() || '-';
    const clientAddress = document.getElementById('clientAddress').value.trim() || 'Customer Address';

    let baseSubtotal = 0.0;
    let gstTotal = 0.0;
    let totalQuantity = 0;

    const rows = itemsTableBody.querySelectorAll('.item-row');
    const tableRows = Array.from(rows).map((row, i) => {
      const name = row.querySelector('.item-name').value.trim() || `Item #${i + 1}`;
      const qty = parseInt(row.querySelector('.item-qty').value) || 0;
      const unit = row.querySelector('.item-unit').value.trim() || 'liter';
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      const gstInput = row.querySelector('.item-gst');

      if (!isGstOn) {
        gstInput.disabled = true;
      } else {
        gstInput.disabled = false;
      }
      const gst = isGstOn ? (parseFloat(gstInput.value) || 0) : 0;

      const subtotal = price * qty;
      const gstAmt = subtotal * (gst / 100);
      const amt = subtotal + gstAmt;

      baseSubtotal += subtotal;
      gstTotal += gstAmt;
      totalQuantity += qty;

      const isOdd = i % 2 === 1;
      const rowClass = isOdd ? 'class="alternate-row"' : '';

      return `
        <tr ${rowClass}>
          <td class="center" style="text-align: center; padding: 12px 14px; border: 1px solid #E5E7EB;">${i + 1}</td>
          <td class="bold" style="font-weight: 700; color: #111827; padding: 12px 14px; border: 1px solid #E5E7EB;">${name}</td>
          <td class="center" style="text-align: center; padding: 12px 14px; border: 1px solid #E5E7EB;">${qty}</td>
          <td class="center" style="text-align: center; padding: 12px 14px; border: 1px solid #E5E7EB;">${unit}</td>
          <td class="num" style="text-align: right; padding: 12px 14px; border: 1px solid #E5E7EB;">${formatCurrency(price)}</td>
          ${isGstOn ? `<td class="center" style="text-align: center; padding: 12px 14px; border: 1px solid #E5E7EB;">${gst.toFixed(0)}%</td>` : ''}
          <td class="num" style="text-align: right; padding: 12px 14px; border: 1px solid #E5E7EB;">${formatCurrency(amt)}</td>
        </tr>
      `;
    }).join('\n');

    const grandTotal = baseSubtotal + gstTotal;
    const grandTotalWords = numberToWords(grandTotal);

    const formattedEmail = companyEmail.replace('@', '@<br>');
    let formattedAddress = companyAddress;
    if (formattedAddress.includes('Arvind Vihar')) {
      formattedAddress = formattedAddress
        .replace('Arvind Vihar, ', 'Arvind Vihar,<br>')
        .replace('Colony , ', 'Colony ,<br>');
    } else if (formattedAddress.includes('Bellaire')) {
      formattedAddress = formattedAddress
        .replace('Bellaire Appartment, ', 'Bellaire Appartment,<br>')
        .replace('Gandhi Nagar, ', 'Gandhi Nagar,<br>');
    }

    livePreviewContainer.innerHTML = `
      <div class="quotation-export-container" style="max-width: 900px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); background: #ffffff; color: #111827; position: relative; font-family: 'Plus Jakarta Sans', sans-serif;">
        <!-- Top Red Header Banner -->
        <div class="header-banner" style="background-color: #C21820; color: #ffffff; display: flex; align-items: stretch; height: 75px; position: absolute; top: 30px; right: 30px; width: 75%; border-radius: 0 4px 0 100px; z-index: 2; padding-left: 50px; box-sizing: border-box;">
          <div class="contact-col" style="display: flex; align-items: center; padding: 12px 14px; flex-grow: 1;">
            <div class="contact-item" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #ffffff; flex-shrink: 0;"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              <span class="contact-text" style="font-size: 11px; font-weight: 500; line-height: 1.3;">${companyPhone}</span>
            </div>
          </div>
          <div class="contact-col border-left" style="display: flex; align-items: center; padding: 12px 14px; flex-grow: 1; border-left: 1px solid rgba(255, 255, 255, 0.4);">
            <div class="contact-item" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #ffffff; flex-shrink: 0;"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <span class="contact-text" style="font-size: 11px; font-weight: 500; line-height: 1.3;">${formattedEmail}</span>
            </div>
          </div>
          <div class="contact-col border-left" style="display: flex; align-items: center; padding: 12px 14px; flex-grow: 1; border-left: 1px solid rgba(255, 255, 255, 0.4);">
            <div class="contact-item" style="display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #ffffff; flex-shrink: 0;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span class="contact-text" style="font-size: 10px; font-weight: 500; line-height: 1.3;">${formattedAddress}</span>
            </div>
          </div>
        </div>

        <!-- Meta Section & Dark Navy Wave -->
        <div class="meta-section" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; position: relative; height: 140px;">
          <div class="company-info-wave" style="background-color: #1A2536; color: #ffffff; padding: 50px 40px 12px 24px; border-radius: 0 0 100px 0; margin-left: -30px; width: 60%; box-sizing: border-box; position: relative;">
            <div class="logo-box" style="position: absolute; top: 10px; left: 24px; display: flex; align-items: center; justify-content: center; width: 100px; height: 50px; z-index: 10;">
              <span class="logo-text" style="color: #C21820; font-weight: 800; font-size: 22px; letter-spacing: 0.5px;">EBS</span>
            </div>
            <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff;">${companyName}</h1>
            ${isGstOn ? `<p style="margin: 2px 0; font-size: 11px; color: #E2E8F0; opacity: 0.9;">GSTIN: ${companyGst}</p>` : ''}
            <p style="margin: 2px 0; font-size: 11px; color: #E2E8F0; opacity: 0.9;">State: ${companyState}</p>
          </div>

          <div class="estimate-title-block" style="text-align: left; padding-right: 10px;">
            <h2 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">Estimate</h2>
            <table class="meta-details-table" style="border-collapse: collapse;">
              <tr>
                <td class="label" style="font-weight: 700; color: #374151; padding: 4px 8px 4px 0; font-size: 13px;">Estimate No.:</td>
                <td class="value bold" style="font-weight: 700; color: #111827; font-size: 13px;">${estimateNo}</td>
              </tr>
              <tr>
                <td class="label" style="font-weight: 700; color: #374151; padding: 4px 8px 4px 0; font-size: 13px;">Date:</td>
                <td class="value" style="font-weight: 700; color: #111827; font-size: 13px;">${date}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Client Section -->
        <div class="client-section" style="margin-bottom: 30px; display: flex; justify-content: space-between;">
          <div class="client-info-block" style="max-width: 65%;">
            <div class="section-label" style="color: #C21820; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Estimate For:</div>
            <div class="client-name" style="font-size: 18px; font-weight: 800; color: #000000; margin: 0 0 6px 0; text-transform: capitalize;">${clientName}</div>
            <div class="client-address" style="font-size: 13px; color: #4B5563; line-height: 1.5; margin: 0 0 8px 0;">${clientAddress ? clientAddress.replace(/\n/g, '<br>') : 'N/A'}</div>
            <div class="client-contact" style="font-size: 13px; color: #374151; font-weight: 700;">Contact No.: ${clientPhone}</div>
          </div>
        </div>

        <!-- Items Table -->
        <table class="items-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #C21820; color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase;">
              <th class="center" style="padding: 10px 14px; border: 1px solid #C21820; width: 5%; text-align: center;">#</th>
              <th style="padding: 10px 14px; border: 1px solid #C21820; text-align: left; width: ${isGstOn ? '40%' : '51%'}">Item name</th>
              <th class="center" style="padding: 10px 14px; border: 1px solid #C21820; width: 10%; text-align: center;">Quantity</th>
              <th class="center" style="padding: 10px 14px; border: 1px solid #C21820; width: 10%; text-align: center;">Unit</th>
              <th class="num" style="padding: 10px 14px; border: 1px solid #C21820; width: 11%; text-align: right;">Price/Unit</th>
              ${isGstOn ? '<th class="center" style="padding: 10px 14px; border: 1px solid #C21820; width: 11%; text-align: center;">GST</th>' : ''}
              <th class="num" style="padding: 10px 14px; border: 1px solid #C21820; width: 13%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row" style="background-color: #C21820; color: #ffffff; font-weight: 700;">
              <td class="center" style="padding: 10px 14px; border: 1px solid #C21820; text-align: center;"></td>
              <td style="padding: 10px 14px; border: 1px solid #C21820;">TOTAL</td>
              <td class="center" style="padding: 10px 14px; border: 1px solid #C21820; text-align: center;">${totalQuantity}</td>
              <td class="center" style="padding: 10px 14px; border: 1px solid #C21820;"></td>
              <td class="num" style="padding: 10px 14px; border: 1px solid #C21820;"></td>
              ${isGstOn ? '<td class="center" style="padding: 10px 14px; border: 1px solid #C21820;"></td>' : ''}
              <td class="num" style="padding: 10px 14px; border: 1px solid #C21820; text-align: right;">${formatCurrency(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Summary Section -->
        <div class="summary-section" style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 15px;">
          <div class="amount-words" style="max-width: 50%;">
            <div class="amount-words-title" style="color: #C21820; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Estimate Amount In Words</div>
            <div class="amount-words-text" style="font-size: 13px; color: #4B5563; line-height: 1.4;">${grandTotalWords}</div>
          </div>

          <div class="totals-box" style="width: 300px;">
            <table class="totals-table" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td class="label" style="padding: 8px 14px; font-size: 13px; color: #374151; border: 1px solid #E5E7EB; font-weight: 700;">${isGstOn ? 'Sub Total (Excl. GST)' : 'Total Amount'}</td>
                <td class="val" style="padding: 8px 14px; font-size: 13px; color: #374151; border: 1px solid #E5E7EB; text-align: right; font-weight: 700;">${formatCurrency(baseSubtotal)}</td>
              </tr>
              ${isGstOn ? `
              <tr>
                <td class="label" style="padding: 8px 14px; font-size: 13px; color: #374151; border: 1px solid #E5E7EB; font-weight: 700;">GST Total</td>
                <td class="val" style="padding: 8px 14px; font-size: 13px; color: #374151; border: 1px solid #E5E7EB; text-align: right; font-weight: 700;">${formatCurrency(gstTotal)}</td>
              </tr>
              ` : ''}
              <tr class="grand-total" style="background-color: #C21820; color: #ffffff; font-weight: 700;">
                <td class="label" style="padding: 8px 14px; font-size: 13px; border: 1px solid #C21820; font-weight: 700;">Grand Total</td>
                <td class="val" style="padding: 8px 14px; font-size: 13px; border: 1px solid #C21820; text-align: right; font-weight: 700;">${formatCurrency(grandTotal)}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Footer / Signatory -->
        <div class="footer-section" style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div class="sign-box" style="text-align: left; width: auto;"></div>
          <div class="sign-box" style="text-align: center; width: 220px;">
            <p style="margin: 0; font-size: 12px; color: #374151;">For : ${companyName}</p>
            <div class="stamp-area" style="height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
              <div style="width: 75px; height: 75px; border: 2px dashed rgba(60, 50, 160, 0.4); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: rgba(60, 50, 160, 0.5); font-size: 8px; font-weight: 700; text-transform: uppercase; transform: rotate(-10deg);">
                SEAL<span style="font-size: 12px; font-weight: 800;">STAMP</span>
              </div>
            </div>
            <div class="signatory-label" style="padding-top: 6px; font-size: 12px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">Authorized Signatory</div>
          </div>
        </div>

        <!-- Bottom Accent Bar -->
        <div class="bottom-accent" style="margin-top: 40px; height: 16px; background-color: #C21820; position: relative; border-radius: 0 0 8px 8px;">
          <div style="position: absolute; bottom: 0; right: 0; width: 250px; height: 48px; background-color: #1A2536; border-radius: 48px 0 8px 0;"></div>
        </div>
      </div>
    `;
  }

  // Attach real-time input listeners to form fields
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

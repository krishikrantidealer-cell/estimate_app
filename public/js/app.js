/**
 * ESTIMATE PRO - MAIN FRONTEND APP LOGIC
 * Exact 1:1 Mirror of KD Pannel EstimateGeneratorPage & export_helper_web.dart
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let estimates = [];
  let currentFilterStatus = 'all';
  let currentSearchQuery = '';
  let activeEditingId = null;

  // DOM Elements - Header & Views
  const mainHeader = document.getElementById('mainHeader');
  const btnHeaderBack = document.getElementById('btnHeaderBack');
  const headerTitle = document.getElementById('headerTitle');
  const headerSubtitle = document.getElementById('headerSubtitle');
  const dbStatusText = document.getElementById('dbStatusText');
  const dbStatus = document.getElementById('dbStatus');

  const historyView = document.getElementById('historyView');
  const studioView = document.getElementById('studioView');

  // Toolbar & Table
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const filterPills = document.querySelectorAll('.kd-pill');
  const estimatesTableBody = document.getElementById('estimatesTableBody');
  const recordsCount = document.getElementById('recordsCount');

  // Actions
  const btnNewEstimate = document.getElementById('btnNewEstimate');
  const studioHeaderActions = document.getElementById('studioHeaderActions');
  const btnSaveDraft = document.getElementById('btnSaveDraft');
  const btnPrintStudio = document.getElementById('btnPrintStudio');

  // Studio Form & Preview
  const studioForm = document.getElementById('studioForm');
  const estimateIdInput = document.getElementById('estimateId');
  const isGstEnabledCheckbox = document.getElementById('isGstEnabled');
  const itemsTableBody = document.getElementById('itemsTableBody');
  const btnAddItem = document.getElementById('btnAddItem');
  const livePreviewContainer = document.getElementById('livePreviewContainer');

  // Currency Formatter from export_helper_web.dart
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

  // Number to Words from export_helper_web.dart
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

  // 1. Health Check with Cold Start Indicator & Keep-Alive
  async function checkHealth() {
    dbStatusText.textContent = 'Checking server...';
    
    // Cold start timer indicator
    const wakeTimer = setTimeout(() => {
      dbStatusText.textContent = '⚡ Waking up server (Cold Start ~20s)...';
    }, 2500);

    try {
      const res = await fetch('/api/health');
      clearTimeout(wakeTimer);
      const data = await res.json();
      if (data.status === 'ok') {
        if (data.dbState === 'connected') {
          dbStatusText.textContent = 'MongoDB Connected';
          dbStatus.classList.remove('disconnected');
        } else {
          dbStatusText.textContent = 'DB Disconnected';
          dbStatus.classList.add('disconnected');
        }
      }
    } catch (err) {
      clearTimeout(wakeTimer);
      dbStatusText.textContent = 'Offline';
      dbStatus.classList.add('disconnected');
    }
  }

  // Client-side keep-alive ping every 8 minutes
  setInterval(() => {
    fetch('/api/health').catch(() => {});
  }, 8 * 60 * 1000);

  // Master estimate storage for 0ms instant client-side searching & tab filtering
  let allEstimates = [];

  // 2. Fetch Estimates History
  async function loadEstimates() {
    try {
      // Fetch all records from backend
      const res = await fetch('/api/estimates');
      const data = await res.json();

      if (data.success) {
        allEstimates = data.estimates || [];
        applyFiltersAndRender();
      } else {
        showTableError(data.message || 'Failed to load estimates');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showTableError('Network error connecting to backend API');
    }
  }

  // Instant 0ms Filter & Search Engine
  function applyFiltersAndRender() {
    let filtered = [...allEstimates];

    // Filter by Tab Status (All, Drafts, Finalized)
    if (currentFilterStatus && currentFilterStatus !== 'all') {
      filtered = filtered.filter(e => {
        const s = (e.status || 'draft').toLowerCase();
        return s === currentFilterStatus.toLowerCase();
      });
    }

    // Filter by Search Query
    if (currentSearchQuery && currentSearchQuery.trim()) {
      const q = currentSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(e => {
        const estNo = (e.estimateNo || '').toLowerCase();
        const client = (e.clientName || '').toLowerCase();
        const phone = (e.clientPhone || '').toLowerCase();
        const company = (e.companyName || '').toLowerCase();
        return estNo.includes(q) || client.includes(q) || phone.includes(q) || company.includes(q);
      });
    }

    renderTable(filtered);
  }

  function renderTable(dataList) {
    recordsCount.textContent = `${dataList.length} Record${dataList.length === 1 ? '' : 's'}`;

    if (dataList.length === 0) {
      estimatesTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5" style="color: var(--kd-text-muted);">
            <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 8px; display: block; color: #cbd5e1;"></i>
            No estimates found matching your filters.
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
          <td>${est.clientPhone || '-'}</td>
          <td>${est.totalQty || 0}</td>
          <td><strong style="color: var(--kd-primary-red);">${formatCurrency(est.grandTotal)}</strong></td>
          <td>
            <span class="status-badge ${statusClass}">
              <i class="fa-solid ${statusIcon}"></i> ${est.status}
            </span>
          </td>
          <td class="text-right">
            <div class="action-btns">
              <button class="btn-action-icon edit" title="Edit Quotation" onclick="editEstimate('${est._id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-action-icon delete" title="Delete Estimate" onclick="deleteEstimate('${est._id}')">
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
        <td colspan="8" class="text-center py-5" style="color: #e11d48;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 8px; display: block;"></i>
          ${msg}
        </td>
      </tr>
    `;
  }

  // 3. Simple Item Row Generator (Direct typing)
  function addItemRow(item = {}) {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    const isGstOn = isGstEnabledCheckbox ? isGstEnabledCheckbox.checked : true;
    const defaultGst = item.gst !== undefined ? item.gst : (isGstOn ? 18 : 0);

    tr.innerHTML = `
      <td>
        <input type="text" class="item-name" placeholder="Type product / item name..." value="${item.name || ''}" required />
      </td>
      <td>
        <input type="number" class="item-qty" min="1" step="any" placeholder="1" value="${item.quantity || 1}" required />
      </td>
      <td>
        <input type="text" class="item-unit" placeholder="liter / kg" value="${item.unit || 'liter'}" />
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
        <button type="button" class="btn-remove-item" title="Remove Item"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;

    const inputs = tr.querySelectorAll('.item-name, .item-qty, .item-unit, .item-price, .item-gst');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        updateRowAmount(tr);
        updateLivePreview();
      });
    });

    tr.querySelector('.btn-remove-item').addEventListener('click', () => {
      if (itemsTableBody.children.length > 1) {
        tr.remove();
        updateLivePreview();
      } else {
        alert('Quotation must contain at least one item.');
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

  // 4. Real-time Live Document Preview (1:1 with export_helper_web.dart)
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

    const clientName = document.getElementById('clientName').value.trim() || 'Abraham Ali';
    const clientPhone = document.getElementById('clientPhone').value.trim() || '9933617561';
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
          <td class="center">${i + 1}</td>
          <td class="bold">${name}</td>
          <td class="center">${qty}</td>
          <td class="center">${unit}</td>
          <td class="num">${formatCurrency(price)}</td>
          ${isGstOn ? `<td class="center">${gst.toFixed(0)}%</td>` : ''}
          <td class="num">${formatCurrency(amt)}</td>
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
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800&display=swap');
        
        .quotation-container-exact {
          font-family: 'Outfit', sans-serif;
          margin: 0 auto;
          padding: 30px;
          padding-top: 0;
          color: #111827;
          background-color: #fff;
          max-width: 900px;
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
        }

        .header-banner-exact {
          background-color: #C21820;
          color: #ffffff;
          display: flex;
          align-items: stretch;
          height: 75px;
          position: absolute;
          top: 0;
          right: 0;
          width: 82%;
          border-radius: 0 0 0 100px;
          z-index: 2;
          padding-left: 60px;
          box-sizing: border-box;
        }
        
        .logo-box-exact {
          position: absolute;
          top: 15px;
          left: 30px;
          background-color: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          width: 110px;
          height: 60px;
          z-index: 10;
        }
        
        .logo-img-exact {
          max-height: 55px;
          max-width: 100%;
          object-fit: contain;
        }
        
        .contact-col-exact {
          display: flex;
          align-items: center;
          padding: 12px 18px;
          flex-grow: 1;
        }
        
        .contact-col-exact.border-left {
          border-left: 1px solid rgba(255, 255, 255, 0.4);
        }
        
        .contact-item-exact {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .contact-icon-exact {
          width: 16px;
          height: 16px;
          fill: #ffffff;
          flex-shrink: 0;
        }
        
        .contact-text-exact {
          font-size: 11px;
          font-weight: 500;
          line-height: 1.3;
        }
        
        .meta-section-exact {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          position: relative;
          height: 150px;
        }
        
        .company-info-wave-exact {
          background-color: #1A2536;
          color: #ffffff;
          padding: 84px 30px 10px 30px;
          border-radius: 0 0 100px 0;
          margin-left: -30px;
          width: calc(55% + 30px);
          height: 100%;
          box-sizing: border-box;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          position: relative;
        }
        
        .company-info-wave-exact h1 {
          margin: 0 0 2px 0;
          font-size: 17px;
          font-weight: 800;
          color: #ffffff;
          line-height: 1.2;
        }
        
        .company-info-wave-exact p {
          margin: 1px 0 !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #ffffff !important;
          opacity: 1 !important;
          line-height: 1.3 !important;
        }
        
        .estimate-title-block-exact {
          text-align: left;
        }
        
        .estimate-title-block-exact h2 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.5px;
        }
        
        .meta-details-table-exact {
          border-collapse: collapse;
          margin-left: 0;
        }
        
        .meta-details-table-exact td {
          padding: 4px 12px;
          font-size: 13px;
        }
        
        .meta-details-table-exact td.label {
          font-weight: 700;
          color: #374151;
          padding-left: 0;
          text-align: left;
        }
        
        .meta-details-table-exact td.value {
          font-weight: 700;
          color: #111827;
          text-align: left;
        }
        
        .client-section-exact {
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
        }
        
        .client-info-block-exact {
          max-width: 60%;
        }
        
        .section-label-exact {
          color: #C21820;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        
        .client-name-exact {
          font-size: 18px;
          font-weight: 800;
          color: #000000;
          margin: 0 0 6px 0;
          text-transform: capitalize;
        }
        
        .client-address-exact {
          font-size: 13px;
          color: #4B5563;
          line-height: 1.5;
          margin: 0 0 8px 0;
        }
        
        .client-contact-exact {
          font-size: 13px;
          color: #374151;
          font-weight: 700;
        }
        
        .items-table-exact {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        .items-table-exact th {
          background-color: #C21820;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 10px 14px;
          border: 1px solid #C21820;
        }
        
        .items-table-exact th.center, .items-table-exact td.center {
          text-align: center;
        }
        
        .items-table-exact th.num, .items-table-exact td.num {
          text-align: right;
        }
        
        .items-table-exact td {
          padding: 12px 14px;
          border: 1px solid #E5E7EB;
          font-size: 13px;
          color: #374151;
        }
        
        .items-table-exact tr.alternate-row {
          background-color: #FFF5F5;
        }
        
        .items-table-exact td.bold {
          font-weight: 700;
          color: #111827;
        }
        
        .items-table-exact tr.total-row td {
          background-color: #C21820;
          color: #ffffff;
          font-weight: 700;
          border: 1px solid #C21820;
        }
        
        .summary-section-exact {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-top: 15px;
        }
        
        .amount-words-exact {
          max-width: 50%;
        }
        
        .amount-words-title-exact {
          color: #C21820;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        
        .amount-words-text-exact {
          font-size: 13px;
          color: #4B5563;
          line-height: 1.4;
        }
        
        .totals-box-exact {
          width: 300px;
        }
        
        .totals-table-exact {
          width: 100%;
          border-collapse: collapse;
        }
        
        .totals-table-exact td {
          padding: 8px 14px;
          font-size: 13px;
          color: #374151;
          border: 1px solid #E5E7EB;
        }
        
        .totals-table-exact td.label {
          font-weight: 700;
        }
        
        .totals-table-exact td.val {
          text-align: right;
          font-weight: 700;
        }
        
        .totals-table-exact tr.grand-total td {
          background-color: #C21820;
          color: #ffffff;
          font-weight: 700;
          border: 1px solid #C21820;
        }
        
        .footer-section-exact {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        
        .sign-box-exact {
          text-align: center;
          width: 220px;
        }
        
        .sign-box-exact p {
          margin: 0;
          font-size: 12px;
          color: #374151;
        }
        
        .stamp-area-exact {
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          position: relative;
        }
        
        .stamp-area-exact img {
          width: 180px;
          height: auto;
          max-width: 200px;
          object-fit: contain;
        }
        
        .signatory-label-exact {
          padding-top: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .bottom-accent-exact {
          margin-top: 40px;
          height: 16px;
          background-color: #C21820;
          position: relative;
          border-radius: 0 0 8px 8px;
        }
        
        .bottom-accent-exact::after {
          content: '';
          position: absolute;
          bottom: 0;
          right: 0;
          width: 250px;
          height: 48px;
          background-color: #1A2536;
          border-radius: 48px 0 8px 0;
        }
      </style>

      <div class="quotation-container-exact">
        <!-- Top Contact Banner -->
        <div class="header-banner-exact">
          <div class="contact-col-exact">
            <div class="contact-item-exact">
              <svg viewBox="0 0 24 24" class="contact-icon-exact"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              <span class="contact-text-exact">${companyPhone}</span>
            </div>
          </div>
          <div class="contact-col-exact border-left">
            <div class="contact-item-exact">
              <svg viewBox="0 0 24 24" class="contact-icon-exact"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <span class="contact-text-exact">${formattedEmail}</span>
            </div>
          </div>
          <div class="contact-col-exact border-left">
            <div class="contact-item-exact">
              <svg viewBox="0 0 24 24" class="contact-icon-exact"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span class="contact-text-exact">${formattedAddress}</span>
            </div>
          </div>
        </div>
        
        <!-- Meta Section & Logo -->
        <div class="meta-section-exact">
          <div class="company-info-wave-exact">
            <div class="logo-box-exact">
              <img src="assets/images/logo_copy.png" class="logo-img-exact" alt="Logo" onerror="this.outerHTML='<span style=\'color: #C21820; font-weight: 800; font-size: 20px;\'>EBS</span>'" />
            </div>
            <h1>${companyName}</h1>
            ${isGstOn ? `<p>GSTIN: ${companyGst}</p>` : ''}
            <p>State: ${companyState}</p>
          </div>
        </div>
        
        <!-- Client Section & Invoice Title/No/Date -->
        <div class="client-section-exact">
          <div class="client-info-block-exact">
            <div class="section-label-exact">Billed To:</div>
            <div class="client-name-exact">${clientName}</div>
            <div class="client-address-exact">${clientAddress ? clientAddress.replace(/\n/g, '<br>') : 'N/A'}</div>
            <div class="client-contact-exact">Contact No.: ${clientPhone}</div>
          </div>
          
          <div class="estimate-title-block-exact">
            <h2>Tax Invoice</h2>
            <table class="meta-details-table-exact">
              <tr>
                <td class="label">Invoice No.:</td>
                <td class="value bold" style="color: #111827;">${estimateNo}</td>
              </tr>
              <tr>
                <td class="label">Date:</td>
                <td class="value">${date}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Items Table -->
        <table class="items-table-exact">
          <thead>
            <tr>
              <th class="center" style="width: 5%">#</th>
              <th style="width: ${isGstOn ? '40%' : '51%'}">Item name</th>
              <th class="center" style="width: 10%">Quantity</th>
              <th class="center" style="width: 10%">Unit</th>
              <th class="num" style="width: 11%">Price/Unit</th>
              ${isGstOn ? '<th class="center" style="width: 11%">GST</th>' : ''}
              <th class="num" style="width: 13%">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td class="center"></td>
              <td>TOTAL</td>
              <td class="center">${totalQuantity}</td>
              <td class="center"></td>
              <td class="num"></td>
              ${isGstOn ? '<td class="center"></td>' : ''}
              <td class="num">${formatCurrency(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
        
        <!-- Summary Section -->
        <div class="summary-section-exact">
          <div class="amount-words-exact">
            <div class="amount-words-title-exact">Invoice Amount In Words</div>
            <div class="amount-words-text-exact">${grandTotalWords}</div>
          </div>
          
          <div class="totals-box-exact">
            <table class="totals-table-exact">
              <tr>
                <td class="label">${isGstOn ? 'Sub Total (Excl. GST)' : 'Total Amount'}</td>
                <td class="val">${formatCurrency(baseSubtotal)}</td>
              </tr>
              ${isGstOn ? `
              <tr>
                <td class="label">GST Total</td>
                <td class="val">${formatCurrency(gstTotal)}</td>
              </tr>
              ` : ''}
              <tr class="grand-total">
                <td class="label">Grand Total</td>
                <td class="val">${formatCurrency(grandTotal)}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Footer / Signatory -->
        <div class="footer-section-exact">
          <div class="sign-box-exact" style="text-align: left; width: auto;"></div>
          <div class="sign-box-exact">
            <p>For : ${companyName}</p>
            <div class="stamp-area-exact">
              <img src="assets/images/sign.png" alt="Official Seal" onerror="this.outerHTML='<div style=\'width: 75px; height: 75px; border: 2px dashed rgba(60, 50, 160, 0.4); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: rgba(60, 50, 160, 0.5); font-size: 8px; font-weight: 700;\'>SEAL<span style=\'font-size: 12px; font-weight: 800;\'>STAMP</span></div>'" />
            </div>
            <div class="signatory-label-exact">Authorized Signatory</div>
          </div>
        </div>
        
        <!-- Bottom Accent Bar -->
        <div class="bottom-accent-exact"></div>
      </div>
    `;
  }

  // Attach real-time input listeners to all form fields
  const formInputIds = [
    'clientName', 'clientPhone', 'clientAddress',
    'estimateNo', 'estimateDate', 'status', 'isGstEnabled',
    'companyName', 'companyGst', 'companyState', 'companyPhone', 'companyEmail', 'companyAddress'
  ];

  formInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLivePreview);
      el.addEventListener('change', updateLivePreview);
    }
  });

  // 5. Open Studio View
  function openStudioView(estimateData = null) {
    activeEditingId = estimateData ? estimateData._id : null;
    estimateIdInput.value = activeEditingId || '';
    itemsTableBody.innerHTML = '';

    if (estimateData) {
      headerTitle.textContent = 'Invoice Generator';
      headerSubtitle.textContent = 'Design custom tax invoices, view live preview & download PDF';
      btnHeaderBack.style.display = 'flex';
      btnNewEstimate.style.display = 'none';
      studioHeaderActions.style.display = 'flex';

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

      if (estimateData.items && estimateData.items.length > 0) {
        estimateData.items.forEach(item => addItemRow(item));
      } else {
        addItemRow();
      }
    } else {
      headerTitle.textContent = 'Invoice Generator';
      headerSubtitle.textContent = 'Design custom tax invoices, view live preview & download PDF';
      btnHeaderBack.style.display = 'flex';
      btnNewEstimate.style.display = 'none';
      studioHeaderActions.style.display = 'flex';

      studioForm.reset();
      
      const randomNo = Math.floor(1000 + Math.random() * 9000);
      document.getElementById('estimateNo').value = `EBS/25-26/INV/0${randomNo}`;
      document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
      if (isGstEnabledCheckbox) isGstEnabledCheckbox.checked = true;

      document.getElementById('companyName').value = 'KRISHIKRANTI ORGANICS';
      document.getElementById('companyGst').value = '23ABEFK9255G1Z9';
      document.getElementById('companyState').value = '23-Madhya Pradesh';
      document.getElementById('companyPhone').value = '9399022060';
      document.getElementById('companyEmail').value = 'krishikrantiorganics@gmail.com';
      document.getElementById('companyAddress').value = 'EWS - 101, The Bellaire Appartment, Gondermau Gandhi Nagar, Bhopal 462036, Madhya Pradesh';
      
      addItemRow();
    }

    historyView.style.display = 'none';
    studioView.style.display = 'block';

    updateLivePreview();
  }

  function showHistoryView() {
    headerTitle.textContent = 'Invoice History';
    headerSubtitle.textContent = 'Manage and edit created tax invoices';
    btnHeaderBack.style.display = 'none';
    btnNewEstimate.style.display = 'inline-flex';
    studioHeaderActions.style.display = 'none';

    studioView.style.display = 'none';
    historyView.style.display = 'block';
    activeEditingId = null;
    loadEstimates();
  }

  // 6. Save Estimate
  async function saveEstimateFromStudio(options = { goBack: true }) {
    const clientNameVal = document.getElementById('clientName').value.trim();
    if (!clientNameVal) {
      alert('Please enter customer name');
      document.getElementById('clientName').focus();
      return false;
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
      alert('Please enter at least one line item with a name.');
      return false;
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
      items: items
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
      btnSaveDraft.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save`;

      if (data.success) {
        if (data.estimate && data.estimate._id) {
          activeEditingId = data.estimate._id;
          estimateIdInput.value = data.estimate._id;
          if (data.estimate.estimateNo) {
            document.getElementById('estimateNo').value = data.estimate.estimateNo;
          }
        }
        if (options.goBack) {
          showHistoryView();
        }
        return true;
      } else {
        alert(`Error saving estimate: ${data.message}`);
        return false;
      }
    } catch (err) {
      btnSaveDraft.disabled = false;
      btnSaveDraft.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Draft`;
      console.error('Error submitting form:', err);
      alert('Failed to save estimate.');
      return false;
    }
  }

  // Global Handlers
  window.editEstimate = function(id) {
    const est = allEstimates.find(e => e._id === id);
    if (est) {
      openStudioView(est);
    } else {
      console.error('Invoice record not found for id:', id);
    }
  };

  window.deleteEstimate = async function(id) {
    const est = allEstimates.find(e => e._id === id);
    const confirmName = est ? est.estimateNo : 'this record';
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
      alert('Failed to delete estimate.');
    }
  };

  // Event Listeners
  btnNewEstimate.addEventListener('click', () => openStudioView());
  btnHeaderBack.addEventListener('click', showHistoryView);
  btnSaveDraft.addEventListener('click', () => saveEstimateFromStudio({ goBack: true }));
  
  btnPrintStudio.addEventListener('click', async () => {
    // ALWAYS Save estimate to MongoDB database FIRST!
    btnPrintStudio.disabled = true;
    btnPrintStudio.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    const saved = await saveEstimateFromStudio({ goBack: false });

    btnPrintStudio.disabled = false;
    btnPrintStudio.innerHTML = `<i class="fa-solid fa-download"></i> Download / Print`;

    if (!saved) return;

    const previewHtml = livePreviewContainer.innerHTML;
    const estNo = document.getElementById('estimateNo').value.trim() || 'Quotation';

    const printWin = window.open('', '_blank', 'width=950,height=1000');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Estimate - ${estNo}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800&display=swap');
            body {
              font-family: 'Outfit', sans-serif;
              margin: 0;
              padding: 30px;
              color: #111827;
              background-color: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-toolbar {
              max-width: 900px;
              margin: 0 auto 20px auto;
              background-color: #F3F4F6;
              padding: 12px 24px;
              border-radius: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border: 1px solid #E5E7EB;
            }
            .toolbar-title {
              font-size: 14px;
              font-weight: 700;
              color: #374151;
            }
            .print-btn {
              background-color: #C21820;
              color: #ffffff;
              border: none;
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 700;
              border-radius: 6px;
              cursor: pointer;
              font-family: inherit;
            }
            @media print {
              body { padding: 0; }
              .print-toolbar { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="print-toolbar">
            <span class="toolbar-title">Document Ready - Click Print to Save as PDF</span>
            <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
          </div>
          ${previewHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    } else {
      window.print();
    }
  });

  btnAddItem.addEventListener('click', () => addItemRow());

  // Search input debouncing
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    btnClearSearch.style.display = currentSearchQuery ? 'block' : 'none';
    applyFiltersAndRender();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    btnClearSearch.style.display = 'none';
    applyFiltersAndRender();
  });

  // Filter Pills
  filterPills.forEach(btn => {
    btn.addEventListener('click', () => {
      filterPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilterStatus = btn.dataset.status;
      applyFiltersAndRender();
    });
  });

  // Initialize
  checkHealth();
  loadEstimates();
});

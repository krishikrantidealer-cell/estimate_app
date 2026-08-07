const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Estimate = require('../models/Estimate');

// In-Memory Fallback Storage (Empty by default)
let memoryEstimates = [];

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// Helper to generate unique estimate number (e.g., EBS/26-27/EST/4912)
async function generateUniqueEstimateNo() {
  const now = new Date();
  const fullYear = now.getFullYear();
  const year = fullYear % 100;
  const nextYear = (fullYear + 1) % 100;
  const yearCode = `${year}-${nextYear < 10 ? '0' + nextYear : nextYear}`;

  let isUnique = false;
  let estimateNo = '';

  while (!isUnique) {
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    estimateNo = `EBS/${yearCode}/EST/${rand}`;
    if (isDbConnected()) {
      const existing = await Estimate.findOne({ estimateNo });
      if (!existing) isUnique = true;
    } else {
      const existing = memoryEstimates.find(e => e.estimateNo === estimateNo);
      if (!existing) isUnique = true;
    }
  }
  return estimateNo;
}

// GET /api/estimates - Get all estimates with search and filter
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;

    if (isDbConnected()) {
      const query = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { estimateNo: searchRegex },
          { clientName: searchRegex },
          { companyName: searchRegex },
          { clientPhone: searchRegex }
        ];
      }

      const estimates = await Estimate.find(query).sort({ createdAt: -1 });
      const totalCount = await Estimate.countDocuments();
      const draftCount = await Estimate.countDocuments({ status: 'draft' });
      const finalizedCount = await Estimate.countDocuments({ status: 'finalized' });
      const aggregateTotal = await Estimate.aggregate([
        { $group: { _id: null, totalValue: { $sum: '$grandTotal' } } }
      ]);
      const totalValue = aggregateTotal.length > 0 ? aggregateTotal[0].totalValue : 0;

      return res.status(200).json({
        success: true,
        count: estimates.length,
        stats: { totalCount, draftCount, finalizedCount, totalValue },
        estimates
      });
    } else {
      // In-Memory Fallback
      let list = [...memoryEstimates];

      if (status && status !== 'all') {
        list = list.filter(e => e.status === status);
      }

      if (search) {
        const s = search.toLowerCase();
        list = list.filter(e =>
          (e.estimateNo && e.estimateNo.toLowerCase().includes(s)) ||
          (e.clientName && e.clientName.toLowerCase().includes(s)) ||
          (e.companyName && e.companyName.toLowerCase().includes(s)) ||
          (e.clientPhone && e.clientPhone.toLowerCase().includes(s))
        );
      }

      const totalCount = memoryEstimates.length;
      const draftCount = memoryEstimates.filter(e => e.status === 'draft').length;
      const finalizedCount = memoryEstimates.filter(e => e.status === 'finalized').length;
      const totalValue = memoryEstimates.reduce((acc, e) => acc + (e.grandTotal || 0), 0);

      return res.status(200).json({
        success: true,
        count: list.length,
        stats: { totalCount, draftCount, finalizedCount, totalValue },
        estimates: list
      });
    }
  } catch (error) {
    console.error('Error fetching estimates:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching estimates', error: error.message });
  }
});

// GET /api/estimates/:id - Get estimate by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isDbConnected()) {
      const estimate = await Estimate.findById(id);
      if (!estimate) return res.status(404).json({ success: false, message: 'Estimate not found' });
      return res.status(200).json({ success: true, estimate });
    } else {
      const estimate = memoryEstimates.find(e => e._id === id);
      if (!estimate) return res.status(404).json({ success: false, message: 'Estimate not found' });
      return res.status(200).json({ success: true, estimate });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching estimate', error: error.message });
  }
});

// POST /api/estimates - Create new estimate
router.post('/', async (req, res) => {
  try {
    let {
      estimateNo,
      estimateDate,
      companyName,
      companyGst,
      companyState,
      companyPhone,
      companyEmail,
      companyAddress,
      clientName,
      clientAddress,
      clientPhone,
      items,
      status,
      notes
    } = req.body;

    if (!estimateNo || estimateNo.trim() === '') {
      estimateNo = await generateUniqueEstimateNo();
    }

    if (!estimateDate) {
      estimateDate = new Date().toISOString().split('T')[0];
    }

    const processedItems = (items || []).map(item => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const gst = Number(item.gst) || 0;
      const baseAmount = qty * price;
      const gstAmount = (baseAmount * gst) / 100;
      const amount = Number(item.amount) || Math.round((baseAmount + gstAmount) * 100) / 100;

      return {
        name: item.name,
        quantity: qty,
        unit: item.unit || 'PCS',
        price: price,
        gst: gst,
        amount: amount
      };
    });

    const totalQty = processedItems.reduce((acc, item) => acc + item.quantity, 0);
    const grandTotal = processedItems.reduce((acc, item) => acc + item.amount, 0);

    const docData = {
      estimateNo,
      estimateDate,
      companyName: companyName || 'KRISHIKRANTI ORGANICS',
      companyGst: companyGst || '',
      companyState: companyState || '',
      companyPhone: companyPhone || '',
      companyEmail: companyEmail || '',
      companyAddress: companyAddress || '',
      clientName,
      clientAddress: clientAddress || '',
      clientPhone: clientPhone || '',
      items: processedItems,
      totalQty,
      grandTotal: Math.round(grandTotal * 100) / 100,
      status: status || 'draft',
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      const newEstimate = await Estimate.create(docData);
      return res.status(201).json({
        success: true,
        message: 'Estimate created successfully in MongoDB',
        estimate: newEstimate
      });
    } else {
      docData._id = 'mem_' + Date.now();
      memoryEstimates.unshift(docData);
      return res.status(201).json({
        success: true,
        message: 'Estimate created successfully (In-Memory)',
        estimate: docData
      });
    }
  } catch (error) {
    console.error('Error creating estimate:', error);
    res.status(400).json({ success: false, message: 'Failed to create estimate', error: error.message });
  }
});

// PUT /api/estimates/:id - Update existing estimate
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.estimateNo;

    if (updateData.items && Array.isArray(updateData.items)) {
      updateData.items = updateData.items.map(item => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const gst = Number(item.gst) || 0;
        const baseAmount = qty * price;
        const gstAmount = (baseAmount * gst) / 100;
        const amount = Number(item.amount) || Math.round((baseAmount + gstAmount) * 100) / 100;

        return {
          name: item.name,
          quantity: qty,
          unit: item.unit || 'PCS',
          price: price,
          gst: gst,
          amount: amount
        };
      });

      updateData.totalQty = updateData.items.reduce((acc, item) => acc + item.quantity, 0);
      updateData.grandTotal = Math.round(updateData.items.reduce((acc, item) => acc + item.amount, 0) * 100) / 100;
    }
    updateData.updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updatedEstimate = await Estimate.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
      if (!updatedEstimate) return res.status(404).json({ success: false, message: 'Estimate not found' });
      return res.status(200).json({ success: true, message: 'Estimate updated successfully', estimate: updatedEstimate });
    } else {
      const idx = memoryEstimates.findIndex(e => e._id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Estimate not found' });

      memoryEstimates[idx] = { ...memoryEstimates[idx], ...updateData };
      return res.status(200).json({ success: true, message: 'Estimate updated successfully', estimate: memoryEstimates[idx] });
    }
  } catch (error) {
    console.error('Error updating estimate:', error);
    res.status(400).json({ success: false, message: 'Failed to update estimate', error: error.message });
  }
});

// DELETE /api/estimates/:id - Delete estimate
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isDbConnected()) {
      const estimate = await Estimate.findById(id);
      if (!estimate) return res.status(404).json({ success: false, message: 'Estimate not found' });
      await Estimate.findByIdAndDelete(id);
      return res.status(200).json({ success: true, message: 'Estimate deleted successfully' });
    } else {
      const idx = memoryEstimates.findIndex(e => e._id === id);
      if (idx === -1) return res.status(404).json({ success: false, message: 'Estimate not found' });
      memoryEstimates.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'Estimate deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting estimate:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting estimate', error: error.message });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const estimateItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'PCS', trim: true },
  price: { type: Number, required: true, min: 0 },
  gst: { type: Number, default: 0, min: 0 },
  amount: { type: Number, required: true, min: 0 }
});

const estimateSchema = new mongoose.Schema({
  estimateNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  estimateDate: {
    type: String,
    required: true
  },
  companyName: { type: String, required: true, trim: true },
  companyGst: { type: String, trim: true },
  companyState: { type: String, trim: true },
  companyPhone: { type: String, trim: true },
  companyEmail: { type: String, trim: true },
  companyAddress: { type: String, trim: true },

  clientName: { type: String, required: true, trim: true },
  clientAddress: { type: String, trim: true },
  clientPhone: { type: String, trim: true },

  items: [estimateItemSchema],
  totalQty: { type: Number, required: true, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'finalized'],
    default: 'draft'
  },
  notes: { type: String, trim: true }
}, {
  timestamps: true
});

// Indexes for ultra-fast database query performance
estimateSchema.index({ status: 1, createdAt: -1 });
estimateSchema.index({ clientName: 1 });
estimateSchema.index({ clientPhone: 1 });

const Estimate = mongoose.model('Estimate', estimateSchema);

module.exports = Estimate;

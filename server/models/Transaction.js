const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  transactionId: {
    type: String,
    unique: true,
    required: true
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'fee', 'upload'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['initiated', 'pending', 'paid', 'failed', 'cancelled', 'uploaded', 'completed'],
    default: 'initiated'
  },
  description: String,
  razorpayData: {
    orderId: String,
    paymentId: String,
    signature: String,
    method: String,
    provider: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  reconciliationStatus: {
    type: String,
    enum: ['pending', 'matched', 'unmatched'],
    default: 'pending'
  },
  reconciliationDate: Date,
  notes: String
}, {
  timestamps: true
});

// Indexes for transaction tracking
transactionSchema.index({ userId: 1 });
transactionSchema.index({ paymentId: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });

// Method to generate transaction ID
transactionSchema.statics.generateTransactionId = function() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN_${timestamp}_${random}`;
};

module.exports = mongoose.model('Transaction', transactionSchema);
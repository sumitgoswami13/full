const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'fee', 'upload', 'processing'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR']
  },
  status: {
    type: String,
    enum: ['initiated', 'pending', 'paid', 'failed', 'cancelled', 'uploaded', 'completed'],
    default: 'initiated',
    index: true
  },
  description: {
    type: String,
    required: true
  },
  razorpayData: {
    orderId: String,
    paymentId: String,
    signature: String,
    method: String,
    provider: String,
    bank: String,
    wallet: String
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
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ paymentId: 1 });
transactionSchema.index({ createdAt: -1 });

// Method to generate transaction ID
transactionSchema.statics.generateTransactionId = function() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN_${timestamp}_${random}`;
};

// Method to find by transaction ID or MongoDB _id
transactionSchema.statics.findByTransactionId = function(transactionId, userId = null) {
  const query = {
    $or: [
      { transactionId },
      { _id: mongoose.Types.ObjectId.isValid(transactionId) ? transactionId : null }
    ].filter(Boolean)
  };
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.findOne(query);
};

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.currency || 'INR'
  }).format(this.amount);
});

// Ensure virtuals are included in JSON
transactionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);
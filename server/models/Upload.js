const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'completed_with_errors', 'failed'],
    default: 'processing',
    index: true
  },
  fileCount: {
    type: Number,
    required: true,
    min: 1,
    max: 30
  },
  processedFiles: {
    type: Number,
    default: 0,
    min: 0
  },
  customerInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  pricingSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  errors: [{
    type: String
  }],
  transactionId: {
    type: String,
    index: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
uploadSchema.index({ userId: 1, status: 1 });
uploadSchema.index({ userId: 1, createdAt: -1 });
uploadSchema.index({ uploadId: 1, userId: 1 });

// Method to generate upload ID
uploadSchema.statics.generateUploadId = function() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `upload_${timestamp}_${random}`;
};

// Virtual for success rate
uploadSchema.virtual('successRate').get(function() {
  if (this.fileCount === 0) return 0;
  return Math.round((this.processedFiles / this.fileCount) * 100);
});

// Virtual for has errors
uploadSchema.virtual('hasErrors').get(function() {
  return this.errors && this.errors.length > 0;
});

// Ensure virtuals are included in JSON
uploadSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Upload', uploadSchema);
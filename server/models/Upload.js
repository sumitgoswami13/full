const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'completed_with_errors', 'failed'],
    default: 'processing'
  },
  fileCount: {
    type: Number,
    required: true,
    min: 1,
    max: 30
  },
  processedFiles: {
    type: Number,
    default: 0
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
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
uploadSchema.index({ userId: 1 });
uploadSchema.index({ uploadId: 1 });
uploadSchema.index({ status: 1 });
uploadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Upload', uploadSchema);
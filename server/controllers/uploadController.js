const { validationResult } = require('express-validator');
const uploadService = require('../services/uploadService');
const Transaction = require('../models/Transaction');

class UploadController {
  // Upload multiple files
  async uploadFiles(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      // Parse additional data from form
      let customerInfo = {};
      let pricingSnapshot = {};
      let metadata = {};

      try {
        if (req.body.customerInfo) {
          customerInfo = JSON.parse(req.body.customerInfo);
        }
        if (req.body.pricingSnapshot) {
          pricingSnapshot = JSON.parse(req.body.pricingSnapshot);
        }
        if (req.body.metadata) {
          metadata = JSON.parse(req.body.metadata);
        }
      } catch (parseError) {
        console.warn('Error parsing JSON data:', parseError);
      }

      // Parse file metadata
      const fileMetadata = {};
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('fileMetadata[')) {
          const match = key.match(/fileMetadata\[(\d+)\]\[(.+)\]/);
          if (match) {
            const index = parseInt(match[1]);
            const field = match[2];
            if (!fileMetadata[index]) {
              fileMetadata[index] = {};
            }
            fileMetadata[index][field] = req.body[key];
          }
        }
      });

      const uploadData = {
        files: req.files,
        fileMetadata,
        userId: req.user.id, // Always use authenticated user ID
        customerInfo,
        pricingSnapshot,
        metadata: {
          ...metadata,
          uploadTimestamp: req.body.uploadTimestamp || new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      };

      const result = await uploadService.processFileUpload(req.user.id, uploadData);

      // If there's a transaction ID in the pricing snapshot, update it
      if (pricingSnapshot?.transactionId) {
        try {
          await Transaction.findOneAndUpdate(
            { 
              $or: [
                { transactionId: pricingSnapshot.transactionId, userId: req.user.id },
                { _id: pricingSnapshot.transactionId, userId: req.user.id }
              ]
            },
            {
              status: 'uploaded',
              description: `Files uploaded successfully - ${result.processedFiles} documents processed`,
              metadata: {
                uploadId: result.uploadId,
                processedFiles: result.processedFiles,
                totalFiles: result.totalFiles,
                uploadTimestamp: new Date().toISOString()
              }
            }
          );
        } catch (updateError) {
          console.warn('Failed to update transaction status:', updateError);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Files uploaded successfully',
        data: result
      });

    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'File upload failed'
      });
    }
  }

  // Get upload status
  async getUploadStatus(req, res) {
    try {
      const { uploadId } = req.params;
      const status = await uploadService.getUploadStatus(req.user.id, uploadId);

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Get upload status error:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Upload not found'
      });
    }
  }

  // Get user uploads
  async getUserUploads(req, res) {
    try {
      const { userId } = req.params;
      
      // Ensure user can only access their own uploads or admin access
      if (userId !== 'current' && userId !== req.user.id && req.user.role !== 'backoffice') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const actualUserId = userId === 'current' ? req.user.id : userId;
      const uploads = await uploadService.getUserUploads(actualUserId, req.query);

      res.status(200).json({
        success: true,
        data: uploads
      });

    } catch (error) {
      console.error('Get user uploads error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get uploads'
      });
    }
  }
}

module.exports = new UploadController();
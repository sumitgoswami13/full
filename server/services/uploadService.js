const Document = require('../models/Document');
const Upload = require('../models/Upload');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class UploadService {
  // Process file upload
  async processFileUpload(userId, uploadData) {
    const { files, fileMetadata, customerInfo, pricingSnapshot, metadata } = uploadData;

    // Generate upload ID
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create upload record
    const upload = await Upload.create({
      uploadId,
      userId,
      status: 'processing',
      fileCount: files.length,
      customerInfo,
      pricingSnapshot,
      metadata
    });

    const processedFiles = [];
    const errors = [];

    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileMeta = fileMetadata[i] || {};

        try {
          // Generate file hash
          const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

          // Check for duplicates
          const existingDoc = await Document.findOne({ 
            documentHash: fileHash,
            userId,
            isActive: true 
          });

          if (existingDoc) {
            errors.push(`File ${file.originalname} already exists (UDIN: ${existingDoc.udin})`);
            continue;
          }

          // Generate UDIN
          const udin = await Document.generateUDIN();

          // Save file to disk
          const uploadsDir = path.join(__dirname, '../uploads/documents');
          await fs.mkdir(uploadsDir, { recursive: true });
          
          const fileExtension = path.extname(file.originalname);
          const fileName = `${udin}_${Date.now()}${fileExtension}`;
          const filePath = path.join(uploadsDir, fileName);
          
          await fs.writeFile(filePath, file.buffer);

          // Create document record
          const document = await Document.create({
            userId,
            udin,
            fileName,
            originalName: file.originalname,
            fileType: fileExtension.slice(1).toLowerCase(),
            fileSize: file.size,
            filePath,
            documentHash: fileHash,
            status: 'uploaded',
            metadata: {
              uploadIP: metadata.ipAddress,
              userAgent: metadata.userAgent,
              checksum: fileHash,
              documentTypeId: fileMeta.documentTypeId,
              tier: fileMeta.tier,
              originalId: fileMeta.originalId
            },
            uploadId: upload._id
          });

          processedFiles.push({
            udin: document.udin,
            originalName: file.originalname,
            fileSize: file.size,
            status: document.status,
            documentTypeId: fileMeta.documentTypeId,
            tier: fileMeta.tier
          });

        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          errors.push(`Failed to process ${file.originalname}: ${fileError.message}`);
        }
      }

      // Update upload status
      upload.status = errors.length > 0 ? 'completed_with_errors' : 'completed';
      upload.processedFiles = processedFiles.length;
      upload.errors = errors;
      await upload.save();

      // Create transaction record for the upload
      if (processedFiles.length > 0) {
        await Transaction.create({
          userId,
          paymentId: null,
          documentId: null,
          transactionId: Transaction.generateTransactionId(),
          type: 'upload',
          amount: 0, // No charge for upload itself
          currency: 'INR',
          status: 'completed',
          description: `File upload completed - ${processedFiles.length} documents processed`,
          razorpayData: {},
          metadata: {
            uploadId,
            fileCount: processedFiles.length,
            totalFiles: files.length,
            errors: errors.length,
            pricingSnapshot,
            customerInfo,
            ...metadata
          },
        });
      }

      return {
        uploadId,
        status: upload.status,
        processedFiles: processedFiles.length,
        totalFiles: files.length,
        errors,
        files: processedFiles
      };

    } catch (error) {
      // Update upload status to failed
      upload.status = 'failed';
      upload.errors = [error.message];
      await upload.save();

      // Create failed transaction record
      await Transaction.create({
        userId,
        paymentId: null,
        documentId: null,
        transactionId: Transaction.generateTransactionId(),
        type: 'upload',
        amount: 0,
        currency: 'INR',
        status: 'failed',
        description: `File upload failed - ${error.message}`,
        razorpayData: {},
        metadata: {
          uploadId,
          error: error.message,
          ...metadata
        },
      });

      throw error;
    }
  }

  // Get upload status
  async getUploadStatus(userId, uploadId) {
    const upload = await Upload.findOne({ uploadId, userId });

    if (!upload) {
      throw new Error('Upload not found');
    }

    return {
      uploadId: upload.uploadId,
      status: upload.status,
      fileCount: upload.fileCount,
      processedFiles: upload.processedFiles,
      errors: upload.errors,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt
    };
  }

  // Get user uploads
  async getUserUploads(userId, query = {}) {
    const { page = 1, limit = 10, status } = query;
    
    const searchQuery = { userId };
    if (status && status !== 'all') {
      searchQuery.status = status;
    }

    const uploads = await Upload.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Upload.countDocuments(searchQuery);

    return {
      uploads: uploads.map(upload => ({
        uploadId: upload.uploadId,
        status: upload.status,
        fileCount: upload.fileCount,
        processedFiles: upload.processedFiles,
        errors: upload.errors,
        createdAt: upload.createdAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }
}

module.exports = new UploadService();
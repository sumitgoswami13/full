const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const { protect, userOnly } = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for processing

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 30 // Maximum 30 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

// @desc    Upload multiple files
// @route   POST /api/uploads/files
// @access  Private (User only)
router.post('/files', 
  protect, 
  userOnly,
  upload.array('files', 30), // Accept up to 30 files
  [
    body('userId').optional().isString(),
    body('customerInfo').optional().isString(),
    body('pricingSnapshot').optional().isString(),
    body('metadata').optional().isString(),
    body('uploadTimestamp').optional().isString(),
  ],
  uploadController.uploadFiles
);

// @desc    Get upload status
// @route   GET /api/uploads/status/:uploadId
// @access  Private (User only)
router.get('/status/:uploadId', protect, userOnly, uploadController.getUploadStatus);

// @desc    Get user uploads
// @route   GET /api/uploads/user/:userId
// @access  Private (User only)
router.get('/user/:userId', protect, userOnly, uploadController.getUserUploads);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 50MB per file.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum 30 files allowed.'
      });
    }
  }
  
  if (error.message.includes('File type')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next(error);
});

module.exports = router;
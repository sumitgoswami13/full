const express = require('express');
const { protect, userOnly } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/users/profile/:userId
// @access  Private (User only)
router.get('/profile/:userId', protect, userOnly, userController.getUserProfile);

// @desc    Update user profile
// @route   PUT /api/users/profile/:userId
// @access  Private (User only)
router.put('/profile/:userId', protect, userOnly, userController.updateUserProfile);

// @desc    Get user transactions
// @route   GET /api/users/transactions/:userId
// @access  Private (User only)
router.get('/transactions/:userId', protect, userOnly, userController.getUserTransactions);

// @desc    Get user documents
// @route   GET /api/users/documents/:userId
// @access  Private (User only)
router.get('/documents/:userId', protect, userOnly, userController.getUserDocuments);

module.exports = router;
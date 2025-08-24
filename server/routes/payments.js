// routes/payments.js
const express = require('express');
const { body, param } = require('express-validator');
const { protect, userOnly } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

/* =========================
 * PAYMENTS
 * =======================*/

// Create payment order (for Razorpay integration)
router.post(
  '/create-order',
  protect,
  userOnly,
  [
    body('amount').isNumeric().withMessage('amount (paise) is required'),
    body('amount').custom((v) => v >= 100).withMessage('amount must be >= 100 paise (₹1)'),
    body('currency').optional().isString(),
    body('receipt').optional().isString(),
    body('notes').optional().isObject(),
  ],
  paymentController.createPaymentOrder
);

// Verify payment
router.post(
  '/verify',
  protect,
  userOnly,
  [
    body().custom((body) => {
      const hasNew = body.orderId && body.paymentId && body.signature;
      const hasLegacy =
        body.razorpay_order_id && body.razorpay_payment_id && body.razorpay_signature;
      if (!hasNew && !hasLegacy) {
        throw new Error(
          'Provide (orderId, paymentId, signature) or (razorpay_order_id, razorpay_payment_id, razorpay_signature)'
        );
      }
      return true;
    }),
  ],
  paymentController.verifyPayment
);

// Payment history (user)
router.get('/history', protect, userOnly, paymentController.getPaymentHistory);

/* =========================
 * TRANSACTIONS
 * =======================*/

// Create a transaction
router.post(
  '/transactions',
  protect,
  userOnly,
  [
    body('provider').isString().withMessage('provider is required'),
    body('status').isString().withMessage('status is required'),
    body('currency').isString().withMessage('currency is required'),
    body('amount').isNumeric().withMessage('amount (INR) is required'),
    body('amount').custom((v) => v > 0).withMessage('amount must be > 0'),
    body('amountPaise').isNumeric().withMessage('amountPaise is required'),
    body('items').optional().isArray(),
    body('amounts').optional().isObject(),
    body('notes').optional().isObject(),
  ],
  paymentController.createTransaction
);

// Update transaction status
router.patch(
  '/transactions/:transactionId',
  protect,
  userOnly,
  [
    param('transactionId').isString().withMessage('transactionId is required'),
    body('status').optional().isString(),
    body('paymentId').optional().isString(),
    body('failureReason').optional().isString(),
    body('paidAt').optional().isString(),
    body('meta').optional().isObject(),
  ],
  paymentController.updateTransactionStatus
);

// Get transaction by ID
router.get(
  '/transactions/:transactionId',
  protect,
  userOnly,
  paymentController.getTransactionById
);

module.exports = router;
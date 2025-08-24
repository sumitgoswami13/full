// routes/payment.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const { protect, userOnly } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

/* =========================
 * PAYMENTS
 * =======================*/

// Create cart order (matches frontend)
router.post(
  '/order',
  protect,
  userOnly,
  [
    body('amount').isNumeric().withMessage('amount (INR) is required'),
    body('amount').custom((v) => v > 0).withMessage('amount must be > 0'),
    body('items').optional().isArray().withMessage('items must be an array'),
    body('subtotal').optional().isNumeric(),
    body('tax').optional().isObject(), // { rate, gstAmount }
    body('notes').optional().isObject(),
  ],
  paymentController.createCartOrder
);

// (Optional) legacy single-document order
router.post(
  '/order/document',
  protect,
  userOnly,
  [
    body('documentId').isMongoId().withMessage('Valid document ID is required'),
    body('amount').isNumeric().withMessage('amount (INR) is required'),
    body('amount').custom((v) => v > 0).withMessage('amount must be > 0'),
  ],
  paymentController.createDocumentOrder
);

// Verify payment (accepts either new or razorpay_* keys)
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

// (Optional) backoffice list
// router.get('/', protect, adminOnly, paymentController.getAllPayments);

/* =========================
 * TRANSACTIONS
 * =======================*/

// Create a transaction (pending)
router.post(
  '/transactions',
  protect,
  userOnly,
  [
    body('provider').isString().withMessage('provider is required'),
    body('status').isString().withMessage('status is required'),
    body('userId').optional().isString(),
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

// Update transaction status (paid / uploaded / error / cancelled)
router.patch(
  '/transactions/:transactionId/status',
  protect,
  userOnly,
  [
    param('transactionId').isString().withMessage('transactionId is required'),
    body('status').isString().withMessage('status is required'),
    body('paymentId').optional().isString(),
    body('failureReason').optional().isString(),
    body('paidAt').optional().isString(),
    body('meta').optional().isObject(),
  ],
  paymentController.updateTransactionStatus
);

module.exports = router;

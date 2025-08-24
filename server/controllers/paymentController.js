// controllers/paymentController.js
const { validationResult } = require('express-validator');
const paymentService = require('../services/paymentService');

class PaymentController {
  /* -----------------------------------------------------------------------
   * CREATE PAYMENT ORDER (for Razorpay)
   * POST /api/payments/create-order
   * body: { amount (paise), currency?, receipt?, notes? }
   * --------------------------------------------------------------------- */
  async createPaymentOrder(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const orderData = await paymentService.createPaymentOrder(req.user.id, req.body);

      return res.status(201).json({
        success: true,
        message: 'Payment order created successfully',
        ...orderData, // { id, amount, currency, receipt, key }
      });
    } catch (error) {
      console.error('Create payment order error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create payment order',
      });
    }
  }

  /* -----------------------------------------------------------------------
   * VERIFY PAYMENT
   * POST /api/payments/verify
   * body: { orderId, paymentId, signature } or razorpay_* fields
   * --------------------------------------------------------------------- */
  async verifyPayment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const metadata = {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
      };

      const paymentData = await paymentService.verifyPayment(
        req.user.id,
        req.body,
        metadata
      );

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: paymentData,
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Payment verification failed',
      });
    }
  }

  /* -----------------------------------------------------------------------
   * TRANSACTIONS
   * --------------------------------------------------------------------- */

  // POST /api/payments/transactions
  async createTransaction(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      // Ensure userId is set to the authenticated user
      const transactionData = {
        ...req.body,
        userId: req.user.id // Override any userId in body with authenticated user
      };

      const result = await paymentService.createTransaction(req.user.id, transactionData);
      
      return res.status(201).json({
        success: true,
        message: 'Transaction created',
        data: result,
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create transaction',
      });
    }
  }

  // PATCH /api/payments/transactions/:transactionId
  async updateTransactionStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { transactionId } = req.params;
      const result = await paymentService.updateTransactionStatus(
        req.user.id,
        transactionId,
        req.body
      );

      return res.status(200).json({
        success: true,
        message: 'Transaction updated',
        data: result,
      });
    } catch (error) {
      console.error('Update transaction status error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update transaction',
      });
    }
  }

  // GET /api/payments/transactions/:transactionId
  async getTransactionById(req, res) {
    try {
      const { transactionId } = req.params;
      const transaction = await paymentService.getTransactionById(req.user.id, transactionId);

      return res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      console.error('Get transaction error:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Transaction not found',
      });
    }
  }

  /* -----------------------------------------------------------------------
   * HISTORY
   * --------------------------------------------------------------------- */

  // GET /api/payments/history
  async getPaymentHistory(req, res) {
    try {
      const paymentsData = await paymentService.getPaymentHistory(req.user.id, req.query);
      return res.status(200).json({
        success: true,
        data: paymentsData,
      });
    } catch (error) {
      console.error('Get payment history error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch payment history',
      });
    }
  }

  /* -----------------------------------------------------------------------
   * REFUND (Admin only)
   * --------------------------------------------------------------------- */
  async processRefund(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { paymentId } = req.params;
      const { amount, reason } = req.body;

      const result = await paymentService.processRefund(paymentId, amount, reason);
      return res.status(200).json({
        success: true,
        message: 'Refund processed',
        data: result,
      });
    } catch (error) {
      console.error('Process refund error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to process refund',
      });
    }
  }
}

module.exports = new PaymentController();
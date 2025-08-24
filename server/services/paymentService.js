// services/paymentService.js
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const Document = require('../models/Document');
const {
  createOrder,
  verifyPaymentSignature,
  fetchPayment,
  createRefund,
} = require('../utils/razorpay');

class PaymentService {
  /* ---------------------------------------------------------------------------
   * CREATE PAYMENT ORDER (for Razorpay integration)
   * body: { amount (paise), currency?, receipt?, notes? }
   * -------------------------------------------------------------------------*/
  async createPaymentOrder(userId, payload = {}) {
    const {
      amount,               // in paise (as expected by Razorpay)
      currency = 'INR',
      receipt,
      notes = {},
    } = payload;

    if (!amount || amount < 100) {
      throw new Error('Amount must be at least 100 paise (₹1)');
    }

    // Generate receipt if not provided
    const orderReceipt = receipt || Payment.generateReceipt
      ? Payment.generateReceipt()
      : `rcpt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    // Create Razorpay order
    const orderResult = await createOrder(amount / 100, currency, orderReceipt, {
      userId,
      ...notes,
    });

    if (!orderResult?.success) {
      throw new Error(`Failed to create payment order: ${orderResult?.error || 'unknown error'}`);
    }

    const order = orderResult.order;

    return {
      id: order.id,
      amount: order.amount,      // paise
      currency: order.currency,  // "INR"
      receipt: order.receipt,
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  /* ---------------------------------------------------------------------------
   * VERIFY PAYMENT
   * body: { orderId, paymentId, signature } or razorpay_* fields
   * -------------------------------------------------------------------------*/
  async verifyPayment(userId, paymentData, metadata = {}) {
    const { orderId, paymentId, signature } = normalizeVerifyPayload(paymentData);

    // Verify signature locally
    const isValidSignature = verifyPaymentSignature(orderId, paymentId, signature);
    if (!isValidSignature) {
      throw new Error('Invalid payment signature');
    }

    // Fetch payment details from Razorpay
    const paymentResult = await fetchPayment(paymentId);
    if (!paymentResult?.success) {
      throw new Error(`Failed to fetch payment details: ${paymentResult?.error || 'unknown error'}`);
    }
    const rp = paymentResult.payment;

    // Create payment record
    const payment = await Payment.create({
      userId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
      amount: rp.amount / 100, // Convert paise to rupees for storage
      currency: rp.currency,
      status: 'paid',
      paymentMethod: rp.method,
      paymentDate: new Date(),
      transactionFee: rp.fee || 0,
      netAmount: (rp.amount - (rp.fee || 0)) / 100, // Convert to rupees
      metadata: {
        ...metadata,
        razorpayData: {
          order_id: orderId,
          payment_id: paymentId,
          method: rp.method,
          bank: rp.bank,
          wallet: rp.wallet,
        }
      },
    });

    // Create transaction record
    await Transaction.create({
      userId,
      paymentId: payment._id,
      transactionId: Transaction.generateTransactionId(),
      type: 'payment',
      amount: payment.amount,
      currency: payment.currency,
      status: 'completed',
      description: `Payment completed - Order: ${orderId}`,
      razorpayData: {
        orderId,
        paymentId,
        signature,
        method: rp.method,
      },
      metadata,
    });

    return {
      success: true,
      paymentId: payment._id,
      amount: payment.amount,
      status: payment.status,
      paymentDate: payment.paymentDate,
    };
  }

  /* ---------------------------------------------------------------------------
   * TRANSACTIONS
   * -------------------------------------------------------------------------*/

  // Create transaction
  async createTransaction(userId, payload = {}) {
    const {
      provider,
      status,
      amount,
      currency = 'INR',
      amountPaise,
      items = [],
      amounts,   // { subtotal, gstAmount, totalAmount, taxRate }
      notes = {},
      description = 'Transaction initiated',
    } = payload;

    if (!provider || !status || !currency) {
      throw new Error('provider, status, and currency are required');
    }

    if (!amount || amount <= 0) {
      throw new Error('amount must be a positive number');
    }

    const transactionId = Transaction.generateTransactionId();

    const trx = await Transaction.create({
      userId, // Ensure userId is always set
      paymentId: null,
      documentId: null,
      transactionId,
      type: 'payment',
      amount,
      currency,
      status,
      description,
      razorpayData: { provider },
      metadata: {
        items,
        amounts,
        notes,
        amountPaise,
        createdAt: new Date().toISOString(),
      },
    });

    return { 
      transactionId: trx.transactionId, 
      id: trx._id.toString(),
      userId: trx.userId 
    };
  }

  // Update transaction status
  async updateTransactionStatus(userId, transactionId, update = {}) {
    const {
      status,
      paymentId,
      failureReason,
      paidAt,
      meta,
    } = update;

    // Find transaction by transactionId and userId to ensure ownership
    const trx = await Transaction.findOne({ 
      $or: [
        { transactionId, userId },
        { _id: transactionId, userId } // Support both transactionId and _id
      ]
    });

    if (!trx) {
      throw new Error('Transaction not found or access denied');
    }

    // Update transaction fields
    if (status) {
      trx.status = status;
    }

    if (paymentId) {
      trx.razorpayData = { ...(trx.razorpayData || {}), paymentId };
    }

    if (paidAt) {
      trx.metadata = { ...(trx.metadata || {}), paidAt };
    }

    if (failureReason) {
      trx.metadata = { ...(trx.metadata || {}), failureReason };
    }

    if (meta && typeof meta === 'object') {
      trx.metadata = { ...(trx.metadata || {}), ...meta };
    }

    // Add update timestamp
    trx.metadata = { 
      ...(trx.metadata || {}), 
      lastUpdated: new Date().toISOString() 
    };

    await trx.save();

    return {
      transactionId: trx.transactionId,
      id: trx._id.toString(),
      status: trx.status,
      userId: trx.userId,
      metadata: trx.metadata,
    };
  }

  // Get transaction by ID
  async getTransactionById(userId, transactionId) {
    const trx = await Transaction.findOne({ 
      $or: [
        { transactionId, userId },
        { _id: transactionId, userId }
      ]
    }).populate('paymentId');

    if (!trx) {
      throw new Error('Transaction not found or access denied');
    }

    return {
      id: trx._id,
      transactionId: trx.transactionId,
      userId: trx.userId,
      type: trx.type,
      amount: trx.amount,
      currency: trx.currency,
      status: trx.status,
      description: trx.description,
      razorpayData: trx.razorpayData,
      metadata: trx.metadata,
      createdAt: trx.createdAt,
      updatedAt: trx.updatedAt,
      payment: trx.paymentId,
    };
  }

  /* ---------------------------------------------------------------------------
   * PAYMENT HISTORY
   * -------------------------------------------------------------------------*/
  async getPaymentHistory(userId, query = {}) {
    const { page = 1, limit = 10, status } = query;

    const searchQuery = { userId };
    if (status && status !== 'all') {
      searchQuery.status = status;
    }

    const payments = await Payment.find(searchQuery)
      .populate('documentId', 'udin originalName status')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(searchQuery);

    return {
      payments: payments.map((p) => ({
        id: p._id,
        orderId: p.razorpayOrderId,
        paymentId: p.razorpayPaymentId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        document: p.documentId,
        metadata: p.metadata,
      })),
      pagination: {
        current: parseInt(page, 10),
        pages: Math.ceil(total / limit),
        total,
      },
    };
  }

  /* ---------------------------------------------------------------------------
   * REFUND
   * -------------------------------------------------------------------------*/
  async processRefund(paymentId, refundAmount, reason) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'paid') {
      throw new Error('Only paid payments can be refunded');
    }

    const refundResult = await createRefund(payment.razorpayPaymentId, refundAmount, { reason });
    if (!refundResult.success) {
      throw new Error(`Failed to process refund: ${refundResult.error}`);
    }

    payment.status = 'refunded';
    payment.refundId = refundResult.refund.id;
    payment.refundAmount = refundAmount;
    payment.refundReason = reason;
    payment.refundDate = new Date();
    await payment.save();

    await Transaction.create({
      userId: payment.userId,
      paymentId: payment._id,
      documentId: payment.documentId || null,
      transactionId: Transaction.generateTransactionId(),
      type: 'refund',
      amount: -refundAmount,
      currency: 'INR',
      status: 'completed',
      description: `Refund processed${reason ? ` - ${reason}` : ''}`,
      razorpayData: {
        paymentId: payment.razorpayPaymentId,
        refundId: refundResult.refund.id,
      },
    });

    return {
      refundId: refundResult.refund.id,
      amount: refundAmount,
      status: 'completed',
    };
  }
}

/* ----------------------------- helpers ---------------------------------- */
function normalizeVerifyPayload(data = {}) {
  const orderId = data.orderId || data.razorpay_order_id;
  const paymentId = data.paymentId || data.razorpay_payment_id;
  const signature = data.signature || data.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    throw new Error('orderId, paymentId and signature are required');
  }
  return { orderId, paymentId, signature };
}

module.exports = new PaymentService();
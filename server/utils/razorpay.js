const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order
exports.createOrder = async (amount, currency = 'INR', receipt, notes = {}) => {
  try {
    // Ensure amount is in rupees (Razorpay expects rupees, not paise for orders)
    const amountInRupees = Math.round(amount * 100) / 100; // Round to 2 decimal places
    
    const options = {
      amount: Math.round(amountInRupees * 100), // Convert to paise for Razorpay
      currency,
      receipt,
      notes,
      payment_capture: 1
    };

    console.log('Creating Razorpay order with options:', options);

    const order = await razorpay.orders.create(options);
    
    console.log('Razorpay order created:', order.id);
    
    return {
      success: true,
      order
    };
  } catch (error) {
    console.error('Razorpay create order error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create order'
    };
  }
};

// Verify payment signature
exports.verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === signature;
    console.log('Payment signature verification:', isValid ? 'SUCCESS' : 'FAILED');
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

// Fetch payment details
exports.fetchPayment = async (paymentId) => {
  try {
    console.log('Fetching payment details for:', paymentId);
    
    const payment = await razorpay.payments.fetch(paymentId);
    
    console.log('Payment details fetched:', {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      method: payment.method
    });
    
    return {
      success: true,
      payment
    };
  } catch (error) {
    console.error('Fetch payment error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch payment'
    };
  }
};

// Create refund
exports.createRefund = async (paymentId, amount, notes = {}) => {
  try {
    console.log('Creating refund for payment:', paymentId, 'Amount:', amount);
    
    const refund = await razorpay.payments.refund(paymentId, {
      amount: Math.round(amount * 100), // Convert to paise
      notes
    });
    
    console.log('Refund created:', refund.id);
    
    return {
      success: true,
      refund
    };
  } catch (error) {
    console.error('Create refund error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create refund'
    };
  }
};

// Fetch order details
exports.fetchOrder = async (orderId) => {
  try {
    console.log('Fetching order details for:', orderId);
    
    const order = await razorpay.orders.fetch(orderId);
    
    console.log('Order details fetched:', {
      id: order.id,
      amount: order.amount,
      status: order.status
    });
    
    return {
      success: true,
      order
    };
  } catch (error) {
    console.error('Fetch order error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch order'
    };
  }
};

// Validate webhook signature
exports.validateWebhookSignature = (body, signature, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return false;
  }
};

module.exports = razorpay;
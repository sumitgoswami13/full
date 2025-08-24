const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // Import bcrypt
const EmailVerification = require('../models/EmailVerification');
const { sendEmail } = require('../utils/email');




function signAuthToken(user) {
  // include whatever claims your app needs
  return jwt.sign(
    {
      sub: user._id.toString(),
      userId: user.userId,
      email: user.email,
      mobile: user.mobile,
      role: user.role || 'user',
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

class AuthService {
  // Generate JWT token
  generateToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  }

  // Register new user
async registerUser(userData) {
  const { name, email, mobile, password, address } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { mobile }],
  });

  if (existingUser) {
    throw new Error('User already exists with this email or mobile number');
  }

  // Generate user ID
  const userId = await User.generateUserId();

  // Generate temporary password (8 random bytes -> 16 hex chars)
  const tempPassword = crypto.randomBytes(8).toString('hex');
  const hashedTempPassword = await bcrypt.hash(tempPassword, 12);

  // Create user with temporary password
  // Email has been verified via OTP in your frontend flow
  const user = await User.create({
    name,
    email,
    mobile,
    password: hashedTempPassword,
    address,
    userId,
    isEmailVerified: true, // already verified via OTP modal flow
    // If your schema supports it, you can add:
    // mustResetPassword: true,
  });

  // Issue JWT so the frontend can persist it
  const token = signAuthToken(user);

  // Optionally, send a welcome email here (no verification link needed)
  // await sendEmail({ ... });

  return {
    userId: user.userId,
    email: user.email,
    mobile: user.mobile,
    isEmailVerified: user.isEmailVerified,
    tempPassword, // frontend displays once and stores with user data per your flow
    token,        // <-- frontend will save this in localStorage (udin_auth / udin_token)
  };
}

  // Login user
  async loginUser(email, password) {
    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = this.generateToken(user._id);

    return {
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin
      }
    };
  }

  // Verify email
  async verifyOtp(verificationId, otp) {
    // Find the verification record by the unique ID
    const verificationRecord = await EmailVerification.findOne({
      verificationId,
      expiresAt: { $gt: Date.now() }, // Check if OTP is not expired
    });

    if (!verificationRecord) {
      throw new Error('Invalid or expired OTP');
    }
    console.log(verificationRecord);
    // Check if the OTP matches
    if (verificationRecord.otp !== otp) {
      throw new Error('Invalid OTP');
    }

 /*    // Mark email as verified for the user
    const user = await User.findOne({ email: verificationRecord.email });
    if (!user) {
      throw new Error('User not found');
    }

    user.isEmailVerified = true;
    await user.save(); */

    // Delete OTP record after successful verification
    await EmailVerification.deleteOne({ verificationId });

    return { message: 'Email verified successfully' };
  }


   async sendOtp(email) {
    // Check if user already exists with this email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Generate unique verification ID
    const verificationId = crypto.randomBytes(16).toString('hex');

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    // Set expiration time for OTP (e.g., 15 minutes)
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Save OTP and associated email in EmailVerification model
    await EmailVerification.create({
      email,
      otp,
      verificationId,
      expiresAt,
    });

    // Send OTP to email
     await sendEmail({
      to: email,
      subject: 'Verify Your Email - UDIN',
      html: `
        <h2>Email Verification</h2>
        <p>Hello,</p>
        <p>To complete your registration, please enter the OTP below:</p>
        <p><strong>${otp}</strong></p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    }); 

    return { verificationId, email };
  }

  // Get user profile
  async getUserProfile(userId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      address: user.address,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };
  }
}

module.exports = new AuthService();
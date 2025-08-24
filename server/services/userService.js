const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Document = require('../models/Document');

class UserService {
  // Get user profile
  async getUserProfile(userId) {
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }

    // Convert to profile format expected by frontend
    return {
      id: user._id,
      firstName: user.name.split(' ')[0] || '',
      lastName: user.name.split(' ').slice(1).join(' ') || '',
      email: user.email,
      phone: user.mobile,
      address: user.address?.street || '',
      city: user.address?.city || '',
      state: user.address?.state || '',
      zipCode: user.address?.pinCode || '',
      country: 'India',
      dateOfBirth: user.dateOfBirth || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      joinDate: user.createdAt,
      accountType: user.accountType || 'standard',
      verificationStatus: user.isEmailVerified ? 'verified' : 'unverified'
    };
  }

  // Update user profile
  async updateUserProfile(userId, profileData) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Update user fields
    if (profileData.firstName || profileData.lastName) {
      user.name = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
    }
    
    if (profileData.email) {
      user.email = profileData.email;
    }
    
    if (profileData.phone) {
      user.mobile = profileData.phone;
    }

    // Update address
    if (!user.address) {
      user.address = {};
    }
    
    if (profileData.address) {
      user.address.street = profileData.address;
    }
    if (profileData.city) {
      user.address.city = profileData.city;
    }
    if (profileData.state) {
      user.address.state = profileData.state;
    }
    if (profileData.zipCode) {
      user.address.pinCode = profileData.zipCode;
    }

    // Update other fields
    if (profileData.dateOfBirth) {
      user.dateOfBirth = profileData.dateOfBirth;
    }
    if (profileData.bio) {
      user.bio = profileData.bio;
    }
    if (profileData.avatar) {
      user.avatar = profileData.avatar;
    }

    await user.save();

    return this.getUserProfile(userId);
  }

  // Get user transactions
  async getUserTransactions(userId, query) {
    const { page = 1, limit = 10, status, type, date } = query;
    
    const searchQuery = { userId };
    if (status && status !== 'all') {
      searchQuery.status = status;
    }
    if (type && type !== 'all') {
      searchQuery.type = type;
    }

    // Date filtering
    if (date && date !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (date) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
      
      if (startDate) {
        searchQuery.createdAt = { $gte: startDate };
      }
    }

    const transactions = await Transaction.find(searchQuery)
      .populate('paymentId', 'razorpayPaymentId paymentMethod paymentDate')
      .populate('documentId', 'udin originalName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(searchQuery);

    return transactions.map(txn => ({
      id: txn._id,
      date: txn.createdAt,
      description: txn.description,
      amount: txn.amount,
      status: txn.status,
      type: txn.type,
      paymentMethod: txn.paymentId?.paymentMethod || 'unknown',
      invoiceId: `INV-${txn.transactionId}`,
      documents: txn.documentId ? [txn.documentId.originalName] : []
    }));
  }

  // Get user documents
  async getUserDocuments(userId, query) {
    const { page = 1, limit = 10, status, type, category, date, search } = query;
    
    const searchQuery = { userId, isActive: true };
    
    if (status && status !== 'all') {
      searchQuery.status = status;
    }
    
    if (search) {
      searchQuery.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { udin: { $regex: search, $options: 'i' } }
      ];
    }

    // Date filtering
    if (date && date !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (date) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      
      if (startDate) {
        searchQuery.createdAt = { $gte: startDate };
      }
    }

    const documents = await Document.find(searchQuery)
      .populate('paymentId', 'status amount paymentDate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Document.countDocuments(searchQuery);

    return documents.map(doc => ({
      id: doc._id,
      name: doc.originalName,
      type: doc.fileType.toUpperCase(),
      uploadDate: doc.createdAt.toISOString().split('T')[0],
      status: this.mapDocumentStatus(doc.status),
      size: this.formatFileSize(doc.fileSize),
      category: doc.metadata?.documentTypeId || 'uncategorized',
      downloadedByAdmin: doc.status === 'processing' || doc.status === 'verified',
      adminDownloadDate: doc.verificationDate?.toISOString().split('T')[0],
      signedDocumentUrl: doc.status === 'verified' ? `/signed/${doc.udin}_signed.pdf` : null,
      signedDocumentUploadDate: doc.verificationDate?.toISOString().split('T')[0],
      canEdit: doc.status === 'uploaded',
      canDelete: doc.status === 'uploaded',
      userId: doc.userId
    }));
  }

  // Map internal document status to frontend status
  mapDocumentStatus(status) {
    const statusMap = {
      'uploaded': 'processing',
      'processing': 'downloaded_by_admin',
      'verified': 'signed_document_uploaded',
      'rejected': 'error'
    };
    return statusMap[status] || status;
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new UserService();
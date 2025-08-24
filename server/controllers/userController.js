const { validationResult } = require('express-validator');
const userService = require('../services/userService');

class UserController {
  // Get user profile
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;
      
      // Ensure user can only access their own profile or admin access
      if (userId !== 'current' && userId !== req.user.id && req.user.role !== 'backoffice') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const actualUserId = userId === 'current' ? req.user.id : userId;
      const profile = await userService.getUserProfile(actualUserId);

      res.status(200).json({
        success: true,
        profile
      });

    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user profile'
      });
    }
  }

  // Update user profile
  async updateUserProfile(req, res) {
    try {
      const { userId } = req.params;
      
      // Ensure user can only update their own profile
      if (userId !== req.user.id && req.user.role !== 'backoffice') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const updatedProfile = await userService.updateUserProfile(userId, req.body);

      res.status(200).json({
        success: true,
        profile: updatedProfile
      });

    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update user profile'
      });
    }
  }

  // Get user transactions
  async getUserTransactions(req, res) {
    try {
      const { userId } = req.params;
      
      // Ensure user can only access their own transactions or admin access
      if (userId !== 'current' && userId !== req.user.id && req.user.role !== 'backoffice') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const actualUserId = userId === 'current' ? req.user.id : userId;
      const transactions = await userService.getUserTransactions(actualUserId, req.query);

      res.status(200).json({
        success: true,
        transactions
      });

    } catch (error) {
      console.error('Get user transactions error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user transactions'
      });
    }
  }

  // Get user documents
  async getUserDocuments(req, res) {
    try {
      const { userId } = req.params;
      
      // Ensure user can only access their own documents or admin access
      if (userId !== 'current' && userId !== req.user.id && req.user.role !== 'backoffice') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const actualUserId = userId === 'current' ? req.user.id : userId;
      const documents = await userService.getUserDocuments(actualUserId, req.query);

      res.status(200).json({
        success: true,
        documents
      });

    } catch (error) {
      console.error('Get user documents error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user documents'
      });
    }
  }
}

module.exports = new UserController();
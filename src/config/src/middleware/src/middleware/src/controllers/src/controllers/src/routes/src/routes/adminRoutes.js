const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/adminMiddleware');
const { requestWithdrawal, reviewWithdrawal } = require('../controllers/withdrawalController');

router.post('/withdraw/request', authenticateToken, requestWithdrawal);
router.post('/admin/withdraw/review', authenticateToken, requireAdmin, reviewWithdrawal);

module.exports = router;

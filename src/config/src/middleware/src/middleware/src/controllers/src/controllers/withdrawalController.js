const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const WITHDRAWAL_CONFIG = {
  'USDT-BEP20': { minAmount: 5.0, fee: 0.8 },
  'USDT-ERC20': { minAmount: 20.0, fee: 10.0 },
  'BTC': { minAmount: 0.0005, fee: 0.0001 },
  'ETH': { minAmount: 0.01, fee: 0.0015 }
};

async function requestWithdrawal(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.userId;
    const { currency, amount, toAddress } = req.body;
    const withdrawAmount = parseFloat(amount);

    const config = WITHDRAWAL_CONFIG[currency];
    if (!config) return res.status(400).json({ success: false, message: 'Unsupported withdrawal token/chain' });
    if (withdrawAmount < config.minAmount) return res.status(400).json({ success: false, message: `Minimum limit is ${config.minAmount}` });

    await client.query('BEGIN');

    const userRes = await client.query('SELECT kyc_status FROM users WHERE id = $1', [userId]);
    if (userRes.rows[0].kyc_status !== 'VERIFIED') {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'KYC Verification Required' });
    }

    const walletRes = await client.query('SELECT balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE', [userId, currency.split('-')[0]]);
    if (walletRes.rows.length === 0 || parseFloat(walletRes.rows[0].balance) < withdrawAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient Balance' });
    }

    await client.query('UPDATE wallets SET balance = balance - $1, locked_balance = locked_balance + $1 WHERE user_id = $2 AND currency = $3', [withdrawAmount, userId, currency.split('-')[0]]);
    const insertRes = await client.query('INSERT INTO withdrawals (user_id, currency, amount, to_address, status) VALUES ($1, $2, $3, $4, \'PENDING\') RETURNING *', [userId, currency, withdrawAmount, toAddress]);

    await client.query('COMMIT');
    return res.status(201).json({ success: true, withdrawal: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Withdrawal failed' });
  } finally {
    client.release();
  }
}

async function reviewWithdrawal(req, res) {
  const client = await pool.connect();
  try {
    const { withdrawalId, action, txHash, rejectionReason } = req.body;
    await client.query('BEGIN');

    const wRes = await client.query('SELECT * FROM withdrawals WHERE id = $1 AND status = \'PENDING\' FOR UPDATE', [withdrawalId]);
    if (wRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const item = wRes.rows[0];
    const baseCurr = item.currency.split('-')[0];

    if (action === 'APPROVE') {
      await client.query('UPDATE wallets SET locked_balance = locked_balance - $1 WHERE user_id = $2 AND currency = $3', [item.amount, item.user_id, baseCurr]);
      await client.query('UPDATE withdrawals SET status = \'APPROVED\', tx_hash = $1 WHERE id = $2', [txHash, withdrawalId]);
    } else {
      await client.query('UPDATE wallets SET balance = balance + $1, locked_balance = locked_balance - $1 WHERE user_id = $2 AND currency = $3', [item.amount, item.user_id, baseCurr]);
      await client.query('UPDATE withdrawals SET status = \'REJECTED\', rejection_reason = $1 WHERE id = $2', [rejectionReason || 'Rejected', withdrawalId]);
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: `Withdrawal ${action}d` });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Review failed' });
  } finally {
    client.release();
  }
}

module.exports = { requestWithdrawal, reviewWithdrawal };

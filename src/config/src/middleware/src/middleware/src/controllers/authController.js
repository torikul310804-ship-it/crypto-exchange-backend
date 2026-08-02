require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function registerUser(req, res) {
  const client = await pool.connect();
  try {
    const { email, password, referralCode } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email & Password required' });

    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Email registered already' });
    }

    let referrerId = null;
    if (referralCode) {
      const refRes = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim().toUpperCase()]);
      if (refRes.rows.length > 0) referrerId = refRes.rows[0].id;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const wallet = ethers.Wallet.createRandom();
    const myReferralCode = generateReferralCode();

    const insertQuery = `
      INSERT INTO users (email, password_hash, deposit_address, encrypted_private_key, referral_code, referred_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, deposit_address, referral_code;
    `;
    const userRes = await client.query(insertQuery, [email, passwordHash, wallet.address, wallet.privateKey, myReferralCode, referrerId]);
    const newUser = userRes.rows[0];

    for (const curr of ['USDT', 'BTC', 'ETH']) {
      await client.query('INSERT INTO wallets (user_id, currency, balance, locked_balance) VALUES ($1, $2, 0, 0)', [newUser.id, curr]);
    }

    await client.query('COMMIT');

    const token = jwt.sign({ userId: newUser.id, email: newUser.email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    return res.status(201).json({ success: true, token, user: newUser });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Registration failed' });
  } finally {
    client.release();
  }
}

async function loginUser(req, res) {
  try {
    const { email, password } = req.body;
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    return res.json({ success: true, token, user: { id: user.id, email: user.email, referralCode: user.referral_code, kycStatus: user.kyc_status, isAdmin: user.is_admin } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
}

module.exports = { registerUser, loginUser };

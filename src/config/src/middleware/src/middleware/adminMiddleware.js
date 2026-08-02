const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function requireAdmin(req, res, next) {
  try {
    const userId = req.user.userId;
    const userRes = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);

    if (userRes.rows.length === 0 || !userRes.rows[0].is_admin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Admin check failed' });
  }
}

module.exports = requireAdmin;

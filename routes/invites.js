const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const pool     = require('../database');

// GET /invite/:token — show accept form
router.get('/invite/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await pool.query(
      `SELECT i.*, c.name AS charity_name
       FROM invites i
       JOIN charities c ON c.id = i.charity_id
       WHERE i.token = $1`,
      [token]
    );
    const invite = result.rows[0];

    if (!invite) {
      req.flash('error', 'Invalid invite link.');
      return res.redirect('/login');
    }
    if (invite.used) {
      req.flash('error', 'This invite has already been used.');
      return res.redirect('/login');
    }
    if (new Date(invite.expires_at) < new Date()) {
      req.flash('error', 'This invite link has expired. Please request a new one.');
      return res.redirect('/login');
    }

    res.render('invite', { invite, token });
  } catch (err) {
    console.error('[Invites] GET error:', err.message);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/login');
  }
});

// POST /invite/:token — accept invite, create user
router.post('/invite/:token', async (req, res) => {
  const { token } = req.params;
  const { username, password, security_question } = req.body;

  try {
    const result = await pool.query(
      `SELECT i.*, c.name AS charity_name
       FROM invites i
       JOIN charities c ON c.id = i.charity_id
       WHERE i.token = $1`,
      [token]
    );
    const invite = result.rows[0];

    if (!invite || invite.used || new Date(invite.expires_at) < new Date()) {
      req.flash('error', 'Invalid or expired invite link.');
      return res.redirect('/login');
    }

    // Check email not already registered for this charity
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND charity_id = $2',
      [invite.email, invite.charity_id]
    );
    if (existing.rows.length > 0) {
      req.flash('error', 'An account with this email already exists.');
      return res.redirect(`/invite/${token}`);
    }

    const hash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `INSERT INTO users (name, email, password, role, security_question, approval, charity_id)
       VALUES ($1, $2, $3, $4, $5, 'approved', $6) RETURNING id`,
      [username, invite.email, hash, invite.role, security_question || '', invite.charity_id]
    );
    const userId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO terms_acceptance (user_id, username, email, terms_version, ip_address, charity_id)
       VALUES ($1, $2, $3, '1.0', $4, $5)`,
      [userId, username, invite.email, req.ip || null, invite.charity_id]
    );

    await pool.query('UPDATE invites SET used = TRUE WHERE token = $1', [token]);

    req.flash('success', `Welcome to ${invite.charity_name}! Your account is ready. Please sign in.`);
    res.redirect('/login');
  } catch (err) {
    console.error('[Invites] POST error:', err.message);
    req.flash('error', 'Error creating account. Please try again.');
    res.redirect(`/invite/${token}`);
  }
});

module.exports = router;

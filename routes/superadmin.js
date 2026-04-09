const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const pool     = require('../database');
const { requireLogin, injectCharityId, checkSuperAdmin, checkAdmin, checkApprovedUser } = require('../utils');
const { sendInviteEmail } = require('../emailer');

// ── Super Admin: view panel ──────────────────────────────────────────

router.get('/super-admin', requireLogin, checkSuperAdmin, checkApprovedUser, async (req, res) => {
  const loggedInName = req.session.name;
  try {
    const charities = await pool.query(`SELECT * FROM charities ORDER BY id ASC`);
    res.render('super-admin', { loggedInName, charities: charities.rows });
  } catch (err) {
    console.error('[SuperAdmin] Error loading panel:', err.message);
    req.flash('error', 'Could not load super admin panel.');
    res.redirect('/admin');
  }
});

// ── Super Admin: create charity + send first admin invite ─────────────

router.post('/admin/charities', requireLogin, checkSuperAdmin, checkApprovedUser, async (req, res) => {
  const { name, slug, email, admin_email } = req.body;

  if (!name || !slug || !admin_email) {
    req.flash('error', 'Name, slug, and admin email are required.');
    return res.redirect('/super-admin');
  }

  try {
    // Create the charity
    const charityResult = await pool.query(
      `INSERT INTO charities (name, slug, email) VALUES ($1, $2, $3) RETURNING id, name`,
      [name.trim(), slug.trim().toLowerCase(), email?.trim() || null]
    );
    const charity = charityResult.rows[0];

    // Create invite for first admin
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await pool.query(
      `INSERT INTO invites (email, charity_id, role, token, expires_at) VALUES ($1, $2, 'admin', $3, $4)`,
      [admin_email.trim(), charity.id, token, expiresAt]
    );

    await sendInviteEmail(admin_email.trim(), token, 'admin', charity.name);

    req.flash('success', `Charity "${charity.name}" created. Invite sent to ${admin_email}.`);
    res.redirect('/admin');
  } catch (err) {
    console.error('[SuperAdmin] Create charity error:', err.message);
    if (err.code === '23505') {
      req.flash('error', 'A charity with this slug already exists.');
    } else {
      req.flash('error', 'Error creating charity. Please try again.');
    }
    res.redirect('/admin');
  }
});

// ── Charity Admin: invite a user to their own charity ────────────────

router.get('/charity/invite', requireLogin, injectCharityId, checkAdmin, checkApprovedUser, async (req, res) => {
  res.render('charity-invite', { loggedInName: req.session.name });
});

router.post('/charity/invite', requireLogin, injectCharityId, checkAdmin, checkApprovedUser, async (req, res) => {
  const { email, role } = req.body;
  const allowedRoles = ['user', 'admin'];

  if (!email || !allowedRoles.includes(role)) {
    req.flash('error', 'Valid email and role (user or admin) are required.');
    return res.redirect('/charity/invite');
  }

  try {
    // Check not already a member
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND charity_id = $2',
      [email.trim(), req.charityId]
    );
    if (existing.rows.length > 0) {
      req.flash('error', 'A user with this email already exists in your organisation.');
      return res.redirect('/charity/invite');
    }

    const charityResult = await pool.query('SELECT name FROM charities WHERE id = $1', [req.charityId]);
    const charityName = charityResult.rows[0]?.name || 'your organisation';

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await pool.query(
      `INSERT INTO invites (email, charity_id, role, token, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [email.trim(), req.charityId, role, token, expiresAt]
    );

    await sendInviteEmail(email.trim(), token, role, charityName);

    req.flash('success', `Invite sent to ${email}.`);
    res.redirect('/admin');
  } catch (err) {
    console.error('[CharityAdmin] Invite error:', err.message);
    req.flash('error', 'Error sending invite. Please try again.');
    res.redirect('/charity/invite');
  }
});

// ── Resend invite — charity admin (scoped to their charity) ─────────

router.post('/charity/invite/resend', requireLogin, injectCharityId, checkAdmin, checkApprovedUser, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const existing = await pool.query(
      `SELECT id, role FROM invites WHERE email = $1 AND charity_id = $2 AND used = FALSE ORDER BY created_at DESC LIMIT 1`,
      [email.trim(), req.charityId]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'No pending invite found for this email in your organisation.' });
    }

    const charityResult = await pool.query('SELECT name FROM charities WHERE id = $1', [req.charityId]);
    const charityName = charityResult.rows[0]?.name || 'your organisation';

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await pool.query(
      `UPDATE invites SET token = $1, expires_at = $2 WHERE id = $3`,
      [token, expiresAt, existing.rows[0].id]
    );

    await sendInviteEmail(email.trim(), token, existing.rows[0].role, charityName);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[CharityAdmin] Resend invite error:', err.message);
    return res.status(500).json({ error: 'Error resending invite. Please try again.' });
  }
});

// ── Resend invite — super admin (searches across all charities) ──────

router.post('/admin/invite/resend', requireLogin, checkSuperAdmin, checkApprovedUser, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const existing = await pool.query(
      `SELECT i.id, i.role, i.charity_id, c.name AS charity_name
       FROM invites i
       JOIN charities c ON c.id = i.charity_id
       WHERE i.email = $1 AND i.used = FALSE
       ORDER BY i.created_at DESC LIMIT 1`,
      [email.trim()]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'No pending invite found for this email.' });
    }

    const { id, role, charity_name } = existing.rows[0];
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await pool.query(
      `UPDATE invites SET token = $1, expires_at = $2 WHERE id = $3`,
      [token, expiresAt, id]
    );

    await sendInviteEmail(email.trim(), token, role, charity_name);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[SuperAdmin] Resend invite error:', err.message);
    return res.status(500).json({ error: 'Error resending invite. Please try again.' });
  }
});

module.exports = router;

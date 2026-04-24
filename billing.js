const pool = require('./database.js');
const { log } = require('./utils');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return require('stripe')(key);
}

const PLANS = {
  monthly: { priceId: () => process.env.STRIPE_PRICE_MONTHLY, label: 'Monthly (£30/month)' },
  yearly:  { priceId: () => process.env.STRIPE_PRICE_YEARLY,  label: 'Yearly (£300/year)'  },
};

/** Check whether a subscription status permits write actions. */
function isActive(status) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

/** Middleware — block writes if the charity's subscription is canceled/unpaid. */
function requireActiveSubscription(req, res, next) {
  pool.query('SELECT subscription_status FROM charities WHERE id = $1', [req.charityId])
    .then(result => {
      const status = result.rows[0]?.subscription_status;
      if (isActive(status)) return next();
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(402).json({ error: 'Your subscription is not active. Please update billing.' });
      }
      req.flash('error', 'Your subscription is not active. Please update billing to continue.');
      return res.redirect('/charity/billing');
    })
    .catch(err => {
      console.error('requireActiveSubscription error:', err.message);
      next(); // fail open on DB errors — better than locking users out
    });
}

async function getOrCreateCustomer(charityId) {
  const charityRes = await pool.query(
    'SELECT id, name, email, stripe_customer_id FROM charities WHERE id = $1',
    [charityId]
  );
  const charity = charityRes.rows[0];
  if (!charity) throw new Error('Charity not found.');
  if (charity.stripe_customer_id) return charity.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name:  charity.name,
    email: charity.email || undefined,
    metadata: { charity_id: String(charityId) },
  });
  await pool.query('UPDATE charities SET stripe_customer_id = $1 WHERE id = $2', [customer.id, charityId]);
  return customer.id;
}

async function createCheckoutSession({ charityId, plan, successUrl, cancelUrl }) {
  const planDef = PLANS[plan];
  if (!planDef) throw new Error('Invalid plan.');
  const priceId = planDef.priceId();
  if (!priceId) throw new Error(`Stripe price ID for "${plan}" is not configured.`);

  const customerId = await getOrCreateCustomer(charityId);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    allow_promotion_codes: true,
    metadata: { charity_id: String(charityId), plan },
    subscription_data: {
      metadata: { charity_id: String(charityId), plan },
    },
  });
  return session.url;
}

async function createPortalSession({ charityId, returnUrl }) {
  const customerId = await getOrCreateCustomer(charityId);
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: returnUrl,
  });
  return session.url;
}

/** Persist subscription state from a Stripe subscription object to our DB. */
async function saveSubscriptionToDb(subscription) {
  const charityId = subscription.metadata?.charity_id;
  if (!charityId) {
    console.warn('[billing] Subscription with no charity_id metadata — skipping:', subscription.id);
    return;
  }
  const plan = subscription.metadata?.plan || null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  await pool.query(
    `UPDATE charities
     SET stripe_subscription_id = $1,
         subscription_status    = $2,
         subscription_plan      = COALESCE($3, subscription_plan),
         current_period_end     = $4
     WHERE id = $5`,
    [subscription.id, subscription.status, plan, periodEnd, charityId]
  );
  log(`Stripe: charity ${charityId} subscription ${subscription.id} → ${subscription.status}`, Number(charityId));
}

/** Parse and verify a webhook request. Returns the event object or throws. */
function constructEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Handle a parsed Stripe event. */
async function handleEvent(event) {
  const obj = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed': {
      // Pull the subscription and persist it so we have customer + status immediately
      if (obj.mode === 'subscription' && obj.subscription) {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(obj.subscription);
        if (!sub.metadata?.charity_id && obj.metadata?.charity_id) {
          sub.metadata = { ...sub.metadata, charity_id: obj.metadata.charity_id, plan: obj.metadata.plan };
        }
        await saveSubscriptionToDb(sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await saveSubscriptionToDb(obj);
      break;
    case 'invoice.paid':
    case 'invoice.payment_failed':
      // Subscription status will follow via customer.subscription.updated — nothing to do here
      break;
    default:
      // Ignore other event types
      break;
  }
}

/** Calculate the Gift Aid submission-service fee from the receivable amount.
 *  1% of receivable, floor £25, cap £200. Returns value in pounds (2dp). */
function calcGiftAidSubmissionFee(receivable) {
  const base = Math.round(receivable * 0.01 * 100) / 100;
  return Math.min(200, Math.max(25, base));
}

/**
 * Charge a one-off amount to the charity's on-file payment method.
 * Throws if no customer or no saved payment method.
 */
async function chargeOneOff({ charityId, amountGBP, description, metadata }) {
  const stripe = getStripe();
  const result = await pool.query(
    'SELECT stripe_customer_id FROM charities WHERE id = $1',
    [charityId]
  );
  const customerId = result.rows[0]?.stripe_customer_id;
  if (!customerId) throw new Error('No payment method on file. Please start a subscription first.');

  // Find a default payment method on the customer
  const customer = await stripe.customers.retrieve(customerId);
  let paymentMethod = customer.invoice_settings?.default_payment_method;
  if (!paymentMethod) {
    const list = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
    paymentMethod = list.data[0]?.id;
  }
  if (!paymentMethod) throw new Error('No saved card. Please add a payment method in the billing portal first.');

  const intent = await stripe.paymentIntents.create({
    amount:   Math.round(amountGBP * 100),
    currency: 'gbp',
    customer: customerId,
    payment_method: paymentMethod,
    off_session: true,
    confirm: true,
    description,
    metadata,
  });
  return intent;
}

module.exports = {
  PLANS,
  isActive,
  requireActiveSubscription,
  createCheckoutSession,
  createPortalSession,
  constructEvent,
  handleEvent,
  saveSubscriptionToDb,
  calcGiftAidSubmissionFee,
  chargeOneOff,
};

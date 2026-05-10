const express = require('express');
const bodyParser = require('body-parser');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({ region: process.env.REGION || 'us-east-1' });

const ALLOWED_ORIGINS = new Set([
  'https://yawstone.com',
  'https://www.yawstone.com',
  'http://localhost:5173',
]);

const FROM_ADDRESS = process.env.FROM_ADDRESS || 'yawson@yawstone.com';
const TO_ADDRESS = process.env.TO_ADDRESS || 'yawson@yawstone.com';

const LIMITS = {
  name: 200,
  email: 320,
  phone: 40,
  organization: 200,
  role: 120,
  interest: 80,
  engagement: 40,
  timeline: 40,
  message: 5000,
};

const ALLOWED_INTERESTS = new Set(['web', 'servicenow', 'cyber', 'multiple']);
const ALLOWED_ENGAGEMENT = new Set(['general', 'briefing', 'teaming', 'rfi-rfp', 'capability-statement']);
const ALLOWED_TIMELINE = new Set(['immediate', 'quarter', 'fy', 'exploring']);

const ENGAGEMENT_LABELS = {
  general: 'General Inquiry',
  briefing: 'Capability Briefing Request',
  teaming: 'Teaming or Subcontracting',
  'rfi-rfp': 'RFI or RFP',
  'capability-statement': 'Capability Statement Request',
};

const TIMELINE_LABELS = {
  immediate: 'Immediate',
  quarter: 'This Quarter',
  fy: 'This Fiscal Year',
  exploring: 'Exploring',
};

// RFC-5322-ish loose check; we send to SES which does its own validation downstream.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_FILL_TIME_MS = 1500;

const app = express();
app.disable('x-powered-by');
app.use(bodyParser.json({ limit: '32kb' }));
app.use(awsServerlessExpressMiddleware.eventContext());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

function isString(v) {
  return typeof v === 'string';
}

function scrubHeader(s) {
  return String(s).replace(/[\r\n]+/g, ' ').trim();
}

app.post('/contact', async (req, res) => {
  const body = req.body || {};

  // Honeypot — silent fake-success so bots don't learn it's rejected.
  if (body.company && String(body.company).trim() !== '') {
    return res.json({ ok: true });
  }

  // Time-trap — humans take more than ~1.5s to fill out the form.
  const elapsed = Number(body._t);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_TIME_MS) {
    return res.json({ ok: true });
  }

  const { name, email, phone, organization, role, interest, engagement, timeline, message } = body;

  if (!isString(name) || !isString(email) || !isString(interest) || !isString(message)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  for (const v of [phone, organization, role, engagement, timeline]) {
    if (v !== undefined && !isString(v)) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
  }

  const trimmed = {
    name: name.trim(),
    email: email.trim(),
    phone: (phone || '').trim(),
    organization: (organization || '').trim(),
    role: (role || '').trim(),
    interest: interest.trim(),
    engagement: (engagement || '').trim(),
    timeline: (timeline || '').trim(),
    message: message.trim(),
  };

  if (!trimmed.name || !trimmed.email || !trimmed.interest || !trimmed.message) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (
    trimmed.name.length > LIMITS.name ||
    trimmed.email.length > LIMITS.email ||
    trimmed.phone.length > LIMITS.phone ||
    trimmed.organization.length > LIMITS.organization ||
    trimmed.role.length > LIMITS.role ||
    trimmed.interest.length > LIMITS.interest ||
    trimmed.engagement.length > LIMITS.engagement ||
    trimmed.timeline.length > LIMITS.timeline ||
    trimmed.message.length > LIMITS.message
  ) {
    return res.status(400).json({ error: 'Field too long.' });
  }
  if (!EMAIL_RE.test(trimmed.email)) {
    return res.status(400).json({ error: 'Invalid email.' });
  }
  if (!ALLOWED_INTERESTS.has(trimmed.interest)) {
    return res.status(400).json({ error: 'Invalid interest.' });
  }
  if (trimmed.engagement && !ALLOWED_ENGAGEMENT.has(trimmed.engagement)) {
    return res.status(400).json({ error: 'Invalid engagement type.' });
  }
  if (trimmed.timeline && !ALLOWED_TIMELINE.has(trimmed.timeline)) {
    return res.status(400).json({ error: 'Invalid timeline.' });
  }

  const engagementLabel = trimmed.engagement ? ENGAGEMENT_LABELS[trimmed.engagement] : 'Not provided';
  const timelineLabel = trimmed.timeline ? TIMELINE_LABELS[trimmed.timeline] : 'Not provided';

  const subject = scrubHeader(`Yawstone Inquiry from ${trimmed.name} [${trimmed.interest}]`);
  const textBody =
    `New Contact Inquiry:\n\n` +
    `Name: ${trimmed.name}\n` +
    `Email: ${trimmed.email}\n` +
    `Phone: ${trimmed.phone || 'Not provided'}\n` +
    `Organization: ${trimmed.organization || 'Not provided'}\n` +
    `Role: ${trimmed.role || 'Not provided'}\n` +
    `Interest: ${trimmed.interest}\n` +
    `Engagement: ${engagementLabel}\n` +
    `Timeline: ${timelineLabel}\n\n` +
    `Message:\n${trimmed.message}\n`;

  try {
    await sesClient.send(
      new SendEmailCommand({
        Destination: { ToAddresses: [TO_ADDRESS] },
        Message: {
          Body: { Text: { Data: textBody, Charset: 'UTF-8' } },
          Subject: { Data: subject, Charset: 'UTF-8' },
        },
        Source: FROM_ADDRESS,
        ReplyToAddresses: [trimmed.email],
      }),
    );
    return res.json({ ok: true });
  } catch (err) {
    const requestId = (req.apiGateway && req.apiGateway.event && req.apiGateway.event.requestContext && req.apiGateway.event.requestContext.requestId) || '';
    console.error('SES_SEND_FAILED', { requestId, name: err && err.name, code: err && err.$metadata && err.$metadata.httpStatusCode });
    return res.status(500).json({ error: 'Unable to send message. Please email us directly.' });
  }
});

app.listen(3000, () => {
  console.log('App started');
});

module.exports = app;

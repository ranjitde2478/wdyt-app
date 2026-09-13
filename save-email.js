// Saves an optional "notify me about new episodes" email address.
// Deliberately kept completely separate from save-response.js -- this is
// contact information, not behavioral/quiz data, and mixing the two in one
// record would be bad practice even though both are optional and honest.

const { put } = require('@vercel/blob');

function isValidEmail(str) {
  // Simple, deliberately permissive check -- this only needs to catch
  // obvious typos, not fully validate RFC 5322. Better to accept a slightly
  // odd real address than to reject one over an overly strict pattern.
  return typeof str === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Only POST requests are allowed here.' });
    }

    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'That doesn\'t look like a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // One small file per signup. addRandomSuffix avoids overwriting if the
    // same email signs up twice in the same second (harmless either way,
    // just avoids a naming collision).
    const filename = `emails/${new Date().toISOString().slice(0,10)}_signup.json`;

    await put(filename, JSON.stringify({
      email: cleanEmail,
      signedUpAt: new Date().toISOString()
    }, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: true
    });

    return res.status(200).json({ saved: true });

  } catch (err) {
    console.error('save-email error:', err);
    return res.status(500).json({ error: 'Could not save email.', detail: err.message });
  }
};

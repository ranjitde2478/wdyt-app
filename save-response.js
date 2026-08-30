// Saves one completed session to Vercel Blob storage.
// This never sees or stores anything about API keys -- it's purely
// "someone finished the app, here's their answers and result."

const { put } = require('@vercel/blob');
module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Only POST requests are allowed here.' });
    }

    const body = req.body || {};
    const { testerName, testerId, completedAt, simCorrect, simTotal, vibeTitle, responses } = body;

    if (!testerId || typeof testerId !== 'string') {
      return res.status(400).json({ error: 'Missing testerId.' });
    }
    if (!Array.isArray(responses)) {
      return res.status(400).json({ error: 'Missing or invalid responses.' });
    }

    // One small JSON file per completed session. The filename itself carries
    // the date and name so the viewer can list sessions without opening each
    // file first.
    const safeName = (testerName || 'guest').toString().slice(0, 40).replace(/[^a-zA-Z0-9 _-]/g, '');
    const dateStamp = (completedAt || new Date().toISOString()).slice(0, 10);
    const filename = `responses/${dateStamp}_${safeName}_${testerId}.json`;

    const record = {
      testerName: testerName || 'Guest',
      testerId,
      completedAt: completedAt || new Date().toISOString(),
      simCorrect: typeof simCorrect === 'number' ? simCorrect : null,
      simTotal: typeof simTotal === 'number' ? simTotal : null,
      vibeTitle: vibeTitle || null,
      responses
    };

    await put(filename, JSON.stringify(record, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: true
    });

    return res.status(200).json({ saved: true });

  } catch (err) {
    console.error('save-response error:', err);
    // A tracking failure should never look like a broken app to a real
    // visitor -- the front end ignores this response either way -- but we
    // still return a real status so it's visible in Vercel's own logs.
    return res.status(500).json({ error: 'Could not save response.', detail: err.message });
  }
};

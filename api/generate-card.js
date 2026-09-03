// This file runs on Vercel's servers, never in the visitor's browser.
// That's the whole point: the real API key lives only here, as an
// environment variable, and is never sent to anyone's phone.

module.exports = async function handler(req, res) {
  try {
    // Only accept POST requests -- reject anything else cleanly.
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Only POST requests are allowed here.' });
    }

    // req.body can throw if the incoming JSON is malformed -- this whole
    // block being inside the outer try/catch covers that case too.
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Missing "prompt" in the request body.' });
    }

    // Basic sanity cap so a malformed request can't rack up a huge bill.
    if (prompt.length > 20000) {
      return res.status(400).json({ error: 'Prompt is too long.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // This means the Vercel project is missing its environment variable --
      // a setup problem, not a visitor's fault. Logged server-side only.
      console.error('ANTHROPIC_API_KEY is not set in this Vercel project.');
      return res.status(500).json({ error: 'Server is not configured correctly.' });
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      // Pass along enough detail to debug, without leaking the key itself.
      console.error('Anthropic API error:', anthropicResponse.status, data);
      return res.status(anthropicResponse.status).json({
        error: 'The AI service returned an error.',
        detail: data && data.error ? data.error.message : 'Unknown error'
      });
    }

    // Diagnostic: stop_reason tells us definitively if the response got cut
    // off before finishing (would show "max_tokens" instead of "end_turn").
    // This is temporary -- worth removing once generation is confirmed stable.
    console.log('generate-card: stop_reason =', data.stop_reason,
      '| response length =', JSON.stringify(data).length);
    if (data.stop_reason === 'max_tokens') {
      console.error('generate-card: RESPONSE WAS TRUNCATED -- max_tokens was too low for this request.');
    }

    // Success -- hand the raw Anthropic response back to the app.
    // The app's existing parsing code already knows how to read this shape,
    // so nothing on the front end needs to change except which URL it calls.
    return res.status(200).json(data);

  } catch (err) {
    console.error('Unexpected server error:', err);
    return res.status(500).json({ error: 'Unexpected server error.', detail: err.message });
  }
};

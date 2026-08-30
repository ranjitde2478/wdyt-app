// A simple, password-protected page for viewing saved responses.
// Visit this URL with ?password=YOUR_PASSWORD to see a readable table.
// Nobody without the correct password can see any of this data.

const { list, get } = require('@vercel/blob');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderPage(bodyHtml) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WDYT — Responses</title>
<style>
  body{ font-family:-apple-system,sans-serif; background:#0F0D14; color:#fff; padding:24px; max-width:900px; margin:0 auto; }
  h1{ font-size:22px; }
  table{ width:100%; border-collapse:collapse; margin-top:16px; }
  th, td{ text-align:left; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.15); font-size:14px; vertical-align:top; }
  th{ color:#DFFF3C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; }
  input, button{ font-size:16px; padding:10px; border-radius:6px; border:1px solid #444; }
  button{ background:#DFFF3C; color:#000; font-weight:700; border:none; cursor:pointer; }
  .muted{ opacity:0.6; font-size:13px; }
  .count{ opacity:0.75; margin-bottom:6px; }
  details{ margin-top:4px; }
  summary{ cursor:pointer; color:#DFFF3C; font-size:12px; }
  pre{ white-space:pre-wrap; font-size:12px; background:#151515; padding:8px; border-radius:6px; max-height:300px; overflow:auto; }
</style></head>
<body>${bodyHtml}</body></html>`;
}

module.exports = async function handler(req, res) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const suppliedPassword = req.query ? req.query.password : null;

    if (!adminPassword) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(500).send(renderPage(
        '<h1>Not configured yet</h1><p>This page needs an ADMIN_PASSWORD set in the Vercel project settings before it will work.</p>'
      ));
    }

    if (!suppliedPassword || suppliedPassword !== adminPassword) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(401).send(renderPage(`
        <h1>WDYT Responses</h1>
        <p>Enter the password to view saved responses.</p>
        <form method="GET">
          <input type="password" name="password" placeholder="Password" autofocus />
          <button type="submit">View</button>
        </form>
      `));
    }

    const { blobs } = await list({ prefix: 'responses/', limit: 1000 });
    console.log('view-responses: list() found', blobs.length, 'blob(s) with prefix "responses/":',
      blobs.map(b => b.pathname || b.url));

    let readErrors = 0;
    const records = await Promise.all(blobs.map(async (b) => {
      try {
        // Private stores require the authenticated get() method -- a plain
        // fetch(b.url) only works for public blobs and would 403 here.
        const result = await get(b.url);
        const text = await new Response(result.stream).text();
        return JSON.parse(text);
      } catch (e) {
        readErrors++;
        console.error('view-responses: failed to read blob', b.pathname || b.url, '--', e.message);
        return null;
      }
    }));

    const valid = records.filter(Boolean).sort((a, b) =>
      new Date(b.completedAt) - new Date(a.completedAt)
    );

    const debugLine = `<p class="muted">Debug: found ${blobs.length} file(s) in storage, ${readErrors} failed to read.</p>`;

    const rows = valid.map(r => `
      <tr>
        <td>${escapeHtml(r.testerName || 'Guest')}</td>
        <td>${escapeHtml(new Date(r.completedAt).toLocaleString())}</td>
        <td>${escapeHtml(r.vibeTitle || '—')}</td>
        <td>${r.simTotal ? escapeHtml(r.simCorrect + ' / ' + r.simTotal) : '—'}</td>
        <td>
          <details>
            <summary>${(r.responses || []).length} answers</summary>
            <pre>${escapeHtml(JSON.stringify(r.responses, null, 2))}</pre>
          </details>
        </td>
      </tr>`).join('');

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(renderPage(`
      <h1>WDYT Responses</h1>
      <p class="count">${valid.length} completed session${valid.length === 1 ? '' : 's'}</p>
      ${debugLine}
      <table>
        <tr><th>Name</th><th>Completed</th><th>Vibe</th><th>Predictions</th><th>Answers</th></tr>
        ${rows || '<tr><td colspan="5" class="muted">No responses yet.</td></tr>'}
      </table>
    `));

  } catch (err) {
    console.error('view-responses error:', err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(renderPage('<h1>Something went wrong</h1><p>' + escapeHtml(err.message) + '</p>'));
  }
};

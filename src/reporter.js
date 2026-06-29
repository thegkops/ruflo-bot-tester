import fs   from 'fs';
import path  from 'path';

function scoreColor(score) {
  if (score === null || score === undefined) return '#64748b';
  if (score >= 0.8) return '#10b981';
  if (score >= 0.5) return '#f59e0b';
  return '#ef4444';
}

function verdictBadge(verdict) {
  const colors = { pass: '#10b981', fail: '#ef4444', error: '#f59e0b', unknown: '#64748b' };
  const labels = { pass: 'PASS', fail: 'FAIL', error: 'ERR', unknown: '?' };
  const c = colors[verdict] || '#64748b';
  return `<span style="background:${c};color:#fff;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700">${labels[verdict] || verdict}</span>`;
}

function renderTurn(turn, idx) {
  const turnPassed = turn.passed && !turn.error;
  return `
    <div class="turn ${turnPassed ? '' : 'turn-fail'}">
      <div class="turn-header">Turn ${idx + 1}</div>
      <div class="bubble user-bubble">
        <div class="bubble-label">User</div>
        <div class="bubble-text">${esc(turn.user)}</div>
      </div>
      ${turn.error ? `<div class="bubble error-bubble"><div class="bubble-label">Error</div><div class="bubble-text">${esc(turn.error)}</div></div>` : `
      <div class="bubble bot-bubble">
        <div class="bubble-label">Bot <span class="latency">${turn.latency_ms}ms</span></div>
        <div class="bubble-text">${esc(turn.response || '')}</div>
      </div>`}
      ${turn.checks?.length ? `<div class="checks-row">${turn.checks.map(c =>
        `<div class="check-chip check-${c.verdict}" title="${esc(c.detail || '')}">
          ${c.name} ${verdictBadge(c.verdict)}
          ${c.score != null ? `<span class="chip-score">${(c.score * 100).toFixed(0)}%</span>` : ''}
        </div>`
      ).join('')}</div>` : ''}
    </div>`;
}

function renderTest(r) {
  if (r.skipped) {
    return `<div class="test-card skipped">
      <div class="test-header"><span class="test-id">${esc(r.id||'')}</span> <span class="test-name">${esc(r.name)}</span> <span class="badge badge-skip">SKIPPED</span></div>
    </div>`;
  }
  const badge = r.passed
    ? '<span class="badge badge-pass">PASS</span>'
    : '<span class="badge badge-fail">FAIL</span>';
  const scoreHtml = r.score != null
    ? `<span class="test-score" style="color:${scoreColor(r.score)}">${(r.score * 100).toFixed(0)}%</span>` : '';

  return `<div class="test-card ${r.passed ? '' : 'test-fail'}">
    <div class="test-header">
      <span class="test-id">${esc(r.id||'')}</span>
      <span class="test-name">${esc(r.name)}</span>
      <div class="test-meta">
        ${scoreHtml}
        ${badge}
        <span class="test-duration">${r.duration_ms}ms</span>
        ${(r.tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
    </div>
    ${r.turns?.map((t, i) => renderTurn(t, i)).join('') || ''}
  </div>`;
}

export function generateHtml(report) {
  const { suite_name, bot, ran_at, summary, results } = report;
  const passRate = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0;
  const scoreStr = summary.avg_score != null ? `${(summary.avg_score * 100).toFixed(1)}%` : 'N/A';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(suite_name)} — Bot Test Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
    .header{background:linear-gradient(135deg,#1e40af,#7c3aed);border-radius:12px;padding:24px;margin-bottom:20px}
    .header h1{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px}
    .header-meta{font-size:12px;color:rgba(255,255,255,.7)}
    .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
    .stat{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px;text-align:center}
    .stat strong{display:block;font-size:24px;font-weight:800;margin-bottom:4px}
    .stat span{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
    .stat.pass strong{color:#10b981}.stat.fail strong{color:#ef4444}.stat.score strong{color:#60a5fa}
    .test-card{background:#1e293b;border:1px solid #334155;border-radius:10px;margin-bottom:12px;overflow:hidden}
    .test-card.test-fail{border-color:#7f1d1d}
    .test-card.skipped{opacity:.6}
    .test-header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0f172a;flex-wrap:wrap}
    .test-id{font-family:monospace;font-size:11px;color:#64748b;background:#1e293b;padding:2px 6px;border-radius:4px}
    .test-name{font-weight:600;font-size:13px;flex:1}
    .test-meta{display:flex;align-items:center;gap:6px;margin-left:auto}
    .test-score{font-size:14px;font-weight:700}
    .test-duration{font-size:11px;color:#64748b;font-family:monospace}
    .badge{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700}
    .badge-pass{background:#064e3b;color:#34d399}.badge-fail{background:#7f1d1d;color:#fca5a5}.badge-skip{background:#1e293b;color:#64748b}
    .tag{background:#1e3a5f;color:#60a5fa;padding:1px 6px;border-radius:4px;font-size:10px}
    .turn{padding:12px 14px;border-top:1px solid #1e293b}
    .turn-fail{background:rgba(127,29,29,.15)}
    .turn-header{font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
    .bubble{margin-bottom:8px}
    .bubble-label{font-size:10px;color:#64748b;margin-bottom:3px;display:flex;align-items:center;gap:6px}
    .latency{font-family:monospace;font-size:10px;background:#1e293b;padding:1px 5px;border-radius:3px}
    .bubble-text{background:#0f172a;border:1px solid #334155;border-radius:7px;padding:8px 10px;font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
    .user-bubble .bubble-text{border-color:#1e40af;background:#0f1f3d}
    .bot-bubble .bubble-text{border-color:#334155}
    .error-bubble .bubble-text{border-color:#7f1d1d;background:#1f0a0a;color:#fca5a5}
    .checks-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .check-chip{display:flex;align-items:center;gap:4px;background:#0f172a;border:1px solid #334155;border-radius:5px;padding:3px 8px;font-size:11px;cursor:help}
    .check-pass{border-color:#064e3b}.check-fail{border-color:#7f1d1d}.check-error{border-color:#78350f}
    .chip-score{font-family:monospace;font-size:10px;color:#94a3b8}
    .filter-bar{margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap}
    .filter-btn{font-size:12px;font-weight:600;padding:5px 14px;border-radius:6px;border:1px solid #334155;cursor:pointer;background:transparent;color:#94a3b8;transition:all .15s}
    .filter-btn.active{background:#1e40af;border-color:#1e40af;color:#fff}
  </style>
</head>
<body>
  <div class="header">
    <h1>🚂 ${esc(suite_name)}</h1>
    <div class="header-meta">
      Bot: ${esc(bot?.provider || 'unknown')} · ${esc(bot?.model || '')} &nbsp;|&nbsp;
      Ran: ${new Date(ran_at).toLocaleString()} &nbsp;|&nbsp;
      Powered by ruflo-bot-tester
    </div>
  </div>

  <div class="stats">
    <div class="stat"><strong>${summary.total}</strong><span>Total</span></div>
    <div class="stat pass"><strong>${summary.passed}</strong><span>Passed</span></div>
    <div class="stat fail"><strong>${summary.failed}</strong><span>Failed</span></div>
    <div class="stat"><strong>${summary.skipped}</strong><span>Skipped</span></div>
    <div class="stat score"><strong>${scoreStr}</strong><span>Avg Score</span></div>
  </div>

  <div class="filter-bar">
    <button class="filter-btn active" onclick="filterTests('all')">All (${summary.total})</button>
    <button class="filter-btn" onclick="filterTests('fail')">Failed (${summary.failed})</button>
    <button class="filter-btn" onclick="filterTests('pass')">Passed (${summary.passed})</button>
  </div>

  <div id="results">
    ${results.map(renderTest).join('')}
  </div>

  <script>
    function filterTests(type) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      document.querySelectorAll('.test-card').forEach(c => {
        const isFail = c.classList.contains('test-fail');
        const isSkip = c.classList.contains('skipped');
        if (type === 'all') c.style.display = '';
        else if (type === 'fail') c.style.display = isFail ? '' : 'none';
        else if (type === 'pass') c.style.display = (!isFail && !isSkip) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  return html;
}

export function saveReport(report, outDir = './reports') {
  fs.mkdirSync(outDir, { recursive: true });
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = path.join(outDir, `report-${ts}`);

  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${base}.html`, generateHtml(report));

  return { json: `${base}.json`, html: `${base}.html` };
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

// public/js/app.js — EchoBoard client logic

const API = {
  submit:  '../api/submit.php',
  list:    '../api/list.php',
  summary: '../api/summary.php',
  soap:    '../soap/service.php',
};

/* ── Toast notifications ─────────────────────────────────────────────── */
function toast(msg, type = 'info', ms = 3500) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 320);
  }, ms);
}

/* ── Stars helper ────────────────────────────────────────────────────── */
function starsStr(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

/* ── Sentiment badge ─────────────────────────────────────────────────── */
function sentimentBadge(s) {
  const map = { positive: 'badge-pos', neutral: 'badge-neu', negative: 'badge-neg' };
  return `<span class="badge ${map[s] || 'badge-neu'}">${s}</span>`;
}

/* ── Load summary stats ──────────────────────────────────────────────── */
async function loadSummary() {
  const res  = await fetch(API.summary);
  const data = await res.json();
  const t    = data.totals;

  document.getElementById('stat-total').textContent   = t.total_count  ?? 0;
  document.getElementById('stat-avg').textContent     = t.avg_rating   ?? '–';
  document.getElementById('stat-pos').textContent     = t.positive     ?? 0;
  document.getElementById('stat-neg').textContent     = t.negative     ?? 0;

  // Rating distribution bars
  const maxCount = Math.max(...data.by_rating.map(r => +r.count), 1);
  const barsEl   = document.getElementById('rating-bars');
  barsEl.innerHTML = '';

  for (let i = 5; i >= 1; i--) {
    const row   = data.by_rating.find(r => +r.rating === i) || { count: 0 };
    const pct   = Math.round((row.count / maxCount) * 100);
    barsEl.insertAdjacentHTML('beforeend', `
      <div class="rating-row">
        <span>${i}★</span>
        <div class="bar-track"><div class="bar-fill" style="width:0%" data-w="${pct}%"></div></div>
        <span>${row.count}</span>
      </div>`);
  }
  // Animate bars after paint
  requestAnimationFrame(() => {
    document.querySelectorAll('.bar-fill').forEach(b => b.style.width = b.dataset.w);
  });
}

/* ── Load feedback list ──────────────────────────────────────────────── */
async function loadFeedback(cat = '') {
  const list = document.getElementById('feedback-list');
  list.innerHTML = '<div class="spinner"></div>';

  const url = cat ? `${API.list}?category=${encodeURIComponent(cat)}` : API.list;
  const res  = await fetch(url);
  const data = await res.json();

  if (!data.feedback.length) {
    list.innerHTML = '<div class="empty-state">No feedback yet — be the first! 🎉</div>';
    return;
  }

  list.innerHTML = data.feedback.map(f => `
    <div class="feedback-item" style="animation-delay:${Math.random()*0.2}s">
      <div class="feedback-meta">
        <span class="feedback-name">${escHtml(f.name)}</span>
        <span class="badge badge-cat">${escHtml(f.category)}</span>
        ${sentimentBadge(f.sentiment)}
        <span class="feedback-stars">${starsStr(+f.rating)}</span>
        <span class="feedback-time">${timeAgo(f.created_at)}</span>
      </div>
      <div class="feedback-msg">${escHtml(f.message)}</div>
    </div>
  `).join('');
}

/* ── Submit form via AJAX ────────────────────────────────────────────── */
async function submitFeedback(e) {
  e.preventDefault();
  const btn  = document.getElementById('submit-btn');
  const form = e.target;

  const payload = {
    name:     form.name.value.trim(),
    email:    form.email.value.trim(),
    category: form.category.value,
    rating:   form.querySelector('input[name="rating"]:checked')?.value ?? 0,
    message:  form.message.value.trim(),
  };

  btn.disabled    = true;
  btn.textContent = 'Sending…';

  try {
    const res  = await fetch(API.submit, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      toast(data.errors.join(' '), 'error', 5000);
    } else {
      toast('Feedback submitted! ✓', 'success');
      form.reset();
      await Promise.all([loadSummary(), loadFeedback(), loadSummaryPanel()]);
    }
  } catch {
    toast('Network error. Please try again.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit Feedback';
  }
}

/* ── Summary panel ───────────────────────────────────────────────────── */
let _summaryData = null;

async function loadSummaryPanel() {
  // Fetch both JSON (REST) and XML (SOAP) in parallel
  const [jsonRes, xmlRes] = await Promise.all([
    fetch(API.summary),
    fetch(`${API.soap}?method=GetSummary`),
  ]);
  _summaryData = await jsonRes.json();
  const xmlText = await xmlRes.text();

  renderSummaryVisual(_summaryData);

  // XML panel
  document.getElementById('soap-output').innerHTML = syntaxHighlight(xmlText);

  // JSON panel
  document.getElementById('json-output').innerHTML =
    syntaxHighlight(JSON.stringify(_summaryData, null, 2)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
}

function renderSummaryVisual(data) {
  const t   = data.totals;
  const cats = data.by_category || [];

  const sentimentBar = (pos, neu, neg, total) => {
    if (!total) return '<div style="color:var(--text-sub);font-size:0.8rem">No data yet</div>';
    const pp = Math.round((pos/total)*100);
    const np = Math.round((neu/total)*100);
    const ngp= Math.round((neg/total)*100);
    return `
      <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;gap:2px;margin:0.5rem 0">
        <div style="width:${pp}%;background:#10b981;border-radius:999px 0 0 999px" title="Positive ${pp}%"></div>
        <div style="width:${np}%;background:#94a3b8" title="Neutral ${np}%"></div>
        <div style="width:${ngp}%;background:#ef4444;border-radius:0 999px 999px 0" title="Negative ${ngp}%"></div>
      </div>
      <div style="display:flex;gap:1rem;font-size:0.72rem;color:var(--text-sub)">
        <span style="color:#10b981">● Positive ${pp}%</span>
        <span style="color:#94a3b8">● Neutral ${np}%</span>
        <span style="color:#ef4444">● Negative ${ngp}%</span>
      </div>`;
  };

  const catRows = cats.map(c => `
    <tr>
      <td style="padding:0.45rem 0.5rem;font-weight:600;font-size:0.85rem">${escHtml(c.category)}</td>
      <td style="padding:0.45rem 0.5rem;text-align:center;font-size:0.85rem">${c.count}</td>
      <td style="padding:0.45rem 0.5rem;text-align:center">
        <span style="color:var(--gold);font-size:0.85rem">${'★'.repeat(Math.round(c.avg_rating))}${'☆'.repeat(5-Math.round(c.avg_rating))}</span>
        <span style="font-size:0.75rem;color:var(--text-sub);margin-left:4px">${c.avg_rating}</span>
      </td>
    </tr>`).join('');

  document.getElementById('summary-rendered').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1rem">

      <!-- Sentiment breakdown -->
      <div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-sub);margin-bottom:0.25rem">Sentiment Breakdown</div>
        ${sentimentBar(+t.positive||0, +t.neutral||0, +t.negative||0, +t.total_count||0)}
      </div>

      <!-- Per-category table -->
      <div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-sub);margin-bottom:0.5rem">By Category</div>
        ${cats.length ? `
        <table style="width:100%;border-collapse:collapse;font-family:'DM Sans',sans-serif">
          <thead>
            <tr style="border-bottom:2px solid var(--gray-200)">
              <th style="padding:0.35rem 0.5rem;text-align:left;font-size:0.72rem;color:var(--text-sub);font-weight:600;text-transform:uppercase">Category</th>
              <th style="padding:0.35rem 0.5rem;text-align:center;font-size:0.72rem;color:var(--text-sub);font-weight:600;text-transform:uppercase">Count</th>
              <th style="padding:0.35rem 0.5rem;text-align:center;font-size:0.72rem;color:var(--text-sub);font-weight:600;text-transform:uppercase">Avg Rating</th>
            </tr>
          </thead>
          <tbody>${catRows}</tbody>
        </table>` : '<div style="color:var(--text-sub);font-size:0.85rem">No entries yet.</div>'}
      </div>

      <div style="font-size:0.7rem;color:var(--text-sub);border-top:1px solid var(--gray-200);padding-top:0.5rem">
        Via SOAP Web Service &amp; REST API · Generated ${new Date(data.generated_at).toLocaleTimeString()}
        · <span style="color:var(--blue-light);cursor:pointer" onclick="switchSummaryTab('xml')">View XML</span>
        · <span style="color:var(--blue-light);cursor:pointer" onclick="switchSummaryTab('json')">View JSON</span>
      </div>
    </div>`;
}

function switchSummaryTab(tab) {
  document.getElementById('summary-visual').style.display = tab === 'visual' ? '' : 'none';
  document.getElementById('summary-xml').style.display    = tab === 'xml'    ? '' : 'none';
  document.getElementById('summary-json').style.display   = tab === 'json'   ? '' : 'none';
  document.getElementById('tab-visual').classList.toggle('active', tab === 'visual');
  document.getElementById('tab-xml').classList.toggle('active',    tab === 'xml');
  document.getElementById('tab-json').classList.toggle('active',   tab === 'json');
}

/* ── XML syntax highlight ────────────────────────────────────────────── */
function syntaxHighlight(xml) {
  return xml
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(&lt;\/?[\w:]+)/g, '<span class="xml-tag">$1</span>')
    .replace(/(&gt;)([^&\n<]+)(&lt;)/g, '$1<span class="xml-val">$2</span>$3');
}

/* ── Utils ───────────────────────────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dt) {
  const d    = new Date(dt.replace(' ', 'T') + 'Z');
  const secs = Math.floor((Date.now() - d) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400)return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

/* ── Boot ────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadSummary();
  loadFeedback();
  loadSummaryPanel();

  document.getElementById('feedback-form').addEventListener('submit', submitFeedback);

  document.getElementById('cat-filter').addEventListener('change', function () {
    loadFeedback(this.value);
  });
});

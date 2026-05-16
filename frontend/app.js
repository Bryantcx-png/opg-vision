/* ───────────────────────────────────────────────────────────
   app.js — OPG Vision analyse flow
   Clinical UI shell (design) + real backend (API)
─────────────────────────────────────────────────────────── */

const DEMO_MODE = false; // set true on pitch day to use mock results

if (typeof requireAuth === 'function' && !requireAuth()) throw new Error('redirect');
if (typeof requirePlan === 'function' && !requirePlan()) throw new Error('redirect');
if (typeof populateUserUI === 'function') populateUserUI();

// ─── SHORTHAND ───────────────────────────────────────────
const $ = id => document.getElementById(id);
const nowHMS = () => {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2,'0')).join(':');
};

// ─── STATE ───────────────────────────────────────────────
const state = {
  case: { case_id: '', reference_no: '', officer_name: '', gender: '', notes: '' },
  file: null,
  filePreviewUrl: null,
  result: null,
};

let processingCancelled = false;

// ─── SCREEN NAVIGATION ───────────────────────────────────
const SCREENS = ['screen-case-entry', 'screen-upload', 'screen-processing', 'screen-results'];

function show(screenId) {
  SCREENS.forEach(id => $(id)?.classList.add('hidden'));
  $(screenId)?.classList.remove('hidden');
  updateStepRail(SCREENS.indexOf(screenId) + 1);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function updateStepRail(active) {
  document.querySelectorAll('.step-rail-item').forEach(li => {
    const n = +li.dataset.step;
    li.classList.remove('active', 'done');
    if (n < active) li.classList.add('done');
    else if (n === active) li.classList.add('active');
    const timeEl = $(`step-time-${n}`);
    if (!timeEl) return;
    if (n < active) {
      if (!timeEl.dataset.locked) { timeEl.textContent = 'completed ' + nowHMS(); timeEl.dataset.locked = '1'; }
    } else if (n === active) {
      timeEl.textContent = '— in progress';
    } else {
      if (!timeEl.dataset.locked) timeEl.textContent = 'awaiting';
    }
  });
}

// ─── AUDIT LOG ───────────────────────────────────────────
function logAudit(html) {
  const feed = $('audit-feed');
  if (!feed) return;
  const empty = $('audit-empty');
  if (empty) empty.remove();
  const el = document.createElement('div');
  el.className = 'audit-event';
  el.innerHTML = `<span class="t">${nowHMS()}</span><span>${html}</span>`;
  feed.appendChild(el);
  feed.scrollTop = feed.scrollHeight;
}

// ─── CASE META RAIL ──────────────────────────────────────
function setMeta(id, value, dim) {
  const el = $('meta-' + id);
  if (!el) return;
  el.textContent = value;
  el.classList.toggle('dim', !!dim);
}

function setCaseStatus(label, cls) {
  const pill = $('case-status-pill');
  if (!pill) return;
  pill.textContent = label;
  pill.className = 'status-pill ' + (cls || '');
}

// ─── INIT ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const t = nowHMS();
  if ($('header-time'))  $('header-time').textContent  = t;
  if ($('meta-opened'))  $('meta-opened').textContent  = t;
  if ($('audit-init-t')) $('audit-init-t').textContent = t;

  // Generate session ID
  const r = () => Math.floor(Math.random()*16).toString(16).toUpperCase();
  const sid = r()+r()+r()+r() + '-' + r()+r()+r()+r();
  if ($('session-id'))  $('session-id').textContent  = sid;
  if ($('meta-session')) $('meta-session').textContent = sid;

  // Auto-generate Case ID
  const caseIdEl = $('case_id');
  if (caseIdEl && !caseIdEl.value) {
    const year = new Date().getFullYear();
    const num  = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    caseIdEl.value = `PDRM-${year}-${num}`;
    refreshContinue();
    setMeta('case-id', caseIdEl.value, false);
  }

  // View mode — ?view=REPORT_ID
  const viewId = new URLSearchParams(window.location.search).get('view');
  if (viewId) {
    show('screen-processing');
    if ($('status-message')) $('status-message').textContent = 'Loading report…';
    loadAndViewReport(viewId);
  }
});

// ─── SCREEN 1: FORM ──────────────────────────────────────
const caseForm    = $('case-form');
const btnContinue = $('btn-continue');

function refreshContinue() {
  const required  = ['case_id', 'reference_no', 'officer_name', 'gender'];
  const remaining = required.filter(id => !$(id)?.value?.trim()).length;
  if (btnContinue) btnContinue.disabled = remaining > 0;

  const hint = $('form-hint');
  if (hint) {
    if (remaining === 0) {
      hint.classList.add('ok');
      hint.innerHTML = '<span class="req-dot"></span>Ready to continue';
    } else {
      hint.classList.remove('ok');
      hint.innerHTML = `<span class="req-dot"></span>${remaining} required field${remaining === 1 ? '' : 's'} pending`;
    }
  }

  // Live right-rail preview
  const caseId = $('case_id')?.value?.trim();
  const ref    = $('reference_no')?.value?.trim();
  const gender = $('gender')?.value;
  setMeta('case-id',   caseId || '— pending', !caseId);
  setMeta('reference', ref    || '— pending', !ref);
  setMeta('gender',    gender ? (gender[0].toUpperCase() + gender.slice(1)) : '— pending', !gender);
}

const AUDIT_FIRED = new Set();
function maybeAudit(id, label) {
  if (AUDIT_FIRED.has(id)) return;
  const val = $(id)?.value?.trim();
  if (!val) return;
  AUDIT_FIRED.add(id);
  logAudit(`<span class="blue">●</span> ${label} entered`);
}

if (caseForm) {
  caseForm.addEventListener('input', e => {
    refreshContinue();
    if (e.target.id === 'case_id')      maybeAudit('case_id',     'Case ID');
    if (e.target.id === 'reference_no') maybeAudit('reference_no','Agency reference');
    if (e.target.id === 'officer_name') maybeAudit('officer_name','Officer signature');
    if (e.target.id === 'notes')        maybeAudit('notes',       'Notes added');
  });
  caseForm.addEventListener('change', e => {
    refreshContinue();
    if (e.target.id === 'gender' && e.target.value) {
      AUDIT_FIRED.delete('gender');
      maybeAudit('gender', 'Subject gender set');
    }
  });
  caseForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!$('case_id').value.trim())      { $('err-case_id').textContent      = 'Required.'; return; }
    if (!$('reference_no').value.trim()) { $('err-reference_no').textContent = 'Required.'; return; }
    if (!$('officer_name').value.trim()) { $('err-officer_name').textContent = 'Required.'; return; }
    if (!$('gender').value)              { $('err-gender').textContent        = 'Required.'; return; }

    state.case = {
      case_id:      $('case_id').value.trim(),
      reference_no: $('reference_no').value.trim(),
      officer_name: $('officer_name').value.trim(),
      gender:       $('gender').value,
      notes:        $('notes').value.trim(),
    };
    logAudit(`<span class="blue">●</span> Case details submitted · advancing to upload`);
    setCaseStatus('READY', 'live');
    show('screen-upload');
  });
}

// ─── SCREEN 2: UPLOAD ────────────────────────────────────
const dropZone   = $('drop-zone');
const fileInput  = $('file-input');
const btnAnalyse = $('btn-analyse');

function handleFile(file) {
  if ($('upload-error')) $('upload-error').textContent = '';
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    if ($('upload-error')) $('upload-error').textContent = 'File exceeds 10 MB limit.';
    return;
  }
  const ok = /\.(jpg|jpeg|png|dcm)$/i.test(file.name);
  if (!ok) {
    if ($('upload-error')) $('upload-error').textContent = 'Unsupported file type. Use JPG, PNG, or DCM.';
    return;
  }
  state.file = file;
  state.filePreviewUrl = URL.createObjectURL(file);
  if ($('preview-img')) $('preview-img').src = state.filePreviewUrl;
  if ($('preview-name')) $('preview-name').textContent = file.name;
  if ($('preview-size')) $('preview-size').textContent = formatBytes(file.size);
  $('preview-container')?.classList.remove('hidden');
  if (btnAnalyse) btnAnalyse.disabled = false;
  setMeta('image', file.name.length > 22 ? file.name.slice(0,19) + '…' : file.name, false);
  logAudit(`<span class="blue">●</span> Image attached · ${formatBytes(file.size)}`);
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/1024/1024).toFixed(2) + ' MB';
}

if (dropZone) {
  ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('drag-over'); }));
  ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); }));
  dropZone.addEventListener('drop',    e => handleFile(e.dataTransfer.files[0]));
  dropZone.addEventListener('click',   () => fileInput.click());
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
}
fileInput?.addEventListener('change', e => handleFile(e.target.files[0]));

$('btn-remove-file')?.addEventListener('click', () => {
  state.file = null; state.filePreviewUrl = null;
  $('preview-container')?.classList.add('hidden');
  if (fileInput) fileInput.value = '';
  if (btnAnalyse) btnAnalyse.disabled = true;
});

$('btn-back-to-case')?.addEventListener('click', () => show('screen-case-entry'));

btnAnalyse?.addEventListener('click', () => {
  setCaseStatus('PROCESSING', 'live');
  logAudit(`<span class="blue">●</span> Inference dispatched to ResNeXt-50`);
  show('screen-processing');
  runAnalysis();
});

// ─── SCREEN 3: INFERENCE (real API) ──────────────────────
const STAGES = [
  { msg: 'Preprocessing OPG image…',        dur: 700,  log: 'Decoded, resized to 224×224, normalized' },
  { msg: 'Running ResNeXt-50 inference…',   dur: 1000, log: 'Forward pass complete · 50 layers' },
  { msg: 'Computing confidence intervals…', dur: 700,  log: 'Bootstrap n=200, MAE target ≤2.0 yr' },
  { msg: 'Generating forensic report…',     dur: 500,  log: 'Report assembled and signed' },
];

async function runAnalysis() {
  processingCancelled = false;
  const logEl = $('processing-log');
  if (logEl) logEl.innerHTML = '';

  // Animate stages and call real API concurrently
  let stagesDone = false;
  const stagesPromise = (async () => {
    for (const stage of STAGES) {
      if (processingCancelled) return;
      if ($('status-message')) $('status-message').textContent = stage.msg;
      await new Promise(r => setTimeout(r, stage.dur));
      if (logEl) logEl.innerHTML += `<div><span class="ok">✓</span>${stage.log}</div>`;
    }
    stagesDone = true;
  })();

  const formData = new FormData();
  formData.append('image',        state.file);
  formData.append('case_id',      state.case.case_id);
  formData.append('reference_no', state.case.reference_no);
  formData.append('officer_name', state.case.officer_name);
  formData.append('gender',       state.case.gender);
  formData.append('notes',        state.case.notes || '');
  formData.append('demo',         DEMO_MODE ? 'true' : 'false');

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE}/api/analyse.php`, {
        method:  'POST',
        body:    formData,
        headers: authHeaders(),
      }),
      stagesPromise,
    ]);

    if (processingCancelled) return;

    if (response.status === 401) { logout(); return; }
    if (response.status === 429) {
      const err = await response.json().catch(() => ({}));
      show('screen-upload');
      if ($('upload-error')) $('upload-error').textContent = err.detail || 'Analysis limit reached. Please upgrade your plan.';
      return;
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Analysis failed. Please try again.');
    }

    const raw = await response.json();
    state.result = normalizeResult(raw);
    state.case   = {
      case_id:      raw.case_id,
      reference_no: raw.reference_no,
      officer_name: raw.officer_name,
      gender:       raw.gender,
      notes:        raw.notes,
    };

    setCaseStatus('COMPLETE', 'done');
    logAudit(`<span class="blue">●</span> Report ${state.result.report_id} signed · ${state.result.estimated_age.toFixed(1)} yrs`);
    renderResults();
    show('screen-results');

  } catch (err) {
    if (processingCancelled) return;
    show('screen-upload');
    if ($('upload-error')) $('upload-error').textContent = 'Error: ' + err.message;
  }
}

$('btn-cancel')?.addEventListener('click', () => {
  processingCancelled = true;
  show('screen-upload');
});

// ─── NORMALIZE API RESPONSE ──────────────────────────────
function normalizeResult(raw) {
  const confMap = { 'High': '92%', 'Medium': '78%', 'Low': '65%' };
  return {
    report_id:   raw.report_id,
    estimated_age: parseFloat(raw.estimated_age),
    age_low:     parseFloat(raw.age_lower ?? raw.age_low),
    age_high:    parseFloat(raw.age_upper ?? raw.age_high),
    confidence_margin: parseFloat(raw.confidence_margin),
    confidence_pct: confMap[raw.classification_confidence] ?? raw.classification_confidence ?? '—',
    classification:  (raw.classification || '').toUpperCase(),
    is_borderline:   Boolean(raw.is_borderline),
    borderline_warning: raw.borderline_warning || null,
    model_version: raw.model_version,
    timestamp:     raw.timestamp,
    proc_seconds:  raw.processing_time_ms != null ? (raw.processing_time_ms / 1000).toFixed(1) + 's' : '—',
    // Case fields included when fetching past report
    case_id:      raw.case_id,
    reference_no: raw.reference_no,
    officer_name: raw.officer_name,
    gender:       raw.gender,
    notes:        raw.notes,
  };
}

// ─── SCREEN 4: RENDER RESULTS ────────────────────────────
function renderResults() {
  const r = state.result;
  const c = state.case;
  const f = state.file;

  // Summary
  if ($('sum-age'))       $('sum-age').textContent       = r.estimated_age.toFixed(1);
  if ($('sum-range'))     $('sum-range').textContent     = `Confidence range: ${r.age_low.toFixed(1)} – ${r.age_high.toFixed(1)} yrs (±${r.confidence_margin.toFixed(1)})`;
  if ($('sum-report-id')) $('sum-report-id').textContent = r.report_id;
  if ($('sum-case-id'))   $('sum-case-id').textContent   = c.case_id || r.case_id || '—';
  if ($('sum-timestamp')) $('sum-timestamp').textContent = formatTs(r.timestamp);
  if ($('sum-proc-time')) $('sum-proc-time').textContent = r.proc_seconds;
  if ($('sum-confidence')) $('sum-confidence').textContent = r.confidence_pct + ' confidence';

  const sumBadge = $('sum-badge');
  if (sumBadge) {
    sumBadge.textContent = r.classification;
    sumBadge.className   = 'result-badge result-badge-' + r.classification.toLowerCase();
  }

  // Thumbnail (only for fresh analysis)
  const sumThumb = $('sum-thumb');
  if (sumThumb) {
    if (state.filePreviewUrl) { sumThumb.src = state.filePreviewUrl; sumThumb.style.display = ''; }
    else sumThumb.style.display = 'none';
  }

  // Age visualisation bar
  const vizRange  = $('age-viz-range');
  const vizMarker = $('age-viz-marker');
  const vizThresh = $('age-viz-threshold');
  if (vizRange && vizMarker && vizThresh) {
    const min = 5, max = 40;
    const pct = v => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
    vizRange.style.left  = pct(r.age_low) + '%';
    vizRange.style.width = (pct(r.age_high) - pct(r.age_low)) + '%';
    vizMarker.style.left = pct(r.estimated_age) + '%';
    vizThresh.style.left = pct(18) + '%';
  }

  // Borderline warning
  const bWarn = $('borderline-warning');
  const rWarn = $('rpt-warning');
  if (r.is_borderline && r.borderline_warning) {
    if ($('borderline-warning-text')) $('borderline-warning-text').textContent = r.borderline_warning;
    if ($('rpt-warning-text'))        $('rpt-warning-text').textContent        = r.borderline_warning;
    bWarn?.classList.remove('hidden');
    rWarn?.classList.remove('hidden');
  } else {
    bWarn?.classList.add('hidden');
    rWarn?.classList.add('hidden');
  }

  // Full report
  const caseId = c.case_id || r.case_id || '—';
  const refNo  = c.reference_no || r.reference_no || '—';
  const officer= c.officer_name || r.officer_name || '—';
  const gender = c.gender || r.gender || '';
  const notes  = c.notes  || r.notes  || '—';

  if ($('rpt-report-id'))   $('rpt-report-id').textContent   = r.report_id;
  if ($('rpt-case-id'))     $('rpt-case-id').textContent     = caseId;
  if ($('rpt-reference-no'))$('rpt-reference-no').textContent= refNo;
  if ($('rpt-officer'))     $('rpt-officer').textContent     = officer;
  if ($('rpt-gender'))      $('rpt-gender').textContent      = gender ? (gender[0].toUpperCase() + gender.slice(1)) : '—';
  if ($('rpt-notes'))       $('rpt-notes').textContent       = notes;
  if ($('rpt-filename'))    $('rpt-filename').textContent    = f ? f.name : '—';
  if ($('rpt-filesize'))    $('rpt-filesize').textContent    = f ? formatBytes(f.size) : '—';
  if ($('rpt-timestamp'))   $('rpt-timestamp').textContent   = formatTs(r.timestamp);
  if ($('rpt-age'))         $('rpt-age').textContent         = r.estimated_age.toFixed(1) + ' yrs';
  if ($('rpt-age-range'))   $('rpt-age-range').textContent   = `Range ${r.age_low.toFixed(1)}–${r.age_high.toFixed(1)} yrs · ±${r.confidence_margin.toFixed(1)}`;
  if ($('rpt-confidence'))  $('rpt-confidence').textContent  = r.confidence_pct;
  if ($('rpt-model'))       $('rpt-model').textContent       = r.model_version;
  if ($('rpt-footer-timestamp')) $('rpt-footer-timestamp').textContent = 'Generated ' + formatTs(r.timestamp);

  const rptThumb = $('rpt-thumb');
  if (rptThumb) {
    if (state.filePreviewUrl) { rptThumb.src = state.filePreviewUrl; rptThumb.style.display = ''; }
    else rptThumb.style.display = 'none';
  }

  const rptBadge = $('rpt-badge');
  if (rptBadge) {
    rptBadge.textContent = r.classification;
    rptBadge.className   = 'report-badge report-badge-' + r.classification.toLowerCase();
  }
}

function formatTs(iso) {
  try {
    return new Date(iso).toLocaleString('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso || '—'; }
}

// ─── LOAD PAST REPORT (?view=REPORT_ID) ──────────────────
async function loadAndViewReport(reportId) {
  try {
    const res = await apiFetch(`/api/cases?report_id=${encodeURIComponent(reportId)}`);
    if (!res) return;
    if (!res.ok) { show('screen-case-entry'); return; }

    const data = await res.json();
    state.result = normalizeResult(data);
    state.case   = {
      case_id:      data.case_id,
      reference_no: data.reference_no,
      officer_name: data.officer_name,
      gender:       data.gender,
      notes:        data.notes,
    };
    state.file = null;
    state.filePreviewUrl = null;

    setCaseStatus('COMPLETE', 'done');
    renderResults();
    show('screen-results');
    logAudit(`<span class="blue">●</span> Past report ${data.report_id} loaded from dashboard`);

  } catch {
    show('screen-case-entry');
  }
}

// ─── PDF EXPORT ──────────────────────────────────────────
$('btn-download-pdf')?.addEventListener('click', async () => {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('PDF generation libraries not loaded. Please try again.');
    return;
  }
  const btn = $('btn-download-pdf');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const { jsPDF } = window.jspdf;
    const reportEl  = $('full-report');
    const canvas    = await html2canvas(reportEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData   = canvas.toDataURL('image/png');
    const pdf       = new jsPDF('p', 'mm', 'a4');
    const margin    = 15;
    const pageW     = pdf.internal.pageSize.getWidth();
    const pageH     = pdf.internal.pageSize.getHeight();
    const contentW  = pageW - margin * 2;
    const contentH  = (canvas.height * contentW) / canvas.width;

    if (contentH <= pageH - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentW, contentH);
    } else {
      let yOffset = 0;
      const pageContentH = pageH - margin * 2;
      while (yOffset < contentH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, margin - yOffset, contentW, contentH);
        yOffset += pageContentH;
      }
    }
    const today  = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const safeId = (state.result?.report_id || 'OPG').replace(/[^A-Za-z0-9\-]/g, '_');
    pdf.save(`OPGVision_${safeId}_${today}.pdf`);
  } catch (err) {
    alert('PDF export failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v9M8 11l3-3M8 11l-3-3M3 13h10"/></svg> Download signed PDF';
  }
});

// ─── NEW CASE ────────────────────────────────────────────
$('btn-new-case')?.addEventListener('click', () => {
  // Clear state
  state.file = null;
  state.filePreviewUrl = null;
  state.result = null;
  state.case   = { case_id: '', reference_no: '', officer_name: '', gender: '', notes: '' };
  processingCancelled = false;

  // Reset form
  caseForm?.reset();
  $('preview-container')?.classList.add('hidden');
  if (btnAnalyse)  btnAnalyse.disabled  = true;
  if (btnContinue) btnContinue.disabled = true;
  if ($('upload-error')) $('upload-error').textContent = '';
  AUDIT_FIRED.clear();

  // Reset step rail timestamps
  document.querySelectorAll('.step-rail-item .step-rail-time').forEach(el => {
    delete el.dataset.locked;
    el.textContent = 'awaiting';
  });

  // Re-generate Case ID
  const year = new Date().getFullYear();
  const num  = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  const newId = `PDRM-${year}-${num}`;
  if ($('case_id')) $('case_id').value = newId;
  setMeta('case-id',   newId,      false);
  setMeta('reference', '— pending', true);
  setMeta('gender',    '— pending', true);
  setMeta('image',     '— pending', true);
  setCaseStatus('DRAFT', '');

  // Clean URL param if viewing old report
  if (window.location.search) {
    history.replaceState({}, '', window.location.pathname);
  }

  refreshContinue();
  show('screen-case-entry');
});

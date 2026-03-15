/*
 * ============================================================
 *  Emergency Response Dashboard — Client-Side JS App
 *  Fetches dashboard_data.json from the data repo (raw GitHub)
 * ============================================================
 */

// ─────────────────────────────────────────────
//  CONFIGURATION — UPDATE THESE AFTER SETUP
// ─────────────────────────────────────────────
const DATA_CONFIG = {
  owner: "tjoseph82",
  repo:  "claude-test-erd-data",
  branch: "main",
  file:   "dashboard_data.json"
};

function getDataUrl() {
  return `https://raw.githubusercontent.com/${DATA_CONFIG.owner}/${DATA_CONFIG.repo}/${DATA_CONFIG.branch}/${DATA_CONFIG.file}`;
}

// ─── FORMATTERS ───
function fmt(n) { return n == null ? "\u2014" : n.toLocaleString(); }
function fmtM(n) {
  if (n == null) return "\u2014";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString();
}
function stanceBadge(s) {
  var c = s ? s.toLowerCase() : "white";
  return '<span class="stance ' + c + '"><span class="stance-dot"></span>' + (s || "\u2014") + "</span>";
}
function statusBadge(v) {
  if (!v || v === "") return '<span class="status na">\u2014</span>';
  var l = v.toLowerCase();
  if (l === "yes") return '<span class="status yes">Yes</span>';
  if (l.includes("pending")) return '<span class="status pending">Pending</span>';
  if (l === "no") return '<span class="status no">No</span>';
  if (l === "n/a" || l === "not applicable") return '<span class="status na">N/A</span>';
  if (l.includes("meets")) return '<span class="status yes">Meets Standards</span>';
  return '<span class="status na">' + v + "</span>";
}

// ─── GLOBALS ───
var ED = [];
var AVGS = {};

// ─── SORTING STATE ───
var SORT_COL = null;   // column index
var SORT_ASC = true;

// Sortable column definitions: index → { field, type }
var SORTABLE_COLS = {
  1:  { field: "dateClassified",   type: "date" },
  3:  { field: "affected",         type: "number" },
  4:  { field: "reached",          type: "number" },
  5:  { field: "budget",           type: "number" },
  6:  { field: "gap",              type: "number" },
  7:  { field: "daysDecision",     type: "number" },
  8:  { field: "daysMSNA",         type: "number" },
  9:  { field: "daysPlanSub",      type: "number" },
  10: { field: "daysPlanApproval", type: "number" },
  11: { field: "daysClient",       type: "number" }
};

function parseSortDate(s) {
  if (!s) return 0;
  var d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function sortData(data, colIndex, ascending) {
  var col = SORTABLE_COLS[colIndex];
  if (!col) return data;
  var sorted = data.slice(); // copy
  sorted.sort(function(a, b) {
    var va = a[col.field];
    var vb = b[col.field];
    if (col.type === "date") {
      va = parseSortDate(va);
      vb = parseSortDate(vb);
    } else {
      va = va == null ? -Infinity : va;
      vb = vb == null ? -Infinity : vb;
    }
    if (va < vb) return ascending ? -1 : 1;
    if (va > vb) return ascending ? 1 : -1;
    return 0;
  });
  return sorted;
}

function initSorting() {
  var headers = document.querySelectorAll("#main-table-head th");
  headers.forEach(function(th, idx) {
    if (SORTABLE_COLS[idx]) {
      th.classList.add("sortable");
      th.addEventListener("click", function() {
        if (SORT_COL === idx) {
          SORT_ASC = !SORT_ASC;
        } else {
          SORT_COL = idx;
          SORT_ASC = true;
        }
        // Update header indicators
        headers.forEach(function(h) {
          h.classList.remove("sort-asc", "sort-desc");
        });
        th.classList.add(SORT_ASC ? "sort-asc" : "sort-desc");
        // Sort and re-render
        var sorted = sortData(ED, SORT_COL, SORT_ASC);
        renderMainTable(sorted, AVGS);
      });
    }
  });
}

// ─── DATA LOADING ───
async function loadData() {
  var overlay = document.getElementById("loading-overlay");
  var errorEl = document.getElementById("loading-error");

  try {
    var url = getDataUrl() + "?t=" + Date.now();
    var response = await fetch(url);

    if (!response.ok) {
      throw new Error("HTTP " + response.status + ": Could not load dashboard data. Check that the data repo is public and the URL is correct.");
    }

    var data = await response.json();

    ED = data.emergencies || [];
    AVGS = data.averages || {};
    var eoCounts = data.eoCounts || {};
    var lastUpdated = data.lastUpdated || "\u2014";

    renderUpdatedTime(lastUpdated);
    renderSpeedCards(AVGS);
    renderEoChips(eoCounts);
    renderMainTable(ED, AVGS);
    renderSapTable(ED);
    initTabs();
    initSorting();

    overlay.classList.add("hidden");
    setTimeout(function() { overlay.style.display = "none"; }, 500);

  } catch (err) {
    console.error("Dashboard load error:", err);
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
    document.querySelector(".loading-spinner").style.display = "none";
    document.querySelector(".loading-text").textContent = "Failed to load data";
  }
}

// ─── RENDERERS ───
function renderUpdatedTime(iso) {
  var display = "\u2014";
  try {
    var d = new Date(iso);
    display = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch (_) { /* keep default */ }
  document.getElementById("nav-updated").textContent = "Last Updated: " + display;
}

function renderSpeedCards(avgs) {
  document.getElementById("avg-decision").textContent = avgs.decision != null ? avgs.decision : "\u2014";
  document.getElementById("avg-msna").textContent = avgs.msna != null ? avgs.msna : "\u2014";
  document.getElementById("avg-plansub").textContent = avgs.planSub != null ? avgs.planSub : "\u2014";
  document.getElementById("avg-planapproval").textContent = avgs.planApproval != null ? avgs.planApproval : "\u2014";
  document.getElementById("avg-client").textContent = avgs.client != null ? avgs.client : "\u2014";
}

function renderEoChips(eoCounts) {
  var container = document.getElementById("eo-grid");
  var sorted = Object.entries(eoCounts).sort(function(a, b) { return b[1] - a[1]; });
  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">No emergency intervention data available yet.</div>';
    return;
  }
  container.innerHTML = sorted.map(function(pair) {
    return '<div class="eo-chip"><span>' + pair[0] + '</span><span class="count">' + pair[1] + "</span></div>";
  }).join("");
}

function renderMainTable(emergencies, avgs) {
  document.getElementById("main-table").innerHTML = emergencies.map(function(e) {
    var sc = e.stance === "Red" ? "background:var(--red);color:#fff"
           : e.stance === "Orange" ? "background:var(--orange);color:#fff" : "";

    // Conditional formatting: red text if value exceeds the average
    function cf(n, avg) {
      if (n == null) return "";
      var s = n > avg ? "color:var(--red);font-weight:600" : "";
      return '<span style="' + s + '">' + n + "</span>";
    }

    // Special conditional formatting for days to first client: red if > 30
    function cfClient(n) {
      if (n == null) return "";
      var s = n > 30 ? "color:var(--red);font-weight:600" : "";
      return '<span style="' + s + '">' + n + "</span>";
    }

    return '<tr onclick="openDetail(\'' + e.id + '\')">'
      + '<td style="' + sc + ';font-weight:700;white-space:nowrap">' + e.id + "</td>"
      + '<td class="text-mono" style="white-space:nowrap">' + e.dateClassified + "</td>"
      + '<td style="max-width:260px;font-size:12px;line-height:1.4">' + e.details + "</td>"
      + '<td class="text-right text-mono">' + fmt(e.affected) + "</td>"
      + '<td class="text-right text-mono">' + (e.reached != null ? e.reached.toFixed(2) + "%" : "") + "</td>"
      + '<td class="text-right text-mono">' + fmtM(e.budget) + "</td>"
      + '<td class="text-right text-mono">' + fmtM(e.gap) + "</td>"
      + '<td class="text-right text-mono">' + cf(e.daysDecision, avgs.decision) + "</td>"
      + '<td class="text-right text-mono">' + cf(e.daysMSNA, avgs.msna) + "</td>"
      + '<td class="text-right text-mono">' + cf(e.daysPlanSub, avgs.planSub) + "</td>"
      + '<td class="text-right text-mono">' + cf(e.daysPlanApproval, avgs.planApproval) + "</td>"
      + '<td class="text-right text-mono">' + cfClient(e.daysClient) + "</td>"
      + "</tr>";
  }).join("");
}

function renderSapTable(emergencies) {
  document.getElementById("sap-table").innerHTML = emergencies.map(function(e) {
    return "<tr>"
      + "<td><strong>" + e.id + "</strong> \u2014 " + e.country + "</td>"
      + "<td>" + stanceBadge(e.stance) + "</td>"
      + "<td>" + statusBadge(e.sap.plan) + "</td>"
      + "<td>" + statusBadge(e.sap.learning) + "</td>"
      + "<td>" + statusBadge(e.sap.feedback) + "</td>"
      + "<td>" + statusBadge(e.sap.feedbackTime) + "</td>"
      + "<td>" + statusBadge(e.sap.safeguarding) + "</td>"
      + "<td>" + statusBadge(e.sap.partners) + "</td>"
      + "</tr>";
  }).join("");
}

// ─── TABS ───
function initTabs() {
  document.querySelectorAll(".tab").forEach(function(t) {
    t.addEventListener("click", function() {
      document.querySelectorAll(".tab").forEach(function(x) { x.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function(x) { x.classList.remove("active"); });
      t.classList.add("active");
      document.getElementById("tab-" + t.dataset.tab).classList.add("active");
    });
  });
}

// ─── DETAIL PANEL ───
function openDetail(id) {
  var e = ED.find(function(x) { return x.id === id; });
  if (!e) return;

  document.getElementById("detail-title").textContent = e.id + " \u2014 " + e.country;
  document.getElementById("detail-subtitle").innerHTML =
    stanceBadge(e.stance) + " &nbsp; " + e.type + " &nbsp;&middot;&nbsp; Classified " + e.dateClassified;

  var t10 = e.affected ? e.affected * 0.1 : null;
  var p10 = (t10 && e.totalReach) ? ((e.totalReach / t10) * 100).toFixed(1) : null;

  var h = '<p style="margin-bottom:1.5rem;color:var(--g700);font-size:14px;line-height:1.6">' + e.details + "</p>";

  // Summary cards
  h += '<div class="detail-grid">'
    + '<div class="detail-card"><h4>Number Affected</h4><div class="val">' + fmt(e.affected) + "</div></div>"
    + '<div class="detail-card"><h4>Response Budget</h4><div class="val">' + fmtM(e.budget) + "</div></div>"
    + '<div class="detail-card"><h4>Funding Secured</h4><div class="val">' + fmtM(e.fundingSecured) + "</div>"
    + (e.pctFunded != null ? '<div style="font-size:12px;color:var(--g500);margin-top:4px">' + e.pctFunded.toFixed(1) + "% funded</div>" : "")
    + "</div>"
    + '<div class="detail-card"><h4>Gap in Funding</h4><div class="val" style="color:var(--red)">' + fmtM(e.gap) + "</div></div>"
    + "</div>";

  // 10% reach progress
  h += '<div class="detail-card full" style="margin-bottom:1.5rem"><h4>Progress Towards 10% Reach</h4>'
    + '<div style="display:flex;align-items:baseline;gap:12px;margin-top:6px">'
    + '<span class="val">' + fmt(e.totalReach) + "</span>"
    + '<span style="font-size:13px;color:var(--g500)">of ' + fmt(t10) + " (10% of " + fmt(e.affected) + ")</span></div>"
    + '<div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:'
    + Math.min(p10 || 0, 100) + "%;background:" + ((p10 || 0) >= 100 ? "var(--green)" : "var(--yellow)") + '"></div></div>'
    + '<div style="font-size:12px;color:var(--g500);margin-top:4px">'
    + (e.reached != null ? e.reached.toFixed(2) : "0") + "% of affected | " + (p10 != null ? p10 + "%" : "\u2014") + " of 10% target</div></div>";

  // Milestones timeline
  h += '<div style="margin-bottom:2rem"><h3 style="font-size:15px;font-weight:600;margin-bottom:1rem">Key Response Milestones</h3><div class="timeline">';
  [
    { l: "First Orange/Red Classification", d: e.dateClassified, dy: 0 },
    { l: "MSNA Completion", d: e.dateMSNA, dy: e.daysMSNA },
    { l: "Decision to Respond", d: e.dateDecision, dy: e.daysDecision },
    { l: "Response Plan Submission", d: e.datePlanSub, dy: e.daysPlanSub },
    { l: "Response Plan Approval (ERMT)", d: e.datePlanApproval, dy: e.daysPlanApproval },
    { l: "First Client Served", d: e.dateFirstClient, dy: e.daysClient }
  ].forEach(function(m) {
    h += '<div class="timeline-item ' + (m.d ? "done" : "") + '">'
      + '<div class="tl-label">' + m.l + (m.dy != null ? ' <span class="tl-days">' + m.dy + " days</span>" : "") + "</div>"
      + '<div class="tl-date">' + (m.d || "Pending") + "</div></div>";
  });
  h += "</div></div>";

  // SAP criteria
  h += '<div style="margin-bottom:2rem"><h3 style="font-size:15px;font-weight:600;margin-bottom:1rem">SAP Reporting Criteria</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  [
    { l: "Response Plan Justification", v: e.sap.plan },
    { l: "Learning Exercise", v: e.sap.learning },
    { l: "Feedback Mechanism", v: e.sap.feedback },
    { l: "Feedback Timeframe", v: e.sap.feedbackTime },
    { l: "Safeguarding 80%", v: e.sap.safeguarding },
    { l: "Partners Learning 50%", v: e.sap.partners }
  ].forEach(function(s) {
    h += '<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--g100);border-radius:6px"><span style="font-size:13px">' + s.l + "</span>" + statusBadge(s.v) + "</div>";
  });
  h += "</div></div>";

  // ===== PROGRAM DATA =====
  h += '<div class="program-section"><h3><span class="dot"></span> Program Data</h3>';

  // Reach by Month
  if (e.rbm && e.rbm.length > 0) {
    var mx = Math.max.apply(null, e.rbm.map(function(r) { return (r.i || 0) + (r.p || 0); }));
    h += '<div class="sub-section"><h4>Emergency Offering Reach by Month</h4>'
      + '<div class="legend-inline"><span><span class="ldot" style="background:var(--black)"></span> IRC</span><span><span class="ldot" style="background:var(--g500)"></span> Partner</span></div>';
    e.rbm.forEach(function(r) {
      var tot = (r.i || 0) + (r.p || 0);
      var iW = mx > 0 ? ((r.i || 0) / mx) * 100 : 0;
      var pW = mx > 0 ? ((r.p || 0) / mx) * 100 : 0;
      h += '<div class="bar-row"><div class="bar-label">' + r.m + '</div><div class="bar-track">';
      if (r.i > 0) h += '<div class="bar-seg-irc" style="width:' + iW + '%"><span>' + (r.i > 500 ? fmt(r.i) : "") + "</span></div>";
      if (r.p > 0) h += '<div class="bar-seg-partner" style="width:' + pW + '%"><span>' + (r.p > 500 ? fmt(r.p) : "") + "</span></div>";
      h += '</div><div class="bar-total">' + (tot / 1000).toFixed(1) + "K</div></div>";
    });
    h += "</div>";
  } else {
    h += '<div class="sub-section"><h4>Emergency Offering Reach by Month</h4><div class="empty-state">No monthly reach data recorded yet.</div></div>';
  }

  // Cumulative Reach by Offering
  if (e.rbo && e.rbo.length > 0) {
    var mx2 = Math.max.apply(null, e.rbo.map(function(r) { return Math.max(r.r || 0, r.t || 0); }));
    var fK = function(n) { return n == null ? "\u2014" : n >= 1000 ? (n / 1000).toFixed(0) + "K" : n.toString(); };
    h += '<div class="sub-section"><h4>Cumulative Reach by Emergency Offering</h4>'
      + '<div class="legend-inline"><span><span class="ldot" style="background:var(--black)"></span> Reach</span><span><span class="ldot" style="background:var(--yellow)"></span> Target</span></div>'
      + '<div style="display:flex;align-items:flex-end;gap:16px;padding:0 8px;overflow-x:auto">';
    e.rbo.forEach(function(r) {
      var rH = mx2 > 0 ? ((r.r || 0) / mx2) * 120 : 2;
      var tH = mx2 > 0 ? ((r.t || 0) / mx2) * 120 : 2;
      h += '<div class="grouped-bar-group"><div class="grouped-bars">'
        + '<div class="gbar reach" style="height:' + Math.max(rH, 2) + 'px"><div class="gbar-val">' + fK(r.r) + "</div></div>"
        + '<div class="gbar target" style="height:' + Math.max(tH, 2) + 'px"><div class="gbar-val">' + fK(r.t) + "</div></div>"
        + '</div><div class="grouped-bar-label">' + r.n + "</div></div>";
    });
    h += "</div></div>";
  } else {
    h += '<div class="sub-section"><h4>Cumulative Reach by Emergency Offering</h4><div class="empty-state">No offering reach data recorded yet.</div></div>';
  }

  // First Service
  if (e.fs && e.fs.length > 0) {
    h += '<div class="sub-section"><h4>Date of First Service by Emergency Offering</h4><table class="dtable"><thead><tr><th>Emergency Intervention Name</th><th>Date of First Service</th></tr></thead><tbody>';
    e.fs.forEach(function(f) {
      h += "<tr><td>" + f.o + '</td><td class="text-mono">' + f.d + "</td></tr>";
    });
    h += "</tbody></table></div>";
  } else {
    h += '<div class="sub-section"><h4>Date of First Service by Emergency Offering</h4><div class="empty-state">No first service data recorded yet.</div></div>';
  }

  // Partner Data
  if (e.pd && e.pd.length > 0) {
    h += '<div class="sub-section"><h4>Partner Data</h4><table class="dtable"><thead><tr><th>Partner</th><th>Offering Implemented</th><th>Existing/New</th><th>First Disbursement</th><th>First Service</th><th>Funding Delivery</th></tr></thead><tbody>';
    e.pd.forEach(function(p) {
      h += "<tr><td>" + p.partner + "</td><td>" + p.offering + "</td><td>" + p.en
        + '</td><td class="text-mono">' + (p.disb || "\u2014")
        + '</td><td class="text-mono">' + (p.fs || "\u2014")
        + '</td><td class="text-mono">' + (p.fd || "\u2014") + "</td></tr>";
    });
    h += "</tbody></table></div>";
  } else {
    h += '<div class="sub-section"><h4>Partner Data</h4><div class="empty-state">No partner data recorded yet.</div></div>';
  }

  // Quality Indicators
  if (e.qi && e.qi.length > 0) {
    h += '<div class="sub-section"><h4>Quality Indicator Performance</h4><table class="dtable"><thead><tr><th>Emergency Offering</th><th class="text-right">Reported Value</th><th class="text-right">Target</th><th>Date Entered</th></tr></thead><tbody>';
    e.qi.forEach(function(i) {
      h += "<tr><td>" + i.o + '</td><td class="text-right text-mono">' + i.v
        + '</td><td class="text-right text-mono">' + i.t
        + '</td><td class="text-mono">' + (i.d || "\u2014") + "</td></tr>";
    });
    h += "</tbody></table></div>";
  } else {
    h += '<div class="sub-section"><h4>Quality Indicator Performance</h4><div class="empty-state">No indicator data reported yet.</div></div>';
  }

  // Offering Review
  if (e.or && e.or.length > 0) {
    h += '<div class="sub-section"><h4>Emergency Offering Review</h4><table class="dtable"><thead><tr><th>Implemented Emergency Offering</th><th>Quality Review</th><th>Date Assessed</th></tr></thead><tbody>';
    e.or.forEach(function(r) {
      h += "<tr><td>" + r.o + "</td><td>" + statusBadge(r.q) + '</td><td class="text-mono">' + (r.d || "\u2014") + "</td></tr>";
    });
    h += "</tbody></table></div>";
  } else {
    h += '<div class="sub-section"><h4>Emergency Offering Review</h4><div class="empty-state">No offering review data recorded yet.</div></div>';
  }

  h += "</div>"; // close program-section

  if (e.link) {
    h += '<div style="margin-top:1.5rem"><a href="' + e.link + '" target="_blank" style="font-size:13px;color:var(--yellow-dark);font-weight:600;text-decoration:none">View Response Plan &rarr;</a></div>';
  }

  document.getElementById("detail-body").innerHTML = h;
  document.getElementById("detail-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  document.getElementById("detail-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

document.getElementById("detail-overlay").addEventListener("click", function(ev) {
  if (ev.target === this) closeDetail();
});

// ─── BOOT ───
loadData();

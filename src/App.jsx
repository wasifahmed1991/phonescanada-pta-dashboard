import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * PhonesCanada PTA Dashboard — App.jsx
 *
 * ✅ Logo: place your file at: /public/phonescanadalogo-web.png
 *    (NOT repo root). Vite only serves/copies from /public in build.
 *
 * This file:
 * - Fixes viewport overflow + aligned form fields (responsive grid)
 * - Clears the Inventory Planning form after "Add Device"
 * - Adds “Profit/Loss (Best)” live indicator in the form
 * - Makes PTA slabs editable + persisted in localStorage
 * - Improves device cards UI + profit/loss badges
 * - Improves PDF export styling (clean, printable report)
 * - Adds faster, smoother background animation + prism/line shapes
 */

const STORAGE_KEY = "pc_pta_dashboard_v3";

const BRANDS = ["Apple", "Samsung", "Google", "Xiaomi", "OnePlus", "Oppo", "Vivo", "Realme", "Huawei", "Other"];

const DEFAULT_SLABS = [
  { id: "0-30", label: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { id: "31-100", label: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { id: "101-200", label: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { id: "201-350", label: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { id: "351-500", label: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { id: "501+", label: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 },
];

function clampNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function formatPKR(n) {
  const x = Math.round(n);
  return `Rs ${x.toLocaleString("en-PK")}`;
}
function formatUSD(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0";
  return `$${x.toFixed(0)}`;
}
function safeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function findSlab(slabs, baseUsd) {
  const v = clampNumber(baseUsd, 0);
  return slabs.find((s) => v >= s.min && v <= s.max) || slabs[slabs.length - 1];
}

function buildReportHTML({ usdRate, gstThreshold, gstLow, gstHigh, devices, slabs, logoUrl }) {
  const now = new Date();
  const dateStr = now.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  const rows = devices
    .map((d, idx) => {
      const baseUsd = d.purchaseUsd + d.shippingUsd;
      const gstRate = baseUsd >= gstThreshold ? gstHigh : gstLow;
      const slab = findSlab(slabs, baseUsd);

      const basePkr = baseUsd * usdRate;
      const gstPkr = basePkr * gstRate;

      const landedCnic = basePkr + gstPkr + slab.cnic;
      const landedPassport = basePkr + gstPkr + slab.passport;

      const profitCnic = d.salePkr - landedCnic;
      const profitPassport = d.salePkr - landedPassport;

      const bestProfit = Math.max(profitCnic, profitPassport);
      const bestChannel = bestProfit === profitCnic ? "CNIC" : "Passport";

      const pillClass = bestProfit >= 0 ? "pill pill--pos" : "pill pill--neg";

      return `
        <div class="card">
          <div class="cardHead">
            <div class="meta">
              <div class="num">${idx + 1}</div>
              <div>
                <div class="title">${escapeHtml(d.brand)} <span class="muted">•</span> ${escapeHtml(d.model)}</div>
                <div class="sub">
                  Slab: ${escapeHtml(slab.label)} USD • GST: ${Math.round(gstRate * 100)}%
                </div>
              </div>
            </div>
            <div class="${pillClass}">${bestProfit >= 0 ? "PROFIT" : "LOSS"} • ${formatPKR(bestProfit)} <span class="muted">(${bestChannel})</span></div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="boxTitle">Inputs</div>
              <div class="kv"><span>Expected Sale</span><b>${formatPKR(d.salePkr)}</b></div>
              <div class="kv"><span>Base (Cost + Ship)</span><b>${formatUSD(d.purchaseUsd)} + ${formatUSD(d.shippingUsd)} = ${formatUSD(baseUsd)}</b></div>
              <div class="kv"><span>USD→PKR</span><b>${usdRate}</b></div>
            </div>

            <div class="box">
              <div class="boxTitle">CNIC</div>
              <div class="kv"><span>Landed</span><b>${formatPKR(landedCnic)}</b></div>
              <div class="kv"><span>Profit</span><b class="${profitCnic >= 0 ? "pos" : "neg"}">${formatPKR(profitCnic)}</b></div>
              <div class="kv"><span>PTA (slab)</span><b>${formatPKR(slab.cnic)}</b></div>
              <div class="kv"><span>GST</span><b>${formatPKR(gstPkr)}</b></div>
            </div>

            <div class="box">
              <div class="boxTitle">Passport</div>
              <div class="kv"><span>Landed</span><b>${formatPKR(landedPassport)}</b></div>
              <div class="kv"><span>Profit</span><b class="${profitPassport >= 0 ? "pos" : "neg"}">${formatPKR(profitPassport)}</b></div>
              <div class="kv"><span>PTA (slab)</span><b>${formatPKR(slab.passport)}</b></div>
              <div class="kv"><span>GST</span><b>${formatPKR(gstPkr)}</b></div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PhonesCanada PTA Dashboard — Report</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  <style>
    :root{
      --bg1:#fff5f6;
      --bg2:#f4f8ff;
      --card:#ffffff;
      --ink:#0f172a;
      --muted:#64748b;
      --line:rgba(15,23,42,.10);
      --shadow: 0 18px 50px rgba(15,23,42,.12);
      --posBg: rgba(16,185,129,.14);
      --posInk: rgb(6,95,70);
      --negBg: rgba(239,68,68,.14);
      --negInk: rgb(127,29,29);
      --accent1:#ff5a6b;
      --accent2:#7c5cff;
    }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: "Saira", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color:var(--ink);
      background: radial-gradient(900px 500px at 10% 10%, rgba(255,90,107,.20), transparent 55%),
                  radial-gradient(900px 500px at 90% 20%, rgba(124,92,255,.18), transparent 55%),
                  radial-gradient(900px 500px at 30% 90%, rgba(56,189,248,.18), transparent 55%),
                  linear-gradient(120deg, var(--bg1), var(--bg2));
      padding: 28px;
    }
    .wrap{ max-width: 980px; margin: 0 auto; }
    .top{
      display:flex; align-items:center; gap:14px;
      padding:16px 18px;
      background: rgba(255,255,255,.85);
      border:1px solid var(--line);
      border-radius: 18px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }
    .logo{
      width:44px; height:44px; border-radius: 14px;
      background: linear-gradient(135deg, rgba(255,90,107,.30), rgba(124,92,255,.25));
      display:flex; align-items:center; justify-content:center;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.9);
      box-shadow: 0 10px 25px rgba(15,23,42,.12);
      flex: 0 0 auto;
    }
    .logo img{ width:100%; height:100%; object-fit:contain; }
    .hTitle{ font-weight:700; font-size: 18px; margin:0; line-height:1.15; }
    .hSub{ margin:2px 0 0; color: var(--muted); font-size: 13px; }
    .metaRow{
      margin-top: 10px;
      display:flex; gap:12px; flex-wrap: wrap; color: var(--muted); font-size: 13px;
    }
    .chip{
      background: rgba(255,255,255,.72);
      border:1px solid var(--line);
      padding: 8px 10px;
      border-radius: 12px;
    }
    .card{
      margin-top: 14px;
      background: rgba(255,255,255,.86);
      border:1px solid var(--line);
      border-radius: 18px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      overflow: hidden;
    }
    .cardHead{
      display:flex; align-items:flex-start; justify-content:space-between; gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
    }
    .meta{ display:flex; align-items:center; gap: 12px; }
    .num{
      width:28px; height:28px; border-radius: 10px;
      background: rgba(15,23,42,.06);
      display:flex; align-items:center; justify-content:center;
      font-weight:700;
      color: rgba(15,23,42,.7);
      flex: 0 0 auto;
    }
    .title{ font-size: 15px; font-weight: 700; }
    .sub{ color: var(--muted); font-size: 12px; margin-top: 2px; }
    .pill{
      font-weight: 800;
      font-size: 12px;
      padding: 8px 10px;
      border-radius: 999px;
      border:1px solid var(--line);
      white-space: nowrap;
    }
    .pill--pos{ background: var(--posBg); color: var(--posInk); border-color: rgba(16,185,129,.28); }
    .pill--neg{ background: var(--negBg); color: var(--negInk); border-color: rgba(239,68,68,.28); }
    .muted{ color: var(--muted); font-weight: 600; }
    .grid{
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      padding: 14px 16px 16px;
    }
    .box{
      background: rgba(255,255,255,.72);
      border:1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
    }
    .boxTitle{
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: rgba(15,23,42,.65);
      font-weight: 800;
      margin-bottom: 8px;
    }
    .kv{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin: 7px 0; }
    .kv span{ color: var(--muted); font-size: 12px; }
    .kv b{ font-size: 13px; }
    .pos{ color: rgb(6,95,70); }
    .neg{ color: rgb(127,29,29); }

    @media (max-width: 860px){
      body{ padding: 18px; }
      .grid{ grid-template-columns: 1fr; }
      .cardHead{ flex-direction: column; align-items: flex-start; }
      .pill{ white-space: normal; }
    }

    @media print{
      body{ background:#fff; padding: 0; }
      .wrap{ max-width: 100%; }
      .top, .card{ box-shadow:none; border: 1px solid #ddd; background:#fff; backdrop-filter:none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="logo">
        ${logoUrl ? `<img src="${logoUrl}" alt="PhonesCanada Logo" />` : `<div style="font-weight:800;color:rgba(15,23,42,.7)">P</div>`}
      </div>
      <div>
        <div class="hTitle">PhonesCanada PTA Dashboard — Report</div>
        <div class="hSub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
        <div class="metaRow">
          <div class="chip"><b>USD→PKR</b>: ${usdRate}</div>
          <div class="chip"><b>GST</b>: ${Math.round(gstLow * 100)}% below / ${Math.round(gstHigh * 100)}% at or above ${gstThreshold}</div>
          <div class="chip"><b>Generated</b>: ${escapeHtml(dateStr)}</div>
          <div class="chip"><b>Devices</b>: ${devices.length}</div>
        </div>
      </div>
    </div>

    ${rows || `<div style="margin-top:14px;padding:18px;border:1px solid rgba(15,23,42,.10);border-radius:16px;background:#fff">No devices to export.</div>`}
  </div>

  <script>
    window.onload = () => {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function App() {
  // --- Persisted settings/state ---
  const [usdRate, setUsdRate] = useState(278);
  const [animationsOn, setAnimationsOn] = useState(true);
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [devices, setDevices] = useState([]);

  // GST rule
  const gstThreshold = 500;
  const gstLow = 0.18;
  const gstHigh = 0.25;

  // --- Inventory Planning form ---
  const emptyDraft = useMemo(
    () => ({
      brand: "",
      model: "",
      purchaseUsd: "",
      shippingUsd: "",
      salePkr: "",
    }),
    []
  );
  const [draft, setDraft] = useState(emptyDraft);

  // Refs
  const mountedRef = useRef(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.usdRate) setUsdRate(parsed.usdRate);
      if (typeof parsed?.animationsOn === "boolean") setAnimationsOn(parsed.animationsOn);
      if (Array.isArray(parsed?.slabs) && parsed.slabs.length) setSlabs(parsed.slabs);
      if (Array.isArray(parsed?.devices)) setDevices(parsed.devices);
    } catch {
      // ignore
    }
  }, []);

  // Save to localStorage (after initial mount)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          usdRate,
          animationsOn,
          slabs,
          devices,
        })
      );
    } catch {
      // ignore
    }
  }, [usdRate, animationsOn, slabs, devices]);

  // --- Derived: live preview profit/loss (best) from draft ---
  const draftPreview = useMemo(() => {
    const purchaseUsd = clampNumber(draft.purchaseUsd, NaN);
    const shippingUsd = clampNumber(draft.shippingUsd, NaN);
    const salePkr = clampNumber(draft.salePkr, NaN);

    if (!Number.isFinite(purchaseUsd) || !Number.isFinite(shippingUsd) || !Number.isFinite(salePkr) || !draft.brand || !draft.model) {
      return null;
    }

    const baseUsd = purchaseUsd + shippingUsd;
    const slab = findSlab(slabs, baseUsd);
    const gstRate = baseUsd >= gstThreshold ? gstHigh : gstLow;

    const basePkr = baseUsd * usdRate;
    const gstPkr = basePkr * gstRate;

    const landedCnic = basePkr + gstPkr + slab.cnic;
    const landedPassport = basePkr + gstPkr + slab.passport;

    const profitCnic = salePkr - landedCnic;
    const profitPassport = salePkr - landedPassport;

    const bestProfit = Math.max(profitCnic, profitPassport);
    const bestChannel = bestProfit === profitCnic ? "CNIC" : "Passport";

    return { bestProfit, bestChannel };
  }, [draft, slabs, usdRate]);

  // --- Handlers ---
  function addDevice() {
    const brand = (draft.brand || "").trim();
    const model = (draft.model || "").trim();

    const purchaseUsd = clampNumber(draft.purchaseUsd, NaN);
    const shippingUsd = clampNumber(draft.shippingUsd, NaN);
    const salePkr = clampNumber(draft.salePkr, NaN);

    if (!brand || !model || !Number.isFinite(purchaseUsd) || !Number.isFinite(shippingUsd) || !Number.isFinite(salePkr)) return;

    const next = {
      id: safeId(),
      brand,
      model,
      purchaseUsd,
      shippingUsd,
      salePkr,
    };

    setDevices((prev) => [next, ...prev]);

    // ✅ Clear the form after adding (your #1 issue)
    setDraft(emptyDraft);
  }

  function removeDevice(id) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  function exportCSV() {
    const header = [
      "Brand",
      "Model",
      "Purchase USD",
      "Shipping USD",
      "Base USD",
      "Sale PKR",
      "Slab",
      "GST %",
      "PTA CNIC",
      "PTA Passport",
      "Landed CNIC",
      "Profit CNIC",
      "Landed Passport",
      "Profit Passport",
      "Best Channel",
      "Best Profit",
    ];

    const lines = devices.map((d) => {
      const baseUsd = d.purchaseUsd + d.shippingUsd;
      const slab = findSlab(slabs, baseUsd);
      const gstRate = baseUsd >= gstThreshold ? gstHigh : gstLow;

      const basePkr = baseUsd * usdRate;
      const gstPkr = basePkr * gstRate;

      const landedCnic = basePkr + gstPkr + slab.cnic;
      const landedPassport = basePkr + gstPkr + slab.passport;

      const profitCnic = d.salePkr - landedCnic;
      const profitPassport = d.salePkr - landedPassport;

      const bestProfit = Math.max(profitCnic, profitPassport);
      const bestChannel = bestProfit === profitCnic ? "CNIC" : "Passport";

      const row = [
        d.brand,
        d.model,
        d.purchaseUsd,
        d.shippingUsd,
        baseUsd,
        d.salePkr,
        slab.label,
        Math.round(gstRate * 100),
        slab.cnic,
        slab.passport,
        Math.round(landedCnic),
        Math.round(profitCnic),
        Math.round(landedPassport),
        Math.round(profitPassport),
        bestChannel,
        Math.round(bestProfit),
      ];

      return row.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `phonescanada-pta-devices-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    // Use BASE_URL so it works on GitHub Pages subpath
    const logoUrl = `${import.meta.env.BASE_URL}phonescanadalogo-web.png`;

    const html = buildReportHTML({
      usdRate,
      gstThreshold,
      gstLow,
      gstHigh,
      devices: [...devices].reverse(), // print in chronological order
      slabs,
      logoUrl,
    });

    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // --- Computation for device cards ---
  const computedDevices = useMemo(() => {
    return devices.map((d) => {
      const baseUsd = d.purchaseUsd + d.shippingUsd;
      const slab = findSlab(slabs, baseUsd);
      const gstRate = baseUsd >= gstThreshold ? gstHigh : gstLow;

      const basePkr = baseUsd * usdRate;
      const gstPkr = basePkr * gstRate;

      const landedCnic = basePkr + gstPkr + slab.cnic;
      const landedPassport = basePkr + gstPkr + slab.passport;

      const profitCnic = d.salePkr - landedCnic;
      const profitPassport = d.salePkr - landedPassport;

      const marginCnic = d.salePkr > 0 ? (profitCnic / d.salePkr) * 100 : 0;
      const marginPassport = d.salePkr > 0 ? (profitPassport / d.salePkr) * 100 : 0;

      const bestProfit = Math.max(profitCnic, profitPassport);
      const bestChannel = bestProfit === profitCnic ? "CNIC" : "Passport";

      return {
        ...d,
        baseUsd,
        slab,
        gstRate,
        landedCnic,
        landedPassport,
        profitCnic,
        profitPassport,
        marginCnic,
        marginPassport,
        bestProfit,
        bestChannel,
      };
    });
  }, [devices, slabs, usdRate]);

  // --- Editable slabs handlers ---
  function updateSlab(id, field, value) {
    const n = clampNumber(value, 0);
    setSlabs((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: n } : s)));
  }

  // Logo path for header (GitHub Pages safe)
  const logoSrc = `${import.meta.env.BASE_URL}phonescanadalogo-web.png`;

  return (
    <div className={`appRoot ${animationsOn ? "animOn" : "animOff"}`}>
      <style>{css}</style>

      {/* Background layer */}
      <div className="bg" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="prism p1" />
        <div className="prism p2" />
        <div className="scan s1" />
        <div className="scan s2" />
      </div>

      <div className="wrap">
        {/* Header */}
        <header className="headerCard">
          <div className="brandMark">
            {/* If logo not found, image will fail; we keep a fallback gradient */}
            <img
              src={logoSrc}
              alt="PhonesCanada"
              onError={(e) => {
                // hide broken image icon, keep the gradient container
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div className="headText">
            <h1>PhonesCanada PTA Dashboard</h1>
            <p>PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
          </div>
        </header>

        <main className="layout">
          {/* Left column */}
          <aside className="leftCol">
            <section className="card">
              <div className="cardTitle">System Preferences</div>

              <label className="field">
                <span className="label">USD Rate (PKR)</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={usdRate}
                  onChange={(e) => setUsdRate(clampNumber(e.target.value, 0))}
                />
              </label>

              <div className="toggleRow">
                <div>
                  <div className="toggleTitle">Animations</div>
                  <div className="toggleSub">Smooth background blobs + prism lines</div>
                </div>

                <button
                  type="button"
                  className={`toggle ${animationsOn ? "on" : "off"}`}
                  onClick={() => setAnimationsOn((v) => !v)}
                  aria-pressed={animationsOn}
                >
                  <span className="knob" />
                </button>
              </div>

              <div className="hint">
                💡 GST auto-switches at <b>${gstThreshold}</b>: {Math.round(gstLow * 100)}% below / {Math.round(gstHigh * 100)}% at or above.
              </div>
            </section>

            <section className="card">
              <div className="cardTitle">PTA Tax Slabs (Editable)</div>
              <div className="table">
                <div className="tHead">
                  <div>Value Range (USD)</div>
                  <div>CNIC</div>
                  <div>Passport</div>
                </div>

                {slabs.map((s) => (
                  <div className="tRow" key={s.id}>
                    <div className="range">{s.label}</div>
                    <input className="cellInput" value={s.cnic} onChange={(e) => updateSlab(s.id, "cnic", e.target.value)} />
                    <input className="cellInput" value={s.passport} onChange={(e) => updateSlab(s.id, "passport", e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="tinyMuted">Saved automatically on this device (localStorage).</div>
            </section>
          </aside>

          {/* Right column */}
          <section className="rightCol">
            {/* Inventory Planning */}
            <section className="card">
              <div className="rowTop">
                <div>
                  <div className="cardTitle">Inventory Planning</div>
                  <div className="tinyMuted">Add a device and instantly compare CNIC vs Passport.</div>
                </div>

                <button type="button" className="btnPrimary" onClick={addDevice}>
                  <span className="plus">＋</span> Add Device
                </button>
              </div>

              {/* ✅ Fixed: aligned fields, responsive grid, no overflow */}
              <div className="formGrid">
                <label className="field">
                  <span className="label">Brand</span>
                  <select
                    className="input"
                    value={draft.brand}
                    onChange={(e) => setDraft((p) => ({ ...p, brand: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field grow2">
                  <span className="label">Device / Model Name</span>
                  <input
                    className="input"
                    placeholder="e.g. iPhone 15 Pro Max"
                    value={draft.model}
                    onChange={(e) => setDraft((p) => ({ ...p, model: e.target.value }))}
                  />
                </label>

                <label className="field">
                  <span className="label">Purchase Cost (USD)</span>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 1199"
                    value={draft.purchaseUsd}
                    onChange={(e) => setDraft((p) => ({ ...p, purchaseUsd: e.target.value }))}
                  />
                </label>

                <label className="field">
                  <span className="label">Shipping (USD)</span>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 30"
                    value={draft.shippingUsd}
                    onChange={(e) => setDraft((p) => ({ ...p, shippingUsd: e.target.value }))}
                  />
                </label>

                <label className="field grow2">
                  <span className="label">Expected Selling Price (PKR)</span>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 525000"
                    value={draft.salePkr}
                    onChange={(e) => setDraft((p) => ({ ...p, salePkr: e.target.value }))}
                  />
                </label>

                {/* ✅ New: Profit/Loss (Best) live indicator */}
                <div className="field indicator">
                  <span className="label">Profit / Loss (Best)</span>
                  <div className={`indicatorPill ${draftPreview ? (draftPreview.bestProfit >= 0 ? "pos" : "neg") : ""}`}>
                    {draftPreview ? (
                      <>
                        <span className="indicatorK">{draftPreview.bestProfit >= 0 ? "Profit" : "Loss"}</span>
                        <span className="indicatorV">{formatPKR(Math.abs(draftPreview.bestProfit))}</span>
                        <span className="indicatorC">({draftPreview.bestChannel})</span>
                      </>
                    ) : (
                      <span className="indicatorV">—</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Devices */}
            <section className="card">
              <div className="devicesTop">
                <h2>Devices</h2>
                <div className="tinyMuted">{computedDevices.length} device(s)</div>
              </div>

              {computedDevices.length === 0 ? (
                <div className="empty">
                  <div className="emptyTitle">No devices yet</div>
                  <div className="tinyMuted">Fill the form above and click “Add Device”.</div>
                </div>
              ) : (
                <div className="deviceGrid">
                  {computedDevices.map((d) => {
                    const pillClass = d.bestProfit >= 0 ? "pos" : "neg";
                    return (
                      <article className="deviceCard" key={d.id}>
                        <div className="deviceHead">
                          <div>
                            <div className="brandCaps">{d.brand}</div>
                            <div className="model">{d.model}</div>

                            <div className="chips">
                              <span className="chipX">Slab: {d.slab.label} USD</span>
                              <span className="chipX">GST: {Math.round(d.gstRate * 100)}%</span>
                            </div>
                          </div>

                          <button className="iconBtn" title="Remove device" onClick={() => removeDevice(d.id)}>
                            🗑️
                          </button>
                        </div>

                        {/* Improved CNIC/Passport blocks */}
                        <div className="miniGrid">
                          <div className="miniCard">
                            <div className="miniTitle">CNIC</div>
                            <div className={`profitPill ${d.profitCnic >= 0 ? "pos" : "neg"}`}>
                              {d.profitCnic >= 0 ? "PROFIT" : "LOSS"} • {formatPKR(Math.abs(d.profitCnic))}
                            </div>
                            <div className="kvRow">
                              <span>Landed</span>
                              <b>{formatPKR(d.landedCnic)}</b>
                            </div>
                            <div className="kvRow">
                              <span>Margin</span>
                              <b>{d.marginCnic.toFixed(1)}%</b>
                            </div>
                          </div>

                          <div className="miniCard">
                            <div className="miniTitle">Passport</div>
                            <div className={`profitPill ${d.profitPassport >= 0 ? "pos" : "neg"}`}>
                              {d.profitPassport >= 0 ? "PROFIT" : "LOSS"} • {formatPKR(Math.abs(d.profitPassport))}
                            </div>
                            <div className="kvRow">
                              <span>Landed</span>
                              <b>{formatPKR(d.landedPassport)}</b>
                            </div>
                            <div className="kvRow">
                              <span>Margin</span>
                              <b>{d.marginPassport.toFixed(1)}%</b>
                            </div>
                          </div>
                        </div>

                        <div className="deviceFoot">
                          <div className="footLine">
                            <span>Sale</span>
                            <b>{formatPKR(d.salePkr)}</b>
                          </div>
                          <div className="footLine">
                            <span>Cost+Ship</span>
                            <b>
                              {formatUSD(d.purchaseUsd)} + {formatUSD(d.shippingUsd)} • USD→PKR: {usdRate}
                            </b>
                          </div>

                          <div className={`bestBadge ${pillClass}`}>
                            Best: {d.bestChannel} • {d.bestProfit >= 0 ? "Profit" : "Loss"} {formatPKR(Math.abs(d.bestProfit))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Export section (kept separate) */}
              <div className="exportBar">
                <div className="exportText">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="exportBtns">
                  <button className="btnGhost" onClick={exportCSV}>
                    ⬇ CSV
                  </button>
                  <button className="btnGhost" onClick={exportPDF}>
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

const css = `
/* Font: Saira */
@import url('https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600;700&display=swap');

:root{
  --ink:#0b1220;
  --muted:#64748b;
  --card: rgba(255,255,255,.78);
  --card2: rgba(255,255,255,.68);
  --line: rgba(15,23,42,.10);
  --shadow: 0 18px 50px rgba(15,23,42,.12);
  --shadow2: 0 10px 30px rgba(15,23,42,.10);

  --posBg: rgba(16,185,129,.16);
  --posBd: rgba(16,185,129,.28);
  --posInk: rgb(6,95,70);

  --negBg: rgba(239,68,68,.16);
  --negBd: rgba(239,68,68,.28);
  --negInk: rgb(127,29,29);

  --accent1:#ff5a6b;
  --accent2:#7c5cff;
  --accent3:#22c55e;
  --accent4:#38bdf8;
}

*{ box-sizing:border-box; }
html, body{ height:100%; }
body{
  margin:0;
  font-family: "Saira", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: var(--ink);
}

.appRoot{
  min-height: 100vh;
  position: relative;
  overflow-x: hidden; /* ✅ prevent sideways overflow */
}

.wrap{
  position: relative;
  z-index: 2;
  max-width: 1200px;
  margin: 0 auto;
  padding: 22px 18px 40px;
}

/* Background */
.bg{
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(900px 500px at 10% 10%, rgba(255,90,107,.24), transparent 55%),
    radial-gradient(900px 500px at 90% 20%, rgba(124,92,255,.22), transparent 55%),
    radial-gradient(900px 500px at 30% 90%, rgba(56,189,248,.20), transparent 55%),
    linear-gradient(120deg, #fff3f5, #f5f8ff);
}

/* Blobs (faster, smoother) */
.blob{
  position:absolute;
  width: 520px;
  height: 520px;
  border-radius: 999px;
  filter: blur(26px);
  opacity: .75;
  transform: translate3d(0,0,0);
}
.b1{ left:-120px; top:-140px; background: radial-gradient(circle at 30% 30%, rgba(255,90,107,.60), rgba(255,90,107,.12)); }
.b2{ right:-160px; top:40px; background: radial-gradient(circle at 30% 30%, rgba(124,92,255,.55), rgba(124,92,255,.12)); }
.b3{ left: 20%; bottom:-220px; background: radial-gradient(circle at 30% 30%, rgba(56,189,248,.55), rgba(56,189,248,.10)); }

.animOn .b1{ animation: drift1 5.5s ease-in-out infinite alternate; }
.animOn .b2{ animation: drift2 6.2s ease-in-out infinite alternate; }
.animOn .b3{ animation: drift3 6.8s ease-in-out infinite alternate; }

@keyframes drift1{
  0%{ transform: translate(-10px, 0px) scale(1); }
  100%{ transform: translate(30px, 40px) scale(1.08); }
}
@keyframes drift2{
  0%{ transform: translate(0px, 0px) scale(1); }
  100%{ transform: translate(-50px, 30px) scale(1.10); }
}
@keyframes drift3{
  0%{ transform: translate(0px, 0px) scale(1); }
  100%{ transform: translate(40px, -30px) scale(1.06); }
}

/* Prism shapes + scan lines */
.prism{
  position:absolute;
  width: 560px;
  height: 160px;
  border-radius: 28px;
  transform: rotate(-12deg);
  opacity: .42;
  filter: blur(0px);
  background: linear-gradient(90deg, rgba(255,90,107,.0), rgba(255,90,107,.18), rgba(124,92,255,.18), rgba(56,189,248,.18), rgba(34,197,94,.16), rgba(255,90,107,.0));
  border: 1px solid rgba(255,255,255,.55);
  box-shadow: 0 18px 60px rgba(15,23,42,.08);
}
.p1{ left: -120px; top: 46%; }
.p2{ right: -140px; top: 62%; transform: rotate(10deg); }

.scan{
  position:absolute;
  width: 900px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.0), rgba(255,255,255,.55), transparent);
  opacity: .45;
  filter: blur(.2px);
}
.s1{ left:-200px; top: 22%; }
.s2{ left:-260px; top: 74%; }

.animOn .p1{ animation: prismMove 3.8s ease-in-out infinite alternate; }
.animOn .p2{ animation: prismMove2 4.1s ease-in-out infinite alternate; }
.animOn .s1{ animation: scan 2.8s linear infinite; }
.animOn .s2{ animation: scan2 3.2s linear infinite; }

@keyframes prismMove{
  0%{ transform: translateX(0) rotate(-12deg); opacity:.38; }
  100%{ transform: translateX(70px) rotate(-8deg); opacity:.52; }
}
@keyframes prismMove2{
  0%{ transform: translateX(0) rotate(10deg); opacity:.30; }
  100%{ transform: translateX(-80px) rotate(6deg); opacity:.50; }
}
@keyframes scan{
  0%{ transform: translateX(-120px); opacity:.25; }
  40%{ opacity:.55; }
  100%{ transform: translateX(260px); opacity:.25; }
}
@keyframes scan2{
  0%{ transform: translateX(220px); opacity:.20; }
  40%{ opacity:.52; }
  100%{ transform: translateX(-220px); opacity:.20; }
}

.animOff .blob, .animOff .prism, .animOff .scan{ animation: none !important; }

/* Header */
.headerCard{
  display:flex;
  align-items:center;
  gap: 14px;
  padding: 18px 18px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
}

.brandMark{
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,90,107,.28), rgba(124,92,255,.20));
  border: 1px solid rgba(255,255,255,.85);
  box-shadow: var(--shadow2);
  overflow: hidden;
  display:flex;
  align-items:center;
  justify-content:center;
  flex: 0 0 auto;
}
.brandMark img{
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.headText h1{
  margin:0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: .2px;
}
.headText p{
  margin: 2px 0 0;
  color: var(--muted);
  font-weight: 400;
}

/* Layout */
.layout{
  margin-top: 16px;
  display:grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
}

.leftCol, .rightCol{
  min-width: 0; /* ✅ prevent overflow */
}

.card{
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
  padding: 16px;
}

.card + .card{ margin-top: 16px; }

.cardTitle{
  font-size: 13px;
  letter-spacing: .12em;
  text-transform: uppercase;
  font-weight: 800;
  color: rgba(15,23,42,.70);
  margin-bottom: 12px;
}

.field{
  display:flex;
  flex-direction: column;
  gap: 7px;
}
.label{
  color: rgba(15,23,42,.68);
  font-size: 12px;
  font-weight: 600;
}
.input{
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.14);
  padding: 0 12px;
  outline: none;
  background: rgba(255,255,255,.82);
  font-family: inherit;
  font-size: 14px;
}
.input:focus{
  border-color: rgba(124,92,255,.35);
  box-shadow: 0 0 0 4px rgba(124,92,255,.12);
}

.toggleRow{
  margin-top: 14px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
}
.toggleTitle{ font-weight: 700; }
.toggleSub{ color: var(--muted); font-size: 12px; margin-top:2px; }

.toggle{
  width: 56px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.65);
  position: relative;
  cursor: pointer;
}
.toggle .knob{
  position:absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(255,90,107,.95), rgba(124,92,255,.85));
  box-shadow: 0 12px 24px rgba(15,23,42,.16);
  transition: transform .2s ease;
}
.toggle.on .knob{ transform: translateX(24px); }

.hint{
  margin-top: 12px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
}

/* Slabs table */
.table{
  border: 1px solid rgba(15,23,42,.10);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255,255,255,.55);
}
.tHead, .tRow{
  display:grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 10px;
  align-items:center;
  padding: 10px 12px;
}
.tHead{
  background: rgba(15,23,42,.04);
  color: rgba(15,23,42,.65);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.tRow{
  border-top: 1px solid rgba(15,23,42,.08);
}
.range{
  font-weight: 700;
  color: rgba(15,23,42,.75);
}
.cellInput{
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.85);
  padding: 0 10px;
  font-family: inherit;
}
.tinyMuted{
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
}

/* Inventory Planning */
.rowTop{
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.btnPrimary{
  height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.85);
  background: linear-gradient(135deg, rgba(255,90,107,.95), rgba(255,90,107,.78));
  color: white;
  font-family: inherit;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 16px 40px rgba(255,90,107,.22);
  flex: 0 0 auto;
}
.btnPrimary .plus{ font-size: 16px; margin-right: 6px; }

.formGrid{
  display:grid;
  grid-template-columns: 1fr 1.4fr 1fr 1fr 1.4fr .9fr;
  gap: 12px;
  align-items:end;
  min-width: 0;
}
.field.grow2{ grid-column: span 2; }

.field.indicator{
  min-width: 0;
}
.indicatorPill{
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.70);
  display:flex;
  align-items:center;
  justify-content:center;
  gap: 8px;
  padding: 0 10px;
  font-weight: 800;
}
.indicatorPill.pos{ background: var(--posBg); color: var(--posInk); border-color: var(--posBd); }
.indicatorPill.neg{ background: var(--negBg); color: var(--negInk); border-color: var(--negBd); }
.indicatorK{ opacity: .85; }
.indicatorV{ font-weight: 900; }
.indicatorC{ color: rgba(15,23,42,.60); font-weight: 800; }

/* Devices section */
.devicesTop{
  display:flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.devicesTop h2{
  margin:0;
  font-size: 22px;
  font-weight: 800;
}

.empty{
  border: 1px dashed rgba(15,23,42,.20);
  border-radius: 18px;
  padding: 18px;
  background: rgba(255,255,255,.55);
}
.emptyTitle{
  font-weight: 900;
  margin-bottom: 4px;
}

.deviceGrid{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  min-width: 0;
}

.deviceCard{
  border: 1px solid rgba(15,23,42,.10);
  border-radius: 20px;
  background: rgba(255,255,255,.82);
  box-shadow: var(--shadow2);
  overflow: hidden;
}
.deviceHead{
  padding: 14px 14px 10px;
  display:flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(15,23,42,.08);
}
.brandCaps{
  letter-spacing: .22em;
  font-weight: 900;
  color: rgba(15,23,42,.45);
  font-size: 12px;
}
.model{
  font-size: 18px;
  font-weight: 800;
  margin-top: 2px;
}
.chips{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.chipX{
  font-size: 12px;
  font-weight: 700;
  color: rgba(15,23,42,.70);
  background: rgba(15,23,42,.05);
  border: 1px solid rgba(15,23,42,.08);
  padding: 6px 10px;
  border-radius: 999px;
}

.iconBtn{
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.75);
  cursor: pointer;
}

.miniGrid{
  padding: 12px 14px 6px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.miniCard{
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.65);
  border-radius: 18px;
  padding: 12px;
  min-width: 0;
}
.miniTitle{
  font-weight: 900;
  letter-spacing: .16em;
  color: rgba(15,23,42,.62);
  text-transform: uppercase;
  font-size: 12px;
}
.profitPill{
  margin-top: 8px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.12);
  font-weight: 900;
  font-size: 12px;
}
.profitPill.pos{ background: var(--posBg); color: var(--posInk); border-color: var(--posBd); }
.profitPill.neg{ background: var(--negBg); color: var(--negInk); border-color: var(--negBd); }

.kvRow{
  margin-top: 10px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
  color: rgba(15,23,42,.72);
}
.kvRow span{ color: var(--muted); font-weight: 600; }
.kvRow b{ font-weight: 900; color: rgba(15,23,42,.88); }

.deviceFoot{
  padding: 10px 14px 14px;
  border-top: 1px solid rgba(15,23,42,.08);
}
.footLine{
  display:flex;
  justify-content: space-between;
  gap: 10px;
  color: rgba(15,23,42,.74);
  font-size: 13px;
  margin-top: 6px;
}
.footLine span{ color: var(--muted); font-weight: 600; }
.footLine b{ font-weight: 800; }

.bestBadge{
  margin-top: 10px;
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.12);
  font-weight: 900;
  font-size: 12px;
}
.bestBadge.pos{ background: var(--posBg); color: var(--posInk); border-color: var(--posBd); }
.bestBadge.neg{ background: var(--negBg); color: var(--negInk); border-color: var(--negBd); }

/* Export bar */
.exportBar{
  margin-top: 14px;
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.70);
}
.exportText{ color: rgba(15,23,42,.70); font-weight: 600; }
.exportBtns{ display:flex; gap: 10px; }
.btnGhost{
  height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.82);
  cursor: pointer;
  font-family: inherit;
  font-weight: 900;
  box-shadow: 0 12px 24px rgba(15,23,42,.08);
}

/* Responsive */
@media (max-width: 1100px){
  .layout{ grid-template-columns: 1fr; }
  .formGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .field.grow2{ grid-column: span 2; }
}

@media (max-width: 760px){
  .wrap{ padding: 18px 14px 34px; }
  .deviceGrid{ grid-template-columns: 1fr; }
  .miniGrid{ grid-template-columns: 1fr; }
  .rowTop{ flex-direction: column; align-items:flex-start; }
  .btnPrimary{ width: 100%; justify-content:center; }
  .exportBar{ flex-direction: column; align-items: stretch; }
  .exportBtns{ width: 100%; }
  .btnGhost{ width: 100%; }
}
`;

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * PhonesCanada PTA Dashboard (Vite + React, single-file App.jsx)
 * Fixes included:
 * - Uses Saira font (Google Fonts)
 * - Logo loads from public using Vite base path: /public/phonescanadalogo-web.png
 * - Inventory Planning clears after Add Device
 * - Planning shows Profit/Loss (Best) properly aligned (no “Best: ...” in device cards)
 * - Device cards: big numbers no longer cut (responsive typography + wrapping)
 * - PTA slab table: range column not squished; CNIC/Passport inputs equal width
 * - PDF export: opens a clean Print view (user can “Save as PDF”)
 * - Background: soft animated blobs + floating prism/paragon-like outlines + animated grid lines
 * - Better shadows on boxes
 */

const LS_KEYS = {
  settings: "pc_pta_settings_v5",
  slabs: "pc_pta_slabs_v5",
  devices: "pc_pta_devices_v5",
};

const DEFAULT_SLABS = [
  { id: "0-30", label: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { id: "31-100", label: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { id: "101-200", label: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { id: "201-350", label: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { id: "351-500", label: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { id: "501+", label: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 },
];

const BRAND_OPTIONS = ["Apple", "Samsung", "Google", "Xiaomi", "OnePlus", "Realme", "Oppo", "Vivo", "Huawei", "Motorola", "Other"];

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function fmtUSD(n) {
  const x = clampNum(n, 0);
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtPKR(n) {
  const x = clampNum(n, 0);
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  return `${sign}Rs ${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPct(n) {
  const x = clampNum(n, 0);
  return `${x.toFixed(1)}%`;
}

function getSlab(slabs, baseUsd) {
  const x = clampNum(baseUsd, 0);
  return slabs.find((s) => x >= s.min && x <= s.max) || slabs[slabs.length - 1];
}

function profitTone(profit) {
  const p = clampNum(profit, 0);
  if (p > 0) return "profit";
  if (p < 0) return "loss";
  return "neutral";
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/** A lightweight tooltip (no libs) */
function Tip({ text }) {
  return (
    <span className="pc-tip" aria-label={text} title={text}>
      i
    </span>
  );
}

export default function App() {
  // ---- Inject Saira font once
  useEffect(() => {
    const id = "pc-saira-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  const [settings, setSettings] = useState(() => {
    const saved = safeParse(localStorage.getItem(LS_KEYS.settings), null);
    return (
      saved || {
        usdToPkr: 278,
        animations: true,
        gstThresholdUsd: 500,
        gstLow: 0.18,
        gstHigh: 0.25,
      }
    );
  });

  const [slabs, setSlabs] = useState(() => {
    const saved = safeParse(localStorage.getItem(LS_KEYS.slabs), null);
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_SLABS;
  });

  const [devices, setDevices] = useState(() => {
    const saved = safeParse(localStorage.getItem(LS_KEYS.devices), null);
    return Array.isArray(saved) ? saved : [];
  });

  // Inventory planning form state (clears after add)
  const [form, setForm] = useState({
    brand: "",
    model: "",
    costUsd: "",
    shippingUsd: "",
    expectedSalePkr: "",
  });

  // Save to localStorage (debounced-ish)
  useEffect(() => localStorage.setItem(LS_KEYS.settings, JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem(LS_KEYS.slabs, JSON.stringify(slabs)), [slabs]);
  useEffect(() => localStorage.setItem(LS_KEYS.devices, JSON.stringify(devices)), [devices]);

  // Compute planning preview
  const planning = useMemo(() => {
    const costUsd = clampNum(form.costUsd, 0);
    const shippingUsd = clampNum(form.shippingUsd, 0);
    const expectedSalePkr = clampNum(form.expectedSalePkr, 0);

    const baseUsd = costUsd + shippingUsd;
    const slab = getSlab(slabs, baseUsd);
    const gstRate = baseUsd >= settings.gstThresholdUsd ? settings.gstHigh : settings.gstLow;

    const basePkr = baseUsd * clampNum(settings.usdToPkr, 0);
    const gstPkr = basePkr * gstRate;

    const totalTaxCnic = gstPkr + clampNum(slab.cnic, 0);
    const totalTaxPassport = gstPkr + clampNum(slab.passport, 0);

    const landedCnic = basePkr + totalTaxCnic;
    const landedPassport = basePkr + totalTaxPassport;

    const profitCnic = expectedSalePkr - landedCnic;
    const profitPassport = expectedSalePkr - landedPassport;

    const marginCnic = expectedSalePkr > 0 ? (profitCnic / expectedSalePkr) * 100 : 0;
    const marginPassport = expectedSalePkr > 0 ? (profitPassport / expectedSalePkr) * 100 : 0;

    const bestProfit = Math.max(profitCnic, profitPassport);
    return {
      baseUsd,
      slab,
      gstRate,
      basePkr,
      gstPkr,
      landedCnic,
      landedPassport,
      profitCnic,
      profitPassport,
      marginCnic,
      marginPassport,
      bestProfit,
    };
  }, [form, slabs, settings]);

  // Add device
  function addDevice() {
    const brand = (form.brand || "").trim();
    const model = (form.model || "").trim();
    const costUsd = clampNum(form.costUsd, 0);
    const shippingUsd = clampNum(form.shippingUsd, 0);
    const expectedSalePkr = clampNum(form.expectedSalePkr, 0);

    if (!brand || !model || costUsd <= 0 || expectedSalePkr <= 0) return;

    const baseUsd = costUsd + shippingUsd;
    const slab = getSlab(slabs, baseUsd);
    const gstRate = baseUsd >= settings.gstThresholdUsd ? settings.gstHigh : settings.gstLow;

    const basePkr = baseUsd * clampNum(settings.usdToPkr, 0);
    const gstPkr = basePkr * gstRate;

    const landedCnic = basePkr + (gstPkr + clampNum(slab.cnic, 0));
    const landedPassport = basePkr + (gstPkr + clampNum(slab.passport, 0));

    const profitCnic = expectedSalePkr - landedCnic;
    const profitPassport = expectedSalePkr - landedPassport;

    const marginCnic = expectedSalePkr > 0 ? (profitCnic / expectedSalePkr) * 100 : 0;
    const marginPassport = expectedSalePkr > 0 ? (profitPassport / expectedSalePkr) * 100 : 0;

    const newDevice = {
      id: uid(),
      brand,
      model,
      costUsd,
      shippingUsd,
      expectedSalePkr,
      slabId: slab.id,
      slabLabel: slab.label,
      gstRate,
      usdToPkr: clampNum(settings.usdToPkr, 0),

      landedCnic,
      landedPassport,
      profitCnic,
      profitPassport,
      marginCnic,
      marginPassport,
    };

    setDevices((prev) => [newDevice, ...prev]);

    // Clear the form after adding (requested)
    setForm({ brand: "", model: "", costUsd: "", shippingUsd: "", expectedSalePkr: "" });
  }

  function removeDevice(id) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  // CSV export (full list)
  function exportCSV() {
    if (!devices.length) return;

    const headers = [
      "Brand",
      "Model",
      "USD->PKR",
      "Cost USD",
      "Shipping USD",
      "Expected Sale PKR",
      "Slab",
      "GST Rate",
      "Landed (CNIC)",
      "Profit (CNIC)",
      "Margin (CNIC) %",
      "Landed (Passport)",
      "Profit (Passport)",
      "Margin (Passport) %",
    ];

    const rows = devices.map((d) => [
      d.brand,
      d.model,
      d.usdToPkr,
      d.costUsd,
      d.shippingUsd,
      d.expectedSalePkr,
      d.slabLabel,
      Math.round(d.gstRate * 100) + "%",
      Math.round(d.landedCnic),
      Math.round(d.profitCnic),
      d.marginCnic.toFixed(1),
      Math.round(d.landedPassport),
      Math.round(d.profitPassport),
      d.marginPassport.toFixed(1),
    ]);

    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replaceAll('"', '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phonescanada-pta-devices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // PDF export: print-friendly HTML (fixes “PDF not downloading” & improves UX)
  function exportPDF() {
    if (!devices.length) return;

    const baseUrl = import.meta?.env?.BASE_URL || "/";
    const logoUrl = `${baseUrl}phonescanadalogo-web.png`;

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;

    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Saira", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; }
      .bg {
        min-height: 100vh;
        padding: 28px;
        background:
          radial-gradient(1200px 600px at 20% 10%, rgba(255, 88, 110, .18), transparent 55%),
          radial-gradient(1000px 600px at 85% 20%, rgba(56, 189, 248, .18), transparent 60%),
          radial-gradient(900px 600px at 40% 90%, rgba(168, 85, 247, .12), transparent 55%),
          linear-gradient(180deg, #fbfbfe 0%, #f6f7ff 100%);
      }
      .page {
        max-width: 900px;
        margin: 0 auto;
      }
      .header {
        display: flex;
        gap: 14px;
        align-items: center;
        padding: 16px 18px;
        border-radius: 16px;
        background: rgba(255,255,255,.78);
        border: 1px solid rgba(15, 23, 42, .08);
        box-shadow: 0 18px 45px rgba(2, 6, 23, .08);
        backdrop-filter: blur(10px);
      }
      .logoWrap {
        width: 56px; height: 56px; border-radius: 14px;
        background: linear-gradient(135deg, rgba(255,88,110,.22), rgba(56,189,248,.16));
        display: grid; place-items: center;
        border: 1px solid rgba(15, 23, 42, .08);
        overflow: hidden;
      }
      .logoWrap img { width: 44px; height: 44px; object-fit: contain; display: block; }
      .title { font-size: 20px; font-weight: 600; letter-spacing: .2px; margin: 0; }
      .sub { margin: 2px 0 0; font-size: 12.5px; opacity: .7; }
      .meta { margin-left: auto; text-align: right; font-size: 12px; opacity: .7; line-height: 1.3; }
      .grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .card {
        background: rgba(255,255,255,.78);
        border: 1px solid rgba(15, 23, 42, .08);
        border-radius: 16px;
        padding: 14px 16px;
        box-shadow: 0 18px 45px rgba(2, 6, 23, .06);
        backdrop-filter: blur(10px);
        page-break-inside: avoid;
      }
      .rowTop {
        display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
      }
      .name {
        font-weight: 600; font-size: 15px; margin: 0;
      }
      .badge {
        display: inline-flex; gap: 8px; align-items: center;
        padding: 6px 10px; border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, .10);
        background: rgba(15, 23, 42, .03);
        font-size: 12px; opacity: .85;
        white-space: nowrap;
      }
      .two {
        margin-top: 10px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .mini {
        border-radius: 14px;
        border: 1px solid rgba(15,23,42,.08);
        background: rgba(2, 6, 23, .02);
        padding: 10px 12px;
      }
      .mini h4 { margin: 0 0 6px; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; opacity: .65; }
      .kv { display: flex; justify-content: space-between; gap: 10px; margin: 4px 0; }
      .kv .k { font-size: 12px; opacity: .7; }
      .kv .v { font-size: 12.5px; font-weight: 600; }
      .pill {
        margin-top: 8px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        border: 1px solid rgba(15, 23, 42, .12);
      }
      .pill.profit { background: rgba(16, 185, 129, .12); color: #065f46; border-color: rgba(16,185,129,.25); }
      .pill.loss { background: rgba(239, 68, 68, .10); color: #7f1d1d; border-color: rgba(239,68,68,.22); }
      .pill.neutral { background: rgba(148, 163, 184, .12); color: #334155; border-color: rgba(148,163,184,.25); }
      .foot {
        margin-top: 10px;
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
        opacity: .8;
        flex-wrap: wrap;
      }
      .mono { font-variant-numeric: tabular-nums; }
      @media print {
        .bg { padding: 0; }
        .page { max-width: 100%; }
        body { background: #fff; }
        .header, .card { box-shadow: none; }
      }
    `;

    const rowsHtml = devices
      .slice()
      .reverse()
      .map((d, idx) => {
        const pC = profitTone(d.profitCnic);
        const pP = profitTone(d.profitPassport);
        const slabText = `Slab: ${d.slabLabel} USD • GST: ${Math.round(d.gstRate * 100)}%`;
        return `
          <div class="card">
            <div class="rowTop">
              <p class="name">${idx + 1}. ${escapeHtml(d.brand)} — ${escapeHtml(d.model)}</p>
              <span class="badge mono">${slabText}</span>
            </div>
            <div class="two">
              <div class="mini">
                <h4>CNIC</h4>
                <div class="kv"><div class="k">Expected Sale</div><div class="v mono">${escapeHtml(fmtPKR(d.expectedSalePkr))}</div></div>
                <div class="kv"><div class="k">Cost + Ship</div><div class="v mono">${escapeHtml(fmtUSD(d.costUsd))} + ${escapeHtml(fmtUSD(d.shippingUsd))}</div></div>
                <div class="kv"><div class="k">Landed</div><div class="v mono">${escapeHtml(fmtPKR(d.landedCnic))}</div></div>
                <div class="kv"><div class="k">Margin</div><div class="v mono">${escapeHtml(fmtPct(d.marginCnic))}</div></div>
                <div class="pill ${pC} mono">${pC === "profit" ? "Profit" : pC === "loss" ? "Loss" : "Even"} • ${escapeHtml(fmtPKR(d.profitCnic))}</div>
              </div>
              <div class="mini">
                <h4>Passport</h4>
                <div class="kv"><div class="k">Expected Sale</div><div class="v mono">${escapeHtml(fmtPKR(d.expectedSalePkr))}</div></div>
                <div class="kv"><div class="k">Cost + Ship</div><div class="v mono">${escapeHtml(fmtUSD(d.costUsd))} + ${escapeHtml(fmtUSD(d.shippingUsd))}</div></div>
                <div class="kv"><div class="k">Landed</div><div class="v mono">${escapeHtml(fmtPKR(d.landedPassport))}</div></div>
                <div class="kv"><div class="k">Margin</div><div class="v mono">${escapeHtml(fmtPct(d.marginPassport))}</div></div>
                <div class="pill ${pP} mono">${pP === "profit" ? "Profit" : pP === "loss" ? "Loss" : "Even"} • ${escapeHtml(fmtPKR(d.profitPassport))}</div>
              </div>
            </div>
            <div class="foot">
              <div class="mono">USD→PKR: ${escapeHtml(String(d.usdToPkr))}</div>
              <div class="mono">GST threshold: $${escapeHtml(String(settings.gstThresholdUsd))}</div>
            </div>
          </div>
        `;
      })
      .join("");

    win.document.open();
    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>PhonesCanada PTA Dashboard — Report</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="bg">
          <div class="page">
            <div class="header">
              <div class="logoWrap">
                <img src="${logoUrl}" alt="PhonesCanada logo" onerror="this.style.display='none'" />
              </div>
              <div>
                <h1 class="title">PhonesCanada PTA Dashboard — Report</h1>
                <p class="sub mono">USD/PKR Rate: ${escapeHtml(String(settings.usdToPkr))} • GST: ${Math.round(settings.gstLow * 100)}% / ${Math.round(
      settings.gstHigh * 100
    )}% (threshold $${escapeHtml(String(settings.gstThresholdUsd))})</p>
              </div>
              <div class="meta mono">
                ${escapeHtml(new Date().toLocaleString())}<br/>
                ${escapeHtml(String(devices.length))} device(s)
              </div>
            </div>

            <div class="grid">
              ${rowsHtml}
            </div>
          </div>
        </div>

        <script>
          // Trigger print after layout
          setTimeout(() => window.print(), 350);
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Logo from public (GitHub Pages base path safe)
  const baseUrl = import.meta?.env?.BASE_URL || "/";
  const logoSrc = `${baseUrl}phonescanadalogo-web.png`;

  // Animated background toggle
  const animOn = !!settings.animations;

  return (
    <div className={`pc-root ${animOn ? "animOn" : "animOff"}`}>
      <style>{styles}</style>

      {/* Background layer */}
      <div className="pc-bg" aria-hidden="true">
        <div className="pc-blob b1" />
        <div className="pc-blob b2" />
        <div className="pc-blob b3" />

        {/* animated line grid */}
        <div className="pc-gridLines" />

        {/* prism/paragon-ish outlines */}
        <div className="pc-shapes">
          <div className="pc-shape s1" />
          <div className="pc-shape s2" />
          <div className="pc-shape s3" />
          <div className="pc-shape s4" />
        </div>
      </div>

      <div className="pc-page">
        {/* Header */}
        <div className="pc-header">
          <div className="pc-logoBox" aria-hidden="true">
            <img
              src={logoSrc}
              alt="PhonesCanada logo"
              className="pc-logoImg"
              onError={(e) => {
                // If missing, keep box but hide broken image icon
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div className="pc-titleBlock">
            <div className="pc-title">PhonesCanada PTA Dashboard</div>
            <div className="pc-subtitle">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
          </div>
        </div>

        {/* Main layout */}
        <div className="pc-layout">
          {/* Left column */}
          <div className="pc-left">
            <div className="pc-card pc-shadow">
              <div className="pc-cardHead">
                <div className="pc-cardTitle">System Preferences</div>
              </div>

              <div className="pc-field">
                <label>
                  USD Rate (PKR) <Tip text="Used to convert (Cost + Shipping) USD into PKR base." />
                </label>
                <input
                  className="pc-input"
                  inputMode="numeric"
                  value={settings.usdToPkr}
                  onChange={(e) => setSettings((s) => ({ ...s, usdToPkr: clampNum(e.target.value, s.usdToPkr) }))}
                />
              </div>

              <div className="pc-row pc-rowBetween">
                <div>
                  <div className="pc-bold">Animations</div>
                  <div className="pc-muted">Smooth blobs + prism outlines</div>
                </div>
                <button
                  type="button"
                  className={`pc-toggle ${animOn ? "on" : "off"}`}
                  onClick={() => setSettings((s) => ({ ...s, animations: !s.animations }))}
                  aria-label="Toggle background animations"
                >
                  <span />
                </button>
              </div>

              <div className="pc-muted pc-note">
                💡 GST auto-switches at <b>${settings.gstThresholdUsd}</b>: {Math.round(settings.gstLow * 100)}% below /{" "}
                {Math.round(settings.gstHigh * 100)}% at or above.
              </div>
            </div>

            {/* PTA Slabs */}
            <div className="pc-card pc-shadow">
              <div className="pc-cardHead">
                <div className="pc-cardTitle">PTA Tax Slabs (Editable)</div>
              </div>

              <div className="pc-slabTableWrap">
                <table className="pc-slabTable">
                  <thead>
                    <tr>
                      <th className="colRange">Value Range (USD)</th>
                      <th className="colVal">CNIC</th>
                      <th className="colVal">Passport</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slabs.map((s, i) => (
                      <tr key={s.id}>
                        <td className="rangeCell">
                          <span className="rangePill">{s.label}</span>
                        </td>
                        <td>
                          <input
                            className="pc-input pc-inputMini"
                            inputMode="numeric"
                            value={s.cnic}
                            onChange={(e) => {
                              const v = clampNum(e.target.value, s.cnic);
                              setSlabs((prev) => prev.map((x, idx) => (idx === i ? { ...x, cnic: v } : x)));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="pc-input pc-inputMini"
                            inputMode="numeric"
                            value={s.passport}
                            onChange={(e) => {
                              const v = clampNum(e.target.value, s.passport);
                              setSlabs((prev) => prev.map((x, idx) => (idx === i ? { ...x, passport: v } : x)));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pc-muted" style={{ marginTop: 10 }}>
                Saved automatically on this device (localStorage).
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="pc-right">
            {/* Inventory planning */}
            <div className="pc-card pc-shadow">
              <div className="pc-cardHead pc-row pc-rowBetween">
                <div>
                  <div className="pc-cardTitle">Inventory Planning</div>
                  <div className="pc-muted">Add a device and instantly compare CNIC vs Passport.</div>
                </div>
                <button type="button" className="pc-btn primary" onClick={addDevice}>
                  <span className="pc-plus">＋</span> Add Device
                </button>
              </div>

              <div className="pc-formGrid">
                <div className="pc-field">
                  <label>Brand</label>
                  <select className="pc-input" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}>
                    <option value="">Select…</option>
                    {BRAND_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pc-field">
                  <label>Device / Model Name</label>
                  <input
                    className="pc-input"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro Max"
                  />
                </div>

                <div className="pc-field">
                  <label>
                    Purchase Cost (USD) <Tip text="Device purchase price in USD." />
                  </label>
                  <input
                    className="pc-input"
                    inputMode="decimal"
                    value={form.costUsd}
                    onChange={(e) => setForm((f) => ({ ...f, costUsd: e.target.value }))}
                    placeholder="e.g. 1199"
                  />
                </div>

                <div className="pc-field">
                  <label>
                    Shipping (USD) <Tip text="Shipping cost in USD." />
                  </label>
                  <input
                    className="pc-input"
                    inputMode="decimal"
                    value={form.shippingUsd}
                    onChange={(e) => setForm((f) => ({ ...f, shippingUsd: e.target.value }))}
                    placeholder="e.g. 30"
                  />
                </div>

                <div className="pc-field pc-span2">
                  <label>Expected Selling Price (PKR)</label>
                  <input
                    className="pc-input"
                    inputMode="numeric"
                    value={form.expectedSalePkr}
                    onChange={(e) => setForm((f) => ({ ...f, expectedSalePkr: e.target.value }))}
                    placeholder="e.g. 525000"
                  />
                </div>

                <div className="pc-field pc-profitCell">
                  <label>Profit / Loss (Best)</label>
                  <div className={`pc-pill ${profitTone(planning.bestProfit)}`}>
                    <span className="pc-pillLabel">{planning.bestProfit > 0 ? "Profit" : planning.bestProfit < 0 ? "Loss" : "Even"}</span>
                    <span className="pc-pillVal">{fmtPKR(planning.bestProfit)}</span>
                  </div>
                </div>
              </div>

              <div className="pc-muted" style={{ marginTop: 10 }}>
                Slab: <b>{planning.slab?.label}</b> USD • GST: <b>{Math.round(planning.gstRate * 100)}%</b>
              </div>
            </div>

            {/* Devices */}
            <div className="pc-card pc-shadow">
              <div className="pc-row pc-rowBetween" style={{ marginBottom: 10 }}>
                <div className="pc-sectionTitle">Devices</div>
                <div className="pc-muted">{devices.length} device(s)</div>
              </div>

              <div className="pc-deviceGrid">
                {devices.map((d) => {
                  const pC = profitTone(d.profitCnic);
                  const pP = profitTone(d.profitPassport);
                  return (
                    <div className="pc-deviceCard pc-shadowSoft" key={d.id}>
                      <button className="pc-trash" onClick={() => removeDevice(d.id)} aria-label="Delete device">
                        🗑️
                      </button>

                      <div className="pc-deviceTop">
                        <div className="pc-deviceBrand">{d.brand.toUpperCase()}</div>
                        <div className="pc-deviceModel">{d.model}</div>
                        <div className="pc-badges">
                          <span className="pc-badge">Slab: {d.slabLabel} USD</span>
                          <span className="pc-badge">GST: {Math.round(d.gstRate * 100)}%</span>
                        </div>
                      </div>

                      <div className="pc-compare">
                        <div className="pc-mini">
                          <div className="pc-miniHead">
                            <div className="pc-miniTitle">CNIC</div>
                            <div className={`pc-miniPill ${pC}`}>
                              {pC === "profit" ? "PROFIT" : pC === "loss" ? "LOSS" : "EVEN"} • {fmtPKR(d.profitCnic)}
                            </div>
                          </div>

                          <div className="pc-miniRow">
                            <div className="k">Landed</div>
                            <div className="v mono">{fmtPKR(d.landedCnic)}</div>
                          </div>
                          <div className="pc-miniRow">
                            <div className="k">Margin</div>
                            <div className="v mono">{fmtPct(d.marginCnic)}</div>
                          </div>
                        </div>

                        <div className="pc-mini">
                          <div className="pc-miniHead">
                            <div className="pc-miniTitle">Passport</div>
                            <div className={`pc-miniPill ${pP}`}>
                              {pP === "profit" ? "PROFIT" : pP === "loss" ? "LOSS" : "EVEN"} • {fmtPKR(d.profitPassport)}
                            </div>
                          </div>

                          <div className="pc-miniRow">
                            <div className="k">Landed</div>
                            <div className="v mono">{fmtPKR(d.landedPassport)}</div>
                          </div>
                          <div className="pc-miniRow">
                            <div className="k">Margin</div>
                            <div className="v mono">{fmtPct(d.marginPassport)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="pc-deviceFoot">
                        <div className="pc-footRow">
                          <div className="k">Sale</div>
                          <div className="v mono">{fmtPKR(d.expectedSalePkr)}</div>
                        </div>
                        <div className="pc-footRow">
                          <div className="k">Cost+Ship</div>
                          <div className="v mono">
                            {fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)}
                          </div>
                        </div>
                        <div className="pc-footRow">
                          <div className="k">USD→PKR</div>
                          <div className="v mono">{d.usdToPkr}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Export bar (only once, not per device) */}
              <div className="pc-exportBar pc-shadowSoft">
                <div className="pc-exportLeft">
                  <div className="pc-bold">Export</div>
                  <div className="pc-muted">Export the full device list (CSV) or printable report (Save as PDF).</div>
                </div>
                <div className="pc-exportBtns">
                  <button className="pc-btn secondary" onClick={exportCSV} disabled={!devices.length}>
                    ⬇ CSV
                  </button>
                  <button className="pc-btn secondary" onClick={exportPDF} disabled={!devices.length}>
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* bottom spacing */}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

const styles = `
  :root{
    --pc-ink: #0f172a;
    --pc-muted: rgba(15, 23, 42, .62);
    --pc-border: rgba(15, 23, 42, .10);
    --pc-card: rgba(255,255,255,.74);
    --pc-card2: rgba(255,255,255,.66);
    --pc-shadow: 0 18px 45px rgba(2, 6, 23, .10);
    --pc-shadow2: 0 10px 28px rgba(2, 6, 23, .08);
    --pc-soft: 0 10px 22px rgba(2, 6, 23, .06);
    --pc-red: #ef4444;
    --pc-green: #10b981;
    --pc-blue: #38bdf8;
    --pc-violet: #a855f7;
    --pc-rose: #ff586e;
  }

  html, body { height: 100%; }
  body {
    margin: 0;
    font-family: "Saira", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: var(--pc-ink);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .mono { font-variant-numeric: tabular-nums; }

  .pc-root { min-height: 100vh; position: relative; overflow-x: hidden; }
  .pc-page {
    position: relative;
    z-index: 2;
    max-width: 1180px;
    margin: 0 auto;
    padding: 22px 16px 40px;
  }

  /* Background */
  .pc-bg{
    position: fixed;
    inset: 0;
    z-index: 0;
    background:
      radial-gradient(1200px 700px at 18% 10%, rgba(255, 88, 110, .22), transparent 55%),
      radial-gradient(1100px 650px at 86% 16%, rgba(56, 189, 248, .20), transparent 58%),
      radial-gradient(900px 650px at 46% 96%, rgba(168, 85, 247, .14), transparent 58%),
      linear-gradient(180deg, #fbfbfe 0%, #f6f7ff 100%);
  }

  .pc-blob{
    position: absolute;
    width: 520px; height: 520px;
    border-radius: 999px;
    filter: blur(42px);
    opacity: .65;
    transform: translateZ(0);
    mix-blend-mode: multiply;
  }
  .b1{ left: -140px; top: -160px; background: rgba(255,88,110,.35); }
  .b2{ right: -180px; top: -120px; background: rgba(56,189,248,.32); }
  .b3{ left: 10%; bottom: -220px; background: rgba(168,85,247,.24); }

  .animOn .b1{ animation: float1 7s ease-in-out infinite; }
  .animOn .b2{ animation: float2 8s ease-in-out infinite; }
  .animOn .b3{ animation: float3 9s ease-in-out infinite; }

  @keyframes float1 { 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(30px, 26px) scale(1.06);} }
  @keyframes float2 { 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(-34px, 22px) scale(1.05);} }
  @keyframes float3 { 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(16px,-28px) scale(1.07);} }

  /* Animated line grid */
  .pc-gridLines{
    position: absolute;
    inset: 0;
    opacity: .35;
    background:
      linear-gradient(90deg, rgba(15,23,42,.06) 1px, transparent 1px),
      linear-gradient(180deg, rgba(15,23,42,.06) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: radial-gradient(closest-side at 50% 40%, rgba(0,0,0,.95), transparent 70%);
  }
  .animOn .pc-gridLines{
    animation: gridShift 2.4s linear infinite;
  }
  @keyframes gridShift{
    0% { background-position: 0 0, 0 0; }
    100% { background-position: 72px 72px, 72px 72px; }
  }

  /* Prism / Paragon outlines (soft) */
  .pc-shapes{ position: absolute; inset: 0; pointer-events: none; }
  .pc-shape{
    position: absolute;
    width: 140px; height: 140px;
    border-radius: 22px;
    border: 1px solid rgba(15,23,42,.10);
    box-shadow: 0 18px 45px rgba(2,6,23,.08);
    background: linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,0));
    transform: rotate(18deg);
    backdrop-filter: blur(10px);
  }
  .pc-shape::after{
    content:"";
    position:absolute;
    inset: 14px;
    border-radius: 18px;
    border: 1px dashed rgba(15,23,42,.12);
  }
  .s1{ left: 6%; top: 22%; width: 180px; height: 180px; transform: rotate(22deg); }
  .s2{ right: 8%; top: 38%; width: 130px; height: 130px; transform: rotate(38deg); }
  .s3{ left: 14%; bottom: 10%; width: 160px; height: 160px; transform: rotate(12deg); }
  .s4{ right: 12%; bottom: 18%; width: 210px; height: 210px; transform: rotate(28deg); }

  .animOn .s1{ animation: shapeFloat 4.2s ease-in-out infinite; }
  .animOn .s2{ animation: shapeFloat 3.6s ease-in-out infinite reverse; }
  .animOn .s3{ animation: shapeFloat 4.8s ease-in-out infinite; }
  .animOn .s4{ animation: shapeFloat 5.2s ease-in-out infinite reverse; }

  @keyframes shapeFloat{
    0%,100%{ transform: translate(0,0) rotate(var(--r, 20deg)); }
    50%{ transform: translate(18px,-14px) rotate(calc(var(--r, 20deg) + 6deg)); }
  }
  .s1{ --r: 22deg; } .s2{ --r: 38deg; } .s3{ --r: 12deg; } .s4{ --r: 28deg; }

  .animOff .pc-blob, .animOff .pc-gridLines, .animOff .pc-shape { animation: none !important; }

  /* Header */
  .pc-header{
    display:flex;
    align-items:center;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 18px;
    background: var(--pc-card);
    border: 1px solid var(--pc-border);
    box-shadow: var(--pc-shadow);
    backdrop-filter: blur(12px);
  }
  .pc-logoBox{
    width: 56px; height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(255,88,110,.22), rgba(56,189,248,.16));
    border: 1px solid rgba(15,23,42,.10);
    display:grid;
    place-items:center;
    overflow:hidden;
    flex: 0 0 auto;
  }
  .pc-logoImg{
    width: 44px; height: 44px;
    object-fit: contain;
    display:block;
  }
  .pc-titleBlock{ min-width: 0; }
  .pc-title{
    font-weight: 600;
    font-size: clamp(18px, 2.2vw, 24px);
    letter-spacing: .2px;
    line-height: 1.1;
  }
  .pc-subtitle{
    margin-top: 2px;
    color: var(--pc-muted);
    font-weight: 400;
    font-size: 13px;
  }

  /* Layout */
  .pc-layout{
    display:grid;
    grid-template-columns: 360px 1fr;
    gap: 14px;
    margin-top: 14px;
    align-items:start;
  }
  @media (max-width: 980px){
    .pc-layout{ grid-template-columns: 1fr; }
  }

  .pc-left, .pc-right{ display:flex; flex-direction: column; gap: 14px; }

  /* Cards */
  .pc-card{
    background: var(--pc-card);
    border: 1px solid var(--pc-border);
    border-radius: 18px;
    padding: 14px;
    backdrop-filter: blur(12px);
  }
  .pc-shadow{ box-shadow: var(--pc-shadow); }
  .pc-shadowSoft{ box-shadow: var(--pc-soft); }

  .pc-cardHead{ margin-bottom: 10px; }
  .pc-cardTitle{
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
    font-size: 12px;
    opacity: .75;
  }
  .pc-sectionTitle{
    font-weight: 600;
    font-size: 26px;
    letter-spacing: .2px;
  }

  .pc-row{ display:flex; gap: 10px; align-items:center; }
  .pc-rowBetween{ justify-content: space-between; }
  .pc-bold{ font-weight: 600; }
  .pc-muted{ color: var(--pc-muted); font-size: 13px; font-weight: 400; }

  /* Fields */
  .pc-field{ display:flex; flex-direction: column; gap: 6px; min-width: 0; }
  .pc-field label{
    font-size: 13px;
    font-weight: 500;
    color: rgba(15,23,42,.78);
  }
  .pc-input{
    width: 100%;
    padding: 12px 12px;
    border-radius: 14px;
    border: 1px solid rgba(15,23,42,.12);
    background: rgba(255,255,255,.85);
    font-family: inherit;
    font-size: 15px;
    outline: none;
  }
  .pc-input:focus{
    border-color: rgba(56,189,248,.55);
    box-shadow: 0 0 0 4px rgba(56,189,248,.16);
  }
  .pc-inputMini{
    padding: 10px 10px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .pc-note{ margin-top: 10px; line-height: 1.4; }

  /* Form grid */
  .pc-formGrid{
    display:grid;
    gap: 10px;
    grid-template-columns: 1.2fr 2.2fr 1.5fr 1.5fr;
    align-items:end;
  }
  .pc-span2{ grid-column: span 2; }
  .pc-profitCell{ min-width: 190px; }
  @media (max-width: 980px){
    .pc-formGrid{ grid-template-columns: 1fr 1fr; }
    .pc-span2{ grid-column: span 2; }
    .pc-profitCell{ grid-column: span 2; }
  }
  @media (max-width: 560px){
    .pc-formGrid{ grid-template-columns: 1fr; }
    .pc-span2{ grid-column: span 1; }
    .pc-profitCell{ grid-column: span 1; }
  }

  /* Buttons */
  .pc-btn{
    border: 1px solid rgba(15,23,42,.12);
    background: rgba(255,255,255,.85);
    border-radius: 999px;
    padding: 10px 14px;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    display:inline-flex;
    align-items:center;
    gap: 10px;
    box-shadow: var(--pc-shadow2);
  }
  .pc-btn:disabled{
    opacity: .55;
    cursor: not-allowed;
  }
  .pc-btn.primary{
    border: 0;
    color: white;
    background: linear-gradient(135deg, rgba(255,88,110,1), rgba(255,88,110,.78));
    box-shadow: 0 18px 45px rgba(255, 88, 110, .24);
  }
  .pc-btn.secondary{
    background: rgba(255,255,255,.82);
  }
  .pc-plus{ font-size: 18px; line-height: 0; }

  /* Toggle */
  .pc-toggle{
    width: 54px; height: 30px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.14);
    background: rgba(255,255,255,.7);
    position: relative;
    cursor: pointer;
    padding: 0;
  }
  .pc-toggle span{
    position:absolute;
    top: 3px; left: 3px;
    width: 24px; height: 24px;
    border-radius: 999px;
    background: rgba(148,163,184,.9);
    transition: transform .2s ease, background .2s ease;
  }
  .pc-toggle.on{
    background: rgba(255, 88, 110, .20);
    border-color: rgba(255, 88, 110, .35);
  }
  .pc-toggle.on span{
    transform: translateX(24px);
    background: rgba(255,88,110,1);
  }

  /* Profit pill (planning) */
  .pc-pill{
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 10px;
    border-radius: 999px;
    padding: 10px 12px;
    border: 1px solid rgba(15,23,42,.12);
    background: rgba(255,255,255,.80);
    min-height: 44px;
  }
  .pc-pillLabel{
    font-weight: 600;
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    opacity: .8;
  }
  .pc-pillVal{
    font-weight: 600;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .pc-pill.profit{ background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.25); color: #065f46; }
  .pc-pill.loss{ background: rgba(239,68,68,.10); border-color: rgba(239,68,68,.22); color: #7f1d1d; }
  .pc-pill.neutral{ background: rgba(148,163,184,.12); border-color: rgba(148,163,184,.25); color: #334155; }

  /* Slab table */
  .pc-slabTableWrap{ overflow: hidden; border-radius: 16px; border: 1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.65); }
  .pc-slabTable{
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .pc-slabTable thead th{
    text-align: left;
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: rgba(15,23,42,.62);
    background: rgba(15,23,42,.03);
    padding: 12px 12px;
  }
  .pc-slabTable tbody td{
    padding: 10px 12px;
    border-top: 1px solid rgba(15,23,42,.06);
  }
  .colRange{ width: 130px; }   /* keep range readable */
  .colVal{ width: 1fr; }
  .rangeCell{ width: 130px; }
  .rangePill{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width: 76px;
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.10);
    background: rgba(15,23,42,.03);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* Device grid */
  .pc-deviceGrid{
    display:grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  @media (max-width: 980px){
    .pc-deviceGrid{ grid-template-columns: 1fr; }
  }

  .pc-deviceCard{
    position: relative;
    background: rgba(255,255,255,.78);
    border: 1px solid rgba(15,23,42,.10);
    border-radius: 18px;
    padding: 14px;
    overflow: hidden;
  }

  .pc-trash{
    position:absolute;
    top: 12px; right: 12px;
    width: 40px; height: 40px;
    border-radius: 14px;
    border: 1px solid rgba(15,23,42,.10);
    background: rgba(255,255,255,.84);
    cursor:pointer;
    box-shadow: var(--pc-shadow2);
  }

  .pc-deviceBrand{
    font-size: 12px;
    letter-spacing: .18em;
    text-transform: uppercase;
    opacity: .55;
    font-weight: 600;
  }
  .pc-deviceModel{
    font-size: 22px;
    font-weight: 600;
    line-height: 1.1;
    margin-top: 4px;
    word-break: break-word;
  }

  .pc-badges{ display:flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .pc-badge{
    display:inline-flex;
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.10);
    background: rgba(15,23,42,.03);
    font-size: 12.5px;
    font-weight: 600;
    opacity: .8;
  }

  .pc-compare{
    margin-top: 12px;
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 560px){
    .pc-compare{ grid-template-columns: 1fr; }
  }

  .pc-mini{
    border-radius: 16px;
    border: 1px solid rgba(15,23,42,.10);
    background: rgba(2,6,23,.02);
    padding: 12px;
    min-width: 0;
  }
  .pc-miniHead{
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .pc-miniTitle{
    font-size: 12px;
    letter-spacing: .18em;
    text-transform: uppercase;
    opacity: .65;
    font-weight: 600;
  }
  .pc-miniPill{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid rgba(15,23,42,.12);
    font-weight: 600;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pc-miniPill.profit{ background: rgba(16,185,129,.14); border-color: rgba(16,185,129,.25); color: #065f46; }
  .pc-miniPill.loss{ background: rgba(239,68,68,.10); border-color: rgba(239,68,68,.22); color: #7f1d1d; }
  .pc-miniPill.neutral{ background: rgba(148,163,184,.12); border-color: rgba(148,163,184,.25); color: #334155; }

  .pc-miniRow{
    display:flex;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px dashed rgba(15,23,42,.10);
  }
  .pc-miniRow:first-of-type{ border-top: 0; }
  .pc-miniRow .k{ color: rgba(15,23,42,.58); font-weight: 500; }
  .pc-miniRow .v{
    font-weight: 600;
    font-size: clamp(14px, 1.6vw, 16px);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 55%;
  }

  .pc-deviceFoot{
    margin-top: 12px;
    border-top: 1px solid rgba(15,23,42,.08);
    padding-top: 10px;
    display:grid;
    gap: 8px;
  }
  .pc-footRow{
    display:flex;
    justify-content: space-between;
    gap: 10px;
    align-items: baseline;
  }
  .pc-footRow .k{ color: rgba(15,23,42,.58); font-weight: 500; }
  .pc-footRow .v{
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 62%;
    text-align: right;
  }

  /* Export bar */
  .pc-exportBar{
    margin-top: 14px;
    border-radius: 18px;
    border: 1px solid rgba(15,23,42,.10);
    background: rgba(255,255,255,.74);
    padding: 12px 14px;
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pc-exportBtns{ display:flex; gap: 10px; flex-wrap: wrap; }

  /* Tooltip */
  .pc-tip{
    display:inline-grid;
    place-items:center;
    width: 18px; height: 18px;
    border-radius: 999px;
    background: rgba(15,23,42,.06);
    border: 1px solid rgba(15,23,42,.12);
    font-size: 12px;
    font-weight: 600;
    margin-left: 6px;
    cursor: help;
    color: rgba(15,23,42,.6);
  }
`;

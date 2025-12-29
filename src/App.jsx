import React, { useEffect, useMemo, useState } from "react";
import { Plus, Download } from "lucide-react";

/**
 * PhonesCanada PTA MOBILE TAX & PROFIT DASHBOARD
 * - Static GitHub Pages friendly
 * - No logo upload (loads from public/phonescanadalogo-web.png)
 * - Editable PTA slabs (persisted in localStorage)
 * - Multi-device compact cards (2 per row responsive)
 * - Global Export: CSV + Print-to-PDF (no jsPDF/html2canvas deps)
 */

const DEFAULT_SETTINGS = {
  usdToPkr: 278,
  gstUnderThreshold: 0.18,
  gstAboveThreshold: 0.25,
  gstThresholdUsd: 500,
  animationEnabled: true,
};

const DEFAULT_PTA_SLABS = [
  { range: "0–30", label: "0–30 USD", cnic: 550, passport: 430 },
  { range: "31–100", label: "31–100 USD", cnic: 4323, passport: 3200 },
  { range: "101–200", label: "101–200 USD", cnic: 11561, passport: 9580 },
  { range: "201–350", label: "201–350 USD", cnic: 14661, passport: 12200 },
  { range: "351–500", label: "351–500 USD", cnic: 23420, passport: 17800 },
  { range: "501+", label: "501+ USD", cnic: 37007, passport: 36870 },
];

const SLABS_KEY = "pc_pta_slabs_v2";
const SETTINGS_KEY = "pc_pta_settings_v2";

const BRANDS = ["Apple", "Samsung", "Google", "OnePlus", "Xiaomi", "Vivo", "Oppo", "Huawei", "Other"];

// Put your logo at: public/phonescanadalogo-web.png
const LOGO_SRC = `${import.meta.env.BASE_URL}phonescanadalogo-web.png`;

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function fmtPKR(n) {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(v);
  } catch {
    return `Rs ${Math.round(v).toLocaleString()}`;
  }
}

function fmtUSD(n) {
  return `$${Number(n || 0).toFixed(0)}`;
}

function getSlab(valueUsd, slabs) {
  const v = Number(valueUsd || 0);
  if (v <= 30) return slabs[0];
  if (v <= 100) return slabs[1];
  if (v <= 200) return slabs[2];
  if (v <= 350) return slabs[3];
  if (v <= 500) return slabs[4];
  return slabs[5];
}

function calcTotals({ costUsd, shippingUsd, expectedSalePkr, settings, slabs }) {
  const usdToPkr = Number(settings.usdToPkr || 0);
  const cost = Number(costUsd || 0);
  const ship = Number(shippingUsd || 0);
  const basePkr = (cost + ship) * usdToPkr;

  const gstRate = cost >= settings.gstThresholdUsd ? settings.gstAboveThreshold : settings.gstUnderThreshold;
  const gstPkr = basePkr * gstRate;

  const slab = getSlab(cost, slabs);
  const ptaCnic = Number(slab.cnic || 0);
  const ptaPassport = Number(slab.passport || 0);

  const totalTaxCnic = gstPkr + ptaCnic;
  const totalTaxPassport = gstPkr + ptaPassport;

  const landedCnic = basePkr + totalTaxCnic;
  const landedPassport = basePkr + totalTaxPassport;

  const sale = Number(expectedSalePkr || 0);
  const profitCnic = sale - landedCnic;
  const profitPassport = sale - landedPassport;

  const marginCnic = sale > 0 ? (profitCnic / sale) * 100 : 0;
  const marginPassport = sale > 0 ? (profitPassport / sale) * 100 : 0;

  return {
    basePkr,
    gstRate,
    gstPkr,
    slab,
    totalTaxCnic,
    totalTaxPassport,
    landedCnic,
    landedPassport,
    profitCnic,
    profitPassport,
    marginCnic,
    marginPassport,
  };
}

function Tooltip({ text }) {
  return (
    <span className="pc-tooltip" aria-label="tooltip">
      <span className="pc-tipicon">i</span>
      <span className="pc-tipbox">{text}</span>
    </span>
  );
}

function Background({ enabled }) {
  if (!enabled) return null;
  return (
    <div className="pc-bg" aria-hidden="true">
      <div className="pc-blob one" />
      <div className="pc-blob two" />
      <div className="pc-blob three" />
      <svg className="pc-polys" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pcg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(239,68,68,0.30)" />
            <stop offset="1" stopColor="rgba(59,130,246,0.22)" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#pcg)" strokeWidth="1.2" opacity="0.9">
          {Array.from({ length: 26 }).map((_, i) => {
            const x = (i * 43) % 1200;
            const y = (i * 67) % 800;
            const w = 220 + (i % 5) * 30;
            const h = 140 + (i % 4) * 24;
            const p = `${x},${y} ${x + w},${y + 18} ${x + w - 36},${y + h} ${x + 18},${y + h - 22}`;
            return <polygon key={i} points={p} />;
          })}
        </g>
      </svg>
    </div>
  );
}

export default function App() {
  const [slabs, setSlabs] = useState(() => {
    try {
      const raw = localStorage.getItem(SLABS_KEY);
      if (!raw) return DEFAULT_PTA_SLABS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== DEFAULT_PTA_SLABS.length) return DEFAULT_PTA_SLABS;
      return parsed.map((s, idx) => ({ ...DEFAULT_PTA_SLABS[idx], ...s }));
    } catch {
      return DEFAULT_PTA_SLABS;
    }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Draft device (form)
  const [draft, setDraft] = useState({
    brand: "Apple",
    model: "iPhone 15 Pro Max",
    costUsd: 1199,
    shippingUsd: 30,
    expectedSalePkr: 525000,
  });

  // Multi device list (cards)
  const [devices, setDevices] = useState(() => [
    { id: uid(), ...draft },
  ]);

  const computed = useMemo(() => {
    return devices.map((d) => ({
      ...d,
      totals: calcTotals({ ...d, settings, slabs }),
    }));
  }, [devices, settings, slabs]);

  const exportRows = useMemo(() => {
    return computed.map((d) => {
      const t = d.totals;
      return {
        Brand: d.brand,
        Model: d.model,
        "Cost USD": Number(d.costUsd || 0),
        "Shipping USD": Number(d.shippingUsd || 0),
        "USD→PKR": Number(settings.usdToPkr || 0),
        "GST %": Math.round((t.gstRate || 0) * 100),
        Slab: t.slab?.label || "",
        "Landed CNIC": Math.round(t.landedCnic || 0),
        "Profit CNIC": Math.round(t.profitCnic || 0),
        "Margin CNIC %": Number((t.marginCnic || 0).toFixed(2)),
        "Landed Passport": Math.round(t.landedPassport || 0),
        "Profit Passport": Math.round(t.profitPassport || 0),
        "Margin Passport %": Number((t.marginPassport || 0).toFixed(2)),
        "Expected Sale PKR": Number(d.expectedSalePkr || 0),
      };
    });
  }, [computed, settings.usdToPkr]);

  useEffect(() => {
    try {
      localStorage.setItem(SLABS_KEY, JSON.stringify(slabs));
    } catch {
      // ignore
    }
  }, [slabs]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const addDevice = () => {
    setDevices((prev) => [{ id: uid(), ...draft }, ...prev]);
  };

  const exportCSV = () => {
    if (!exportRows.length) return;

    const headers = Object.keys(exportRows[0]);
    const lines = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const csv = lines.join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PhonesCanada-PTA-Report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // No extra deps: open a print window and user saves as PDF
    const html = `
      <html>
      <head>
        <title>PhonesCanada PTA Report</title>
        <meta charset="utf-8" />
        <style>
          body{font-family:Arial,Helvetica,sans-serif;padding:24px}
          h1{margin:0 0 6px}
          .muted{color:#666;margin:0 0 16px}
          table{border-collapse:collapse;width:100%}
          th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
          th{background:#f6f6f6}
        </style>
      </head>
      <body>
        <h1>PhonesCanada PTA Dashboard — Report</h1>
        <p class="muted">USD→PKR: ${settings.usdToPkr} • Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>${Object.keys(exportRows[0] || {}).map((h) => `<th>${h}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${exportRows
              .map(
                (r) =>
                  `<tr>${Object.keys(r).map((k) => `<td>${String(r[k] ?? "")}</td>`).join("")}</tr>`
              )
              .join("")}
          </tbody>
        </table>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="pc-wrap">
      <Background enabled={settings.animationEnabled} />

      <div className="pc-shell pc-fadeIn">
        {/* HEADER */}
        <div className="pc-topbar">
          <div className="pc-brand">
            <div className="pc-logoWrap" title="PhonesCanada">
              <div className="pc-logo">
                <img
                  src={LOGO_SRC}
                  alt="PhonesCanada logo"
                  onError={(e) => {
                    // fallback if missing
                    e.currentTarget.style.display = "none";
                    const parent = e.currentTarget.parentElement;
                    if (parent && !parent.querySelector(".pc-logo-fallback")) {
                      const span = document.createElement("span");
                      span.className = "pc-logo-fallback";
                      span.textContent = "P";
                      parent.appendChild(span);
                    }
                  }}
                />
              </div>
            </div>

            <div className="pc-title">
              <h1>PhonesCanada PTA Dashboard</h1>
              <p>PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
            </div>
          </div>
        </div>

        <div className="pc-grid">
          {/* LEFT */}
          <div className="pc-col">
            <div className="pc-card pad">
              <h2>System Preferences</h2>

              <div className="pc-field">
                <label>
                  USD Rate (PKR)
                  <Tooltip text="Used to convert Purchase + Shipping (USD) into PKR for base landed cost." />
                </label>
                <input
                  className="pc-input"
                  type="number"
                  value={settings.usdToPkr}
                  onChange={(e) => setSettings((s) => ({ ...s, usdToPkr: Number(e.target.value || 0) }))}
                />
              </div>

              <div style={{ height: 12 }} />

              <div className="pc-switch">
                <span>Animations</span>
                <button
                  className={`pc-toggle ${settings.animationEnabled ? "on" : ""}`}
                  onClick={() => setSettings((s) => ({ ...s, animationEnabled: !s.animationEnabled }))}
                  aria-pressed={settings.animationEnabled}
                  title="Toggle background animation"
                />
              </div>
            </div>

            <div className="pc-card pad">
              <h2>PTA Tax Slabs</h2>
              <p className="pc-note">Editable table (auto-saved in this browser). Update anytime PTA values change.</p>

              <table className="pc-slabs">
                <thead>
                  <tr>
                    <th>Value Range (USD)</th>
                    <th>CNIC</th>
                    <th>Passport</th>
                  </tr>
                </thead>
                <tbody>
                  {slabs.map((s, idx) => (
                    <tr key={s.range}>
                      <td>
                        <span className="pc-pill">{s.range}</span>
                      </td>
                      <td>
                        <input
                          className="pc-slabInput"
                          type="number"
                          value={s.cnic}
                          onChange={(e) => {
                            const v = Number(e.target.value || 0);
                            setSlabs((prev) => prev.map((row, i) => (i === idx ? { ...row, cnic: v } : row)));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="pc-slabInput"
                          type="number"
                          value={s.passport}
                          onChange={(e) => {
                            const v = Number(e.target.value || 0);
                            setSlabs((prev) => prev.map((row, i) => (i === idx ? { ...row, passport: v } : row)));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT */}
          <div className="pc-main">
            {/* PLANNER */}
            <div className="pc-card">
              <div className="pc-toolbar">
                <h3>Inventory Planning</h3>
                <button className="pc-btn" onClick={addDevice}>
                  <Plus size={18} /> Add Device
                </button>
              </div>

              <div className="pc-planner">
                <div className="pc-planner-grid">
                  <div className="pc-field">
                    <label>Brand</label>
                    <select
                      className="pc-select"
                      value={draft.brand}
                      onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                    >
                      {BRANDS.map((b) => (
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
                      value={draft.model}
                      onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                      placeholder="e.g., iPhone 15 Pro Max"
                    />
                  </div>

                  <div className="pc-field">
                    <label>
                      Purchase Cost (USD)
                      <Tooltip text="Your buy price per device in USD (excluding shipping)." />
                    </label>
                    <input
                      className="pc-input"
                      type="number"
                      value={draft.costUsd}
                      onChange={(e) => setDraft((d) => ({ ...d, costUsd: Number(e.target.value || 0) }))}
                    />
                  </div>

                  <div className="pc-field">
                    <label>
                      Shipping (USD)
                      <Tooltip text="Freight / courier cost allocated per device in USD." />
                    </label>
                    <input
                      className="pc-input"
                      type="number"
                      value={draft.shippingUsd}
                      onChange={(e) => setDraft((d) => ({ ...d, shippingUsd: Number(e.target.value || 0) }))}
                    />
                  </div>

                  <div className="pc-field">
                    <label>
                      Expected Selling Price (PKR)
                      <Tooltip text="Target selling price in Pakistan (PKR). Used to compute profit & margin." />
                    </label>
                    <input
                      className="pc-input"
                      type="number"
                      value={draft.expectedSalePkr}
                      onChange={(e) => setDraft((d) => ({ ...d, expectedSalePkr: Number(e.target.value || 0) }))}
                    />
                  </div>
                </div>

                <div style={{ height: 10 }} />
                <p className="pc-note">
                  💡 GST auto-switches at <b>{fmtUSD(settings.gstThresholdUsd)}</b>:{" "}
                  {Math.round(settings.gstUnderThreshold * 100)}% below / {Math.round(settings.gstAboveThreshold * 100)}% at or above.
                </p>
              </div>
            </div>

            {/* DEVICE CARDS (COMPACT, 2 PER ROW RESPONSIVE) */}
            <div
              className="pc-card pad"
              style={{
                marginTop: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <h3 style={{ margin: 0 }}>Devices</h3>
                <div className="pc-note" style={{ margin: 0 }}>
                  Cards auto-fit (2 per row on desktop, 1 on mobile).
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 14,
                }}
              >
                {computed.map((d) => {
                  const t = d.totals;
                  return (
                    <div key={d.id} className="pc-card" style={{ overflow: "hidden" }}>
                      <div className="pc-device-head" style={{ padding: 16, paddingBottom: 10 }}>
                        <div className="meta">
                          <div className="brand">{d.brand}</div>
                          <div className="model">{d.model}</div>
                          <div className="pc-note" style={{ marginTop: 6 }}>
                            Slab: <b>{t.slab.label}</b> • GST: <b>{Math.round(t.gstRate * 100)}%</b>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: 16, paddingTop: 0 }}>
                        <div className="pc-split" style={{ gap: 10 }}>
                          <div className="pc-panel" style={{ padding: 12 }}>
                            <h4 style={{ marginTop: 0 }}>CNIC</h4>
                            <div className="pc-kv">
                              <div className="k">Landed</div>
                              <div className="v">{fmtPKR(t.landedCnic)}</div>
                            </div>
                            <div className="pc-kv">
                              <div className="k">Profit</div>
                              <div className="v">{fmtPKR(t.profitCnic)}</div>
                            </div>
                            <div className="pc-note" style={{ marginTop: 8 }}>
                              {t.marginCnic.toFixed(1)}% margin
                            </div>
                          </div>

                          <div className="pc-panel" style={{ padding: 12 }}>
                            <h4 style={{ marginTop: 0 }}>Passport</h4>
                            <div className="pc-kv">
                              <div className="k">Landed</div>
                              <div className="v">{fmtPKR(t.landedPassport)}</div>
                            </div>
                            <div className="pc-kv">
                              <div className="k">Profit</div>
                              <div className="v">{fmtPKR(t.profitPassport)}</div>
                            </div>
                            <div className="pc-note" style={{ marginTop: 8 }}>
                              {t.marginPassport.toFixed(1)}% margin
                            </div>
                          </div>
                        </div>

                        <div className="pc-note" style={{ marginTop: 10 }}>
                          🧾 Sale: <b>{fmtPKR(d.expectedSalePkr)}</b> • 📦 Cost+Ship: <b>{fmtUSD(d.costUsd)}</b> +{" "}
                          <b>{fmtUSD(d.shippingUsd)}</b> • USD→PKR: <b>{settings.usdToPkr}</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* GLOBAL EXPORT */}
              <div className="pc-exportBar" style={{ marginTop: 16 }}>
                <div className="pc-exportTitle">
                  Export
                  <span>Exports the full device list (CSV) or printable report (Save as PDF).</span>
                </div>
                <div className="pc-exportBtns">
                  <button className="pc-btn secondary" onClick={exportCSV}>
                    <Download size={18} /> CSV
                  </button>
                  <button className="pc-btn secondary" onClick={exportPDF}>
                    <Download size={18} /> PDF
                  </button>
                </div>
              </div>
            </div>
            {/* end device area */}
          </div>
        </div>
      </div>
    </div>
  );
}

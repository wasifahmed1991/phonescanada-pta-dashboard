import React, { useMemo, useRef, useState } from "react";
import { Plus, Upload, Trash2, TrendingUp } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * PhonesCanada PTA MOBILE TAX & PROFIT DASHBOARD (2025)
 * ✅ No Tailwind required (pure CSS in src/index.css)
 * ✅ GitHub Pages ready (Vite base set in vite.config.js)
 */

const DEFAULT_SETTINGS = {
  usdToPkr: 278,
  gstUnderThreshold: 0.18,
  gstAboveThreshold: 0.25,
  gstThresholdUsd: 500,
  animationEnabled: true,
};

const DEFAULT_PTA_SLABS = [
  { range: "0–30", label: "Entry (0–30 USD)", cnic: 550, passport: 430 },
  { range: "31–100", label: "Low (31–100 USD)", cnic: 4323, passport: 3200 },
  { range: "101–200", label: "Mid (101–200 USD)", cnic: 11561, passport: 9580 },
  { range: "201–350", label: "Upper-mid (201–350 USD)", cnic: 14661, passport: 12200 },
  { range: "351–500", label: "High (351–500 USD)", cnic: 23420, passport: 17800 },
  { range: "501+", label: "Premium (501+ USD)", cnic: 37007, passport: 36870 },
];

const STORAGE_KEY = "phonescanada_pta_settings_v1";
const SLABS_KEY = "phonescanada_pta_slabs_v1";

const BRANDS = ["Apple", "Samsung", "Google", "OnePlus", "Xiaomi", "Vivo", "Oppo", "Huawei", "Other"];

function fmtPKR(n) {
  try {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Number(n || 0));
  } catch {
    return `Rs ${Math.round(Number(n || 0)).toLocaleString()}`;
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

  // Base PKR cost (purchase + shipping converted)
  const basePkr = (cost + ship) * usdToPkr;

  // GST rate depends on declared device cost threshold
  const gstRate = cost >= settings.gstThresholdUsd ? settings.gstAboveThreshold : settings.gstUnderThreshold;
  const gstPkr = basePkr * gstRate;

  const slab = getSlab(cost, slabs);
  const ptaCnic = Number(slab.cnic || 0);
  const ptaPassport = Number(slab.passport || 0);

  // Total taxes by ID type
  const totalTaxCnic = gstPkr + ptaCnic;
  const totalTaxPassport = gstPkr + ptaPassport;

  // Landed cost by ID type
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
    ptaCnic,
    ptaPassport,
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
        {/* Abstract tech-ish polygon mesh */}
        <g fill="none" stroke="url(#pcg)" strokeWidth="1.2" opacity="0.9">
          {Array.from({ length: 26 }).map((_, i) => {
            const x = (i * 43) % 1200;
            const y = ((i * 67) % 800);
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
  // Persisted, editable PTA slabs (so you can update them when PTA rules change)
  const [slabs, setSlabs] = useState(() => {
    try {
      const raw = localStorage.getItem("pc_pta_slabs_v1");
      if (!raw) return DEFAULT_PTA_SLABS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== DEFAULT_PTA_SLABS.length) return DEFAULT_PTA_SLABS;
      return parsed.map((s, idx) => ({ ...DEFAULT_PTA_SLABS[idx], ...s }));
    } catch {
      return DEFAULT_PTA_SLABS;
    }
  });

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Logo upload (stored locally in the browser so Pages can stay static)
  const [logoDataUrl, setLogoDataUrl] = useState(() => {
    try {
      return localStorage.getItem("pc_logo_v1") || "";
    } catch {
      return "";
    }
  });
  const logoInputRef = useRef(null);
  const [device, setDevice] = useState({
    brand: "Apple",
    model: "iPhone 15 Pro Max",
    costUsd: 1199,
    shippingUsd: 30,
    expectedSalePkr: 525000,
  });

  const totals = useMemo(() => calcTotals({ ...device, settings, slabs }), [device, settings, slabs]);

  // Save slabs changes
  React.useEffect(() => {
    try {
      localStorage.setItem("pc_pta_slabs_v1", JSON.stringify(slabs));
    } catch {
      // ignore
    }
  }, [slabs]);

  // Save logo changes
  React.useEffect(() => {
    try {
      if (logoDataUrl) localStorage.setItem("pc_logo_v1", logoDataUrl);
      else localStorage.removeItem("pc_logo_v1");
    } catch {
      // ignore
    }
  }, [logoDataUrl]);

  const exportCSV = () => {
    const rows = [
      ["Brand", device.brand],
      ["Model", device.model],
      ["Cost (USD)", device.costUsd],
      ["Shipping (USD)", device.shippingUsd],
      ["USD→PKR", settings.usdToPkr],
      ["Base PKR", Math.round(totals.basePkr)],
      ["GST Rate", totals.gstRate],
      ["GST PKR", Math.round(totals.gstPkr)],
      ["PTA (CNIC)", totals.ptaCnic],
      ["PTA (Passport)", totals.ptaPassport],
      ["Total Tax (CNIC)", Math.round(totals.totalTaxCnic)],
      ["Total Tax (Passport)", Math.round(totals.totalTaxPassport)],
      ["Landed (CNIC)", Math.round(totals.landedCnic)],
      ["Landed (Passport)", Math.round(totals.landedPassport)],
      ["Expected Sale (PKR)", device.expectedSalePkr],
      ["Profit (CNIC)", Math.round(totals.profitCnic)],
      ["Profit (Passport)", Math.round(totals.profitPassport)],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PhonesCanada-PTA-${device.brand}-${device.model}.csv`.replaceAll(" ", "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogoPick = () => logoInputRef.current?.click();

  const onLogoSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Keep it simple: store as data URL
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const exportPDF = async () => {
    const node = document.getElementById("export-area");
    if (!node) return;
    const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 48;
    const imgH = (canvas.height * imgW) / canvas.width;
    const x = 24;
    const y = 24;
    pdf.addImage(imgData, "PNG", x, y, imgW, Math.min(imgH, pageH - 48));
    pdf.save(`PhonesCanada-PTA-${device.brand}-${device.model}.pdf`.replaceAll(" ", "_"));
  };

  return (
    <div className="pc-wrap">
      <Background enabled={settings.animationEnabled} />

      <div className="pc-shell pc-fadeIn">
        <div className="pc-topbar">
          <div className="pc-brand">
            <div className="pc-logoWrap" title="PhonesCanada">
              <div className="pc-logo">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="PhonesCanada logo" />
                ) : (
                  <span>P</span>
                )}
              </div>

              {/* small upload button overlays the logo */}
              <button
                type="button"
                className="pc-logoUpload"
                onClick={() => fileInputRef.current?.click()}
                title="Upload logo"
              >
                <Upload size={14} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleLogoFile}
              />
            </div>

            <div className="pc-title">
              <h1>PhonesCanada PTA Dashboard</h1>
              <p>PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
            </div>
          </div>
        </div>

        <div className="pc-grid">
          {/* LEFT COLUMN */}
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

              <div style={{ height: 10 }} />
              <p className="pc-note">
                Tip: You can upload the <b>PhonesCanada logo</b> later and replace the “P” icon in the header.
              </p>
            </div>

            <div className="pc-card pad">
              <h2>PTA Tax Slabs</h2>
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
                      <td><span className="pc-pill">{s.range}</span></td>
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

          {/* RIGHT COLUMN */}
          <div className="pc-main">
            <div className="pc-card">
              <div className="pc-toolbar">
                <h3>Inventory Planning</h3>
                <button className="pc-btn" onClick={() => { /* placeholder for multi-device later */ }}>
                  <Plus size={18} /> New Device
                </button>
              </div>

              <div className="pc-planner">
                <div className="pc-planner-grid">
                  <div className="pc-field">
                    <label>Brand</label>
                    <select
                      className="pc-select"
                      value={device.brand}
                      onChange={(e) => setDevice((d) => ({ ...d, brand: e.target.value }))}
                    >
                      {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div className="pc-field">
                    <label>Device / Model Name</label>
                    <input
                      className="pc-input"
                      value={device.model}
                      onChange={(e) => setDevice((d) => ({ ...d, model: e.target.value }))}
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
                      value={device.costUsd}
                      onChange={(e) => setDevice((d) => ({ ...d, costUsd: Number(e.target.value || 0) }))}
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
                      value={device.shippingUsd}
                      onChange={(e) => setDevice((d) => ({ ...d, shippingUsd: Number(e.target.value || 0) }))}
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
                      value={device.expectedSalePkr}
                      onChange={(e) => setDevice((d) => ({ ...d, expectedSalePkr: Number(e.target.value || 0) }))}
                    />
                  </div>
                </div>

                <div style={{ height: 10 }} />
                <p className="pc-note">
                  💡 GST switches automatically based on the <b>{fmtUSD(DEFAULT_SETTINGS.gstThresholdUsd)}</b> threshold:
                  {` ${Math.round(DEFAULT_SETTINGS.gstUnderThreshold * 100)}% below / ${Math.round(DEFAULT_SETTINGS.gstAboveThreshold * 100)}% at or above.`}
                </p>
              </div>
            </div>

            <div className="pc-card" id="export-area">
              <div className="pc-device-head">
                <div className="meta">
                  <div className="brand">{device.brand}</div>
                  <div className="model">{device.model}</div>
                  <div className="pc-note">
                    Slab: <b>{totals.slab.label}</b> • GST: <b>{Math.round(totals.gstRate * 100)}%</b>
                  </div>
                </div>

                <div className="pc-metric">
                  <div className="label">
                    Landed Cost (CNIC)
                    <Tooltip text="Landed = Base (PKR) + GST + PTA (CNIC)." />
                  </div>
                  <div className="value">{fmtPKR(totals.landedCnic)}</div>
                </div>
              </div>

              <div className="pc-device">
                <div>
                  <div className="pc-split">
                    <div className="pc-panel">
                      <h4>CNIC</h4>
                      <div className="pc-kv">
                        <div className="k">Base (Purchase + Ship)</div>
                        <div className="v">{fmtPKR(totals.basePkr)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">
                          GST
                          <Tooltip text={`GST = Base × ${Math.round(totals.gstRate * 100)}%`} />
                        </div>
                        <div className="v">{fmtPKR(totals.gstPkr)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">PTA (CNIC)</div>
                        <div className="v">{fmtPKR(totals.ptaCnic)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">
                          Total Taxes (CNIC)
                          <Tooltip text="Total Taxes (CNIC) = GST + PTA (CNIC)." />
                        </div>
                        <div className="v">{fmtPKR(totals.totalTaxCnic)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">
                          Landed (CNIC)
                          <Tooltip text="Landed (CNIC) = Base + Total Taxes (CNIC)." />
                        </div>
                        <div className="v">{fmtPKR(totals.landedCnic)}</div>
                      </div>

                      <div className="pc-profit">
                        <div>
                          <div className="small">Net Profit (CNIC)</div>
                          <div className="big">{fmtPKR(totals.profitCnic)}</div>
                        </div>
                        <div className="small">{totals.marginCnic.toFixed(1)}% margin</div>
                      </div>
                    </div>

                    <div className="pc-panel">
                      <h4>Passport</h4>
                      <div className="pc-kv">
                        <div className="k">Base (Purchase + Ship)</div>
                        <div className="v">{fmtPKR(totals.basePkr)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">
                          GST
                          <Tooltip text={`GST = Base × ${Math.round(totals.gstRate * 100)}%`} />
                        </div>
                        <div className="v">{fmtPKR(totals.gstPkr)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">PTA (Passport)</div>
                        <div className="v">{fmtPKR(totals.ptaPassport)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">
                          Total Taxes (Passport)
                          <Tooltip text="Total Taxes (Passport) = GST + PTA (Passport)." />
                        </div>
                        <div className="v">{fmtPKR(totals.totalTaxPassport)}</div>
                      </div>
                      <div className="pc-kv">
                        <div className="k">
                          Landed (Passport)
                          <Tooltip text="Landed (Passport) = Base + Total Taxes (Passport)." />
                        </div>
                        <div className="v">{fmtPKR(totals.landedPassport)}</div>
                      </div>

                      <div className="pc-profit" style={{ borderColor: "rgba(59,130,246,.25)", background: "rgba(59,130,246,.10)" }}>
                        <div>
                          <div className="small" style={{ color: "#1e3a8a" }}>Net Profit (Passport)</div>
                          <div className="big">{fmtPKR(totals.profitPassport)}</div>
                        </div>
                        <div className="small" style={{ color: "#1e3a8a" }}>{totals.marginPassport.toFixed(1)}% margin</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 12 }} />
                  <div className="pc-note">
                    🧾 <b>Expected Sale:</b> {fmtPKR(device.expectedSalePkr)} •
                    📦 <b>Purchase+Ship:</b> {fmtUSD(device.costUsd)} + {fmtUSD(device.shippingUsd)} •
                    🔁 <b>USD→PKR:</b> {settings.usdToPkr}
                  </div>
                </div>

              </div>

              <div className="pc-exportBar">
                <div className="pc-exportTitle">
                  Export
                  <span>Download a quick snapshot as CSV or PDF (no charts).</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}

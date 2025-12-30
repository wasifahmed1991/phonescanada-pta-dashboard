import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Trash2, Info } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * PhonesCanada PTA Dashboard — App.jsx (single-file)
 * - Responsive layout
 * - Editable slabs (localStorage)
 * - Devices list (localStorage)
 * - Export CSV + Export PDF (html2canvas + jsPDF)
 * - Animated background (soft blobs + a few geometric shapes)
 * - Logo from /public/phonescanadalogo-web.png (works with GitHub Pages base path)
 */

// -----------------------------
// Constants / helpers
// -----------------------------
const LS_KEYS = {
  SETTINGS: "pc_pta_settings_v3",
  SLABS: "pc_pta_slabs_v3",
  DEVICES: "pc_pta_devices_v3",
};

const BRANDS = ["Select…", "Apple", "Samsung", "Google", "Xiaomi", "Realme", "Oppo", "Vivo", "OnePlus", "Huawei", "Other"];

const DEFAULT_SETTINGS = {
  usdToPkr: 278,
  animationEnabled: true,
  gstThresholdUsd: 500,
  gstUnderThreshold: 0.18,
  gstAboveThreshold: 0.25,
};

const DEFAULT_SLABS = [
  { range: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { range: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { range: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { range: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { range: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { range: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 },
];

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtPKR = (n) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(safeNum(n));

const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(safeNum(n));

function pickSlab(slabs, costPlusShipUsd) {
  const v = safeNum(costPlusShipUsd);
  return slabs.find((s) => v >= s.min && v <= s.max) || slabs[slabs.length - 1];
}

function computeForDevice(device, slabs, settings) {
  const usdToPkr = safeNum(settings.usdToPkr);
  const costUsd = safeNum(device.costUsd);
  const shipUsd = safeNum(device.shippingUsd);
  const salePkr = safeNum(device.expectedSalePkr);

  const totalUsd = costUsd + shipUsd;

  const slab = pickSlab(slabs, totalUsd);

  const gstRate = totalUsd >= safeNum(settings.gstThresholdUsd) ? safeNum(settings.gstAboveThreshold) : safeNum(settings.gstUnderThreshold);

  const basePkr = totalUsd * usdToPkr;
  const gstPkr = basePkr * gstRate;

  const ptaCnic = safeNum(slab.cnic);
  const ptaPassport = safeNum(slab.passport);

  const landedCnic = basePkr + gstPkr + ptaCnic;
  const landedPassport = basePkr + gstPkr + ptaPassport;

  const profitCnic = salePkr - landedCnic;
  const profitPassport = salePkr - landedPassport;

  const marginCnic = salePkr > 0 ? (profitCnic / salePkr) * 100 : 0;
  const marginPassport = salePkr > 0 ? (profitPassport / salePkr) * 100 : 0;

  const best =
    profitPassport > profitCnic
      ? { label: "Passport", profit: profitPassport }
      : { label: "CNIC", profit: profitCnic };

  return {
    slab,
    gstRate,
    basePkr,
    gstPkr,
    ptaCnic,
    ptaPassport,
    landedCnic,
    landedPassport,
    profitCnic,
    profitPassport,
    marginCnic,
    marginPassport,
    best,
  };
}

// -----------------------------
// Small UI components
// -----------------------------
function Tooltip({ text }) {
  return (
    <span className="pc-tip" aria-label={text} title={text}>
      <Info size={14} />
    </span>
  );
}

function Toggle({ on, onToggle, label, sublabel }) {
  return (
    <div className="pc-toggleRow">
      <div className="pc-toggleText">
        <div className="pc-toggleLabel">{label}</div>
        {sublabel ? <div className="pc-toggleSub">{sublabel}</div> : null}
      </div>

      <button
        type="button"
        className={`pc-switchBtn ${on ? "on" : ""}`}
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        title="Toggle"
      >
        <span className="pc-switchKnob" />
      </button>
    </div>
  );
}

// -----------------------------
// App
// -----------------------------
export default function App() {
  const exportRef = useRef(null);

  // Logo from public (GitHub Pages friendly)
  const logoUrl = useMemo(() => `${import.meta.env.BASE_URL}phonescanadalogo-web.png`, []);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [slabs, setSlabs] = useState(DEFAULT_SLABS);
  const [devices, setDevices] = useState([]);

  const [form, setForm] = useState({
    brand: "Select…",
    model: "",
    costUsd: "",
    shippingUsd: "",
    expectedSalePkr: "",
  });

  // Load from localStorage
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEYS.SETTINGS) || "null");
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
    } catch {}

    try {
      const t = JSON.parse(localStorage.getItem(LS_KEYS.SLABS) || "null");
      if (Array.isArray(t) && t.length) setSlabs(t);
    } catch {}

    try {
      const d = JSON.parse(localStorage.getItem(LS_KEYS.DEVICES) || "null");
      if (Array.isArray(d)) setDevices(d);
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.SLABS, JSON.stringify(slabs));
  }, [slabs]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.DEVICES, JSON.stringify(devices));
  }, [devices]);

  const previewTotals = useMemo(() => {
    return computeForDevice(
      {
        brand: form.brand,
        model: form.model || "—",
        costUsd: safeNum(form.costUsd),
        shippingUsd: safeNum(form.shippingUsd),
        expectedSalePkr: safeNum(form.expectedSalePkr),
      },
      slabs,
      settings
    );
  }, [form, slabs, settings]);

  const previewBestProfit = previewTotals.best.profit;
  const previewBestLabel = previewTotals.best.label;

  const addDevice = () => {
    const brand = form.brand;
    const model = (form.model || "").trim();

    if (!brand || brand === "Select…" || !model) return;

    const newDevice = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      brand,
      model,
      costUsd: safeNum(form.costUsd),
      shippingUsd: safeNum(form.shippingUsd),
      expectedSalePkr: safeNum(form.expectedSalePkr),
      createdAt: Date.now(),
    };

    setDevices((prev) => [newDevice, ...prev]);

    // Clear form after adding (your requirement)
    setForm({
      brand: "Select…",
      model: "",
      costUsd: "",
      shippingUsd: "",
      expectedSalePkr: "",
    });
  };

  const deleteDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id));

  const exportCSV = () => {
    const rows = [];
    rows.push([
      "Brand",
      "Model",
      "Cost USD",
      "Ship USD",
      "USD→PKR",
      "Sale PKR",
      "Slab",
      "GST %",
      "Landed CNIC",
      "Profit CNIC",
      "Margin CNIC %",
      "Landed Passport",
      "Profit Passport",
      "Margin Passport %",
    ]);

    devices.forEach((d) => {
      const t = computeForDevice(d, slabs, settings);
      rows.push([
        d.brand,
        d.model,
        d.costUsd,
        d.shippingUsd,
        settings.usdToPkr,
        d.expectedSalePkr,
        t.slab.range,
        Math.round(t.gstRate * 100),
        Math.round(t.landedCnic),
        Math.round(t.profitCnic),
        t.marginCnic.toFixed(1),
        Math.round(t.landedPassport),
        Math.round(t.profitPassport),
        t.marginPassport.toFixed(1),
      ]);
    });

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const v = String(cell ?? "");
            if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replaceAll('"', '""')}"`;
            return v;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "phonescanada-pta-dashboard.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };

  const exportPDF = async () => {
    // Robust PDF export: render a dedicated report view, then capture it.
    const node = exportRef.current;
    if (!node) return;

    try {
      // Ensure fonts/paint complete
      await new Promise((r) => setTimeout(r, 60));

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let position = 0;
      let heightLeft = imgHeight;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("PhonesCanada-PTA-Report.pdf");
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("PDF export failed. Check console for details.");
    }
  };

  // Derived
  const deviceCount = devices.length;

  return (
    <div className={`pc-root ${settings.animationEnabled ? "animOn" : "animOff"}`}>
      <style>{css}</style>

      {/* Background */}
      <div className="pc-bg" aria-hidden="true">
        <div className="pc-blob b1" />
        <div className="pc-blob b2" />
        <div className="pc-blob b3" />
        <div className="pc-blob b4" />

        {/* A few geometric shapes (subtle) */}
        <div className="pc-geom g1" />
        <div className="pc-geom g2" />
        <div className="pc-geom g3" />
        <div className="pc-geom g4" />
      </div>

      <div className="pc-wrap">
        {/* Header */}
        <header className="pc-header">
          <div className="pc-headLeft">
            <div className="pc-logoBox" title="PhonesCanada">
              <img
                src={logoUrl}
                alt="PhonesCanada logo"
                onError={(e) => {
                  // If logo fails, show fallback
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="pc-logoFallback">P</div>
            </div>

            <div className="pc-headTitle">
              <h1>PhonesCanada PTA Dashboard</h1>
              <p>PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
            </div>
          </div>
        </header>

        {/* Main grid */}
        <div className="pc-grid">
          {/* Left column */}
          <aside className="pc-left">
            <section className="pc-card pc-pad">
              <h2>System Preferences</h2>

              <div className="pc-field">
                <label>
                  USD Rate (PKR) <Tooltip text="Conversion rate used for (Cost + Shipping) USD → PKR." />
                </label>
                <input
                  className="pc-input"
                  type="number"
                  value={settings.usdToPkr}
                  onChange={(e) => setSettings((s) => ({ ...s, usdToPkr: safeNum(e.target.value) }))}
                />
              </div>

              <div className="pc-divider" />

              <Toggle
                on={settings.animationEnabled}
                onToggle={() => setSettings((s) => ({ ...s, animationEnabled: !s.animationEnabled }))}
                label="Animations"
                sublabel="Smooth blobs + prism outlines"
              />

              <div className="pc-note">
                💡 GST auto-switches at <b>${safeNum(settings.gstThresholdUsd)}</b>:{" "}
                {Math.round(settings.gstUnderThreshold * 100)}% below / {Math.round(settings.gstAboveThreshold * 100)}% at or above.
              </div>
            </section>

            <section className="pc-card pc-pad">
              <h2>PTA Tax Slabs (Editable)</h2>

              <div className="pc-slabsWrap">
                <div className="pc-slabsHead">
                  <div className="pc-colRange">Value Range (USD)</div>
                  <div className="pc-colNum">CNIC</div>
                  <div className="pc-colNum">Passport</div>
                </div>

                {slabs.map((s, idx) => (
                  <div className="pc-slabRow" key={s.range}>
                    <div className="pc-colRange">
                      <span className="pc-rangePill">{s.range}</span>
                    </div>

                    <div className="pc-colNum">
                      <input
                        className="pc-slabInput"
                        type="number"
                        value={s.cnic}
                        onChange={(e) => {
                          const v = safeNum(e.target.value);
                          setSlabs((prev) => prev.map((row, i) => (i === idx ? { ...row, cnic: v } : row)));
                        }}
                      />
                    </div>

                    <div className="pc-colNum">
                      <input
                        className="pc-slabInput"
                        type="number"
                        value={s.passport}
                        onChange={(e) => {
                          const v = safeNum(e.target.value);
                          setSlabs((prev) => prev.map((row, i) => (i === idx ? { ...row, passport: v } : row)));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pc-note subtle">Saved automatically on this device (localStorage).</div>
            </section>
          </aside>

          {/* Right column */}
          <main className="pc-right">
            {/* Inventory Planning */}
            <section className="pc-card pc-pad">
              <div className="pc-rowHead">
                <div>
                  <h2>Inventory Planning</h2>
                  <p className="pc-sub">Add a device and instantly compare CNIC vs Passport.</p>
                </div>

                <button className="pc-btn" onClick={addDevice}>
                  <Plus size={18} />
                  Add Device
                </button>
              </div>

              <div className="pc-formGrid">
                <div className="pc-field">
                  <label>Brand</label>
                  <select className="pc-select" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}>
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pc-field grow2">
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
                    Purchase Cost (USD) <Tooltip text="Your buy price per device (USD)." />
                  </label>
                  <input
                    className="pc-input"
                    type="number"
                    value={form.costUsd}
                    onChange={(e) => setForm((f) => ({ ...f, costUsd: e.target.value }))}
                    placeholder="e.g. 1199"
                  />
                </div>

                <div className="pc-field">
                  <label>
                    Shipping (USD) <Tooltip text="Per-unit shipping cost (USD)." />
                  </label>
                  <input
                    className="pc-input"
                    type="number"
                    value={form.shippingUsd}
                    onChange={(e) => setForm((f) => ({ ...f, shippingUsd: e.target.value }))}
                    placeholder="e.g. 30"
                  />
                </div>

                <div className="pc-field grow2">
                  <label>
                    Expected Selling Price (PKR) <Tooltip text="Target selling price in PKR." />
                  </label>
                  <input
                    className="pc-input"
                    type="number"
                    value={form.expectedSalePkr}
                    onChange={(e) => setForm((f) => ({ ...f, expectedSalePkr: e.target.value }))}
                    placeholder="e.g. 525000"
                  />
                </div>

                {/* Profit/Loss preview — fixed alignment */}
                <div className="pc-field pc-preview">
                  <label>Profit / Loss (Best)</label>
                  <div className={`pc-previewBox ${previewBestProfit >= 0 ? "good" : "bad"}`}>
                    <span className="pc-previewTag">{previewBestLabel}</span>
                    <span className="pc-previewVal">{fmtPKR(previewBestProfit)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Devices */}
            <section className="pc-card pc-pad pc-devices">
              <div className="pc-devHead">
                <h2>Devices</h2>
                <div className="pc-devMeta">{deviceCount} device(s)</div>
              </div>

              <div className="pc-deviceGrid">
                {devices.map((d) => {
                  const t = computeForDevice(d, slabs, settings);

                  const cnicGood = t.profitCnic >= 0;
                  const passGood = t.profitPassport >= 0;

                  return (
                    <article className="pc-deviceCard" key={d.id}>
                      <button className="pc-del" onClick={() => deleteDevice(d.id)} title="Delete device">
                        <Trash2 size={16} />
                      </button>

                      <div className="pc-deviceTop">
                        <div className="pc-brandSmall">{(d.brand || "").toUpperCase()}</div>
                        <div className="pc-model">{d.model}</div>

                        <div className="pc-tags">
                          <span className="pc-tag">Slab: {t.slab.range} USD</span>
                          <span className="pc-tag">GST: {Math.round(t.gstRate * 100)}%</span>
                        </div>
                      </div>

                      <div className="pc-splits">
                        <div className="pc-mini">
                          <div className="pc-miniHead">
                            <span className="pc-miniTitle">CNIC</span>
                            <span className={`pc-chip ${cnicGood ? "good" : "bad"}`}>
                              {cnicGood ? "PROFIT" : "LOSS"} • {fmtPKR(t.profitCnic)}
                            </span>
                          </div>

                          <div className="pc-miniRow">
                            <span>Landed</span>
                            <span className="pc-num">{fmtPKR(t.landedCnic)}</span>
                          </div>
                          <div className="pc-miniRow">
                            <span>Margin</span>
                            <span className="pc-num">{t.marginCnic.toFixed(1)}%</span>
                          </div>
                        </div>

                        <div className="pc-mini">
                          <div className="pc-miniHead">
                            <span className="pc-miniTitle">PASSPORT</span>
                            <span className={`pc-chip ${passGood ? "good" : "bad"}`}>
                              {passGood ? "PROFIT" : "LOSS"} • {fmtPKR(t.profitPassport)}
                            </span>
                          </div>

                          <div className="pc-miniRow">
                            <span>Landed</span>
                            <span className="pc-num">{fmtPKR(t.landedPassport)}</span>
                          </div>
                          <div className="pc-miniRow">
                            <span>Margin</span>
                            <span className="pc-num">{t.marginPassport.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="pc-bottom">
                        <div className="pc-bottomRow">
                          <span>Sale</span>
                          <span className="pc-num">{fmtPKR(d.expectedSalePkr)}</span>
                        </div>
                        <div className="pc-bottomRow">
                          <span>Cost+Ship</span>
                          <span className="pc-num">
                            {fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)}
                          </span>
                        </div>
                        <div className="pc-bottomRow">
                          <span>USD→PKR</span>
                          <span className="pc-num">{safeNum(settings.usdToPkr)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Export bar */}
              <div className="pc-export">
                <div className="pc-exportText">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-exportBtns">
                  <button className="pc-btn ghost" onClick={exportCSV}>
                    <Download size={18} /> CSV
                  </button>
                  <button className="pc-btn ghost" onClick={exportPDF}>
                    <Download size={18} /> PDF
                  </button>
                </div>
              </div>
            </section>

            {/* Hidden PDF report view (clean & pretty) */}
            <div className="pc-pdfMount" aria-hidden="true">
              <div ref={exportRef} className="pc-report">
                <div className="pc-reportHeader">
                  <div className="pc-reportLogo">
                    <img src={logoUrl} alt="" />
                  </div>
                  <div className="pc-reportTitle">
                    <div className="h">PhonesCanada PTA Dashboard — Report</div>
                    <div className="s">
                      USD/PKR Rate: <b>{safeNum(settings.usdToPkr)}</b> • GST:{" "}
                      <b>
                        {Math.round(settings.gstUnderThreshold * 100)}% / {Math.round(settings.gstAboveThreshold * 100)}%
                      </b>{" "}
                      (threshold ${safeNum(settings.gstThresholdUsd)})
                    </div>
                  </div>
                </div>

                <div className="pc-reportList">
                  {devices.map((d, i) => {
                    const t = computeForDevice(d, slabs, settings);
                    const cnicGood = t.profitCnic >= 0;
                    const passGood = t.profitPassport >= 0;

                    return (
                      <div className="pc-reportCard" key={d.id}>
                        <div className="pc-reportCardTop">
                          <div className="pc-reportIdx">{i + 1}.</div>
                          <div className="pc-reportName">
                            <div className="nm">
                              {d.brand} {d.model}
                            </div>
                            <div className="meta">
                              Slab: {t.slab.range} USD • GST: {Math.round(t.gstRate * 100)}%
                            </div>
                          </div>
                          <div className="pc-reportSale">{fmtPKR(d.expectedSalePkr)}</div>
                        </div>

                        <div className="pc-reportGrid">
                          <div className="pc-reportCol">
                            <div className="pc-reportBadge">CNIC</div>
                            <div className="pc-reportRow">
                              <span>Base (Cost+Ship)</span>
                              <span>
                                {fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)} (USD→PKR {safeNum(settings.usdToPkr)})
                              </span>
                            </div>
                            <div className="pc-reportRow">
                              <span>Landed</span>
                              <span>{fmtPKR(t.landedCnic)}</span>
                            </div>
                            <div className="pc-reportRow">
                              <span>Profit</span>
                              <span className={cnicGood ? "good" : "bad"}>{fmtPKR(t.profitCnic)}</span>
                            </div>
                            <div className="pc-reportRow">
                              <span>Margin</span>
                              <span>{t.marginCnic.toFixed(1)}%</span>
                            </div>
                          </div>

                          <div className="pc-reportCol">
                            <div className="pc-reportBadge">PASSPORT</div>
                            <div className="pc-reportRow">
                              <span>Base (Cost+Ship)</span>
                              <span>
                                {fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)} (USD→PKR {safeNum(settings.usdToPkr)})
                              </span>
                            </div>
                            <div className="pc-reportRow">
                              <span>Landed</span>
                              <span>{fmtPKR(t.landedPassport)}</span>
                            </div>
                            <div className="pc-reportRow">
                              <span>Profit</span>
                              <span className={passGood ? "good" : "bad"}>{fmtPKR(t.profitPassport)}</span>
                            </div>
                            <div className="pc-reportRow">
                              <span>Margin</span>
                              <span>{t.marginPassport.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pc-reportFooter">Generated by PhonesCanada PTA Dashboard</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// CSS (single file)
// -----------------------------
const css = `
/* Base */
:root{
  --bgA:#f7d6d8;
  --bgB:#dbeafe;
  --bgC:#d1fae5;
  --card: rgba(255,255,255,.72);
  --card2: rgba(255,255,255,.86);
  --stroke: rgba(15,23,42,.10);
  --text: #0f172a;
  --muted: rgba(15,23,42,.62);
  --shadow: 0 18px 60px rgba(15,23,42,.14);
  --shadow2: 0 12px 28px rgba(15,23,42,.12);
  --radius: 24px;
  --radius2: 18px;
  --goodBg: rgba(16,185,129,.14);
  --goodBr: rgba(16,185,129,.35);
  --goodTx: #065f46;
  --badBg: rgba(239,68,68,.12);
  --badBr: rgba(239,68,68,.35);
  --badTx: #7f1d1d;
}

/* Root */
.pc-root{
  min-height:100vh;
  color:var(--text);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  position:relative;
  overflow-x:hidden;
}
.pc-wrap{
  max-width: 1180px;
  margin: 0 auto;
  padding: 26px 16px 34px;
  position:relative;
  z-index:2;
}

/* Background */
.pc-bg{
  position:fixed;
  inset:0;
  z-index:0;
  background: radial-gradient(1100px 700px at 15% 20%, var(--bgA), transparent 60%),
              radial-gradient(900px 600px at 90% 30%, var(--bgB), transparent 58%),
              radial-gradient(900px 700px at 50% 95%, var(--bgC), transparent 60%),
              linear-gradient(135deg, rgba(255,255,255,.60), rgba(255,255,255,.35));
}
.pc-blob{
  position:absolute;
  border-radius: 999px;
  filter: blur(18px);
  opacity:.55;
  transform: translate3d(0,0,0);
  pointer-events:none;
}
.pc-blob.b1{ width:420px; height:420px; left:-80px; top:60px; background: radial-gradient(circle at 30% 30%, rgba(255,85,85,.45), transparent 60%); }
.pc-blob.b2{ width:520px; height:520px; right:-120px; top:120px; background: radial-gradient(circle at 30% 30%, rgba(59,130,246,.45), transparent 60%); }
.pc-blob.b3{ width:520px; height:520px; left:22%; bottom:-160px; background: radial-gradient(circle at 40% 40%, rgba(16,185,129,.35), transparent 60%); }
.pc-blob.b4{ width:360px; height:360px; right:16%; bottom:18%; background: radial-gradient(circle at 40% 40%, rgba(168,85,247,.25), transparent 65%); }

/* Geom shapes (subtle) */
.pc-geom{
  position:absolute;
  width:120px;
  height:120px;
  border: 1.6px solid rgba(15,23,42,.10);
  border-radius: 28px;
  transform: rotate(18deg);
  opacity:.35;
  filter: drop-shadow(0 10px 24px rgba(15,23,42,.08));
  pointer-events:none;
}
.pc-geom.g1{ left: 8%; top: 58%; width: 90px; height: 90px; border-radius: 22px; }
.pc-geom.g2{ left: 74%; top: 14%; width: 140px; height: 140px; border-radius: 34px; transform: rotate(32deg); }
.pc-geom.g3{ left: 52%; top: 70%; width: 110px; height: 110px; border-radius: 30px; transform: rotate(12deg); }
.pc-geom.g4{ left: 22%; top: 10%; width: 80px; height: 80px; border-radius: 22px; transform: rotate(40deg); }

/* Animation toggle */
.animOff .pc-blob,
.animOff .pc-geom{ animation: none !important; }
.animOn .pc-blob.b1{ animation: float1 7s ease-in-out infinite; }
.animOn .pc-blob.b2{ animation: float2 8s ease-in-out infinite; }
.animOn .pc-blob.b3{ animation: float3 9s ease-in-out infinite; }
.animOn .pc-blob.b4{ animation: float4 10s ease-in-out infinite; }
.animOn .pc-geom.g1{ animation: spin1 6s ease-in-out infinite; }
.animOn .pc-geom.g2{ animation: spin2 7s ease-in-out infinite; }
.animOn .pc-geom.g3{ animation: spin3 8s ease-in-out infinite; }
.animOn .pc-geom.g4{ animation: spin4 9s ease-in-out infinite; }

@keyframes float1{ 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(22px,14px) scale(1.03);} }
@keyframes float2{ 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(-26px,12px) scale(1.04);} }
@keyframes float3{ 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(10px,-18px) scale(1.03);} }
@keyframes float4{ 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(-14px,-10px) scale(1.03);} }
@keyframes spin1{ 0%,100%{ transform: rotate(18deg) translate(0,0);} 50%{ transform: rotate(28deg) translate(10px,-10px);} }
@keyframes spin2{ 0%,100%{ transform: rotate(32deg) translate(0,0);} 50%{ transform: rotate(20deg) translate(-10px,8px);} }
@keyframes spin3{ 0%,100%{ transform: rotate(12deg) translate(0,0);} 50%{ transform: rotate(22deg) translate(12px,10px);} }
@keyframes spin4{ 0%,100%{ transform: rotate(40deg) translate(0,0);} 50%{ transform: rotate(30deg) translate(-10px,10px);} }

/* Header */
.pc-header{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px 18px;
  backdrop-filter: blur(10px);
}
.pc-headLeft{
  display:flex;
  gap:14px;
  align-items:center;
  min-width:0;
}
.pc-logoBox{
  width: 64px;
  height: 64px;
  border-radius: 18px;
  border: 1px solid var(--stroke);
  background: linear-gradient(135deg, rgba(255,85,85,.26), rgba(59,130,246,.18));
  box-shadow: var(--shadow2);
  display:grid;
  place-items:center;
  overflow:hidden;
  position:relative;
  flex: 0 0 auto;
}
.pc-logoBox img{
  width: 86%;
  height: 86%;
  object-fit: contain;
  display:block;
}
.pc-logoFallback{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  font-weight: 800;
  color: rgba(15,23,42,.75);
  font-size: 20px;
}
.pc-headTitle{ min-width:0; }
.pc-headTitle h1{
  margin:0;
  font-size: 22px;
  letter-spacing: -0.02em;
}
.pc-headTitle p{
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

/* Grid */
.pc-grid{
  margin-top: 18px;
  display:grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
}
@media (max-width: 980px){
  .pc-grid{ grid-template-columns: 1fr; }
}

/* Cards */
.pc-card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
}
.pc-pad{ padding: 18px; }
.pc-card h2{
  margin: 0 0 10px;
  font-size: 14px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(15,23,42,.70);
}
.pc-sub{
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

/* Fields */
.pc-field{ display:flex; flex-direction:column; gap:8px; min-width:0; }
.pc-field label{
  font-size: 13px;
  color: rgba(15,23,42,.75);
  display:flex;
  align-items:center;
  gap:8px;
}
.pc-input, .pc-select, .pc-slabInput{
  width:100%;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.85);
  padding: 12px 12px;
  font-size: 15px;
  outline:none;
}
.pc-input:focus, .pc-select:focus, .pc-slabInput:focus{
  border-color: rgba(59,130,246,.40);
  box-shadow: 0 0 0 4px rgba(59,130,246,.10);
}
.pc-divider{
  height: 12px;
}
.pc-note{
  margin-top: 12px;
  color: rgba(15,23,42,.62);
  font-size: 13px;
  line-height: 1.35;
}
.pc-note.subtle{
  opacity:.75;
  margin-top: 10px;
}

/* Tooltip */
.pc-tip{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.12);
  background: rgba(255,255,255,.7);
  color: rgba(15,23,42,.62);
}

/* Toggle row */
.pc-toggleRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
}
.pc-toggleText{ display:flex; flex-direction:column; gap:2px; }
.pc-toggleLabel{ font-size: 14px; font-weight: 650; }
.pc-toggleSub{ font-size: 12px; color: var(--muted); }

.pc-switchBtn{
  width: 56px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.8);
  position:relative;
  cursor:pointer;
  box-shadow: 0 10px 22px rgba(15,23,42,.10);
}
.pc-switchBtn.on{
  background: linear-gradient(135deg, rgba(255,85,85,.78), rgba(255,85,85,.55));
  border-color: rgba(255,85,85,.35);
}
.pc-switchKnob{
  position:absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: white;
  border: 1px solid rgba(15,23,42,.12);
  box-shadow: 0 10px 18px rgba(15,23,42,.18);
  transition: transform .20s ease;
}
.pc-switchBtn.on .pc-switchKnob{
  transform: translateX(24px);
}

/* Slabs */
.pc-slabsWrap{
  background: rgba(255,255,255,.50);
  border: 1px solid rgba(15,23,42,.10);
  border-radius: 18px;
  overflow:hidden;
}
.pc-slabsHead, .pc-slabRow{
  display:grid;
  grid-template-columns: 1.1fr 1fr 1fr;
  gap: 10px;
  padding: 12px;
  align-items:center;
}
.pc-slabsHead{
  background: rgba(255,255,255,.55);
  border-bottom: 1px solid rgba(15,23,42,.08);
  font-size: 12px;
  letter-spacing: .10em;
  text-transform: uppercase;
  color: rgba(15,23,42,.62);
}
.pc-slabRow{
  border-bottom: 1px solid rgba(15,23,42,.08);
}
.pc-slabRow:last-child{ border-bottom:none; }
.pc-colRange{ min-width:0; }
.pc-colNum{ min-width:0; }
.pc-rangePill{
  display:inline-flex;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.75);
  border: 1px solid rgba(15,23,42,.10);
  font-weight: 650;
  color: rgba(15,23,42,.72);
}
.pc-slabInput{
  border-radius: 14px;
  padding: 10px 10px;
  background: rgba(255,255,255,.82);
  text-align:center;
}

/* Planner */
.pc-rowHead{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 12px;
}
.pc-btn{
  display:inline-flex;
  align-items:center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,85,85,.32);
  background: linear-gradient(135deg, rgba(255,85,85,.92), rgba(255,85,85,.64));
  color:white;
  font-weight: 700;
  cursor:pointer;
  box-shadow: 0 16px 30px rgba(255,85,85,.25);
}
.pc-btn:hover{ filter: brightness(1.02); }
.pc-btn.ghost{
  background: rgba(255,255,255,.80);
  color: rgba(15,23,42,.86);
  border: 1px solid rgba(15,23,42,.12);
  box-shadow: 0 10px 22px rgba(15,23,42,.10);
}
.pc-btn.ghost:hover{ background: rgba(255,255,255,.92); }

/* Form grid */
.pc-formGrid{
  margin-top: 14px;
  display:grid;
  grid-template-columns: 1.1fr 2fr 1fr 1fr 2fr 1.2fr;
  gap: 12px;
  align-items:end;
}
.pc-formGrid .grow2{ grid-column: span 2; }
.pc-preview{ grid-column: span 1; }
@media (max-width: 1100px){
  .pc-formGrid{ grid-template-columns: 1fr 1.5fr 1fr 1fr; }
  .pc-formGrid .grow2{ grid-column: span 2; }
  .pc-preview{ grid-column: span 2; }
}
@media (max-width: 680px){
  .pc-formGrid{ grid-template-columns: 1fr; }
  .pc-formGrid .grow2, .pc-preview{ grid-column: span 1; }
}

.pc-previewBox{
  width:100%;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,.14);
  background: rgba(255,255,255,.85);
  padding: 10px 12px;
  display:flex;
  gap: 10px;
  align-items:center;
  justify-content:space-between;
  min-height: 44px;
}
.pc-previewBox.good{ background: var(--goodBg); border-color: var(--goodBr); }
.pc-previewBox.bad{ background: var(--badBg); border-color: var(--badBr); }
.pc-previewTag{
  display:inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.70);
  font-weight: 750;
  font-size: 12px;
  color: rgba(15,23,42,.75);
}
.pc-previewVal{
  font-weight: 850;
  font-size: 14px;
  color: rgba(15,23,42,.86);
  text-align:right;
  white-space: nowrap;
}

/* Devices */
.pc-devices{ margin-top: 16px; }
.pc-devHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom: 12px;
}
.pc-devHead h2{
  margin:0;
  font-size: 34px;
  letter-spacing: -.02em;
  text-transform:none;
  color: rgba(15,23,42,.92);
}
.pc-devMeta{ color: var(--muted); }

.pc-deviceGrid{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 860px){
  .pc-deviceGrid{ grid-template-columns: 1fr; }
}

.pc-deviceCard{
  position:relative;
  background: rgba(255,255,255,.82);
  border: 1px solid rgba(15,23,42,.10);
  border-radius: 22px;
  box-shadow: 0 14px 32px rgba(15,23,42,.12);
  overflow:hidden;
  padding: 14px;
}
.pc-del{
  position:absolute;
  top: 12px;
  right: 12px;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.80);
  display:grid;
  place-items:center;
  cursor:pointer;
}
.pc-deviceTop{ padding-right: 56px; }
.pc-brandSmall{
  letter-spacing: .22em;
  text-transform: uppercase;
  font-size: 12px;
  color: rgba(15,23,42,.52);
  font-weight: 800;
}
.pc-model{
  margin-top: 4px;
  font-size: 22px;
  font-weight: 850;
  letter-spacing: -.02em;
}
.pc-tags{
  margin-top: 8px;
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pc-tag{
  display:inline-flex;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(15,23,42,.04);
  border: 1px solid rgba(15,23,42,.10);
  font-size: 13px;
  color: rgba(15,23,42,.70);
  font-weight: 650;
}

/* Split cards */
.pc-splits{
  margin-top: 12px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.pc-mini{
  border-radius: 18px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.68);
  padding: 12px;
  min-width:0;
}
.pc-miniHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  min-width:0;
}
.pc-miniTitle{
  font-weight: 900;
  letter-spacing: .24em;
  font-size: 12px;
  color: rgba(15,23,42,.60);
  white-space: nowrap;
}
.pc-chip{
  display:inline-flex;
  align-items:center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  font-weight: 850;
  font-size: 12px;
  min-width:0;
  text-align:right;
  line-height: 1.15;
  white-space: normal; /* allow wrap so it won't cut */
}
.pc-chip.good{ background: var(--goodBg); border-color: var(--goodBr); color: var(--goodTx); }
.pc-chip.bad{ background: var(--badBg); border-color: var(--badBr); color: var(--badTx); }

.pc-miniRow{
  margin-top: 12px;
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap: 10px;
  color: rgba(15,23,42,.70);
  font-weight: 650;
  min-width:0;
}
.pc-num{
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  color: rgba(15,23,42,.90);
  text-align:right;
  min-width:0;
  overflow: visible;
  word-break: break-word;
  font-size: 15px;
}
.pc-miniRow .pc-num{
  font-size: 15px;
}
@media (max-width: 460px){
  .pc-miniRow .pc-num{ font-size: 14px; }
  .pc-model{ font-size: 20px; }
}

/* Bottom */
.pc-bottom{
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(15,23,42,.08);
  display:grid;
  gap: 8px;
}
.pc-bottomRow{
  display:flex;
  justify-content:space-between;
  gap: 10px;
  color: rgba(15,23,42,.65);
  font-weight: 650;
}
.pc-bottomRow .pc-num{ font-size: 14px; }

/* Export bar */
.pc-export{
  margin-top: 12px;
  padding: 14px 14px;
  border-radius: 20px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.70);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
}
.pc-exportText{
  color: rgba(15,23,42,.70);
  font-weight: 650;
}
.pc-exportBtns{
  display:flex;
  gap: 10px;
}

/* Hidden PDF mount */
.pc-pdfMount{
  position:absolute;
  left:-10000px;
  top:-10000px;
  width: 840px; /* approx A4 width in px for our report */
}

/* Report styles */
.pc-report{
  background: #ffffff;
  color: #0f172a;
  padding: 26px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
.pc-reportHeader{
  display:flex;
  align-items:center;
  gap: 14px;
  border-bottom: 1px solid rgba(15,23,42,.12);
  padding-bottom: 14px;
  margin-bottom: 16px;
}
.pc-reportLogo{
  width: 70px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(255,85,85,.18), rgba(59,130,246,.12));
  border: 1px solid rgba(15,23,42,.10);
  display:grid;
  place-items:center;
  overflow:hidden;
}
.pc-reportLogo img{
  width: 90%;
  height: 90%;
  object-fit: contain;
}
.pc-reportTitle .h{
  font-weight: 900;
  font-size: 18px;
}
.pc-reportTitle .s{
  margin-top: 6px;
  color: rgba(15,23,42,.65);
  font-size: 12px;
}

.pc-reportList{
  display:flex;
  flex-direction:column;
  gap: 12px;
}
.pc-reportCard{
  border: 1px solid rgba(15,23,42,.10);
  border-radius: 14px;
  background: rgba(15,23,42,.03);
  padding: 14px;
}
.pc-reportCardTop{
  display:grid;
  grid-template-columns: 40px 1fr 160px;
  gap: 10px;
  align-items:start;
}
.pc-reportIdx{
  font-weight: 900;
  font-size: 14px;
  color: rgba(15,23,42,.70);
}
.pc-reportName .nm{
  font-weight: 900;
  font-size: 14px;
}
.pc-reportName .meta{
  margin-top: 4px;
  font-size: 12px;
  color: rgba(15,23,42,.60);
}
.pc-reportSale{
  text-align:right;
  font-weight: 900;
  font-size: 13px;
}

.pc-reportGrid{
  margin-top: 12px;
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.pc-reportCol{
  background: rgba(255,255,255,.72);
  border: 1px solid rgba(15,23,42,.08);
  border-radius: 12px;
  padding: 12px;
}
.pc-reportBadge{
  display:inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.85);
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .18em;
  color: rgba(15,23,42,.70);
}
.pc-reportRow{
  margin-top: 10px;
  display:flex;
  justify-content:space-between;
  gap: 10px;
  font-size: 12px;
  color: rgba(15,23,42,.78);
}
.pc-reportRow span:last-child{
  text-align:right;
  font-weight: 800;
}
.pc-reportRow .good{ color: #065f46; }
.pc-reportRow .bad{ color: #7f1d1d; }

.pc-reportFooter{
  margin-top: 18px;
  padding-top: 10px;
  border-top: 1px solid rgba(15,23,42,.12);
  font-size: 11px;
  color: rgba(15,23,42,.55);
}
`;

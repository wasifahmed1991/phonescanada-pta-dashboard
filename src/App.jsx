// App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * PhonesCanada PTA Dashboard (single-file App.jsx)
 * Fixes included (per your last notes):
 * - Logo shows properly in WEB header (public/phonescanadalogo-web.png)
 * - Logo shows properly in PDF export (embedded in export header, correct sizing)
 * - Inventory Planning: sensible field widths (Model wide, cost/ship small), aligned grid, card stays in container
 * - Profit/Loss (Best): no “Passport” word inside pill; note shown under subtitle that Best assumes Passport
 * - Devices section: lighter font-weight, two inner sections (CNIC then Passport) stacked to avoid truncation
 * - PTA slabs: extra bottom padding so it doesn’t touch
 * - Background: visible, subtle moving “prism/paragon” objects (not too many), toggle-able
 *
 * Assumptions:
 * - Logo file exists at: /public/phonescanadalogo-web.png
 * - jsPDF and html2canvas are installed (common in your repo for PDF export).
 */

function clampNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatInt(n) {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString("en-US");
}

function formatPkr(n) {
  const x = Math.round(Number(n) || 0);
  return `Rs ${x.toLocaleString("en-US")}`;
}

function formatUsd(n) {
  const x = Number(n) || 0;
  // keep no decimals in your UI for simplicity
  return `$${Math.round(x).toLocaleString("en-US")}`;
}

function getBaseUrl() {
  // Works on Vite / GitHub Pages base path too
  const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

const DEFAULT_SLABS = [
  { rangeLabel: "0–30 USD", min: 0, max: 30, gst: 0.18, cnic: 550, passport: 430 },
  { rangeLabel: "31–100 USD", min: 31, max: 100, gst: 0.18, cnic: 4323, passport: 3200 },
  { rangeLabel: "101–200 USD", min: 101, max: 200, gst: 0.18, cnic: 11561, passport: 9580 },
  { rangeLabel: "201–350 USD", min: 201, max: 350, gst: 0.18, cnic: 14661, passport: 12200 },
  { rangeLabel: "351–500 USD", min: 351, max: 500, gst: 0.18, cnic: 23420, passport: 17800 },
  { rangeLabel: "501+ USD", min: 501, max: Infinity, gst: 0.25, cnic: 37007, passport: 36870 },
];

function slabFor(totalUsd, slabs) {
  const v = Number(totalUsd) || 0;
  return slabs.find((s) => v >= s.min && v <= s.max) || slabs[slabs.length - 1];
}

function calcDevice(d, usdToPkr, slabs) {
  const purchase = clampNum(d.purchaseUsd);
  const ship = clampNum(d.shipUsd);
  const expectedSell = clampNum(d.expectedSellPkr);

  const baseUsd = purchase + ship;
  const slab = slabFor(baseUsd, slabs);

  // GST rule already in slab: 18% or 25%
  const gst = slab.gst;

  // “Landed” here = (baseUsd * usdToPkr) + (PTA fee) + (GST on base converted)
  const basePkr = baseUsd * usdToPkr;
  const gstPkr = basePkr * gst;

  const landedCnic = basePkr + gstPkr + clampNum(slab.cnic);
  const landedPassport = basePkr + gstPkr + clampNum(slab.passport);

  const profitCnic = expectedSell - landedCnic;
  const profitPassport = expectedSell - landedPassport;

  const marginCnic = expectedSell > 0 ? (profitCnic / expectedSell) * 100 : 0;
  const marginPassport = expectedSell > 0 ? (profitPassport / expectedSell) * 100 : 0;

  return {
    slabLabel: slab.rangeLabel,
    gstPct: Math.round(gst * 100),
    baseUsd,
    basePkr,
    gstPkr,
    landedCnic,
    landedPassport,
    profitCnic,
    profitPassport,
    marginCnic,
    marginPassport,
  };
}

export default function App() {
  const baseUrl = getBaseUrl();
  const LOGO_SRC = `${baseUrl}phonescanadalogo-web.png`;

  const [usdToPkr, setUsdToPkr] = useState(() => {
    const v = localStorage.getItem("pc_usdToPkr");
    return v ? Number(v) : 278;
  });

  const [animationsOn, setAnimationsOn] = useState(() => {
    const v = localStorage.getItem("pc_animationsOn");
    return v ? v === "1" : true;
  });

  const [slabs, setSlabs] = useState(() => {
    try {
      const v = localStorage.getItem("pc_slabs");
      return v ? JSON.parse(v) : DEFAULT_SLABS;
    } catch {
      return DEFAULT_SLABS;
    }
  });

  const [devices, setDevices] = useState(() => {
    try {
      const v = localStorage.getItem("pc_devices");
      return v
        ? JSON.parse(v)
        : [
            {
              id: Date.now(),
              brand: "Realme",
              name: "13+",
              purchaseUsd: 165,
              shipUsd: 10,
              expectedSellPkr: 85000,
            },
            {
              id: Date.now() + 1,
              brand: "Samsung",
              name: "Galaxy S24",
              purchaseUsd: 335,
              shipUsd: 15,
              expectedSellPkr: 145000,
            },
          ];
    } catch {
      return [];
    }
  });

  // Inventory planning draft inputs
  const [draft, setDraft] = useState({
    brand: "",
    name: "",
    purchaseUsd: "",
    shipUsd: "",
    expectedSellPkr: "",
  });

  const exportRef = useRef(null);

  useEffect(() => localStorage.setItem("pc_usdToPkr", String(usdToPkr)), [usdToPkr]);
  useEffect(() => localStorage.setItem("pc_animationsOn", animationsOn ? "1" : "0"), [animationsOn]);
  useEffect(() => localStorage.setItem("pc_slabs", JSON.stringify(slabs)), [slabs]);
  useEffect(() => localStorage.setItem("pc_devices", JSON.stringify(devices)), [devices]);

  const computedDevices = useMemo(() => {
    return devices.map((d) => ({
      ...d,
      calc: calcDevice(d, clampNum(usdToPkr), slabs),
    }));
  }, [devices, usdToPkr, slabs]);

  const bestProfitPassport = useMemo(() => {
    const c = calcDevice(
      {
        id: 0,
        brand: draft.brand,
        name: draft.name,
        purchaseUsd: clampNum(draft.purchaseUsd),
        shipUsd: clampNum(draft.shipUsd),
        expectedSellPkr: clampNum(draft.expectedSellPkr),
      },
      clampNum(usdToPkr),
      slabs
    );
    return c.profitPassport;
  }, [draft, usdToPkr, slabs]);

  const addDevice = () => {
    const brand = (draft.brand || "").trim();
    const name = (draft.name || "").trim();

    const purchaseUsd = clampNum(draft.purchaseUsd);
    const shipUsd = clampNum(draft.shipUsd);
    const expectedSellPkr = clampNum(draft.expectedSellPkr);

    if (!brand || !name) return;

    setDevices((prev) => [
      ...prev,
      {
        id: Date.now(),
        brand,
        name,
        purchaseUsd,
        shipUsd,
        expectedSellPkr,
      },
    ]);

    setDraft({ brand: "", name: "", purchaseUsd: "", shipUsd: "", expectedSellPkr: "" });
  };

  const removeDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id));

  const updateSlab = (idx, key, value) => {
    setSlabs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: clampNum(value) };
      return next;
    });
  };

  const exportPdf = async () => {
    // IMPORTANT: Only adjust logo sizing/handling; keep PDF styling stable.
    const node = exportRef.current;
    if (!node) return;

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    // Ensure images are loaded before capture
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((res) => {
            if (img.complete) return res();
            img.onload = () => res();
            img.onerror = () => res();
          })
      )
    );

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    let remaining = imgHeight;

    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight, undefined, "FAST");
    remaining -= pageHeight;

    while (remaining > 0) {
      pdf.addPage();
      y = remaining - imgHeight; // negative offset to “shift up”
      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight, undefined, "FAST");
      remaining -= pageHeight;
    }

    pdf.save("PhonesCanada-PTA-Report.pdf");
  };

  const exportCsv = () => {
    const rows = computedDevices.map((d) => {
      const c = d.calc;
      return [
        d.brand,
        d.name,
        d.purchaseUsd,
        d.shipUsd,
        d.expectedSellPkr,
        c.slabLabel,
        c.gstPct,
        Math.round(c.landedCnic),
        Math.round(c.profitCnic),
        c.marginCnic.toFixed(1),
        Math.round(c.landedPassport),
        Math.round(c.profitPassport),
        c.marginPassport.toFixed(1),
      ];
    });

    const header = [
      "Brand",
      "Model",
      "PurchaseUSD",
      "ShippingUSD",
      "ExpectedSellPKR",
      "Slab",
      "GST%",
      "LandedCNIC",
      "ProfitCNIC",
      "MarginCNIC%",
      "LandedPassport",
      "ProfitPassport",
      "MarginPassport%",
    ];

    const csv =
      [header, ...rows]
        .map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(","))
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "PhonesCanada-PTA-Devices.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pc-root">
      {/* Background */}
      <AnimatedBackground on={animationsOn} />

      <div className="pc-wrap">
        {/* Header (WEB) - Logo fixed */}
        <header className="pc-header">
          <div className="pc-brand">
            <img
              src={LOGO_SRC}
              alt="Phones Canada"
              className="pc-logo"
              loading="eager"
              crossOrigin="anonymous"
            />
          </div>
          <div className="pc-headText">
            <div className="pc-title">PhonesCanada PTA Dashboard</div>
            <div className="pc-subtitle">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
          </div>
        </header>

        <div className="pc-grid">
          {/* Left column */}
          <div className="pc-left">
            <section className="pc-card">
              <div className="pc-cardTitleRow">
                <div className="pc-cardTitle">SYSTEM PREFERENCES</div>
              </div>

              <label className="pc-label">USD Rate (PKR)</label>
              <input
                className="pc-input"
                value={usdToPkr}
                onChange={(e) => setUsdToPkr(clampNum(e.target.value))}
                inputMode="numeric"
              />

              <div className="pc-toggleRow">
                <div className="pc-toggleText">
                  <div className="pc-toggleTitle">Animations</div>
                  <div className="pc-toggleSub">Smooth blobs + prism outlines</div>
                </div>

                {/* Toggle UI/UX improved (pill + knob) */}
                <button
                  className={`pc-toggle ${animationsOn ? "is-on" : "is-off"}`}
                  onClick={() => setAnimationsOn((v) => !v)}
                  aria-pressed={animationsOn}
                  type="button"
                >
                  <span className="pc-toggleKnob" />
                </button>
              </div>

              <div className="pc-hint">
                💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.
              </div>
            </section>

            <section className="pc-card pc-cardSlabs">
              <div className="pc-cardTitle">PTA TAX SLABS (EDITABLE)</div>

              <div className="pc-slabs">
                <div className="pc-slabsHead">
                  <div>VALUE RANGE (USD)</div>
                  <div>CNIC</div>
                  <div>PASSPORT</div>
                </div>

                {slabs.map((s, idx) => (
                  <div className="pc-slabsRow" key={s.rangeLabel}>
                    <div className="pc-chipRange">{s.rangeLabel.replace(" USD", "")} USD</div>

                    <input
                      className="pc-slabInput"
                      value={s.cnic}
                      onChange={(e) => updateSlab(idx, "cnic", e.target.value)}
                      inputMode="numeric"
                    />
                    <input
                      className="pc-slabInput"
                      value={s.passport}
                      onChange={(e) => updateSlab(idx, "passport", e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                ))}

                {/* Fix: bottom padding so it doesn’t touch */}
                <div className="pc-slabFoot">
                  <span className="pc-saved">✅</span> Saved automatically on this device (localStorage).
                </div>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="pc-right">
            {/* Inventory Planning */}
            <section className="pc-card">
              <div className="pc-cardTopRow">
                <div>
                  <div className="pc-cardTitle">INVENTORY PLANNING</div>
                  <div className="pc-cardSub">
                    Add a device and instantly compare CNIC vs Passport.
                    <span className="pc-note">Best profit assumes Passport PTA.</span>
                  </div>
                </div>

                <button className="pc-btnPrimary" onClick={addDevice} type="button">
                  + Add Device
                </button>
              </div>

              {/* FIX: Proper grid widths (Model wide, cost/ship small), aligned */}
              <div className="pc-formGrid">
                <div className="pc-field">
                  <label className="pc-label">Brand</label>
                  <select
                    className="pc-input"
                    value={draft.brand}
                    onChange={(e) => setDraft((p) => ({ ...p, brand: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    <option>Apple</option>
                    <option>Samsung</option>
                    <option>Google</option>
                    <option>Xiaomi</option>
                    <option>Realme</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="pc-field pc-fieldWide">
                  <label className="pc-label">Device / Model Name</label>
                  <input
                    className="pc-input"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro Max"
                  />
                </div>

                <div className="pc-field pc-fieldNarrow">
                  <label className="pc-label">Purchase Cost (USD)</label>
                  <input
                    className="pc-input"
                    value={draft.purchaseUsd}
                    onChange={(e) => setDraft((p) => ({ ...p, purchaseUsd: e.target.value }))}
                    inputMode="numeric"
                    placeholder="e.g. 1199"
                  />
                </div>

                <div className="pc-field pc-fieldNarrow">
                  <label className="pc-label">Shipping (USD)</label>
                  <input
                    className="pc-input"
                    value={draft.shipUsd}
                    onChange={(e) => setDraft((p) => ({ ...p, shipUsd: e.target.value }))}
                    inputMode="numeric"
                    placeholder="e.g. 30"
                  />
                </div>

                <div className="pc-field pc-fieldMid">
                  <label className="pc-label">Expected Selling Price (PKR)</label>
                  <input
                    className="pc-input"
                    value={draft.expectedSellPkr}
                    onChange={(e) => setDraft((p) => ({ ...p, expectedSellPkr: e.target.value }))}
                    inputMode="numeric"
                    placeholder="e.g. 525000"
                  />
                </div>

                {/* FIX: Best profit pill (no “Passport” text inside) */}
                <div className="pc-field pc-fieldBest">
                  <label className="pc-label">Profit / Loss (Best)</label>
                  <div
                    className={`pc-bestPill ${
                      bestProfitPassport >= 0 ? "is-profit" : "is-loss"
                    }`}
                  >
                    {formatPkr(bestProfitPassport)}
                  </div>
                </div>
              </div>
            </section>

            {/* Devices */}
            <section className="pc-card">
              <div className="pc-devHead">
                <div className="pc-devTitle">Devices</div>
                <div className="pc-devCount">{computedDevices.length} device(s)</div>
              </div>

              <div className="pc-devGrid">
                {computedDevices.map((d) => (
                  <div className="pc-deviceCard" key={d.id}>
                    <div className="pc-deviceTop">
                      <div className="pc-deviceMeta">
                        {/* FIX: lighter font weights */}
                        <div className="pc-deviceBrand">{(d.brand || "").toUpperCase()}</div>
                        <div className="pc-deviceName">{d.name}</div>
                        <div className="pc-badges">
                          <span className="pc-badge">Slab: {d.calc.slabLabel.replace(" USD", "")} USD</span>
                          <span className="pc-badge">GST: {d.calc.gstPct}%</span>
                        </div>
                      </div>

                      <button className="pc-trash" onClick={() => removeDevice(d.id)} type="button">
                        🗑️
                      </button>
                    </div>

                    {/* FIX: CNIC first (full width), then Passport (full width) to avoid truncation */}
                    <div className="pc-compareStack">
                      <div className="pc-compareBox">
                        <div className="pc-compareHdr">
                          <span className="pc-compareLabel">CNIC</span>
                          <span className={`pc-profitChip ${d.calc.profitCnic >= 0 ? "is-profit" : "is-loss"}`}>
                            {d.calc.profitCnic >= 0 ? "PROFIT" : "LOSS"} • {formatPkr(d.calc.profitCnic)}
                          </span>
                        </div>

                        <div className="pc-compareGrid">
                          <div className="pc-kv">
                            <div className="pc-k">Base (Cost+Ship)</div>
                            <div className="pc-v">
                              {formatUsd(d.purchaseUsd)} + {formatUsd(d.shipUsd)} (USD→PKR {usdToPkr})
                            </div>
                          </div>
                          <div className="pc-kv">
                            <div className="pc-k">Landed</div>
                            <div className="pc-v">{formatPkr(d.calc.landedCnic)}</div>
                          </div>
                          <div className="pc-kv">
                            <div className="pc-k">Profit</div>
                            <div className={`pc-v ${d.calc.profitCnic >= 0 ? "pc-green" : "pc-red"}`}>
                              {formatPkr(d.calc.profitCnic)}
                            </div>
                          </div>
                          <div className="pc-kv">
                            <div className="pc-k">Margin</div>
                            <div className="pc-v">{d.calc.marginCnic.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>

                      <div className="pc-compareBox">
                        <div className="pc-compareHdr">
                          <span className="pc-compareLabel">PASSPORT</span>
                          <span className={`pc-profitChip ${d.calc.profitPassport >= 0 ? "is-profit" : "is-loss"}`}>
                            {d.calc.profitPassport >= 0 ? "PROFIT" : "LOSS"} • {formatPkr(d.calc.profitPassport)}
                          </span>
                        </div>

                        <div className="pc-compareGrid">
                          <div className="pc-kv">
                            <div className="pc-k">Base (Cost+Ship)</div>
                            <div className="pc-v">
                              {formatUsd(d.purchaseUsd)} + {formatUsd(d.shipUsd)} (USD→PKR {usdToPkr})
                            </div>
                          </div>
                          <div className="pc-kv">
                            <div className="pc-k">Landed</div>
                            <div className="pc-v">{formatPkr(d.calc.landedPassport)}</div>
                          </div>
                          <div className="pc-kv">
                            <div className="pc-k">Profit</div>
                            <div className={`pc-v ${d.calc.profitPassport >= 0 ? "pc-green" : "pc-red"}`}>
                              {formatPkr(d.calc.profitPassport)}
                            </div>
                          </div>
                          <div className="pc-kv">
                            <div className="pc-k">Margin</div>
                            <div className="pc-v">{d.calc.marginPassport.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pc-deviceFoot">
                      <div className="pc-footRow">
                        <span>Sale</span>
                        <b>{formatPkr(d.expectedSellPkr)}</b>
                      </div>
                      <div className="pc-footRow">
                        <span>Cost + Ship</span>
                        <b>
                          {formatUsd(d.purchaseUsd)} + {formatUsd(d.shipUsd)}
                        </b>
                      </div>
                      <div className="pc-footRow">
                        <span>USD→PKR</span>
                        <b>{formatInt(usdToPkr)}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pc-exportBar">
                <div className="pc-exportText">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-exportBtns">
                  <button className="pc-btnGhost" onClick={exportCsv} type="button">
                    ⬇ CSV
                  </button>
                  <button className="pc-btnGhost" onClick={exportPdf} type="button">
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* PDF Export Area (kept stable; only logo sizing/visibility is handled here) */}
        <div className="pc-exportArea" ref={exportRef}>
          <div className="pc-exportHeader">
            <div className="pc-exportLogoWrap">
              <img
                src={LOGO_SRC}
                alt="Phones Canada"
                className="pc-exportLogo"
                loading="eager"
                crossOrigin="anonymous"
              />
            </div>
            <div>
              <div className="pc-exportTitle">PhonesCanada PTA Dashboard — Report</div>
              <div className="pc-exportSub">
                USD/PKR Rate: {formatInt(usdToPkr)} • GST: 18% / 25% (threshold $500)
              </div>
            </div>
          </div>

          <div className="pc-exportRule" />

          {computedDevices.map((d, idx) => (
            <div className="pc-exportItem" key={d.id}>
              <div className="pc-exportItemTop">
                <div>
                  <div className="pc-exportItemName">
                    {idx + 1}. {d.brand} {d.name}
                  </div>
                  <div className="pc-exportItemMeta">
                    Slab: {d.calc.slabLabel} • GST: {d.calc.gstPct}%
                  </div>
                </div>
                <div className="pc-exportSale">{formatPkr(d.expectedSellPkr)}</div>
              </div>

              <div className="pc-exportCompare">
                <div className="pc-exportBox">
                  <div className="pc-exportBoxHdr">
                    <div className="pc-exportBoxLabel">CNIC</div>
                    <div className="pc-exportProfitTag">PROFIT</div>
                  </div>

                  <div className="pc-exportRows">
                    <div className="pc-exportRow">
                      <span>Base (Cost+Ship)</span>
                      <b>
                        {formatUsd(d.purchaseUsd)} (USD→PKR {formatInt(usdToPkr)})
                      </b>
                    </div>
                    <div className="pc-exportRow">
                      <span>Landed</span>
                      <b>{formatPkr(d.calc.landedCnic)}</b>
                    </div>
                    <div className="pc-exportRow">
                      <span>Profit</span>
                      <b className="pc-green">{formatPkr(d.calc.profitCnic)}</b>
                    </div>
                    <div className="pc-exportRow">
                      <span>Margin</span>
                      <b>{d.calc.marginCnic.toFixed(1)}%</b>
                    </div>
                  </div>
                </div>

                <div className="pc-exportBox">
                  <div className="pc-exportBoxHdr">
                    <div className="pc-exportBoxLabel">PASSPORT</div>
                    <div className="pc-exportProfitTag">PROFIT</div>
                  </div>

                  <div className="pc-exportRows">
                    <div className="pc-exportRow">
                      <span>Base (Cost+Ship)</span>
                      <b>
                        {formatUsd(d.purchaseUsd)} (USD→PKR {formatInt(usdToPkr)})
                      </b>
                    </div>
                    <div className="pc-exportRow">
                      <span>Landed</span>
                      <b>{formatPkr(d.calc.landedPassport)}</b>
                    </div>
                    <div className="pc-exportRow">
                      <span>Profit</span>
                      <b className="pc-green">{formatPkr(d.calc.profitPassport)}</b>
                    </div>
                    <div className="pc-exportRow">
                      <span>Margin</span>
                      <b>{d.calc.marginPassport.toFixed(1)}%</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="pc-exportFooter">Generated by PhonesCanada PTA Dashboard</div>
        </div>
      </div>

      {/* Styles: keep your fonts as-is, just fix layout/weight/truncation + animations */}
      <style>{`
        :root{
          --card: rgba(255,255,255,.72);
          --card2: rgba(255,255,255,.82);
          --stroke: rgba(15, 23, 42, .08);
          --stroke2: rgba(15, 23, 42, .12);
          --text: #0f172a;
          --muted: rgba(15, 23, 42, .65);
          --shadow: 0 20px 55px rgba(2,6,23,.10), 0 10px 18px rgba(2,6,23,.06);
          --shadow2: 0 16px 35px rgba(2,6,23,.10);
          --greenBg: rgba(16,185,129,.14);
          --greenBd: rgba(16,185,129,.35);
          --redBg: rgba(239,68,68,.14);
          --redBd: rgba(239,68,68,.35);
        }

        *{ box-sizing:border-box; }
        body{ margin:0; }

        .pc-root{
          min-height:100vh;
          color:var(--text);
          position:relative;
          overflow:hidden;
          background: linear-gradient(135deg,
            rgba(255, 77, 77, .22),
            rgba(255,255,255,.75),
            rgba(255, 204, 102, .18),
            rgba(176, 143, 255, .18),
            rgba(77, 200, 255, .18)
          );
        }

        .pc-wrap{
          position:relative;
          z-index:2;
          max-width: 1180px;
          margin: 0 auto;
          padding: 22px 16px 60px;
        }

        /* Header */
        .pc-header{
          display:flex;
          gap:16px;
          align-items:center;
          padding: 18px 20px;
          border-radius: 28px;
          background: rgba(255,255,255,.70);
          border: 1px solid var(--stroke);
          box-shadow: var(--shadow);
          backdrop-filter: blur(12px);
        }
        .pc-brand{
          width: 170px; /* you said 170 fixed it */
          height: 64px;
          border-radius: 18px;
          background: rgba(255,255,255,.65);
          border: 1px solid var(--stroke);
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        }
        .pc-logo{
          width: 92%;
          height: 70%;
          object-fit: contain;
          display:block;
        }
        .pc-title{
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .pc-subtitle{
          margin-top: 3px;
          font-size: 14px;
          color: var(--muted);
          font-weight: 500;
        }

        /* Layout grid */
        .pc-grid{
          display:grid;
          grid-template-columns: 360px 1fr;
          gap: 18px;
          margin-top: 18px;
          align-items:start;
        }
        @media (max-width: 1000px){
          .pc-grid{ grid-template-columns: 1fr; }
        }

        .pc-card{
          background: var(--card);
          border: 1px solid var(--stroke);
          border-radius: 24px;
          box-shadow: var(--shadow2);
          backdrop-filter: blur(12px);
          padding: 18px;
        }

        .pc-cardTitle{
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .18em;
          color: rgba(15,23,42,.70);
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .pc-cardSub{
          margin-top: 2px;
          font-size: 14px;
          color: var(--muted);
          font-weight: 500;
          line-height: 1.35;
        }
        .pc-note{
          margin-left: 10px;
          font-weight: 600;
          color: rgba(15,23,42,.72);
        }

        .pc-label{
          display:block;
          font-size: 13px;
          color: rgba(15,23,42,.72);
          font-weight: 600;
          margin: 10px 0 6px;
        }

        .pc-input{
          width:100%;
          height: 44px;
          border-radius: 16px;
          border: 1px solid var(--stroke2);
          background: rgba(255,255,255,.85);
          outline: none;
          padding: 0 14px;
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
        }
        .pc-input::placeholder{ color: rgba(15,23,42,.35); font-weight: 600; }

        /* Toggle */
        .pc-toggleRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 14px;
          margin-top: 14px;
          padding: 12px 12px;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,.06);
          background: rgba(255,255,255,.50);
        }
        .pc-toggleTitle{
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 2px;
        }
        .pc-toggleSub{
          font-weight: 500;
          font-size: 13px;
          color: var(--muted);
        }
        .pc-toggle{
          width: 54px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(15,23,42,.10);
          position: relative;
          cursor:pointer;
          padding:0;
          transition: background .18s ease, border-color .18s ease;
          flex: 0 0 auto;
        }
        .pc-toggle.is-on{
          background: linear-gradient(90deg, rgba(248,113,113,.95), rgba(239,68,68,.95));
          border-color: rgba(239,68,68,.25);
        }
        .pc-toggleKnob{
          position:absolute;
          top: 50%;
          transform: translateY(-50%);
          left: 4px;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: rgba(255,255,255,.95);
          box-shadow: 0 6px 12px rgba(2,6,23,.18);
          transition: left .18s ease;
        }
        .pc-toggle.is-on .pc-toggleKnob{ left: 26px; }

        .pc-hint{
          margin-top: 10px;
          color: rgba(15,23,42,.65);
          font-weight: 500;
          font-size: 14px;
        }

        /* Slabs */
        .pc-cardSlabs{ padding-bottom: 22px; } /* FIX bottom touch */
        .pc-slabs{
          overflow:hidden;
          border-radius: 20px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.55);
        }
        .pc-slabsHead{
          display:grid;
          grid-template-columns: 1.3fr 1fr 1fr;
          gap: 10px;
          padding: 14px 14px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .14em;
          color: rgba(15,23,42,.65);
          background: rgba(255,255,255,.60);
        }
        .pc-slabsRow{
          display:grid;
          grid-template-columns: 1.3fr 1fr 1fr;
          gap: 10px;
          padding: 12px 14px;
          border-top: 1px solid rgba(15,23,42,.06);
          align-items:center;
        }
        .pc-chipRange{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          height: 38px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.78);
          border: 1px solid rgba(15,23,42,.10);
          font-weight: 700;
          color: rgba(15,23,42,.75);
          width: max-content;
          max-width: 100%;
          white-space: nowrap;
        }
        .pc-slabInput{
          width:100%;
          height: 40px;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.84);
          padding: 0 12px;
          font-size: 15px;
          font-weight: 700;
          text-align:center;
          outline:none;
        }
        .pc-slabFoot{
          padding: 12px 14px 14px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(15,23,42,.60);
        }
        .pc-saved{ margin-right: 6px; }

        /* Inventory planning top row */
        .pc-cardTopRow{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 14px;
          margin-bottom: 12px;
        }
        .pc-btnPrimary{
          height: 44px;
          padding: 0 18px;
          border-radius: 999px;
          border: none;
          cursor:pointer;
          font-weight: 800;
          font-size: 14px;
          color: white;
          background: linear-gradient(90deg, rgba(248,113,113,.98), rgba(239,68,68,.98));
          box-shadow: 0 14px 26px rgba(239,68,68,.25);
          white-space: nowrap;
        }

        /* FIX: Inventory fields sizing */
        .pc-formGrid{
          display:grid;
          grid-template-columns: 1.05fr 2.2fr .9fr .9fr 1.2fr 1.05fr;
          gap: 12px;
          align-items:end;
        }
        @media (max-width: 1100px){
          .pc-formGrid{
            grid-template-columns: 1fr 1.6fr 1fr 1fr;
          }
          .pc-fieldMid, .pc-fieldBest{ grid-column: span 2; }
        }
        @media (max-width: 720px){
          .pc-formGrid{ grid-template-columns: 1fr; }
          .pc-fieldMid, .pc-fieldBest{ grid-column: auto; }
        }
        .pc-fieldWide{ }
        .pc-fieldNarrow{ }
        .pc-fieldMid{ }
        .pc-fieldBest{ }

        .pc-bestPill{
          height: 44px;
          border-radius: 16px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight: 800;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.80);
        }
        .pc-bestPill.is-profit{
          background: var(--greenBg);
          border-color: var(--greenBd);
          color: rgba(4,120,87,.95);
        }
        .pc-bestPill.is-loss{
          background: var(--redBg);
          border-color: var(--redBd);
          color: rgba(153,27,27,.95);
        }

        /* Devices */
        .pc-devHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom: 12px;
        }
        .pc-devTitle{
          font-size: 28px;
          font-weight: 700; /* FIX overweight */
          letter-spacing: -0.02em;
        }
        .pc-devCount{
          font-size: 14px;
          color: rgba(15,23,42,.55);
          font-weight: 600;
        }

        .pc-devGrid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 980px){
          .pc-devGrid{ grid-template-columns: 1fr; }
        }

        .pc-deviceCard{
          background: rgba(255,255,255,.78);
          border: 1px solid rgba(15,23,42,.08);
          border-radius: 22px;
          box-shadow: 0 12px 28px rgba(2,6,23,.08);
          overflow:hidden;
        }
        .pc-deviceTop{
          display:flex;
          justify-content:space-between;
          gap: 10px;
          padding: 16px 16px 10px;
        }
        .pc-deviceBrand{
          font-size: 12px;
          letter-spacing: .22em;
          font-weight: 800;
          color: rgba(15,23,42,.48);
        }
        .pc-deviceName{
          font-size: 26px;
          font-weight: 700; /* FIX overweight */
          margin-top: 4px;
          letter-spacing: -0.02em;
        }
        .pc-badges{
          margin-top: 10px;
          display:flex;
          gap: 8px;
          flex-wrap:wrap;
        }
        .pc-badge{
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(248,250,252,.85);
          color: rgba(15,23,42,.70);
          font-weight: 700;
          font-size: 13px;
          white-space: nowrap;
        }
        .pc-trash{
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.85);
          border-radius: 16px;
          width: 40px;
          height: 40px;
          cursor:pointer;
        }

        /* FIX: CNIC then Passport stacked */
        .pc-compareStack{
          padding: 10px 16px 12px;
          display:flex;
          flex-direction:column;
          gap: 10px;
        }
        .pc-compareBox{
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.75);
          border-radius: 18px;
          padding: 12px 12px;
        }
        .pc-compareHdr{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .pc-compareLabel{
          font-weight: 900;
          letter-spacing: .18em;
          color: rgba(15,23,42,.55);
          font-size: 12px;
        }
        .pc-profitChip{
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.12);
          font-weight: 900;
          font-size: 12px;
          letter-spacing: .06em;
          white-space: nowrap;
        }
        .pc-profitChip.is-profit{
          background: var(--greenBg);
          border-color: var(--greenBd);
          color: rgba(4,120,87,.95);
        }
        .pc-profitChip.is-loss{
          background: var(--redBg);
          border-color: var(--redBd);
          color: rgba(153,27,27,.95);
        }

        /* plenty of space, no truncation */
        .pc-compareGrid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 14px;
        }
        @media (max-width: 520px){
          .pc-compareGrid{ grid-template-columns: 1fr; }
        }
        .pc-kv{
          min-width: 0;
        }
        .pc-k{
          font-size: 13px;
          color: rgba(15,23,42,.60);
          font-weight: 600;
          margin-bottom: 2px;
        }
        .pc-v{
          font-size: 14px;
          font-weight: 800;
          color: rgba(15,23,42,.88);
          line-height: 1.2;
          word-break: break-word;
        }
        .pc-green{ color: rgba(4,120,87,.95); }
        .pc-red{ color: rgba(153,27,27,.95); }

        .pc-deviceFoot{
          padding: 12px 16px 16px;
          border-top: 1px solid rgba(15,23,42,.06);
          background: rgba(255,255,255,.65);
        }
        .pc-footRow{
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding: 6px 0;
          font-weight: 650;
          color: rgba(15,23,42,.70);
        }
        .pc-footRow b{ font-weight: 900; color: rgba(15,23,42,.88); }

        /* Export bar */
        .pc-exportBar{
          margin-top: 14px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.65);
          border-radius: 22px;
          padding: 16px 16px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
        }
        .pc-exportText{
          font-weight: 700;
          color: rgba(15,23,42,.60);
        }
        .pc-exportBtns{
          display:flex;
          gap: 10px;
        }
        .pc-btnGhost{
          height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.84);
          cursor:pointer;
          font-weight: 900;
        }

        /* PDF export area (offscreen) */
        .pc-exportArea{
          position: absolute;
          left: -99999px;
          top: 0;
          width: 860px;
          background: #fff;
          padding: 18px 18px 22px;
          font-family: inherit;
          color: #0f172a;
        }
        .pc-exportHeader{
          display:flex;
          align-items:center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 16px;
          background: #f4f6ff;
          border: 1px solid #e5e7eb;
        }
        .pc-exportLogoWrap{
          width: 190px; /* FIX: bigger logo in PDF */
          height: 52px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #e5e7eb;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        }
        .pc-exportLogo{
          width: 92%;
          height: 78%;
          object-fit: contain;
          display:block;
        }
        .pc-exportTitle{
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .pc-exportSub{
          margin-top: 3px;
          font-size: 12px;
          color: #475569;
          font-weight: 600;
        }
        .pc-exportRule{
          height: 1px;
          background: #e5e7eb;
          margin: 14px 0 18px;
        }
        .pc-exportItem{
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 14px;
          background: #fafafa;
        }
        .pc-exportItemTop{
          display:flex;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .pc-exportItemName{ font-weight: 900; font-size: 16px; }
        .pc-exportItemMeta{ font-weight: 650; font-size: 12px; color:#64748b; margin-top: 3px; }
        .pc-exportSale{ font-weight: 900; font-size: 14px; }

        .pc-exportCompare{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .pc-exportBox{
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
        }
        .pc-exportBoxHdr{
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom: 10px;
        }
        .pc-exportBoxLabel{
          font-weight: 900;
          letter-spacing: .18em;
          color:#64748b;
          font-size: 12px;
        }
        .pc-exportProfitTag{
          font-weight: 900;
          font-size: 12px;
          color:#047857;
          letter-spacing: .12em;
        }
        .pc-exportRows{ display:flex; flex-direction:column; gap: 8px; }
        .pc-exportRow{ display:flex; justify-content:space-between; gap: 10px; font-size: 12px; }
        .pc-exportRow span{ color:#64748b; font-weight: 650; }
        .pc-exportRow b{ font-weight: 900; color:#0f172a; }
        .pc-exportFooter{
          margin-top: 12px;
          color:#94a3b8;
          font-size: 11px;
          font-weight: 650;
        }

      `}</style>
    </div>
  );
}

/* Background component */
function AnimatedBackground({ on }) {
  return (
    <div className={`pc-bg ${on ? "is-on" : "is-off"}`} aria-hidden="true">
      <div className="pc-blob pc-blob1" />
      <div className="pc-blob pc-blob2" />
      <div className="pc-blob pc-blob3" />

      {/* FIX: moving objects visible (small prisms/paragons, not too many) */}
      <svg className="pc-shapes" viewBox="0 0 1200 700" preserveAspectRatio="none">
        {/* soft paragon */}
        <g className="pc-float pc-floatA">
          <path
            d="M140 130 L200 105 L260 130 L280 185 L260 240 L200 265 L140 240 L120 185 Z"
            fill="rgba(255,255,255,0.10)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
          />
        </g>

        {/* prism-like rounded rect */}
        <g className="pc-float pc-floatB">
          <rect
            x="820"
            y="120"
            width="130"
            height="70"
            rx="18"
            fill="rgba(255, 203, 88, 0.10)"
            stroke="rgba(255, 203, 88, 0.22)"
            strokeWidth="2"
          />
        </g>

        {/* small diamond */}
        <g className="pc-float pc-floatC">
          <path
            d="M570 420 L610 380 L650 420 L610 460 Z"
            fill="rgba(176,143,255,0.10)"
            stroke="rgba(176,143,255,0.22)"
            strokeWidth="2"
          />
        </g>

        {/* tiny prism */}
        <g className="pc-float pc-floatD">
          <rect
            x="260"
            y="520"
            width="90"
            height="50"
            rx="14"
            fill="rgba(255, 77, 77, 0.08)"
            stroke="rgba(255, 77, 77, 0.18)"
            strokeWidth="2"
          />
        </g>
      </svg>

      <style>{`
        .pc-bg{
          position:absolute;
          inset:0;
          z-index:0;
          pointer-events:none;
          overflow:hidden;
        }
        .pc-bg.is-off{ opacity: 0; }
        .pc-bg.is-on{ opacity: 1; transition: opacity .25s ease; }

        .pc-blob{
          position:absolute;
          filter: blur(40px);
          opacity: .65;
          border-radius: 999px;
          mix-blend-mode: multiply;
          animation: pcBlob 18s ease-in-out infinite;
        }
        .pc-blob1{
          width: 520px; height: 520px;
          left: -140px; top: -120px;
          background: radial-gradient(circle at 30% 30%, rgba(255,77,77,.55), rgba(255,255,255,0));
          animation-duration: 22s;
        }
        .pc-blob2{
          width: 560px; height: 560px;
          right: -180px; top: -160px;
          background: radial-gradient(circle at 30% 30%, rgba(77,200,255,.55), rgba(255,255,255,0));
          animation-duration: 26s;
        }
        .pc-blob3{
          width: 560px; height: 560px;
          left: 25%; bottom: -220px;
          background: radial-gradient(circle at 30% 30%, rgba(176,143,255,.50), rgba(255,255,255,0));
          animation-duration: 28s;
        }

        @keyframes pcBlob{
          0%,100%{ transform: translate(0,0) scale(1); }
          33%{ transform: translate(40px, -30px) scale(1.06); }
          66%{ transform: translate(-35px, 25px) scale(0.98); }
        }

        .pc-shapes{
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
          opacity: .95;
        }

        .pc-float{ transform-origin: center; }
        .pc-floatA{ animation: pcFloatA 14s ease-in-out infinite; }
        .pc-floatB{ animation: pcFloatB 16s ease-in-out infinite; }
        .pc-floatC{ animation: pcFloatC 18s ease-in-out infinite; }
        .pc-floatD{ animation: pcFloatD 15s ease-in-out infinite; }

        @keyframes pcFloatA{
          0%,100%{ transform: translate(0,0) rotate(0deg); }
          50%{ transform: translate(22px, 18px) rotate(8deg); }
        }
        @keyframes pcFloatB{
          0%,100%{ transform: translate(0,0) rotate(0deg); }
          50%{ transform: translate(-26px, 14px) rotate(-7deg); }
        }
        @keyframes pcFloatC{
          0%,100%{ transform: translate(0,0) rotate(0deg); }
          50%{ transform: translate(18px, -22px) rotate(10deg); }
        }
        @keyframes pcFloatD{
          0%,100%{ transform: translate(0,0) rotate(0deg); }
          50%{ transform: translate(-18px, -10px) rotate(-8deg); }
        }
      `}</style>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

// If your project already had PDF export working, these deps should already be installed.
// If your build fails with "Cannot resolve 'jspdf'" or "html2canvas", install them:
//   npm i jspdf html2canvas
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// -----------------------------
// Utilities
// -----------------------------
const clampNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatPKR = (n) => {
  const v = Math.round(clampNum(n, 0));
  return `Rs ${v.toLocaleString("en-PK")}`;
};

const formatUSD = (n) => {
  const v = clampNum(n, 0);
  // show integers without .00
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
  return `$${s}`;
};

const slug = (s) => String(s || "").toLowerCase().trim();

// PTA slabs sample defaults (replace if you want)
const DEFAULT_SLABS = [
  { range: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { range: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { range: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { range: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { range: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { range: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 }
];

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Realme", "Huawei", "Other"];

function getSlabForUsd(usd, slabs) {
  const v = clampNum(usd, 0);
  const s = (slabs || []).find((x) => v >= x.min && v <= x.max);
  return s || slabs?.[0] || DEFAULT_SLABS[0];
}

function computeScenario({ usdRate, slabs, device }) {
  // SAFE DEFAULTS so UI never crashes
  const usd = clampNum(device?.purchaseUsd, 0);
  const ship = clampNum(device?.shippingUsd, 0);
  const sale = clampNum(device?.sellPkr, 0);
  const rate = clampNum(usdRate, 1);

  const slab = getSlabForUsd(usd, slabs);
  const baseUsd = usd + ship;
  const basePkr = baseUsd * rate;

  const cnicTax = clampNum(slab?.cnic, 0);
  const passTax = clampNum(slab?.passport, 0);

  const cnicLanded = basePkr + cnicTax;
  const passLanded = basePkr + passTax;

  const cnicProfit = sale - cnicLanded;
  const passProfit = sale - passLanded;

  const cnicMargin = sale > 0 ? (cnicProfit / sale) * 100 : 0;
  const passMargin = sale > 0 ? (passProfit / sale) * 100 : 0;

  return {
    slab,
    baseUsd,
    basePkr,
    cnic: {
      tax: cnicTax,
      landed: cnicLanded,
      profit: cnicProfit,
      margin: cnicMargin
    },
    passport: {
      tax: passTax,
      landed: passLanded,
      profit: passProfit,
      margin: passMargin
    }
  };
}

function bestProfitScenario(calc) {
  // ALWAYS returns an object with profit field -> fixes your console error
  const c = calc?.cnic || { profit: 0 };
  const p = calc?.passport || { profit: 0 };
  return p.profit >= c.profit
    ? { label: "Passport", profit: p.profit }
    : { label: "CNIC", profit: c.profit };
}

// -----------------------------
// Background shapes (CSS animated)
// -----------------------------
function BackgroundShapes({ enabled }) {
  // purely visual; no heavy physics to keep performance clean
  if (!enabled) return null;
  const shapes = new Array(10).fill(0).map((_, i) => ({
    id: i,
    t: i % 3, // 0 prism, 1 hex, 2 rounded square
    s: 60 + (i % 5) * 18,
    d: 16 + (i % 6) * 3,
    x: 8 + (i * 9) % 80,
    y: 6 + (i * 11) % 70
  }));
  return (
    <div className="pc-bg" aria-hidden="true">
      <div className="pc-bg__wash" />
      {shapes.map((sh) => (
        <div
          key={sh.id}
          className={`pc-shape pc-shape--t${sh.t}`}
          style={{
            width: sh.s,
            height: sh.s,
            left: `${sh.x}%`,
            top: `${sh.y}%`,
            animationDuration: `${sh.d}s`
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  // -----------------------------
  // Persisted state
  // -----------------------------
  const [usdRate, setUsdRate] = useState(() => clampNum(localStorage.getItem("pc_usdRate"), 278));
  const [animOn, setAnimOn] = useState(() => {
    const v = localStorage.getItem("pc_animOn");
    return v == null ? true : v === "true";
  });
  const [slabs, setSlabs] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("pc_slabs") || "null");
      return Array.isArray(v) && v.length ? v : DEFAULT_SLABS;
    } catch {
      return DEFAULT_SLABS;
    }
  });
  const [devices, setDevices] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("pc_devices") || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("pc_usdRate", String(usdRate));
  }, [usdRate]);

  useEffect(() => {
    localStorage.setItem("pc_animOn", String(animOn));
  }, [animOn]);

  useEffect(() => {
    localStorage.setItem("pc_slabs", JSON.stringify(slabs));
  }, [slabs]);

  useEffect(() => {
    localStorage.setItem("pc_devices", JSON.stringify(devices));
  }, [devices]);

  // -----------------------------
  // Inventory Planning form
  // -----------------------------
  const [form, setForm] = useState({
    brand: "Samsung",
    model: "",
    purchaseUsd: "",
    shippingUsd: "",
    sellPkr: ""
  });

  const draftCalc = useMemo(() => {
    return computeScenario({
      usdRate,
      slabs,
      device: {
        purchaseUsd: form.purchaseUsd,
        shippingUsd: form.shippingUsd,
        sellPkr: form.sellPkr
      }
    });
  }, [usdRate, slabs, form.purchaseUsd, form.shippingUsd, form.sellPkr]);

  const bestDraft = useMemo(() => bestProfitScenario(draftCalc), [draftCalc]);

  const addDevice = () => {
    const model = String(form.model || "").trim();
    if (!model) return;

    const newDevice = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      brand: form.brand,
      model,
      purchaseUsd: clampNum(form.purchaseUsd, 0),
      shippingUsd: clampNum(form.shippingUsd, 0),
      sellPkr: clampNum(form.sellPkr, 0)
    };
    setDevices((prev) => [newDevice, ...prev]);
    setForm((f) => ({ ...f, model: "" }));
  };

  const removeDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id));

  // -----------------------------
  // Logo path (works locally + GitHub Pages)
  // -----------------------------
  const logoUrl = `${import.meta.env.BASE_URL}phonescanadalogo-web.png`;

  // -----------------------------
  // PDF export (kept stable)
  // -----------------------------
  const pdfRootRef = useRef(null);

  const exportPDF = async () => {
    const root = pdfRootRef.current;
    if (!root) return;

    // Make sure logo is loaded before rendering
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );

    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      // multipage
      let remaining = imgHeight;
      while (remaining > 0) {
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
        remaining -= pageHeight;
        if (remaining > 0) {
          pdf.addPage();
          y -= pageHeight;
        }
      }
    }

    pdf.save("phonescanada-pta-report.pdf");
  };

  const exportCSV = () => {
    const headers = [
      "Brand",
      "Model",
      "PurchaseUSD",
      "ShippingUSD",
      "SellPKR",
      "Slab",
      "CNIC_Landed",
      "CNIC_Profit",
      "CNIC_Margin",
      "PASS_Landed",
      "PASS_Profit",
      "PASS_Margin"
    ];

    const rows = devices.map((d) => {
      const calc = computeScenario({ usdRate, slabs, device: d });
      return [
        d.brand,
        d.model,
        d.purchaseUsd,
        d.shippingUsd,
        d.sellPkr,
        calc.slab?.range || "",
        Math.round(calc.cnic.landed),
        Math.round(calc.cnic.profit),
        calc.cnic.margin.toFixed(1),
        Math.round(calc.passport.landed),
        Math.round(calc.passport.profit),
        calc.passport.margin.toFixed(1)
      ];
    });

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phonescanada-devices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // -----------------------------
  // Render helpers
  // -----------------------------
  const DeviceScenarioRow = ({ labelLeft, valueLeft, labelRight, valueRight }) => (
    <div className="pc-row">
      <div className="pc-cell">
        <div className="pc-k">{labelLeft}</div>
        <div className="pc-v">{valueLeft}</div>
      </div>
      <div className="pc-cell pc-cell--right">
        <div className="pc-k">{labelRight}</div>
        <div className="pc-v">{valueRight}</div>
      </div>
    </div>
  );

  const DeviceScenario = ({ title, accent, scenario, sellPkr }) => {
    const profit = clampNum(scenario?.profit, 0);
    const margin = clampNum(scenario?.margin, 0);
    return (
      <div className={`pc-scn pc-scn--${accent}`}>
        <div className="pc-scn__head">
          <div className="pc-scn__title">{title}</div>
          <div className="pc-pill pc-pill--profit">PROFIT • {formatPKR(profit)}</div>
        </div>

        <DeviceScenarioRow
          labelLeft="Base (Cost+Ship)"
          valueLeft={`${formatUSD(scenario?.baseUsdTotal)} (USD→PKR ${Math.round(usdRate)})`}
          labelRight="GST"
          valueRight={formatPKR(scenario?.tax)}
        />

        <DeviceScenarioRow
          labelLeft="Landed"
          valueLeft={formatPKR(scenario?.landed)}
          labelRight="Sale"
          valueRight={formatPKR(sellPkr)}
        />

        <DeviceScenarioRow
          labelLeft="Profit"
          valueLeft={formatPKR(profit)}
          labelRight="Margin"
          valueRight={`${margin.toFixed(1)}%`}
        />
      </div>
    );
  };

  const computedDevices = useMemo(() => {
    return devices.map((d) => {
      const calc = computeScenario({ usdRate, slabs, device: d });
      return { d, calc };
    });
  }, [devices, usdRate, slabs]);

  return (
    <div className="pc-app">
      <BackgroundShapes enabled={animOn} />

      <div className="pc-shell">
        {/* Header */}
        <header className="pc-header">
          <div className="pc-brand">
            <img className="pc-brand__logo" src={logoUrl} alt="Phones Canada" />
          </div>
          <div className="pc-header__text">
            <div className="pc-header__title">PhonesCanada PTA Dashboard</div>
            <div className="pc-header__sub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
          </div>
        </header>

        {/* Main grid */}
        <div className="pc-grid">
          {/* Left column */}
          <div className="pc-col">
            <section className="pc-card">
              <div className="pc-card__title">SYSTEM PREFERENCES</div>

              <label className="pc-label">USD Rate (PKR)</label>
              <input
                className="pc-input"
                value={usdRate}
                onChange={(e) => setUsdRate(clampNum(e.target.value, 278))}
                inputMode="numeric"
              />

              <div className="pc-toggleRow">
                <div>
                  <div className="pc-toggleRow__title">Animations</div>
                  <div className="pc-toggleRow__hint">Smooth blobs + prism outlines</div>
                </div>

                <button
                  type="button"
                  className={`pc-toggle ${animOn ? "is-on" : "is-off"}`}
                  onClick={() => setAnimOn((v) => !v)}
                  aria-pressed={animOn}
                  aria-label="Toggle animations"
                >
                  <span className="pc-toggle__knob" />
                </button>
              </div>

              <div className="pc-note">💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.</div>
            </section>

            <section className="pc-card pc-card--slabs">
              <div className="pc-card__title">PTA TAX SLABS (EDITABLE)</div>

              <div className="pc-slabTable">
                <div className="pc-slabTable__head">
                  <div>VALUE RANGE (USD)</div>
                  <div>CNIC</div>
                  <div>PASSPORT</div>
                </div>

                {slabs.map((s, idx) => (
                  <div className="pc-slabTable__row" key={`${s.range}-${idx}`}>
                    <div className="pc-chip">{s.range} USD</div>
                    <input
                      className="pc-input pc-input--mini"
                      value={s.cnic}
                      onChange={(e) => {
                        const v = clampNum(e.target.value, 0);
                        setSlabs((prev) => prev.map((x, i) => (i === idx ? { ...x, cnic: v } : x)));
                      }}
                      inputMode="numeric"
                    />
                    <input
                      className="pc-input pc-input--mini"
                      value={s.passport}
                      onChange={(e) => {
                        const v = clampNum(e.target.value, 0);
                        setSlabs((prev) => prev.map((x, i) => (i === idx ? { ...x, passport: v } : x)));
                      }}
                      inputMode="numeric"
                    />
                  </div>
                ))}
              </div>

              <div className="pc-saved">✅ Saved automatically on this device (localStorage).</div>
            </section>
          </div>

          {/* Right column */}
          <div className="pc-col">
            <section className="pc-card pc-card--inv">
              <div className="pc-card__titleRow">
                <div>
                  <div className="pc-card__title">INVENTORY PLANNING</div>
                  <div className="pc-muted">Add a device and instantly compare CNIC vs Passport.</div>
                  <div className="pc-muted pc-muted--small">Note: “Best” is chosen by higher profit (CNIC or Passport).</div>
                </div>

                <button className="pc-btn" type="button" onClick={addDevice}>
                  <span className="pc-btn__plus">＋</span> Add Device
                </button>
              </div>

              <div className="pc-form">
                <div className="pc-field pc-field--brand">
                  <label className="pc-label">Brand</label>
                  <select
                    className="pc-input"
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  >
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pc-field pc-field--model">
                  <label className="pc-label">Device / Model Name</label>
                  <input
                    className="pc-input"
                    placeholder="e.g. iPhone 15 Pro Max"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  />
                </div>

                <div className="pc-field pc-field--usd">
                  <label className="pc-label">Purchase Cost (USD)</label>
                  <input
                    className="pc-input"
                    inputMode="numeric"
                    placeholder="e.g. 1199"
                    value={form.purchaseUsd}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseUsd: e.target.value }))}
                  />
                </div>

                <div className="pc-field pc-field--ship">
                  <label className="pc-label">Shipping (USD)</label>
                  <input
                    className="pc-input"
                    inputMode="numeric"
                    placeholder="e.g. 30"
                    value={form.shippingUsd}
                    onChange={(e) => setForm((f) => ({ ...f, shippingUsd: e.target.value }))}
                  />
                </div>

                <div className="pc-field pc-field--sell">
                  <label className="pc-label">Expected Selling Price (PKR)</label>
                  <input
                    className="pc-input"
                    inputMode="numeric"
                    placeholder="e.g. 525000"
                    value={form.sellPkr}
                    onChange={(e) => setForm((f) => ({ ...f, sellPkr: e.target.value }))}
                  />
                </div>

                <div className="pc-field pc-field--best">
                  <label className="pc-label">Profit / Loss (Best)</label>
                  <div className={`pc-best ${bestDraft.profit >= 0 ? "is-pos" : "is-neg"}`}>
                    <span className="pc-best__who">Best: {bestDraft.label}</span>
                    <span className="pc-best__val">{formatPKR(bestDraft.profit)}</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="pc-spacer" />

            <section className="pc-card pc-card--devices">
              <div className="pc-devHead">
                <div className="pc-devHead__title">DEVICES</div>
                <div className="pc-muted">{devices.length} device(s)</div>
              </div>

              <div className="pc-devGrid">
                {computedDevices.map(({ d, calc }) => {
                  const cnic = {
                    ...calc.cnic,
                    baseUsdTotal: calc.baseUsd
                  };
                  const pass = {
                    ...calc.passport,
                    baseUsdTotal: calc.baseUsd
                  };

                  return (
                    <div className="pc-devCard" key={d.id}>
                      <div className="pc-devCard__top">
                        <div>
                          <div className="pc-devCard__brand">{String(d.brand || "").toUpperCase()}</div>
                          <div className="pc-devCard__model">{d.model}</div>
                          <div className="pc-badges">
                            <span className="pc-chip">Slab: {calc.slab?.range} USD</span>
                            <span className="pc-chip">GST: {d.purchaseUsd >= 500 ? "25%" : "18%"}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="pc-iconBtn"
                          onClick={() => removeDevice(d.id)}
                          aria-label="Remove device"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* IMPORTANT: CNIC first horizontally, then PASSPORT (as you asked) */}
                      <div className="pc-devScenarios">
                        <DeviceScenario
                          title="CNIC"
                          accent="cnic"
                          scenario={cnic}
                          sellPkr={d.sellPkr}
                        />
                        <DeviceScenario
                          title="PASSPORT"
                          accent="pass"
                          scenario={pass}
                          sellPkr={d.sellPkr}
                        />
                      </div>

                      <div className="pc-devFooter">
                        <div className="pc-devFooter__row">
                          <span>Sale</span>
                          <b>{formatPKR(d.sellPkr)}</b>
                        </div>
                        <div className="pc-devFooter__row">
                          <span>Cost + Ship</span>
                          <b>
                            {formatUSD(d.purchaseUsd)} + {formatUSD(d.shippingUsd)}
                          </b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pc-export">
                <div className="pc-export__text">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-export__btns">
                  <button className="pc-btn pc-btn--ghost" type="button" onClick={exportCSV}>
                    ⭳ CSV
                  </button>
                  <button className="pc-btn pc-btn--ghost" type="button" onClick={exportPDF}>
                    ⭳ PDF
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Hidden PDF template (kept stable + only adjust logo sizing here) */}
      <div className="pc-pdfRoot" aria-hidden="true">
        <div className="pc-pdf" ref={pdfRootRef}>
          <div className="pc-pdf__header">
            <img className="pc-pdf__logo" src={logoUrl} alt="Phones Canada" />
            <div>
              <div className="pc-pdf__title">PhonesCanada PTA Dashboard — Report</div>
              <div className="pc-pdf__meta">
                USD/PKR Rate: {Math.round(usdRate)} • GST: 18% / 25% (threshold $500)
              </div>
            </div>
          </div>

          <div className="pc-pdf__hr" />

          {computedDevices.map(({ d, calc }, idx) => (
            <div key={`pdf-${d.id}`} className="pc-pdf__block">
              <div className="pc-pdf__blockHead">
                <div className="pc-pdf__blockTitle">
                  {idx + 1}. {d.brand} {d.model}
                </div>
                <div className="pc-pdf__sale">{formatPKR(d.sellPkr)}</div>
              </div>
              <div className="pc-pdf__sub">Slab: {calc.slab?.range} USD • GST: {d.purchaseUsd >= 500 ? "25%" : "18%"}</div>

              <div className="pc-pdf__two">
                <div className="pc-pdfCard">
                  <div className="pc-pdfCard__head">
                    <div className="pc-pdfCard__k">CNIC</div>
                    <div className="pc-pdfCard__p">PROFIT</div>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Base (Cost+Ship)</span>
                    <b>
                      {formatUSD(calc.baseUsd)} (USD→PKR {Math.round(usdRate)})
                    </b>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Landed</span>
                    <b>{formatPKR(calc.cnic.landed)}</b>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Profit</span>
                    <b className="pc-good">{formatPKR(calc.cnic.profit)}</b>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Margin</span>
                    <b>{calc.cnic.margin.toFixed(1)}%</b>
                  </div>
                </div>

                <div className="pc-pdfCard">
                  <div className="pc-pdfCard__head">
                    <div className="pc-pdfCard__k">PASSPORT</div>
                    <div className="pc-pdfCard__p">PROFIT</div>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Base (Cost+Ship)</span>
                    <b>
                      {formatUSD(calc.baseUsd)} (USD→PKR {Math.round(usdRate)})
                    </b>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Landed</span>
                    <b>{formatPKR(calc.passport.landed)}</b>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Profit</span>
                    <b className="pc-good">{formatPKR(calc.passport.profit)}</b>
                  </div>
                  <div className="pc-pdfCard__row">
                    <span>Margin</span>
                    <b>{calc.passport.margin.toFixed(1)}%</b>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="pc-pdf__footer">Generated by PhonesCanada PTA Dashboard</div>
        </div>
      </div>
    </div>
  );
}

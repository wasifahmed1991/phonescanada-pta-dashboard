// =========================
// FILE: src/App.jsx
// =========================
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const BRANDS = [
  "Apple",
  "Samsung",
  "Google",
  "Xiaomi",
  "OnePlus",
  "Realme",
  "Oppo",
  "Vivo",
  "Huawei",
  "Infinix",
  "Tecno",
  "Other",
];

// Default PTA slabs (editable)
const DEFAULT_SLABS = [
  { label: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { label: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { label: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { label: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { label: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { label: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 },
];

const STORAGE_KEYS = {
  usdRate: "pc_usd_rate_pkr",
  slabs: "pc_pta_slabs",
  devices: "pc_devices",
  animations: "pc_animations",
};

function clampNum(v) {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatPKR(n) {
  const num = Math.round(Number(n) || 0);
  return num.toLocaleString("en-PK");
}

function formatUSD(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function pickSlab(slabs, baseUSD) {
  const v = Number(baseUSD) || 0;
  return (
    slabs.find((s) => v >= s.min && v <= s.max) ||
    slabs[slabs.length - 1]
  );
}

function gstRateForUSD(baseUSD, threshold = 500) {
  return baseUSD >= threshold ? 0.25 : 0.18;
}

async function imageToDataURL(src) {
  // Ensures logo appears in PDF export even with CORS / html2canvas quirks.
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const targetW = 360; // nice crisp header logo size
        const ratio = img.height / img.width;
        canvas.width = targetW;
        canvas.height = Math.max(1, Math.round(targetW * ratio));
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function GlassToggle({ checked, onChange, label, subLabel }) {
  return (
    <div className="pc-toggleRow">
      <div className="pc-toggleText">
        <div className="pc-toggleTitle">{label}</div>
        {subLabel ? <div className="pc-toggleSub">{subLabel}</div> : null}
      </div>

      <label className="pc-switch" aria-label={label}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="pc-slider" />
      </label>
    </div>
  );
}

function MoneyPill({ kind, valuePKR }) {
  const val = Number(valuePKR) || 0;
  const isProfit = val >= 0;
  const cls = isProfit ? "pc-pill pc-pill--profit" : "pc-pill pc-pill--loss";
  const label = kind;
  const sign = isProfit ? "" : "-";
  return (
    <div className={cls} title={`${label} ${sign}Rs ${formatPKR(Math.abs(val))}`}>
      <span className="pc-pillLabel">{label}</span>
      <span className="pc-pillValue">
        {sign}Rs {formatPKR(Math.abs(val))}
      </span>
    </div>
  );
}

function MetricPair({ leftLabel, leftValue, rightLabel, rightValue }) {
  return (
    <div className="pc-metricRow">
      <div className="pc-metric">
        <div className="pc-metricLabel">{leftLabel}</div>
        <div className="pc-metricValue">{leftValue}</div>
      </div>
      <div className="pc-metric">
        <div className="pc-metricLabel">{rightLabel}</div>
        <div className="pc-metricValue">{rightValue}</div>
      </div>
    </div>
  );
}

function SideSection({ title, profitPKR, baseUSD, basePKR, gstPKR, landedPKR, marginPct }) {
  return (
    <div className="pc-sideSection">
      <div className="pc-sideHeader">
        <div className="pc-sideTitle">{title}</div>
        <MoneyPill kind="Profit" valuePKR={profitPKR} />
      </div>

      {/* Horizontal, roomy layout (no truncation) */}
      <MetricPair
        leftLabel="Base (Cost+Ship)"
        leftValue={`$${formatUSD(baseUSD)}`}
        rightLabel="GST"
        rightValue={`Rs ${formatPKR(gstPKR)}`}
      />
      <MetricPair
        leftLabel="Landed"
        leftValue={`Rs ${formatPKR(landedPKR)}`}
        rightLabel="Selling Price"
        rightValue={`Rs ${formatPKR(basePKR + profitPKR)}`}
      />
      <MetricPair
        leftLabel="Profit"
        leftValue={`Rs ${formatPKR(profitPKR)}`}
        rightLabel="Margin"
        rightValue={`${marginPct.toFixed(1)}%`}
      />
    </div>
  );
}

function DeviceCard({ device, computed, onRemove }) {
  const {
    slabLabel,
    gstPct,
    baseUSD,
    basePKR,
    cnic: c,
    passport: p,
  } = computed;

  return (
    <div className="pc-deviceCard">
      <div className="pc-deviceTop">
        <div className="pc-deviceMeta">
          <div className="pc-deviceBrand">{device.brand?.toUpperCase() || ""}</div>
          <div className="pc-deviceName">{device.model || "—"}</div>
          <div className="pc-chipRow">
            <span className="pc-chip">Slab: {slabLabel} USD</span>
            <span className="pc-chip">GST: {Math.round(gstPct * 100)}%</span>
          </div>
        </div>

        <button className="pc-iconBtn" onClick={() => onRemove(device.id)} title="Remove">
          <span aria-hidden>🗑️</span>
        </button>
      </div>

      {/* CNIC then PASSPORT (stacked), inside each section: horizontal grid rows */}
      <div className="pc-deviceBody">
        <SideSection
          title="CNIC"
          profitPKR={c.profitPKR}
          baseUSD={baseUSD}
          basePKR={basePKR}
          gstPKR={c.gstPKR}
          landedPKR={c.landedPKR}
          marginPct={c.marginPct}
        />
        <SideSection
          title="PASSPORT"
          profitPKR={p.profitPKR}
          baseUSD={baseUSD}
          basePKR={basePKR}
          gstPKR={p.gstPKR}
          landedPKR={p.landedPKR}
          marginPct={p.marginPct}
        />
      </div>

      <div className="pc-deviceFooter">
        <div className="pc-footerRow">
          <div className="pc-footerLabel">Sale</div>
          <div className="pc-footerValue">Rs {formatPKR(device.expectedSellPKR)}</div>
        </div>
        <div className="pc-footerRow">
          <div className="pc-footerLabel">Cost + Ship</div>
          <div className="pc-footerValue">${formatUSD(device.purchaseUSD)} + ${formatUSD(device.shippingUSD)}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [usdRate, setUsdRate] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEYS.usdRate);
    return v ? clampNum(v) : 278;
  });

  const [slabs, setSlabs] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.slabs);
      return raw ? JSON.parse(raw) : DEFAULT_SLABS;
    } catch {
      return DEFAULT_SLABS;
    }
  });

  const [animationsOn, setAnimationsOn] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEYS.animations);
    return v ? v === "1" : true;
  });

  const [devices, setDevices] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.devices);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [form, setForm] = useState({
    brand: "",
    model: "",
    purchaseUSD: "",
    shippingUSD: "",
    expectedSellPKR: "",
  });

  const logoSrc = "/phonescanadalogo-web.png"; // must exist in /public
  const logoDataUrlRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.usdRate, String(usdRate));
  }, [usdRate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.animations, animationsOn ? "1" : "0");
  }, [animationsOn]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.slabs, JSON.stringify(slabs));
  }, [slabs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.devices, JSON.stringify(devices));
  }, [devices]);

  useEffect(() => {
    // pre-warm the dataURL so PDF export never misses the logo
    (async () => {
      try {
        logoDataUrlRef.current = await imageToDataURL(`${window.location.origin}${logoSrc}`);
      } catch {
        logoDataUrlRef.current = `${window.location.origin}${logoSrc}`;
      }
    })();
  }, []);

  const computedById = useMemo(() => {
    const map = new Map();

    for (const d of devices) {
      const purchaseUSD = clampNum(d.purchaseUSD);
      const shippingUSD = clampNum(d.shippingUSD);
      const expectedSellPKR = clampNum(d.expectedSellPKR);

      const baseUSD = purchaseUSD + shippingUSD;
      const basePKR = baseUSD * usdRate;
      const slab = pickSlab(slabs, baseUSD);
      const gstPct = gstRateForUSD(baseUSD, 500);

      function computeTrack(trackFeePKR) {
        const gstPKR = basePKR * gstPct;
        const landedPKR = basePKR + gstPKR + (trackFeePKR || 0);
        const profitPKR = expectedSellPKR - landedPKR;
        const marginPct = expectedSellPKR > 0 ? (profitPKR / expectedSellPKR) * 100 : 0;
        return { gstPKR, landedPKR, profitPKR, marginPct };
      }

      const cnic = computeTrack(clampNum(slab.cnic));
      const passport = computeTrack(clampNum(slab.passport));

      map.set(d.id, {
        slabLabel: slab.label,
        gstPct,
        baseUSD,
        basePKR,
        cnic,
        passport,
      });
    }

    return map;
  }, [devices, slabs, usdRate]);

  const bestProfit = useMemo(() => {
    // Show numeric best (no "Passport" label). Most of the time Passport yields best.
    const purchaseUSD = clampNum(form.purchaseUSD);
    const shippingUSD = clampNum(form.shippingUSD);
    const expectedSellPKR = clampNum(form.expectedSellPKR);

    if (!purchaseUSD && !shippingUSD && !expectedSellPKR) return null;

    const baseUSD = purchaseUSD + shippingUSD;
    const basePKR = baseUSD * usdRate;
    const slab = pickSlab(slabs, baseUSD);
    const gstPct = gstRateForUSD(baseUSD, 500);

    const cnicLanded = basePKR + basePKR * gstPct + clampNum(slab.cnic);
    const passLanded = basePKR + basePKR * gstPct + clampNum(slab.passport);

    const cProfit = expectedSellPKR - cnicLanded;
    const pProfit = expectedSellPKR - passLanded;

    return Math.max(cProfit, pProfit);
  }, [form, slabs, usdRate]);

  function updateForm(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function addDevice() {
    const brand = form.brand || "Other";
    const model = (form.model || "").trim();
    const purchaseUSD = clampNum(form.purchaseUSD);
    const shippingUSD = clampNum(form.shippingUSD);
    const expectedSellPKR = clampNum(form.expectedSellPKR);

    if (!model || purchaseUSD <= 0 || expectedSellPKR <= 0) return;

    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setDevices((arr) => [
      ...arr,
      { id, brand, model, purchaseUSD, shippingUSD, expectedSellPKR },
    ]);

    setForm({ brand: "", model: "", purchaseUSD: "", shippingUSD: "", expectedSellPKR: "" });
  }

  function removeDevice(id) {
    setDevices((arr) => arr.filter((d) => d.id !== id));
  }

  function updateSlab(i, key, value) {
    setSlabs((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: clampNum(value) };
      return next;
    });
  }

  async function exportCSV() {
    const headers = [
      "brand",
      "model",
      "purchaseUSD",
      "shippingUSD",
      "expectedSellPKR",
      "slab",
      "gstPct",
      "cnic_landedPKR",
      "cnic_profitPKR",
      "passport_landedPKR",
      "passport_profitPKR",
    ];

    const lines = [headers.join(",")];

    for (const d of devices) {
      const c = computedById.get(d.id);
      if (!c) continue;
      const row = [
        d.brand,
        d.model,
        d.purchaseUSD,
        d.shippingUSD,
        d.expectedSellPKR,
        c.slabLabel,
        Math.round(c.gstPct * 100),
        Math.round(c.cnic.landedPKR),
        Math.round(c.cnic.profitPKR),
        Math.round(c.passport.landedPKR),
        Math.round(c.passport.profitPKR),
      ].map((x) => `"${String(x).replace(/\"/g, '"')}"`);

      lines.push(row.join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phonescanada-pta-devices.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    // Keep existing PDF styling; only ensure logo shows and is sized correctly.
    const logoForPdf =
      logoDataUrlRef.current || (await imageToDataURL(`${window.location.origin}${logoSrc}`));

    const gstNote = "GST: 18% / 25% (threshold $500)";

    const printable = document.createElement("div");
    printable.className = "pc-print";

    printable.innerHTML = `
      <div class="pc-printHeader">
        <div class="pc-printBrand">
          <img class="pc-printLogo" src="${logoForPdf}" alt="Phones Canada" />
          <div>
            <div class="pc-printTitle">PhonesCanada PTA Dashboard — Report</div>
            <div class="pc-printSub">USD/PKR Rate: ${usdRate} • ${gstNote}</div>
          </div>
        </div>
      </div>

      ${devices
        .map((d, idx) => {
          const c = computedById.get(d.id);
          if (!c) return "";
          const sale = clampNum(d.expectedSellPKR);

          const card = (label, track) => {
            const baseUSD = c.baseUSD;
            return `
              <div class="pc-printTrack">
                <div class="pc-printTrackTop">
                  <div class="pc-printTrackName">${label}</div>
                  <div class="pc-printTrackProfit">PROFIT</div>
                </div>
                <div class="pc-printRow">
                  <div class="pc-printKey">Base (Cost+Ship)</div>
                  <div class="pc-printVal">$${formatUSD(baseUSD)} (USD→PKR ${usdRate})</div>
                </div>
                <div class="pc-printRow">
                  <div class="pc-printKey">Landed</div>
                  <div class="pc-printVal">Rs ${formatPKR(track.landedPKR)}</div>
                </div>
                <div class="pc-printRow">
                  <div class="pc-printKey">Profit</div>
                  <div class="pc-printVal pc-printProfit">Rs ${formatPKR(track.profitPKR)}</div>
                </div>
                <div class="pc-printRow">
                  <div class="pc-printKey">Margin</div>
                  <div class="pc-printVal">${track.marginPct.toFixed(1)}%</div>
                </div>
              </div>
            `;
          };

          return `
            <div class="pc-printDevice">
              <div class="pc-printDeviceHead">
                <div>
                  <div class="pc-printDeviceName">${idx + 1}. ${d.brand} ${d.model}</div>
                  <div class="pc-printDeviceMeta">Slab: ${c.slabLabel} USD • GST: ${Math.round(c.gstPct * 100)}%</div>
                </div>
                <div class="pc-printSale">Rs ${formatPKR(sale)}</div>
              </div>
              <div class="pc-printTracks">
                ${card("CNIC", c.cnic)}
                ${card("PASSPORT", c.passport)}
              </div>
            </div>
          `;
        })
        .join("\n")}

      <div class="pc-printFooter">Generated by PhonesCanada PTA Dashboard</div>
    `;

    // Load html2pdf dynamically (no additional UI changes).
    try {
      const mod = await import("html2pdf.js");
      const html2pdf = mod?.default || mod;

      const opt = {
        margin: 10,
        filename: "phonescanada-pta-report.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(printable).save();
    } catch (e) {
      // Fallback: open print view
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<!doctype html><html><head><title>Report</title>
        <style>${document.getElementById("pc-print-styles")?.textContent || ""}</style>
        </head><body>${printable.outerHTML}</body></html>`);
      w.document.close();
      w.focus();
      w.print();
    }
  }

  return (
    <div className={`pc-app ${animationsOn ? "pc-animOn" : ""}`}>
      {/* Background */}
      <div className="pc-bg" aria-hidden>
        <div className="pc-bgGradient" />
        {animationsOn ? (
          <>
            {/* Soft moving prisms / polygons */}
            <div className="pc-shape pc-shape--p1" />
            <div className="pc-shape pc-shape--p2" />
            <div className="pc-shape pc-shape--p3" />
            <div className="pc-shape pc-shape--p4" />
            <div className="pc-shape pc-shape--p5" />
            <div className="pc-shape pc-shape--p6" />
          </>
        ) : null}
      </div>

      <main className="pc-shell">
        {/* Header */}
        <header className="pc-header">
          <div className="pc-brand">
            <img className="pc-brandLogo" src={logoSrc} alt="Phones Canada" />
            <div className="pc-brandText">
              <div className="pc-brandTitle">PhonesCanada PTA Dashboard</div>
              <div className="pc-brandSub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
            </div>
          </div>
        </header>

        {/* Layout */}
        <section className="pc-grid">
          {/* Left column */}
          <aside className="pc-left">
            <div className="pc-card">
              <div className="pc-cardTitle">System Preferences</div>

              <label className="pc-field">
                <div className="pc-fieldLabel">
                  USD Rate (PKR)
                  <span className="pc-info" title="Conversion rate used for all calculations">i</span>
                </div>
                <input
                  className="pc-input"
                  value={usdRate}
                  onChange={(e) => setUsdRate(clampNum(e.target.value))}
                  inputMode="numeric"
                />
              </label>

              <div className="pc-divider" />

              <GlassToggle
                checked={animationsOn}
                onChange={setAnimationsOn}
                label="Animations"
                subLabel="Smooth blobs + prism outlines"
              />

              <div className="pc-note">
                💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.
              </div>
            </div>

            <div className="pc-card pc-card--spaced">
              <div className="pc-cardTitle">PTA Tax Slabs (Editable)</div>

              <div className="pc-slabTable">
                <div className="pc-slabHead">
                  <div>Value Range (USD)</div>
                  <div>CNIC</div>
                  <div>Passport</div>
                </div>

                {slabs.map((s, i) => (
                  <div className="pc-slabRow" key={s.label}>
                    <div className="pc-slabRange">{s.label} USD</div>

                    <input
                      className="pc-slabInput"
                      value={s.cnic}
                      onChange={(e) => updateSlab(i, "cnic", e.target.value)}
                      inputMode="numeric"
                    />

                    <input
                      className="pc-slabInput"
                      value={s.passport}
                      onChange={(e) => updateSlab(i, "passport", e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                ))}
              </div>

              <div className="pc-slabFooter">
                <span className="pc-check">✅</span> Saved automatically on this device (localStorage).
              </div>
            </div>
          </aside>

          {/* Right column */}
          <div className="pc-right">
            {/* Inventory Planning */}
            <div className="pc-card pc-card--wide">
              <div className="pc-cardHeaderRow">
                <div>
                  <div className="pc-cardTitle">Inventory Planning</div>
                  <div className="pc-cardSub">
                    Add a device and instantly compare CNIC vs Passport.
                    <span className="pc-cardHint"> Best profit usually comes from Passport.</span>
                  </div>
                </div>

                <button className="pc-primary" onClick={addDevice}>
                  <span className="pc-plus">＋</span> Add Device
                </button>
              </div>

              {/* FIXED: device/model gets the most space; numeric fields compact */}
              <div className="pc-formGrid">
                <label className="pc-field">
                  <div className="pc-fieldLabel">Brand</div>
                  <select
                    className="pc-select"
                    value={form.brand}
                    onChange={(e) => updateForm({ brand: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="pc-field pc-field--grow">
                  <div className="pc-fieldLabel">Device / Model Name</div>
                  <input
                    className="pc-input"
                    value={form.model}
                    onChange={(e) => updateForm({ model: e.target.value })}
                    placeholder="e.g. iPhone 15 Pro Max"
                  />
                </label>

                <label className="pc-field pc-field--num">
                  <div className="pc-fieldLabel">Purchase Cost (USD)</div>
                  <input
                    className="pc-input"
                    value={form.purchaseUSD}
                    onChange={(e) => updateForm({ purchaseUSD: e.target.value })}
                    placeholder="e.g. 1199"
                    inputMode="numeric"
                  />
                </label>

                <label className="pc-field pc-field--num">
                  <div className="pc-fieldLabel">Shipping (USD)</div>
                  <input
                    className="pc-input"
                    value={form.shippingUSD}
                    onChange={(e) => updateForm({ shippingUSD: e.target.value })}
                    placeholder="e.g. 30"
                    inputMode="numeric"
                  />
                </label>

                <label className="pc-field pc-field--numWide">
                  <div className="pc-fieldLabel">Expected Selling Price (PKR)</div>
                  <input
                    className="pc-input"
                    value={form.expectedSellPKR}
                    onChange={(e) => updateForm({ expectedSellPKR: e.target.value })}
                    placeholder="e.g. 525000"
                    inputMode="numeric"
                  />
                </label>

                <div className="pc-field pc-field--best">
                  <div className="pc-fieldLabel">Profit / Loss (Best)</div>
                  <div className="pc-bestBox" aria-live="polite">
                    {bestProfit === null ? (
                      <span className="pc-muted">—</span>
                    ) : bestProfit >= 0 ? (
                      <span className="pc-bestProfit">Rs {formatPKR(bestProfit)}</span>
                    ) : (
                      <span className="pc-bestLoss">-Rs {formatPKR(Math.abs(bestProfit))}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Spacer between Inventory and Devices */}
            <div className="pc-spacer" />

            {/* Devices */}
            <div className="pc-card pc-card--wide">
              <div className="pc-sectionHead">
                <div className="pc-sectionTitle">Devices</div>
                <div className="pc-sectionCount">{devices.length} device(s)</div>
              </div>

              <div className="pc-deviceGrid">
                {devices.map((d) => (
                  <DeviceCard
                    key={d.id}
                    device={d}
                    computed={computedById.get(d.id)}
                    onRemove={removeDevice}
                  />
                ))}
              </div>

              <div className="pc-exportBar">
                <div className="pc-exportText">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-exportBtns">
                  <button className="pc-ghost" onClick={exportCSV}>
                    ⬇ CSV
                  </button>
                  <button className="pc-ghost" onClick={exportPDF}>
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Print styles kept separate to avoid messing web UI */}
      <style id="pc-print-styles">{PRINT_CSS}</style>
    </div>
  );
}

const PRINT_CSS = `
  .pc-print { font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #fff; }
  .pc-printHeader { margin: 8px 0 14px; }
  .pc-printBrand { display:flex; gap:12px; align-items:center; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 14px; background: #f3f6ff; }

  /* FIX: PDF logo visibility + sizing (only in PDF) */
  .pc-printLogo { width: 180px; height: auto; display:block; object-fit: contain; background: transparent; }

  .pc-printTitle { font-size: 18px; font-weight: 700; margin:0; }
  .pc-printSub { font-size: 12px; color:#475569; margin-top:3px; }

  .pc-printDevice { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; margin: 14px 0; }
  .pc-printDeviceHead { display:flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .pc-printDeviceName { font-weight: 700; font-size: 14px; }
  .pc-printDeviceMeta { font-size: 12px; color:#64748b; margin-top: 2px; }
  .pc-printSale { font-weight: 700; font-size: 14px; }

  .pc-printTracks { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .pc-printTrack { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px; background: #fafbff; }
  .pc-printTrackTop { display:flex; justify-content: space-between; align-items:center; margin-bottom: 6px; }
  .pc-printTrackName { font-weight: 700; letter-spacing: 0.08em; color:#475569; font-size: 12px; }
  .pc-printTrackProfit { font-weight: 800; color:#0f766e; letter-spacing: 0.12em; font-size: 12px; }

  .pc-printRow { display:flex; justify-content: space-between; gap: 12px; padding: 6px 0; }
  .pc-printKey { color:#64748b; font-size: 12px; }
  .pc-printVal { font-weight: 700; font-size: 12px; }
  .pc-printProfit { color:#0f766e; }

  .pc-printFooter { margin-top: 14px; color:#94a3b8; font-size: 12px; }
`;

// =========================
// FILE: src/App.css
// =========================
/* Paste the CSS below into src/App.css (or replace your existing App.css) */

/*
@import url('https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600;700&display=swap');

:root {
  --pc-text: #0f172a;
  --pc-muted: #64748b;
  --pc-border: rgba(15, 23, 42, 0.10);
  --pc-card: rgba(255, 255, 255, 0.72);
  --pc-card-strong: rgba(255, 255, 255, 0.85);
  --pc-shadow: 0 18px 60px rgba(2, 6, 23, 0.10);
  --pc-shadow-soft: 0 10px 28px rgba(2, 6, 23, 0.08);
  --pc-radius: 22px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Saira', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  color: var(--pc-text);
}

.pc-app {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

.pc-shell {
  position: relative;
  z-index: 2;
  padding: 26px 22px 44px;
  max-width: 1260px;
  margin: 0 auto;
}

/* ===== Background ===== */
.pc-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.pc-bgGradient {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(60% 55% at 15% 20%, rgba(255, 99, 99, 0.50), transparent 55%),
    radial-gradient(60% 55% at 80% 25%, rgba(147, 197, 253, 0.55), transparent 55%),
    radial-gradient(55% 55% at 30% 85%, rgba(250, 204, 21, 0.28), transparent 60%),
    radial-gradient(55% 55% at 85% 80%, rgba(168, 85, 247, 0.26), transparent 60%),
    linear-gradient(180deg, #f8fafc, #eef2ff);
  filter: blur(0px);
}

/* Prism / polygon shapes */
.pc-shape {
  position: absolute;
  border: 2px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(3px);
  box-shadow: 0 12px 36px rgba(2, 6, 23, 0.08);
  opacity: 0.9;
  will-change: transform;
}

/* Different shapes */
.pc-shape--p1 { width: 170px; height: 110px; border-radius: 18px; left: 7%; top: 18%; clip-path: polygon(10% 0%, 100% 12%, 92% 100%, 0% 88%); animation: pc-float1 18s ease-in-out infinite; }
.pc-shape--p2 { width: 130px; height: 130px; border-radius: 22px; right: 10%; top: 16%; clip-path: polygon(50% 0%, 100% 35%, 82% 100%, 18% 100%, 0% 35%); animation: pc-float2 20s ease-in-out infinite; }
.pc-shape--p3 { width: 160px; height: 95px; border-radius: 16px; left: 14%; bottom: 14%; clip-path: polygon(0% 18%, 100% 0%, 92% 100%, 8% 82%); animation: pc-float3 22s ease-in-out infinite; }
.pc-shape--p4 { width: 110px; height: 160px; border-radius: 18px; right: 18%; bottom: 16%; clip-path: polygon(18% 0%, 100% 10%, 82% 100%, 0% 90%); animation: pc-float4 24s ease-in-out infinite; }
.pc-shape--p5 { width: 120px; height: 120px; border-radius: 26px; left: 48%; top: 10%; clip-path: polygon(20% 0%, 100% 20%, 80% 100%, 0% 80%); animation: pc-float5 19s ease-in-out infinite; }
.pc-shape--p6 { width: 140px; height: 140px; border-radius: 22px; left: 62%; bottom: 8%; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); animation: pc-float6 21s ease-in-out infinite; }

@keyframes pc-float1 { 0%{transform: translate(0,0) rotate(0deg);} 50%{transform: translate(50px, 22px) rotate(10deg);} 100%{transform: translate(0,0) rotate(0deg);} }
@keyframes pc-float2 { 0%{transform: translate(0,0) rotate(0deg);} 50%{transform: translate(-48px, 26px) rotate(-12deg);} 100%{transform: translate(0,0) rotate(0deg);} }
@keyframes pc-float3 { 0%{transform: translate(0,0) rotate(0deg);} 50%{transform: translate(42px,-20px) rotate(12deg);} 100%{transform: translate(0,0) rotate(0deg);} }
@keyframes pc-float4 { 0%{transform: translate(0,0) rotate(0deg);} 50%{transform: translate(-36px,-22px) rotate(-10deg);} 100%{transform: translate(0,0) rotate(0deg);} }
@keyframes pc-float5 { 0%{transform: translate(0,0) rotate(0deg);} 50%{transform: translate(24px, 34px) rotate(14deg);} 100%{transform: translate(0,0) rotate(0deg);} }
@keyframes pc-float6 { 0%{transform: translate(0,0) rotate(0deg);} 50%{transform: translate(-22px, -30px) rotate(10deg);} 100%{transform: translate(0,0) rotate(0deg);} }

/* ===== Header ===== */
.pc-header {
  background: var(--pc-card);
  border: 1px solid var(--pc-border);
  border-radius: var(--pc-radius);
  box-shadow: var(--pc-shadow);
  padding: 18px 18px;
}

.pc-brand {
  display: flex;
  gap: 16px;
  align-items: center;
}

.pc-brandLogo {
  width: 170px;
  height: 52px;
  object-fit: contain;
  background: transparent; /* FIX: no red/orange background */
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 6px 10px;
}

.pc-brandTitle {
  font-size: 34px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.pc-brandSub {
  margin-top: 4px;
  color: var(--pc-muted);
  font-weight: 400;
}

/* ===== Grid ===== */
.pc-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}

@media (max-width: 1060px) {
  .pc-grid { grid-template-columns: 1fr; }
}

.pc-left {
  display: grid;
  gap: 14px; /* FIX spacing */
}

.pc-right {
  display: grid;
  gap: 0;
}

.pc-spacer { height: 14px; } /* FIX: padding between inventory planning and devices */

.pc-card {
  background: var(--pc-card);
  border: 1px solid var(--pc-border);
  border-radius: var(--pc-radius);
  box-shadow: var(--pc-shadow-soft);
  padding: 16px;
}

.pc-card--spaced { padding-bottom: 22px; } /* FIX: tax slab bottom padding */

.pc-cardTitle {
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.72);
}

.pc-cardSub {
  margin-top: 6px;
  color: var(--pc-muted);
  font-weight: 400;
}

.pc-cardHint { margin-left: 8px; color: rgba(15, 23, 42, 0.55); }

.pc-cardHeaderRow {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

@media (max-width: 720px) {
  .pc-cardHeaderRow { flex-direction: column; align-items: stretch; }
}

.pc-divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.08);
  margin: 14px 0;
}

/* ===== Fields ===== */
.pc-field { display: grid; gap: 8px; }

.pc-fieldLabel {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: rgba(15, 23, 42, 0.78);
}

.pc-info {
  width: 18px; height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
}

.pc-input, .pc-select {
  height: 44px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  padding: 0 14px;
  font-size: 16px;
  font-weight: 400;
  background: rgba(255, 255, 255, 0.86);
  outline: none;
}

.pc-input:focus, .pc-select:focus {
  border-color: rgba(99, 102, 241, 0.38);
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
}

.pc-note {
  margin-top: 12px;
  color: rgba(15, 23, 42, 0.65);
}

/* ===== Toggle ===== */
.pc-toggleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 2px; /* FIX: padding so text isn't stuck to corner */
}

.pc-toggleTitle { font-size: 18px; font-weight: 650; }
.pc-toggleSub { color: rgba(15, 23, 42, 0.55); font-weight: 400; }

.pc-switch { position: relative; width: 56px; height: 32px; display: inline-block; }
.pc-switch input { opacity: 0; width: 0; height: 0; }

.pc-slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.55); /* OFF: gray */
  border: 1px solid rgba(15, 23, 42, 0.14);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  transition: all 200ms ease;
}

.pc-slider::before {
  content: "";
  position: absolute;
  width: 26px; height: 26px;
  left: 3px; top: 2.5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 22px rgba(2, 6, 23, 0.14);
  transition: transform 200ms ease;
}

.pc-switch input:checked + .pc-slider {
  background: linear-gradient(135deg, rgba(255, 83, 83, 0.95), rgba(255, 143, 91, 0.92)); /* ON: glassy red */
  border-color: rgba(255, 83, 83, 0.45);
  box-shadow:
    0 14px 34px rgba(255, 83, 83, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

.pc-switch input:checked + .pc-slider::before {
  transform: translateX(23px);
}

/* ===== Buttons ===== */
.pc-primary {
  height: 46px;
  padding: 0 16px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  color: #fff;
  font-weight: 650;
  font-size: 16px;
  background: linear-gradient(135deg, rgba(255, 83, 83, 0.95), rgba(255, 143, 91, 0.92));
  box-shadow: 0 16px 40px rgba(255, 83, 83, 0.18);
}

.pc-plus { margin-right: 6px; }

.pc-ghost {
  height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  font-weight: 600;
}

.pc-iconBtn {
  width: 44px; height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.84);
  cursor: pointer;
}

/* ===== Inventory form grid ===== */
.pc-formGrid {
  margin-top: 14px;
  display: grid;
  grid-template-columns:
    minmax(160px, 190px)
    minmax(260px, 1fr)
    minmax(140px, 170px)
    minmax(120px, 150px)
    minmax(190px, 240px)
    minmax(170px, 200px);
  gap: 12px;
  align-items: end;
}

@media (max-width: 1180px) {
  .pc-formGrid {
    grid-template-columns: 1fr 1fr;
  }
}

.pc-field--grow { min-width: 260px; }
.pc-field--num { min-width: 140px; }
.pc-field--numWide { min-width: 190px; }

.pc-field--best .pc-bestBox {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.78);
  font-weight: 650;
}

.pc-bestProfit { color: #0f766e; }
.pc-bestLoss { color: #b91c1c; }
.pc-muted { color: rgba(15, 23, 42, 0.45); }

/* ===== Slab table ===== */
.pc-slabTable {
  margin-top: 12px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.80);
}

.pc-slabHead, .pc-slabRow {
  display: grid;
  grid-template-columns: 1.25fr 1fr 1fr;
  gap: 10px;
  align-items: center;
  padding: 12px;
}

.pc-slabHead {
  background: rgba(15, 23, 42, 0.03);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.60);
}

.pc-slabRow { border-top: 1px solid rgba(15, 23, 42, 0.06); }

.pc-slabRange {
  font-weight: 600;
  color: rgba(15, 23, 42, 0.72);
}

.pc-slabInput {
  height: 42px;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  padding: 0 12px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.92);
}

.pc-slabFooter {
  margin-top: 14px;
  color: rgba(15, 23, 42, 0.55);
}

.pc-check { margin-right: 8px; }

/* ===== Devices section ===== */
.pc-sectionHead {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}

.pc-sectionTitle {
  font-size: 28px;
  font-weight: 700; /* FIX: lighter than before */
  letter-spacing: -0.01em;
}

.pc-sectionCount { color: rgba(15, 23, 42, 0.55); font-weight: 400; }

.pc-deviceGrid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 980px) {
  .pc-deviceGrid { grid-template-columns: 1fr; }
}

.pc-deviceCard {
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 22px;
  box-shadow: 0 18px 54px rgba(2, 6, 23, 0.08);
  overflow: hidden;
}

.pc-deviceTop {
  padding: 14px 14px 10px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.pc-deviceBrand {
  letter-spacing: 0.24em;
  font-weight: 650;
  color: rgba(15, 23, 42, 0.45);
  font-size: 12px;
}

.pc-deviceName {
  font-size: 28px;
  font-weight: 650; /* FIX: no overweight */
  margin-top: 2px;
}

.pc-chipRow { display:flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }

.pc-chip {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(15, 23, 42, 0.03);
  font-weight: 600;
  color: rgba(15, 23, 42, 0.62);
}

.pc-deviceBody {
  padding: 12px 14px 14px;
  display: grid;
  gap: 12px;
}

.pc-sideSection {
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  padding: 12px;
}

.pc-sideHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.pc-sideTitle {
  font-weight: 750;
  letter-spacing: 0.18em;
  color: rgba(15, 23, 42, 0.52);
  font-size: 12px;
}

.pc-metricRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px dashed rgba(15, 23, 42, 0.10);
}

.pc-metricRow:first-of-type { border-top: none; padding-top: 0; }

.pc-metricLabel { color: rgba(15, 23, 42, 0.52); font-weight: 500; font-size: 13px; }
.pc-metricValue { font-weight: 650; font-size: 15px; color: rgba(15, 23, 42, 0.86); }

.pc-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  font-weight: 700;
  border: 1px solid rgba(15, 23, 42, 0.10);
  font-size: 13px;
}

.pc-pillLabel { letter-spacing: 0.12em; font-size: 11px; color: rgba(15, 23, 42, 0.55); }
.pc-pillValue { font-weight: 750; }

.pc-pill--profit { background: rgba(16, 185, 129, 0.16); color: #065f46; border-color: rgba(16, 185, 129, 0.30); }
.pc-pill--loss { background: rgba(239, 68, 68, 0.14); color: #7f1d1d; border-color: rgba(239, 68, 68, 0.28); }

.pc-deviceFooter {
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  padding: 12px 14px 14px;
  display: grid;
  gap: 10px;
}

.pc-footerRow { display:flex; justify-content: space-between; gap: 12px; }
.pc-footerLabel { color: rgba(15, 23, 42, 0.55); font-weight: 500; }
.pc-footerValue { font-weight: 650; }

/* Export bar */
.pc-exportBar {
  margin-top: 14px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(15, 23, 42, 0.10);
  border-radius: 22px;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

@media (max-width: 720px) {
  .pc-exportBar { flex-direction: column; align-items: stretch; }
  .pc-exportBtns { justify-content: flex-end; }
}

.pc-exportText { color: rgba(15, 23, 42, 0.60); font-weight: 500; }

.pc-exportBtns { display:flex; gap: 10px; }
*/

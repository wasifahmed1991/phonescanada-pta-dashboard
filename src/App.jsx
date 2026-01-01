import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

// -------------------------
// Constants
// -------------------------
const DEFAULT_USD_RATE = 278;
const GST_THRESHOLD_USD = 500;

const LS_KEYS = {
  usd: "pc_usd",
  anim: "pc_anim",
  slabs: "pc_slabs",
  devices: "pc_devices",
};

// Default slabs (USD ranges) -> PTA (PKR) for CNIC and Passport
const DEFAULT_SLABS = [
  { label: "0–30 USD", min: 0, max: 30, cnic: 550, passport: 430 },
  { label: "31–100 USD", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { label: "101–200 USD", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { label: "201–350 USD", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { label: "351–500 USD", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { label: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 },
];

// Lightweight brand list
const BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Google",
  "OnePlus",
  "Oppo",
  "Vivo",
  "Realme",
  "Huawei",
  "Infinix",
  "Tecno",
  "Other",
];

// -------------------------
// Helpers
// -------------------------
function clampNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampPositive(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function fmtMoneyPKR(n) {
  const v = Math.round(Number(n || 0));
  return `Rs ${v.toLocaleString("en-PK")}`;
}

function fmtMoneyUSD(n) {
  const v = Number(n || 0);
  // for display in cards we keep simple
  return `$ ${Math.round(v).toLocaleString("en-US")}`;
}

function fmtPct(n) {
  const v = Number(n || 0);
  return `${v.toFixed(1)}%`;
}

function safeJSONParse(str, fallback) {
  try {
    if (!str) return fallback;
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function getGstRate(purchaseUsd) {
  // GST in PKR derived from purchaseUsd * usdRate * gstRate.
  // We only decide the gstRate based on USD threshold.
  return Number(purchaseUsd) >= GST_THRESHOLD_USD ? 0.25 : 0.18;
}

function findSlab(slabs, purchaseUsd) {
  const p = Number(purchaseUsd || 0);
  return (
    slabs.find((s) => p >= s.min && p <= s.max) ||
    slabs.find((s) => s.max === Infinity) ||
    slabs[slabs.length - 1]
  );
}

function computeCase({ purchaseUsd, shipUsd, sellPkr, usdRate, slabs }) {
  const p = Number(purchaseUsd || 0);
  const s = Number(shipUsd || 0);
  const sell = Number(sellPkr || 0);

  const slab = findSlab(slabs, p);
  const gstRate = getGstRate(p);

  // Base USD and base PKR
  const baseUsd = p + s;
  const basePkr = baseUsd * usdRate;

  // GST PKR
  const gstPkr = p * usdRate * gstRate;

  // PTA PKR
  const ptaCnic = Number(slab?.cnic || 0);
  const ptaPassport = Number(slab?.passport || 0);

  // Landed PKR
  const landedCnic = basePkr + gstPkr + ptaCnic;
  const landedPassport = basePkr + gstPkr + ptaPassport;

  // Profit PKR
  const profitCnic = sell - landedCnic;
  const profitPassport = sell - landedPassport;

  // Margin (profit / sell)
  const marginCnic = sell > 0 ? (profitCnic / sell) * 100 : 0;
  const marginPassport = sell > 0 ? (profitPassport / sell) * 100 : 0;

  const best = profitPassport >= profitCnic ? "passport" : "cnic";
  const bestProfit = best === "passport" ? profitPassport : profitCnic;

  return {
    slab,
    gstRate,
    baseUsd,
    basePkr,
    gstPkr,
    cnic: {
      pta: ptaCnic,
      landed: landedCnic,
      profit: profitCnic,
      margin: marginCnic,
    },
    passport: {
      pta: ptaPassport,
      landed: landedPassport,
      profit: profitPassport,
      margin: marginPassport,
    },
    best,
    bestProfit,
  };
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// -------------------------
// Background (animated shapes)
// -------------------------
function AnimatedBackground({ enabled = true }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  const shapesRef = useRef([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mkShapes = () => {
      const count = 14;
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const shapes = Array.from({ length: count }).map((_, i) => {
        const size = 34 + Math.random() * 42;
        const x = Math.random() * (w - size);
        const y = Math.random() * (h - size);
        const vx = (Math.random() - 0.5) * 0.55;
        const vy = (Math.random() - 0.5) * 0.55;
        const kind = i % 3; // 0 square, 1 diamond, 2 hex
        const rot = Math.random() * 360;
        const vr = (Math.random() - 0.5) * 0.15;
        return { x, y, vx, vy, size, kind, rot, vr };
      });
      shapesRef.current = shapes;
    };

    const step = () => {
      const r = el.getBoundingClientRect();
      const w = r.width;
      const h = r.height;

      const shapes = shapesRef.current;

      // Move
      for (const s of shapes) {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vr;

        // Walls
        if (s.x <= 0 || s.x + s.size >= w) s.vx *= -1;
        if (s.y <= 0 || s.y + s.size >= h) s.vy *= -1;

        s.x = Math.max(0, Math.min(w - s.size, s.x));
        s.y = Math.max(0, Math.min(h - s.size, s.y));
      }

      // Soft collisions
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const a = shapes[i];
          const b = shapes[j];
          const ax = a.x + a.size / 2;
          const ay = a.y + a.size / 2;
          const bx = b.x + b.size / 2;
          const by = b.y + b.size / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.hypot(dx, dy);
          const minDist = (a.size + b.size) * 0.32;
          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const push = (minDist - dist) * 0.02;
            a.vx -= nx * push;
            a.vy -= ny * push;
            b.vx += nx * push;
            b.vy += ny * push;
          }
        }
      }

      // Apply styles
      const nodes = el.querySelectorAll(".pc-shape");
      nodes.forEach((node, idx) => {
        const s = shapes[idx];
        if (!s) return;
        node.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.rot}deg)`;
      });

      rafRef.current = requestAnimationFrame(step);
    };

    mkShapes();

    // Create nodes
    const frag = document.createDocumentFragment();
    for (let i = 0; i < shapesRef.current.length; i++) {
      const n = document.createElement("div");
      n.className = `pc-shape pc-shape-${i % 3}`;
      n.style.width = `${shapesRef.current[i].size}px`;
      n.style.height = `${shapesRef.current[i].size}px`;
      frag.appendChild(n);
    }
    el.innerHTML = "";
    el.appendChild(frag);

    const onResize = () => {
      mkShapes();
      // keep nodes count and update sizes
      const nodes = el.querySelectorAll(".pc-shape");
      nodes.forEach((node, idx) => {
        const s = shapesRef.current[idx];
        if (!s) return;
        node.style.width = `${s.size}px`;
        node.style.height = `${s.size}px`;
      });
    };

    window.addEventListener("resize", onResize);

    if (enabled) {
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  return <div ref={ref} className={`pc-bg ${enabled ? "is-on" : "is-off"}`} aria-hidden="true" />;
}

// -------------------------
// Main App
// -------------------------
export default function App() {
  const [usdRate, setUsdRate] = useState(() =>
    clampPositive(localStorage.getItem(LS_KEYS.usd), DEFAULT_USD_RATE)
  );

  const [animationsOn, setAnimationsOn] = useState(() => {
    const v = localStorage.getItem(LS_KEYS.anim);
    if (v === null) return true;
    return v === "1";
  });

  const [slabs, setSlabs] = useState(() => {
    const saved = safeJSONParse(localStorage.getItem(LS_KEYS.slabs), null);
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_SLABS;
  });

  const [devices, setDevices] = useState(() => {
    const saved = safeJSONParse(localStorage.getItem(LS_KEYS.devices), null);
    return Array.isArray(saved) ? saved : [];
  });

  // Inventory form
  const [form, setForm] = useState({
    brand: "Samsung",
    model: "",
    purchaseUsd: "",
    shipUsd: "",
    sellPkr: "",
  });

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEYS.usd, String(usdRate));
  }, [usdRate]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.anim, animationsOn ? "1" : "0");
  }, [animationsOn]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.slabs, JSON.stringify(slabs));
  }, [slabs]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.devices, JSON.stringify(devices));
  }, [devices]);

  const preview = useMemo(() => {
    return computeCase({
      purchaseUsd: form.purchaseUsd,
      shipUsd: form.shipUsd,
      sellPkr: form.sellPkr,
      usdRate,
      slabs,
    });
  }, [form.purchaseUsd, form.shipUsd, form.sellPkr, usdRate, slabs]);

  const bestProfitLabel = useMemo(() => {
    const p = preview.bestProfit;
    const sign = p >= 0 ? "" : "-";
    return `${sign}${fmtMoneyPKR(Math.abs(p)).replace("Rs ", "Rs ")}`;
  }, [preview.bestProfit]);

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addDevice() {
    const purchaseUsd = clampNum(form.purchaseUsd, 0);
    const shipUsd = clampNum(form.shipUsd, 0);
    const sellPkr = clampNum(form.sellPkr, 0);

    const next = {
      id: uid(),
      brand: form.brand || "Other",
      model: (form.model || "").trim() || "Device",
      purchaseUsd,
      shipUsd,
      sellPkr,
    };

    setDevices((d) => [next, ...d]);
  }

  function removeDevice(id) {
    setDevices((d) => d.filter((x) => x.id !== id));
  }

  function updateSlab(idx, key, value) {
    setSlabs((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: clampNum(value, copy[idx][key]) };
      return copy;
    });
  }

  // Export CSV
  function exportCSV() {
    const rows = [
      ["Brand", "Model", "PurchaseUSD", "ShipUSD", "SellPKR"],
      ...devices.map((d) => [d.brand, d.model, d.purchaseUsd, d.shipUsd, d.sellPkr]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phonescanada-pta-devices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export PDF (simple printable window)
  function exportPDF() {
    const w = window.open("", "_blank");
    if (!w) return;

    const style = `
      <style>
        *{box-sizing:border-box;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;}
        body{margin:0;padding:24px;background:#fff;color:#0f172a;}
        .hdr{padding:18px 18px;border:1px solid #dbe7ff;background:#f4f7ff;border-radius:14px;}
        .title{font-size:22px;font-weight:800;margin:0;text-align:center;}
        .sub{margin:6px 0 0 0;text-align:center;color:#64748b;font-size:12px;font-weight:600;}
        .sep{height:1px;background:#e5e7eb;margin:18px 0;}
        .item{border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin:16px 0;}
        .top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;}
        .name{font-size:18px;font-weight:800;margin:0;}
        .price{font-weight:800;}
        .meta{color:#64748b;font-weight:600;font-size:12px;margin-top:4px;}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;}
        .box{border:1px solid #e5e7eb;border-radius:14px;padding:12px;}
        .box h4{margin:0;font-size:12px;letter-spacing:0.18em;color:#64748b;}
        .pill{float:right;background:#e6fff4;border:1px solid #9debd0;color:#065f46;font-weight:800;font-size:11px;padding:6px 10px;border-radius:999px;}
        .row{display:flex;justify-content:space-between;gap:16px;margin-top:8px;color:#334155;font-weight:700;}
        .k{color:#64748b;font-weight:700;}
        .v{font-weight:800;}
        .profit{color:#0f766e;}
        .foot{margin-top:14px;color:#94a3b8;font-weight:600;font-size:12px;}
        @media print{ body{padding:14px;} }
      </style>
    `;

    const header = `
      <div class="hdr">
        <div class="title">PhonesCanada PTA Dashboard — Report</div>
        <div class="sub">USD/PKR Rate: ${usdRate} • GST: 18% / 25% (threshold $${GST_THRESHOLD_USD})</div>
      </div>
    `;

    const items = devices
      .map((d, i) => {
        const c = computeCase({
          purchaseUsd: d.purchaseUsd,
          shipUsd: d.shipUsd,
          sellPkr: d.sellPkr,
          usdRate,
          slabs,
        });
        const slabLabel = c.slab?.label || "USD";
        const gstPct = Math.round(c.gstRate * 100);

        return `
          <div class="item">
            <div class="top">
              <div>
                <div class="name">${i + 1}. ${d.brand} ${d.model}</div>
                <div class="meta">Slab: ${slabLabel} • GST: ${gstPct}%</div>
              </div>
              <div class="price">${fmtMoneyPKR(d.sellPkr)}</div>
            </div>

            <div class="grid">
              <div class="box">
                <h4>CNIC <span class="pill">PROFIT</span></h4>
                <div class="row"><span class="k">Base (Cost+Ship)</span><span class="v">${fmtMoneyUSD(d.purchaseUsd)} + ${fmtMoneyUSD(d.shipUsd)} (USD→PKR ${usdRate})</span></div>
                <div class="row"><span class="k">Landed</span><span class="v">${fmtMoneyPKR(c.cnic.landed)}</span></div>
                <div class="row"><span class="k">Profit</span><span class="v profit">${fmtMoneyPKR(c.cnic.profit)}</span></div>
                <div class="row"><span class="k">Margin</span><span class="v">${fmtPct(c.cnic.margin)}</span></div>
              </div>

              <div class="box">
                <h4>PASSPORT <span class="pill">PROFIT</span></h4>
                <div class="row"><span class="k">Base (Cost+Ship)</span><span class="v">${fmtMoneyUSD(d.purchaseUsd)} + ${fmtMoneyUSD(d.shipUsd)} (USD→PKR ${usdRate})</span></div>
                <div class="row"><span class="k">Landed</span><span class="v">${fmtMoneyPKR(c.passport.landed)}</span></div>
                <div class="row"><span class="k">Profit</span><span class="v profit">${fmtMoneyPKR(c.passport.profit)}</span></div>
                <div class="row"><span class="k">Margin</span><span class="v">${fmtPct(c.passport.margin)}</span></div>
              </div>
            </div>
          </div>
        `;
      })
      .join("\n");

    const html = `<!doctype html><html><head><meta charset="utf-8" />${style}</head><body>${header}<div class="sep"></div>${items}<div class="foot">Generated by PhonesCanada PTA Dashboard</div><script>window.onload=()=>{window.print();}</script></body></html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="pc-root">
      <AnimatedBackground enabled={animationsOn} />

      <div className="pc-shell">
        {/* Header */}
        <header className="pc-header">
          <div className="pc-brand">
            <img
              className="pc-brandmark"
              src="./phonescanadalogo-web.png"
              alt="Phones Canada"
              onError={(e) => {
                // if GitHub pages pathing differs, fallback to /phonescanada-pta-dashboard/... (still works locally)
                e.currentTarget.src = "/phonescanada-pta-dashboard/phonescanadalogo-web.png";
              }}
            />
          </div>
          <div className="pc-header-text">
            <h1>PhonesCanada PTA Dashboard</h1>
            <p>PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
          </div>
        </header>

        {/* Layout */}
        <div className="pc-grid">
          {/* Left column */}
          <aside className="pc-col-left">
            <section className="pc-card">
              <div className="pc-card-title">SYSTEM PREFERENCES</div>

              <label className="pc-label">USD Rate (PKR)</label>
              <input
                className="pc-input"
                value={usdRate}
                inputMode="numeric"
                onChange={(e) => setUsdRate(clampPositive(e.target.value, DEFAULT_USD_RATE))}
              />

              <div className="pc-toggle-row">
                <div>
                  <div className="pc-toggle-title">Animations</div>
                  <div className="pc-toggle-sub">Smooth blobs + prism outlines</div>
                </div>

                <button
                  className={`pc-toggle ${animationsOn ? "is-on" : "is-off"}`}
                  type="button"
                  onClick={() => setAnimationsOn((v) => !v)}
                  aria-pressed={animationsOn}
                >
                  <span className="pc-toggle-knob" />
                </button>
              </div>

              <div className="pc-hint">💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.</div>
            </section>

            <section className="pc-card">
              <div className="pc-card-title">PTA TAX SLABS (EDITABLE)</div>

              <div className="pc-slabs-head">
                <div>VALUE RANGE (USD)</div>
                <div>CNIC</div>
                <div>PASSPORT</div>
              </div>

              <div className="pc-slabs">
                {slabs.map((s, idx) => (
                  <div className="pc-slab-row" key={s.label}>
                    <div className="pc-slab-pill">{s.label}</div>

                    <input
                      className="pc-slab-input"
                      value={s.cnic}
                      inputMode="numeric"
                      onChange={(e) => updateSlab(idx, "cnic", e.target.value)}
                    />

                    <input
                      className="pc-slab-input"
                      value={s.passport}
                      inputMode="numeric"
                      onChange={(e) => updateSlab(idx, "passport", e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="pc-saved">✅ Saved automatically on this device (localStorage).</div>
            </section>
          </aside>

          {/* Right column */}
          <main className="pc-col-right">
            <section className="pc-card pc-card-wide">
              <div className="pc-topline">
                <div>
                  <div className="pc-card-title">INVENTORY PLANNING</div>
                  <div className="pc-subtitle">Add a device and instantly compare CNIC vs Passport.</div>
                  <div className="pc-subnote">Note: “Best” is chosen by higher profit (CNIC or Passport).</div>
                </div>

                <button className="pc-btn" type="button" onClick={addDevice}>
                  + Add Device
                </button>
              </div>

              {/* IMPORTANT: scroll wrapper so fields never cut off */}
              <div className="pc-form-wrap">
                <div className="pc-form">
                  <div className="pc-field">
                    <label className="pc-label">Brand</label>
                    <select
                      className="pc-select"
                      value={form.brand}
                      onChange={(e) => updateForm("brand", e.target.value)}
                    >
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pc-field">
                    <label className="pc-label">Device / Model Name</label>
                    <input
                      className="pc-input"
                      value={form.model}
                      onChange={(e) => updateForm("model", e.target.value)}
                      placeholder="e.g. iPhone 15 Pro Max"
                    />
                  </div>

                  <div className="pc-field">
                    <label className="pc-label">Purchase (USD)</label>
                    <input
                      className="pc-input"
                      value={form.purchaseUsd}
                      inputMode="decimal"
                      onChange={(e) => updateForm("purchaseUsd", e.target.value)}
                      placeholder="e.g. 1199"
                    />
                  </div>

                  <div className="pc-field">
                    <label className="pc-label">Shipping (USD)</label>
                    <input
                      className="pc-input"
                      value={form.shipUsd}
                      inputMode="decimal"
                      onChange={(e) => updateForm("shipUsd", e.target.value)}
                      placeholder="e.g. 30"
                    />
                  </div>

                  <div className="pc-field">
                    <label className="pc-label">Expected Selling Price (PKR)</label>
                    <input
                      className="pc-input"
                      value={form.sellPkr}
                      inputMode="numeric"
                      onChange={(e) => updateForm("sellPkr", e.target.value)}
                      placeholder="e.g. 525000"
                    />
                  </div>

                  <div className="pc-field">
                    <label className="pc-label">Profit / Loss (Best)</label>
                    <div className="pc-best">
                      <span className={preview.bestProfit >= 0 ? "pc-green" : "pc-red"}>
                        {bestProfitLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="pc-card pc-devices">
              <div className="pc-devices-head">
                <div className="pc-card-title">DEVICES</div>
                <div className="pc-count">{devices.length} device(s)</div>
              </div>

              <div className="pc-device-grid">
                {devices.map((d) => {
                  const c = computeCase({
                    purchaseUsd: d.purchaseUsd,
                    shipUsd: d.shipUsd,
                    sellPkr: d.sellPkr,
                    usdRate,
                    slabs,
                  });

                  const slabLabel = c.slab?.label || "USD";
                  const gstPct = Math.round(c.gstRate * 100);

                  return (
                    <article className="pc-device" key={d.id}>
                      <div className="pc-device-head">
                        <div>
                          <div className="pc-device-brand">{d.brand.toUpperCase()}</div>
                          <div className="pc-device-model">{d.model}</div>
                        </div>
                        <button className="pc-trash" type="button" onClick={() => removeDevice(d.id)}>
                          🗑️
                        </button>
                      </div>

                      <div className="pc-pills">
                        <span className="pc-pill">Slab: {slabLabel}</span>
                        <span className="pc-pill">GST: {gstPct}%</span>
                      </div>

                      {/* CNIC */}
                      <div className="pc-section">
                        <div className="pc-section-head">
                          <div className="pc-section-title">CNIC</div>
                          <div className="pc-profit-pill">
                            PROFIT • {fmtMoneyPKR(c.cnic.profit).replace("Rs ", "Rs ")}
                          </div>
                        </div>

                        <div className="pc-metrics">
                          <div className="pc-mrow">
                            <div className="k">Base</div>
                            <div className="v">{fmtMoneyUSD(d.purchaseUsd)} + {fmtMoneyUSD(d.shipUsd)}</div>
                            <div className="k">GST</div>
                            <div className="v">{fmtMoneyPKR(c.gstPkr)}</div>
                          </div>

                          <div className="pc-mrow">
                            <div className="k">Landed</div>
                            <div className="v">{fmtMoneyPKR(c.cnic.landed)}</div>
                            <div className="k">Sale</div>
                            <div className="v">{fmtMoneyPKR(d.sellPkr)}</div>
                          </div>

                          <div className="pc-mrow">
                            <div className="k">Profit</div>
                            <div className={`v ${c.cnic.profit >= 0 ? "pc-green" : "pc-red"}`}>
                              {fmtMoneyPKR(c.cnic.profit)}
                            </div>
                            <div className="k">Margin</div>
                            <div className="v">{fmtPct(c.cnic.margin)}</div>
                          </div>
                        </div>
                      </div>

                      {/* PASSPORT */}
                      <div className="pc-section">
                        <div className="pc-section-head">
                          <div className="pc-section-title">PASSPORT</div>
                          <div className="pc-profit-pill">
                            PROFIT • {fmtMoneyPKR(c.passport.profit).replace("Rs ", "Rs ")}
                          </div>
                        </div>

                        <div className="pc-metrics">
                          <div className="pc-mrow">
                            <div className="k">Base</div>
                            <div className="v">{fmtMoneyUSD(d.purchaseUsd)} + {fmtMoneyUSD(d.shipUsd)}</div>
                            <div className="k">GST</div>
                            <div className="v">{fmtMoneyPKR(c.gstPkr)}</div>
                          </div>

                          <div className="pc-mrow">
                            <div className="k">Landed</div>
                            <div className="v">{fmtMoneyPKR(c.passport.landed)}</div>
                            <div className="k">Sale</div>
                            <div className="v">{fmtMoneyPKR(d.sellPkr)}</div>
                          </div>

                          <div className="pc-mrow">
                            <div className="k">Profit</div>
                            <div className={`v ${c.passport.profit >= 0 ? "pc-green" : "pc-red"}`}>
                              {fmtMoneyPKR(c.passport.profit)}
                            </div>
                            <div className="k">Margin</div>
                            <div className="v">{fmtPct(c.passport.margin)}</div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="pc-export">
                <div className="pc-export-text">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-export-actions">
                  <button className="pc-export-btn" type="button" onClick={exportCSV}>
                    ⬇ CSV
                  </button>
                  <button className="pc-export-btn" type="button" onClick={exportPDF}>
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

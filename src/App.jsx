import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LS_KEYS = {
  usd: "pc_usd_rate",
  anim: "pc_anim_enabled",
  slabs: "pc_tax_slabs",
  devices: "pc_devices",
};

const DEFAULT_USD_RATE = 278;

// NOTE: These are PTA tax amounts in PKR (editable)
const DEFAULT_SLABS = [
  { range: "0–30", cnic: 550, passport: 430 },
  { range: "31–100", cnic: 4323, passport: 3200 },
  { range: "101–200", cnic: 11561, passport: 9580 },
  { range: "201–350", cnic: 14661, passport: 12200 },
  { range: "351–500", cnic: 23420, passport: 17800 },
  { range: "501+", cnic: 37007, passport: 36870 },
];

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function formatPKR(n) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString("en-PK");
}

function formatUSD(n) {
  const x = Number.isFinite(n) ? n : 0;
  // keep as minimal decimals
  return x % 1 === 0 ? x.toFixed(0) : x.toFixed(2);
}

function clampNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getSlabIndexFromUsd(usd) {
  const v = clampNum(usd, 0);
  if (v <= 30) return 0;
  if (v <= 100) return 1;
  if (v <= 200) return 2;
  if (v <= 350) return 3;
  if (v <= 500) return 4;
  return 5;
}

function calcFor(docType, device, usdRate, slabs) {
  // docType: "cnic" | "passport"
  const purchaseUsd = clampNum(device.purchaseUsd, 0);
  const shipUsd = clampNum(device.shippingUsd, 0);
  const sellingPkr = clampNum(device.sellingPkr, 0);

  const slabIdx = getSlabIndexFromUsd(purchaseUsd);
  const slab = slabs?.[slabIdx] ?? DEFAULT_SLABS[slabIdx];
  const ptaTax = docType === "passport" ? clampNum(slab.passport, 0) : clampNum(slab.cnic, 0);

  // GST behavior (as in earlier spec): 18% below $500, 25% at/above $500
  const gstRate = purchaseUsd >= 500 ? 0.25 : 0.18;

  const basePkr = (purchaseUsd + shipUsd) * usdRate;
  const gstPkr = purchaseUsd * usdRate * gstRate;
  const landedPkr = basePkr + ptaTax + gstPkr;
  const profitPkr = sellingPkr - landedPkr;
  const marginPct = sellingPkr > 0 ? (profitPkr / sellingPkr) * 100 : 0;

  return {
    slabIdx,
    slabLabel: slab?.range ?? "",
    gstRate,
    ptaTax,
    basePkr,
    gstPkr,
    landedPkr,
    profitPkr,
    marginPct,
  };
}

function bestOfTwo(a, b) {
  const ap = a?.profitPkr ?? Number.NEGATIVE_INFINITY;
  const bp = b?.profitPkr ?? Number.NEGATIVE_INFINITY;
  return ap >= bp ? { best: "CNIC", value: ap } : { best: "Passport", value: bp };
}

function AnimatedBackground({ enabled }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // Shapes: mix of rounded rectangles + polygons (prisms / paragons vibe)
    const shapeCount = 24;
    const shapes = Array.from({ length: shapeCount }).map((_, i) => {
      const r = 10 + Math.random() * 22;
      return {
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.006,
        r,
        sides: [4, 5, 6, 7][Math.floor(Math.random() * 4)],
        round: 6 + Math.random() * 10,
      };
    });

    const stroke = "rgba(148,163,184,0.35)"; // soft gray

    function drawPoly(x, y, radius, sides, rot) {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = rot + (i * Math.PI * 2) / sides;
        const px = x + Math.cos(a) * radius;
        const py = y + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function drawRoundRect(x, y, w, h, rr, rot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const rx = -w / 2;
      const ry = -h / 2;
      const r = Math.min(rr, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + w - r, ry);
      ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + r);
      ctx.lineTo(rx + w, ry + h - r);
      ctx.quadraticCurveTo(rx + w, ry + h, rx + w - r, ry + h);
      ctx.lineTo(rx + r, ry + h);
      ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      ctx.restore();
    }

    const collide = (a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.r + b.r + 6;
      if (dist > 0 && dist < minDist) {
        // push apart
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) * 0.5;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        // exchange velocity along normal (soft)
        const av = a.vx * nx + a.vy * ny;
        const bv = b.vx * nx + b.vy * ny;
        const diff = bv - av;
        const impulse = diff * 0.55;
        a.vx += impulse * nx;
        a.vy += impulse * ny;
        b.vx -= impulse * nx;
        b.vy -= impulse * ny;
      }
    };

    const step = () => {
      rafRef.current = requestAnimationFrame(step);
      const W = window.innerWidth;
      const H = window.innerHeight;

      ctx.clearRect(0, 0, W, H);
      if (!enabled) return;

      // update
      for (const s of shapes) {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vr;

        // boundary bounce
        if (s.x < s.r) {
          s.x = s.r;
          s.vx *= -1;
        }
        if (s.x > W - s.r) {
          s.x = W - s.r;
          s.vx *= -1;
        }
        if (s.y < s.r) {
          s.y = s.r;
          s.vy *= -1;
        }
        if (s.y > H - s.r) {
          s.y = H - s.r;
          s.vy *= -1;
        }
      }

      // collisions
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          collide(shapes[i], shapes[j]);
        }
      }

      // draw
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = stroke;
      for (const s of shapes) {
        const isRect = s.sides === 4 && s.id % 3 === 0;
        if (isRect) {
          drawRoundRect(s.x, s.y, s.r * 2.3, s.r * 1.4, s.round, s.rot);
          ctx.stroke();
        } else {
          drawPoly(s.x, s.y, s.r, s.sides, s.rot);
          ctx.stroke();
        }
      }
    };

    step();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [enabled]);

  return <canvas className="pc-bg-canvas" ref={canvasRef} aria-hidden="true" />;
}

function Toggle({ value, onChange, label }) {
  return (
    <div className="pc-toggle-row">
      <div className="pc-toggle-text">
        <div className="pc-toggle-title">{label}</div>
        <div className="pc-toggle-sub">Smooth blobs + prism outlines</div>
      </div>
      <button
        type="button"
        className={`pc-toggle ${value ? "is-on" : "is-off"}`}
        aria-pressed={value}
        onClick={() => onChange(!value)}
      >
        <span className="pc-toggle-knob" />
      </button>
    </div>
  );
}

export default function App() {
  const [usdRate, setUsdRate] = useState(() => clampNum(localStorage.getItem(LS_KEYS.usd), DEFAULT_USD_RATE));
  const [animEnabled, setAnimEnabled] = useState(() => {
    const raw = localStorage.getItem(LS_KEYS.anim);
    return raw === null ? true : raw === "1";
  });
  const [slabs, setSlabs] = useState(() => {
    const raw = localStorage.getItem(LS_KEYS.slabs);
    return raw ? safeParse(raw, DEFAULT_SLABS) : DEFAULT_SLABS;
  });
  const [devices, setDevices] = useState(() => {
    const raw = localStorage.getItem(LS_KEYS.devices);
    return raw ? safeParse(raw, []) : [];
  });

  // inventory planning form
  const [brand, setBrand] = useState("Samsung");
  const [model, setModel] = useState("");
  const [purchaseUsd, setPurchaseUsd] = useState("");
  const [shippingUsd, setShippingUsd] = useState("");
  const [sellingPkr, setSellingPkr] = useState("");

  useEffect(() => {
    localStorage.setItem(LS_KEYS.usd, String(usdRate));
  }, [usdRate]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.anim, animEnabled ? "1" : "0");
  }, [animEnabled]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.slabs, JSON.stringify(slabs));
  }, [slabs]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.devices, JSON.stringify(devices));
  }, [devices]);

  const preview = useMemo(() => {
    const d = {
      brand,
      model: model.trim() || "(Device)",
      purchaseUsd: clampNum(purchaseUsd, 0),
      shippingUsd: clampNum(shippingUsd, 0),
      sellingPkr: clampNum(sellingPkr, 0),
    };
    const c = calcFor("cnic", d, usdRate, slabs);
    const p = calcFor("passport", d, usdRate, slabs);
    const best = bestOfTwo(c, p);
    return { device: d, c, p, best };
  }, [brand, model, purchaseUsd, shippingUsd, sellingPkr, usdRate, slabs]);

  const addDevice = () => {
    const d = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      brand,
      model: model.trim() || "(Device)",
      purchaseUsd: clampNum(purchaseUsd, 0),
      shippingUsd: clampNum(shippingUsd, 0),
      sellingPkr: clampNum(sellingPkr, 0),
      createdAt: Date.now(),
    };
    setDevices((prev) => [d, ...prev]);
    // keep inputs; user requested speed
  };

  const removeDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id));

  const exportCSV = () => {
    const rows = [
      ["Brand", "Model", "Purchase (USD)", "Shipping (USD)", "Selling (PKR)", "CNIC Profit (PKR)", "Passport Profit (PKR)"],
      ...devices.map((d) => {
        const c = calcFor("cnic", d, usdRate, slabs);
        const p = calcFor("passport", d, usdRate, slabs);
        return [
          d.brand,
          d.model,
          formatUSD(d.purchaseUsd),
          formatUSD(d.shippingUsd),
          formatPKR(d.sellingPkr),
          formatPKR(c.profitPkr),
          formatPKR(p.profitPkr),
        ];
      }),
    ];

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            const needs = /[\n",]/.test(s);
            return needs ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phonescanada-pta-devices.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // keep styling consistent with current good PDF; remove logo entirely.
    const rows = devices.map((d, idx) => {
      const c = calcFor("cnic", d, usdRate, slabs);
      const p = calcFor("passport", d, usdRate, slabs);
      const slabLabel = slabs?.[c.slabIdx]?.range ?? "";
      const gstPct = Math.round((c.gstRate || 0) * 100);

      const box = (title, data) => {
        return `
          <div class="pdf-box">
            <div class="pdf-box-top">
              <div class="pdf-box-title">${title}</div>
              <div class="pdf-profit-label">PROFIT</div>
            </div>
            <div class="pdf-grid">
              <div class="k">Base (Cost+Ship)</div>
              <div class="v">$${formatUSD(d.purchaseUsd)} + $${formatUSD(d.shippingUsd)} (USD→PKR ${formatPKR(usdRate)})</div>
              <div class="k">Landed</div>
              <div class="v">Rs ${formatPKR(data.landedPkr)}</div>
              <div class="k">Profit</div>
              <div class="v profit">Rs ${formatPKR(data.profitPkr)}</div>
              <div class="k">Margin</div>
              <div class="v">${data.marginPct.toFixed(1)}%</div>
            </div>
          </div>
        `;
      };

      return `
        <div class="pdf-device">
          <div class="pdf-device-head">
            <div>
              <div class="pdf-device-title">${idx + 1}. ${d.brand} ${d.model}</div>
              <div class="pdf-device-sub">Slab: ${slabLabel || "USD"} USD • GST: ${gstPct}%</div>
            </div>
            <div class="pdf-device-price">Rs ${formatPKR(d.sellingPkr)}</div>
          </div>
          <div class="pdf-row">
            ${box("CNIC", c)}
            ${box("PASSPORT", p)}
          </div>
        </div>
      `;
    });

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PhonesCanada PTA Dashboard — Report</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; margin:0; background:#fff; color:#0f172a;}
    .page{padding:28px 32px; max-width:1100px; margin:0 auto;}
    .pdf-header{border:1px solid #e5e7eb; background:#f4f6ff; border-radius:18px; padding:18px 22px;}
    .pdf-title{font-size:28px; font-weight:700; text-align:center; margin:0;}
    .pdf-sub{margin:6px 0 0; text-align:center; color:#64748b; font-size:13px;}
    .divider{height:1px; background:#e5e7eb; margin:22px 0;}

    .pdf-device{border:1px solid #e5e7eb; border-radius:18px; padding:18px; margin:18px 0; background:#fbfcff;}
    .pdf-device-head{display:flex; align-items:flex-start; justify-content:space-between; gap:18px;}
    .pdf-device-title{font-size:20px; font-weight:700; margin:0;}
    .pdf-device-sub{font-size:13px; color:#64748b; margin-top:4px;}
    .pdf-device-price{font-size:18px; font-weight:700; white-space:nowrap;}

    .pdf-row{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px;}
    .pdf-box{border:1px solid #e5e7eb; border-radius:16px; padding:14px 14px 12px; background:#fff;}
    .pdf-box-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;}
    .pdf-box-title{font-weight:800; letter-spacing:0.12em; font-size:13px; color:#475569;}
    .pdf-profit-label{font-weight:800; letter-spacing:0.18em; font-size:12px; color:#065f46;}
    .pdf-grid{display:grid; grid-template-columns:150px 1fr; gap:8px 10px; font-size:13px;}
    .k{color:#64748b;}
    .v{font-weight:600; text-align:right;}
    .profit{color:#065f46;}

    .foot{margin-top:18px; color:#94a3b8; font-size:12px;}

    @media print{
      body{background:#fff;}
      .page{padding:0;}
      .pdf-device{break-inside:avoid;}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="pdf-header">
      <h1 class="pdf-title">PhonesCanada PTA Dashboard — Report</h1>
      <div class="pdf-sub">USD/PKR Rate: ${formatPKR(usdRate)} • GST: 18% / 25% (threshold $500)</div>
    </div>
    <div class="divider"></div>
    ${rows.join("\n")}
    <div class="foot">Generated by PhonesCanada PTA Dashboard</div>
  </div>
  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const gstHint = "GST auto-switches at $500: 18% below / 25% at or above.";

  return (
    <div className="pc-app">
      <AnimatedBackground enabled={animEnabled} />

      <div className="pc-shell">
        <header className="pc-header">
          <div className="pc-brand">
            <div className="pc-brandmark" aria-hidden="true">
              <img
                src={`${import.meta.env.BASE_URL}phonescanadalogo-web.png`}
                alt="Phones Canada"
                className="pc-logo"
                onError={(e) => {
                  // prevent crash if asset missing
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <div className="pc-brandtext">
              <div className="pc-title">PhonesCanada PTA Dashboard</div>
              <div className="pc-subtitle">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
            </div>
          </div>
        </header>

        <main className="pc-grid">
          <aside className="pc-col-left">
            <section className="pc-card">
              <div className="pc-card-h">SYSTEM PREFERENCES</div>

              <div className="pc-field">
                <label className="pc-label">USD Rate (PKR)</label>
                <input
                  className="pc-input"
                  inputMode="numeric"
                  value={usdRate}
                  onChange={(e) => setUsdRate(clampNum(e.target.value, DEFAULT_USD_RATE))}
                />
              </div>

              <div className="pc-soft-divider" />

              <Toggle label="Animations" value={animEnabled} onChange={setAnimEnabled} />

              <div className="pc-hint">
                <span className="pc-hint-ico" aria-hidden="true">
                  💡
                </span>
                <span>{gstHint}</span>
              </div>
            </section>

            <section className="pc-card pc-card--slabs">
              <div className="pc-card-h">PTA TAX SLABS (EDITABLE)</div>

              <div className="pc-slabs">
                <div className="pc-slabs-head">
                  <div>VALUE RANGE (USD)</div>
                  <div>CNIC</div>
                  <div>PASSPORT</div>
                </div>

                {slabs.map((s, idx) => (
                  <div className="pc-slabs-row" key={idx}>
                    <div className="pc-pill">{s.range}{s.range.endsWith("+") ? "" : " USD"}</div>
                    <input
                      className="pc-slab-in"
                      inputMode="numeric"
                      value={s.cnic}
                      onChange={(e) => {
                        const v = clampNum(e.target.value, s.cnic);
                        setSlabs((prev) => prev.map((x, i) => (i === idx ? { ...x, cnic: v } : x)));
                      }}
                    />
                    <input
                      className="pc-slab-in"
                      inputMode="numeric"
                      value={s.passport}
                      onChange={(e) => {
                        const v = clampNum(e.target.value, s.passport);
                        setSlabs((prev) => prev.map((x, i) => (i === idx ? { ...x, passport: v } : x)));
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="pc-saved">
                <span className="pc-check" aria-hidden="true">
                  ✓
                </span>
                Saved automatically on this device (localStorage).
              </div>
            </section>
          </aside>

          <section className="pc-col-right">
            <section className="pc-card pc-card--inv">
              <div className="pc-card-top">
                <div>
                  <div className="pc-card-h">INVENTORY PLANNING</div>
                  <div className="pc-card-sub">Add a device and instantly compare CNIC vs Passport.</div>
                  <div className="pc-note">Note: “Best” is chosen by higher profit (CNIC or Passport).</div>
                </div>
                <button className="pc-btn" type="button" onClick={addDevice}>
                  <span className="pc-btn-plus" aria-hidden="true">
                    +
                  </span>
                  Add Device
                </button>
              </div>

              <div className="pc-form">
                <div className="pc-form-field" data-size="sm">
                  <label className="pc-label">Brand</label>
                  <select className="pc-input" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option>Samsung</option>
                    <option>Apple</option>
                    <option>Realme</option>
                    <option>Xiaomi</option>
                    <option>Oppo</option>
                    <option>Vivo</option>
                    <option>Infinix</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="pc-form-field" data-size="lg">
                  <label className="pc-label">Device / Model Name</label>
                  <input
                    className="pc-input"
                    placeholder="e.g. iPhone 15 Pro Max"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>

                <div className="pc-form-field" data-size="xs">
                  <label className="pc-label">Purchase (USD)</label>
                  <input
                    className="pc-input"
                    inputMode="decimal"
                    placeholder="e.g. 350"
                    value={purchaseUsd}
                    onChange={(e) => setPurchaseUsd(e.target.value)}
                  />
                </div>

                <div className="pc-form-field" data-size="xs">
                  <label className="pc-label">Shipping (USD)</label>
                  <input
                    className="pc-input"
                    inputMode="decimal"
                    placeholder="e.g. 15"
                    value={shippingUsd}
                    onChange={(e) => setShippingUsd(e.target.value)}
                  />
                </div>

                <div className="pc-form-field" data-size="md">
                  <label className="pc-label">Expected Selling Price (PKR)</label>
                  <input
                    className="pc-input"
                    inputMode="numeric"
                    placeholder="e.g. 125000"
                    value={sellingPkr}
                    onChange={(e) => setSellingPkr(e.target.value)}
                  />
                </div>

                <div className="pc-form-field" data-size="md">
                  <label className="pc-label">Profit / Loss (Best)</label>
                  <div className="pc-best">
                    <div className={`pc-best-val solo ${Number(preview.best.value) < 0 ? "negative" : ""}`}>
                      {Number(preview.best.value) < 0 ? "-Rs " : "Rs "}{formatPKR(Math.abs(Number(preview.best.value)))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="pc-section-spacer" />

            <section className="pc-card pc-card--devices">
              <div className="pc-dev-head">
                <div className="pc-dev-title">DEVICES</div>
                <div className="pc-dev-count">{devices.length} device(s)</div>
              </div>

              <div className="pc-dev-list">
                {devices.map((d) => {
                  const c = calcFor("cnic", d, usdRate, slabs);
                  const p = calcFor("passport", d, usdRate, slabs);
                  const slabLabel = slabs?.[c.slabIdx]?.range ?? "USD";
                  const gstPct = Math.round((c.gstRate || 0) * 100);

                  return (
                    <article className="pc-device" key={d.id}>
                      <div className="pc-device-top">
                        <div>
                          <div className="pc-device-brand">{(d.brand || "").toUpperCase()}</div>
                          <div className="pc-device-model">{d.model}</div>
                        </div>
                        <button className="pc-icon-btn" type="button" onClick={() => removeDevice(d.id)} aria-label="Delete">
                          🗑️
                        </button>
                      </div>

                      <div className="pc-tags">
                        <span className="pc-tag">Slab: {slabLabel} USD</span>
                        <span className="pc-tag">GST: {gstPct}%</span>
                      </div>

                      <div className="pc-panes">
                        <div className="pc-pane">
                          <div className="pc-pane-head">
                            <div className="pc-pane-title">CNIC</div>
                            <div className="pc-profit-pill">PROFIT • Rs {formatPKR(c.profitPkr)}</div>
                          </div>

                          <div className="pc-metrics">
                            <div className="pc-mrow">
                              <div className="k">Base</div>
                              <div className="v">$ {formatUSD(d.purchaseUsd)} + $ {formatUSD(d.shippingUsd)}</div>
                              <div className="k">GST</div>
                              <div className="v">Rs {formatPKR(c.gstPkr)}</div>
                            </div>
                            <div className="pc-mrow">
                              <div className="k">Landed</div>
                              <div className="v">Rs {formatPKR(c.landedPkr)}</div>
                              <div className="k">Sale</div>
                              <div className="v">Rs {formatPKR(d.sellingPkr)}</div>
                            </div>
                            <div className="pc-mrow">
                              <div className="k">Profit</div>
                              <div className="v green">Rs {formatPKR(c.profitPkr)}</div>
                              <div className="k">Margin</div>
                              <div className="v">{c.marginPct.toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>

                        <div className="pc-pane">
                          <div className="pc-pane-head">
                            <div className="pc-pane-title">PASSPORT</div>
                            <div className="pc-profit-pill">PROFIT • Rs {formatPKR(p.profitPkr)}</div>
                          </div>

                          <div className="pc-metrics">
                            <div className="pc-mrow">
                              <div className="k">Base</div>
                              <div className="v">$ {formatUSD(d.purchaseUsd)} + $ {formatUSD(d.shippingUsd)}</div>
                              <div className="k">GST</div>
                              <div className="v">Rs {formatPKR(p.gstPkr)}</div>
                            </div>
                            <div className="pc-mrow">
                              <div className="k">Landed</div>
                              <div className="v">Rs {formatPKR(p.landedPkr)}</div>
                              <div className="k">Sale</div>
                              <div className="v">Rs {formatPKR(d.sellingPkr)}</div>
                            </div>
                            <div className="pc-mrow">
                              <div className="k">Profit</div>
                              <div className="v green">Rs {formatPKR(p.profitPkr)}</div>
                              <div className="k">Margin</div>
                              <div className="v">{p.marginPct.toFixed(1)}%</div>
                            </div>
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
                    ⬇︎ <span>CSV</span>
                  </button>
                  <button className="pc-export-btn" type="button" onClick={exportPDF}>
                    ⬇︎ <span>PDF</span>
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

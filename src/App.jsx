import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

// ---------- Utilities ----------
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const formatPKR = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
};

const formatUSD = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
};

const pct = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(1)}%`;
};

const DEFAULT_SLABS = [
  { range: "0–30 USD", min: 0, max: 30, cnic: 550, passport: 430 },
  { range: "31–100 USD", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { range: "101–200 USD", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { range: "201–350 USD", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { range: "351–500 USD", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { range: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 },
];

const getSlabFor = (usdValue, slabs) => {
  const v = Number(usdValue);
  if (!Number.isFinite(v)) return slabs[0];
  return (
    slabs.find((s) => v >= s.min && v <= s.max) ||
    slabs[slabs.length - 1]
  );
};

// GST auto-switch threshold rule (as user requested earlier)
const getGstRate = (usdBasePlusShip, threshold = 500) => {
  const v = Number(usdBasePlusShip);
  if (!Number.isFinite(v)) return 0.18;
  return v >= threshold ? 0.25 : 0.18;
};

// Core math: landed cost = (base+ship)*rate + PTA + GST
// Profit = sale - landed
const compute = ({ purchaseUsd, shipUsd, usdToPkr, salePkr, slabs }) => {
  const baseUsd = Number(purchaseUsd) + Number(shipUsd);
  const fx = Number(usdToPkr);
  const sale = Number(salePkr);

  if (![baseUsd, fx, sale].every(Number.isFinite)) {
    return {
      slab: getSlabFor(0, slabs),
      gst: 0.18,
      cnic: { landed: NaN, profit: NaN, margin: NaN, pta: NaN, baseUsd },
      passport: { landed: NaN, profit: NaN, margin: NaN, pta: NaN, baseUsd },
    };
  }

  const slab = getSlabFor(baseUsd, slabs);
  const gst = getGstRate(baseUsd, 500);

  const basePkr = baseUsd * fx;

  const cnicPta = Number(slab.cnic);
  const passPta = Number(slab.passport);

  const cnicLanded = basePkr + cnicPta + basePkr * gst;
  const passLanded = basePkr + passPta + basePkr * gst;

  const cnicProfit = sale - cnicLanded;
  const passProfit = sale - passLanded;

  const cnicMargin = sale > 0 ? cnicProfit / sale : NaN;
  const passMargin = sale > 0 ? passProfit / sale : NaN;

  return {
    slab,
    gst,
    cnic: {
      landed: cnicLanded,
      profit: cnicProfit,
      margin: cnicMargin,
      pta: cnicPta,
      baseUsd,
      basePkr,
      sale,
    },
    passport: {
      landed: passLanded,
      profit: passProfit,
      margin: passMargin,
      pta: passPta,
      baseUsd,
      basePkr,
      sale,
    },
  };
};

// ---------- Animated background (soft shapes + gentle collisions) ----------
function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function AnimatedBackground({ enabled }) {
  const { w, h } = useWindowSize();
  const rafRef = useRef(null);
  const shapesRef = useRef([]);
  const [, force] = useState(0);

  // create shapes once
  useEffect(() => {
    const rand = (a, b) => a + Math.random() * (b - a);
    const types = ["prism", "hex", "diamond"]; // “prisms/paragons” feel

    const make = () => {
      const count = 9; // small but visible
      const shapes = Array.from({ length: count }).map((_, i) => {
        const size = rand(26, 64);
        const type = types[i % types.length];
        return {
          id: `s-${i}`,
          type,
          x: rand(0, Math.max(0, w - size)),
          y: rand(0, Math.max(0, h - size)),
          vx: rand(-0.35, 0.35),
          vy: rand(-0.28, 0.28),
          size,
          rot: rand(0, 360),
          vr: rand(-0.10, 0.10),
        };
      });
      shapesRef.current = shapes;
    };

    make();
  }, [w, h]);

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tick = () => {
      const shapes = shapesRef.current;
      if (!shapes || shapes.length === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // move + wall bounce
      for (const s of shapes) {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vr;

        const maxX = Math.max(0, w - s.size);
        const maxY = Math.max(0, h - s.size);

        if (s.x <= 0 || s.x >= maxX) s.vx *= -1;
        if (s.y <= 0 || s.y >= maxY) s.vy *= -1;

        s.x = clamp(s.x, 0, maxX);
        s.y = clamp(s.y, 0, maxY);
      }

      // gentle collisions (approx circles)
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const a = shapes[i];
          const b = shapes[j];
          const ar = a.size * 0.52;
          const br = b.size * 0.52;
          const ax = a.x + a.size / 2;
          const ay = a.y + a.size / 2;
          const bx = b.x + b.size / 2;
          const by = b.y + b.size / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.hypot(dx, dy);
          const minDist = ar + br;
          if (dist > 0 && dist < minDist) {
            // push apart
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) * 0.06;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;

            // swap velocity slightly (soft repel)
            const tmpx = a.vx;
            const tmpy = a.vy;
            a.vx = b.vx;
            a.vy = b.vy;
            b.vx = tmpx;
            b.vy = tmpy;
          }
        }
      }

      // repaint (cheap)
      force((v) => (v + 1) % 100000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, w, h]);

  if (!enabled) return null;

  return (
    <div className="pc-bg" aria-hidden="true">
      <div className="pc-bg-gradient" />
      {shapesRef.current.map((s) => (
        <div
          key={s.id}
          className={`pc-shape pc-shape--${s.type}`}
          style={{
            width: s.size,
            height: s.size,
            transform: `translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [usdToPkr, setUsdToPkr] = useState(() => {
    const v = localStorage.getItem("pc_usdToPkr");
    return v ? Number(v) : 278;
  });

  const [animationsOn, setAnimationsOn] = useState(() => {
    const v = localStorage.getItem("pc_animationsOn");
    return v ? v === "true" : true;
  });

  const [slabs, setSlabs] = useState(() => {
    const raw = localStorage.getItem("pc_slabs");
    try {
      return raw ? JSON.parse(raw) : DEFAULT_SLABS;
    } catch {
      return DEFAULT_SLABS;
    }
  });

  // inventory planning
  const [brand, setBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [purchaseUsd, setPurchaseUsd] = useState("");
  const [shipUsd, setShipUsd] = useState("");
  const [salePkr, setSalePkr] = useState("");

  // devices list
  const [devices, setDevices] = useState(() => {
    const raw = localStorage.getItem("pc_devices");
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // logo (data URL for reliable PDF export)
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  useEffect(() => {
    localStorage.setItem("pc_usdToPkr", String(usdToPkr || 0));
  }, [usdToPkr]);

  useEffect(() => {
    localStorage.setItem("pc_animationsOn", String(animationsOn));
  }, [animationsOn]);

  useEffect(() => {
    localStorage.setItem("pc_slabs", JSON.stringify(slabs));
  }, [slabs]);

  useEffect(() => {
    localStorage.setItem("pc_devices", JSON.stringify(devices));
  }, [devices]);

  useEffect(() => {
    let cancelled = false;
    // convert public image to dataURL so html2canvas can embed it reliably
    fetch("/phonescanadalogo-web.png")
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (!cancelled) setLogoDataUrl(dataUrl);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const liveCalc = useMemo(() => {
    return compute({
      purchaseUsd: Number(purchaseUsd || 0),
      shipUsd: Number(shipUsd || 0),
      usdToPkr: Number(usdToPkr || 0),
      salePkr: Number(salePkr || 0),
      slabs,
    });
  }, [purchaseUsd, shipUsd, usdToPkr, salePkr, slabs]);

  // Inventory: show CNIC profit, but mention “best assumes passport” as requested
  const invProfitDisplay = useMemo(() => {
    const p = liveCalc?.cnic?.profit;
    if (!Number.isFinite(p)) return { text: "—", sign: "neutral" };
    const sign = p >= 0 ? "pos" : "neg";
    const abs = Math.abs(p);
    return { text: `${p >= 0 ? "Rs" : "-Rs"} ${formatPKR(abs)}`, sign };
  }, [liveCalc]);

  const addDevice = () => {
    const p = Number(purchaseUsd);
    const s = Number(shipUsd);
    const sale = Number(salePkr);
    if (!brand || !modelName || !Number.isFinite(p) || !Number.isFinite(s) || !Number.isFinite(sale)) return;

    const result = compute({ purchaseUsd: p, shipUsd: s, usdToPkr: Number(usdToPkr), salePkr: sale, slabs });

    const d = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      brand,
      modelName,
      purchaseUsd: p,
      shipUsd: s,
      salePkr: sale,
      slabRange: result.slab.range,
      gst: result.gst,
      cnic: {
        baseUsd: result.cnic.baseUsd,
        landed: result.cnic.landed,
        profit: result.cnic.profit,
        margin: result.cnic.margin,
        pta: result.cnic.pta,
      },
      passport: {
        baseUsd: result.passport.baseUsd,
        landed: result.passport.landed,
        profit: result.passport.profit,
        margin: result.passport.margin,
        pta: result.passport.pta,
      },
    };

    setDevices((prev) => [d, ...prev]);

    // reset form
    setBrand("");
    setModelName("");
    setPurchaseUsd("");
    setShipUsd("");
    setSalePkr("");
  };

  const removeDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id));

  // ---------- Export helpers ----------
  const exportCSV = () => {
    const headers = [
      "Brand",
      "Model",
      "Sale (PKR)",
      "Slab",
      "GST",
      "CNIC Base(USD)",
      "CNIC Landed(PKR)",
      "CNIC Profit(PKR)",
      "CNIC Margin",
      "Passport Base(USD)",
      "Passport Landed(PKR)",
      "Passport Profit(PKR)",
      "Passport Margin",
    ];

    const rows = devices.map((d) => [
      d.brand,
      d.modelName,
      d.salePkr,
      d.slabRange,
      `${Math.round(d.gst * 100)}%`,
      d.cnic.baseUsd,
      Math.round(d.cnic.landed),
      Math.round(d.cnic.profit),
      (d.cnic.margin * 100).toFixed(1) + "%",
      d.passport.baseUsd,
      Math.round(d.passport.landed),
      Math.round(d.passport.profit),
      (d.passport.margin * 100).toFixed(1) + "%",
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`).join(","))
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

  const exportPDF = async () => {
    // dynamic imports so Vite builds cleanly and bundle stays light
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const el = document.getElementById("pc-pdf-root");
    if (!el) return;

    // ensure logo is embedded
    const logoImg = el.querySelector("img[data-pc-logo]");
    if (logoImg && logoDataUrl) logoImg.src = logoDataUrl;

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    let remaining = imgHeight;

    while (remaining > 0) {
      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
      remaining -= pageHeight;
      if (remaining > 0) {
        pdf.addPage();
        y -= pageHeight;
      }
    }

    pdf.save("phonescanada-pta-report.pdf");
  };

  return (
    <div className="pc-app">
      <AnimatedBackground enabled={animationsOn} />

      <header className="pc-header">
        <div className="pc-header__brand">
          <div className="pc-brandmark" aria-hidden="true">
            <img
              className="pc-brandmark__img"
              src={logoDataUrl || "/phonescanadalogo-web.png"}
              alt="Phones Canada"
              loading="eager"
            />
          </div>
          <div className="pc-title">
            <div className="pc-title__h1">PhonesCanada PTA Dashboard</div>
            <div className="pc-title__sub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
          </div>
        </div>
      </header>

      <main className="pc-wrap">
        <section className="pc-grid">
          {/* Left column */}
          <div className="pc-col">
            <div className="pc-card">
              <div className="pc-card__head">
                <div className="pc-card__title">SYSTEM PREFERENCES</div>
              </div>

              <div className="pc-form">
                <label className="pc-label">
                  <span>USD Rate (PKR)</span>
                  <input
                    className="pc-input"
                    type="number"
                    value={usdToPkr}
                    onChange={(e) => setUsdToPkr(Number(e.target.value))}
                    min={1}
                  />
                </label>

                <div className="pc-toggleRow">
                  <div>
                    <div className="pc-toggleRow__title">Animations</div>
                    <div className="pc-toggleRow__sub">Smooth blobs + prism outlines</div>
                  </div>

                  <button
                    type="button"
                    className={`pc-switch ${animationsOn ? "is-on" : "is-off"}`}
                    onClick={() => setAnimationsOn((v) => !v)}
                    aria-pressed={animationsOn}
                    aria-label="Toggle background animations"
                  >
                    <span className="pc-switch__track" />
                    <span className="pc-switch__thumb" />
                  </button>
                </div>

                <div className="pc-hint">
                  💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.
                </div>
              </div>
            </div>

            <div className="pc-card pc-card--slabs">
              <div className="pc-card__head">
                <div className="pc-card__title">PTA TAX SLABS (EDITABLE)</div>
              </div>

              <div className="pc-slabs">
                <div className="pc-slabs__head">
                  <div>VALUE RANGE (USD)</div>
                  <div>CNIC</div>
                  <div>PASSPORT</div>
                </div>

                {slabs.map((s, idx) => (
                  <div className="pc-slabs__row" key={s.range}>
                    <div className="pc-chip">{s.range}</div>
                    <input
                      className="pc-input pc-input--slab"
                      type="number"
                      value={s.cnic}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSlabs((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, cnic: val } : x))
                        );
                      }}
                    />
                    <input
                      className="pc-input pc-input--slab"
                      type="number"
                      value={s.passport}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSlabs((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, passport: val } : x))
                        );
                      }}
                    />
                  </div>
                ))}

                <div className="pc-slabs__foot">
                  ✅ Saved automatically on this device (localStorage).
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="pc-col pc-col--wide">
            <div className="pc-card">
              <div className="pc-card__head pc-card__head--row">
                <div>
                  <div className="pc-card__title">INVENTORY PLANNING</div>
                  <div className="pc-card__sub">Add a device and instantly compare CNIC vs Passport.</div>
                  <div className="pc-card__note">Note: “Best” logic assumes <b>Passport</b> has lower PTA tax (when it does).</div>
                </div>
                <button className="pc-btn" type="button" onClick={addDevice}>
                  <span className="pc-btn__plus">＋</span> Add Device
                </button>
              </div>

              <div className="pc-invGrid">
                <label className="pc-label">
                  <span>Brand</span>
                  <select className="pc-input" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="">Select…</option>
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Google">Google</option>
                    <option value="Realme">Realme</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Oppo">Oppo</option>
                    <option value="OnePlus">OnePlus</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="pc-label pc-label--model">
                  <span>Device / Model Name</span>
                  <input
                    className="pc-input"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. iPhone 15 Pro Max"
                  />
                </label>

                <label className="pc-label">
                  <span>Purchase Cost (USD)</span>
                  <input
                    className="pc-input"
                    type="number"
                    value={purchaseUsd}
                    onChange={(e) => setPurchaseUsd(e.target.value)}
                    placeholder="e.g. 350"
                  />
                </label>

                <label className="pc-label">
                  <span>Shipping (USD)</span>
                  <input
                    className="pc-input"
                    type="number"
                    value={shipUsd}
                    onChange={(e) => setShipUsd(e.target.value)}
                    placeholder="e.g. 20"
                  />
                </label>

                <label className="pc-label">
                  <span>Expected Selling Price (PKR)</span>
                  <input
                    className="pc-input"
                    type="number"
                    value={salePkr}
                    onChange={(e) => setSalePkr(e.target.value)}
                    placeholder="e.g. 145000"
                  />
                </label>

                <div className="pc-label pc-label--best">
                  <span>Profit / Loss (Best)</span>
                  <div className={`pc-best ${invProfitDisplay.sign}`}>
                    {invProfitDisplay.text}
                  </div>
                </div>
              </div>
            </div>

            {/* spacing between inventory planning and devices */}
            <div className="pc-spacer" />

            <div className="pc-card">
              <div className="pc-card__head pc-card__head--row">
                <div className="pc-card__title">DEVICES</div>
                <div className="pc-muted">{devices.length} device(s)</div>
              </div>

              <div className="pc-deviceGrid">
                {devices.map((d) => (
                  <article className="pc-device" key={d.id}>
                    <div className="pc-device__top">
                      <div>
                        <div className="pc-device__brand">{String(d.brand || "").toUpperCase()}</div>
                        <div className="pc-device__model">{d.modelName}</div>
                        <div className="pc-device__tags">
                          <span className="pc-pill">Slab: {d.slabRange}</span>
                          <span className="pc-pill">GST: {Math.round(d.gst * 100)}%</span>
                        </div>
                      </div>
                      <button className="pc-iconBtn" onClick={() => removeDevice(d.id)} aria-label="Delete">
                        🗑️
                      </button>
                    </div>

                    {/* CNIC then Passport vertically, each with horizontal rows */}
                    <div className="pc-dualStack">
                      <div className="pc-sideBlock">
                        <div className="pc-sideBlock__head">
                          <div className="pc-sideBlock__label">CNIC</div>
                          <div className="pc-profitPill">
                            PROFIT • Rs {formatPKR(d.cnic.profit)}
                          </div>
                        </div>

                        <div className="pc-metrics">
                          <div className="pc-mrow">
                            <div className="pc-m">
                              <div className="pc-m__k">Base (Cost+Ship)</div>
                              <div className="pc-m__v">${formatUSD(d.cnic.baseUsd)}</div>
                            </div>
                            <div className="pc-m">
                              <div className="pc-m__k">GST</div>
                              <div className="pc-m__v">{Math.round(d.gst * 100)}%</div>
                            </div>
                          </div>

                          <div className="pc-mrow">
                            <div className="pc-m">
                              <div className="pc-m__k">Landed</div>
                              <div className="pc-m__v">Rs {formatPKR(d.cnic.landed)}</div>
                            </div>
                            <div className="pc-m">
                              <div className="pc-m__k">Selling Price</div>
                              <div className="pc-m__v">Rs {formatPKR(d.salePkr)}</div>
                            </div>
                          </div>

                          <div className="pc-mrow">
                            <div className="pc-m">
                              <div className="pc-m__k">Profit</div>
                              <div className="pc-m__v pc-green">Rs {formatPKR(d.cnic.profit)}</div>
                            </div>
                            <div className="pc-m">
                              <div className="pc-m__k">Margin</div>
                              <div className="pc-m__v">{pct(d.cnic.margin)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pc-sideBlock">
                        <div className="pc-sideBlock__head">
                          <div className="pc-sideBlock__label">PASSPORT</div>
                          <div className="pc-profitPill">
                            PROFIT • Rs {formatPKR(d.passport.profit)}
                          </div>
                        </div>

                        <div className="pc-metrics">
                          <div className="pc-mrow">
                            <div className="pc-m">
                              <div className="pc-m__k">Base (Cost+Ship)</div>
                              <div className="pc-m__v">${formatUSD(d.passport.baseUsd)}</div>
                            </div>
                            <div className="pc-m">
                              <div className="pc-m__k">GST</div>
                              <div className="pc-m__v">{Math.round(d.gst * 100)}%</div>
                            </div>
                          </div>

                          <div className="pc-mrow">
                            <div className="pc-m">
                              <div className="pc-m__k">Landed</div>
                              <div className="pc-m__v">Rs {formatPKR(d.passport.landed)}</div>
                            </div>
                            <div className="pc-m">
                              <div className="pc-m__k">Selling Price</div>
                              <div className="pc-m__v">Rs {formatPKR(d.salePkr)}</div>
                            </div>
                          </div>

                          <div className="pc-mrow">
                            <div className="pc-m">
                              <div className="pc-m__k">Profit</div>
                              <div className="pc-m__v pc-green">Rs {formatPKR(d.passport.profit)}</div>
                            </div>
                            <div className="pc-m">
                              <div className="pc-m__k">Margin</div>
                              <div className="pc-m__v">{pct(d.passport.margin)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="pc-summary">
                      <div className="pc-summary__row">
                        <span>Sale</span>
                        <b>Rs {formatPKR(d.salePkr)}</b>
                      </div>
                      <div className="pc-summary__row">
                        <span>Cost + Ship</span>
                        <b>${formatUSD(d.purchaseUsd)} + ${formatUSD(d.shipUsd)}</b>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="pc-export">
                <div className="pc-export__txt">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-export__btns">
                  <button className="pc-miniBtn" type="button" onClick={exportCSV}>
                    ⬇ CSV
                  </button>
                  <button className="pc-miniBtn" type="button" onClick={exportPDF}>
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hidden PDF template root (kept stable; only logo sizing tuned) */}
        <div className="pc-pdfWrap" aria-hidden="true">
          <div id="pc-pdf-root" className="pc-pdf">
            <div className="pc-pdf__header">
              <div className="pc-pdf__logo">
                <img
                  data-pc-logo
                  src={logoDataUrl || "/phonescanadalogo-web.png"}
                  alt="Phones Canada"
                />
              </div>
              <div>
                <div className="pc-pdf__title">PhonesCanada PTA Dashboard — Report</div>
                <div className="pc-pdf__sub">USD/PKR Rate: {usdToPkr} • GST: 18% / 25% (threshold $500)</div>
              </div>
            </div>

            <div className="pc-pdf__hr" />

            {devices.map((d, idx) => (
              <div className="pc-pdf__device" key={d.id}>
                <div className="pc-pdf__deviceHead">
                  <div>
                    <div className="pc-pdf__deviceTitle">
                      {idx + 1}. {d.brand} {d.modelName}
                    </div>
                    <div className="pc-pdf__meta">
                      Slab: {d.slabRange} • GST: {Math.round(d.gst * 100)}%
                    </div>
                  </div>
                  <div className="pc-pdf__sale">Rs {formatPKR(d.salePkr)}</div>
                </div>

                <div className="pc-pdf__two">
                  <div className="pc-pdf__box">
                    <div className="pc-pdf__boxHead">
                      <div className="pc-pdf__boxLabel">CNIC</div>
                      <div className="pc-pdf__profitTag">PROFIT</div>
                    </div>
                    <div className="pc-pdf__rows">
                      <div className="pc-pdf__row">
                        <span>Base (Cost+Ship)</span>
                        <b>${formatUSD(d.cnic.baseUsd)} (USD→PKR {usdToPkr})</b>
                      </div>
                      <div className="pc-pdf__row">
                        <span>Landed</span>
                        <b>Rs {formatPKR(d.cnic.landed)}</b>
                      </div>
                      <div className="pc-pdf__row">
                        <span>Profit</span>
                        <b className="pc-pdf__green">Rs {formatPKR(d.cnic.profit)}</b>
                      </div>
                      <div className="pc-pdf__row">
                        <span>Margin</span>
                        <b>{pct(d.cnic.margin)}</b>
                      </div>
                    </div>
                  </div>

                  <div className="pc-pdf__box">
                    <div className="pc-pdf__boxHead">
                      <div className="pc-pdf__boxLabel">PASSPORT</div>
                      <div className="pc-pdf__profitTag">PROFIT</div>
                    </div>
                    <div className="pc-pdf__rows">
                      <div className="pc-pdf__row">
                        <span>Base (Cost+Ship)</span>
                        <b>${formatUSD(d.passport.baseUsd)} (USD→PKR {usdToPkr})</b>
                      </div>
                      <div className="pc-pdf__row">
                        <span>Landed</span>
                        <b>Rs {formatPKR(d.passport.landed)}</b>
                      </div>
                      <div className="pc-pdf__row">
                        <span>Profit</span>
                        <b className="pc-pdf__green">Rs {formatPKR(d.passport.profit)}</b>
                      </div>
                      <div className="pc-pdf__row">
                        <span>Margin</span>
                        <b>{pct(d.passport.margin)}</b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="pc-pdf__footer">Generated by PhonesCanada PTA Dashboard</div>
          </div>
        </div>
      </main>
    </div>
  );
}

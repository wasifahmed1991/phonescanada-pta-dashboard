import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LS_KEYS = {
  usdRate: "pc_usdRate",
  anim: "pc_anim",
  slabs: "pc_slabs",
  devices: "pc_devices",
};

const DEFAULT_USD_RATE = 278;

const DEFAULT_SLABS = [
  { label: "0–30 USD", cnic: 550, passport: 430 },
  { label: "31–100 USD", cnic: 4323, passport: 3200 },
  { label: "101–200 USD", cnic: 11561, passport: 9580 },
  { label: "201–350 USD", cnic: 14661, passport: 12200 },
  { label: "351–500 USD", cnic: 23420, passport: 17800 },
  { label: "501+", cnic: 37007, passport: 36870 },
];

function clampNum(v, fallback = 0) {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeSlabs(rawSlabs, defaults = DEFAULT_SLABS) {
  if (!Array.isArray(rawSlabs)) return defaults;
  return rawSlabs.map((s, i) => {
    const d = defaults[i] || {};
    return {
      label: typeof s?.label === "string" && s.label.trim() ? s.label : d.label,
      cnic: clampNum(s?.cnic, d.cnic ?? 0),
      passport: clampNum(s?.passport, d.passport ?? 0),
    };
  });
}

function formatPKR(n) {
  return new Intl.NumberFormat("en-PK").format(Math.round(n || 0));
}
function formatUSD(n) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(n || 0)
  );
}

function profitMeta(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return { label: "BREAKEVEN", cls: "neu", value: 0 };
  if (n > 0) return { label: "PROFIT", cls: "pos", value: n };
  return { label: "LOSS", cls: "neg", value: Math.abs(n) };
}

function ProfitPill({ value }) {
  const pm = profitMeta(value);
  return (
    <div className={`pc-pill pc-profit-pill ${pm.cls}`}>
      {pm.label} • Rs {formatPKR(pm.value)}
    </div>
  );
}

function ProfitValue({ value }) {
  const pm = profitMeta(value);
  const cls = pm.cls === "pos" ? "green" : pm.cls === "neg" ? "red" : "gray";
  return <div className={`v ${cls}`}>Rs {formatPKR(pm.value)}</div>;
}

function getSlabIndex(usdValue) {
  if (usdValue <= 30) return 0;
  if (usdValue <= 100) return 1;
  if (usdValue <= 200) return 2;
  if (usdValue <= 350) return 3;
  if (usdValue <= 500) return 4;
  return 5;
}

function calcFor(type, d, usdRate, slabs) {
  const baseUsd = d.purchaseUsd + d.shippingUsd;
  const slabIdx = getSlabIndex(baseUsd);
  const pta = slabs[slabIdx]?.[type] || 0;
  const gstPct = baseUsd >= 500 ? 0.25 : 0.18;
  const basePkr = baseUsd * usdRate;
  const gstPkr = basePkr * gstPct;
  const landedPkr = basePkr + gstPkr + pta;
  const profitPkr = d.sellingPkr - landedPkr;
  const margin = d.sellingPkr > 0 ? (profitPkr / d.sellingPkr) * 100 : 0;
  return { slabIdx, pta, gstPct, basePkr, gstPkr, landedPkr, profitPkr, margin };
}

function bestOfTwo(c, p) {
  return c.profitPkr >= p.profitPkr ? { best: "CNIC", value: c.profitPkr } : { best: "Passport", value: p.profitPkr };
}

export default function App() {
  // Set the default USD rate to 278, but allow it to be overridden by a value from localStorage.
  const [usdRate, setUsdRate] = useState(() => clampNum(localStorage.getItem(LS_KEYS.usdRate), DEFAULT_USD_RATE));
  const [animationsOn, setAnimationsOn] = useState(() => localStorage.getItem(LS_KEYS.anim) !== "0");
  const [slabs, setSlabs] = useState(() => normalizeSlabs(JSON.parse(localStorage.getItem(LS_KEYS.slabs) || "null"), DEFAULT_SLABS));
  const [devices, setDevices] = useState(() => JSON.parse(localStorage.getItem(LS_KEYS.devices) || "[]"));

  const [brand, setBrand] = useState("Samsung");
  const [model, setModel] = useState("");
  const [purchaseUsd, setPurchaseUsd] = useState("");
  const [shippingUsd, setShippingUsd] = useState("");
  const [sellingPkr, setSellingPkr] = useState("");

  useEffect(() => localStorage.setItem(LS_KEYS.usdRate, String(usdRate)), [usdRate]);
  useEffect(() => localStorage.setItem(LS_KEYS.anim, animationsOn ? "1" : "0"), [animationsOn]);
  useEffect(() => localStorage.setItem(LS_KEYS.slabs, JSON.stringify(slabs)), [slabs]);
  useEffect(() => localStorage.setItem(LS_KEYS.devices, JSON.stringify(devices)), [devices]);

  const preview = useMemo(() => {
    const p = parseNum(purchaseUsd);
    const sh = parseNum(shippingUsd);
    const sell = parseNum(sellingPkr);

    const ready = Number.isFinite(p) && Number.isFinite(sell) && p > 0 && sell > 0;
    const d = {
      brand,
      model: model.trim() || "(Device)",
      purchaseUsd: ready ? p : 0,
      shippingUsd: Number.isFinite(sh) ? sh : 0,
      sellingPkr: ready ? sell : 0,
    };

    const c = calcFor("cnic", d, usdRate, slabs);
    const pRes = calcFor("passport", d, usdRate, slabs);
    const best = ready ? bestOfTwo(c, pRes) : null;

    return { device: d, c, p: pRes, best, ready };
  }, [brand, model, purchaseUsd, shippingUsd, sellingPkr, usdRate, slabs]);

  const addDevice = () => {
    if (!preview.ready) return;

    const d = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      brand,
      model: model.trim() || "(Device)",
      purchaseUsd: parseNum(purchaseUsd),
      shippingUsd: parseNum(shippingUsd) || 0,
      sellingPkr: parseNum(sellingPkr),
    };
    setDevices((prev) => [d, ...prev]);

    // ✅ Clear form after add
    setModel("");
    setPurchaseUsd("");
    setShippingUsd("");
    setSellingPkr("");
  };

  return (
    <div className="pc-page">
      <div className="pc-shell">
        <header className="pc-header">
          <div className="pc-brandmark">
            <img src="/phonescanadalogo-web.png" alt="PhonesCanada" />
          </div>
          <div>
            <div className="pc-title">PhonesCanada PTA Dashboard</div>
            <div className="pc-subtitle">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
          </div>
        </header>

        <div className="pc-grid">
          {/* LEFT COLUMN */}
          <div className="pc-col pc-col-left">
            <div className="pc-card">
              <div className="pc-card-title">SYSTEM PREFERENCES</div>
              <label className="pc-label">USD Rate (PKR)</label>
              <input className="pc-input" value={usdRate} onChange={(e) => setUsdRate(clampNum(e.target.value, DEFAULT_USD_RATE))} />
              <div className="pc-toggle-row">
                <div>
                  <div className="pc-toggle-title">Animations</div>
                  <div className="pc-toggle-desc">Smooth blobs + prism outlines</div>
                </div>
                <div className={`pc-toggle ${animationsOn ? "on" : "off"}`} onClick={() => setAnimationsOn(!animationsOn)}>
                  <div className="pc-toggle-track" />
                  <div className="pc-toggle-knob" />
                </div>
              </div>
              <div className="pc-tip">💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.</div>
            </div>

            <div className="pc-card pc-card-slabs">
              <div className="pc-card-title">PTA TAX SLABS (EDITABLE)</div>
              <div className="pc-slabs-head">
                <div>VALUE RANGE (USD)</div>
                <div>CNIC</div>
                <div>PASSPORT</div>
              </div>
              {slabs.map((slab, i) => (
                <div className="pc-slabs-row" key={i}>
                  <div className="pc-pill pc-slab-range">{slab.label}</div>
                  <input className="pc-input" value={slab.cnic} onChange={(e) => {
                    const next = [...slabs];
                    next[i].cnic = clampNum(e.target.value, slab.cnic);
                    setSlabs(next);
                  }} />
                  <input className="pc-input" value={slab.passport} onChange={(e) => {
                    const next = [...slabs];
                    next[i].passport = clampNum(e.target.value, slab.passport);
                    setSlabs(next);
                  }} />
                </div>
              ))}
              <div className="pc-local">✅ Saved automatically on this device (localStorage).</div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="pc-col pc-col-right">
            <div className="pc-card pc-card--planner">
              <div className="pc-planner-head">
                <div>
                  <div className="pc-card-title">INVENTORY PLANNING</div>
                  <div className="pc-muted">Add a device and instantly compare CNIC vs Passport.</div>
                  <div className="pc-note">Note: “Best” is chosen by higher profit (CNIC or Passport).</div>
                </div>
                <button className="pc-btn-red" onClick={addDevice}>+ Add Device</button>
              </div>

              <div className="pc-form">
                <div className="pc-form-field">
                  <label className="pc-label">Brand</label>
                  <select className="pc-input" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option>Samsung</option>
                    <option>Apple</option>
                    <option>Xiaomi</option>
                    <option>Realme</option>
                  </select>
                </div>

                <div className="pc-form-field">
                  <label className="pc-label">Device / Model Name</label>
                  <input className="pc-input" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>

                <div className="pc-form-field">
                  <label className="pc-label">Purchase (USD)</label>
                  <input className="pc-input" value={purchaseUsd} onChange={(e) => setPurchaseUsd(e.target.value)} />
                </div>

                <div className="pc-form-field">
                  <label className="pc-label">Shipping (USD)</label>
                  <input className="pc-input" value={shippingUsd} onChange={(e) => setShippingUsd(e.target.value)} />
                </div>

                <div className="pc-form-field">
                  <label className="pc-label">Expected Selling Price (PKR)</label>
                  <input className="pc-input" value={sellingPkr} onChange={(e) => setSellingPkr(e.target.value)} />
                </div>

                <div className="pc-form-field">
                  <label className="pc-label">Profit / Loss</label>
                  <div className={`pc-best-val ${
                    !preview.ready ? "neu" : preview.best.value > 0 ? "pos" : preview.best.value < 0 ? "neg" : "neu"
                  }`}>
                    {!preview.ready ? "—" : preview.best.value > 0
                      ? `Rs ${formatPKR(preview.best.value)}`
                      : preview.best.value < 0
                      ? `-Rs ${formatPKR(Math.abs(preview.best.value))}`
                      : "Rs 0"}
                  </div>
                </div>
              </div>
            </div>

            <div className="pc-card pc-card--devices">
              <div className="pc-dev-head">
                <div className="pc-card-title">DEVICES</div>
                <div className="pc-muted">{devices.length} device(s)</div>
              </div>

              <div className="pc-devices-grid">
                {devices.map((d) => {
                  const c = calcFor("cnic", d, usdRate, slabs);
                  const p = calcFor("passport", d, usdRate, slabs);
                  return (
                    <div className="pc-device-card" key={d.id}>
                      <div className="pc-device-top">
                        <div>
                          <div className="pc-device-brand">{d.brand.toUpperCase()}</div>
                          <div className="pc-device-title">{d.model}</div>
                          <div className="pc-tags">
                            <span className="pc-pill">Slab: {slabs[c.slabIdx]?.label}</span>
                            <span className="pc-pill">GST: {Math.round(c.gstPct * 100)}%</span>
                          </div>
                        </div>
                        <button className="pc-trash" onClick={() => setDevices(devices.filter(x => x.id !== d.id))}>🗑</button>
                      </div>

                      <div className="pc-sec">
                        <div className="pc-sec-head">
                          <div className="pc-sec-title">CNIC</div>
                          <ProfitPill value={c.profitPkr} />
                        </div>

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
                          <ProfitValue value={c.profitPkr} />
                          <div className="k">Margin</div>
                          <div className="v">{Math.abs(c.margin).toFixed(1)}%</div>
                        </div>
                      </div>

                      <div className="pc-sec">
                        <div className="pc-sec-head">
                          <div className="pc-sec-title">PASSPORT</div>
                          <ProfitPill value={p.profitPkr} />
                        </div>

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
                          <ProfitValue value={p.profitPkr} />
                          <div className="k">Margin</div>
                          <div className="v">{Math.abs(p.margin).toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pc-export">
                <div>Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-export-btns">
                  <button className="pc-btn">⬇ CSV</button>
                  <button className="pc-btn">⬇ PDF</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

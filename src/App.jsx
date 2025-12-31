import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * PhonesCanada PTA Dashboard — Single-file App.jsx
 *
 * Goals in this revision (per your last message):
 * - Inventory Planning: make Model field wider, cost/ship tighter; fix wrapping + alignment; keep card inside viewport.
 * - Profit/Loss (Best): show CNIC-based profit/loss only (no "Passport" label inside field). Add note near header that passport often yields higher profit.
 * - Devices cards: stop overflow/wrapping; use a clean horizontal split (CNIC block + Passport block side-by-side).
 * - PDF export: keep current styling; only fix logo size (bigger) or hide if fails.
 * - Background: restore animated, soft geometric moving objects + improved gradient palette (red/white, touch of yellow/orange/purple).
 * - Do NOT disturb fonts and weights beyond small tuning.
 */

// ---- Formatting helpers ----
const nf0 = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 1 });
const fmtRs = (n) => `Rs ${nf0.format(Math.round(n || 0))}`;
const fmtUsd = (n) => `$${nf0.format(Math.round(n || 0))}`;

// Safe number parsing
const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

// ---- Default tax slabs (editable) ----
const DEFAULT_SLABS = [
  { key: "0-30", min: 0, max: 30, label: "0–30", cnic: 550, passport: 430 },
  { key: "31-100", min: 31, max: 100, label: "31–100", cnic: 4323, passport: 3200 },
  { key: "101-200", min: 101, max: 200, label: "101–200", cnic: 11561, passport: 9580 },
  { key: "201-350", min: 201, max: 350, label: "201–350", cnic: 14661, passport: 12200 },
  { key: "351-500", min: 351, max: 500, label: "351–500", cnic: 23420, passport: 17800 },
  { key: "501+", min: 501, max: Infinity, label: "501+", cnic: 37007, passport: 36870 },
];

// ---- Brands ----
const BRANDS = [
  "Apple",
  "Samsung",
  "Google",
  "Xiaomi",
  "Realme",
  "OnePlus",
  "Oppo",
  "Vivo",
  "Motorola",
  "Huawei",
  "Infinix",
  "Tecno",
  "Nokia",
  "Sony",
  "Other",
];

// ---- GST rule ----
const GST_THRESHOLD_USD = 500;
const GST_BELOW = 0.18;
const GST_ABOVE = 0.25;

// ---- LocalStorage keys ----
const LS = {
  rate: "pc_pta_rate",
  slabs: "pc_pta_slabs",
  devices: "pc_pta_devices",
  anim: "pc_pta_anim",
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function pickSlab(slabs, usdTotal) {
  const u = num(usdTotal);
  const found = slabs.find((s) => u >= s.min && u <= s.max);
  return found || slabs[slabs.length - 1];
}

function gstRateFor(usdTotal) {
  return num(usdTotal) >= GST_THRESHOLD_USD ? GST_ABOVE : GST_BELOW;
}

function computeDevice({ rate, slabs, brand, model, purchaseUsd, shipUsd, expectedPkr }) {
  const usd = num(purchaseUsd) + num(shipUsd);
  const slab = pickSlab(slabs, usd);
  const gstRate = gstRateFor(usd);

  const basePkr = usd * num(rate);
  const ptaCnic = num(slab.cnic);
  const ptaPass = num(slab.passport);

  const landedCnic = basePkr + ptaCnic;
  const landedPass = basePkr + ptaPass;

  const sale = num(expectedPkr);

  const profitCnic = sale - landedCnic;
  const profitPass = sale - landedPass;

  const marginCnic = sale > 0 ? (profitCnic / sale) * 100 : 0;
  const marginPass = sale > 0 ? (profitPass / sale) * 100 : 0;

  // Best (for display elsewhere) is max profit (but we will show CNIC only in inventory planning as requested)
  const best = profitPass >= profitCnic ? "passport" : "cnic";

  return {
    brand,
    model,
    usd,
    slabLabel: slab.label,
    gstRate,
    basePkr,
    sale,
    ptaCnic,
    ptaPass,
    landedCnic,
    landedPass,
    profitCnic,
    profitPass,
    marginCnic,
    marginPass,
    best,
  };
}

// --- Simple CSV download ---
function downloadTextFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function devicesToCSV(devices, rate, slabs) {
  const headers = [
    "Brand",
    "Model",
    "Purchase USD",
    "Shipping USD",
    "USD Total",
    "Slab",
    "GST Rate",
    "USD→PKR Rate",
    "Expected Sale PKR",
    "Base PKR (Cost+Ship)",
    "PTA CNIC",
    "Landed CNIC",
    "Profit CNIC",
    "Margin CNIC %",
    "PTA Passport",
    "Landed Passport",
    "Profit Passport",
    "Margin Passport %",
  ];
  const rows = devices.map((d) => {
    const c = computeDevice({
      rate,
      slabs,
      brand: d.brand,
      model: d.model,
      purchaseUsd: d.purchaseUsd,
      shipUsd: d.shipUsd,
      expectedPkr: d.expectedPkr,
    });

    return [
      d.brand,
      d.model,
      num(d.purchaseUsd),
      num(d.shipUsd),
      nf0.format(c.usd),
      c.slabLabel,
      `${Math.round(c.gstRate * 100)}%`,
      num(rate),
      nf0.format(c.sale),
      nf0.format(c.basePkr),
      nf0.format(c.ptaCnic),
      nf0.format(c.landedCnic),
      nf0.format(c.profitCnic),
      nf1.format(c.marginCnic),
      nf0.format(c.ptaPass),
      nf0.format(c.landedPass),
      nf0.format(c.profitPass),
      nf1.format(c.marginPass),
    ];
  });

  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

// --- PDF Export: uses window.jspdf + window.html2canvas if available, else prints a styled window and lets user Save as PDF ---
async function exportPDF({ devices, rate, slabs }) {
  // Build HTML report (keep your current styling; only increase logo size)
  const computed = devices.map((d) =>
    computeDevice({
      rate,
      slabs,
      brand: d.brand,
      model: d.model,
      purchaseUsd: d.purchaseUsd,
      shipUsd: d.shipUsd,
      expectedPkr: d.expectedPkr,
    })
  );

  const gstText = `GST: ${Math.round(GST_BELOW * 100)}% / ${Math.round(GST_ABOVE * 100)}% (threshold $${GST_THRESHOLD_USD})`;

  const logoSrc = "/phonescanadalogo-web.png"; // public/

  const css = `
    :root{
      --ink:#111827; --muted:#6b7280; --card:#ffffff; --soft:#f6f7fb; --ring:rgba(17,24,39,.08);
      --good:#065f46; --bad:#991b1b;
    }
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:var(--ink);font-family: Saira, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;}
    .page{padding:28px 32px 40px; max-width: 980px; margin:0 auto;}
    .header{display:flex; align-items:center; gap:16px; padding:14px 16px; border-radius:16px; background:#f3f5ff; border:1px solid var(--ring);} 
    .logoWrap{width:220px; max-width:220px; height:52px; display:flex; align-items:center; justify-content:flex-start;}
    .logoWrap img{max-width:100%; max-height:100%; object-fit:contain; display:block;}
    .title{font-size:22px; font-weight:700; line-height:1.1;}
    .sub{margin-top:2px; color:var(--muted); font-size:12.5px;}
    .rule{height:1px;background:rgba(17,24,39,.08); margin:18px 0;}
    .device{padding:14px 16px; border-radius:16px; background:var(--soft); border:1px solid var(--ring); margin:14px 0;}
    .deviceTop{display:flex; align-items:flex-start; justify-content:space-between; gap:12px;}
    .dName{font-weight:700; font-size:16px; margin:0;}
    .dMeta{color:var(--muted); font-size:12px; margin-top:3px;}
    .sale{font-weight:800; font-size:14px;}
    .two{display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-top:12px;}
    .box{background:var(--card); border:1px solid var(--ring); border-radius:14px; padding:12px;}
    .boxHead{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;}
    .badge{font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--muted);}
    .pBadge{font-size:12px; font-weight:800; color:var(--good);} 
    .pBadge.bad{color:var(--bad);} 
    .rows{display:grid; gap:6px;}
    .row{display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12.5px;}
    .row .k{color:var(--muted);} 
    .row .v{font-weight:700;}
    .foot{margin-top:18px; color:var(--muted); font-size:11.5px;}
    @media print{ .page{max-width:none} }
  `;

  const html = `
  <div class="page">
    <div class="header">
      <div class="logoWrap"><img src="${logoSrc}" alt="Phones Canada" onerror="this.style.display='none'"/></div>
      <div>
        <div class="title">PhonesCanada PTA Dashboard — Report</div>
        <div class="sub">USD/PKR Rate: ${num(rate)} • ${gstText}</div>
      </div>
    </div>

    <div class="rule"></div>

    ${computed
      .map((c, idx) => {
        const profitClassC = c.profitCnic >= 0 ? "" : " bad";
        const profitClassP = c.profitPass >= 0 ? "" : " bad";

        return `
        <div class="device">
          <div class="deviceTop">
            <div>
              <div class="dName">${idx + 1}. ${c.brand} ${c.model || ""}</div>
              <div class="dMeta">Slab: ${c.slabLabel} USD • GST: ${Math.round(c.gstRate * 100)}%</div>
            </div>
            <div class="sale">${fmtRs(c.sale)}</div>
          </div>

          <div class="two">
            <div class="box">
              <div class="boxHead">
                <div class="badge">CNIC</div>
                <div class="pBadge${profitClassC}">${c.profitCnic >= 0 ? "PROFIT" : "LOSS"}</div>
              </div>
              <div class="rows">
                <div class="row"><div class="k">Base (Cost+Ship)</div><div class="v">${fmtUsd(num(c.usd - num(0)))} (${"USD→PKR"} ${num(rate)})</div></div>
                <div class="row"><div class="k">Landed</div><div class="v">${fmtRs(c.landedCnic)}</div></div>
                <div class="row"><div class="k">Profit</div><div class="v" style="color:${c.profitCnic >= 0 ? "var(--good)" : "var(--bad)"}">${fmtRs(c.profitCnic)}</div></div>
                <div class="row"><div class="k">Margin</div><div class="v">${nf1.format(c.marginCnic)}%</div></div>
              </div>
            </div>

            <div class="box">
              <div class="boxHead">
                <div class="badge">Passport</div>
                <div class="pBadge${profitClassP}">${c.profitPass >= 0 ? "PROFIT" : "LOSS"}</div>
              </div>
              <div class="rows">
                <div class="row"><div class="k">Base (Cost+Ship)</div><div class="v">${fmtUsd(num(c.usd - num(0)))} (${"USD→PKR"} ${num(rate)})</div></div>
                <div class="row"><div class="k">Landed</div><div class="v">${fmtRs(c.landedPass)}</div></div>
                <div class="row"><div class="k">Profit</div><div class="v" style="color:${c.profitPass >= 0 ? "var(--good)" : "var(--bad)"}">${fmtRs(c.profitPass)}</div></div>
                <div class="row"><div class="k">Margin</div><div class="v">${nf1.format(c.marginPass)}%</div></div>
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join("\n")}

    <div class="foot">Generated by PhonesCanada PTA Dashboard</div>
  </div>
  `;

  // Approach:
  // 1) If jsPDF + html2canvas present, render HTML into PDF and download.
  // 2) Fallback: open new window and trigger print (user Save as PDF).

  const hasJsPdf = typeof window !== "undefined" && window.jspdf && window.jspdf.jsPDF;
  const hasH2C = typeof window !== "undefined" && window.html2canvas;

  if (hasJsPdf && hasH2C) {
    const w = window.open("", "_blank");
    if (!w) {
      alert("Pop-up blocked. Please allow pop-ups for PDF export.");
      return;
    }
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Report</title><style>${css}</style></head><body>${html}</body></html>`);
    w.document.close();

    // Wait for logo + layout
    await new Promise((r) => setTimeout(r, 400));

    const pageEl = w.document.querySelector(".page");
    const canvas = await window.html2canvas(pageEl, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new window.jspdf.jsPDF({ orientation: "p", unit: "pt", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Fit image to page
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

    pdf.save("PhonesCanada-PTA-Report.pdf");
    w.close();
    return;
  }

  // Fallback print window
  const w = window.open("", "_blank");
  if (!w) {
    alert("Pop-up blocked. Please allow pop-ups for PDF export.");
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>PhonesCanada PTA Report</title><style>${css}</style></head><body>${html}<script>window.onload=()=>setTimeout(()=>window.print(),200);</script></body></html>`);
  w.document.close();
}

// ---- Background animation canvas (soft geometric prisms) ----
function useAnimatedBackground(enabled) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    resize();

    // shapes
    const rand = (a, b) => a + Math.random() * (b - a);
    const palette = [
      "rgba(255, 99, 132, 0.10)", // soft red
      "rgba(255, 191, 0, 0.08)", // yellow
      "rgba(255, 140, 0, 0.07)", // orange
      "rgba(139, 92, 246, 0.08)", // purple
      "rgba(59, 130, 246, 0.07)", // blue
    ];

    const makeShape = () => {
      const sides = Math.random() < 0.5 ? 6 : 5; // hex/pent
      const r = rand(14, 34);
      return {
        x: rand(0, window.innerWidth),
        y: rand(0, window.innerHeight),
        vx: rand(-0.22, 0.22),
        vy: rand(-0.18, 0.18),
        r,
        sides,
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.004, 0.004),
        stroke: palette[Math.floor(Math.random() * palette.length)],
      };
    };

    const shapes = Array.from({ length: 10 }, makeShape);

    const drawPoly = (s) => {
      const { x, y, r, sides, rot } = s;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = rot + (i * Math.PI * 2) / sides;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const step = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      if (!enabled) {
        raf = requestAnimationFrame(step);
        return;
      }

      // subtle blur glow
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const s of shapes) {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vr;

        // bounce softly
        if (s.x < -40) s.x = w + 40;
        if (s.x > w + 40) s.x = -40;
        if (s.y < -40) s.y = h + 40;
        if (s.y > h + 40) s.y = -40;

        ctx.lineWidth = 1.2;
        ctx.strokeStyle = s.stroke;
        ctx.shadowColor = s.stroke;
        ctx.shadowBlur = 10;
        drawPoly(s);
        ctx.stroke();
      }

      // a few drifting dots
      ctx.shadowBlur = 0;
      for (let i = 0; i < 18; i++) {
        const t = (Date.now() / 1000 + i) * 0.22;
        const x = (w * (i / 18) + Math.sin(t) * 22) % w;
        const y = (h * ((i * 7) % 18) / 18 + Math.cos(t * 1.3) * 18) % h;
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [enabled]);

  return ref;
}

export default function App() {
  // ---- State (persisted) ----
  const [rate, setRate] = useState(() => {
    const v = localStorage.getItem(LS.rate);
    return v ? num(v) : 278;
  });

  const [animationsOn, setAnimationsOn] = useState(() => {
    const v = localStorage.getItem(LS.anim);
    return v ? v === "1" : true;
  });

  const [slabs, setSlabs] = useState(() => {
    try {
      const raw = localStorage.getItem(LS.slabs);
      if (!raw) return DEFAULT_SLABS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length < 3) return DEFAULT_SLABS;
      // normalize
      return parsed.map((s, i) => ({
        ...DEFAULT_SLABS[i],
        ...s,
        cnic: num(s.cnic ?? DEFAULT_SLABS[i]?.cnic),
        passport: num(s.passport ?? DEFAULT_SLABS[i]?.passport),
      }));
    } catch {
      return DEFAULT_SLABS;
    }
  });

  const [devices, setDevices] = useState(() => {
    try {
      const raw = localStorage.getItem(LS.devices);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Inventory planning inputs
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [purchaseUsd, setPurchaseUsd] = useState("");
  const [shipUsd, setShipUsd] = useState("");
  const [expectedPkr, setExpectedPkr] = useState("");

  // Persist
  useEffect(() => localStorage.setItem(LS.rate, String(rate)), [rate]);
  useEffect(() => localStorage.setItem(LS.anim, animationsOn ? "1" : "0"), [animationsOn]);
  useEffect(() => localStorage.setItem(LS.slabs, JSON.stringify(slabs)), [slabs]);
  useEffect(() => localStorage.setItem(LS.devices, JSON.stringify(devices)), [devices]);

  // Background
  const bgRef = useAnimatedBackground(animationsOn);

  const planningComputed = useMemo(() => {
    return computeDevice({
      rate,
      slabs,
      brand: brand || "",
      model: model || "",
      purchaseUsd,
      shipUsd,
      expectedPkr,
    });
  }, [rate, slabs, brand, model, purchaseUsd, shipUsd, expectedPkr]);

  // Profit/Loss (Best) — per request: show CNIC based profit only (no Passport text)
  const planningProfit = planningComputed.profitCnic;
  const planningProfitLabel =
    !brand || !model || num(expectedPkr) <= 0 || (num(purchaseUsd) + num(shipUsd) <= 0)
      ? "—"
      : planningProfit >= 0
        ? `Profit • ${fmtRs(planningProfit)}`
        : `Loss • ${fmtRs(Math.abs(planningProfit))}`;

  const planningProfitTone = planningProfit >= 0 ? "good" : "bad";

  const addDevice = () => {
    if (!brand || !String(brand).trim()) {
      alert("Please select a Brand.");
      return;
    }
    if (!String(model).trim()) {
      alert("Please enter Device / Model Name.");
      return;
    }
    const p = num(purchaseUsd);
    const s = num(shipUsd);
    const e = num(expectedPkr);
    if (p <= 0) {
      alert("Purchase Cost must be greater than 0.");
      return;
    }
    if (e <= 0) {
      alert("Expected Selling Price must be greater than 0.");
      return;
    }

    setDevices((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        brand,
        model: model.trim(),
        purchaseUsd: p,
        shipUsd: s,
        expectedPkr: e,
      },
      ...prev,
    ]);

    // Reset form to empty (was requested earlier)
    setBrand("");
    setModel("");
    setPurchaseUsd("");
    setShipUsd("");
    setExpectedPkr("");
  };

  const removeDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id));

  const updateSlab = (idx, field, value) => {
    setSlabs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: num(value) };
      return next;
    });
  };

  const exportCSV = () => {
    const csv = devicesToCSV(devices, rate, slabs);
    downloadTextFile("PhonesCanada-PTA-Devices.csv", csv, "text/csv");
  };

  const onExportPDF = async () => {
    if (!devices.length) {
      alert("Add at least one device to export a report.");
      return;
    }
    await exportPDF({ devices, rate, slabs });
  };

  // ---- Styles (inline for single-file simplicity) ----
  const styles = `
    :root{
      --bg1:#ffdee7;
      --bg2:#ffffff;
      --bg3:#ffe9c6;
      --bg4:#d8e8ff;
      --bg5:#e8ddff;

      --card: rgba(255,255,255,.72);
      --card2: rgba(255,255,255,.60);
      --stroke: rgba(17,24,39,.10);
      --shadow: 0 18px 45px rgba(17,24,39,.10);
      --shadow2: 0 10px 26px rgba(17,24,39,.08);
      --ink:#111827;
      --muted:#6b7280;
      --goodBg: rgba(16,185,129,.12);
      --goodBd: rgba(16,185,129,.25);
      --goodTx: #065f46;
      --badBg: rgba(239,68,68,.12);
      --badBd: rgba(239,68,68,.22);
      --badTx: #991b1b;
      --pill: rgba(17,24,39,.06);
      --brand: linear-gradient(135deg, rgba(255,90,95,.95), rgba(255,140,0,.85));

      --r: 20px;
      --r2: 16px;
    }

    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family: Saira, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color:var(--ink);
      background:
        radial-gradient(1200px 700px at 10% 10%, var(--bg1), transparent 60%),
        radial-gradient(1000px 700px at 90% 12%, var(--bg4), transparent 60%),
        radial-gradient(900px 600px at 15% 90%, var(--bg5), transparent 55%),
        radial-gradient(900px 600px at 85% 85%, rgba(255,200,120,.45), transparent 55%),
        linear-gradient(180deg, var(--bg2), rgba(255,255,255,.94));
      overflow-x:hidden;
    }

    .bgCanvas{
      position:fixed;
      inset:0;
      z-index:0;
      pointer-events:none;
      opacity:.9;
      mix-blend-mode:soft-light;
    }

    .wrap{
      position:relative;
      z-index:1;
      max-width: 1220px;
      margin: 26px auto 42px;
      padding: 0 18px;
    }

    .headerCard{
      display:flex;
      align-items:center;
      gap: 16px;
      padding: 18px 18px;
      border-radius: 26px;
      background: var(--card);
      border: 1px solid var(--stroke);
      box-shadow: var(--shadow);
      backdrop-filter: blur(12px);
    }

    .brandMark{
      width: 170px;
      height: 56px;
      border-radius: 16px;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
      background: rgba(255,255,255,.65);
      border: 1px solid rgba(17,24,39,.10);
    }
    .brandMark img{
      width: 100%;
      height: 100%;
      object-fit: contain;
      display:block;
      padding: 6px 10px;
    }

    .hText{min-width:0}
    .hTitle{font-size: 28px; font-weight: 700; letter-spacing: .2px; margin:0; line-height:1.1;}
    .hSub{margin-top:4px; color:var(--muted); font-weight: 450; font-size: 14px;}

    .grid{
      display:grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 16px;
      margin-top: 18px;
      align-items:start;
    }

    @media (max-width: 980px){
      .grid{grid-template-columns: 1fr;}
    }

    .card{
      border-radius: var(--r);
      background: var(--card);
      border: 1px solid var(--stroke);
      box-shadow: var(--shadow2);
      backdrop-filter: blur(12px);
      overflow:hidden;
    }

    .cardPad{padding: 16px;}

    .secTitle{
      font-size: 13px;
      letter-spacing: .20em;
      font-weight: 700;
      color: rgba(17,24,39,.55);
      text-transform: uppercase;
      margin:0;
    }

    .labelRow{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      margin-top: 10px;
    }

    .fieldLabel{
      font-size: 12.5px;
      color: rgba(17,24,39,.72);
      font-weight: 550;
      display:flex;
      align-items:center;
      gap:8px;
      margin-bottom: 6px;
    }

    .iDot{
      width:18px;height:18px;border-radius:999px;
      display:inline-flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;
      color: rgba(17,24,39,.6);
      border:1px solid rgba(17,24,39,.12);
      background: rgba(255,255,255,.55);
    }

    input, select{
      width:100%;
      border-radius: 16px;
      padding: 12px 14px;
      border: 1px solid rgba(17,24,39,.12);
      background: rgba(255,255,255,.70);
      outline:none;
      font-family: inherit;
      font-weight: 450;
      font-size: 15px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
    }
    input:focus, select:focus{border-color: rgba(99,102,241,.40); box-shadow: 0 0 0 4px rgba(99,102,241,.12);}

    .toggleRow{
      margin-top: 12px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 14px;
      padding: 10px 12px;
      border-radius: 16px;
      border: 1px dashed rgba(17,24,39,.12);
      background: rgba(255,255,255,.45);
    }

    .toggleText{min-width:0}
    .toggleTitle{font-weight:700; margin:0;}
    .toggleSub{margin:2px 0 0; font-size: 13px; color: var(--muted);}

    .switch{
      position:relative;
      width: 56px;
      height: 32px;
      flex: 0 0 auto;
    }
    .switch input{display:none}
    .slider{
      position:absolute;
      inset:0;
      border-radius: 999px;
      background: rgba(17,24,39,.12);
      border: 1px solid rgba(17,24,39,.14);
      transition: .25s ease;
      box-shadow: inset 0 1px 2px rgba(17,24,39,.10);
    }
    .slider:before{
      content:"";
      position:absolute;
      width: 26px;
      height: 26px;
      left: 3px;
      top: 2px;
      border-radius: 999px;
      background: rgba(255,255,255,.95);
      box-shadow: 0 8px 18px rgba(17,24,39,.18);
      transition: .25s ease;
    }
    .switch input:checked + .slider{
      background: rgba(255,90,95,.55);
      border-color: rgba(255,90,95,.35);
    }
    .switch input:checked + .slider:before{
      transform: translateX(24px);
      background: rgba(255,255,255,.98);
    }

    .hint{
      margin-top: 10px;
      font-size: 13px;
      color: var(--muted);
      display:flex;
      gap: 10px;
      line-height:1.45;
      padding-left: 2px;
    }

    .table{
      margin-top: 12px;
      border-radius: 18px;
      border: 1px solid rgba(17,24,39,.10);
      background: rgba(255,255,255,.55);
      overflow:hidden;
    }

    .tHead, .tRow{
      display:grid;
      grid-template-columns: 1.25fr 1fr 1fr;
      gap: 10px;
      align-items:center;
      padding: 12px 12px;
    }
    .tHead{
      background: rgba(17,24,39,.04);
      border-bottom: 1px solid rgba(17,24,39,.08);
      color: rgba(17,24,39,.60);
      font-weight: 750;
      letter-spacing:.12em;
      font-size: 12px;
      text-transform: uppercase;
    }
    .tRow{border-bottom: 1px solid rgba(17,24,39,.07);}
    .tRow:last-child{border-bottom:none}

    .rangePill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(17,24,39,.10);
      background: rgba(255,255,255,.65);
      font-weight: 750;
      color: rgba(17,24,39,.70);
      width: fit-content;
      max-width: 100%;
      white-space: nowrap;
    }

    .slabInput input{
      padding: 10px 12px;
      border-radius: 14px;
      font-weight: 550;
      text-align: center;
    }

    .saveNote{
      margin-top: 10px;
      font-size: 13px;
      color: rgba(17,24,39,.55);
      display:flex;
      align-items:center;
      gap:10px;
      padding-left: 2px;
    }

    /* Inventory planning */
    .invTop{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 12px;
    }

    .invDesc{
      margin-top: 6px;
      font-size: 13.5px;
      color: var(--muted);
      font-weight: 450;
    }

    .noteLine{
      margin-top: 6px;
      font-size: 12.5px;
      color: rgba(17,24,39,.60);
      font-weight: 500;
    }

    .addBtn{
      flex: 0 0 auto;
      border: none;
      padding: 12px 16px;
      border-radius: 999px;
      background: var(--brand);
      color: white;
      font-weight: 750;
      font-size: 15px;
      box-shadow: 0 18px 40px rgba(255,90,95,.25);
      cursor:pointer;
      display:inline-flex;
      gap: 10px;
      align-items:center;
      justify-content:center;
      white-space: nowrap;
    }
    .addBtn:active{transform: translateY(1px)}

    .invGrid{
      margin-top: 12px;
      display:grid;
      grid-template-columns: 1.1fr 2.3fr 1fr 1fr 1.2fr 1.1fr;
      gap: 10px;
      align-items:end;
    }

    @media (max-width: 1100px){
      .invGrid{
        grid-template-columns: 1fr 1.4fr 1fr 1fr;
      }
      .invGrid .span2{grid-column: span 2;}
    }
    @media (max-width: 720px){
      .invGrid{
        grid-template-columns: 1fr;
      }
      .invGrid .span2{grid-column: auto;}
    }

    .profitField{
      border-radius: 16px;
      padding: 11px 14px;
      border: 1px solid rgba(17,24,39,.12);
      background: rgba(255,255,255,.65);
      font-weight: 800;
      font-size: 14px;
      display:flex;
      align-items:center;
      justify-content:center;
      min-height: 44px;
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
    }
    .profitField.good{background: var(--goodBg); border-color: var(--goodBd); color: var(--goodTx);}
    .profitField.bad{background: var(--badBg); border-color: var(--badBd); color: var(--badTx);}

    /* Devices section */
    .devicesHeader{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid rgba(17,24,39,.08);
      background: rgba(255,255,255,.35);
    }
    .devicesTitle{font-size: 26px; font-weight: 800; margin:0; letter-spacing:.2px;}
    .count{color: var(--muted); font-weight: 550;}

    .cardsWrap{padding: 14px 14px 18px;}
    .cards{
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 980px){
      .cards{grid-template-columns: 1fr;}
    }

    .dCard{
      border-radius: 18px;
      background: rgba(255,255,255,.72);
      border: 1px solid rgba(17,24,39,.10);
      box-shadow: 0 16px 34px rgba(17,24,39,.10);
      overflow:hidden;
      min-width: 0;
    }

    .dTop{
      display:flex;
      justify-content:space-between;
      gap: 12px;
      padding: 14px;
      align-items:flex-start;
    }
    .dBrand{font-size: 12px; letter-spacing:.24em; text-transform: uppercase; color: rgba(17,24,39,.55); font-weight: 800;}
    .dName{font-size: 24px; margin: 2px 0 0; font-weight: 800; line-height:1.05;}
    .pillRow{display:flex; gap:8px; flex-wrap:wrap; margin-top: 10px;}
    .pill{
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(17,24,39,.05);
      border: 1px solid rgba(17,24,39,.08);
      color: rgba(17,24,39,.65);
      font-weight: 750;
      font-size: 13px;
      white-space: nowrap;
    }

    .trash{
      border: 1px solid rgba(17,24,39,.12);
      background: rgba(255,255,255,.65);
      border-radius: 14px;
      width: 40px;
      height: 40px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      flex: 0 0 auto;
    }

    .dMid{
      padding: 14px;
      border-top: 1px solid rgba(17,24,39,.08);
      background: rgba(255,255,255,.40);
    }

    .twoCol{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      min-width:0;
    }
    @media (max-width: 540px){
      .twoCol{grid-template-columns: 1fr;}
    }

    .mini{
      border-radius: 16px;
      border: 1px solid rgba(17,24,39,.10);
      background: rgba(255,255,255,.72);
      padding: 12px;
      min-width:0;
    }

    .miniHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      margin-bottom: 10px;
    }

    .miniLabel{font-size: 13px; letter-spacing:.22em; text-transform: uppercase; font-weight: 900; color: rgba(17,24,39,.55);}

    .profitPill{
      padding: 6px 10px;
      border-radius: 999px;
      font-weight: 900;
      font-size: 12.5px;
      border: 1px solid;
      white-space: nowrap;
      max-width: 100%;
      overflow:hidden;
      text-overflow: ellipsis;
    }
    .profitPill.good{background: var(--goodBg); border-color: var(--goodBd); color: var(--goodTx);} 
    .profitPill.bad{background: var(--badBg); border-color: var(--badBd); color: var(--badTx);} 

    .kv{
      display:grid;
      grid-template-columns: 1fr auto;
      gap: 8px 10px;
      align-items:center;
    }
    .k{color: var(--muted); font-weight: 600;}
    .v{
      font-weight: 900;
      min-width:0;
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
      max-width: 160px;
      text-align:right;
    }
    .v.big{max-width: 220px;}

    .dBottom{
      padding: 12px 14px 14px;
      background: rgba(255,255,255,.55);
      border-top: 1px solid rgba(17,24,39,.08);
    }

    .summary{
      display:grid;
      grid-template-columns: 1fr auto;
      gap: 8px 12px;
      align-items:center;
      font-weight: 650;
      color: rgba(17,24,39,.65);
    }
    .summary .sv{font-weight: 900; color: rgba(17,24,39,.85);}

    .exportBar{
      margin-top: 14px;
      border-radius: 18px;
      border: 1px solid rgba(17,24,39,.10);
      background: rgba(255,255,255,.60);
      box-shadow: 0 14px 32px rgba(17,24,39,.08);
      padding: 12px 14px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
    }

    .expText{color: rgba(17,24,39,.65); font-weight: 650;}

    .expBtns{display:flex; gap:10px; align-items:center;}
    .expBtn{
      border-radius: 999px;
      border: 1px solid rgba(17,24,39,.12);
      background: rgba(255,255,255,.75);
      padding: 10px 12px;
      font-weight: 850;
      cursor:pointer;
      display:inline-flex;
      align-items:center;
      gap: 10px;
      white-space: nowrap;
    }

    .ico{width:18px;height:18px; display:inline-block}

    /* small safeguard to prevent any overflow from long content */
    .card, .dCard, .mini, .exportBar, .headerCard{min-width:0}
  `;

  return (
    <>
      <style>{styles}</style>
      <canvas className="bgCanvas" ref={bgRef} />

      <div className="wrap">
        {/* Header */}
        <div className="headerCard">
          <div className="brandMark" aria-label="PhonesCanada Logo">
            <img src="/phonescanadalogo-web.png" alt="PhonesCanada" onError={(e) => (e.currentTarget.style.display = "none")} />
          </div>
          <div className="hText">
            <h1 className="hTitle">PhonesCanada PTA Dashboard</h1>
            <div className="hSub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
          </div>
        </div>

        <div className="grid">
          {/* Left column */}
          <div className="col">
            <div className="card">
              <div className="cardPad">
                <p className="secTitle">System Preferences</p>

                <div style={{ marginTop: 12 }}>
                  <div className="fieldLabel">
                    USD Rate (PKR) <span className="iDot">i</span>
                  </div>
                  <input
                    value={rate}
                    onChange={(e) => setRate(num(e.target.value))}
                    inputMode="numeric"
                    placeholder="e.g. 278"
                  />
                </div>

                <div className="toggleRow">
                  <div className="toggleText">
                    <p className="toggleTitle">Animations</p>
                    <p className="toggleSub">Smooth blobs + prism outlines</p>
                  </div>

                  <label className="switch" aria-label="Toggle animations">
                    <input
                      type="checkbox"
                      checked={animationsOn}
                      onChange={(e) => setAnimationsOn(e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                <div className="hint">
                  <span>💡</span>
                  <span>
                    GST auto-switches at <b>${GST_THRESHOLD_USD}</b>: {Math.round(GST_BELOW * 100)}% below / {Math.round(GST_ABOVE * 100)}% at or above.
                  </span>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <div className="cardPad">
                <p className="secTitle">PTA Tax Slabs (Editable)</p>

                <div className="table">
                  <div className="tHead">
                    <div>Value Range (USD)</div>
                    <div style={{ textAlign: "center" }}>CNIC</div>
                    <div style={{ textAlign: "center" }}>Passport</div>
                  </div>

                  {slabs.map((s, idx) => (
                    <div className="tRow" key={s.key}>
                      <div>
                        <span className="rangePill">{s.label}{s.key === "501+" ? "" : " USD"}</span>
                      </div>
                      <div className="slabInput">
                        <input
                          value={s.cnic}
                          onChange={(e) => updateSlab(idx, "cnic", e.target.value)}
                          inputMode="numeric"
                        />
                      </div>
                      <div className="slabInput">
                        <input
                          value={s.passport}
                          onChange={(e) => updateSlab(idx, "passport", e.target.value)}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="saveNote">
                  <span>✅</span>
                  <span>Saved automatically on this device (localStorage).</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="col" style={{ minWidth: 0 }}>
            {/* Inventory planning */}
            <div className="card">
              <div className="cardPad">
                <div className="invTop">
                  <div style={{ minWidth: 0 }}>
                    <p className="secTitle">Inventory Planning</p>
                    <div className="invDesc">Add a device and instantly compare CNIC vs Passport.</div>
                    <div className="noteLine">Note: Passport PTA often results in higher profit (but the quick profit field below shows CNIC).</div>
                  </div>

                  <button className="addBtn" onClick={addDevice}>
                    <span style={{ fontSize: 18, lineHeight: 0 }}>＋</span> Add Device
                  </button>
                </div>

                {/* Fields — tuned widths: Model wide; Cost/Ship compact */}
                <div className="invGrid">
                  <div>
                    <div className="fieldLabel">Brand</div>
                    <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                      <option value="">Select…</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="span2">
                    <div className="fieldLabel">Device / Model Name</div>
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. iPhone 15 Pro Max"
                    />
                  </div>

                  <div>
                    <div className="fieldLabel">
                      Purchase Cost (USD) <span className="iDot">i</span>
                    </div>
                    <input
                      value={purchaseUsd}
                      onChange={(e) => setPurchaseUsd(e.target.value)}
                      inputMode="numeric"
                      placeholder="e.g. 1199"
                    />
                  </div>

                  <div>
                    <div className="fieldLabel">
                      Shipping (USD) <span className="iDot">i</span>
                    </div>
                    <input
                      value={shipUsd}
                      onChange={(e) => setShipUsd(e.target.value)}
                      inputMode="numeric"
                      placeholder="e.g. 30"
                    />
                  </div>

                  <div>
                    <div className="fieldLabel">
                      Expected Selling Price (PKR) <span className="iDot">i</span>
                    </div>
                    <input
                      value={expectedPkr}
                      onChange={(e) => setExpectedPkr(e.target.value)}
                      inputMode="numeric"
                      placeholder="e.g. 525000"
                    />
                  </div>

                  <div>
                    <div className="fieldLabel">Profit / Loss (Quick)</div>
                    <div className={`profitField ${planningProfitLabel === "—" ? "" : planningProfitTone}`}>{planningProfitLabel}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Devices */}
            <div className="card" style={{ marginTop: 14 }}>
              <div className="devicesHeader">
                <h2 className="devicesTitle">Devices</h2>
                <div className="count">{devices.length} device(s)</div>
              </div>

              <div className="cardsWrap">
                <div className="cards">
                  {devices.map((d) => {
                    const c = computeDevice({
                      rate,
                      slabs,
                      brand: d.brand,
                      model: d.model,
                      purchaseUsd: d.purchaseUsd,
                      shipUsd: d.shipUsd,
                      expectedPkr: d.expectedPkr,
                    });

                    const cnicTone = c.profitCnic >= 0 ? "good" : "bad";
                    const passTone = c.profitPass >= 0 ? "good" : "bad";

                    return (
                      <div className="dCard" key={d.id}>
                        <div className="dTop">
                          <div style={{ minWidth: 0 }}>
                            <div className="dBrand">{d.brand}</div>
                            <div className="dName">{d.model}</div>
                            <div className="pillRow">
                              <span className="pill">Slab: {c.slabLabel} USD</span>
                              <span className="pill">GST: {Math.round(c.gstRate * 100)}%</span>
                            </div>
                          </div>
                          <button className="trash" onClick={() => removeDevice(d.id)} title="Remove">
                            <svg className="ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M9 3h6m-8 4h10m-9 0v14a2 2 0 002 2h4a2 2 0 002-2V7" stroke="rgba(17,24,39,.75)" strokeWidth="1.7" strokeLinecap="round"/>
                              <path d="M10 11v7M14 11v7" stroke="rgba(17,24,39,.55)" strokeWidth="1.7" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>

                        {/* Horizontal split CNIC + Passport (prevents wrapping issues) */}
                        <div className="dMid">
                          <div className="twoCol">
                            <div className="mini">
                              <div className="miniHead">
                                <div className="miniLabel">CNIC</div>
                                <div className={`profitPill ${cnicTone}`}>{c.profitCnic >= 0 ? `PROFIT • ${fmtRs(c.profitCnic)}` : `LOSS • ${fmtRs(Math.abs(c.profitCnic))}`}</div>
                              </div>
                              <div className="kv">
                                <div className="k">Landed</div>
                                <div className="v big">{fmtRs(c.landedCnic)}</div>
                                <div className="k">Margin</div>
                                <div className="v">{nf1.format(c.marginCnic)}%</div>
                                <div className="k">Base</div>
                                <div className="v">{fmtUsd(c.usd)}</div>
                              </div>
                            </div>

                            <div className="mini">
                              <div className="miniHead">
                                <div className="miniLabel">Passport</div>
                                <div className={`profitPill ${passTone}`}>{c.profitPass >= 0 ? `PROFIT • ${fmtRs(c.profitPass)}` : `LOSS • ${fmtRs(Math.abs(c.profitPass))}`}</div>
                              </div>
                              <div className="kv">
                                <div className="k">Landed</div>
                                <div className="v big">{fmtRs(c.landedPass)}</div>
                                <div className="k">Margin</div>
                                <div className="v">{nf1.format(c.marginPass)}%</div>
                                <div className="k">Base</div>
                                <div className="v">{fmtUsd(c.usd)}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="dBottom">
                          <div className="summary">
                            <div>Sale</div>
                            <div className="sv">{fmtRs(c.sale)}</div>
                            <div>Cost + Ship</div>
                            <div className="sv">{fmtUsd(num(d.purchaseUsd))} + {fmtUsd(num(d.shipUsd))}</div>
                            <div>USD→PKR</div>
                            <div className="sv">{nf0.format(num(rate))}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="exportBar">
                  <div className="expText">Export the full device list (CSV) or printable report (PDF).</div>
                  <div className="expBtns">
                    <button className="expBtn" onClick={exportCSV}>
                      <svg className="ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3v10m0 0l4-4m-4 4L8 9" stroke="rgba(17,24,39,.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="rgba(17,24,39,.5)" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      CSV
                    </button>
                    <button className="expBtn" onClick={onExportPDF}>
                      <svg className="ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3v10m0 0l4-4m-4 4L8 9" stroke="rgba(17,24,39,.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="rgba(17,24,39,.5)" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

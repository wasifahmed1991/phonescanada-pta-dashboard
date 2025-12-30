import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";

/**
 * PhonesCanada PTA Dashboard
 * - Editable PTA slabs (localStorage)
 * - Device list (localStorage)
 * - CSV + PDF export
 */

const LS_KEYS = {
  usdPkr: "pc_pta_usdPkr_v1",
  slabs: "pc_pta_slabs_v2",
  devices: "pc_pta_devices_v2",
  anim: "pc_pta_anim_v1",
};

const BRAND_OPTIONS = [
  "Apple",
  "Samsung",
  "Google",
  "Xiaomi",
  "Realme",
  "OnePlus",
  "Oppo",
  "Vivo",
  "Infinix",
  "Tecno",
  "Huawei",
  "Other",
];

const DEFAULT_SLABS = [
  { id: "s0", label: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { id: "s1", label: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { id: "s2", label: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { id: "s3", label: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { id: "s4", label: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { id: "s5", label: "501+", min: 501, max: Number.POSITIVE_INFINITY, cnic: 37007, passport: 36870 },
];

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtUSD(n) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPKR(n) {
  if (!Number.isFinite(n)) return "—";
  return `Rs ${Math.round(n).toLocaleString()}`;
}
function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function pickSlab(slabs, usdValue) {
  const v = safeNum(usdValue);
  return (
    slabs.find((s) => v >= s.min && v <= s.max) ||
    slabs.find((s) => s.min === 501) ||
    slabs[slabs.length - 1]
  );
}

// Load an image (same-origin) into a dataURL so jsPDF can embed it reliably.
async function loadImageAsDataURL(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const p = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
  img.src = src;
  await p;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function App() {
  // IMPORTANT for GitHub Pages: BASE_URL is needed so /phonescanada-pta-dashboard/ works.
  const logoSrc = useMemo(
    () => `${import.meta.env.BASE_URL}phonescanadalogo-web.png`,
    []
  );

  const [usdPkr, setUsdPkr] = useState(() => readLS(LS_KEYS.usdPkr, 278));
  const [animations, setAnimations] = useState(() => readLS(LS_KEYS.anim, true));
  const [slabs, setSlabs] = useState(() => readLS(LS_KEYS.slabs, DEFAULT_SLABS));
  const [devices, setDevices] = useState(() => readLS(LS_KEYS.devices, []));

  // Inventory Planning form
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [purchaseUSD, setPurchaseUSD] = useState("");
  const [shippingUSD, setShippingUSD] = useState("");
  const [salePKR, setSalePKR] = useState("");

  const purchaseN = safeNum(purchaseUSD);
  const shippingN = safeNum(shippingUSD);
  const baseUSD = purchaseN + shippingN;

  const gstRate = baseUSD >= 500 ? 25 : 18;
  const slab = useMemo(() => pickSlab(slabs, baseUSD), [slabs, baseUSD]);

  const computed = useMemo(() => {
    const rate = safeNum(usdPkr) || 0;
    const basePKR = baseUSD * rate;
    const gst = (basePKR * gstRate) / 100;

    const ptaCNIC = safeNum(slab?.cnic);
    const ptaPass = safeNum(slab?.passport);

    const landedCNIC = basePKR + gst + ptaCNIC;
    const landedPass = basePKR + gst + ptaPass;

    const sale = safeNum(salePKR);
    const profitCNIC = sale - landedCNIC;
    const profitPass = sale - landedPass;

    const marginCNIC = sale > 0 ? (profitCNIC / sale) * 100 : 0;
    const marginPass = sale > 0 ? (profitPass / sale) * 100 : 0;

    const best =
      profitPass >= profitCNIC
        ? { mode: "Passport", profit: profitPass }
        : { mode: "CNIC", profit: profitCNIC };

    return {
      rate,
      basePKR,
      gst,
      landedCNIC,
      landedPass,
      sale,
      profitCNIC,
      profitPass,
      marginCNIC,
      marginPass,
      best,
    };
  }, [usdPkr, baseUSD, gstRate, slab, salePKR]);

  useEffect(() => writeLS(LS_KEYS.usdPkr, usdPkr), [usdPkr]);
  useEffect(() => writeLS(LS_KEYS.anim, animations), [animations]);
  useEffect(() => writeLS(LS_KEYS.slabs, slabs), [slabs]);
  useEffect(() => writeLS(LS_KEYS.devices, devices), [devices]);

  function resetForm() {
    setBrand("");
    setModel("");
    setPurchaseUSD("");
    setShippingUSD("");
    setSalePKR("");
  }

  function addDevice() {
    if (!brand || !model.trim() || purchaseN <= 0 || safeNum(salePKR) <= 0) return;

    const newItem = {
      id: crypto?.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      brand,
      model: model.trim(),
      purchaseUSD: purchaseN,
      shippingUSD: shippingN,
      salePKR: safeNum(salePKR),
      createdAt: Date.now(),
    };
    setDevices((prev) => [newItem, ...prev]);
    resetForm();
  }

  function removeDevice(id) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  const computedDevice = (d) => {
    const rate = safeNum(usdPkr);
    const baseUSDd = safeNum(d.purchaseUSD) + safeNum(d.shippingUSD);
    const gstR = baseUSDd >= 500 ? 25 : 18;
    const slabD = pickSlab(slabs, baseUSDd);

    const basePKR = baseUSDd * rate;
    const gst = (basePKR * gstR) / 100;

    const ptaCNIC = safeNum(slabD.cnic);
    const ptaPass = safeNum(slabD.passport);

    const landedCNIC = basePKR + gst + ptaCNIC;
    const landedPass = basePKR + gst + ptaPass;

    const sale = safeNum(d.salePKR);
    const profitCNIC = sale - landedCNIC;
    const profitPass = sale - landedPass;

    const marginCNIC = sale > 0 ? (profitCNIC / sale) * 100 : 0;
    const marginPass = sale > 0 ? (profitPass / sale) * 100 : 0;

    return {
      baseUSD: baseUSDd,
      gstRate: gstR,
      slab: slabD,
      landedCNIC,
      landedPass,
      profitCNIC,
      profitPass,
      marginCNIC,
      marginPass,
    };
  };

  function exportCSV() {
    const rows = [
      [
        "Brand",
        "Model",
        "Purchase USD",
        "Shipping USD",
        "Base USD",
        "GST %",
        "Slab",
        "Sale PKR",
        "Landed CNIC (PKR)",
        "Profit CNIC (PKR)",
        "Margin CNIC %",
        "Landed Passport (PKR)",
        "Profit Passport (PKR)",
        "Margin Passport %",
      ],
      ...devices.map((d) => {
        const c = computedDevice(d);
        return [
          d.brand,
          d.model,
          d.purchaseUSD,
          d.shippingUSD,
          c.baseUSD,
          c.gstRate,
          c.slab.label,
          d.salePKR,
          Math.round(c.landedCNIC),
          Math.round(c.profitCNIC),
          c.marginCNIC.toFixed(1),
          Math.round(c.landedPass),
          Math.round(c.profitPass),
          c.marginPass.toFixed(1),
        ];
      }),
    ];

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
            return s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phonescanada-pta-devices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 44;

    // Embed logo properly (bigger + contained)
    let logoData = null;
    try {
      logoData = await loadImageAsDataURL(logoSrc);
    } catch {
      // ignore
    }

    // Header card
    doc.setFillColor(247, 248, 252);
    doc.roundedRect(margin, margin, pageW - margin * 2, 64, 14, 14, "F");

    if (logoData) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 14, margin + 16, 160, 32, 12, 12, "F");
      // Increased size + looks clean for wide logo
      doc.addImage(logoData, "PNG", margin + 22, margin + 22, 144, 20);
    }

    doc.setTextColor(18, 22, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PhonesCanada PTA Dashboard — Report", margin + 190, margin + 34);

    doc.setTextColor(92, 100, 120);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `USD/PKR Rate: ${safeNum(usdPkr)}  •  GST: 18% / 25% (threshold $500)`,
      margin + 190,
      margin + 50
    );

    let y = margin + 88;
    const cardGap = 14;
    const cardW = pageW - margin * 2;
    const cardPad = 14;

    const sectionCard = (titleLeft, titleRight) => {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, y, cardW, 122, 14, 14, "F");

      doc.setTextColor(18, 22, 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(titleLeft, margin + cardPad, y + 26);

      if (titleRight) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(titleRight, margin + cardW - cardPad, y + 26, { align: "right" });
      }

      doc.setDrawColor(235, 238, 245);
      doc.line(margin + cardPad, y + 38, margin + cardW - cardPad, y + 38);
    };

    const miniBox = (x, yy, label, lines) => {
      const w = (cardW - cardPad * 2 - 10) / 2;
      doc.setFillColor(247, 248, 252);
      doc.roundedRect(x, yy, w, 64, 12, 12, "F");

      doc.setTextColor(92, 100, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(label, x + 12, yy + 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      let ly = yy + 34;
      for (const [k, v, tone] of lines) {
        doc.setTextColor(92, 100, 120);
        doc.text(k, x + 12, ly);
        doc.setTextColor(...(tone || [18, 22, 38]));
        doc.setFont("helvetica", "bold");
        doc.text(v, x + w - 12, ly, { align: "right" });
        doc.setFont("helvetica", "normal");
        ly += 14;
      }
    };

    devices.forEach((d, idx) => {
      const c = computedDevice(d);
      if (y + 140 > pageH - margin) {
        doc.addPage();
        y = margin;
      }

      sectionCard(`${idx + 1}. ${d.brand} ${d.model}`, fmtPKR(d.salePKR));
      doc.setTextColor(92, 100, 120);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Slab: ${c.slab.label} USD  •  GST: ${c.gstRate}%`, margin + cardPad, y + 56);

      const innerY = y + 66;
      const leftX = margin + cardPad;
      const rightX = margin + cardPad + (cardW - cardPad * 2 - 10) / 2 + 10;

      miniBox(leftX, innerY, "CNIC", [
        ["Base (Cost+Ship)", `${fmtUSD(d.purchaseUSD)} + ${fmtUSD(d.shippingUSD)} (USD→PKR ${safeNum(usdPkr)})`],
        ["Landed", fmtPKR(c.landedCNIC)],
        ["Profit", fmtPKR(c.profitCNIC), c.profitCNIC >= 0 ? [10, 120, 80] : [190, 40, 40]],
        ["Margin", fmtPct(c.marginCNIC)],
      ]);

      miniBox(rightX, innerY, "PASSPORT", [
        ["Base (Cost+Ship)", `${fmtUSD(d.purchaseUSD)} + ${fmtUSD(d.shippingUSD)} (USD→PKR ${safeNum(usdPkr)})`],
        ["Landed", fmtPKR(c.landedPass)],
        ["Profit", fmtPKR(c.profitPass), c.profitPass >= 0 ? [10, 120, 80] : [190, 40, 40]],
        ["Margin", fmtPct(c.marginPass)],
      ]);

      y += 122 + cardGap;
    });

    doc.setTextColor(150, 155, 170);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Generated by PhonesCanada PTA Dashboard", margin, pageH - 22);

    doc.save("phonescanada-pta-report.pdf");
  }

  const bestBadge = (() => {
    const sale = computed.sale;
    if (!sale || purchaseN <= 0) return { label: "—", tone: "neutral" };
    const profit = computed.best.profit;
    const prefix = profit >= 0 ? "Profit" : "Loss";
    const tone = profit >= 0 ? "good" : "bad";
    return {
      label: `${computed.best.mode} • ${prefix} ${fmtPKR(Math.abs(profit)).replace("Rs ", "Rs ")}`,
      tone,
    };
  })();

  const inventoryValid = brand && model.trim() && purchaseN > 0 && safeNum(salePKR) > 0;

  return (
    <div className="pc-root">
      <style>{`
        :root{
          --pc-bg1:#ffd1d7;
          --pc-bg2:#d8e8ff;
          --pc-bg3:#c9ffe8;
          --pc-ink:#0f172a;
          --pc-muted:#5b6477;
          --pc-border:rgba(15,23,42,.10);
          --pc-card:rgba(255,255,255,.74);
          --pc-shadow: 0 14px 40px rgba(15,23,42,.10);
          --pc-shadow2: 0 10px 28px rgba(15,23,42,.08);
          --pc-radius: 22px;
          --pc-good-bg: rgba(16,185,129,.12);
          --pc-good-bd: rgba(16,185,129,.30);
          --pc-good: #0b6b4a;
          --pc-bad-bg: rgba(239,68,68,.12);
          --pc-bad-bd: rgba(239,68,68,.30);
          --pc-bad: #9b1c1c;
          --pc-chip: rgba(15,23,42,.06);
        }

        *{ box-sizing:border-box; }
        html,body,#root{ height:100%; }
        body{
          margin:0;
          font-family: "Saira", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
          font-weight: 400;
          color: var(--pc-ink);
          background: linear-gradient(120deg,var(--pc-bg1),var(--pc-bg2),var(--pc-bg3));
          overflow-x:hidden;
        }

        .pc-root{ min-height:100%; position:relative; }

        /* Background layer */
        .pc-bg{
          position:fixed; inset:0;
          pointer-events:none;
          z-index:0;
          overflow:hidden;
        }
        .pc-blob{
          position:absolute;
          width: 520px; height:520px;
          filter: blur(28px);
          opacity:.55;
          border-radius: 999px;
          mix-blend-mode: screen;
          animation: blobMove 10s ease-in-out infinite alternate;
        }
        .pc-blob.b1{ left:-160px; top:-160px; background: radial-gradient(circle at 30% 30%, rgba(255,90,124,.75), rgba(255,90,124,0)); animation-duration: 11s; }
        .pc-blob.b2{ right:-180px; top:10%; background: radial-gradient(circle at 30% 30%, rgba(96,165,250,.70), rgba(96,165,250,0)); animation-duration: 12s; }
        .pc-blob.b3{ left:10%; bottom:-200px; background: radial-gradient(circle at 30% 30%, rgba(34,197,94,.55), rgba(34,197,94,0)); animation-duration: 13s; }

        .pc-prism{
          position:absolute;
          width: 240px; height: 240px;
          border-radius: 36px;
          border: 2px solid rgba(255,255,255,.22);
          box-shadow: 0 0 0 1px rgba(15,23,42,.05) inset;
          transform: rotate(12deg);
          opacity:.40;
          animation: prismFloat 7s ease-in-out infinite alternate;
        }
        .pc-prism.p1{ left:8%; top:28%; }
        .pc-prism.p2{ right:10%; bottom:16%; width:180px; height:180px; border-radius: 28px; animation-duration: 6.5s; transform: rotate(-10deg); }

        .pc-dots{
          position:absolute; inset:0;
          background-image: radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px);
          background-size: 34px 34px;
          opacity:.20;
          animation: dotsDrift 9s linear infinite;
        }

        @keyframes blobMove{
          from{ transform: translate3d(0,0,0) scale(1); }
          to{ transform: translate3d(120px,80px,0) scale(1.12); }
        }
        @keyframes prismFloat{
          from{ transform: translate3d(0,0,0) rotate(12deg); }
          to{ transform: translate3d(24px,-18px,0) rotate(16deg); }
        }
        @keyframes dotsDrift{
          from{ transform: translate3d(0,0,0); }
          to{ transform: translate3d(40px,-30px,0); }
        }

        /* Layout */
        .pc-shell{
          position:relative;
          z-index:1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 18px 54px;
        }

        .pc-header{
          display:flex;
          align-items:center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: var(--pc-radius);
          background: var(--pc-card);
          border: 1px solid var(--pc-border);
          box-shadow: var(--pc-shadow);
          backdrop-filter: blur(10px);
        }

        /* LOGO FIX (WEB) */
        .pc-brandmark{
          width: 84px;
          height: 64px;
          border-radius: 18px;
          background: linear-gradient(140deg, rgba(255,90,124,.25), rgba(96,165,250,.18));
          border: 1px solid rgba(15,23,42,.10);
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        }
        .pc-brandmark img{
          width: 140px;            /* wide logo */
          height: 28px;            /* keep it crisp */
          object-fit: contain;
          filter: drop-shadow(0 6px 18px rgba(15,23,42,.10));
        }

        .pc-hTitle{
          margin:0;
          font-size: 24px;
          letter-spacing: .2px;
          font-weight: 600; /* lighter than before */
          line-height: 1.1;
        }
        .pc-hSub{
          margin-top: 6px;
          color: var(--pc-muted);
          font-size: 14px;
          font-weight: 400;
        }

        .pc-grid{
          margin-top: 16px;
          display:grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
        }
        @media (max-width: 980px){
          .pc-grid{ grid-template-columns: 1fr; }
        }

        .pc-card{
          background: var(--pc-card);
          border: 1px solid var(--pc-border);
          border-radius: var(--pc-radius);
          box-shadow: var(--pc-shadow2);
          backdrop-filter: blur(10px);
        }
        .pc-card.pad{ padding: 16px; }

        .pc-sectionTitle{
          font-weight: 600;
          font-size: 13px;
          letter-spacing: .12em;
          color: rgba(15,23,42,.70);
          text-transform: uppercase;
          margin: 0 0 12px;
        }

        .pc-field{
          display:grid;
          gap: 8px;
        }
        .pc-labelRow{
          display:flex;
          align-items:center;
          gap:8px;
          color: rgba(15,23,42,.70);
          font-size: 13px;
          font-weight: 500;
        }
        .pc-infoDot{
          width: 18px; height: 18px;
          border-radius: 999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border: 1px solid rgba(15,23,42,.18);
          color: rgba(15,23,42,.60);
          font-size: 12px;
          font-weight: 600;
          background: rgba(255,255,255,.55);
        }

        input, select{
          width: 100%;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,.14);
          background: rgba(255,255,255,.78);
          padding: 12px 14px;
          font-size: 16px;
          outline: none;
          font-family: inherit;
          font-weight: 400;
          color: var(--pc-ink);
        }
        input::placeholder{ color: rgba(15,23,42,.40); }

        /* Toggle */
        .pc-switch{
          display:flex; align-items:center; justify-content:space-between;
          gap: 10px;
          padding: 10px 0 4px;
        }
        .pc-switchLeft{ display:flex; flex-direction:column; gap:2px; }
        .pc-switchTitle{ font-weight: 600; font-size: 16px; }
        .pc-switchHint{ color: var(--pc-muted); font-size: 13px; }

        .pc-toggle{
          width: 56px; height: 32px;
          border-radius: 999px;
          background: rgba(15,23,42,.10);
          border: 1px solid rgba(15,23,42,.12);
          position:relative;
          cursor:pointer;
          transition: background .2s ease, box-shadow .2s ease;
          box-shadow: inset 0 1px 2px rgba(15,23,42,.10);
        }
        .pc-toggle.on{
          background: linear-gradient(135deg, rgba(255,90,124,.95), rgba(255,140,90,.85));
          box-shadow: 0 10px 26px rgba(255,90,124,.22);
        }
        .pc-knob{
          width: 26px; height: 26px;
          border-radius: 999px;
          background: rgba(255,255,255,.92);
          position:absolute;
          top: 2px; left: 2px;
          box-shadow: 0 10px 22px rgba(15,23,42,.18);
          transition: transform .22s ease;
        }
        .pc-toggle.on .pc-knob{ transform: translateX(24px); }

        .pc-note{
          margin-top: 10px;
          color: var(--pc-muted);
          font-size: 13px;
          line-height: 1.35;
          display:flex;
          gap: 8px;
          align-items:flex-start;
        }

        /* Tax slabs */
        .pc-slabsGrid{
          border: 1px solid rgba(15,23,42,.10);
          border-radius: 18px;
          overflow:hidden;
          background: rgba(255,255,255,.58);
        }
        .pc-slabsHead, .pc-slabRow{
          display:grid;
          grid-template-columns: 132px 1fr 1fr; /* equal width CNIC/Passport */
          gap: 0;
          align-items:center;
        }
        .pc-slabsHead{
          padding: 12px 12px;
          background: rgba(15,23,42,.03);
          font-size: 12px;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: rgba(15,23,42,.65);
          font-weight: 600;
        }
        .pc-slabRow{
          padding: 12px 12px;
          border-top: 1px solid rgba(15,23,42,.08);
          gap: 10px;
        }
        .pc-rangePill{
          width: fit-content;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(15,23,42,.05);
          border: 1px solid rgba(15,23,42,.08);
          font-weight: 600;
          color: rgba(15,23,42,.75);
          font-size: 16px;
        }
        .pc-slabRow input{
          padding: 10px 12px;
          border-radius: 16px;
          text-align:center;
          font-weight: 600;
        }

        /* Planner */
        .pc-plannerHead{
          display:flex; align-items:flex-start; justify-content:space-between; gap: 14px;
          margin-bottom: 10px;
        }
        .pc-btn{
          border: none;
          border-radius: 999px;
          padding: 12px 16px;
          cursor:pointer;
          font-family: inherit;
          font-weight: 600;
          font-size: 15px;
          color: white;
          background: linear-gradient(135deg, rgba(255,90,124,.96), rgba(255,140,90,.88));
          box-shadow: 0 16px 34px rgba(255,90,124,.22);
          display:inline-flex;
          align-items:center;
          gap: 10px;
          white-space: nowrap;
        }
        .pc-btn:disabled{
          opacity:.55;
          cursor:not-allowed;
          box-shadow:none;
        }
        .pc-btnGhost{
          border-radius: 999px;
          padding: 10px 14px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.72);
          font-weight: 600;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap: 10px;
          white-space: nowrap;
        }

        /* INVENTORY FIX: stable responsive grid + no weird wrapping */
        .pc-formGrid{
          display:grid;
          grid-template-columns: 170px 1.3fr 170px 170px 1.2fr 320px;
          gap: 12px;
          align-items:end;
        }
        @media (max-width: 1100px){
          .pc-formGrid{ grid-template-columns: 170px 1fr 170px 170px 1fr; }
          .pc-formGrid .pc-best{ grid-column: 1 / -1; }
        }
        @media (max-width: 720px){
          .pc-formGrid{ grid-template-columns: 1fr 1fr; }
          .pc-formGrid .pc-best{ grid-column: 1 / -1; }
        }

        .pc-bestBox{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.68);
          min-height: 48px;
        }
        .pc-bestBox .k{
          color: rgba(15,23,42,.66);
          font-weight: 500;
          font-size: 13px;
          line-height:1.2;
          white-space: nowrap;
        }

        .pc-pill{
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(15,23,42,.04);
          font-weight: 700;
          font-size: 13px;
          white-space: nowrap; /* stops Passport breaking down */
        }
        .pc-pill.good{
          background: var(--pc-good-bg);
          border-color: var(--pc-good-bd);
          color: var(--pc-good);
        }
        .pc-pill.bad{
          background: var(--pc-bad-bg);
          border-color: var(--pc-bad-bd);
          color: var(--pc-bad);
        }

        /* Devices */
        .pc-devHead{
          display:flex; align-items:baseline; justify-content:space-between;
          margin: 8px 0 12px;
        }
        .pc-devTitle{
          margin:0;
          font-size: 34px;
          font-weight: 600;
          letter-spacing:-.3px;
        }
        .pc-count{
          color: rgba(15,23,42,.60);
          font-weight: 500;
        }

        .pc-cards{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 980px){
          .pc-cards{ grid-template-columns: 1fr; }
        }

        .pc-device{
          background: rgba(255,255,255,.82);
          border: 1px solid rgba(15,23,42,.10);
          border-radius: 22px;
          box-shadow: var(--pc-shadow2);
          overflow:hidden;
        }
        .pc-deviceTop{
          display:flex;
          justify-content:space-between;
          gap: 10px;
          padding: 14px 14px 10px;
        }
        .pc-deviceTop .meta{ min-width:0; }
        .pc-brand{
          text-transform: uppercase;
          letter-spacing: .22em;
          font-weight: 600;
          color: rgba(15,23,42,.45);
          font-size: 12px;
        }
        .pc-model{
          margin-top: 4px;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -.2px;
        }
        .pc-trash{
          width: 40px; height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.82);
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .pc-trash svg{ opacity:.65; }

        .pc-tags{
          display:flex; gap: 10px; flex-wrap:wrap;
          padding: 0 14px 12px;
        }
        .pc-chip{
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--pc-chip);
          border: 1px solid rgba(15,23,42,.10);
          font-weight: 600;
          color: rgba(15,23,42,.72);
          font-size: 14px;
          white-space: nowrap;
        }

        /* DEVICE FIX: CNIC left, Passport right. Numbers never wrap badly */
        .pc-compare{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(15,23,42,.08);
        }
        @media (max-width: 520px){
          .pc-compare{ grid-template-columns: 1fr; }
        }

        .pc-side{
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.75);
          border-radius: 18px;
          padding: 12px;
          min-width:0;
        }
        .pc-sideHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .pc-sideHead .t{
          font-weight: 700;
          letter-spacing: .22em;
          font-size: 13px;
          color: rgba(15,23,42,.60);
          text-transform: uppercase;
          white-space: nowrap;
        }
        .pc-kv{
          display:grid;
          grid-template-columns: 1fr auto;
          gap: 8px 10px;
          border-top: 1px dashed rgba(15,23,42,.12);
          padding-top: 10px;
        }
        .pc-kv .k{
          color: rgba(15,23,42,.60);
          font-weight: 500;
          white-space: nowrap;
        }
        .pc-kv .v{
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          font-weight: 700;
          font-size: 16px; /* smaller so big numbers fit */
          max-width: 100%;
        }
        .pc-kv .v.small{ font-size: 15px; }

        .pc-footer{
          display:grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(15,23,42,.08);
          color: rgba(15,23,42,.60);
          font-weight: 500;
        }
        .pc-footer .row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          font-variant-numeric: tabular-nums;
        }
        .pc-footer .row span:last-child{
          color: rgba(15,23,42,.82);
          font-weight: 700;
          white-space: nowrap;
        }

        .pc-export{
          margin-top: 14px;
          padding: 14px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pc-export .t{
          color: rgba(15,23,42,.70);
          font-weight: 500;
          font-size: 16px;
        }
        .pc-exportBtns{ display:flex; gap: 10px; }

        .pc-ellipsis{
          overflow:hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
      `}</style>

      <div className="pc-bg" aria-hidden="true">
        {animations && (
          <>
            <div className="pc-dots" />
            <div className="pc-blob b1" />
            <div className="pc-blob b2" />
            <div className="pc-blob b3" />
            <div className="pc-prism p1" />
            <div className="pc-prism p2" />
          </>
        )}
      </div>

      <div className="pc-shell">
        <header className="pc-header">
          <div className="pc-brandmark" title="PhonesCanada">
            <img
              src={logoSrc}
              alt="PhonesCanada"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="pc-hTitle">PhonesCanada PTA Dashboard</h1>
            <div className="pc-hSub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</div>
          </div>
        </header>

        <div className="pc-grid">
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="pc-card pad">
              <div className="pc-sectionTitle">System Preferences</div>

              <div className="pc-field">
                <div className="pc-labelRow">
                  USD Rate (PKR) <span className="pc-infoDot">i</span>
                </div>
                <input
                  inputMode="numeric"
                  value={usdPkr}
                  onChange={(e) => setUsdPkr(e.target.value)}
                  placeholder="e.g. 278"
                />
              </div>

              <div className="pc-switch">
                <div className="pc-switchLeft">
                  <div className="pc-switchTitle">Animations</div>
                  <div className="pc-switchHint">Smooth blobs + prism outlines</div>
                </div>
                <div
                  className={`pc-toggle ${animations ? "on" : ""}`}
                  role="switch"
                  aria-checked={animations}
                  tabIndex={0}
                  onClick={() => setAnimations((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setAnimations((v) => !v);
                  }}
                >
                  <div className="pc-knob" />
                </div>
              </div>

              <div className="pc-note">
                <span>💡</span>
                <span>
                  GST auto-switches at <b>$500</b>: 18% below / 25% at or above.
                </span>
              </div>
            </div>

            <div className="pc-card pad">
              <div className="pc-sectionTitle">PTA Tax Slabs (Editable)</div>

              <div className="pc-slabsGrid">
                <div className="pc-slabsHead">
                  <div>Value Range (USD)</div>
                  <div style={{ textAlign: "center" }}>CNIC</div>
                  <div style={{ textAlign: "center" }}>Passport</div>
                </div>

                {slabs.map((s) => (
                  <div className="pc-slabRow" key={s.id}>
                    <div>
                      <span className="pc-rangePill">{s.label}</span>
                    </div>
                    <div>
                      <input
                        inputMode="numeric"
                        value={s.cnic}
                        onChange={(e) => {
                          const v = safeNum(e.target.value);
                          setSlabs((prev) => prev.map((x) => (x.id === s.id ? { ...x, cnic: v } : x)));
                        }}
                      />
                    </div>
                    <div>
                      <input
                        inputMode="numeric"
                        value={s.passport}
                        onChange={(e) => {
                          const v = safeNum(e.target.value);
                          setSlabs((prev) => prev.map((x) => (x.id === s.id ? { ...x, passport: v } : x)));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pc-note" style={{ marginTop: 12 }}>
                <span>✅</span>
                <span>Saved automatically on this device (localStorage).</span>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="pc-card pad">
              <div className="pc-plannerHead">
                <div>
                  <div className="pc-sectionTitle" style={{ marginBottom: 6 }}>
                    Inventory Planning
                  </div>
                  <div style={{ color: "var(--pc-muted)", fontSize: 14 }}>
                    Add a device and instantly compare CNIC vs Passport.
                  </div>
                </div>

                <button className="pc-btn" onClick={addDevice} disabled={!inventoryValid}>
                  <span style={{ fontSize: 18, lineHeight: 0 }}>＋</span> Add Device
                </button>
              </div>

              <div className="pc-formGrid">
                <div className="pc-field">
                  <div className="pc-labelRow">Brand</div>
                  <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="">Select…</option>
                    {BRAND_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pc-field">
                  <div className="pc-labelRow">Device / Model Name</div>
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. iPhone 15 Pro Max" />
                </div>

                <div className="pc-field">
                  <div className="pc-labelRow">
                    Purchase Cost (USD) <span className="pc-infoDot">i</span>
                  </div>
                  <input inputMode="numeric" value={purchaseUSD} onChange={(e) => setPurchaseUSD(e.target.value)} placeholder="e.g. 1199" />
                </div>

                <div className="pc-field">
                  <div className="pc-labelRow">
                    Shipping (USD) <span className="pc-infoDot">i</span>
                  </div>
                  <input inputMode="numeric" value={shippingUSD} onChange={(e) => setShippingUSD(e.target.value)} placeholder="e.g. 30" />
                </div>

                <div className="pc-field">
                  <div className="pc-labelRow">
                    Expected Selling Price (PKR) <span className="pc-infoDot">i</span>
                  </div>
                  <input inputMode="numeric" value={salePKR} onChange={(e) => setSalePKR(e.target.value)} placeholder="e.g. 525000" />
                </div>

                <div className="pc-field pc-best">
                  <div className="pc-labelRow">Profit / Loss (Best)</div>
                  <div className="pc-bestBox">
                    <div className="k">
                      Slab: <b>{slab?.label || "—"} USD</b> • GST: <b>{gstRate}%</b>
                    </div>
                    <span className={`pc-pill ${bestBadge.tone === "good" ? "good" : bestBadge.tone === "bad" ? "bad" : ""}`}>
                      {bestBadge.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pc-card pad">
              <div className="pc-devHead">
                <h2 className="pc-devTitle">Devices</h2>
                <div className="pc-count">{devices.length} device(s)</div>
              </div>

              <div className="pc-cards">
                {devices.map((d) => {
                  const c = computedDevice(d);

                  const profitPill = (p) => ({
                    cls: p >= 0 ? "good" : "bad",
                    text: `${p >= 0 ? "PROFIT" : "LOSS"} • ${fmtPKR(Math.abs(p)).replace("Rs ", "Rs ")}`,
                  });

                  return (
                    <div key={d.id} className="pc-device">
                      <div className="pc-deviceTop">
                        <div className="meta">
                          <div className="pc-brand">{d.brand}</div>
                          <div className="pc-model pc-ellipsis">{d.model}</div>
                        </div>
                        <button className="pc-trash" onClick={() => removeDevice(d.id)} title="Remove">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v10h-2V9Zm4 0h2v10h-2V9ZM7 9h2v10H7V9Z" fill="currentColor"/>
                          </svg>
                        </button>
                      </div>

                      <div className="pc-tags">
                        <span className="pc-chip">Slab: {c.slab.label} USD</span>
                        <span className="pc-chip">GST: {c.gstRate}%</span>
                      </div>

                      <div className="pc-compare">
                        <div className="pc-side">
                          <div className="pc-sideHead">
                            <div className="t">CNIC</div>
                            <span className={`pc-pill ${profitPill(c.profitCNIC).cls}`}>{profitPill(c.profitCNIC).text}</span>
                          </div>
                          <div className="pc-kv">
                            <div className="k">Landed</div>
                            <div className="v">{fmtPKR(c.landedCNIC)}</div>
                            <div className="k">Margin</div>
                            <div className="v small">{fmtPct(c.marginCNIC)}</div>
                          </div>
                        </div>

                        <div className="pc-side">
                          <div className="pc-sideHead">
                            <div className="t">Passport</div>
                            <span className={`pc-pill ${profitPill(c.profitPass).cls}`}>{profitPill(c.profitPass).text}</span>
                          </div>
                          <div className="pc-kv">
                            <div className="k">Landed</div>
                            <div className="v">{fmtPKR(c.landedPass)}</div>
                            <div className="k">Margin</div>
                            <div className="v small">{fmtPct(c.marginPass)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="pc-footer">
                        <div style={{ display: "grid", gap: 8 }}>
                          <div className="row">
                            <span>Sale</span>
                            <span>{fmtPKR(d.salePKR)}</span>
                          </div>
                          <div className="row">
                            <span>Cost+Ship</span>
                            <span>{fmtUSD(d.purchaseUSD)} + {fmtUSD(d.shippingUSD)}</span>
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 8, minWidth: 160 }}>
                          <div className="row">
                            <span>USD→PKR</span>
                            <span>{safeNum(usdPkr) || "—"}</span>
                          </div>
                          <div className="row">
                            <span>&nbsp;</span>
                            <span>&nbsp;</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pc-card pc-export">
                <div className="t">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-exportBtns">
                  <button className="pc-btnGhost" onClick={exportCSV} disabled={devices.length === 0}>
                    ⬇ CSV
                  </button>
                  <button className="pc-btnGhost" onClick={exportPDF} disabled={devices.length === 0}>
                    ⬇ PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, color: "rgba(15,23,42,.55)", fontSize: 12 }}>
          Logo should be at <b>public/phonescanadalogo-web.png</b>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";
import jsPDF from "jspdf";

/**
 * PhonesCanada PTA Dashboard
 * - Vite + GitHub Pages compatible
 * - No logo upload button (auto-load logo from /public)
 * - Editable PTA slabs
 * - Responsive layout + better cards
 * - Saira font + softer weights
 */

const DEFAULT_SETTINGS = {
  usdToPkr: 278,
  gstUnderThreshold: 0.18,
  gstAboveThreshold: 0.25,
  gstThresholdUsd: 500,
  animationEnabled: true,
};

const DEFAULT_PTA_SLABS = [
  { range: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { range: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { range: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { range: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { range: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { range: "501+", min: 501, max: Infinity, cnic: 37007, passport: 36870 },
];

const BRAND_OPTIONS = [
  "Apple",
  "Samsung",
  "Google",
  "Xiaomi",
  "OnePlus",
  "Huawei",
  "Oppo",
  "Vivo",
  "Motorola",
  "Sony",
  "Other",
];

function money(n, currency = "PKR") {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return currency === "PKR" ? "Rs 0" : "$0";
  if (currency === "USD") return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `Rs ${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function clampNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getSlab(slabs, baseUsd) {
  const v = clampNumber(baseUsd);
  return slabs.find((s) => v >= s.min && v <= s.max) || slabs[slabs.length - 1];
}

function computeDevice({ settings, slabs, device }) {
  const usdToPkr = clampNumber(settings.usdToPkr);
  const purchaseUsd = clampNumber(device.purchaseUsd);
  const shippingUsd = clampNumber(device.shippingUsd);
  const expectedSalePkr = clampNumber(device.expectedSalePkr);

  const baseUsd = purchaseUsd + shippingUsd;
  const slab = getSlab(slabs, baseUsd);

  const gstRate = purchaseUsd >= settings.gstThresholdUsd ? settings.gstAboveThreshold : settings.gstUnderThreshold;

  const basePkr = baseUsd * usdToPkr;
  const gstPkr = basePkr * gstRate;

  const landedCnic = basePkr + gstPkr + slab.cnic;
  const landedPassport = basePkr + gstPkr + slab.passport;

  const profitCnic = expectedSalePkr - landedCnic;
  const profitPassport = expectedSalePkr - landedPassport;

  const marginCnic = expectedSalePkr > 0 ? (profitCnic / expectedSalePkr) * 100 : 0;
  const marginPassport = expectedSalePkr > 0 ? (profitPassport / expectedSalePkr) * 100 : 0;

  const bestProfit = Math.max(profitCnic, profitPassport);

  return {
    baseUsd,
    slab,
    gstRate,
    basePkr,
    gstPkr,
    landedCnic,
    landedPassport,
    profitCnic,
    profitPassport,
    marginCnic,
    marginPassport,
    bestProfit,
  };
}

function profitBadge(bestProfit) {
  const p = clampNumber(bestProfit);
  if (p > 0) return { label: `Profit • ${money(p)}`, type: "good" };
  if (p < 0) return { label: `Loss • ${money(Math.abs(p))}`, type: "bad" };
  return { label: "—", type: "neutral" };
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [slabs, setSlabs] = useState(DEFAULT_PTA_SLABS);

  const [form, setForm] = useState({
    brand: "",
    model: "",
    purchaseUsd: "",
    shippingUsd: "",
    expectedSalePkr: "",
  });

  const [devices, setDevices] = useState([]);

  const liveComputed = useMemo(() => {
    const mock = {
      brand: form.brand || "—",
      model: form.model || "—",
      purchaseUsd: form.purchaseUsd,
      shippingUsd: form.shippingUsd,
      expectedSalePkr: form.expectedSalePkr,
    };
    return computeDevice({ settings, slabs, device: mock });
  }, [form, settings, slabs]);

  const liveBadge = profitBadge(liveComputed.bestProfit);

  function addDevice() {
    // Basic guard: need at least brand + model or any numeric input
    const hasAny =
      (form.brand || "").trim() ||
      (form.model || "").trim() ||
      String(form.purchaseUsd).trim() ||
      String(form.shippingUsd).trim() ||
      String(form.expectedSalePkr).trim();

    if (!hasAny) return;

    const newItem = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      brand: form.brand || "Other",
      model: form.model || "Device",
      purchaseUsd: clampNumber(form.purchaseUsd),
      shippingUsd: clampNumber(form.shippingUsd),
      expectedSalePkr: clampNumber(form.expectedSalePkr),
      createdAt: Date.now(),
    };

    setDevices((prev) => [newItem, ...prev]);

    // ✅ reset form after add
    setForm({
      brand: "",
      model: "",
      purchaseUsd: "",
      shippingUsd: "",
      expectedSalePkr: "",
    });
  }

  function removeDevice(id) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  function exportCSV() {
    const rows = [
      [
        "Brand",
        "Model",
        "Purchase USD",
        "Shipping USD",
        "Expected Sale PKR",
        "Slab",
        "GST",
        "Landed (CNIC)",
        "Profit (CNIC)",
        "Landed (Passport)",
        "Profit (Passport)",
        "Best Profit",
      ],
    ];

    devices.forEach((d) => {
      const c = computeDevice({ settings, slabs, device: d });
      rows.push([
        d.brand,
        d.model,
        d.purchaseUsd,
        d.shippingUsd,
        d.expectedSalePkr,
        c.slab.range,
        `${Math.round(c.gstRate * 100)}%`,
        Math.round(c.landedCnic),
        Math.round(c.profitCnic),
        Math.round(c.landedPassport),
        Math.round(c.profitPassport),
        Math.round(c.bestProfit),
      ]);
    });

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
            return s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phonescanada-pta-devices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 44;

    const title = "PhonesCanada PTA Dashboard — Report";
    const subtitle = `USD/PKR Rate: ${settings.usdToPkr}  •  GST: ${Math.round(settings.gstUnderThreshold * 100)}% / ${Math.round(
      settings.gstAboveThreshold * 100
    )}% (threshold $${settings.gstThresholdUsd})`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, margin, 60);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(subtitle, margin, 80);

    // Divider
    doc.setDrawColor(220);
    doc.line(margin, 92, pageW - margin, 92);

    let y = 120;

    const addRow = (label, value, yPos) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(label, margin, yPos);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(10);
      doc.text(value, pageW - margin, yPos, { align: "right" });
    };

    if (devices.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(80);
      doc.text("No devices found.", margin, y);
      doc.save("phonescanada-pta-report.pdf");
      return;
    }

    devices.forEach((d, idx) => {
      const c = computeDevice({ settings, slabs, device: d });
      const gstText = `${Math.round(c.gstRate * 100)}%`;
      const baseText = `${money(d.purchaseUsd, "USD")} + ${money(d.shippingUsd, "USD")}  •  USD→PKR ${settings.usdToPkr}`;

      // Page break
      if (y > 720) {
        doc.addPage();
        y = 70;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15);
      doc.text(`${idx + 1}. ${d.brand} ${d.model}`, margin, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Slab: ${c.slab.range} USD  •  GST: ${gstText}`, margin, y + 16);

      // Card box
      const boxY = y + 26;
      const boxH = 118;
      doc.setDrawColor(230);
      doc.setFillColor(248, 248, 252);
      doc.roundedRect(margin, boxY, pageW - margin * 2, boxH, 10, 10, "FD");

      addRow("Expected Sale", money(d.expectedSalePkr), boxY + 26);
      addRow("Base (Cost + Ship)", baseText, boxY + 46);
      addRow("Landed (CNIC)", money(c.landedCnic), boxY + 66);
      addRow("Profit (CNIC)", money(c.profitCnic), boxY + 86);
      addRow("Landed (Passport)", money(c.landedPassport), boxY + 106);

      // profit passport line is tight; put it below within box height
      // (keep text readable)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text("Profit (Passport)", margin, boxY + 126);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(10);
      doc.text(money(c.profitPassport), pageW - margin, boxY + 126, { align: "right" });

      y = boxY + boxH + 28;
    });

    doc.save("phonescanada-pta-report.pdf");
  }

  const computedDevices = useMemo(() => {
    return devices.map((d) => ({ device: d, calc: computeDevice({ settings, slabs, device: d }) }));
  }, [devices, settings, slabs]);

  const logoUrl = `${import.meta.env.BASE_URL}phonescanadalogo-web.png`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600&display=swap');

        :root{
          --pc-bg1:#fff6f8;
          --pc-bg2:#f4f7ff;
          --pc-ink:#0f172a;
          --pc-muted:#64748b;
          --pc-card:rgba(255,255,255,.70);
          --pc-border:rgba(15,23,42,.08);
          --pc-shadow: 0 18px 50px rgba(15, 23, 42, .10);
          --pc-shadow2: 0 10px 24px rgba(15, 23, 42, .08);
          --pc-radius:24px;
          --pc-accent:#ef4444;
          --pc-good-bg: rgba(16,185,129,.14);
          --pc-good-border: rgba(16,185,129,.35);
          --pc-bad-bg: rgba(239,68,68,.12);
          --pc-bad-border: rgba(239,68,68,.35);
        }

        html, body { height: 100%; }
        body{
          margin:0;
          font-family: "Saira", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          color: var(--pc-ink);
          background: linear-gradient(120deg, var(--pc-bg1), var(--pc-bg2));
          overflow-x:hidden;
        }

        /* Background blobs */
        .pc-bg{
          position: fixed;
          inset: 0;
          z-index: -1;
          overflow: hidden;
        }
        .pc-blob{
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 999px;
          filter: blur(40px);
          opacity: .55;
          animation: pcFloat 14s ease-in-out infinite;
          transform: translate3d(0,0,0);
        }
        .pc-blob.b1{ left: -120px; top: -160px; background: radial-gradient(circle at 30% 30%, rgba(239,68,68,.70), rgba(239,68,68,0)); }
        .pc-blob.b2{ right: -180px; top: 80px; background: radial-gradient(circle at 40% 40%, rgba(59,130,246,.55), rgba(59,130,246,0)); animation-delay: -4s;}
        .pc-blob.b3{ left: 20%; bottom: -220px; background: radial-gradient(circle at 35% 35%, rgba(168,85,247,.40), rgba(168,85,247,0)); animation-delay: -7s;}
        .pc-blob.b4{ right: 18%; bottom: -260px; background: radial-gradient(circle at 40% 40%, rgba(16,185,129,.35), rgba(16,185,129,0)); animation-delay: -10s;}

        @keyframes pcFloat{
          0%{ transform: translate3d(0,0,0) scale(1); }
          50%{ transform: translate3d(40px,-20px,0) scale(1.06); }
          100%{ transform: translate3d(0,0,0) scale(1); }
        }

        .pc-wrap{
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 18px 40px;
        }

        .pc-card{
          background: var(--pc-card);
          border: 1px solid var(--pc-border);
          box-shadow: var(--pc-shadow);
          border-radius: var(--pc-radius);
          backdrop-filter: blur(10px);
        }

        .pc-header{
          display:flex;
          align-items:center;
          gap:14px;
          padding:18px 20px;
          margin-bottom:18px;
        }
        .pc-logo{
          width:56px;
          height:56px;
          border-radius: 18px;
          display:grid;
          place-items:center;
          overflow:hidden;
          background: linear-gradient(135deg, rgba(239,68,68,.9), rgba(251,113,133,.8));
          box-shadow: var(--pc-shadow2);
          border: 1px solid rgba(255,255,255,.55);
          flex: 0 0 auto;
        }
        .pc-logo img{
          width: 46px;
          height: 46px;
          object-fit: contain;
          display:block;
        }
        .pc-title{
          display:flex;
          flex-direction:column;
          line-height: 1.05;
        }
        .pc-title h1{
          margin:0;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: .2px;
        }
        .pc-title p{
          margin:4px 0 0;
          color: var(--pc-muted);
          font-weight: 400;
          font-size: 14px;
        }

        .pc-grid{
          display:grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 980px){
          .pc-grid{ grid-template-columns: 1fr; }
        }

        .pc-section{
          padding: 18px;
        }
        .pc-section h2{
          margin:0 0 12px;
          font-size: 16px;
          font-weight: 600;
          letter-spacing:.6px;
          text-transform: uppercase;
          color: rgba(15,23,42,.70);
        }

        .pc-field{
          display:flex;
          flex-direction:column;
          gap:6px;
        }
        .pc-field label{
          font-size: 13px;
          color: rgba(15,23,42,.70);
          font-weight: 500;
        }
        .pc-input, .pc-select{
          height: 44px;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,.12);
          background: rgba(255,255,255,.85);
          padding: 0 14px;
          font-size: 14px;
          outline:none;
        }
        .pc-input:focus, .pc-select:focus{
          border-color: rgba(239,68,68,.35);
          box-shadow: 0 0 0 4px rgba(239,68,68,.10);
        }

        .pc-side{
          display:flex;
          flex-direction:column;
          gap:16px;
          position: sticky;
          top: 16px;
        }
        @media (max-width: 980px){
          .pc-side{ position: static; }
        }

        .pc-toggleRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding-top: 6px;
        }
        .pc-switch{
          width: 56px;
          height: 32px;
          border-radius: 999px;
          background: rgba(239,68,68,.25);
          border: 1px solid rgba(239,68,68,.35);
          position: relative;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .pc-switch.on{
          background: rgba(239,68,68,.40);
        }
        .pc-switchDot{
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: white;
          position:absolute;
          top: 2px;
          left: 2px;
          transition: transform .18s ease;
          box-shadow: 0 10px 18px rgba(15,23,42,.18);
        }
        .pc-switch.on .pc-switchDot{
          transform: translateX(24px);
        }

        .pc-planningTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .pc-btn{
          display:inline-flex;
          align-items:center;
          gap:10px;
          height: 44px;
          border-radius: 999px;
          padding: 0 16px;
          border: none;
          cursor:pointer;
          background: linear-gradient(135deg, rgba(239,68,68,.95), rgba(251,113,133,.9));
          color: white;
          font-weight: 600;
          box-shadow: 0 14px 26px rgba(239,68,68,.18);
        }
        .pc-btn:active{ transform: translateY(1px); }

        .pc-formGrid{
          display:grid;
          gap: 12px;
          grid-template-columns: 1fr 1.4fr 1fr 1fr 1.4fr .9fr;
        }
        @media (max-width: 1100px){
          .pc-formGrid{ grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px){
          .pc-formGrid{ grid-template-columns: 1fr; }
        }

        .pc-pill{
          height: 44px;
          border-radius: 999px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight: 600;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.75);
        }
        .pc-pill.good{
          background: var(--pc-good-bg);
          border-color: var(--pc-good-border);
          color: rgba(5,150,105,1);
        }
        .pc-pill.bad{
          background: var(--pc-bad-bg);
          border-color: var(--pc-bad-border);
          color: rgba(220,38,38,1);
        }
        .pc-pill.neutral{
          color: rgba(15,23,42,.55);
        }

        .pc-subnote{
          margin-top: 10px;
          color: rgba(15,23,42,.58);
          font-size: 13px;
          font-weight: 400;
        }

        .pc-slabTable{
          width: 100%;
          border-collapse: collapse;
          overflow:hidden;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.75);
        }
        .pc-slabTable th, .pc-slabTable td{
          padding: 10px 10px;
          text-align: left;
          font-size: 13px;
        }
        .pc-slabTable th{
          color: rgba(15,23,42,.65);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .6px;
          font-size: 12px;
          background: rgba(15,23,42,.03);
        }
        .pc-slabTable tr + tr td{
          border-top: 1px solid rgba(15,23,42,.06);
        }

        .pc-deviceGrid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 980px){
          .pc-deviceGrid{ grid-template-columns: 1fr; }
        }

        .pc-deviceCard{
          padding: 14px;
          border-radius: 22px;
          background: rgba(255,255,255,.75);
          border: 1px solid rgba(15,23,42,.08);
          box-shadow: var(--pc-shadow2);
          overflow:hidden;
          min-width: 0;
        }

        .pc-deviceTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
        }
        .pc-deviceTop h3{
          margin:0;
          font-size: 16px;
          font-weight: 600;
        }
        .pc-deviceTop .meta{
          margin-top: 4px;
          font-size: 13px;
          color: rgba(15,23,42,.55);
          font-weight: 400;
        }
        .pc-kicker{
          font-size: 12px;
          letter-spacing: .16em;
          color: rgba(15,23,42,.55);
          font-weight: 500;
          text-transform: uppercase;
        }
        .pc-iconBtn{
          width: 40px;
          height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.70);
          display:grid;
          place-items:center;
          cursor:pointer;
        }
        .pc-iconBtn:hover{
          background: rgba(255,255,255,.95);
        }

        .pc-duo{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        @media (max-width: 520px){
          .pc-duo{ grid-template-columns: 1fr; }
        }

        .pc-miniCard{
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.70);
          padding: 12px;
        }
        .pc-miniHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom: 10px;
        }
        .pc-miniHead span{
          font-weight: 600;
          letter-spacing: .12em;
          font-size: 12px;
          text-transform: uppercase;
          color: rgba(15,23,42,.65);
        }
        .pc-lines{
          display:grid;
          gap: 8px;
        }
        .pc-line{
          display:flex;
          align-items:center;
          justify-content:space-between;
          color: rgba(15,23,42,.72);
          font-weight: 400;
        }
        .pc-line strong{
          color: rgba(15,23,42,.95);
          font-weight: 600;
        }

        .pc-bottomRow{
          margin-top: 12px;
          display:flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items:center;
          justify-content: space-between;
          color: rgba(15,23,42,.55);
          font-size: 13px;
          font-weight: 400;
        }

        .pc-exportBar{
          margin-top: 14px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 22px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.65);
          box-shadow: var(--pc-shadow2);
        }
        .pc-exportBar .left{
          color: rgba(15,23,42,.70);
          font-weight: 500;
        }
        .pc-exportBtns{
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pc-ghost{
          height: 42px;
          border-radius: 999px;
          padding: 0 14px;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(255,255,255,.72);
          display:inline-flex;
          align-items:center;
          gap: 10px;
          cursor:pointer;
          font-weight: 600;
          color: rgba(15,23,42,.90);
        }
        .pc-ghost:hover{ background: rgba(255,255,255,.95); }
      `}</style>

      {/* Background */}
      {settings.animationEnabled && (
        <div className="pc-bg">
          <div className="pc-blob b1" />
          <div className="pc-blob b2" />
          <div className="pc-blob b3" />
          <div className="pc-blob b4" />
        </div>
      )}

      <div className="pc-wrap">
        {/* Header */}
        <div className="pc-card pc-header">
          <div className="pc-logo" aria-label="PhonesCanada Logo">
            <img
              src={logoUrl}
              alt="PhonesCanada"
              onError={(e) => {
                // If logo missing, keep it silent (no crash)
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="pc-title">
            <h1>PhonesCanada PTA Dashboard</h1>
            <p>PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
          </div>
        </div>

        <div className="pc-grid">
          {/* Left side */}
          <div className="pc-side">
            <div className="pc-card pc-section">
              <h2>System Preferences</h2>

              <div className="pc-field">
                <label>USD Rate (PKR)</label>
                <input
                  className="pc-input"
                  value={settings.usdToPkr}
                  inputMode="numeric"
                  onChange={(e) => setSettings((s) => ({ ...s, usdToPkr: clampNumber(e.target.value) }))}
                />
              </div>

              <div className="pc-toggleRow">
                <div>
                  <div style={{ fontWeight: 600 }}>Animations</div>
                  <div style={{ color: "rgba(15,23,42,.55)", fontSize: 13 }}>Smooth background blobs</div>
                </div>
                <div
                  className={`pc-switch ${settings.animationEnabled ? "on" : ""}`}
                  onClick={() => setSettings((s) => ({ ...s, animationEnabled: !s.animationEnabled }))}
                  role="switch"
                  aria-checked={settings.animationEnabled}
                  tabIndex={0}
                >
                  <div className="pc-switchDot" />
                </div>
              </div>

              <div className="pc-subnote">
                💡 GST auto-switches at <strong>${settings.gstThresholdUsd}</strong>:{" "}
                {Math.round(settings.gstUnderThreshold * 100)}% below / {Math.round(settings.gstAboveThreshold * 100)}% at or above.
              </div>
            </div>

            <div className="pc-card pc-section">
              <h2>PTA Tax Slabs (Editable)</h2>

              <table className="pc-slabTable">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Value Range (USD)</th>
                    <th>CNIC</th>
                    <th>Passport</th>
                  </tr>
                </thead>
                <tbody>
                  {slabs.map((s, idx) => (
                    <tr key={s.range}>
                      <td style={{ fontWeight: 600 }}>{s.range}</td>
                      <td>
                        <input
                          className="pc-input"
                          style={{ height: 38, borderRadius: 14 }}
                          value={s.cnic}
                          inputMode="numeric"
                          onChange={(e) => {
                            const v = clampNumber(e.target.value);
                            setSlabs((prev) => prev.map((x, i) => (i === idx ? { ...x, cnic: v } : x)));
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="pc-input"
                          style={{ height: 38, borderRadius: 14 }}
                          value={s.passport}
                          inputMode="numeric"
                          onChange={(e) => {
                            const v = clampNumber(e.target.value);
                            setSlabs((prev) => prev.map((x, i) => (i === idx ? { ...x, passport: v } : x)));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pc-subnote">These slabs are editable so you can update future PTA changes anytime.</div>
            </div>
          </div>

          {/* Main column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {/* Inventory Planning */}
            <div className="pc-card pc-section" style={{ minWidth: 0 }}>
              <div className="pc-planningTop">
                <h2 style={{ margin: 0 }}>Inventory Planning</h2>

                <button className="pc-btn" onClick={addDevice}>
                  <Plus size={18} /> Add Device
                </button>
              </div>

              <div className="pc-formGrid">
                <div className="pc-field">
                  <label>Brand</label>
                  <select
                    className="pc-select"
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {BRAND_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pc-field">
                  <label>Device / Model Name</label>
                  <input
                    className="pc-input"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro Max"
                  />
                </div>

                <div className="pc-field">
                  <label>Purchase Cost (USD)</label>
                  <input
                    className="pc-input"
                    value={form.purchaseUsd}
                    inputMode="decimal"
                    onChange={(e) => setForm((f) => ({ ...f, purchaseUsd: e.target.value }))}
                    placeholder="e.g. 1199"
                  />
                </div>

                <div className="pc-field">
                  <label>Shipping (USD)</label>
                  <input
                    className="pc-input"
                    value={form.shippingUsd}
                    inputMode="decimal"
                    onChange={(e) => setForm((f) => ({ ...f, shippingUsd: e.target.value }))}
                    placeholder="e.g. 30"
                  />
                </div>

                <div className="pc-field">
                  <label>Expected Selling Price (PKR)</label>
                  <input
                    className="pc-input"
                    value={form.expectedSalePkr}
                    inputMode="decimal"
                    onChange={(e) => setForm((f) => ({ ...f, expectedSalePkr: e.target.value }))}
                    placeholder="e.g. 525000"
                  />
                </div>

                <div className="pc-field">
                  <label>Profit / Loss (Best)</label>
                  <div className={`pc-pill ${liveBadge.type}`}>{liveBadge.label}</div>
                </div>
              </div>
            </div>

            {/* Devices */}
            <div className="pc-card pc-section" style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 26, fontWeight: 600 }}>Devices</div>
                <div style={{ color: "rgba(15,23,42,.55)", fontWeight: 400 }}>
                  {devices.length ? `${devices.length} device(s)` : "No devices added yet."}
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div className="pc-deviceGrid">
                {computedDevices.map(({ device: d, calc: c }) => {
                  const badgeCnic = profitBadge(c.profitCnic);
                  const badgePass = profitBadge(c.profitPassport);

                  return (
                    <div key={d.id} className="pc-deviceCard">
                      <div className="pc-deviceTop">
                        <div style={{ minWidth: 0 }}>
                          <div className="pc-kicker">{d.brand}</div>
                          <h3 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.model}</h3>
                          <div className="meta">
                            Slab: <strong>{c.slab.range}</strong> USD • GST: <strong>{Math.round(c.gstRate * 100)}%</strong>
                          </div>
                        </div>

                        <button className="pc-iconBtn" onClick={() => removeDevice(d.id)} title="Remove device">
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="pc-duo">
                        <div className="pc-miniCard">
                          <div className="pc-miniHead">
                            <span>CNIC</span>
                            <span className={`pc-pill ${badgeCnic.type}`} style={{ height: 34, padding: "0 12px" }}>
                              {badgeCnic.label}
                            </span>
                          </div>

                          <div className="pc-lines">
                            <div className="pc-line">
                              <span>Landed</span>
                              <strong>{money(c.landedCnic)}</strong>
                            </div>
                            <div className="pc-line">
                              <span>Margin</span>
                              <strong>{c.marginCnic.toFixed(1)}%</strong>
                            </div>
                          </div>
                        </div>

                        <div className="pc-miniCard">
                          <div className="pc-miniHead">
                            <span>Passport</span>
                            <span className={`pc-pill ${badgePass.type}`} style={{ height: 34, padding: "0 12px" }}>
                              {badgePass.label}
                            </span>
                          </div>

                          <div className="pc-lines">
                            <div className="pc-line">
                              <span>Landed</span>
                              <strong>{money(c.landedPassport)}</strong>
                            </div>
                            <div className="pc-line">
                              <span>Margin</span>
                              <strong>{c.marginPassport.toFixed(1)}%</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pc-bottomRow">
                        <div>
                          🧾 Sale: <strong>{money(d.expectedSalePkr)}</strong>
                        </div>
                        <div>
                          📦 Cost+Ship: <strong>{money(d.purchaseUsd, "USD")}</strong> + <strong>{money(d.shippingUsd, "USD")}</strong> • USD→PKR:{" "}
                          <strong>{settings.usdToPkr}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Export (global, not per-card) */}
              <div className="pc-exportBar">
                <div className="left">Export the full device list (CSV) or printable report (PDF).</div>
                <div className="pc-exportBtns">
                  <button className="pc-ghost" onClick={exportCSV}>
                    <Download size={18} /> CSV
                  </button>
                  <button className="pc-ghost" onClick={exportPDF}>
                    <Download size={18} /> PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

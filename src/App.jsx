import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";

/**
 * PhonesCanada PTA Dashboard — App.jsx (single-file)
 * Fixes included:
 * - Inventory form resets after Add
 * - Inventory “Profit/Loss (Best)” chip aligned + not overflowing
 * - Device cards: no overflow for Landed values, better layout + typography
 * - Removed “Best: …” strip inside device cards
 * - PTA slab table column widths fixed (Value Range not shrinking)
 * - Background blobs + prism/line shapes animate (and can be toggled)
 * - PDF export fixed: tries jsPDF, falls back to “Print to PDF”
 * - Logo support: uses BASE_URL + phonescanadalogo-web.png (put it in /public)
 */

/* ------------------------- helpers ------------------------- */
const DEFAULT_SETTINGS = {
  usdToPkr: 278,
  gstUnderThreshold: 0.18,
  gstAboveThreshold: 0.25,
  gstThresholdUsd: 500,
  showAnimation: true,
};

const DEFAULT_SLABS = [
  { id: 1, min: 0, max: 30, cnicFixed: 550, passportFixed: 430 },
  { id: 2, min: 31, max: 100, cnicFixed: 4323, passportFixed: 3200 },
  { id: 3, min: 101, max: 200, cnicFixed: 11561, passportFixed: 9580 },
  { id: 4, min: 201, max: 350, cnicFixed: 14661, passportFixed: 12200 },
  { id: 5, min: 351, max: 500, cnicFixed: 23420, passportFixed: 17800 },
  { id: 6, min: 501, max: 99999, cnicFixed: 37007, passportFixed: 36870 },
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
  "Nokia",
  "Sony",
  "LG",
  "Realme",
  "Tecno",
  "Infinix",
  "Other",
];

const n0 = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const formatPKR = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const v = Math.round(Number(n));
  return "Rs " + v.toLocaleString("en-PK");
};

const formatUSD = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "$" + Number(n).toFixed(0);
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const findSlab = (slabs, usdValue) => {
  const v = Number(usdValue);
  return slabs.find((s) => v >= s.min && v <= s.max) || slabs[slabs.length - 1];
};

const calcDevice = (device, settings, slabs) => {
  const purchase = n0(device.purchaseUsd);
  const ship = n0(device.shipUsd);
  const totalUsd = purchase + ship;
  const pkrValue = totalUsd * n0(settings.usdToPkr);

  const gstRate =
    totalUsd > settings.gstThresholdUsd
      ? n0(settings.gstAboveThreshold)
      : n0(settings.gstUnderThreshold);

  const slab = findSlab(slabs, totalUsd);
  const gstAmount = pkrValue * gstRate;

  const totalCnicTax = n0(slab.cnicFixed) + gstAmount;
  const totalPassportTax = n0(slab.passportFixed) + gstAmount;

  const landedCnic = pkrValue + totalCnicTax;
  const landedPassport = pkrValue + totalPassportTax;

  const sell = device.expectedSellPkr ? Number(device.expectedSellPkr) : null;
  const profitCnic = sell !== null ? sell - landedCnic : null;
  const profitPassport = sell !== null ? sell - landedPassport : null;

  const marginCnic = sell ? profitCnic / sell : null;
  const marginPassport = sell ? profitPassport / sell : null;

  return {
    totalUsd,
    pkrValue,
    gstRate,
    gstAmount,
    slab,
    landedCnic,
    landedPassport,
    profitCnic,
    profitPassport,
    marginCnic,
    marginPassport,
  };
};

const bestProfit = (calc) => {
  const c = calc?.profitCnic;
  const p = calc?.profitPassport;
  if (c === null && p === null) return { label: "—", value: null, mode: "na" };
  // “Best” = higher profit (could still be negative)
  const bestIsPassport = (p ?? -Infinity) >= (c ?? -Infinity);
  const value = bestIsPassport ? p : c;
  const mode = value >= 0 ? "profit" : "loss";
  const label = value === null ? "—" : `${mode === "profit" ? "Profit" : "Loss"} · ${formatPKR(Math.abs(value))}`;
  return { label, value, mode, bestIsPassport };
};

/* -------------------- background (animated) -------------------- */
const AnimatedBackground = ({ active }) => {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!active || prefersReducedMotion) return null;

  return (
    <div className="bgfx" aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />

      {/* prism-ish soft shapes */}
      <svg className="prisms" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,80,80,0.35)" />
            <stop offset="0.5" stopColor="rgba(120,180,255,0.25)" />
            <stop offset="1" stopColor="rgba(190,120,255,0.28)" />
          </linearGradient>
          <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(80,200,255,0.25)" />
            <stop offset="1" stopColor="rgba(255,140,200,0.22)" />
          </linearGradient>
          <filter id="blur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* moving lines */}
        <path className="line l1" d="M-50 120 C 240 40, 420 210, 720 120 S 1150 220, 1280 130" />
        <path className="line l2" d="M-80 520 C 200 420, 520 650, 760 520 S 1060 420, 1320 600" />
        <path className="line l3" d="M-60 340 C 220 240, 420 410, 720 340 S 1040 520, 1300 360" />

        {/* soft prisms */}
        <polygon className="prism p1" points="180,90 380,40 470,190 260,240" fill="url(#g1)" filter="url(#blur)" />
        <polygon className="prism p2" points="760,120 980,80 1040,260 820,300" fill="url(#g2)" filter="url(#blur)" />
        <polygon className="prism p3" points="520,520 720,470 800,640 580,690" fill="url(#g1)" filter="url(#blur)" />
      </svg>
    </div>
  );
};

/* ------------------------- PDF export ------------------------- */
async function exportPdf(devices, settings, slabs) {
  const rows = devices.map((d, idx) => {
    const c = calcDevice(d, settings, slabs);
    return { idx: idx + 1, d, c };
  });

  // Try jsPDF if installed
  try {
    const mod = await import("jspdf");
    const jsPDF = mod.jsPDF || mod.default;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = 54;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PhonesCanada PTA Dashboard — Report", margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`USD→PKR Rate: ${settings.usdToPkr} · GST: ${Math.round(settings.gstUnderThreshold * 100)}% / ${Math.round(settings.gstAboveThreshold * 100)}% (threshold $${settings.gstThresholdUsd})`, margin, y);
    y += 18;

    const card = (title, lines) => {
      const boxH = 18 + lines.length * 14 + 18;
      if (y + boxH > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = 54;
      }
      doc.setDrawColor(230);
      doc.setFillColor(248, 248, 252);
      doc.roundedRect(margin, y, pageW - margin * 2, boxH, 10, 10, "FD");

      let yy = y + 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, margin + 14, yy);
      yy += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      lines.forEach((ln) => {
        doc.text(ln.left, margin + 14, yy);
        doc.text(ln.right, pageW - margin - 14 - doc.getTextWidth(ln.right), yy);
        yy += 14;
      });

      y += boxH + 14;
    };

    rows.forEach(({ idx, d, c }) => {
      const title = `${idx}. ${d.brand || "—"} ${d.model || ""}`.trim();
      const slabTxt =
        c.slab.max >= 99999 ? `${c.slab.min}+ USD` : `${c.slab.min}–${c.slab.max} USD`;
      card(title, [
        { left: `Slab: ${slabTxt} · GST: ${Math.round(c.gstRate * 100)}%`, right: "" },
        { left: "Expected Sale", right: d.expectedSellPkr ? formatPKR(d.expectedSellPkr) : "—" },
        { left: "Base (Cost + Ship)", right: `${formatUSD(d.purchaseUsd)} + ${formatUSD(d.shipUsd)}  (USD→PKR ${settings.usdToPkr})` },
        { left: "Landed (CNIC)", right: formatPKR(c.landedCnic) },
        { left: "Profit (CNIC)", right: c.profitCnic === null ? "—" : (c.profitCnic >= 0 ? formatPKR(c.profitCnic) : `- ${formatPKR(Math.abs(c.profitCnic))}`) },
        { left: "Landed (Passport)", right: formatPKR(c.landedPassport) },
        { left: "Profit (Passport)", right: c.profitPassport === null ? "—" : (c.profitPassport >= 0 ? formatPKR(c.profitPassport) : `- ${formatPKR(Math.abs(c.profitPassport))}`) },
      ]);
    });

    doc.save("phonescanada-pta-report.pdf");
    return;
  } catch (e) {
    // fallback
  }

  // Fallback: print-to-PDF (always works, user saves as PDF)
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;

  const css = `
    body{font-family:Arial,Helvetica,sans-serif;margin:28px;background:#fff;color:#111}
    h1{font-size:18px;margin:0 0 6px}
    .meta{font-size:12px;color:#444;margin-bottom:16px}
    .card{border:1px solid #e6e6ef;background:#f8f8fc;border-radius:12px;padding:14px 14px;margin:0 0 12px}
    .title{font-weight:700;margin-bottom:6px}
    .grid{display:grid;grid-template-columns:1fr auto;gap:8px 12px;font-size:12px}
    .r{font-weight:700}
    .muted{color:#666}
    @media print { .noprint{display:none} }
  `;

  const html = `
    <html>
      <head><title>PhonesCanada PTA Report</title><style>${css}</style></head>
      <body>
        <h1>PhonesCanada PTA Dashboard — Report</h1>
        <div class="meta">USD→PKR Rate: ${settings.usdToPkr} · GST: ${Math.round(settings.gstUnderThreshold * 100)}% / ${Math.round(settings.gstAboveThreshold * 100)}% (threshold $${settings.gstThresholdUsd})</div>
        <div class="noprint muted">Tip: press Ctrl+P / Cmd+P → “Save as PDF”.</div>
        ${rows
          .map(({ idx, d, c }) => {
            const slabTxt = c.slab.max >= 99999 ? `${c.slab.min}+ USD` : `${c.slab.min}–${c.slab.max} USD`;
            const profitFmt = (p) =>
              p === null ? "—" : p >= 0 ? formatPKR(p) : `- ${formatPKR(Math.abs(p))}`;
            return `
              <div class="card">
                <div class="title">${idx}. ${(d.brand || "—")} ${(d.model || "")}</div>
                <div class="muted" style="font-size:12px;margin-bottom:10px;">Slab: ${slabTxt} · GST: ${Math.round(c.gstRate * 100)}%</div>
                <div class="grid">
                  <div>Expected Sale</div><div class="r">${d.expectedSellPkr ? formatPKR(d.expectedSellPkr) : "—"}</div>
                  <div>Base (Cost + Ship)</div><div class="r">${formatUSD(d.purchaseUsd)} + ${formatUSD(d.shipUsd)} <span class="muted">(USD→PKR ${settings.usdToPkr})</span></div>
                  <div>Landed (CNIC)</div><div class="r">${formatPKR(c.landedCnic)}</div>
                  <div>Profit (CNIC)</div><div class="r">${profitFmt(c.profitCnic)}</div>
                  <div>Landed (Passport)</div><div class="r">${formatPKR(c.landedPassport)}</div>
                  <div>Profit (Passport)</div><div class="r">${profitFmt(c.profitPassport)}</div>
                </div>
              </div>
            `;
          })
          .join("")}
        <script>window.focus(); setTimeout(()=>window.print(), 250);</script>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ------------------------- main app ------------------------- */
export default function App() {
  // settings
  const [settings, setSettings] = useState(() => {
    const raw = localStorage.getItem("pc_pta_settings_v1");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  });

  // editable slabs
  const [slabs, setSlabs] = useState(() => {
    const raw = localStorage.getItem("pc_pta_slabs_v1");
    return raw ? JSON.parse(raw) : DEFAULT_SLABS;
  });

  // devices list
  const [devices, setDevices] = useState(() => {
    const raw = localStorage.getItem("pc_pta_devices_v1");
    return raw ? JSON.parse(raw) : [];
  });

  // inventory form (resets after add)
  const EMPTY_FORM = useMemo(
    () => ({
      brand: "",
      model: "",
      purchaseUsd: "",
      shipUsd: "",
      expectedSellPkr: "",
    }),
    []
  );

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    localStorage.setItem("pc_pta_settings_v1", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("pc_pta_slabs_v1", JSON.stringify(slabs));
  }, [slabs]);

  useEffect(() => {
    localStorage.setItem("pc_pta_devices_v1", JSON.stringify(devices));
  }, [devices]);

  const logoUrl = `${import.meta.env.BASE_URL}phonescanadalogo-web.png`;

  // live preview calc for form profit/loss (best)
  const formPreviewCalc = useMemo(() => {
    const hasAny =
      form.brand ||
      form.model ||
      String(form.purchaseUsd || "").length ||
      String(form.shipUsd || "").length ||
      String(form.expectedSellPkr || "").length;

    if (!hasAny) return null;

    const tmp = {
      brand: form.brand || "",
      model: form.model || "",
      purchaseUsd: form.purchaseUsd || 0,
      shipUsd: form.shipUsd || 0,
      expectedSellPkr: form.expectedSellPkr || null,
    };
    return calcDevice(tmp, settings, slabs);
  }, [form, settings, slabs]);

  const formBest = useMemo(() => {
    if (!formPreviewCalc || !form.expectedSellPkr) return { label: "—", mode: "na", value: null };
    return bestProfit(formPreviewCalc);
  }, [formPreviewCalc, form.expectedSellPkr]);

  const addDevice = () => {
    // minimal validation (must have purchase+ship and expected sale to be useful)
    const next = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      brand: (form.brand || "").trim(),
      model: (form.model || "").trim(),
      purchaseUsd: form.purchaseUsd === "" ? "" : Number(form.purchaseUsd),
      shipUsd: form.shipUsd === "" ? "" : Number(form.shipUsd),
      expectedSellPkr: form.expectedSellPkr === "" ? "" : Number(form.expectedSellPkr),
    };

    setDevices((prev) => [next, ...prev]);

    // IMPORTANT: reset form after add (your #1 request)
    setForm(EMPTY_FORM);
  };

  const removeDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id));

  const exportCsv = () => {
    const header = [
      "Brand",
      "Model",
      "PurchaseUSD",
      "ShipUSD",
      "TotalUSD",
      "USD_to_PKR",
      "ExpectedSalePKR",
      "GST_Rate",
      "Slab",
      "Landed_CNIC",
      "Profit_CNIC",
      "Margin_CNIC",
      "Landed_Passport",
      "Profit_Passport",
      "Margin_Passport",
    ];

    const lines = [header.join(",")];

    devices.forEach((d) => {
      const c = calcDevice(d, settings, slabs);
      const slabTxt = c.slab.max >= 99999 ? `${c.slab.min}+` : `${c.slab.min}-${c.slab.max}`;
      const row = [
        d.brand || "",
        (d.model || "").replaceAll(",", " "),
        n0(d.purchaseUsd),
        n0(d.shipUsd),
        c.totalUsd.toFixed(2),
        settings.usdToPkr,
        d.expectedSellPkr ?? "",
        (c.gstRate * 100).toFixed(0) + "%",
        slabTxt,
        Math.round(c.landedCnic),
        c.profitCnic === null ? "" : Math.round(c.profitCnic),
        c.marginCnic === null ? "" : (c.marginCnic * 100).toFixed(2) + "%",
        Math.round(c.landedPassport),
        c.profitPassport === null ? "" : Math.round(c.profitPassport),
        c.marginPassport === null ? "" : (c.marginPassport * 100).toFixed(2) + "%",
      ];
      lines.push(row.map((x) => `"${String(x).replaceAll(`"`, `""`)}"`).join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "phonescanada-pta-devices.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const onSlabChange = (id, key, value) => {
    setSlabs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: Number(value) } : s))
    );
  };

  /* ------------------------- UI ------------------------- */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600&display=swap');

        :root{
          --card: rgba(255,255,255,0.72);
          --card2: rgba(255,255,255,0.82);
          --stroke: rgba(15, 23, 42, 0.10);
          --shadow: 0 18px 55px rgba(2, 8, 23, 0.10);
          --shadow2: 0 10px 30px rgba(2, 8, 23, 0.08);
          --txt: #0f172a;
          --muted: rgba(15, 23, 42, 0.62);
          --goodBg: rgba(16,185,129,0.14);
          --goodBd: rgba(16,185,129,0.35);
          --badBg: rgba(239,68,68,0.14);
          --badBd: rgba(239,68,68,0.35);
        }

        *{ box-sizing:border-box; }
        html,body{ height:100%; }
        body{
          margin:0;
          font-family: "Saira", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          color: var(--txt);
          background: radial-gradient(1200px 700px at 15% 15%, rgba(255,130,130,0.28), transparent 60%),
                      radial-gradient(1200px 700px at 80% 35%, rgba(130,170,255,0.24), transparent 62%),
                      radial-gradient(1200px 700px at 40% 85%, rgba(190,130,255,0.20), transparent 60%),
                      #f6f7fb;
          overflow-x:hidden;
        }

        /* animated background */
        .bgfx{
          position:fixed; inset:0;
          z-index:0;
          pointer-events:none;
          overflow:hidden;
        }
        .blob{
          position:absolute;
          width:520px; height:520px;
          border-radius:999px;
          filter: blur(70px);
          opacity:0.35;
          mix-blend-mode: multiply;
          animation: floaty 6.2s ease-in-out infinite;
        }
        .b1{ left:-120px; top:-120px; background: rgba(255,90,90,0.55); animation-duration: 5.2s; }
        .b2{ right:-160px; top:120px; background: rgba(120,170,255,0.55); animation-duration: 6.1s; animation-delay: .2s;}
        .b3{ left:240px; bottom:-220px; background: rgba(190,120,255,0.50); animation-duration: 6.8s; animation-delay: .35s;}

        .prisms{
          position:absolute; inset:0;
          width:100%; height:100%;
          opacity:0.55;
          animation: drift 3.8s linear infinite;
        }
        .line{
          fill:none;
          stroke: rgba(255,255,255,0.55);
          stroke-width: 2.2;
          stroke-linecap: round;
          filter: drop-shadow(0 8px 18px rgba(2,8,23,0.12));
        }
        .l1{ stroke: rgba(255,110,110,0.55); animation: dash 1.5s linear infinite; stroke-dasharray: 14 12; }
        .l2{ stroke: rgba(120,180,255,0.55); animation: dash 1.25s linear infinite; stroke-dasharray: 12 10; }
        .l3{ stroke: rgba(190,130,255,0.50); animation: dash 1.7s linear infinite; stroke-dasharray: 16 12; }
        .prism{ opacity:0.55; animation: prism 3.2s ease-in-out infinite; }
        .p1{ animation-delay:.0s; }
        .p2{ animation-delay:.18s; }
        .p3{ animation-delay:.34s; }

        @keyframes floaty{
          0%{ transform: translate(0,0) scale(1); }
          50%{ transform: translate(18px,-14px) scale(1.04); }
          100%{ transform: translate(0,0) scale(1); }
        }
        @keyframes drift{
          0%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(-8px,6px,0); }
          100%{ transform: translate3d(0,0,0); }
        }
        @keyframes dash{
          to{ stroke-dashoffset: -140; }
        }
        @keyframes prism{
          0%{ transform: translate(0,0); opacity:.45; }
          50%{ transform: translate(10px,-8px); opacity:.62; }
          100%{ transform: translate(0,0); opacity:.45; }
        }

        /* layout */
        .wrap{
          position:relative;
          z-index:1;
          max-width: 1200px;
          margin: 22px auto 40px;
          padding: 0 18px;
        }

        .card{
          background: var(--card);
          border: 1px solid var(--stroke);
          box-shadow: var(--shadow);
          border-radius: 26px;
          backdrop-filter: blur(16px);
        }
        .card2{
          background: var(--card2);
          border: 1px solid var(--stroke);
          box-shadow: var(--shadow2);
          border-radius: 22px;
          backdrop-filter: blur(14px);
        }

        .header{
          display:flex; gap:14px; align-items:center;
          padding: 18px 18px;
        }
        .logoBox{
          width:54px; height:54px;
          border-radius: 18px;
          background: radial-gradient(circle at 30% 30%, rgba(255,110,110,.95), rgba(255,110,110,.45));
          display:flex; align-items:center; justify-content:center;
          box-shadow: 0 18px 40px rgba(255,110,110,0.20);
          overflow:hidden;
          flex: 0 0 auto;
        }
        .logoBox img{
          width:100%; height:100%;
          object-fit: cover;
        }
        .hTitle{
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.2px;
          margin:0;
          line-height: 1.2;
        }
        .hSub{
          margin:4px 0 0;
          font-size: 13px;
          color: var(--muted);
          font-weight: 400;
        }

        .grid{
          display:grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
          margin-top: 16px;
          align-items:start;
        }

        @media (max-width: 980px){
          .grid{ grid-template-columns: 1fr; }
        }

        .sectionTitle{
          font-size: 13px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(15,23,42,0.62);
          font-weight: 600;
          margin: 0 0 12px;
        }

        .pad{ padding: 16px; }
        .row{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .muted{ color: var(--muted); font-size: 13px; }

        .input, select{
          width:100%;
          height: 44px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.78);
          outline:none;
          font-family: inherit;
          font-size: 15px;
          font-weight: 400;
        }
        .input:focus, select:focus{
          border-color: rgba(255,110,110,0.45);
          box-shadow: 0 0 0 4px rgba(255,110,110,0.12);
        }
        label{
          display:block;
          font-size: 13px;
          color: rgba(15,23,42,0.70);
          margin-bottom: 8px;
          font-weight: 500;
        }

        .toggle{
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding: 10px 0 0;
        }
        .switch{
          position:relative; width: 52px; height: 30px;
          background: rgba(15,23,42,0.12);
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          cursor:pointer;
          flex:0 0 auto;
        }
        .switch.on{ background: rgba(255,110,110,0.35); border-color: rgba(255,110,110,0.35); }
        .knob{
          position:absolute; top: 3px; left: 3px;
          width: 24px; height: 24px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 6px 16px rgba(2,8,23,0.18);
          transition: transform .18s ease;
        }
        .switch.on .knob{ transform: translateX(22px); }

        .btn{
          height: 44px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.75);
          cursor:pointer;
          font-family: inherit;
          font-weight: 600;
          display:inline-flex;
          align-items:center;
          gap:8px;
          box-shadow: 0 10px 26px rgba(2,8,23,0.06);
        }
        .btnPrimary{
          border: none;
          background: linear-gradient(135deg, rgba(255,110,110,0.98), rgba(255,110,110,0.68));
          color: white;
          box-shadow: 0 20px 40px rgba(255,110,110,0.22);
        }
        .btnSmall{
          height: 38px;
          padding: 0 12px;
          font-size: 13px;
        }

        /* inventory planning form layout */
        .planGrid{
          display:grid;
          grid-template-columns: 160px 1.3fr 1fr 1fr 1.2fr 190px;
          gap: 12px;
          align-items:end;
        }
        @media (max-width: 1120px){
          .planGrid{ grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px){
          .planGrid{ grid-template-columns: 1fr; }
        }

        .chip{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding: 8px 12px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 13px;
          border: 1px solid rgba(15,23,42,0.10);
          white-space: nowrap;
          min-width: 0;
          width: 100%;
          height: 44px;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .chip.profit{ background: var(--goodBg); border-color: var(--goodBd); color: rgba(6,95,70,1); }
        .chip.loss{ background: var(--badBg); border-color: var(--badBd); color: rgba(153,27,27,1); }
        .chip.na{ background: rgba(15,23,42,0.06); border-color: rgba(15,23,42,0.10); color: rgba(15,23,42,0.55); }

        /* Devices grid */
        .devicesWrap{ padding: 16px; }
        .devicesHeader{
          display:flex; align-items:baseline; justify-content:space-between; gap:10px;
          margin-bottom: 12px;
        }
        .devicesHeader h2{
          margin:0;
          font-size: 26px;
          font-weight: 600;
          letter-spacing: .2px;
        }
        .count{ color: var(--muted); font-size: 14px; }

        .cards{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 860px){
          .cards{ grid-template-columns: 1fr; }
        }

        .deviceCard{ padding: 14px; position:relative; overflow:hidden; }
        .deviceTop{
          display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
          margin-bottom: 10px;
        }
        .brand{
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(15,23,42,0.52);
          font-weight: 600;
          margin-bottom: 2px;
        }
        .model{
          font-size: 20px;
          font-weight: 600;
          margin:0;
          line-height: 1.15;
          word-break: break-word;
        }
        .pillRow{
          display:flex; gap:8px; flex-wrap:wrap;
          margin-top: 10px;
        }
        .pill{
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(15,23,42,0.70);
          background: rgba(15,23,42,0.06);
          border: 1px solid rgba(15,23,42,0.10);
          white-space: nowrap;
        }

        .trash{
          width: 40px; height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.75);
          cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          box-shadow: 0 10px 22px rgba(2,8,23,0.06);
          flex: 0 0 auto;
        }

        .split{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(15,23,42,0.08);
        }
        @media (max-width: 520px){
          .split{ grid-template-columns: 1fr; }
        }

        .mini{
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.68);
          padding: 12px;
          overflow:hidden;
        }
        .miniHead{
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          margin-bottom: 10px;
        }
        .miniTitle{
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(15,23,42,0.55);
          font-weight: 600;
        }

        .miniChip{
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 12px;
          border: 1px solid rgba(15,23,42,0.10);
          white-space: nowrap;
          max-width: 165px;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .miniChip.profit{ background: var(--goodBg); border-color: var(--goodBd); color: rgba(6,95,70,1); }
        .miniChip.loss{ background: var(--badBg); border-color: var(--badBd); color: rgba(153,27,27,1); }
        .miniChip.na{ background: rgba(15,23,42,0.06); border-color: rgba(15,23,42,0.10); color: rgba(15,23,42,0.55); }

        .kv{
          display:grid;
          grid-template-columns: 1fr auto;
          gap: 8px 12px;
          align-items:center;
        }
        .k{ color: rgba(15,23,42,0.62); font-weight: 500; }
        .v{
          font-weight: 700;
          font-size: 18px;
          max-width: 100%;
          overflow:hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vSmall{ font-size: 16px; }
        .footerMeta{
          margin-top: 12px;
          display:grid;
          grid-template-columns: 1fr;
          gap: 8px;
          color: rgba(15,23,42,0.62);
          font-size: 13px;
        }
        .metaRow{
          display:flex; justify-content:space-between; gap:12px;
          align-items:center;
          flex-wrap: wrap;
        }
        .metaRow span{ white-space: nowrap; }

        /* Export bar */
        .exportBar{
          margin-top: 14px;
          padding: 14px;
          display:flex; align-items:center; justify-content:space-between; gap:12px;
        }
        @media (max-width: 620px){
          .exportBar{ flex-direction:column; align-items:stretch; }
          .exportBtns{ justify-content:stretch; }
        }
        .exportBtns{ display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; }
        .exportHint{ font-size: 14px; color: rgba(15,23,42,0.62); }

        /* Slabs table */
        .table{
          width:100%;
          border-collapse: separate;
          border-spacing: 0;
          overflow:hidden;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.55);
        }
        .th{
          text-align:left;
          font-size: 12px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(15,23,42,0.60);
          padding: 12px 12px;
          background: rgba(15,23,42,0.04);
          border-bottom: 1px solid rgba(15,23,42,0.08);
          font-weight: 700;
        }
        .td{
          padding: 10px 12px;
          border-bottom: 1px solid rgba(15,23,42,0.06);
          vertical-align: middle;
        }
        .tdRange{
          width: 140px;
          min-width: 140px;
          font-weight: 700;
          color: rgba(15,23,42,0.80);
        }
        .tdIn{
          width: 130px;
        }
        .numIn{
          height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.72);
          padding: 8px 10px;
          width: 100%;
          font-family: inherit;
          font-size: 14px;
        }
        .numIn:focus{
          border-color: rgba(120,180,255,0.50);
          box-shadow: 0 0 0 4px rgba(120,180,255,0.14);
          outline:none;
        }
      `}</style>

      <AnimatedBackground active={settings.showAnimation} />

      <div className="wrap">
        {/* Header */}
        <div className="card header">
          <div className="logoBox" title="PhonesCanada logo">
            {/* If you put phonescanadalogo-web.png inside /public, this will work */}
            <img
              src={logoUrl}
              alt="PhonesCanada"
              onError={(e) => {
                // fallback to “P” if logo path is wrong
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement.textContent = "P";
                e.currentTarget.parentElement.style.color = "white";
                e.currentTarget.parentElement.style.fontWeight = "800";
                e.currentTarget.parentElement.style.fontSize = "20px";
              }}
            />
          </div>
          <div>
            <h1 className="hTitle">PhonesCanada PTA Dashboard</h1>
            <p className="hSub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
          </div>
        </div>

        <div className="grid">
          {/* Left column */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* Preferences */}
            <div className="card2 pad">
              <div className="sectionTitle">System Preferences</div>

              <label>USD Rate (PKR)</label>
              <input
                className="input"
                value={settings.usdToPkr}
                onChange={(e) => setSettings((s) => ({ ...s, usdToPkr: Number(e.target.value) }))}
                inputMode="numeric"
              />

              <div className="toggle">
                <div>
                  <div style={{ fontWeight: 600 }}>Animations</div>
                  <div className="muted">Background blobs + prisms</div>
                </div>
                <div
                  className={`switch ${settings.showAnimation ? "on" : ""}`}
                  onClick={() => setSettings((s) => ({ ...s, showAnimation: !s.showAnimation }))}
                  role="switch"
                  aria-checked={settings.showAnimation}
                >
                  <div className="knob" />
                </div>
              </div>

              <div style={{ marginTop: 10 }} className="muted">
                💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.
              </div>
            </div>

            {/* Slabs */}
            <div className="card2 pad">
              <div className="sectionTitle">PTA Tax Slabs (Editable)</div>
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Value Range (USD)</th>
                    <th className="th">CNIC</th>
                    <th className="th">Passport</th>
                  </tr>
                </thead>
                <tbody>
                  {slabs.map((s, i) => {
                    const isLast = i === slabs.length - 1;
                    const rangeTxt = isLast ? `${s.min}+` : `${s.min}–${s.max}`;
                    return (
                      <tr key={s.id}>
                        <td className="td tdRange">{rangeTxt}</td>
                        <td className="td tdIn">
                          <input
                            className="numIn"
                            value={s.cnicFixed}
                            onChange={(e) => onSlabChange(s.id, "cnicFixed", e.target.value)}
                            inputMode="numeric"
                          />
                        </td>
                        <td className="td tdIn">
                          <input
                            className="numIn"
                            value={s.passportFixed}
                            onChange={(e) => onSlabChange(s.id, "passportFixed", e.target.value)}
                            inputMode="numeric"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="muted" style={{ marginTop: 10 }}>
                Saved automatically on this device (localStorage).
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* Inventory Planning */}
            <div className="card2 pad">
              <div className="row" style={{ marginBottom: 12 }}>
                <div>
                  <div className="sectionTitle" style={{ marginBottom: 6 }}>
                    Inventory Planning
                  </div>
                  <div className="muted">Add a device and compare CNIC vs Passport.</div>
                </div>
                <button className="btn btnPrimary" onClick={addDevice}>
                  <Plus size={18} /> Add Device
                </button>
              </div>

              <div className="planGrid">
                <div>
                  <label>Brand</label>
                  <select
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

                <div>
                  <label>Device / Model Name</label>
                  <input
                    className="input"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro Max"
                  />
                </div>

                <div>
                  <label>Purchase Cost (USD)</label>
                  <input
                    className="input"
                    value={form.purchaseUsd}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseUsd: e.target.value }))}
                    placeholder="e.g. 1199"
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label>Shipping (USD)</label>
                  <input
                    className="input"
                    value={form.shipUsd}
                    onChange={(e) => setForm((f) => ({ ...f, shipUsd: e.target.value }))}
                    placeholder="e.g. 30"
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label>Expected Selling Price (PKR)</label>
                  <input
                    className="input"
                    value={form.expectedSellPkr}
                    onChange={(e) => setForm((f) => ({ ...f, expectedSellPkr: e.target.value }))}
                    placeholder="e.g. 525000"
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label>Profit / Loss (Best)</label>
                  <div className={`chip ${formBest.mode}`}>
                    {formBest.label}
                  </div>
                </div>
              </div>
            </div>

            {/* Devices */}
            <div className="card2 devicesWrap">
              <div className="devicesHeader">
                <h2>Devices</h2>
                <div className="count">{devices.length} device(s)</div>
              </div>

              <div className="cards">
                {devices.map((d) => {
                  const c = calcDevice(d, settings, slabs);
                  const slabTxt =
                    c.slab.max >= 99999 ? `${c.slab.min}+ USD` : `${c.slab.min}–${c.slab.max} USD`;
                  const gstTxt = `${Math.round(c.gstRate * 100)}%`;

                  const cnicMode =
                    d.expectedSellPkr === "" || d.expectedSellPkr == null
                      ? "na"
                      : c.profitCnic >= 0
                      ? "profit"
                      : "loss";
                  const passMode =
                    d.expectedSellPkr === "" || d.expectedSellPkr == null
                      ? "na"
                      : c.profitPassport >= 0
                      ? "profit"
                      : "loss";

                  const profitLabel = (p) =>
                    p == null
                      ? "—"
                      : p >= 0
                      ? `PROFIT · ${formatPKR(p)}`
                      : `LOSS · ${formatPKR(Math.abs(p))}`;

                  const marginLabel = (m) =>
                    m == null ? "—" : `${(m * 100).toFixed(1)}%`;

                  return (
                    <div className="card2 deviceCard" key={d.id}>
                      <div className="deviceTop">
                        <div>
                          <div className="brand">{d.brand || "—"}</div>
                          <p className="model">{d.model || "—"}</p>
                          <div className="pillRow">
                            <span className="pill">Slab: {slabTxt}</span>
                            <span className="pill">GST: {gstTxt}</span>
                          </div>
                        </div>

                        <button className="trash" onClick={() => removeDevice(d.id)} title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="split">
                        <div className="mini">
                          <div className="miniHead">
                            <div className="miniTitle">CNIC</div>
                            <div className={`miniChip ${cnicMode}`}>
                              {profitLabel(c.profitCnic)}
                            </div>
                          </div>

                          <div className="kv">
                            <div className="k">Landed</div>
                            <div className="v">{formatPKR(c.landedCnic)}</div>

                            <div className="k">Margin</div>
                            <div className="v vSmall">{marginLabel(c.marginCnic)}</div>
                          </div>
                        </div>

                        <div className="mini">
                          <div className="miniHead">
                            <div className="miniTitle">Passport</div>
                            <div className={`miniChip ${passMode}`}>
                              {profitLabel(c.profitPassport)}
                            </div>
                          </div>

                          <div className="kv">
                            <div className="k">Landed</div>
                            <div className="v">{formatPKR(c.landedPassport)}</div>

                            <div className="k">Margin</div>
                            <div className="v vSmall">{marginLabel(c.marginPassport)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="footerMeta">
                        <div className="metaRow">
                          <span>🧾 Sale: <b>{d.expectedSellPkr ? formatPKR(d.expectedSellPkr) : "—"}</b></span>
                        </div>
                        <div className="metaRow">
                          <span>📦 Cost+Ship: <b>{formatUSD(d.purchaseUsd)}</b> + <b>{formatUSD(d.shipUsd)}</b></span>
                          <span>💱 USD→PKR: <b>{settings.usdToPkr}</b></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Export */}
              <div className="card2 exportBar">
                <div className="exportHint">
                  Export the full device list (CSV) or printable report (PDF).
                </div>
                <div className="exportBtns">
                  <button className="btn btnSmall" onClick={exportCsv}>
                    <Download size={16} /> CSV
                  </button>
                  <button
                    className="btn btnSmall"
                    onClick={() => exportPdf(devices, settings, slabs)}
                  >
                    <Download size={16} /> PDF
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

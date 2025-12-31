import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Plus, Trash2, Download } from "lucide-react";

/**
 * PhonesCanada PTA Dashboard (single-file App.jsx)
 * - Uses logo from /public/phonescanadalogo-web.png (no upload)
 * - Fixes wrapping/overflow in Inventory Planning + Device cards
 * - Better toggle UX
 * - PDF export (styled) + CSV export
 * - Background animation (blobs + prism outlines + subtle moving shapes)
 */

const BRANDS = ["Apple", "Samsung", "Google", "OnePlus", "Xiaomi", "Vivo", "Oppo", "Huawei", "Other"];

const DEFAULT_SETTINGS = {
  usdToPkr: 278,
  gstUnderThreshold: 0.18,
  gstAboveThreshold: 0.25,
  gstThresholdUsd: 500,
  animationEnabled: true,
};

const DEFAULT_SLABS = [
  { range: "0–30", cnic: 550, passport: 430 },
  { range: "31–100", cnic: 4323, passport: 3200 },
  { range: "101–200", cnic: 11561, passport: 9580 },
  { range: "201–350", cnic: 14661, passport: 12200 },
  { range: "351–500", cnic: 23420, passport: 17800 },
  { range: "501+", cnic: 37007, passport: 36870 },
];

const LS_SETTINGS = "pc_pta_settings_v3";
const LS_SLABS = "pc_pta_slabs_v3";
const LS_DEVICES = "pc_pta_devices_v3";

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const fmtInt = (v) => Math.round(n(v)).toLocaleString();
const fmtPKR = (v) => `Rs ${fmtInt(v)}`;
const fmtUSD = (v) => `$${Math.round(n(v)).toLocaleString()}`;

function getSlab(costUsd, slabs) {
  const c = n(costUsd);
  if (c <= 30) return slabs[0];
  if (c <= 100) return slabs[1];
  if (c <= 200) return slabs[2];
  if (c <= 350) return slabs[3];
  if (c <= 500) return slabs[4];
  return slabs[5];
}

function calc({ costUsd, shippingUsd, expectedSalePkr, settings, slabs }) {
  const usdToPkr = n(settings.usdToPkr);
  const cost = n(costUsd);
  const ship = n(shippingUsd);
  const sale = n(expectedSalePkr);

  const basePkr = (cost + ship) * usdToPkr;
  const gstRate = cost >= n(settings.gstThresholdUsd) ? n(settings.gstAboveThreshold) : n(settings.gstUnderThreshold);
  const gstPkr = basePkr * gstRate;

  const slab = getSlab(cost, slabs);
  const ptaCnic = n(slab.cnic);
  const ptaPassport = n(slab.passport);

  const landedCnic = basePkr + gstPkr + ptaCnic;
  const landedPassport = basePkr + gstPkr + ptaPassport;

  const profitCnic = sale - landedCnic;
  const profitPassport = sale - landedPassport;

  const marginCnic = sale > 0 ? (profitCnic / sale) * 100 : 0;
  const marginPassport = sale > 0 ? (profitPassport / sale) * 100 : 0;

  const best = profitPassport >= profitCnic ? "Passport" : "CNIC";
  const bestProfit = best === "Passport" ? profitPassport : profitCnic;

  return {
    basePkr,
    gstRate,
    gstPkr,
    slab,
    ptaCnic,
    ptaPassport,
    landedCnic,
    landedPassport,
    profitCnic,
    profitPassport,
    marginCnic,
    marginPassport,
    best,
    bestProfit,
  };
}

function Pill({ tone = "neutral", children }) {
  return <span className={`pc-pill pc-pill--${tone}`}>{children}</span>;
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`pc-switch ${checked ? "is-on" : "is-off"}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={label}
    >
      <span className="pc-switch__track" />
      <span className="pc-switch__thumb" />
    </button>
  );
}

function Background({ enabled }) {
  if (!enabled) return null;
  return (
    <div className="pc-bg" aria-hidden="true">
      <div className="pc-blob b1" />
      <div className="pc-blob b2" />
      <div className="pc-blob b3" />

      {/* Prism outline mesh */}
      <svg className="pc-prisms" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pcLine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255, 107, 107, 0.30)" />
            <stop offset="1" stopColor="rgba(97, 234, 255, 0.26)" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#pcLine)" strokeWidth="1.2" opacity="0.9">
          {Array.from({ length: 18 }).map((_, i) => {
            const x = (i * 73) % 1200;
            const y = ((i * 49) % 800);
            const w = 180 + (i % 5) * 26;
            const h = 120 + (i % 4) * 22;
            const p = `${x},${y} ${x + w},${y + 20} ${x + w - 40},${y + h} ${x + 20},${y + h - 18}`;
            return <polygon key={i} points={p} className={`pc-prism p${i % 6}`} />;
          })}
        </g>
      </svg>

      {/* A few subtle moving dots */}
      <div className="pc-dots">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={`pc-dot d${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const baseUrl = (import.meta && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
  const logoSrc = `${baseUrl}phonescanadalogo-web.png`;

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [slabs, setSlabs] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_SLABS);
      if (!raw) return DEFAULT_SLABS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== DEFAULT_SLABS.length) return DEFAULT_SLABS;
      return parsed.map((s, i) => ({ ...DEFAULT_SLABS[i], ...s }));
    } catch {
      return DEFAULT_SLABS;
    }
  });

  const [devices, setDevices] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_DEVICES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const emptyForm = useMemo(
    () => ({ brand: "", model: "", costUsd: "", shippingUsd: "", expectedSalePkr: "" }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  const formTotals = useMemo(() => {
    return calc({
      costUsd: form.costUsd,
      shippingUsd: form.shippingUsd,
      expectedSalePkr: form.expectedSalePkr,
      settings,
      slabs,
    });
  }, [form, settings, slabs]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_SLABS, JSON.stringify(slabs));
    } catch {}
  }, [slabs]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DEVICES, JSON.stringify(devices));
    } catch {}
  }, [devices]);

  const addDevice = () => {
    const d = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      brand: form.brand || "Other",
      model: String(form.model || "").trim() || "(Unnamed)",
      costUsd: n(form.costUsd),
      shippingUsd: n(form.shippingUsd),
      expectedSalePkr: n(form.expectedSalePkr),
      createdAt: Date.now(),
    };

    // Basic guard
    if (!d.costUsd || !d.expectedSalePkr) return;

    setDevices((prev) => [d, ...prev]);
    // Reset inputs to empty (fix: old values should not remain)
    setForm(emptyForm);
  };

  const removeDevice = (id) => setDevices((prev) => prev.filter((x) => x.id !== id));

  const exportCSV = () => {
    const header = [
      "Brand",
      "Model",
      "CostUSD",
      "ShippingUSD",
      "SalePKR",
      "USDtoPKR",
      "Slab",
      "GST%",
      "LandedCNIC",
      "ProfitCNIC",
      "MarginCNIC%",
      "LandedPassport",
      "ProfitPassport",
      "MarginPassport%",
    ];

    const lines = [header];

    devices.forEach((d) => {
      const t = calc({ ...d, settings, slabs });
      lines.push([
        d.brand,
        d.model,
        d.costUsd,
        d.shippingUsd,
        d.expectedSalePkr,
        settings.usdToPkr,
        t.slab.range,
        Math.round(t.gstRate * 100),
        Math.round(t.landedCnic),
        Math.round(t.profitCnic),
        t.marginCnic.toFixed(1),
        Math.round(t.landedPassport),
        Math.round(t.profitPassport),
        t.marginPassport.toFixed(1),
      ]);
    });

    const csv = lines
      .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phonescanada-pta-devices.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const reportRef = useRef(null);
  const exportPDF = async () => {
    if (!reportRef.current) return;

    // Ensure logo is loaded
    const imgs = reportRef.current.querySelectorAll("img");
    await Promise.all(
      Array.from(imgs).map(
        (img) =>
          new Promise((res) => {
            if (img.complete) return res(true);
            img.onload = () => res(true);
            img.onerror = () => res(true);
          })
      )
    );

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 1200,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Fit image into A4
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let y = 0;
    let remaining = imgH;

    while (remaining > 0) {
      pdf.addImage(imgData, "PNG", 0, y, imgW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        pdf.addPage();
        y -= pageH;
      }
    }

    pdf.save("phonescanada-pta-report.pdf");
  };

  const updateSlab = (idx, key, value) => {
    setSlabs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: Math.max(0, n(value)) };
      return next;
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600&display=swap');

        :root{
          --pc-bg1: #ffb3bf;
          --pc-bg2: #b9d4ff;
          --pc-bg3: #bff8ee;
          --pc-ink: #0f172a;
          --pc-muted: rgba(15, 23, 42, 0.62);
          --pc-card: rgba(255,255,255,0.66);
          --pc-card2: rgba(255,255,255,0.78);
          --pc-stroke: rgba(15, 23, 42, 0.10);
          --pc-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
          --pc-shadow2: 0 10px 24px rgba(15, 23, 42, 0.10);
          --pc-radius: 26px;
          --pc-radius-sm: 18px;
        }

        *{ box-sizing: border-box; }
        body{
          margin:0;
          font-family: 'Saira', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          color: var(--pc-ink);
          background: linear-gradient(135deg, var(--pc-bg1), var(--pc-bg2), var(--pc-bg3));
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* Background */
        .pc-bg{ position: fixed; inset: 0; z-index: 0; pointer-events:none; }
        .pc-blob{
          position:absolute;
          width: 640px; height: 640px;
          border-radius: 999px;
          filter: blur(42px);
          opacity: .42;
          mix-blend-mode: soft-light;
          animation: blob 10s ease-in-out infinite;
        }
        .pc-blob.b1{ left:-240px; top:-220px; background: radial-gradient(circle at 30% 30%, rgba(255,96,96,.95), rgba(255,96,96,0)); }
        .pc-blob.b2{ right:-260px; top:40px; background: radial-gradient(circle at 30% 30%, rgba(99,102,241,.92), rgba(99,102,241,0)); animation-delay: -3s; }
        .pc-blob.b3{ left: 18%; bottom:-340px; background: radial-gradient(circle at 30% 30%, rgba(34,211,238,.92), rgba(34,211,238,0)); animation-delay: -6s; }

        @keyframes blob{
          0%{ transform: translate3d(0,0,0) scale(1); }
          33%{ transform: translate3d(40px, -30px, 0) scale(1.08); }
          66%{ transform: translate3d(-36px, 24px, 0) scale(0.96); }
          100%{ transform: translate3d(0,0,0) scale(1); }
        }

        .pc-prisms{ position:absolute; inset:0; opacity:.65; animation: prisms 9s linear infinite; }
        .pc-prism{ filter: drop-shadow(0 10px 18px rgba(15,23,42,0.08)); }
        .pc-prism.p0{ opacity:.40 }
        .pc-prism.p1{ opacity:.55 }
        .pc-prism.p2{ opacity:.35 }
        .pc-prism.p3{ opacity:.48 }
        .pc-prism.p4{ opacity:.42 }
        .pc-prism.p5{ opacity:.38 }

        @keyframes prisms{
          0%{ transform: translate3d(0,0,0); }
          50%{ transform: translate3d(-22px, 14px, 0); }
          100%{ transform: translate3d(0,0,0); }
        }

        .pc-dots{ position:absolute; inset:0; }
        .pc-dot{
          position:absolute;
          width: 10px; height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.55);
          box-shadow: 0 10px 22px rgba(15,23,42,0.10);
          animation: floaty 6.5s ease-in-out infinite;
        }
        .pc-dot.d1{ left: 12%; top: 18%; animation-duration: 7.2s; }
        .pc-dot.d2{ left: 78%; top: 22%; animation-duration: 6.0s; animation-delay: -1.1s; }
        .pc-dot.d3{ left: 62%; top: 64%; animation-duration: 7.8s; animation-delay: -2.3s; }
        .pc-dot.d4{ left: 20%; top: 72%; animation-duration: 6.2s; animation-delay: -3.2s; }
        .pc-dot.d5{ left: 42%; top: 38%; animation-duration: 8.4s; animation-delay: -2.0s; }
        .pc-dot.d6{ left: 90%; top: 58%; animation-duration: 7.0s; animation-delay: -4.0s; }
        .pc-dot.d7{ left: 8%; top: 52%; animation-duration: 6.8s; animation-delay: -5.1s; }
        .pc-dot.d8{ left: 52%; top: 14%; animation-duration: 7.6s; animation-delay: -3.7s; }

        @keyframes floaty{
          0%{ transform: translate3d(0,0,0) scale(1); opacity:.55; }
          50%{ transform: translate3d(10px,-14px,0) scale(1.14); opacity:.75; }
          100%{ transform: translate3d(0,0,0) scale(1); opacity:.55; }
        }

        /* App shell */
        .pc-shell{ position: relative; z-index: 1; padding: 28px 18px 60px; }
        .pc-wrap{ max-width: 1220px; margin: 0 auto; }

        .pc-header{
          display:flex;
          align-items:center;
          gap: 16px;
          padding: 18px 18px;
          background: var(--pc-card);
          border: 1px solid var(--pc-stroke);
          border-radius: var(--pc-radius);
          box-shadow: var(--pc-shadow);
          backdrop-filter: blur(14px);
        }

        .pc-brandmark{
          width: 170px;
          height: 60px;
          border-radius: 16px;
          background: rgba(255,255,255,0.60);
          border: 1px solid rgba(15,23,42,0.12);
          box-shadow: 0 10px 22px rgba(15,23,42,0.10);
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
          flex: 0 0 auto;
        }
        .pc-brandmark img{ width: 92%; height: 92%; object-fit: contain; display:block; }

        .pc-title{ font-size: 28px; font-weight: 600; letter-spacing: -0.2px; margin: 0; line-height: 1.1; }
        .pc-sub{ margin: 4px 0 0; font-size: 14px; color: var(--pc-muted); font-weight: 400; }

        .pc-grid{ margin-top: 18px; display:grid; grid-template-columns: 360px 1fr; gap: 18px; align-items:start; }
        @media (max-width: 1020px){ .pc-grid{ grid-template-columns: 1fr; } }

        .pc-card{
          background: var(--pc-card2);
          border: 1px solid var(--pc-stroke);
          border-radius: var(--pc-radius);
          box-shadow: var(--pc-shadow2);
          backdrop-filter: blur(14px);
          padding: 18px;
        }

        .pc-card h3{
          margin: 0 0 10px;
          font-size: 14px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.70);
          font-weight: 600;
        }

        .pc-field{ display:flex; flex-direction: column; gap: 6px; }
        .pc-label{ font-size: 13px; color: rgba(15,23,42,0.72); font-weight: 500; display:flex; align-items:center; gap: 8px; }
        .pc-input, .pc-select{
          width: 100%;
          height: 44px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.14);
          background: rgba(255,255,255,0.72);
          padding: 0 14px;
          outline: none;
          font-size: 16px;
          font-weight: 400;
        }
        .pc-input:focus, .pc-select:focus{ border-color: rgba(99,102,241,0.55); box-shadow: 0 0 0 4px rgba(99,102,241,0.14); }

        .pc-row{ display:flex; gap: 12px; align-items: center; }
        .pc-row > * { flex: 1; }

        .pc-note{ margin-top: 10px; color: rgba(15,23,42,0.62); font-size: 14px; font-weight: 400; }

        /* Toggle */
        .pc-toggle-row{ margin-top: 12px; display:flex; align-items:center; justify-content: space-between; gap: 14px; padding: 12px 12px; border-radius: 18px; background: rgba(255,255,255,0.40); border: 1px solid rgba(15,23,42,0.08); }
        .pc-toggle-copy{ display:flex; flex-direction: column; gap: 2px; padding-right: 10px; }
        .pc-toggle-copy b{ font-weight: 600; }

        .pc-switch{ position: relative; width: 58px; height: 34px; border: 0; background: transparent; padding: 0; cursor: pointer; }
        .pc-switch__track{
          position:absolute; inset:0;
          border-radius: 999px;
          background: rgba(15,23,42,0.12);
          border: 1px solid rgba(15,23,42,0.12);
          transition: all .2s ease;
        }
        .pc-switch__thumb{
          position:absolute;
          top: 3px; left: 3px;
          width: 28px; height: 28px;
          border-radius: 999px;
          background: rgba(255,255,255,0.92);
          box-shadow: 0 10px 18px rgba(15,23,42,0.16);
          transition: transform .22s ease;
        }
        .pc-switch.is-on .pc-switch__track{ background: linear-gradient(135deg, rgba(255,96,96,0.95), rgba(255,140,120,0.90)); border-color: rgba(255,96,96,0.25); }
        .pc-switch.is-on .pc-switch__thumb{ transform: translateX(24px); }

        /* Slabs */
        .pc-table{ width: 100%; border-collapse: separate; border-spacing: 0; overflow:hidden; border-radius: 18px; border: 1px solid rgba(15,23,42,0.10); }
        .pc-table th, .pc-table td{ padding: 12px 12px; border-bottom: 1px solid rgba(15,23,42,0.08); }
        .pc-table th{ text-align:left; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(15,23,42,0.55); font-weight: 600; background: rgba(255,255,255,0.55); }
        .pc-table tr:last-child td{ border-bottom: 0; }
        .pc-range{ white-space: nowrap; font-weight: 600; color: rgba(15,23,42,0.70); }
        .pc-mini{ height: 40px; border-radius: 14px; padding: 0 12px; width: 100%; border: 1px solid rgba(15,23,42,0.14); background: rgba(255,255,255,0.70); font-size: 15px; font-weight: 400; }
        .pc-table colgroup col:nth-child(1){ width: 44%; }
        .pc-table colgroup col:nth-child(2){ width: 28%; }
        .pc-table colgroup col:nth-child(3){ width: 28%; }

        /* Main / Inventory */
        .pc-main .pc-card{ padding: 18px; }

        .pc-inv-head{ display:flex; align-items:flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .pc-inv-head .pc-inv-copy{ min-width: 240px; }
        .pc-inv-head h2{ margin:0; font-size: 14px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: rgba(15,23,42,0.70); }
        .pc-inv-head p{ margin: 6px 0 0; color: rgba(15,23,42,0.60); font-size: 14px; font-weight: 400; }

        .pc-btn{
          display:inline-flex;
          align-items:center;
          gap: 10px;
          height: 44px;
          padding: 0 16px;
          border-radius: 999px;
          border: 0;
          cursor: pointer;
          color: white;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(255,74,74,0.95), rgba(255,140,120,0.92));
          box-shadow: 0 14px 26px rgba(255,74,74,0.22);
        }
        .pc-btn:active{ transform: translateY(1px); }
        .pc-btn:disabled{ opacity: .55; cursor: not-allowed; }

        .pc-inv-form{ margin-top: 14px; display:grid; grid-template-columns: 220px 1.3fr 220px 220px 1.1fr 1fr; gap: 12px; align-items:end; }
        @media (max-width: 1140px){ .pc-inv-form{ grid-template-columns: 1fr 1fr; } }
        @media (max-width: 520px){ .pc-inv-form{ grid-template-columns: 1fr; } }

        .pc-best{
          height: 44px;
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 12px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.14);
          background: rgba(255,255,255,0.72);
          font-weight: 500;
          white-space: nowrap;
        }
        .pc-best .pc-best__tag{ font-weight: 600; }
        .pc-best .pc-best__amt{ font-variant-numeric: tabular-nums; }

        /* Pills */
        .pc-pill{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .02em;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.60);
          color: rgba(15,23,42,0.78);
          white-space: nowrap;
        }
        .pc-pill--good{ background: rgba(16,185,129,0.14); border-color: rgba(16,185,129,0.25); color: rgba(6,95,70,0.95); }
        .pc-pill--bad{ background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.25); color: rgba(153,27,27,0.95); }
        .pc-pill--neutral{ background: rgba(99,102,241,0.10); border-color: rgba(99,102,241,0.22); color: rgba(30,41,59,0.90); }

        /* Devices */
        .pc-dev-head{ display:flex; align-items:baseline; justify-content: space-between; gap: 10px; margin-top: 14px; }
        .pc-dev-head h2{ margin:0; font-size: 30px; font-weight: 600; letter-spacing: -0.4px; }
        .pc-dev-count{ color: rgba(15,23,42,0.55); font-weight: 500; }

        .pc-dev-grid{ margin-top: 14px; display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        @media (max-width: 980px){ .pc-dev-grid{ grid-template-columns: 1fr; } }

        .pc-device{
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(15,23,42,0.10);
          border-radius: 24px;
          box-shadow: 0 16px 30px rgba(15,23,42,0.10);
          overflow:hidden;
        }
        .pc-device__top{ padding: 16px 16px 12px; display:flex; align-items:flex-start; justify-content: space-between; gap: 12px; }
        .pc-device__brand{ font-size: 12px; letter-spacing: .20em; text-transform: uppercase; color: rgba(15,23,42,0.55); font-weight: 600; }
        .pc-device__model{ font-size: 22px; font-weight: 600; margin-top: 3px; line-height: 1.12; }
        .pc-device__chips{ margin-top: 10px; display:flex; gap: 8px; flex-wrap: wrap; }
        .pc-device__trash{
          width: 42px; height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.55);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
        }

        .pc-device__mid{ padding: 14px 16px; border-top: 1px solid rgba(15,23,42,0.08); }

        /* CNIC then Passport - stacked (fix wrapping) */
        .pc-section{ border: 1px solid rgba(15,23,42,0.10); border-radius: 18px; background: rgba(255,255,255,0.62); padding: 12px; }
        .pc-section + .pc-section{ margin-top: 10px; }
        .pc-section__head{ display:flex; align-items:center; justify-content: space-between; gap: 10px; }
        .pc-section__title{ font-size: 12px; letter-spacing: .20em; text-transform: uppercase; font-weight: 700; color: rgba(15,23,42,0.60); }

        .pc-metrics{ margin-top: 10px; display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 520px){ .pc-metrics{ grid-template-columns: 1fr; } }

        .pc-metric{ padding: 10px 10px; border-radius: 16px; border: 1px solid rgba(15,23,42,0.08); background: rgba(255,255,255,0.66); display:flex; align-items:baseline; justify-content: space-between; gap: 10px; }
        .pc-metric b{ font-weight: 600; color: rgba(15,23,42,0.70); }
        .pc-metric span{ font-weight: 600; font-variant-numeric: tabular-nums; text-align:right; min-width: 0; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }

        .pc-device__bottom{ padding: 12px 16px 16px; border-top: 1px solid rgba(15,23,42,0.08); background: rgba(255,255,255,0.55); }
        .pc-kv{ display:flex; align-items:baseline; justify-content: space-between; gap: 10px; margin-top: 6px; }
        .pc-kv:first-child{ margin-top: 0; }
        .pc-kv .k{ color: rgba(15,23,42,0.55); font-weight: 600; }
        .pc-kv .v{ font-weight: 600; font-variant-numeric: tabular-nums; text-align:right; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Export bar */
        .pc-export{
          margin-top: 14px;
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 14px;
          border-radius: 22px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.64);
          box-shadow: 0 14px 26px rgba(15,23,42,0.08);
        }
        .pc-export p{ margin:0; color: rgba(15,23,42,0.62); font-weight: 500; }
        .pc-export .pc-export__btns{ display:flex; gap: 10px; }
        .pc-chip-btn{
          display:inline-flex; align-items:center; gap: 10px;
          height: 44px; padding: 0 14px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.70);
          cursor:pointer;
          font-weight: 600;
        }

        /* Hidden report (PDF) */
        .pc-report-wrap{ position: absolute; left: -99999px; top: 0; width: 900px; }
        .pc-report{
          width: 900px;
          background: #ffffff;
          color: #0f172a;
          padding: 30px;
          font-family: 'Saira', system-ui;
        }
        .pc-report__head{ display:flex; align-items:center; gap: 14px; padding: 14px 14px; border-radius: 18px; background: #f4f6ff; border: 1px solid rgba(15,23,42,0.10); }
        .pc-report__logo{ width: 190px; height: 54px; border-radius: 14px; background: #ffffff; border: 1px solid rgba(15,23,42,0.10); display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .pc-report__logo img{ width: 92%; height: 92%; object-fit: contain; }
        .pc-report__title{ font-size: 22px; font-weight: 600; margin: 0; }
        .pc-report__sub{ margin: 4px 0 0; color: rgba(15,23,42,0.65); font-size: 13px; font-weight: 400; }
        .pc-report__hr{ height: 1px; background: rgba(15,23,42,0.10); margin: 18px 0; }

        .pc-report-item{ padding: 14px; border-radius: 18px; border: 1px solid rgba(15,23,42,0.10); background: #fbfbff; margin-bottom: 12px; }
        .pc-report-item__top{ display:flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .pc-report-item__name{ font-weight: 600; font-size: 16px; }
        .pc-report-item__sale{ font-weight: 600; }
        .pc-report-item__meta{ margin-top: 6px; color: rgba(15,23,42,0.62); font-size: 13px; }
        .pc-report-item__grid{ margin-top: 10px; display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pc-report-box{ padding: 12px; border-radius: 16px; border: 1px solid rgba(15,23,42,0.10); background: #ffffff; }
        .pc-report-box__title{ font-size: 12px; letter-spacing: .20em; text-transform: uppercase; color: rgba(15,23,42,0.60); font-weight: 700; display:flex; align-items:center; justify-content: space-between; }
        .pc-report-kv{ display:flex; justify-content: space-between; gap: 10px; margin-top: 6px; font-size: 13px; }
        .pc-report-kv .k{ color: rgba(15,23,42,0.62); }
        .pc-report-kv .v{ font-weight: 600; font-variant-numeric: tabular-nums; }

        .pc-foot{ margin-top: 10px; color: rgba(15,23,42,0.55); font-size: 12px; }
      `}</style>

      <Background enabled={!!settings.animationEnabled} />

      <div className="pc-shell">
        <div className="pc-wrap">
          {/* Header */}
          <div className="pc-header">
            <div className="pc-brandmark" title="PhonesCanada">
              <img src={logoSrc} alt="PhonesCanada" crossOrigin="anonymous" />
            </div>
            <div>
              <h1 className="pc-title">PhonesCanada PTA Dashboard</h1>
              <p className="pc-sub">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
            </div>
          </div>

          <div className="pc-grid">
            {/* Left */}
            <div>
              <div className="pc-card">
                <h3>System Preferences</h3>

                <div className="pc-field">
                  <div className="pc-label">USD Rate (PKR)</div>
                  <input
                    className="pc-input"
                    value={settings.usdToPkr}
                    onChange={(e) => setSettings((s) => ({ ...s, usdToPkr: n(e.target.value) }))}
                    inputMode="numeric"
                  />
                </div>

                <div className="pc-toggle-row">
                  <div className="pc-toggle-copy">
                    <b>Animations</b>
                    <span style={{ color: "rgba(15,23,42,0.60)", fontSize: 13, fontWeight: 400 }}>
                      Smooth blobs + prism outlines
                    </span>
                  </div>
                  <Switch
                    checked={!!settings.animationEnabled}
                    onChange={(v) => setSettings((s) => ({ ...s, animationEnabled: !!v }))}
                    label="Toggle animations"
                  />
                </div>

                <div className="pc-note">💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.</div>
              </div>

              <div className="pc-card" style={{ marginTop: 18 }}>
                <h3>PTA Tax Slabs (Editable)</h3>
                <table className="pc-table">
                  <colgroup>
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Value Range (USD)</th>
                      <th>CNIC</th>
                      <th>Passport</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slabs.map((s, idx) => (
                      <tr key={s.range}>
                        <td className="pc-range">{s.range}</td>
                        <td>
                          <input
                            className="pc-mini"
                            value={s.cnic}
                            onChange={(e) => updateSlab(idx, "cnic", e.target.value)}
                            inputMode="numeric"
                          />
                        </td>
                        <td>
                          <input
                            className="pc-mini"
                            value={s.passport}
                            onChange={(e) => updateSlab(idx, "passport", e.target.value)}
                            inputMode="numeric"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pc-foot">Saved automatically on this device (localStorage).</div>
              </div>
            </div>

            {/* Right */}
            <div className="pc-main">
              <div className="pc-card">
                <div className="pc-inv-head">
                  <div className="pc-inv-copy">
                    <h2>Inventory Planning</h2>
                    <p>Add a device and instantly compare CNIC vs Passport.</p>
                  </div>

                  <button
                    className="pc-btn"
                    onClick={addDevice}
                    disabled={!n(form.costUsd) || !n(form.expectedSalePkr)}
                    title="Add Device"
                  >
                    <Plus size={18} />
                    Add Device
                  </button>
                </div>

                <div className="pc-inv-form">
                  <div className="pc-field">
                    <div className="pc-label">Brand</div>
                    <select
                      className="pc-select"
                      value={form.brand}
                      onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pc-field">
                    <div className="pc-label">Device / Model Name</div>
                    <input
                      className="pc-input"
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      placeholder="e.g. iPhone 15 Pro Max"
                    />
                  </div>

                  <div className="pc-field">
                    <div className="pc-label">Purchase Cost (USD)</div>
                    <input
                      className="pc-input"
                      value={form.costUsd}
                      onChange={(e) => setForm((f) => ({ ...f, costUsd: e.target.value }))}
                      placeholder="e.g. 1199"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="pc-field">
                    <div className="pc-label">Shipping (USD)</div>
                    <input
                      className="pc-input"
                      value={form.shippingUsd}
                      onChange={(e) => setForm((f) => ({ ...f, shippingUsd: e.target.value }))}
                      placeholder="e.g. 30"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="pc-field">
                    <div className="pc-label">Expected Selling Price (PKR)</div>
                    <input
                      className="pc-input"
                      value={form.expectedSalePkr}
                      onChange={(e) => setForm((f) => ({ ...f, expectedSalePkr: e.target.value }))}
                      placeholder="e.g. 525000"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="pc-field">
                    <div className="pc-label">Profit / Loss (Best)</div>
                    <div className="pc-best" title="Best outcome between CNIC and Passport">
                      <span className="pc-best__tag">{formTotals.best}</span>
                      <span className="pc-best__amt" style={{ color: formTotals.bestProfit >= 0 ? "rgba(6,95,70,0.95)" : "rgba(153,27,27,0.95)" }}>
                        {formTotals.bestProfit >= 0 ? fmtPKR(formTotals.bestProfit) : `-${fmtPKR(Math.abs(formTotals.bestProfit))}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pc-card" style={{ marginTop: 18 }}>
                <div className="pc-dev-head">
                  <h2>Devices</h2>
                  <div className="pc-dev-count">{devices.length} device(s)</div>
                </div>

                <div className="pc-dev-grid">
                  {devices.map((d) => {
                    const t = calc({ ...d, settings, slabs });
                    const slabLabel = t.slab.range;
                    const gstPct = Math.round(t.gstRate * 100);

                    const cnicTone = t.profitCnic >= 0 ? "good" : "bad";
                    const passTone = t.profitPassport >= 0 ? "good" : "bad";

                    return (
                      <div key={d.id} className="pc-device">
                        <div className="pc-device__top">
                          <div>
                            <div className="pc-device__brand">{d.brand}</div>
                            <div className="pc-device__model">{d.model}</div>
                            <div className="pc-device__chips">
                              <Pill tone="neutral">Slab: {slabLabel} USD</Pill>
                              <Pill tone="neutral">GST: {gstPct}%</Pill>
                            </div>
                          </div>
                          <button className="pc-device__trash" onClick={() => removeDevice(d.id)} title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="pc-device__mid">
                          {/* CNIC first */}
                          <div className="pc-section">
                            <div className="pc-section__head">
                              <div className="pc-section__title">CNIC</div>
                              <Pill tone={cnicTone}>
                                {t.profitCnic >= 0 ? "PROFIT" : "LOSS"} • {t.profitCnic >= 0 ? fmtPKR(t.profitCnic) : `-${fmtPKR(Math.abs(t.profitCnic))}`}
                              </Pill>
                            </div>

                            <div className="pc-metrics">
                              <div className="pc-metric">
                                <b>Landed</b>
                                <span title={fmtPKR(t.landedCnic)}>{fmtPKR(t.landedCnic)}</span>
                              </div>
                              <div className="pc-metric">
                                <b>Margin</b>
                                <span>{t.marginCnic.toFixed(1)}%</span>
                              </div>
                              <div className="pc-metric">
                                <b>Base</b>
                                <span>{fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)} (USD→PKR {settings.usdToPkr})</span>
                              </div>
                            </div>
                          </div>

                          {/* Passport */}
                          <div className="pc-section">
                            <div className="pc-section__head">
                              <div className="pc-section__title">Passport</div>
                              <Pill tone={passTone}>
                                {t.profitPassport >= 0 ? "PROFIT" : "LOSS"} • {t.profitPassport >= 0 ? fmtPKR(t.profitPassport) : `-${fmtPKR(Math.abs(t.profitPassport))}`}
                              </Pill>
                            </div>

                            <div className="pc-metrics">
                              <div className="pc-metric">
                                <b>Landed</b>
                                <span title={fmtPKR(t.landedPassport)}>{fmtPKR(t.landedPassport)}</span>
                              </div>
                              <div className="pc-metric">
                                <b>Margin</b>
                                <span>{t.marginPassport.toFixed(1)}%</span>
                              </div>
                              <div className="pc-metric">
                                <b>PTA</b>
                                <span>{fmtPKR(t.ptaPassport)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pc-device__bottom">
                          <div className="pc-kv">
                            <div className="k">Sale</div>
                            <div className="v">{fmtPKR(d.expectedSalePkr)}</div>
                          </div>
                          <div className="pc-kv">
                            <div className="k">Cost + Ship</div>
                            <div className="v">{fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)}</div>
                          </div>
                          <div className="pc-kv">
                            <div className="k">USD→PKR</div>
                            <div className="v">{fmtInt(settings.usdToPkr)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pc-export">
                  <p>Export the full device list (CSV) or printable report (PDF).</p>
                  <div className="pc-export__btns">
                    <button className="pc-chip-btn" onClick={exportCSV} disabled={devices.length === 0}>
                      <Download size={18} /> CSV
                    </button>
                    <button className="pc-chip-btn" onClick={exportPDF} disabled={devices.length === 0}>
                      <Download size={18} /> PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden PDF report (styled) */}
        <div className="pc-report-wrap">
          <div className="pc-report" ref={reportRef}>
            <div className="pc-report__head">
              <div className="pc-report__logo">
                <img src={logoSrc} alt="PhonesCanada" crossOrigin="anonymous" />
              </div>
              <div>
                <div className="pc-report__title">PhonesCanada PTA Dashboard — Report</div>
                <div className="pc-report__sub">
                  USD/PKR Rate: {fmtInt(settings.usdToPkr)} • GST: {Math.round(settings.gstUnderThreshold * 100)}% / {Math.round(settings.gstAboveThreshold * 100)}% (threshold ${settings.gstThresholdUsd})
                </div>
              </div>
            </div>

            <div className="pc-report__hr" />

            {devices.map((d, idx) => {
              const t = calc({ ...d, settings, slabs });
              const gstPct = Math.round(t.gstRate * 100);
              const slabLabel = t.slab.range;
              const cnicTone = t.profitCnic >= 0 ? "good" : "bad";
              const passTone = t.profitPassport >= 0 ? "good" : "bad";

              return (
                <div key={d.id} className="pc-report-item">
                  <div className="pc-report-item__top">
                    <div className="pc-report-item__name">{idx + 1}. {d.brand} {d.model}</div>
                    <div className="pc-report-item__sale">{fmtPKR(d.expectedSalePkr)}</div>
                  </div>
                  <div className="pc-report-item__meta">Slab: {slabLabel} USD • GST: {gstPct}%</div>

                  <div className="pc-report-item__grid">
                    <div className="pc-report-box">
                      <div className="pc-report-box__title">
                        <span>CNIC</span>
                        <span style={{ color: cnicTone === "good" ? "#065f46" : "#991b1b" }}>
                          {t.profitCnic >= 0 ? "PROFIT" : "LOSS"}
                        </span>
                      </div>
                      <div className="pc-report-kv"><span className="k">Base (Cost+Ship)</span><span className="v">{fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)} (USD→PKR {fmtInt(settings.usdToPkr)})</span></div>
                      <div className="pc-report-kv"><span className="k">Landed</span><span className="v">{fmtPKR(t.landedCnic)}</span></div>
                      <div className="pc-report-kv"><span className="k">Profit</span><span className="v" style={{ color: cnicTone === "good" ? "#065f46" : "#991b1b" }}>{t.profitCnic >= 0 ? fmtPKR(t.profitCnic) : `-${fmtPKR(Math.abs(t.profitCnic))}`}</span></div>
                      <div className="pc-report-kv"><span className="k">Margin</span><span className="v">{t.marginCnic.toFixed(1)}%</span></div>
                    </div>

                    <div className="pc-report-box">
                      <div className="pc-report-box__title">
                        <span>Passport</span>
                        <span style={{ color: passTone === "good" ? "#065f46" : "#991b1b" }}>
                          {t.profitPassport >= 0 ? "PROFIT" : "LOSS"}
                        </span>
                      </div>
                      <div className="pc-report-kv"><span className="k">Base (Cost+Ship)</span><span className="v">{fmtUSD(d.costUsd)} + {fmtUSD(d.shippingUsd)} (USD→PKR {fmtInt(settings.usdToPkr)})</span></div>
                      <div className="pc-report-kv"><span className="k">Landed</span><span className="v">{fmtPKR(t.landedPassport)}</span></div>
                      <div className="pc-report-kv"><span className="k">Profit</span><span className="v" style={{ color: passTone === "good" ? "#065f46" : "#991b1b" }}>{t.profitPassport >= 0 ? fmtPKR(t.profitPassport) : `-${fmtPKR(Math.abs(t.profitPassport))}`}</span></div>
                      <div className="pc-report-kv"><span className="k">Margin</span><span className="v">{t.marginPassport.toFixed(1)}%</span></div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pc-foot">Generated by PhonesCanada PTA Dashboard</div>
          </div>
        </div>
      </div>
    </>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react"
import { jsPDF } from "jspdf"

// ----------------------------
// Storage Keys
// ----------------------------
const SETTINGS_KEY = "phonescanada_pta_settings_v2"
const SLABS_KEY = "phonescanada_pta_slabs_v2"
const DEVICES_KEY = "phonescanada_pta_devices_v2"

// ----------------------------
// Helpers
// ----------------------------
const clampNumber = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const formatPKR = (n) => {
  const num = clampNumber(n, 0)
  return `Rs ${Math.round(num).toLocaleString("en-US")}`
}

const formatUSD = (n) => {
  const num = clampNumber(n, 0)
  return `$${num.toFixed(0)}`
}

const safeLoad = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

const safeSave = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`

// ----------------------------
// Defaults
// ----------------------------
const DEFAULT_SETTINGS = {
  usdRate: 278,
  animations: true,
}

const DEFAULT_SLABS = [
  { id: "s1", range: "0–30", min: 0, max: 30, cnic: 550, passport: 430 },
  { id: "s2", range: "31–100", min: 31, max: 100, cnic: 4323, passport: 3200 },
  { id: "s3", range: "101–200", min: 101, max: 200, cnic: 11561, passport: 9580 },
  { id: "s4", range: "201–350", min: 201, max: 350, cnic: 14661, passport: 12200 },
  { id: "s5", range: "351–500", min: 351, max: 500, cnic: 23420, passport: 17800 },
  { id: "s6", range: "501+", min: 501, max: 999999, cnic: 37007, passport: 36870 },
]

const EMPTY_FORM = {
  brand: "",
  model: "",
  costUsd: "",
  shipUsd: "",
  salePkr: "",
}

// ----------------------------
// Core Calc
// ----------------------------
function findSlab(slabs, valueUsd) {
  const v = clampNumber(valueUsd, 0)
  return (
    slabs.find((s) => v >= s.min && v <= s.max) ||
    slabs[slabs.length - 1] ||
    DEFAULT_SLABS[0]
  )
}

function calcDevice(slabs, settings, d) {
  const usdRate = clampNumber(settings.usdRate, 278)

  const costUsd = clampNumber(d.costUsd, 0)
  const shipUsd = clampNumber(d.shipUsd, 0)
  const baseUsd = costUsd + shipUsd

  // GST rule: 18% below $500 / 25% at or above (using base USD)
  const gstRate = baseUsd >= 500 ? 0.25 : 0.18

  const slab = findSlab(slabs, baseUsd)

  const basePkr = baseUsd * usdRate
  const gstPkr = basePkr * gstRate

  const landedCnic = basePkr + gstPkr + clampNumber(slab.cnic, 0)
  const landedPassport = basePkr + gstPkr + clampNumber(slab.passport, 0)

  const salePkr = clampNumber(d.salePkr, 0)
  const profitCnic = salePkr - landedCnic
  const profitPassport = salePkr - landedPassport

  const marginCnic = salePkr > 0 ? (profitCnic / salePkr) * 100 : 0
  const marginPassport = salePkr > 0 ? (profitPassport / salePkr) * 100 : 0

  return {
    ...d,
    usdRate,
    costUsd,
    shipUsd,
    baseUsd,
    gstRate,
    slab,
    basePkr,
    gstPkr,
    salePkr,
    landedCnic,
    landedPassport,
    profitCnic,
    profitPassport,
    marginCnic,
    marginPassport,
  }
}

// ----------------------------
// CSV Export
// ----------------------------
function toCsv(devices, slabs, settings) {
  const rows = devices.map((d) => {
    const c = calcDevice(slabs, settings, d)
    return {
      brand: c.brand || "",
      model: c.model || "",
      purchase_cost_usd: c.costUsd,
      shipping_usd: c.shipUsd,
      base_usd: c.baseUsd,
      usd_to_pkr: c.usdRate,
      gst_rate: c.gstRate,
      slab_range: c.slab?.range || "",
      pta_cnic_pkr: clampNumber(c.slab?.cnic, 0),
      pta_passport_pkr: clampNumber(c.slab?.passport, 0),
      expected_sale_pkr: c.salePkr,
      landed_cnic_pkr: Math.round(c.landedCnic),
      landed_passport_pkr: Math.round(c.landedPassport),
      profit_cnic_pkr: Math.round(c.profitCnic),
      profit_passport_pkr: Math.round(c.profitPassport),
      margin_cnic_pct: Number(c.marginCnic.toFixed(2)),
      margin_passport_pct: Number(c.marginPassport.toFixed(2)),
    }
  })

  const headers = Object.keys(rows[0] || { brand: "" })
  const escape = (v) => {
    const s = String(v ?? "")
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n")

  return csv
}

function downloadTextFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ----------------------------
// PDF Export (simple, fast, reliable on GitHub Pages)
// ----------------------------
function exportPdf(devices, slabs, settings) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 44
  let y = 44

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("PhonesCanada PTA Dashboard — Report", margin, y)
  y += 18

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text(`USD→PKR Rate: ${clampNumber(settings.usdRate, 278)}`, margin, y)
  y += 18

  const line = () => {
    doc.setDrawColor(220)
    doc.line(margin, y, pageW - margin, y)
    y += 14
  }

  line()

  const addRow = (label, value) => {
    doc.setFont("helvetica", "normal")
    doc.text(label, margin, y)
    doc.setFont("helvetica", "bold")
    doc.text(value, pageW - margin, y, { align: "right" })
    y += 14
  }

  devices.forEach((d, idx) => {
    const c = calcDevice(slabs, settings, d)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text(`${idx + 1}. ${c.brand || "—"}  ${c.model || ""}`.trim(), margin, y)
    y += 16

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Slab: ${c.slab?.range || "—"} USD • GST: ${Math.round(c.gstRate * 100)}%`,
      margin,
      y
    )
    y += 14

    addRow("Expected Sale", formatPKR(c.salePkr))
    addRow("Base (Cost + Ship)", `${formatUSD(c.costUsd)} + ${formatUSD(c.shipUsd)}  (USD→PKR ${c.usdRate})`)
    addRow("Landed (CNIC)", formatPKR(c.landedCnic))
    addRow("Profit (CNIC)", formatPKR(c.profitCnic))
    addRow("Landed (Passport)", formatPKR(c.landedPassport))
    addRow("Profit (Passport)", formatPKR(c.profitPassport))

    y += 6
    line()

    if (y > 740) {
      doc.addPage()
      y = 44
    }
  })

  doc.save("phonescanada-pta-report.pdf")
}

// ----------------------------
// UI
// ----------------------------
export default function App() {
  const [settings, setSettings] = useState(() => safeLoad(SETTINGS_KEY, DEFAULT_SETTINGS))
  const [slabs, setSlabs] = useState(() => safeLoad(SLABS_KEY, DEFAULT_SLABS))
  const [devices, setDevices] = useState(() => safeLoad(DEVICES_KEY, []))
  const [form, setForm] = useState(EMPTY_FORM)

  // Persist
  useEffect(() => safeSave(SETTINGS_KEY, settings), [settings])
  useEffect(() => safeSave(SLABS_KEY, slabs), [slabs])
  useEffect(() => safeSave(DEVICES_KEY, devices), [devices])

  // Logo from repo root (works on GitHub Pages with Vite base)
  const logoSrc = useMemo(() => `${import.meta.env.BASE_URL}phonescanadalogo-web.png`, [])
  const [logoOk, setLogoOk] = useState(true)

  const livePreview = useMemo(() => {
    const draft = {
      id: "preview",
      brand: form.brand,
      model: form.model,
      costUsd: form.costUsd,
      shipUsd: form.shipUsd,
      salePkr: form.salePkr,
    }
    return calcDevice(slabs, settings, draft)
  }, [form, slabs, settings])

  const liveBestProfit = useMemo(() => {
    if (!clampNumber(form.salePkr, 0)) return null
    const best = Math.max(livePreview.profitCnic, livePreview.profitPassport)
    return best
  }, [livePreview, form.salePkr])

  const addDevice = () => {
    const next = {
      id: uid(),
      brand: (form.brand || "").trim(),
      model: (form.model || "").trim(),
      costUsd: clampNumber(form.costUsd, 0),
      shipUsd: clampNumber(form.shipUsd, 0),
      salePkr: clampNumber(form.salePkr, 0),
    }
    setDevices((prev) => [next, ...prev])
    // IMPORTANT: clear the fields after adding (your request)
    setForm(EMPTY_FORM)
  }

  const removeDevice = (id) => setDevices((prev) => prev.filter((d) => d.id !== id))

  const updateSlab = (id, field, value) => {
    setSlabs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: clampNumber(value, 0) } : s))
    )
  }

  const bgBlobs = useMemo(() => {
    const blobs = [
      { top: "12%", left: "8%", size: 520, delay: 0 },
      { top: "8%", right: "12%", size: 460, delay: 1.2 },
      { bottom: "10%", left: "18%", size: 480, delay: 0.8 },
      { bottom: "12%", right: "10%", size: 520, delay: 1.6 },
    ]
    return blobs
  }, [])

  const exportCsv = () => {
    if (!devices.length) return
    const csv = toCsv(devices, slabs, settings)
    downloadTextFile("phonescanada-pta-devices.csv", csv, "text/csv")
  }

  const profitStyle = (profit) => {
    const p = clampNumber(profit, 0)
    if (p > 0) return "pill pill--pos"
    if (p < 0) return "pill pill--neg"
    return "pill pill--neu"
  }

  return (
    <div className="pc-wrap">
      <style>{`
        :root{
          --bg1:#f6e2e6;
          --bg2:#e7eefb;
          --card:#ffffffcc;
          --cardSolid:#ffffff;
          --text:#0f172a;
          --muted:#64748b;
          --line:#e5e7eb;
          --shadow: 0 20px 60px rgba(15,23,42,.10);
          --shadow2: 0 10px 30px rgba(15,23,42,.08);
          --radius: 24px;
          --radius2: 18px;
          --brand:#ef4444;
          --brand2:#fb7185;
          --posBg: rgba(16,185,129,.12);
          --posBorder: rgba(16,185,129,.28);
          --posText: #065f46;
          --negBg: rgba(239,68,68,.10);
          --negBorder: rgba(239,68,68,.25);
          --negText: #7f1d1d;
          --neuBg: rgba(100,116,139,.12);
          --neuBorder: rgba(100,116,139,.22);
          --neuText: #334155;
        }

        *{ box-sizing:border-box; }
        body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji"; color:var(--text); }
        .pc-wrap{
          min-height:100vh;
          background: radial-gradient(900px 500px at 15% 20%, var(--bg1), transparent 60%),
                      radial-gradient(900px 500px at 85% 20%, var(--bg2), transparent 60%),
                      linear-gradient(180deg, #fff, #f8fafc);
          position:relative;
          overflow:hidden;
        }

        .blobs{ position:absolute; inset:0; pointer-events:none; }
        .blob{
          position:absolute;
          border-radius: 999px;
          filter: blur(50px);
          opacity: .55;
          background: radial-gradient(circle at 30% 30%, rgba(239,68,68,.55), rgba(99,102,241,.20), transparent 70%);
          animation: floaty 10s ease-in-out infinite;
        }
        @keyframes floaty{
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(18px,-14px,0) scale(1.03); }
        }

        .container{
          width:min(1180px, calc(100% - 32px));
          margin: 26px auto 60px;
          position:relative;
          z-index:2;
        }

        .header{
          display:flex;
          gap:16px;
          align-items:center;
          padding: 18px 18px;
          border-radius: var(--radius);
          background: var(--card);
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow2);
          border: 1px solid rgba(255,255,255,.65);
        }
        .logoBox{
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display:grid;
          place-items:center;
          overflow:hidden;
          background: linear-gradient(135deg, rgba(239,68,68,.18), rgba(239,68,68,.08));
          border: 1px solid rgba(239,68,68,.18);
        }
        .logoImg{
          width: 46px;
          height: 46px;
          object-fit: contain;
          display:block;
        }
        .logoFallback{
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display:grid;
          place-items:center;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(135deg, var(--brand), var(--brand2));
        }
        .titleWrap{ min-width: 0; }
        .title{
          margin:0;
          font-size: 18px;
          letter-spacing: .2px;
        }
        .subtitle{
          margin:3px 0 0;
          color: var(--muted);
          font-size: 13px;
        }

        .grid{
          display:grid;
          grid-template-columns: 340px 1fr;
          gap: 18px;
          margin-top: 16px;
        }

        @media (max-width: 960px){
          .grid{ grid-template-columns: 1fr; }
        }

        .card{
          background: var(--card);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,.65);
          border-radius: var(--radius);
          box-shadow: var(--shadow2);
          padding: 16px;
        }
        .card h3{
          margin: 0 0 12px;
          font-size: 12px;
          letter-spacing: .12em;
          color: var(--muted);
          text-transform: uppercase;
        }

        .field{
          display:flex;
          flex-direction:column;
          gap: 6px;
          margin-bottom: 12px;
        }
        .labelRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          color: var(--muted);
          font-size: 12px;
        }
        .input, .select{
          width:100%;
          border-radius: 14px;
          padding: 11px 12px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.75);
          outline:none;
          font-size: 14px;
        }
        .row2{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .toggleRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding-top: 6px;
        }
        .toggle{
          width: 54px;
          height: 30px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.8);
          position:relative;
          cursor:pointer;
        }
        .toggleKnob{
          width: 24px;
          height: 24px;
          border-radius: 999px;
          position:absolute;
          top: 50%;
          transform: translateY(-50%);
          left: 3px;
          background: #fff;
          box-shadow: 0 10px 20px rgba(0,0,0,.12);
          transition: all .2s ease;
        }
        .toggle.on{
          background: rgba(239,68,68,.16);
          border-color: rgba(239,68,68,.24);
        }
        .toggle.on .toggleKnob{
          left: 26px;
          background: linear-gradient(135deg, var(--brand), var(--brand2));
        }

        .hint{
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.45;
        }

        .slabTable{
          width:100%;
          border-collapse: separate;
          border-spacing: 0;
          overflow:hidden;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.75);
        }
        .slabTable th, .slabTable td{
          padding: 10px 10px;
          border-bottom: 1px solid var(--line);
          font-size: 12px;
        }
        .slabTable th{
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: .10em;
          font-size: 11px;
          background: rgba(248,250,252,.85);
        }
        .slabTable tr:last-child td{ border-bottom: none; }
        .slabInput{
          width: 100%;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.9);
          border-radius: 10px;
          padding: 8px 8px;
          font-size: 12px;
          outline:none;
          text-align: right;
        }

        .planning{
          padding: 18px;
        }
        .planningHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 14px;
          margin-bottom: 14px;
        }
        .planningHead h2{
          margin: 0;
          font-size: 12px;
          letter-spacing: .12em;
          color: var(--muted);
          text-transform: uppercase;
        }
        .btn{
          border: none;
          border-radius: 999px;
          padding: 12px 16px;
          font-weight: 700;
          cursor:pointer;
          background: linear-gradient(135deg, var(--brand), var(--brand2));
          color:#fff;
          box-shadow: 0 14px 30px rgba(239,68,68,.22);
          display:inline-flex;
          align-items:center;
          gap: 10px;
        }
        .btn:disabled{
          opacity: .55;
          cursor:not-allowed;
        }

        .planningGrid{
          display:grid;
          grid-template-columns: 180px 1fr 160px 140px 220px 170px;
          gap: 10px;
          align-items:end;
        }
        @media (max-width: 1050px){
          .planningGrid{
            grid-template-columns: 1fr 1fr;
          }
        }

        .profitPreview{
          display:flex;
          align-items:center;
          justify-content:flex-start;
          min-height: 44px;
        }
        .pill{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 13px;
          border: 1px solid transparent;
          white-space:nowrap;
        }
        .pill--pos{ background: var(--posBg); border-color: var(--posBorder); color: var(--posText); }
        .pill--neg{ background: var(--negBg); border-color: var(--negBorder); color: var(--negText); }
        .pill--neu{ background: var(--neuBg); border-color: var(--neuBorder); color: var(--neuText); }

        .devicesCard{
          margin-top: 16px;
          padding: 18px;
        }
        .devicesHeader{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .devicesHeader h2{
          margin:0;
          font-size: 22px;
          letter-spacing: -0.02em;
        }

        .deviceGrid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 860px){
          .deviceGrid{ grid-template-columns: 1fr; }
        }

        .deviceCard{
          background: rgba(255,255,255,.78);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          box-shadow: var(--shadow2);
          overflow:hidden;
        }
        .deviceTop{
          padding: 14px 14px 10px;
          border-bottom: 1px solid var(--line);
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap: 10px;
        }
        .deviceBrand{
          font-size: 12px;
          letter-spacing:.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 6px;
        }
        .deviceModel{
          margin:0;
          font-size: 22px;
          letter-spacing: -0.02em;
        }
        .deviceMeta{
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .iconBtn{
          border: 1px solid var(--line);
          background: rgba(255,255,255,.7);
          border-radius: 12px;
          padding: 10px 10px;
          cursor:pointer;
        }

        .deviceBody{
          padding: 12px 14px 14px;
        }
        .twoCols{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 520px){
          .twoCols{ grid-template-columns: 1fr; }
        }
        .mini{
          border: 1px solid var(--line);
          border-radius: 18px;
          background: rgba(255,255,255,.68);
          padding: 12px;
        }
        .miniHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .miniTitle{
          font-size: 14px;
          letter-spacing:.12em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 800;
        }
        .miniRows{
          display:flex;
          flex-direction:column;
          gap: 8px;
        }
        .kv{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          font-size: 14px;
        }
        .kv span{ color: var(--muted); }
        .kv b{ font-size: 15px; }

        .deviceFooter{
          padding: 10px 14px 14px;
          color: var(--muted);
          font-size: 13px;
          display:flex;
          gap: 12px;
          align-items:center;
          flex-wrap: wrap;
        }

        .exports{
          margin-top: 14px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,.5);
        }
        .exports p{
          margin:0;
          color: var(--muted);
          font-size: 13px;
        }
        .exportBtns{
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ghost{
          border: 1px solid var(--line);
          background: rgba(255,255,255,.7);
          border-radius: 999px;
          padding: 12px 14px;
          font-weight: 800;
          cursor:pointer;
        }
      `}</style>

      {settings.animations && (
        <div className="blobs">
          {bgBlobs.map((b, i) => (
            <div
              key={i}
              className="blob"
              style={{
                width: b.size,
                height: b.size,
                top: b.top,
                left: b.left,
                right: b.right,
                bottom: b.bottom,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="logoBox">
            {logoOk ? (
              <img
                className="logoImg"
                src={logoSrc}
                alt="PhonesCanada"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <div className="logoFallback">P</div>
            )}
          </div>

          <div className="titleWrap">
            <h1 className="title">PhonesCanada PTA Dashboard</h1>
            <p className="subtitle">PTA Tax • Landed Cost • Profit (CNIC vs Passport)</p>
          </div>
        </div>

        <div className="grid">
          {/* Left */}
          <div style={{ display: "grid", gap: 14 }}>
            <div className="card">
              <h3>System Preferences</h3>

              <div className="field">
                <div className="labelRow">
                  <span>USD Rate (PKR)</span>
                </div>
                <input
                  className="input"
                  inputMode="numeric"
                  value={settings.usdRate}
                  onChange={(e) => setSettings((s) => ({ ...s, usdRate: clampNumber(e.target.value, 0) }))}
                  placeholder="e.g. 278"
                />
              </div>

              <div className="toggleRow">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>Animations</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                    Smooth background blobs
                  </div>
                </div>

                <div
                  className={`toggle ${settings.animations ? "on" : ""}`}
                  onClick={() => setSettings((s) => ({ ...s, animations: !s.animations }))}
                  role="switch"
                  aria-checked={settings.animations}
                >
                  <div className="toggleKnob" />
                </div>
              </div>

              <p className="hint">💡 GST auto-switches at <b>$500</b>: 18% below / 25% at or above.</p>
            </div>

            <div className="card">
              <h3>PTA Tax Slabs (Editable)</h3>
              <table className="slabTable">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Value Range (USD)</th>
                    <th style={{ textAlign: "right" }}>CNIC</th>
                    <th style={{ textAlign: "right" }}>Passport</th>
                  </tr>
                </thead>
                <tbody>
                  {slabs.map((s) => (
                    <tr key={s.id}>
                      <td style={{ color: "var(--text)", fontWeight: 800 }}>{s.range}</td>
                      <td>
                        <input
                          className="slabInput"
                          inputMode="numeric"
                          value={s.cnic}
                          onChange={(e) => updateSlab(s.id, "cnic", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="slabInput"
                          inputMode="numeric"
                          value={s.passport}
                          onChange={(e) => updateSlab(s.id, "passport", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="hint">
                These slabs are a simplified reference. Update them anytime if PTA rules change.
              </p>
            </div>
          </div>

          {/* Right */}
          <div>
            <div className="card planning">
              <div className="planningHead">
                <h2>Inventory Planning</h2>

                <button
                  className="btn"
                  onClick={addDevice}
                  disabled={!form.brand || !form.model || !form.costUsd || !form.salePkr}
                  title="Add device to list"
                >
                  <span style={{ fontSize: 18, lineHeight: 0 }}>＋</span>
                  Add Device
                </button>
              </div>

              <div className="planningGrid">
                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="labelRow">
                    <span>Brand</span>
                  </div>
                  <select
                    className="select"
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                    <option value="Google">Google</option>
                    <option value="OnePlus">OnePlus</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="labelRow">
                    <span>Device / Model Name</span>
                  </div>
                  <input
                    className="input"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro Max"
                  />
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="labelRow">
                    <span>Purchase Cost (USD)</span>
                  </div>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.costUsd}
                    onChange={(e) => setForm((f) => ({ ...f, costUsd: e.target.value }))}
                    placeholder="e.g. 1199"
                  />
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="labelRow">
                    <span>Shipping (USD)</span>
                  </div>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.shipUsd}
                    onChange={(e) => setForm((f) => ({ ...f, shipUsd: e.target.value }))}
                    placeholder="e.g. 30"
                  />
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="labelRow">
                    <span>Expected Selling Price (PKR)</span>
                  </div>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.salePkr}
                    onChange={(e) => setForm((f) => ({ ...f, salePkr: e.target.value }))}
                    placeholder="e.g. 525000"
                  />
                </div>

                {/* NEW: Immediate Profit/Loss column */}
                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="labelRow">
                    <span>Profit / Loss (Best)</span>
                  </div>
                  <div className="profitPreview">
                    {liveBestProfit === null ? (
                      <span className="pill pill--neu">—</span>
                    ) : (
                      <span className={profitStyle(liveBestProfit)}>
                        {liveBestProfit >= 0 ? "Profit" : "Loss"} • {formatPKR(liveBestProfit)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Devices */}
            <div className="card devicesCard">
              <div className="devicesHeader">
                <h2>Devices</h2>
              </div>

              {!devices.length ? (
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  No devices yet. Add one from the Inventory Planning section above.
                </p>
              ) : (
                <div className="deviceGrid">
                  {devices.map((d) => {
                    const c = calcDevice(slabs, settings, d)

                    const cnicPill = profitStyle(c.profitCnic)
                    const passPill = profitStyle(c.profitPassport)

                    return (
                      <div key={d.id} className="deviceCard">
                        <div className="deviceTop">
                          <div>
                            <div className="deviceBrand">{c.brand || "—"}</div>
                            <h3 className="deviceModel">{c.model || "—"}</h3>
                            <div className="deviceMeta">
                              Slab: <b>{c.slab?.range || "—"} USD</b> • GST:{" "}
                              <b>{Math.round(c.gstRate * 100)}%</b>
                            </div>
                          </div>

                          <button className="iconBtn" onClick={() => removeDevice(d.id)} title="Remove">
                            🗑️
                          </button>
                        </div>

                        <div className="deviceBody">
                          <div className="twoCols">
                            <div className="mini">
                              <div className="miniHead">
                                <div className="miniTitle">CNIC</div>
                                <span className={cnicPill}>
                                  {c.profitCnic >= 0 ? "Profit" : "Loss"} • {formatPKR(c.profitCnic)}
                                </span>
                              </div>

                              <div className="miniRows">
                                <div className="kv">
                                  <span>Landed</span>
                                  <b>{formatPKR(c.landedCnic)}</b>
                                </div>
                                <div className="kv">
                                  <span>Margin</span>
                                  <b>{c.salePkr > 0 ? `${c.marginCnic.toFixed(1)}%` : "—"}</b>
                                </div>
                              </div>
                            </div>

                            <div className="mini">
                              <div className="miniHead">
                                <div className="miniTitle">Passport</div>
                                <span className={passPill}>
                                  {c.profitPassport >= 0 ? "Profit" : "Loss"} • {formatPKR(c.profitPassport)}
                                </span>
                              </div>

                              <div className="miniRows">
                                <div className="kv">
                                  <span>Landed</span>
                                  <b>{formatPKR(c.landedPassport)}</b>
                                </div>
                                <div className="kv">
                                  <span>Margin</span>
                                  <b>{c.salePkr > 0 ? `${c.marginPassport.toFixed(1)}%` : "—"}</b>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="deviceFooter">
                          <span>🧾 Sale: <b>{formatPKR(c.salePkr)}</b></span>
                          <span>📦 Cost+Ship: <b>{formatUSD(c.costUsd)} + {formatUSD(c.shipUsd)}</b></span>
                          <span>💱 USD→PKR: <b>{c.usdRate}</b></span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Exports (moved to ONE place, not per device) */}
              <div className="exports">
                <p>Export the full device list (CSV) or printable report (Save as PDF).</p>
                <div className="exportBtns">
                  <button className="ghost" onClick={exportCsv} disabled={!devices.length}>
                    ⬇️ CSV
                  </button>
                  <button
                    className="ghost"
                    onClick={() => exportPdf(devices, slabs, settings)}
                    disabled={!devices.length}
                  >
                    ⬇️ PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes:
            - Analytics tab removed ✅
            - Logo upload UI removed ✅ (uses phonescanadalogo-web.png from repo root)
            - "Cards auto-fit..." removed ✅
            - Inventory form clears after add ✅
            - Added live Profit/Loss column ✅
            - Device cards: profit/loss now highlighted ✅
            - Chart / PNG export / Clear Sale removed ✅
        */}
      </div>
    </div>
  )
}

# PhonesCanada PTA Dashboard

A modern, one-page React dashboard to estimate **PTA taxes**, **landed cost**, and **profit** for imported phones in Pakistan — comparing **CNIC vs Passport** scenarios.

## ✅ Features

- **Inventory Planner**: brand, model, purchase cost, shipping, expected selling price
- **Auto calculations**: base PKR, GST, PTA (CNIC / Passport), total taxes, landed cost, profit, margin
- **Clear breakdown** with tooltips explaining each calculation
- **Exports**: CSV, PNG screenshot, and PDF
- **Soft animated background** (toggleable) with abstract polygon drift
- **GitHub Pages deployment** via GitHub Actions

> Tip: You can upload the **PhonesCanada logo** and swap it into the header.

---

## 🚀 Live Site (GitHub Pages)

After deployment, your site URL will be:

`https://<your-username>.github.io/phonescanada-pta-dashboard/`

Example:

`https://wasifahmed1991.github.io/phonescanada-pta-dashboard/`

---

## 🧩 Project Structure

```
.
├── .github/workflows/deploy.yml
├── index.html
├── package.json
├── vite.config.js
└── src
    ├── App.jsx
    ├── main.jsx
    └── index.css
```

---

## 🛠️ Local Development

```bash
npm install
npm run dev
```

Build locally:

```bash
npm run build
npm run preview
```

---

## 📦 Deploy to GitHub Pages (Clicks Guide)

1. **Repo → Settings**
2. Left sidebar → **Pages**
3. Under **Build and deployment**
   - **Source**: select **GitHub Actions**
4. Go to **Actions** tab → confirm **Deploy to GitHub Pages** workflow is running.
5. Once green ✅, refresh the **Pages** settings and copy your live URL.

### Common gotchas

- **Do NOT** type the repo name into **Custom domain** unless you own a real domain (e.g. `pta.phonescanada.com`).
- If the page looks “unstyled”, it usually means the code relied on Tailwind classes without Tailwind installed. This version uses **pure CSS**.

---

## 📤 Export Notes

- **CSV** exports a calculation summary.
- **PNG/PDF** exports a clean screenshot of the main card (the element with id `export-area`).

---

## ⚠️ Disclaimer

PTA/Tax policies may change. This dashboard is an estimation tool and should be verified against the latest official rules before making import decisions.

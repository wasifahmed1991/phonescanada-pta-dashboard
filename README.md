# PhonesCanada PTA Dashboard

A lightweight, responsive dashboard to estimate **PTA tax**, **landed cost**, and **net profit** for mobile devices — comparing **CNIC vs Passport** slabs.

Built with **React + Vite** and optimized for quick inventory checks.

## What it does

Given a device’s USD purchase cost + shipping and your expected selling price in PKR, the dashboard calculates:

- Converted PKR purchase + shipping using your USD→PKR rate
- GST (auto‑switches between 18% and 25% based on the configured threshold)
- PTA tax (CNIC vs Passport)
- Landed cost and net profit for each option

## Highlights

- **Editable PTA tax slabs** (stored locally in the browser) so you can update values when PTA rules change
- **Logo upload** that updates the header icon (stored locally in the browser)
- **Export**
  - CSV (quick sharing / copying into sheets)
  - PDF snapshot of the results area
- **Animations toggle** for the background effects
- Fully responsive layout

## Tech stack

- React 18
- Vite
- lucide-react (icons)
- html2canvas + jsPDF (PDF export)

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Run locally

```bash
npm run dev
```

### 3) Build

```bash
npm run build
```

### 4) Preview production build

```bash
npm run preview
```

## Deployment (GitHub Pages)

This repo is configured for GitHub Pages deployments.

1. Ensure `vite.config.js` has the correct base path:

```js
base: '/phonescanada-pta-dashboard/'
```

2. In GitHub, go to **Settings → Pages** and select **GitHub Actions** as the source.

3. Push to `main` and the workflow will build & deploy.

### Important: lockfile

If your workflow uses `npm ci`, you must commit a lockfile:

- `package-lock.json` (npm)
- or `yarn.lock`
- or `pnpm-lock.yaml`

If you don’t want to commit a lockfile, change the workflow to use `npm install` instead of `npm ci`.

## Notes

- PTA slab values vary over time; always validate against your latest official PTA schedule.
- Browser storage is used for slabs and the uploaded logo (no server).

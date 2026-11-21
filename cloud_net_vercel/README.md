# Cloud Net - Autonomous Log Anomaly Detection & Self-Healing Platform

Cloud Net is a real-time observability and autonomous remediation platform inspired by modern enterprise log analytics interfaces (Datadog, Dynatrace). It continuously ingests system and infrastructure logs, predicts anomaly spikes with ML models (Isolation Forest + Decision Trees), and executes automated corrective actions.

---

## 🚀 Key Features

1. **Log Stream & Anomaly Explorer (`/explorer`)**
   - Live interactive minute-by-minute log ingestion histogram with anomaly spikes and wall-clock times.
   - Dynamic facet filtering (`service`, `datacenter`, `status`, `http.status_code`, `k8s.pod`, `client.ip`).
   - Side drawer detailing anomaly severity, root cause explanations, and autonomous mitigation actions.
2. **Monitors & Triggered Alerts (`/monitors`)**
   - Active alert triggers, severity badges, and autonomous self-healing execution telemetry.
3. **History & Audit Archive (`/history`)**
   - Searchable, persistent historical audit log records that retain past system events and remediation logs.
   - Snapshot export and filtered search capabilities.
4. **Admin Profile (`/profile`)**
   - Admin account managed by **Mansi M** (`mansi.m@cloudnet.io`).

---

## 🛠 Local Setup & Running

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the FastAPI server
uvicorn web_dashboard.server:app --host 0.0.0.0 --port 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## ☁️ 1-Click Deployment Options

### Option 1: Render (Recommended - Free)
1. Push this repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/<your-username>/cloud-net.git
   git push -u origin main
   ```
2. Log into [Render.com](https://render.com) and click **New + > Web Service**.
3. Select your repository. Render will automatically detect `render.yaml` and configure:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn web_dashboard.server:app --host 0.0.0.0 --port $PORT`
4. Click **Deploy**. Your app will be live at `https://<service-name>.onrender.com` with free automatic SSL.

---

### Option 2: Railway
1. Go to [Railway.app](https://railway.app) and click **New Project > Deploy from GitHub repo**.
2. Select this repository. Railway detects `railway.json` / `Procfile` and deploys automatically.

---

### Option 3: Docker / Container Platforms (Fly.io / Google Cloud Run / AWS ECS)
Build and run the container locally or in the cloud:
```bash
docker build -t cloud-net:latest .
docker run -p 8000:8000 cloud-net:latest
```
For Google Cloud Run:
```bash
gcloud run deploy cloud-net --source . --port 8000 --allow-unauthenticated
```

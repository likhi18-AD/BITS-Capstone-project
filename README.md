# ML-GPR-Trained

ML prediction for EV battery State of Health (SoH) using 20 vehicles of real-world data.

This repo contains:
- `ipynb/`- All model training code is placed here along with relevent data analysis.
- `backend/` – FastAPI + Uvicorn backend for SoH analytics and ML forecasts
- `frontend/` – React frontend dashboard
- `artifacts/` – trained models, feature CSVs, and other ML assets
- `data/` – raw / processed data used by the pipeline
  
---

## 1. Prerequisites

- **Python** ≥ 3.9
- **Node.js** ≥ 18 and **npm**
- (Recommended) `virtualenv` or `venv` for Python. If possible just install `Anaconda` which worked the best for me. 

---

## 2. Running the frontend

```bash
# from repo root
cd frontend

# install dependencies (run once)
npm install

# start dev server
npm run dev
```
## 3. Running the backend
1. with env file present locally
```bash
uvicorn backend.app.main:app --reload --env-file .env
```
2. If you have dont env file locally then use:
```bash
uvicorn backend.app.main:app --reload
```
## 4. SMTP support
To get the SMTP support you must create a .env file with following contents in it, replace accordingly
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com        # sending account
SMTP_PASS=your_16_char_app_password  # Gmail app password, NOT normal password
SMTP_FROM=yourgmail@gmail.com        # or "Wind Granma <yourgmail@gmail.com>"
```

Note that the passowrd placed here is not your accout password but the App password, to get one login to your desired gmail account to be used for SMTP host first and foremost make sure you have 2 step verification enabled in security setting for safety purposes. Then to get the APP passwords just type ass passwords in search bar and create one, ypu will get a sixteen digit pin copy paste it here.

### PS: None of this is safe for hosting the backend literally holds the passkeys and gmails in a freaking JSON file lol !

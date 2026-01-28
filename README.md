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
SECRET_KEY=some_long_random_string_here
RESET_TOKEN_EXP_MIN=30
FRONTEND_BASE_URL=http://localhost:5173
```

Note that the password placed here is not your accout password but the App password, to get one login to your desired gmail account to be used for SMTP host. First and foremost make sure you have 2 step verification enabled in your security settings for safety purposes. Then to get the APP passwords just type app passwords in search bar and create one, you will get a 16-digit pin,copy and paste it here.

As for the secret key you can generate it randomly on your linux terminal by the following command:
```bash
openssl rand -hex 32
```
you will get a 32 character string copy paste it, If you are not on linux then you can generate it by some online 32hex code genrators.



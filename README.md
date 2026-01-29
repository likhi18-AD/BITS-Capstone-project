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

## 5. Testing Software-Hardware Integration
To test if the proper communication is supported use the following commands once the CAN port is setup on rasberry pi This only works if the BMS script is available either custom made or JDB given, You will start seeing generic CAN ID's being displayed. If you have the original CAN Matrix from the JDB decoding the CAN ID's is very simple. But first we need to make it systemd executable.
1. Move the Factory Given CAN Matrix decoder to systemd service and place it in:
```bash
# move and rename
sudo mv ~/bms_can_daemon /usr/local/bin/bmsd

# make sure it’s owned by root and executable
sudo chown root:root /usr/local/bin/bmsd
sudo chmod 755 /usr/local/bin/bmsd
```
Once its placed there Test it by 
```bash 
bmsd
```
 2. Create a systemd service file
```bash
sudo nano /etc/systemd/system/bmsd.service
```
And paste the following contents, if the CAN Matrix decoder is in python then place the environment correctly. Note that intermediate steps of opening CAN port as placed here itself to make it easier.
```bash
[Unit]
Description=8S BMS CAN Telemetry Daemon
After=network.target

[Service]
Type=simple

# Run the main process as your normal user
User=kafkayash
WorkingDirectory=/home/kafkayash

# ExecStartPre commands must run as root (for ip link)
PermissionsStartOnly=true

# Bring up CAN0 in loopback mode for demo
ExecStartPre=/usr/sbin/ip link set can0 down
ExecStartPre=/usr/sbin/ip link set can0 type can bitrate 500000 loopback on
ExecStartPre=/usr/sbin/ip link set can0 up

# Main daemon binary (your Python-based tool in /usr/local/bin)
ExecStart=/usr/local/bin/bmsd

# Auto-restart on crash
Restart=on-failure
RestartSec=2

# Unbuffered output so logs appear immediately in journalctl
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target


```
3. Relaod the service and check if its working.
```bash
sudo systemctl daemon-reload

# enable at boot (optional, but nice)
sudo systemctl enable bmsd

# start it now
sudo systemctl start bmsd
```
```bash
sudo systemctl status bmsd
```
4. View the live telemetry log 
```bash
journalctl -u bmsd -f
```
5. some basic commands handy to use.
```bash
#Stop:
sudo systemctl stop bmsd
#Restart
sudo systemctl restart bmsd
#Status
sudo systemctl status bmsd
#Disable and autorestart on boot
sudo systemctl disable bmsd
```
6. To see RAW CAN frames use the following commands:
```bash
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000 loopback on
sudo ip link set can0 up
```
Then type the following command:
```bash
candump can0
```
7. one required package if CAN Matrix decoder is in python is necessary to be installed:
```bash
sudo apt install -y python3-can
```
This is the testing for software and hardware aspect.




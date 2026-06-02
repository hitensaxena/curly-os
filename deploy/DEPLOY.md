# Deploying Curly OS → os.curlybrackets.art

The app runs on the **host** (systemd), not Docker — the `claude` CLI it spawns
carries live `~/.claude` OAuth creds and runs the host mind venv. brain
(Neo4j/Chroma/api) and Authentik stay in Docker.

Steps need sudo (hand to Hiten). Run from `~/code/curly-os`.

### 0. Free the port
The local dev server (if running) binds :3100. Stop it before installing the
service, or the unit's `next start` will fail to bind.

### 1. DNS
Add an A record `os.curlybrackets.art` → this host's public IP (same as journal.).

### 2. Build (already done in dev)
```
cd ~/code/curly-os && npm run build
```

### 3. App service (host systemd) — note the WIDENED sandbox
`deploy/curly-os.service` already adds `ReadWritePaths` for `~/mind` and
`~/.claude` (the correction over crazymage's data-only sandbox).
```
sudo cp deploy/curly-os.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now curly-os
journalctl -u curly-os -f         # watch it boot; confirm "Ready"
```

### 4. mind→brain bridge timer (every 5 min)
```
sudo cp deploy/brain-mind-bridge.service deploy/brain-mind-bridge.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now brain-mind-bridge.timer
systemctl list-timers brain-mind-bridge.timer
```

### 5. Caddy
Append `deploy/caddy-os.snippet` to `~/infra/caddy/Caddyfile`, then reload:
```
cat deploy/caddy-os.snippet >> ~/infra/caddy/Caddyfile
# reload the caddy container (adjust container name as needed)
sudo docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
  || (cd ~/infra && sudo docker compose restart caddy)
```

### 6. Authentik SSO
In `auth.curlybrackets.art` admin:
1. **Provider** → create a *Proxy Provider* (Forward auth, single application),
   External host `https://os.curlybrackets.art`.
2. **Application** → bind it to the **existing embedded outpost** (same one
   journal. uses).
3. Ensure Hiten's user is authorized for the app.

### 7. Confirm the allow-listed username  ⚠️
`curly-os.service` sets `CURLY_ALLOWED_USER=akadmin` (from crazymage's code),
but the Caddyfile comment says `crazymage`. Load `https://os.curlybrackets.art`;
if you get the /forbidden page after SSO, the real username differs — set the
right one:
```
sudo systemctl edit curly-os    # add: [Service]\nEnvironment=CURLY_ALLOWED_USER=<real>
sudo systemctl restart curly-os
```
(To discover it: `journalctl -u curly-os` won't print it; temporarily log
`x-authentik-username` or check the Authentik user's username field.)

### 8. End-to-end verify (M1 exit criterion)
From your **phone**: open `https://os.curlybrackets.art` → complete Authentik
SSO → home shows the brain node count → send a chat → watch it stream
(retrieval incl. 🧠 brain chunks → delta → result) → reload, confirm the
session persisted. Confirm in `journalctl -u curly-os` that the claude spawn +
OAuth refresh worked **under the systemd sandbox** (not just an interactive
shell — this is the riskiest assumption).

# LIOR_PLAYERLIST

A self-contained player monitor for your FiveM server. The browser never
talks to your game server directly — `server.js` fetches `players.json`
itself and re-serves it from the same origin as the page, which avoids
CORS entirely.

## Setup

```
npm install
npm start
```

Then open http://localhost:3456 (or the IP of the machine you ran it on,
if running on a remote VPS — make sure port 3456 is open in the firewall).

## Keeping it running permanently

```
sudo npm install -g pm2
pm2 start server.js --name lior-playerlist
pm2 save
pm2 startup
```

## Recently-left players

When a player disconnects, they don't disappear from the list instantly —
they're shown greyed out with a "left Xm ago" tag for 5 minutes, then drop
off automatically. If they reconnect within that window, they just flip
back to a normal online row. The "online" count in the top bar only
counts currently-connected players, not the recently-left ones.

To change the grace period, edit `LEAVE_GRACE_MINUTES` at the top of
`server.js`.

## Config

Edit `BACKEND_URL` at the top of `server.js` if your players.json lives
at a different address.

## Deploying to Render

1. Push this repo to GitHub.
2. On https://dashboard.render.com click **New → Blueprint** and pick the repo
   (it reads `render.yaml`), or **New → Web Service** with:
   - Build command: `npm install`
   - Start command: `npm start`
3. Render sets `PORT` automatically; `server.js` already uses it.

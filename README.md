# 📌 Staff Management Discord Bot

A Discord staff management system with applications, HR tools, logging, and economy features built using Discord.js v14.

---

## 🚀 Features

### 📩 Application System
Users apply through DM-based applications. They select a role (HR, Partner, Moderator), answer questions, and their application is automatically sent to the staff server with Accept / Deny buttons.

---

### 🛡 Staff System
- `/fire` command (role hierarchy based permission system)
- `/resign` system with approval buttons
- Automatic role removal when fired or resigned
- DM notifications for all staff actions

---

### 📂 Auto Log System
On startup, the bot automatically creates a category called `SERVER LOGS` and generates all required channels inside it:

verification-s2-logs, requests, break-requests, resignations, blacklists, mass-bans, mass-blacklist, lvl-up, tests, money-logs, join-and-leave

---

### 💰 Economy System
Includes a simple money system:
- `/moneyadd`
- `/moneyremove`
- `/balance`
All transactions are logged in `#money-logs`

---

### 🧠 Permission System
The bot uses Discord role hierarchy instead of hardcoded role IDs. This means:
- Staff commands work based on role position
- Trainee and above (or configured minimum position) can use staff commands
- Admins always have access

---

## ⚙️ Setup

Install dependencies:
npm install

Edit configuration inside index.js:
token: "YOUR_BOT_TOKEN",
clientId: "YOUR_CLIENT_ID",
mainGuildId: "MAIN_SERVER_ID",
staffGuildId: "STAFF_SERVER_ID"

Run the bot:
node index.js

---

## 📂 Database (db.json)

{
  "applications": [],
  "warns": [],
  "blacklist": [],
  "troll": [],
  "resigns": [],
  "money": {},
  "config": {
    "applicationChannel": "CHANNEL_ID",
    "staffRoles": [],
    "minStaffPosition": 1
  }
}

---

## 📌 Commands

Staff Commands:
/ panel → Open application panel
/ fire user reason → Fire staff member
/ resign reason → Submit resignation

Economy Commands:
/ moneyadd user amount
/ moneyremove user amount
/ balance user

---

## 📡 Tech Stack
Node.js, Discord.js v14, Express, JSON database

---

## ⚠️ Requirements
- Node.js 18+
- Discord bot with intents:
  - Guilds
  - Members
  - Direct Messages

---

## 🚀 Future Upgrades
- Web dashboard UI
- MongoDB support
- Anti-raid system
- Staff promotion system
- Full audit logging system
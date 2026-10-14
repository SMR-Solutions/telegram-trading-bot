# Deploying TGP Premium Bot to Render

This bot is configured to run 24/7 on **Render's Free Web Service** with an automated HTTP health check.

---

### Step 1: Push Code to GitHub

1. Create a **Private Repository** on GitHub (e.g. `tgp-premium-bot`).
2. Run these commands in your project terminal:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tgp-premium-bot.git
   git push -u origin main
   ```
   *(Your `.env` and `data/` files are completely protected by `.gitignore` and will never be pushed).*

---

### Step 2: Create a Web Service on Render

1. Log into [Render.com](https://render.com).
2. Click **New +** &rarr; select **Web Service**.
3. Connect your GitHub account and select your `tgp-premium-bot` repository.
4. Configure the settings:
   - **Name**: `tgp-premium-bot` (or any name)
   - **Region**: Singapore or Frankfurt (choose closest)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: 
     ```bash
     npm install && npm run build
     ```
   - **Start Command**: 
     ```bash
     npm start
     ```
   - **Instance Type**: **Free**

---

### Step 3: Add Environment Variables in Render

In the Render service creation page (or under **Environment** tab):

Add the following **Environment Variables**:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `BOT_TOKEN` | `8922225673:AAFfZEyytt8mLp9kdRAHYfLH6CJ6BpJ3t0E` | Your Telegram Bot token |
| `ADMIN_ID` | `8665500150` | Your Telegram User ID to receive leads |

---

### Step 4: Deploy!

1. Click **Deploy Web Service**.
2. Render will run `npm install`, compile TypeScript (`npm run build`), and run `npm start`.
3. In the Render logs you will see:
   ```text
   🌐 Health check server listening on port 10000
   ✅ Bot connected successfully: @TGPoffcial_001_bot (TGP_Premium 📈)
   🚀 Bot is live and listening for updates!
   📩 Admin notifications active: delivering to ID 8665500150
   ```
4. Once Render shows **"Live"**, you can safely close your computer terminal—your bot will stay running 24/7 in the cloud!

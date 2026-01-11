const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Global variables
const CAPSOLVER_API_KEY = "CAP-ED4178FF70C174EB79EDF60846570312670376A951B815C52C7113DC914E7F42";
let activeBrowsers = {};
let activeContexts = {};

// ============================================
// PLATFORM URLs
// ============================================
const LOGIN_URL = {
  instagram: "https://www.instagram.com/accounts/login/",
  facebook: "https://www.facebook.com/login/",
  youtube: "https://accounts.google.com",
  tiktok: "https://www.tiktok.com/login/phone-or-email/email",
  twitter: "https://twitter.com/login",
  linkedin: "https://www.linkedin.com/login",
  google_business: "https://accounts.google.com/ServiceLogin?service=lbc&passive=true&continue=https://business.google.com/&hl=en",
  trustpilot: "https://www.trustpilot.com/users/connect",
};

// ============================================
// HELPER: Extract Auth Token
// ============================================
function extractAuthToken(cookies, platform) {
  if (!cookies || cookies.length === 0) return null;

  const tokenMap = {
    instagram: ["sessionid", "csrftoken"],
    facebook: ["c_user", "xs"],
    twitter: ["auth_token", "ct0"],
    tiktok: ["sessionid", "tt_webid", "tt_webid_v2", "sid_tt"],
    linkedin: ["li_at", "JSESSIONID"],
    youtube: ["SAPISID", "SSID"],
  };

  const tokens = tokenMap[platform] || [];

  for (const cookie of cookies) {
    if (tokens.includes(cookie.name)) {
      return cookie.value;
    }
  }

  return null;
}

// ============================================
// HEALTH CHECK
// ============================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Social Automation API is running 🚀",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /login-social",
      "POST /close-browser"
    ]
  });
});

// ============================================
// LOGIN ENDPOINT
// ============================================
app.post("/login-social", async (req, res) => {
  const {
    username,
    password,
    platform,
    account_id,
    proxy_host,
    proxy_port,
    proxy_username,
    proxy_password,
    headless = false,
    email,
    twitter_username,
  } = req.body;

  if (!LOGIN_URL[platform]) {
    return res.json({ success: false, message: "Platform not supported" });
  }

  console.log(`🌐 Login attempt → ${platform} | Account ID: ${account_id}`);

  let browser;

  try {
    // Check if browser already running
    if (activeBrowsers[account_id]) {
      const context = activeContexts[account_id];
      const storageState = await context.storageState();

      return res.json({
        success: true,
        message: "Already logged in - session reused",
        sessionData: JSON.stringify(storageState),
        cookies: storageState.cookies,
        authToken: extractAuthToken(storageState.cookies, platform),
      });
    }

    // Launch browser
    const launchOptions = {
      headless: headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    };

    if (proxy_host && proxy_port) {
      launchOptions.proxy = {
        server: `http://${proxy_host}:${proxy_port}`,
      };
      
      if (proxy_username && proxy_password) {
        launchOptions.proxy.username = proxy_username;
        launchOptions.proxy.password = proxy_password;
      }
    }

    browser = await chromium.launch(launchOptions);

    const contextOptions = {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    };

    const context = await browser.newContext(contextOptions);

    // Store browser and context
    activeBrowsers[account_id] = browser;
    activeContexts[account_id] = context;

    const page = await context.newPage();

    console.log(`🌐 Navigating to ${LOGIN_URL[platform]}...`);
    await page.goto(LOGIN_URL[platform], {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    // ============================================
    // YAHAN APNA LOGIN CODE PASTE KAREIN
    // Platform ke according login logic
    // ============================================
    
    // Example for Instagram:
    if (platform === "instagram") {
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await page.type('input[name="username"]', username, { delay: 100 });
      await page.waitForTimeout(500);
      await page.type('input[name="password"]', password, { delay: 100 });
      await page.waitForTimeout(1000);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      
      // Handle popups
      await page.click('button:has-text("Not now")').catch(() => {});
    }

    // Baaki platforms ka code yahan paste karein...

    await page.waitForTimeout(5000);

    // Get storage state
    const storageState = await context.storageState();
    const authToken = extractAuthToken(storageState.cookies, platform);
    const sessionDataString = JSON.stringify(storageState);

    console.log(`✅ Login successful → ${account_id}`);

    return res.json({
      success: true,
      message: "Login successful",
      sessionData: sessionDataString,
      cookies: storageState.cookies,
      authToken: authToken,
      browserKeptOpen: true,
      accountId: account_id
    });

  } catch (error) {
    console.error(`❌ Login error: ${error.message}`);
    
    return res.json({
      success: false,
      message: "Login error",
      error: error.message,
      accountId: account_id
    });
  }
});

// ============================================
// CLOSE BROWSER
// ============================================
app.post("/close-browser", async (req, res) => {
  const { account_id } = req.body;

  try {
    if (activeBrowsers[account_id]) {
      await activeBrowsers[account_id].close();
      delete activeBrowsers[account_id];
      delete activeContexts[account_id];
      
      return res.json({
        success: true,
        message: "Browser closed successfully"
      });
    } else {
      return res.json({
        success: false,
        message: "No active browser found"
      });
    }
  } catch (error) {
    return res.json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// YAHAN BAAKI ENDPOINTS PASTE KAREIN
// - /check-login
// - /execute-task
// - /stop-scroll
// - /scroll-status
// ============================================

// Export for Vercel
module.exports = app;
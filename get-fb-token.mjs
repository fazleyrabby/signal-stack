#!/usr/bin/env node
/**
 * SignalStack Pulse — Facebook Page Access Token Helper
 *
 * Usage:
 *   node get-fb-token.mjs <short_lived_user_token>
 *
 * What it does:
 *   1. Exchanges your short-lived token for a long-lived user token (60 days)
 *   2. Lists your Facebook Pages
 *   3. Prints the Page Access Token and Page ID for each page
 *
 * These are the values you paste into the "Connect Account" form in Pulse settings.
 */

const APP_ID = process.env.FB_APP_ID;
const APP_SECRET = process.env.FB_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error("Error: FB_APP_ID and FB_APP_SECRET environment variables must be set.");
  process.exit(1);
}

const GRAPH = "https://graph.facebook.com/v19.0";

const shortLivedToken = process.argv[2];

if (!shortLivedToken) {
  console.error("Usage: node get-fb-token.mjs <short_lived_user_token>");
  console.error("\nGet your token at: https://developers.facebook.com/tools/explorer");
  process.exit(1);
}

async function main() {
  // 1. Exchange for long-lived user access token
  console.log("\n🔄  Exchanging short-lived token for long-lived token...");
  const exchangeUrl = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`;

  const exchangeRes = await fetch(exchangeUrl);
  const exchangeData = await exchangeRes.json();

  if (exchangeData.error) {
    console.error("\n❌  Token exchange failed:", exchangeData.error.message);
    process.exit(1);
  }

  const longLivedUserToken = exchangeData.access_token;
  const expiresIn = exchangeData.expires_in;
  console.log(`✅  Long-lived user token obtained (expires in ${Math.round(expiresIn / 86400)} days)`);

  // 2. Get the list of Pages this user manages
  console.log("\n📄  Fetching your managed Pages...");
  const pagesUrl = `${GRAPH}/me/accounts?access_token=${longLivedUserToken}&fields=id,name,access_token,category`;

  const pagesRes = await fetch(pagesUrl);
  const pagesData = await pagesRes.json();

  if (pagesData.error) {
    console.error("\n❌  Failed to fetch pages:", pagesData.error.message);
    process.exit(1);
  }

  const pages = pagesData.data;

  if (!pages || pages.length === 0) {
    console.error("\n⚠️   No Pages found for this user. Make sure you manage at least one Facebook Page.");
    process.exit(1);
  }

  // 3. Print results
  console.log(`\n✅  Found ${pages.length} page(s):\n`);
  console.log("═".repeat(70));

  for (const page of pages) {
    console.log(`\n📌  Page: ${page.name}`);
    console.log(`    Category: ${page.category}`);
    console.log(`\n    ┌──────────────────────────────────────────────────────────────┐`);
    console.log(`    │ Page Handle / Name  →  ${page.name}`);
    console.log(`    │ Page ID             →  ${page.id}`);
    console.log(`    │ Page Access Token   →  ${page.access_token.slice(0, 20)}...`);
    console.log(`    └──────────────────────────────────────────────────────────────┘`);
    console.log(`\n    ⚠️   FULL Page Access Token (copy this into Pulse Settings):`);
    console.log(`    ${page.access_token}`);
  }

  console.log("\n═".repeat(70));
  console.log("\n📋  How to use these values in Pulse:");
  console.log("    1. Open  http://localhost:3001/admin/pulse  →  Settings tab");
  console.log("    2. Click the [Facebook] toggle in the Connect Account form");
  console.log("    3. Fill in:");
  console.log("         Page Handle / Name  →  Page name above");
  console.log("         Page ID             →  Number above");
  console.log("         App Secret          →  " + APP_SECRET);
  console.log("         Page Access Token   →  Token printed above");
  console.log("    4. Click 'Verify & Save Facebook Page'");
  console.log("\n✅  Page Access Tokens from /me/accounts are already long-lived (they don't expire).\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});

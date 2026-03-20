# 🏛️ Leon's Venetian Plaster — Quote System
# Zero-to-Live Deployment Guide
# (No coding knowledge required — follow each step in order)
# ══════════════════════════════════════════════════════════════

## WHAT YOU'LL HAVE WHEN DONE
- A private URL like: leonsvp.vercel.app/quote/ude-2026
- Client enters their phone → receives SMS code → views quote
- Quote is protected: no download, no right-click save on images
- Client clicks "Accept" → digital contract with signature pad appears
- Both parties sign → client can download PDF, quote cannot be downloaded
- You (Leon) log in with YOUR phone → see admin dashboard with full access log

---

## STEP 1 — Create a GitHub account (5 min)
1. Go to https://github.com
2. Click "Sign up" — use your email
3. Confirm your email

---

## STEP 2 — Upload the project to GitHub (5 min)
1. Log into GitHub
2. Click the green "New" button (top left)
3. Name it: leons-quote-system
4. Click "Create repository"
5. Click "uploading an existing file"
6. Drag ALL the files from the project folder into the browser window
7. Click "Commit changes"

---

## STEP 3 — Create a Supabase account (10 min)
Supabase = your database (stores who accessed what, OTP codes, logs)

1. Go to https://supabase.com → "Start your project" → sign up with GitHub
2. Click "New project"
   - Name: leons-quote-system
   - Database Password: create a strong password, SAVE IT somewhere
   - Region: US East (or Canada if available)
3. Wait ~2 minutes for project to set up
4. Click "SQL Editor" in the left sidebar
5. Click "New query"
6. Open the file: supabase-schema.sql
7. Copy ALL the text and paste it into the SQL editor
8. Click "Run" (green button)
9. You should see "Success. No rows returned"

Now get your Supabase keys:
10. Click "Project Settings" (gear icon, bottom left)
11. Click "API"
12. Copy these two values — you'll need them in Step 5:
    - Project URL (looks like: https://abcdefgh.supabase.co)
    - anon public key (long string starting with eyJ...)
    - service_role key (another long string — keep this SECRET)

---

## STEP 4 — Create a Twilio account (10 min)
Twilio = sends the SMS verification codes

1. Go to https://twilio.com → "Sign up for free"
2. Verify your phone number
3. Answer the setup questions:
   - "What do you want to build?" → Verification / Authentication
   - "What coding language?" → JavaScript
4. After signup, you're on the Console dashboard
5. Get a free phone number:
   - Click "Get a Twilio phone number" (big button)
   - It will suggest a number — click "Choose this number"
6. Copy these 3 values from your Console:
   - Account SID (starts with AC...)
   - Auth Token (click to reveal)
   - Your Twilio phone number (e.g. +17801234567)

Note: Twilio free trial requires verifying recipient numbers first.
To send to any Canadian number, you need to upgrade ($15 USD credit is enough for 1000+ SMS).

---

## STEP 5 — Deploy to Vercel (10 min)
Vercel = hosts your website for free

1. Go to https://vercel.com → "Start Deploying" → sign up with GitHub
2. Click "Add New Project"
3. Find "leons-quote-system" from your GitHub repos → click "Import"
4. Click "Environment Variables" to expand it
5. Add each variable one by one (copy from .env.example, replace with real values):

   Name: TWILIO_ACCOUNT_SID        Value: ACxxxxxx... (from Step 4)
   Name: TWILIO_AUTH_TOKEN         Value: your token (from Step 4)
   Name: TWILIO_PHONE_NUMBER       Value: +17801234567 (from Step 4)
   Name: SUPABASE_URL              Value: https://xxx.supabase.co (from Step 3)
   Name: SUPABASE_SERVICE_KEY      Value: eyJ... service_role key (from Step 3)
   Name: OTP_SALT                  Value: LeonVP2026SecureKey (make up anything)
   Name: ADMIN_PHONE_1             Value: +17809876543 (YOUR phone number)

6. Click "Deploy"
7. Wait ~2 minutes
8. Vercel gives you a URL like: leons-quote-system.vercel.app ✅

---

## STEP 6 — Update the quote viewer config (5 min)
Now you need to point the HTML file to your real Vercel URL.

1. Open quote-viewer.html in a text editor (Notepad is fine)
2. Find this section near the top of the <script> tag:
   
   SUPABASE_URL: 'YOUR_SUPABASE_URL',
   SUPABASE_KEY: 'YOUR_SUPABASE_ANON_KEY',

3. Replace with your real values from Step 3
4. Also update:
   ADMIN_PHONE: '+17805550000'   ← replace with YOUR real phone number

5. Save the file
6. Go back to GitHub → find quote-viewer.html → click edit (pencil icon)
7. Replace all content with your updated file → "Commit changes"
8. Vercel will automatically redeploy in ~1 minute

---

## STEP 7 — TEST IT (5 min)
1. Open your Vercel URL in a browser
2. Enter a phone number → click "Send Verification Code"
3. Check the phone for an SMS
4. Enter the 6-digit code
5. You should see the quote! 🎉

To test the admin view:
- Enter YOUR phone number (the ADMIN_PHONE_1 you set)
- Verify with the SMS code
- You'll see the access log dashboard instead of the quote

---

## USING THE SYSTEM FOR EACH NEW PROJECT

For each new client project:
1. Open quote-viewer.html
2. Update the LINE_ITEMS array with the new project's costs
3. Update CLIENT_NAME, QUOTE_ID, project title/description
4. Re-upload to GitHub → Vercel auto-deploys
5. Send the URL to your client

Or in the future: we can build a proper admin panel where you fill in a form
and it generates a new quote page automatically — no code editing needed.

---

## YOUR COSTS (monthly)
| Service  | Cost                              |
|----------|-----------------------------------|
| GitHub   | Free                              |
| Supabase | Free (up to 500MB, 50k API calls) |
| Vercel   | Free (up to 100GB bandwidth)      |
| Twilio   | ~$0.015 CAD per SMS sent          |

For 50 quotes/year with 2 SMS each = ~$1.50/year in Twilio costs.

---

## QUESTIONS?
If you get stuck at any step, take a screenshot and ask Claude.
The most common issue is a typo in the environment variable names — 
double-check they match exactly.

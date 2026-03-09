const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Stabilized Gateway" });
});

// ==========================================
// 1. THE HANDSHAKE (Lightweight Auth Check)
// ==========================================
app.post('/api/handshake', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, error: "Missing payload." });
    
    console.log(`\n=========================================`);
    console.log(`[HANDSHAKE] Initiated for: ${identifier}`);
    console.log(`=========================================`);
    
    let browser;
    try {
        console.log("[HANDSHAKE] Booting Native Chromium Engine...");
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/chromium', 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', // CRITICAL: Prevents Docker/VM shared memory crashes
                '--disable-gpu', 
                '--no-first-run', 
                '--disable-site-isolation-trials', 
                '--window-size=1024,768', 
                '--disable-blink-features=AutomationControlled'
            ]
        });
        
        console.log("[HANDSHAKE] Engine Online. Opening Target...");
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');
        await page.setRequestInterception(true);
        page.on('request', (req) => { 
            ['image', 'media'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        console.log("[HANDSHAKE] Navigating to Zoho IAM Public Portal...");
        await page.goto('https://accounts.zoho.com/signin?servicename=ZohoCreator&serviceurl=https://creatorapp.zoho.com/srm_university/academia-academic-services/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log("[HANDSHAKE] Entering Identifier...");
        await page.waitForSelector('input[id="login_id"]', { timeout: 45000 });
        await page.type('input[id="login_id"]', identifier, { delay: 40 }); 
        await page.click('button[id="nextbtn"]');
        
        console.log("[HANDSHAKE] Entering Password...");
        await page.waitForSelector('input[id="password"]', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000)); 
        await page.type('input[id="password"]', password, { delay: 40 });
        
        console.log("[HANDSHAKE] Executing Strike...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}), 
            page.click('button[id="nextbtn"]')
        ]);
        
        const pageContent = await page.content();
        if (pageContent.includes('Invalid Password') || pageContent.includes('INVALID_PASSWORD')) {
            console.log("[HANDSHAKE] Strike Failed: Incorrect Password.");
            await browser.close().catch(()=>{});
            return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        if (pageContent.includes('Terminate all other sessions')) {
            console.log("[HANDSHAKE] Ghost Session Limit Hit. Terminating old sessions...");
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }), 
                    page.evaluate(() => { 
                        const btns = Array.from(document.querySelectorAll('.blue_btn, button')); 
                        const termBtn = btns.find(b => b.textContent.includes('Terminate') || b.textContent.includes('Continue')); 
                        if (termBtn) termBtn.click(); 
                    })
                ]);
            } catch (e) {
                console.log("[HANDSHAKE] Warning: Native termination click failed.");
            }
        }

        console.log("[HANDSHAKE] WAF Bypassed. Stabilizing dashboard...");
        await new Promise(r => setTimeout(r, 4000));

        console.log("[HANDSHAKE] Extracting Real Name...");
        let realName = "Classified Operative";
        let profileData = await page.evaluate(async () => {
            try { return await (await fetch('https://creatorapp.zoho.com/api/v2/srm_university/academia-academic-services/report/Student_Profile_Report?urlParams=%7B%7D')).json(); } catch (err) { return null; }
        });

        if (profileData) {
            const stringified = JSON.stringify(profileData);
            const nameMatch = stringified.match(/"Name":"([^"]+)"/i) || stringified.match(/"Student_Name":"([^"]+)"/i);
            if (nameMatch && nameMatch[1]) {
                const parts = nameMatch[1].trim().split(/\s+/);
                realName = parts.length > 2 ? `${parts[0]} ${parts[1]}` : nameMatch[1].trim();
            }
        }
        
        console.log(`[HANDSHAKE] Success! Extracted Name: ${realName}`);
        await browser.close().catch(()=>{});
        return res.status(200).json({ success: true, realName: realName, isWrapperVerified: true });
        
    } catch (error) {
        console.error("[HANDSHAKE] FATAL ENGINE CRASH:", error.message);
        if (browser) await browser.close().catch(()=>{});
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

// ==========================================
// 2. THE DATA EXTRACTOR (Heavy Payload)
// ==========================================
app.post('/api/scrape', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, error: "Missing payload." });
    
    console.log(`\n=========================================`);
    console.log(`[SYNC ENGINE] Deep Extraction Initiated for: ${identifier}`);
    console.log(`=========================================`);
    
    let browser;
    try {
        console.log("[SYNC] Booting Native Chromium Engine...");
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/chromium', 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu', 
                '--no-first-run', 
                '--disable-site-isolation-trials', 
                '--window-size=1024,768', 
                '--disable-blink-features=AutomationControlled'
            ]
        });
        
        console.log("[SYNC] Engine Online. Opening Target...");
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');
        await page.setRequestInterception(true);
        page.on('request', (req) => { 
            ['image', 'media'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        console.log("[SYNC] Navigating the WAF bypass...");
        await page.goto('https://accounts.zoho.com/signin?servicename=ZohoCreator&serviceurl=https://creatorapp.zoho.com/srm_university/academia-academic-services/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        await page.waitForSelector('input[id="login_id"]', { timeout: 45000 });
        await page.type('input[id="login_id"]', identifier, { delay: 40 }); 
        await page.click('button[id="nextbtn"]');
        
        await page.waitForSelector('input[id="password"]', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000)); 
        await page.type('input[id="password"]', password, { delay: 40 });
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}), 
            page.click('button[id="nextbtn"]')
        ]);
        
        const pageContent = await page.content();
        if (pageContent.includes('Invalid Password') || pageContent.includes('INVALID_PASSWORD')) {
            console.log("[SYNC] Sync Failed: Incorrect Password.");
            await browser.close().catch(()=>{});
            return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        if (pageContent.includes('Terminate all other sessions')) {
            try { 
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }), 
                    page.evaluate(() => { 
                        const btns = Array.from(document.querySelectorAll('.blue_btn, button')); 
                        const termBtn = btns.find(b => b.textContent.includes('Terminate') || b.textContent.includes('Continue')); 
                        if (termBtn) termBtn.click(); 
                    })
                ]); 
            } catch (e) {}
        }

        console.log("[SYNC] Internal Dashboard Reached. Stabilizing context...");
        await new Promise(r => setTimeout(r, 5000));

        console.log("[SYNC] Injecting Data Extraction Scripts...");
        const extractedData = await page.evaluate(async () => {
            const data = { timetable: null, attendance: null };
            try {
                const ttRes = await fetch('https://creatorapp.zoho.com/api/v2/srm_university/academia-academic-services/report/Unified_Time_Table?urlParams=%7B%7D');
                data.timetable = await ttRes.json();
            } catch (e) {}
            
            try {
                const attRes = await fetch('https://creatorapp.zoho.com/api/v2/srm_university/academia-academic-services/report/Academic_Status?urlParams=%7B%7D');
                data.attendance = await attRes.json();
            } catch (e) {}
            
            return data;
        });

        console.log("[SYNC] Extraction Complete. Returning payload to Vercel.");
        await browser.close().catch(()=>{});
        
        return res.status(200).json({ success: true, data: extractedData });

    } catch (error) {
        console.error("[SYNC] FATAL ENGINE CRASH:", error.message);
        if (browser) await browser.close().catch(()=>{});
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[VM GATEWAY] Serditone Deep Scraper running on port ${PORT}`));
```

### Step 3: Restart & Monitor
```bash
pm2 flush
pm2 restart serditone-api
pm2 logs serditone-api
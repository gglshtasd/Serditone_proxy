const express = require('express');
const cors = require('cors');

// Deploying Stealth Modules
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Bulletproof Gateway" });
});

app.post('/api/handshake', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: "Missing payload requirements." });
    }

    console.log(`\n=========================================`);
    console.log(`[PUPPETEER] Booting Engine for: ${identifier}`);
    console.log(`=========================================`);
    
    let browser;
    let page;

    try {
        // EXTREME LOW-RAM CHROMIUM CONFIGURATION
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/chromium', 
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--single-process',        
                '--no-zygote',             
                '--no-first-run',
                '--disable-extensions',
                '--disable-site-isolation-trials', // MASSIVE RAM SAVER
                '--disable-features=IsolateOrigins,site-per-process', // Prevents Chrome from creating new memory processes
                '--js-flags="--max-old-space-size=256"', // Limits V8 JS Engine RAM
                '--window-size=1024,768',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        });

        // Aggressively block heavy resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            // RELAXED BLOCKING: We must allow stylesheets and scripts. If we block them, Zoho's WAF assumes we are a headless bot.
            if (['image', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("[PUPPETEER] Executing Public Route Bypass...");
        // THE GOLDILOCKS URL: 
        // Not the SRM landing page (freezes), and not the deep-link API (triggers the Roadblock).
        // This is the official public entry door that generates a fresh, trusted WAF session.
        await page.goto('https://accounts.zoho.com/signin?servicename=ZohoCreator&serviceurl=https://creatorapp.zoho.com/srm_university/academia-academic-services/', { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });

        console.log("[PUPPETEER] Waiting for Login Box...");
        
        // MICRO-CATCH: The X-Ray Trap for the Username Box
        try {
            await page.waitForSelector('input[id="login_id"]', { timeout: 45000 });
        } catch (selectorErr) {
            console.error("[PUPPETEER] ❌ FAILED TO FIND USERNAME BOX.");
            const htmlDump = await page.content();
            console.error("============= X-RAY HTML DUMP =============");
            console.error(htmlDump.substring(0, 1500)); 
            console.error("===========================================");
            throw new Error("Zoho WAF Blocked the login page or OS killed process.");
        }
        
        console.log("[PUPPETEER] Entering Identifier...");
        await page.type('input[id="login_id"]', identifier, { delay: 40 }); 
        await page.click('button[id="nextbtn"]');

        console.log("[PUPPETEER] Entering Password...");
        try {
            await page.waitForSelector('input[id="password"]', { timeout: 30000 });
        } catch (passErr) {
            console.error("[PUPPETEER] ❌ FAILED TO FIND PASSWORD BOX.");
            const htmlDump = await page.content();
            console.error(htmlDump.substring(0, 1000));
            throw new Error("Zoho intercepted midway.");
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); 
        await page.type('input[id="password"]', password, { delay: 40 });
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}),
            page.click('button[id="nextbtn"]')
        ]);

        console.log("[PUPPETEER] Analyzing Post-Login DOM State...");
        const pageContent = await page.content();

        if (pageContent.includes('Invalid Password') || pageContent.includes('INVALID_PASSWORD')) {
            console.log("[PUPPETEER] Rejected: Incorrect Password.");
            await browser.close();
            return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        if (pageContent.includes('Terminate all other sessions') || pageContent.includes('maximum active sessions')) {
            console.log("[PUPPETEER] Ghost Session Limit Detected! Terminating...");
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
                console.log("[PUPPETEER] Warning: Failed to click Terminate natively.");
            }
        }

        console.log("[PUPPETEER] Requesting Profile Database JSON...");
        const profileData = await page.evaluate(async () => {
            try {
                const response = await fetch('https://creatorapp.zoho.com/api/v2/srm_university/academia-academic-services/report/Student_Profile_Report?urlParams=%7B%7D');
                return await response.json();
            } catch (err) {
                return null;
            }
        });

        let realName = "Classified Operative";
        let isWrapperVerified = false;

        if (profileData) {
            const stringified = JSON.stringify(profileData);
            const nameMatch = stringified.match(/"Name":"([^"]+)"/i) || stringified.match(/"Student_Name":"([^"]+)"/i);
            
            if (nameMatch && nameMatch[1]) {
                const nameParts = nameMatch[1].trim().split(/\s+/);
                realName = nameParts.length > 2 ? `${nameParts[0]} ${nameParts[1]}` : nameMatch[1].trim();
                isWrapperVerified = true;
                console.log("[PUPPETEER] SUCCESS! Extracted Name:", realName);
            }
        }

        await browser.close();
        
        return res.status(200).json({
            success: true,
            realName: realName,
            isWrapperVerified: isWrapperVerified
        });

    } catch (error) {
        console.error("[PUPPETEER] Hard crash:", error.message);
        if (browser) await browser.close();
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`[VM GATEWAY] Serditone Bulletproof Gateway running on port ${PORT}`);
});

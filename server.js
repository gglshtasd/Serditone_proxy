const express = require('express');
const cors = require('cors');

// Deploying Stealth Modules
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// Proxy Health Check
app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Native Stealth Gateway" });
});

app.post('/api/handshake', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: "Missing payload requirements." });
    }

    console.log(`[PUPPETEER] Booting Stealth Engine for: ${identifier}`);
    let browser;
    let page;

    try {
        // Launch using the Native Debian Chromium binary with Stealth
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
                '--window-size=1280,800',
                '--disable-blink-features=AutomationControlled' // Extra WAF Evasion
            ]
        });

        page = await browser.newPage();
        
        // Advanced Anti-Bot Mimicry
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        });

        // Block images and CSS to save RAM, but allow scripts (Zoho needs JS to render the login page)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("[PUPPETEER] Navigating to Academia...");
        await page.goto('https://academia.srmist.edu.in/', { waitUntil: 'networkidle2', timeout: 35000 });

        // Step 1: Enter Username (Increased timeout to 20s to account for slow Zoho redirects)
        console.log("[PUPPETEER] Waiting for Zoho IAM Redirect...");
        await page.waitForSelector('input[id="login_id"]', { timeout: 20000 });
        
        console.log("[PUPPETEER] Entering Identifier...");
        await page.type('input[id="login_id"]', identifier, { delay: 65 }); // Human-like typing delay
        await page.click('button[id="nextbtn"]');

        // Step 2: Enter Password
        console.log("[PUPPETEER] Entering Password...");
        await page.waitForSelector('input[id="password"]', { timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 800)); 
        await page.type('input[id="password"]', password, { delay: 65 });
        
        // Wait for navigation after clicking sign in
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
            page.click('button[id="nextbtn"]')
        ]);

        console.log("[PUPPETEER] Analyzing Post-Login DOM State...");
        const pageContent = await page.content();

        // -----------------------------------------------------
        // ERROR HANDLING & GHOST SESSION TERMINATOR
        // -----------------------------------------------------
        if (pageContent.includes('Invalid Password') || pageContent.includes('INVALID_PASSWORD')) {
            console.log("[PUPPETEER] Rejected: Incorrect Password.");
            await browser.close();
            return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        if (pageContent.includes('Terminate all other sessions') || pageContent.includes('maximum active sessions')) {
            console.log("[PUPPETEER] Ghost Session Limit Detected! Clicking Terminate button...");
            try {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
                    page.evaluate(() => {
                        const btns = Array.from(document.querySelectorAll('.blue_btn, button'));
                        const termBtn = btns.find(b => b.textContent.includes('Terminate') || b.textContent.includes('Continue'));
                        if (termBtn) termBtn.click();
                    })
                ]);
            } catch (e) {
                console.log("[PUPPETEER] Warning: Failed to click Terminate button natively.");
            }
        }

        // -----------------------------------------------------
        // DATA EXTRACTION (The Profile API)
        // -----------------------------------------------------
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
        
        // THE DOM X-RAY: If we crash, dump the HTML so we can see what blocked us
        if (page) {
            try {
                const htmlDump = await page.content();
                console.error("============= X-RAY HTML DUMP =============");
                // We slice to 1000 characters so we don't flood the terminal, but enough to see the <title> or <body> error
                console.error(htmlDump.substring(0, 1000)); 
                console.error("===========================================");
            } catch (e) {
                console.error("Could not extract X-Ray HTML.");
            }
        }

        if (browser) await browser.close();
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`[VM GATEWAY] Serditone Stealth Gateway running on port ${PORT}`);
});
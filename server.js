const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// Azure Health Check
app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Azure Puppeteer Gateway" });
});

app.post('/api/handshake', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: "Missing payload requirements." });
    }

    console.log(`[PUPPETEER] Booting Headless Engine for: ${identifier}`);
    let browser;

    try {
        // Launch Headless Chrome heavily optimized for Azure F1 Free Tier (Low RAM Mode)
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Critical for Azure Linux containers
                '--disable-gpu',
                '--single-process',        // Forces Chrome to use 1 process (Saves massive RAM)
                '--no-zygote',             // Disables zygote fork (Saves RAM)
                '--no-first-run',
                '--disable-extensions',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        
        // Anti-Bot Mimicry
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        // Block images and CSS to save network bandwidth and RAM during the scrape
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("[PUPPETEER] Navigating to Academia...");
        await page.goto('https://academia.srmist.edu.in/', { waitUntil: 'networkidle2', timeout: 30000 });

        // Step 1: Enter Username
        console.log("[PUPPETEER] Entering Identifier...");
        await page.waitForSelector('input[id="login_id"]', { timeout: 10000 });
        await page.type('input[id="login_id"]', identifier, { delay: 50 });
        await page.click('button[id="nextbtn"]');

        // Step 2: Enter Password
        console.log("[PUPPETEER] Entering Password...");
        await page.waitForSelector('input[id="password"]', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 800)); // Human delay
        await page.type('input[id="password"]', password, { delay: 50 });
        
        // Wait for navigation after clicking sign in
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {}),
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
            // Click the Zoho UI button to kill other sessions
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
        
        // We execute a fetch request from INSIDE the authenticated browser console
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

        // Close browser immediately to free up Azure F1 RAM
        await browser.close();
        
        return res.status(200).json({
            success: true,
            realName: realName,
            isWrapperVerified: isWrapperVerified
        });

    } catch (error) {
        console.error("[PUPPETEER] Hard crash:", error.message);
        // Absolute fail-safe to prevent Zombie processes from eating all Azure RAM
        if (browser) await browser.close();
        return res.status(500).json({ success: false, error: "Azure Browser Engine Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;

// ============================================================================
// AZURE SELF-HEALING BOOT SEQUENCE
// Force downloads the Chrome binary into the container before starting Express
// ============================================================================
console.log("[AZURE] Verifying/Installing Chrome binary for the cloud environment...");
try {
    execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
    console.log("[AZURE] Chrome binary is ready.");
} catch (installError) {
    console.error("[AZURE] Warning: Failed to run browser install command:", installError.message);
}

app.listen(PORT, () => {
    console.log(`[AZURE] Serditone Puppeteer Gateway running on port ${PORT}`);
});
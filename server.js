const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Human Clicker & DOM Ripper" });
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
        console.log("[HANDSHAKE] Booting Native Chromium Engine (Incognito Mode)...");
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/chromium', 
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-first-run', '--disable-site-isolation-trials', 
                '--window-size=1280,800', '--disable-blink-features=AutomationControlled',
                '--incognito' // CRITICAL: Absolute amnesia
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');
        
        // Block images/media to save RAM, but let all scripts/fonts load for the UI
        await page.setRequestInterception(true);
        page.on('request', (req) => { 
            ['image', 'media', 'font'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        // -------------------------------------------------------------------
        // THE LOGIN STRIKE
        // -------------------------------------------------------------------
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

        if (pageContent.includes('Terminate all other sessions') || pageContent.includes('maximum active sessions')) {
            console.log("[HANDSHAKE] Ghost Session Limit Hit. Forcing termination...");
            try {
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('.blue_btn, button, input[type="button"]'));
                    const termBtn = btns.find(b => b.value === 'Continue' || (b.innerText && (b.innerText.includes('Continue') || b.innerText.includes('Terminate'))));
                    if (termBtn) termBtn.click();
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {
                console.log("[HANDSHAKE] Warning: Termination auto-clicker struggled.");
            }
        }

        // -------------------------------------------------------------------
        // VISUAL DOM RIPPER
        // -------------------------------------------------------------------
        console.log("[HANDSHAKE] WAF Bypassed. Waiting 8 seconds for React/Ember Dashboard to visually render...");
        await new Promise(r => setTimeout(r, 8000));
        
        console.log("[HANDSHAKE] 🕵️‍♂️ Executing Deep DOM visual scan for Name...");
        let realName = "Classified Operative";

        const extractedVisualName = await page.evaluate((regNo) => {
            let foundName = "";
            
            // 1. Check standard Zoho user profile DOM elements
            const userEl = document.querySelector('.zcSidenavUserName, .user-name, [data-zcqa="user_name"]');
            if (userEl && userEl.innerText) return userEl.innerText.trim();
            
            // 2. Aggressive DOM scan: Find the Register Number on screen, and grab surrounding text
            const elements = document.querySelectorAll('span, div, td, p, h1, h2, h3, h4');
            for(let el of elements) {
                if (el.innerText && el.innerText.toUpperCase().includes(regNo.toUpperCase())) {
                    let cleanText = el.innerText.replace(new RegExp(regNo, 'gi'), '').replace(/[^a-zA-Z\s]/g, '').trim();
                    cleanText = cleanText.replace(/Register Number|Student Name|Program|Branch|Welcome/gi, '').trim();
                    if(cleanText.length > 3 && cleanText.length < 40) {
                        return cleanText;
                    }
                }
            }
            return foundName;
        }, identifier.split('@')[0]);

        if (extractedVisualName) {
            realName = extractedVisualName;
            console.log(`[HANDSHAKE] Visual Scanner successful. Name found: ${realName}`);
        } else {
            console.log("[HANDSHAKE] Visual Scanner failed to find exact match. Defaulting to Classified Operative.");
            // Print out the first 200 characters of the page to see what loaded
            const debugText = await page.evaluate(() => document.body.innerText.substring(0, 200).replace(/\n/g, ' '));
            console.log(`[HANDSHAKE] Screen Contents Preview: ${debugText}`);
        }
        
        console.log(`[HANDSHAKE] Success! Final Assessed Name: ${realName}`);
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
    console.log(`[SYNC ENGINE] Human-Clicker Extraction Initiated for: ${identifier}`);
    console.log(`=========================================`);
    
    let browser;
    try {
        console.log("[SYNC] Booting Native Chromium Engine (Incognito Mode)...");
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/chromium', 
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-first-run', '--disable-site-isolation-trials', 
                '--window-size=1280,800', '--disable-blink-features=AutomationControlled',
                '--incognito'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        page.on('request', (req) => { 
            ['image', 'media', 'font'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        // -------------------------------------------------------------------
        // LOGIN & WAF BYPASS
        // -------------------------------------------------------------------
        console.log("[SYNC] Navigating to Zoho IAM Public Portal...");
        await page.goto('https://accounts.zoho.com/signin?servicename=ZohoCreator&serviceurl=https://creatorapp.zoho.com/srm_university/academia-academic-services/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log("[SYNC] Entering Identifier...");
        await page.waitForSelector('input[id="login_id"]', { timeout: 45000 });
        await page.type('input[id="login_id"]', identifier, { delay: 40 }); 
        await page.click('button[id="nextbtn"]');
        
        console.log("[SYNC] Entering Password...");
        await page.waitForSelector('input[id="password"]', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000)); 
        await page.type('input[id="password"]', password, { delay: 40 });
        
        console.log("[SYNC] Executing Strike...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}), 
            page.click('button[id="nextbtn"]')
        ]);
        
        const pageContent = await page.content();
        if (pageContent.includes('Invalid Password') || pageContent.includes('INVALID_PASSWORD')) {
            console.log("[SYNC] Strike Failed: Incorrect Password.");
            await browser.close().catch(()=>{});
            return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        if (pageContent.includes('Terminate all other sessions') || pageContent.includes('maximum active sessions')) {
            console.log("[SYNC] Ghost Session Limit Hit. Forcing termination...");
            try { 
                await page.evaluate(() => { 
                    const btns = Array.from(document.querySelectorAll('.blue_btn, button, input[type="button"]')); 
                    const termBtn = btns.find(b => b.value === 'Continue' || (b.innerText && (b.innerText.includes('Continue') || b.innerText.includes('Terminate')))); 
                    if (termBtn) termBtn.click(); 
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {}
        }

        console.log("[SYNC] WAF Bypassed. Waiting 6 seconds for initial Dashboard render...");
        await new Promise(r => setTimeout(r, 6000));

        let extractedData = { timetableHtml: null, attendanceHtml: null, logs: [] };

        // -------------------------------------------------------------------
        // PROTOCOL 1: HUMAN CLICK & RIP (TIMETABLE)
        // -------------------------------------------------------------------
        console.log("[SYNC] 🖱️ Hunting for 'Time Table' button...");
        const clickedTT = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, span, div, li, p'));
            // Find any element containing the words
            const target = elements.find(el => el.innerText && (el.innerText.includes('Time Table') || el.innerText.includes('Unified Time')));
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (clickedTT) {
            console.log("[SYNC] 'Time Table' clicked! Waiting 6 seconds for page to load...");
            extractedData.logs.push("Timetable button clicked.");
            await new Promise(r => setTimeout(r, 6000)); // Wait for visual render
            
            console.log("[SYNC] Ripping HTML from screen...");
            extractedData.timetableHtml = await page.evaluate(() => {
                // Grab the largest table on the screen, or fallback to the main body text
                const table = document.querySelector('table');
                return table ? table.outerHTML : document.body.innerText.substring(0, 5000);
            });
            console.log(`[SYNC] Timetable Rip Success: ${extractedData.timetableHtml.substring(0, 100).replace(/\n/g, '')}...`);
        } else {
            console.log("[SYNC] ❌ Could not find 'Time Table' button on screen.");
            extractedData.logs.push("Timetable button NOT FOUND.");
        }

        // -------------------------------------------------------------------
        // PROTOCOL 2: HUMAN CLICK & RIP (ATTENDANCE)
        // -------------------------------------------------------------------
        console.log("[SYNC] 🖱️ Hunting for 'Academic Status / Attendance' button...");
        const clickedAtt = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, span, div, li, p'));
            const target = elements.find(el => el.innerText && (el.innerText.includes('Academic Status') || el.innerText.includes('Attendance')));
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (clickedAtt) {
            console.log("[SYNC] 'Attendance' clicked! Waiting 6 seconds for page to load...");
            extractedData.logs.push("Attendance button clicked.");
            await new Promise(r => setTimeout(r, 6000));
            
            console.log("[SYNC] Ripping HTML from screen...");
            extractedData.attendanceHtml = await page.evaluate(() => {
                const table = document.querySelector('table');
                return table ? table.outerHTML : document.body.innerText.substring(0, 5000);
            });
            console.log(`[SYNC] Attendance Rip Success: ${extractedData.attendanceHtml.substring(0, 100).replace(/\n/g, '')}...`);
        } else {
            console.log("[SYNC] ❌ Could not find 'Attendance' button on screen.");
            extractedData.logs.push("Attendance button NOT FOUND.");
        }

        console.log(`\n[SYNC] --- MISSION REPORT ---`);
        console.log(`[SYNC] Timetable HTML Extracted: ${extractedData.timetableHtml ? "YES" : "NO"}`);
        console.log(`[SYNC] Attendance HTML Extracted: ${extractedData.attendanceHtml ? "YES" : "NO"}`);
        console.log(`[SYNC] ----------------------\n`);

        console.log("[SYNC] Extraction Complete. Returning payload to Vercel.");
        await browser.close().catch(()=>{});
        
        // Pass the raw text/HTML strings back to Vercel. We map it to "timetable" and "attendance" 
        // so your Vercel database accepts it as valid JSON strings.
        return res.status(200).json({ 
            success: true, 
            data: {
                timetable: extractedData.timetableHtml || "NO_DATA",
                attendance: extractedData.attendanceHtml || "NO_DATA",
                diagnostics: extractedData.logs
            } 
        });

    } catch (error) {
        console.error("[SYNC] FATAL ENGINE CRASH:", error.message);
        if (browser) await browser.close().catch(()=>{});
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[VM GATEWAY] Serditone Deep Scraper running on port ${PORT}`));
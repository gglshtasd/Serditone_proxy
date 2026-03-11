
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.status(200).json({ status: "Active", service: "Serditone Scraper" }));

// ==========================================
// THE UNIFIED MULTI-LAYER DATA EXTRACTOR
// ==========================================
app.post('/api/scrape', async (req, res) => {
    // mode: 'full' (Timetable + Attendance) OR 'sync' (Attendance only)
    const { identifier, password, mode = 'full' } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, error: "Missing payload." });
    
    console.log(`\n=========================================`);
    console.log(`[SYNC ENGINE] Mode: [${mode.toUpperCase()}] Initiated for: ${identifier}`);
    console.log(`=========================================`);
    
    let browser;
    try {
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
        await page.setBypassCSP(true);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        page.on('request', (req) => { 
            ['image', 'media', 'font'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        console.log("[SYNC ENGINE] Navigating to Zoho IAM Public Portal...");
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
        if (pageContent.includes('Invalid Password')) {
            await browser.close().catch(()=>{});
            return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        // Ghost Session Cleaner
        if (pageContent.includes('Terminate all other sessions')) {
            console.log("[SYNC ENGINE] Ghost Session trap detected. Terminating old sessions...");
            try { 
                await page.evaluate(() => { 
                    const btns = Array.from(document.querySelectorAll('.blue_btn, button, input[type="button"]')); 
                    const termBtn = btns.find(b => b.value === 'Continue' || (b.innerText && b.innerText.includes('Continue'))); 
                    if (termBtn) termBtn.click(); 
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {}
        }

        console.log("[SYNC ENGINE] Login successful. Waiting for Dashboard Hydration...");
        await new Promise(r => setTimeout(r, 6000));
        
        let extractedData = { timetableHtml: null, attendanceHtml: null, logs: [] };

        // -------------------------------------------------------------------
        // EXTRACTION PROTOCOL: TIMETABLE (Only if mode === 'full')
        // -------------------------------------------------------------------
        if (mode === 'full') {
            console.log("\n[SYNC - TIMETABLE] Initiating DOM Traversal...");
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a, span, div'));
                const target = links.find(l => l.innerText && (l.innerText.includes('My Time Table') || l.innerText.includes('Unified Time')));
                if (target) target.click();
                else window.location.hash = '#Page:My_Time_Table_2023_24'; // Fallback Hash
            });

            console.log("[SYNC - TIMETABLE] Waiting explicitly for table.course_tbl...");
            try {
                // EXPLICIT WAIT: This prevents the 8000 byte skeleton rip
                await page.waitForSelector('table.course_tbl', { timeout: 15000 });
                const html = await page.evaluate(() => document.body.innerHTML);
                extractedData.timetableHtml = html;
                extractedData.logs.push("Timetable: Successful Exact Render Rip.");
                console.log(`[SYNC - TIMETABLE] SUCCESS. Ripped exact DOM.`);
            } catch (err) {
                console.log("[SYNC - TIMETABLE] FAILED. Target table did not mount in time.");
                extractedData.logs.push("Timetable: Failed to mount.");
            }
        }

        // -------------------------------------------------------------------
        // EXTRACTION PROTOCOL: ATTENDANCE (Always run)
        // -------------------------------------------------------------------
        console.log("\n[SYNC - ATTENDANCE] Initiating DOM Traversal...");
        await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, span, div'));
            const target = links.find(l => l.innerText && (l.innerText.includes('Academic Status') || l.innerText.includes('My Attendance')));
            if (target) target.click();
            else window.location.hash = '#Page:My_Attendance'; // Fallback Hash
        });

        console.log("[SYNC - ATTENDANCE] Waiting explicitly for table[bgcolor='#FAFAD2']...");
        try {
            await page.waitForSelector('table[bgcolor="#FAFAD2"]', { timeout: 15000 });
            const html = await page.evaluate(() => document.body.innerHTML);
            extractedData.attendanceHtml = html;
            extractedData.logs.push("Attendance: Successful Exact Render Rip.");
            console.log(`[SYNC - ATTENDANCE] SUCCESS. Ripped exact DOM.`);
        } catch (err) {
            console.log("[SYNC - ATTENDANCE] FAILED. Target table did not mount in time.");
            extractedData.logs.push("Attendance: Failed to mount.");
        }

        console.log(`\n[SYNC ENGINE] Extraction Complete. Closing Headless Browser.`);
        await browser.close().catch(()=>{});
        
        return res.status(200).json({ 
            success: true, 
            data: {
                timetable: extractedData.timetableHtml || "NO_DATA",
                attendance: extractedData.attendanceHtml || "NO_DATA",
                diagnostics: extractedData.logs
            } 
        });

    } catch (error) {
        if (browser) await browser.close().catch(()=>{});
        console.error("[SYNC ENGINE] FATAL CRASH:", error.message);
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[VM GATEWAY] Serditone Deep Scraper running on port ${PORT}`));
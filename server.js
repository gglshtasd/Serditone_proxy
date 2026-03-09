const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Dragnet Wiretap Gateway" });
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
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-first-run', '--disable-site-isolation-trials', 
                '--window-size=1280,800', '--disable-blink-features=AutomationControlled'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');
        
        let realName = "Classified Operative";
        let isProfileIntercepted = false;

        // -------------------------------------------------------------------
        // THE DRAGNET WIRETAP (Passive Network Interception)
        // -------------------------------------------------------------------
        console.log("[HANDSHAKE] 🕵️‍♂️ Dragnet Wiretap engaged. Listening to Network Stream...");
        await page.setRequestInterception(true);
        
        page.on('response', async (response) => {
            if (isProfileIntercepted) return; // Stop if we already got it
            
            const req = response.request();
            if (req.method() === 'OPTIONS') return; // Ignore preflight checks

            const type = req.resourceType();
            if (type === 'xhr' || type === 'fetch') {
                try {
                    const text = await response.text();
                    // Does this JSON payload contain the student's ID or Name?
                    const regNo = identifier.split('@')[0].toUpperCase();
                    if (text.includes('"Name":') || text.includes('"Student_Name":') || text.includes(regNo)) {
                        
                        const match = text.match(/"Name":"([^"]+)"/i) || text.match(/"Student_Name":"([^"]+)"/i);
                        if (match && match[1]) {
                            const parts = match[1].trim().split(/\s+/);
                            realName = parts.length > 2 ? `${parts[0]} ${parts[1]}` : match[1].trim();
                            isProfileIntercepted = true;
                            console.log(`\n[WIRETAP] 🚨 TARGET ACQUIRED FROM MID-AIR! Name: ${realName}\n`);
                        }
                    }
                } catch (e) { /* Ignore non-JSON/binary network traffic */ }
            }
        });

        // Continue normal request traffic
        page.on('request', (req) => { 
            ['image', 'media'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        // -------------------------------------------------------------------
        // THE LOGIN STRIKE
        // -------------------------------------------------------------------
        console.log("[HANDSHAKE] Navigating to Zoho IAM Public Portal...");
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
            } catch (e) { }
        }

        // -------------------------------------------------------------------
        // VISUAL NAVIGATION & WIRE SNIFFING
        // -------------------------------------------------------------------
        console.log("[HANDSHAKE] WAF Bypassed. Visually loading Student Profile Dashboard...");
        
        // Drive visually to the specific profile component hash. Zoho's JS will naturally fetch the data.
        await page.goto('https://creatorapp.zoho.com/srm_university/academia-academic-services/#Report:Student_Profile_Report', { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        console.log("[HANDSHAKE] Waiting up to 15 seconds for Zoho's internal scripts to trigger the Wiretap...");
        let waitLoops = 0;
        
        while (!isProfileIntercepted && waitLoops < 15) {
            await new Promise(r => setTimeout(r, 1000));
            waitLoops++;
            
            // EDGE CASE FIX: If 5 seconds pass and no data flies by, forcefully click the sidebar to trigger it
            if (waitLoops === 5) {
                console.log("[HANDSHAKE] Network quiet. Executing DOM Fallback Clicker...");
                await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a, span, div, li'));
                    const profileBtn = links.find(l => l.innerText && (l.innerText.includes('Profile') || l.innerText.includes('Student')));
                    if (profileBtn) profileBtn.click();
                    else window.location.hash = '#Report:Student_Profile_Report';
                });
            }
        }

        if (!isProfileIntercepted) {
            console.log("[HANDSHAKE] WARNING: Wiretap timed out. Profile payload never crossed the network. Using default name.");
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
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-first-run', '--disable-site-isolation-trials', 
                '--window-size=1280,800', '--disable-blink-features=AutomationControlled'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');
        
        let timetableRaw = null;
        let attendanceRaw = null;

        // -------------------------------------------------------------------
        // THE DRAGNET WIRETAP
        // -------------------------------------------------------------------
        console.log("[SYNC] 🕵️‍♂️ Dragnet Wiretap engaged. Monitoring for Timetable & Attendance payloads...");
        await page.setRequestInterception(true);
        
        page.on('response', async (response) => {
            const req = response.request();
            if (req.method() === 'OPTIONS') return;

            const type = req.resourceType();
            if (type === 'xhr' || type === 'fetch') {
                try {
                    const text = await response.text();
                    
                    // Is this the Timetable?
                    if (!timetableRaw && (text.includes('Unified_Time_Table') || text.includes('Day_Order') || text.includes('Class_Timing'))) {
                        timetableRaw = text;
                        console.log(`\n[WIRETAP] 🚨 TIMETABLE INTERCEPTED! (${text.length} bytes)`);
                        console.log(`[WIRETAP] Preview: ${text.substring(0, 100).replace(/\n/g, '')}...`);
                    }
                    
                    // Is this the Attendance?
                    if (!attendanceRaw && (text.includes('Academic_Status') || text.includes('Attendance_Percentage') || text.includes('Present'))) {
                        attendanceRaw = text;
                        console.log(`\n[WIRETAP] 🚨 ATTENDANCE INTERCEPTED! (${text.length} bytes)`);
                        console.log(`[WIRETAP] Preview: ${text.substring(0, 100).replace(/\n/g, '')}...`);
                    }
                } catch (e) { /* ignore binary/image intercepts */ }
            }
        });

        page.on('request', (req) => { 
            ['image', 'media'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        // -------------------------------------------------------------------
        // LOGIN & WAF BYPASS
        // -------------------------------------------------------------------
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

        console.log("[SYNC] WAF Bypassed. Executing Visual Navigation Protocols...");

        // -------------------------------------------------------------------
        // PROTOCOL 1: HUNT THE TIMETABLE
        // -------------------------------------------------------------------
        console.log("[SYNC] Navigating to Timetable Visual Interface...");
        await page.goto('https://creatorapp.zoho.com/srm_university/academia-academic-services/#Report:Unified_Time_Table', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        let ttWait = 0;
        while (!timetableRaw && ttWait < 15) {
            await new Promise(r => setTimeout(r, 1000));
            ttWait++;
            if (ttWait === 5) {
                console.log("[SYNC] Network quiet. Executing DOM Fallback Clicker for Timetable...");
                await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a, span, div, li'));
                    const ttLink = links.find(l => l.innerText && l.innerText.includes('Time Table'));
                    if (ttLink) ttLink.click();
                });
            }
        }

        // -------------------------------------------------------------------
        // PROTOCOL 2: HUNT THE ATTENDANCE
        // -------------------------------------------------------------------
        console.log("[SYNC] Navigating to Attendance Visual Interface...");
        await page.goto('https://creatorapp.zoho.com/srm_university/academia-academic-services/#Report:Academic_Status', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        let attWait = 0;
        while (!attendanceRaw && attWait < 15) {
            await new Promise(r => setTimeout(r, 1000));
            attWait++;
            if (attWait === 5) {
                console.log("[SYNC] Network quiet. Executing DOM Fallback Clicker for Attendance...");
                await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a, span, div, li'));
                    const attLink = links.find(l => l.innerText && (l.innerText.includes('Academic Status') || l.innerText.includes('Attendance')));
                    if (attLink) attLink.click();
                });
            }
        }

        console.log(`\n[SYNC] --- MISSION REPORT ---`);
        console.log(`[SYNC] Timetable Captured: ${timetableRaw ? "YES" : "NO"}`);
        console.log(`[SYNC] Attendance Captured: ${attendanceRaw ? "YES" : "NO"}`);
        console.log(`[SYNC] ----------------------\n`);

        let extractedData = { timetable: null, attendance: null };
        try { if (timetableRaw) extractedData.timetable = JSON.parse(timetableRaw); } catch(e) { console.log("[SYNC] Timetable JSON Parse Failed."); }
        try { if (attendanceRaw) extractedData.attendance = JSON.parse(attendanceRaw); } catch(e) { console.log("[SYNC] Attendance JSON Parse Failed."); }

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
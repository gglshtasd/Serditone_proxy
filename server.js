const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Multi-Layer Scraper" });
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
            await browser.close().catch(()=>{});
            return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        if (pageContent.includes('Terminate all other sessions')) {
            console.log("[HANDSHAKE] Ghost Session trap detected. Terminating old sessions...");
            try {
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('.blue_btn, button, input[type="button"]'));
                    const termBtn = btns.find(b => b.value === 'Continue' || (b.innerText && (b.innerText.includes('Continue') || b.innerText.includes('Terminate'))));
                    if (termBtn) termBtn.click();
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {}
        }

        await new Promise(r => setTimeout(r, 6000));

        // Fixed Identity Extractor
        const extractedVisualName = await page.evaluate(() => {
            const userEl = document.querySelector('.navbar_user_name, .zcSidenavUserName, .user-name');
            if (userEl && userEl.innerText) {
                let name = userEl.innerText.trim();
                if (!name.includes('@srmist') && !name.includes('Change') && name.length > 2) {
                    return name;
                }
            }
            return "Classified Operative";
        });
        
        console.log(`[HANDSHAKE] Success. Operator parsed as: ${extractedVisualName}`);
        await browser.close().catch(()=>{});
        return res.status(200).json({ success: true, realName: extractedVisualName, isWrapperVerified: true });
        
    } catch (error) {
        if (browser) await browser.close().catch(()=>{});
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

// ==========================================
// 2. THE MULTI-LAYER DATA EXTRACTOR
// ==========================================
app.post('/api/scrape', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, error: "Missing payload." });
    
    console.log(`\n=========================================`);
    console.log(`[SYNC ENGINE] Extraction Initiated for: ${identifier}`);
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

        if (pageContent.includes('Terminate all other sessions')) {
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
        // EXTRACTION PROTOCOL: TIMETABLE
        // -------------------------------------------------------------------
        console.log("\n[SYNC - TIMETABLE] Initiating Layer 1: UI DOM Click...");
        let ttStatus = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, span, div, li, p'));
            const target = elements.find(el => el.innerText && (el.innerText.includes('Time Table') || el.innerText.includes('Unified Time')));
            if (target) { target.click(); return "CLICKED"; }
            return "NOT_FOUND";
        });
        
        if (ttStatus === "CLICKED") {
            await new Promise(r => setTimeout(r, 5000)); // Wait for render
            const html = await page.evaluate(() => document.querySelector('table.course_tbl') ? document.querySelector('table.course_tbl').outerHTML : null);
            if (html) {
                console.log(`[SYNC - TIMETABLE] Layer 1 SUCCESS. Extracted ${html.length} bytes.`);
                extractedData.timetableHtml = html;
                extractedData.logs.push("Timetable: Layer 1 (UI Click) Success.");
            } else {
                console.log("[SYNC - TIMETABLE] Layer 1 FAILED (Click worked, but table did not render). Moving to Layer 2.");
                ttStatus = "FAILED_RENDER";
            }
        } else {
            console.log("[SYNC - TIMETABLE] Layer 1 FAILED (Button hidden). Moving to Layer 2.");
        }

        if (!extractedData.timetableHtml) {
            console.log("[SYNC - TIMETABLE] Initiating Layer 2: Strict SPA Hash Injection...");
            await page.evaluate(() => { window.location.hash = '#Page:My_Time_Table_2025_26_EVEN'; });
            await new Promise(r => setTimeout(r, 6000));
            
            const html = await page.evaluate(() => document.querySelector('table.course_tbl') ? document.querySelector('table.course_tbl').outerHTML : null);
            if (html) {
                console.log(`[SYNC - TIMETABLE] Layer 2 SUCCESS. Extracted ${html.length} bytes.`);
                extractedData.timetableHtml = html;
                extractedData.logs.push("Timetable: Layer 2 (Strict Hash) Success.");
            } else {
                console.log("[SYNC - TIMETABLE] Layer 2 FAILED. Moving to Layer 3 (Broad Rip).");
                await page.evaluate(() => { window.location.hash = '#Page:My_Time_Table'; });
                await new Promise(r => setTimeout(r, 6000));
                
                const broadHtml = await page.evaluate(() => {
                    const tbl = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Course Code'));
                    return tbl ? tbl.outerHTML : document.body.innerHTML.substring(0, 8000);
                });
                console.log(`[SYNC - TIMETABLE] Layer 3 EXECUTED. Ripped ${broadHtml.length} bytes.`);
                extractedData.timetableHtml = broadHtml;
                extractedData.logs.push("Timetable: Layer 3 (Broad Rip) Executed.");
            }
        }


        // -------------------------------------------------------------------
        // EXTRACTION PROTOCOL: ATTENDANCE
        // -------------------------------------------------------------------
        console.log("\n[SYNC - ATTENDANCE] Initiating Layer 1: UI DOM Click...");
        let attStatus = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, span, div, li, p'));
            const target = elements.find(el => el.innerText && (el.innerText.includes('Academic Status') || el.innerText.includes('Attendance')));
            if (target) { target.click(); return "CLICKED"; }
            return "NOT_FOUND";
        });

        if (attStatus === "CLICKED") {
            await new Promise(r => setTimeout(r, 5000));
            const html = await page.evaluate(() => document.querySelector('table[bgcolor="#FAFAD2"]') ? document.querySelector('table[bgcolor="#FAFAD2"]').outerHTML : null);
            if (html) {
                console.log(`[SYNC - ATTENDANCE] Layer 1 SUCCESS. Extracted ${html.length} bytes.`);
                extractedData.attendanceHtml = html;
                extractedData.logs.push("Attendance: Layer 1 (UI Click) Success.");
            } else {
                console.log("[SYNC - ATTENDANCE] Layer 1 FAILED (Click worked, table missing). Moving to Layer 2.");
                attStatus = "FAILED_RENDER";
            }
        } else {
            console.log("[SYNC - ATTENDANCE] Layer 1 FAILED (Button hidden). Moving to Layer 2.");
        }

        if (!extractedData.attendanceHtml) {
            console.log("[SYNC - ATTENDANCE] Initiating Layer 2: SPA Hash Injection...");
            await page.evaluate(() => { window.location.hash = '#Page:My_Attendance'; });
            await new Promise(r => setTimeout(r, 6000));
            
            const html = await page.evaluate(() => {
                const tbl = document.querySelector('table[bgcolor="#FAFAD2"]') || Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Hours Conducted'));
                return tbl ? tbl.outerHTML : document.body.innerHTML.substring(0, 8000);
            });
            
            console.log(`[SYNC - ATTENDANCE] Layer 2/3 EXECUTED. Ripped ${html.length} bytes.`);
            extractedData.attendanceHtml = html;
            extractedData.logs.push("Attendance: Layer 2/3 (Hash/Broad Rip) Executed.");
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
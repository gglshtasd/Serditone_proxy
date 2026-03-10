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
                '--incognito'
            ]
        });
        
        const page = await browser.newPage();
        await page.setBypassCSP(true); // NEUTRALIZE ZOHO'S CONTENT SECURITY POLICY
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
            try {
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('.blue_btn, button, input[type="button"]'));
                    const termBtn = btns.find(b => b.value === 'Continue' || (b.innerText && (b.innerText.includes('Continue') || b.innerText.includes('Terminate'))));
                    if (termBtn) termBtn.click();
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {}
        }

        await new Promise(r => setTimeout(r, 8000));
        let realName = "Classified Operative";

        const extractedVisualName = await page.evaluate((regNo) => {
            let foundName = "";
            const userEl = document.querySelector('.zcSidenavUserName, .user-name, [data-zcqa="user_name"]');
            if (userEl && userEl.innerText) return userEl.innerText.trim();
            
            const elements = document.querySelectorAll('span, div, td, p, h1, h2, h3, h4');
            for(let el of elements) {
                if (el.innerText && el.innerText.toUpperCase().includes(regNo.toUpperCase())) {
                    let cleanText = el.innerText.replace(new RegExp(regNo, 'gi'), '').replace(/[^a-zA-Z\s]/g, '').trim();
                    cleanText = cleanText.replace(/Register Number|Student Name|Program|Branch|Welcome/gi, '').trim();
                    if(cleanText.length > 3 && cleanText.length < 40) return cleanText;
                }
            }
            return foundName;
        }, identifier.split('@')[0]);

        if (extractedVisualName) realName = extractedVisualName;
        
        await browser.close().catch(()=>{});
        return res.status(200).json({ success: true, realName: realName, isWrapperVerified: true });
        
    } catch (error) {
        if (browser) await browser.close().catch(()=>{});
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

// ==========================================
// 2. THE DATA EXTRACTOR (Hash Routing Fallback)
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

        await new Promise(r => setTimeout(r, 6000));
        let extractedData = { timetableHtml: null, attendanceHtml: null, logs: [] };

        // -------------------------------------------------------------------
        // TIMETABLE EXTRACTION
        // -------------------------------------------------------------------
        const clickedTT = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, span, div, li, p'));
            const target = elements.find(el => el.innerText && (el.innerText.includes('Time Table') || el.innerText.includes('Unified Time')));
            if (target) { target.click(); return true; }
            return false;
        });

        if (clickedTT) {
            extractedData.logs.push("Timetable button clicked.");
            await new Promise(r => setTimeout(r, 6000)); 
            extractedData.timetableHtml = await page.evaluate(() => document.querySelector('table') ? document.querySelector('table').outerHTML : document.body.innerText.substring(0, 5000));
        } else {
            console.log("[SYNC] ⚠️ UI Click Failed. LAST OPTION: Scrape HTML by forcing SPA Hash Routing...");
            extractedData.logs.push("UI Click Failed. Triggering Hash Fallback (Timetable).");
            await page.evaluate(() => {
                const ttLink = Array.from(document.querySelectorAll('a')).find(a => a.href && a.href.includes('#Page:My_Time_Table'));
                window.location.hash = ttLink ? (ttLink.getAttribute('href').split('#')[1] || ttLink.getAttribute('href')) : '#Page:My_Time_Table_2025_26_EVEN';
            });
            await new Promise(r => setTimeout(r, 6000));
            extractedData.timetableHtml = await page.evaluate(() => document.querySelector('table.course_tbl') ? document.querySelector('table.course_tbl').outerHTML : document.body.innerHTML.substring(0, 5000));
        }

        // -------------------------------------------------------------------
        // ATTENDANCE EXTRACTION
        // -------------------------------------------------------------------
        const clickedAtt = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, span, div, li, p'));
            const target = elements.find(el => el.innerText && (el.innerText.includes('Academic Status') || el.innerText.includes('Attendance')));
            if (target) { target.click(); return true; }
            return false;
        });

        if (clickedAtt) {
            extractedData.logs.push("Attendance button clicked.");
            await new Promise(r => setTimeout(r, 6000));
            extractedData.attendanceHtml = await page.evaluate(() => document.querySelector('table') ? document.querySelector('table').outerHTML : document.body.innerText.substring(0, 5000));
        } else {
            console.log("[SYNC] ⚠️ UI Click Failed. LAST OPTION: Scrape HTML by forcing SPA Hash Routing...");
            extractedData.logs.push("UI Click Failed. Triggering Hash Fallback (Attendance).");
            await page.evaluate(() => { window.location.hash = '#Page:My_Attendance'; });
            await new Promise(r => setTimeout(r, 6000));
            extractedData.attendanceHtml = await page.evaluate(() => {
                const table = document.querySelector('table[bgcolor="#FAFAD2"]') || document.querySelector('table');
                return table ? table.outerHTML : document.body.innerHTML.substring(0, 5000);
            });
        }

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
        return res.status(500).json({ success: false, error: "VM Browser Engine Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[VM GATEWAY] Serditone Deep Scraper running on port ${PORT}`));
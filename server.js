const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// IN-MEMORY JOB STORE (Holds data until Vercel retrieves it)
const activeJobs = new Map();

function generateJobId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
}

function appendLog(jobId, message) {
    console.log(`[JOB ${jobId}] ${message}`);
    const job = activeJobs.get(jobId);
    if (job) job.logs.push(message);
}

app.get('/', (req, res) => res.status(200).json({ status: "Active", service: "Serditone Async Scraper" }));

// ==========================================
// 1. KICKOFF THE SCRAPE (Non-Blocking)
// ==========================================
app.post('/api/scrape/start', (req, res) => {
    const { identifier, password, mode = 'full' } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, error: "Missing payload." });
    
    const jobId = generateJobId();
    activeJobs.set(jobId, { status: 'pending', mode, identifier, logs: [], data: null, error: null });
    
    appendLog(jobId, `Scrape Job Initiated for: ${identifier} (Mode: ${mode})`);
    
    processJob(jobId, identifier, password, mode);
    
    return res.status(202).json({ success: true, jobId });
});

// ==========================================
// 2. POLL FOR STATUS & LOGS
// ==========================================
app.get('/api/scrape/status/:jobId', (req, res) => {
    const job = activeJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: "Job not found or expired." });
    
    return res.status(200).json({
        status: job.status,
        logs: job.logs,
        data: job.data,
        error: job.error
    });
});

// ==========================================
// 3. CORE EXTRACTION (HUMAN SIMULATION TRAVERSAL)
// ==========================================
async function processJob(jobId, identifier, password, mode) {
    let browser;
    try {
        appendLog(jobId, `Booting Native Chromium Engine (Incognito)...`);
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/chromium', 
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-first-run', '--disable-site-isolation-trials', 
                '--window-size=1366,768', '--disable-blink-features=AutomationControlled',
                '--incognito'
            ]
        });
        
        const page = await browser.newPage();
        await page.setBypassCSP(true);
        // Using a modern, full Desktop User Agent to ensure Desktop UI loads
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Strip media to save Azure Egress bandwidth
        await page.setRequestInterception(true);
        page.on('request', (req) => { 
            ['image', 'media', 'font'].includes(req.resourceType()) ? req.abort() : req.continue(); 
        });

        appendLog(jobId, `Navigating to Zoho IAM Portal...`);
        await page.goto('https://accounts.zoho.com/signin?servicename=ZohoCreator&serviceurl=https://creatorapp.zoho.com/srm_university/academia-academic-services/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        appendLog(jobId, `Typing Username...`);
        await page.waitForSelector('input[id="login_id"]', { timeout: 45000 });
        await page.type('input[id="login_id"]', identifier, { delay: 40 }); 
        await page.click('button[id="nextbtn"]');
        
        appendLog(jobId, `Typing Password...`);
        await page.waitForSelector('input[id="password"]', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000)); 
        await page.type('input[id="password"]', password, { delay: 40 });
        
        appendLog(jobId, `Executing Login Handshake...`);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}), 
            page.click('button[id="nextbtn"]')
        ]);

        const pageContent = await page.content();
        if (pageContent.includes('Invalid Password')) throw new Error("Incorrect Academia Password.");

        // Ghost Session Cleaner
        if (pageContent.includes('Terminate all other sessions')) {
            appendLog(jobId, `Ghost Session Trap detected. Terminating old sessions...`);
            try { 
                await page.evaluate(() => { 
                    const btns = Array.from(document.querySelectorAll('.blue_btn, button, input[type="button"]')); 
                    const termBtn = btns.find(b => b.value === 'Continue' || (b.innerText && b.innerText.includes('Continue'))); 
                    if (termBtn) termBtn.click(); 
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            } catch (e) {}
        }

        appendLog(jobId, `Login successful. Waiting for React/Ember Dashboard Hydration...`);
        await new Promise(r => setTimeout(r, 6000)); // Crucial hydration wait
        
        let timetableHtml = null;
        let attendanceHtml = null;

        // --- LAYER 1: SPA NATIVE HYDRATION (Based on LAYOUT.txt) ---
        appendLog(jobId, `Locating 'My Time Table & Attendance' Dropdown...`);
        
        try {
            // Wait for the exact ID from LAYOUT.txt to exist in the DOM
            await page.waitForSelector('#tab_My_Time_Table_Attendance', { timeout: 15000 });
            
            // Simulating a real human: Hover first, then click
            appendLog(jobId, `Simulating Human Hover & Click on Dropdown...`);
            await page.hover('#tab_My_Time_Table_Attendance');
            await new Promise(r => setTimeout(r, 500)); // Let the hover CSS trigger
            await page.click('#tab_My_Time_Table_Attendance');
            
            // Wait for the slide-down animation of the sub-menu to complete
            await new Promise(r => setTimeout(r, 1500)); 
        } catch (e) {
            appendLog(jobId, `Native Dropdown Interaction Failed. Attempting JS Injection Fallback...`);
            await page.evaluate(() => {
                const tab = document.getElementById('tab_My_Time_Table_Attendance');
                if (tab) tab.click();
            });
            await new Promise(r => setTimeout(r, 1500));
        }

        // --- TIMETABLE EXTRACTION ---
        if (mode === 'full') {
            appendLog(jobId, `Selecting 'My Time Table' sub-menu...`);
            
            try {
                // We use JS click here because the ID changes every year (My_Time_Table_2023_24 vs My_Time_Table_2025_26)
                // LAYOUT.txt confirms it always contains "My_Time_Table"
                await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    const target = links.find(l => 
                        (l.id && l.id.includes('My_Time_Table')) || 
                        (l.innerText && l.innerText.includes('My Time Table'))
                    );
                    if (target) {
                        target.click();
                    } else {
                        // Ultimate fallback
                        window.location.hash = '#Page:My_Time_Table_2023_24'; 
                    }
                });

                appendLog(jobId, `Polling DOM for Timetable Arrays...`);
                // Layer 3 Failsafe: Try/Catch the waiter so we don't crash
                await page.waitForFunction(() => {
                    const tables = Array.from(document.querySelectorAll('table'));
                    return tables.some(t => t.innerText.includes('Course Code') && t.innerText.includes('Room No.'));
                }, { timeout: 15000 });
                
                appendLog(jobId, `Timetable Format Verified! Extracting exact grids...`);
                timetableHtml = await page.evaluate(() => {
                    const table = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Course Code') && t.innerText.includes('Room No.'));
                    const idTable = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Registration Number') && t.innerText.includes('Name:'));
                    return (idTable ? idTable.outerHTML : '') + (table ? table.outerHTML : '');
                });

            } catch (e) {
                appendLog(jobId, `WARNING: Strict Timetable format timed out. Executing Broad Body Rip...`);
                timetableHtml = await page.evaluate(() => document.body.innerHTML);
            }
        }

        // --- ATTENDANCE EXTRACTION ---
        appendLog(jobId, `Selecting 'My Attendance' sub-menu...`);
        
        try {
            // According to LAYOUT.txt the ID is exactly 'My_Attendance'
            const attendanceLink = await page.$('#My_Attendance');
            if (attendanceLink) {
                await page.click('#My_Attendance');
            } else {
                await page.evaluate(() => { 
                    const target = document.getElementById('My_Attendance');
                    if (target) target.click();
                    else window.location.hash = '#Page:My_Attendance'; 
                });
            }
            
            appendLog(jobId, `Polling DOM for Attendance Arrays...`);
            await page.waitForFunction(() => {
                const tables = Array.from(document.querySelectorAll('table'));
                return tables.some(t => t.innerText.includes('Hours Conducted') && t.innerText.includes('Attn %'));
            }, { timeout: 15000 });
            
            appendLog(jobId, `Attendance Format Verified! Extracting exact grids...`);
            attendanceHtml = await page.evaluate(() => {
                const table = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Hours Conducted') && t.innerText.includes('Attn %'));
                return table ? table.outerHTML : '';
            });

        } catch (e) {
            appendLog(jobId, `WARNING: Strict Attendance format timed out. Executing Broad Body Rip...`);
            attendanceHtml = await page.evaluate(() => document.body.innerHTML);
        }

        appendLog(jobId, `Extraction Complete. Securing payload in VM memory.`);
        await browser.close().catch(()=>{});
        
        const job = activeJobs.get(jobId);
        job.status = 'completed';
        job.data = { timetable: timetableHtml, attendance: attendanceHtml };

    } catch (error) {
        if (browser) await browser.close().catch(()=>{});
        appendLog(jobId, `CRITICAL ERROR: ${error.message}`);
        const job = activeJobs.get(jobId);
        if(job) {
            job.status = 'failed';
            job.error = error.message;
        }
    }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[VM GATEWAY] Serditone Async Scraper running on port ${PORT}`));

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
    
    // Start async puppeteer task (Do NOT await it here)
    processJob(jobId, identifier, password, mode);
    
    // Return immediately to bypass Vercel's 10-second timeout
    return res.status(202).json({ success: true, jobId });
});

// ==========================================
// 2. POLL FOR STATUS & LOGS
// ==========================================
app.get('/api/scrape/status/:jobId', (req, res) => {
    const job = activeJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: "Job not found or expired." });
    
    // If complete, return data. Job stays in memory for a few minutes to allow multiple polls if needed.
    return res.status(200).json({
        status: job.status,
        logs: job.logs,
        data: job.data,
        error: job.error
    });
});

// ==========================================
// 3. THE CORE EXTRACTION LOGIC
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

        appendLog(jobId, `Navigating to Zoho IAM Portal...`);
        await page.goto('https://accounts.zoho.com/signin?servicename=ZohoCreator&serviceurl=https://creatorapp.zoho.com/srm_university/academia-academic-services/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        appendLog(jobId, `Typing Username...`);
        await page.waitForSelector('input[id="login_id"]', { timeout: 45000 });
        await page.type('input[id="login_id"]', identifier, { delay: 40 }); 
        await page.click('button[id="nextbtn"]');
        
        appendLog(jobId, `Typing Password (length: ${password.length})...`);
        await page.waitForSelector('input[id="password"]', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000)); 
        await page.type('input[id="password"]', password, { delay: 40 });
        
        appendLog(jobId, `Executing Login Handshake...`);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}), 
            page.click('button[id="nextbtn"]')
        ]);

        const pageContent = await page.content();
        if (pageContent.includes('Invalid Password')) {
            throw new Error("Incorrect Academia Password.");
        }

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
        await new Promise(r => setTimeout(r, 6000));
        
        let timetableHtml = null;
        let attendanceHtml = null;

        // --- TIMETABLE EXTRACTION ---
        if (mode === 'full') {
            appendLog(jobId, `Injecting SPA Hash for Timetable (#Page:My_Time_Table_2023_24)...`);
            await page.evaluate(() => { window.location.hash = '#Page:My_Time_Table_2023_24'; });
            
            appendLog(jobId, `Polling DOM explicitly for text 'Course Code' & 'Room No.'...`);
            await page.waitForFunction(() => {
                const tables = Array.from(document.querySelectorAll('table'));
                return tables.some(t => t.innerText.includes('Course Code') && t.innerText.includes('Room No.'));
            }, { timeout: 20000 });
            
            appendLog(jobId, `Timetable Data Format Verified! Extracting...`);
            timetableHtml = await page.evaluate(() => {
                const table = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Course Code') && t.innerText.includes('Room No.'));
                const idTable = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Registration Number') && t.innerText.includes('Name:'));
                return (idTable ? idTable.outerHTML : '') + (table ? table.outerHTML : '');
            });
            appendLog(jobId, `Extracted Timetable Payload (${timetableHtml.length} bytes).`);
        }

        // --- ATTENDANCE EXTRACTION ---
        appendLog(jobId, `Injecting SPA Hash for Attendance (#Page:My_Attendance)...`);
        await page.evaluate(() => { window.location.hash = '#Page:My_Attendance'; });
        
        appendLog(jobId, `Polling DOM explicitly for text 'Hours Conducted' & 'Attn %'...`);
        await page.waitForFunction(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            return tables.some(t => t.innerText.includes('Hours Conducted') && t.innerText.includes('Attn %'));
        }, { timeout: 20000 });
        
        appendLog(jobId, `Attendance Data Format Verified! Extracting...`);
        attendanceHtml = await page.evaluate(() => {
            const table = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Hours Conducted') && t.innerText.includes('Attn %'));
            return table ? table.outerHTML : '';
        });
        appendLog(jobId, `Extracted Attendance Payload (${attendanceHtml.length} bytes).`);

        appendLog(jobId, `Extraction Complete. Securing payload in VM memory.`);
        await browser.close().catch(()=>{});
        
        // Finalize Job
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
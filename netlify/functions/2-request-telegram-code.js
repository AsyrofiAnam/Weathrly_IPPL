const admin = require('firebase-admin');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

try {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
} catch (e) {
    console.error('Firebase admin initialization error', e.stack);
}
const db = admin.firestore();

exports.handler = async (event, context) => {
    try {
        const authHeader = event.headers.authorization;
        if (!authHeader) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Tidak ada token otorisasi.' }) };
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SIGNING_SECRET);
        const uid = decoded.sub;

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }

        const { telegramUsername } = JSON.parse(event.body);
        if (!telegramUsername) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Username Telegram diperlukan.' }) };
        }

        const cleanUsername = telegramUsername.startsWith('@') ? telegramUsername.substring(1) : telegramUsername;
        const chatRef = db.collection('telegram_chats').doc(cleanUsername.toLowerCase());
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Username tidak ditemukan. Pastikan Anda sudah memulai chat dengan @Weathrly_bot.' }) };
        }
        const { chatId } = chatDoc.data();

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);

        const userRef = db.collection('users').doc(uid);
        await userRef.update({
            telegramVerification: {
                code: verificationCode,
                expiry: admin.firestore.Timestamp.fromDate(verificationExpiry),
                chatId: chatId,
                username: cleanUsername
            }
        });

        const messageText = `Kode verifikasi Weathrly Anda adalah: ${verificationCode}\n\nJangan berikan kode ini kepada siapapun, termasuk pihak yang mengaku dari Weathrly.\nKode ini digunakan untuk menghubungkan akun Telegram Anda dengan aplikasi Weathrly agar bisa menerima notifikasi cuaca secara otomatis.\n\nJika Anda tidak melakukan proses ini, abaikan pesan ini untuk menjaga keamanan akun Anda.`;

        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageText
            })
        });

        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Kode verifikasi telah dikirim.' }) };

    } catch (error) {
        console.error('Handler error:', error);
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Token tidak valid atau sudah hangus.' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan di server.' }) };
    }
};
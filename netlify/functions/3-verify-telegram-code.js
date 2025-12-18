const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

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

        const { code } = JSON.parse(event.body);
        if (!code || code.length !== 6) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Kode verifikasi harus 6 digit.' }) };
        }

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists || !userDoc.data().telegramVerification) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Tidak ada proses verifikasi yang aktif.' }) };
        }

        const { code: storedCode, expiry, chatId, username } = userDoc.data().telegramVerification;

        if (expiry.toDate() < new Date()) {
            await userRef.update({ telegramVerification: admin.firestore.FieldValue.delete() });
            return { statusCode: 400, body: JSON.stringify({ error: 'Kode verifikasi sudah hangus. Silakan coba lagi.' }) };
        }

        if (storedCode !== code) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Kode verifikasi salah.' }) };
        }

        await userRef.update({
            telegramUsername: username,
            telegramChatId: chatId,
            telegramVerification: admin.firestore.FieldValue.delete()
        });
        
        const successMessage = 'Selamat! 🎉 Akun Telegram Anda telah berhasil terhubung dengan Weathrly.';
        await sendMessage(chatId, successMessage);

        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Telegram berhasil terhubung!', telegramUsername: username }) };

    } catch (error) {
        console.error('Handler error:', error);
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Token tidak valid atau sudah hangus.' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ error: 'Terjadi kesalahan di server.' }) };
    }
};

async function sendMessage(chatId, text) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
        }),
    });
}
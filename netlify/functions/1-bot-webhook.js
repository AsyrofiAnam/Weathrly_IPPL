const admin = require('firebase-admin');
const fetch = require('node-fetch');

try {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(
            Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8')
        );

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    console.error('Firebase admin initialization error', e.stack);
}
const db = admin.firestore();

exports.handler = async (event) => {
    if (!event.path.includes(process.env.TELEGRAM_SECRET_PATH)) {
        return { statusCode: 403, body: 'Forbidden' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const message = body.message || body.edited_message;

        if (message && message.text) {
            const chatId = message.chat.id;
            const username = message.from.username;
            const text = message.text;
            
            const firstName = message.from.first_name;
            const lastName = message.from.last_name || '';
            const displayName = `${firstName} ${lastName}`.trim();

            if (text.toLowerCase() === '/start') {
                if (!username) {
                    await sendMessage(chatId, 'Halo! Akun Telegram Anda harus memiliki username publik agar dapat terhubung dengan Weathrly. Silakan atur username di Pengaturan Telegram Anda, lalu coba lagi.');
                } else {
                    const telegramChatRef = db.collection('telegram_chats').doc(username.toLowerCase());
                    await telegramChatRef.set({
                        chatId: chatId,
                        username: username,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                    const replyText = `Halo ${displayName}! 👋\n\nAnda telah berhasil memulai koneksi dengan Weathrly.\n\nSekarang, silakan kembali ke halaman Dashboard Weathrly dan masukkan username Telegram Anda: @${username}`;
                    await sendMessage(chatId, replyText);
                }
            }
        }
        return { statusCode: 200, body: 'OK' };
    } catch (error) {
        console.error('Error processing Telegram update:', error);
        return { statusCode: 200, body: 'Error processing update' };
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
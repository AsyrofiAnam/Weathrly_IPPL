// /netlify/functions/create-payment-link.js

const fetch = require('node-fetch');
const admin = require('firebase-admin');

// --- Inisialisasi Firebase Admin (Tidak Berubah) ---
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let serviceAccount;
if (serviceAccountBase64) {
  try {
    const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    console.error('Gagal mem-parsing FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
  }
} else {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY tidak diatur di Netlify.');
}
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error('Inisialisasi Firebase admin gagal:', e.message);
  }
}
// --- Selesai Inisialisasi ---

exports.handler = async (event, context) => {

  // 1. Verifikasi Token Firebase (Tidak Berubah)
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Tidak ada token otorisasi.' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Token tidak valid atau kedaluwarsa.' }) };
  }
  const user = {
    uid: decodedToken.uid,
    email: decodedToken.email,
  };

  // 2. [BARU] Ambil 'slug' pengguna dari Firestore
  let userSlug;
  try {
    const userDoc = await admin.firestore().collection('users').doc(user.uid).get();
    if (userDoc.exists && userDoc.data().slug) {
      userSlug = userDoc.data().slug;
    } else {
      // Fallback jika slug tidak ada (seharusnya tidak terjadi, tapi untuk jaga-jaga)
      userSlug = 'dashboard'; // Kembali ke fallback lama jika slug tidak ditemukan
      console.warn(`Slug tidak ditemukan untuk user ${user.uid}, menggunakan fallback /dashboard`);
    }
  } catch (error) {
    console.error('Gagal mengambil slug pengguna:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Gagal mengambil data pengguna.' }) };
  }

  // 3. Ambil Kunci Rahasia Xendit (Tidak Berubah)
  const SECRET_KEY = process.env.XENDIT_SECRET_KEY;
  if (!SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Kunci pembayaran tidak dikonfigurasi.' }) };
  }

  // 4. Siapkan Otorisasi Basic Auth (Tidak Berubah)
  const basicAuth = Buffer.from(SECRET_KEY + ':').toString('base64');

  // 5. [PERUBAHAN] Siapkan Payload dengan URL Redirect yang Benar
  const payload = {
    external_id: `weathrly-premium-${user.uid}-${Date.now()}`,
    amount: 49000,
    payer_email: user.email,
    description: 'Langganan Weathrly Premium (1 Bulan)',
    // [PERUBAHAN DI SINI] Arahkan ke /slug, bukan /dashboard
    success_redirect_url: `https://weathrly-ippl.netlify.app/${userSlug}?payment=success`,
    failure_redirect_url: `https://weathrly-ippl.netlify.app/${userSlug}?payment=failed`,
  };

  // 6. Kirim Permintaan ke Xendit (Tidak Berubah)
  try {
    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Error dari Xendit:', data);
      throw new Error(data.message || 'Gagal membuat invoice Xendit.');
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        paymentUrl: data.invoice_url,
      }),
    };
  } catch (error) {
    console.error('Error saat membuat payment link:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
const admin = require('firebase-admin');

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

exports.handler = async (event) => {
  const xenditWebhookToken = event.headers['x-callback-token'];
  const serverToken = process.env.XENDIT_WEBHOOK_TOKEN;

  if (!xenditWebhookToken || xenditWebhookToken !== serverToken) {
    console.warn('Verifikasi token webhook gagal.');
    return {
      statusCode: 401,
      body: 'Invalid token',
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    console.error('Gagal mem-parsing body JSON:', e.message);
    return { statusCode: 400, body: 'Bad Request: Invalid JSON' };
  }

  if (payload.id && payload.status === 'PAID') {
    
    try {
      const invoice = payload; 
      
      const externalIdParts = invoice.external_id.split('-');
      
      if (externalIdParts.length < 3 || externalIdParts[0] !== 'weathrly' || externalIdParts[1] !== 'premium') {
         console.warn(`External_id tidak dikenal: ${invoice.external_id}`);
         return { statusCode: 200, body: 'Webhook diterima (ID tidak dikenal).' };
      }
      
      const userUid = externalIdParts[2];
      
      const now = new Date();
      const paidAtDate = new Date(invoice.paid_at);
      const expiryDate = new Date(paidAtDate.setDate(paidAtDate.getDate() + 30));

      // Menangkap Metode Pembayaran
      // Xendit biasanya mengirimkan payment_method (misal: "BANK_TRANSFER", "EWALLET") 
      // dan payment_channel (misal: "BCA", "OVO", "MANDIRI")
      const paymentMethod = invoice.payment_method || 'Unknown';
      const paymentChannel = invoice.payment_channel || invoice.bank_code || 'Unknown';

      const userDocRef = admin.firestore().collection('users').doc(userUid);
      
      await userDocRef.update({
        plan: 'premium',
        planExpiresAt: admin.firestore.Timestamp.fromDate(expiryDate),
        lastPayment: { 
          invoiceId: invoice.id,
          externalId: invoice.external_id,
          paidAt: admin.firestore.Timestamp.fromDate(new Date(invoice.paid_at)),
          amount: invoice.amount,
          method: paymentMethod, // e.g., BANK_TRANSFER
          channel: paymentChannel // e.g., BCA
        },
        // Menyimpan detail langganan aktif untuk ditampilkan di settings
        subscriptionDetails: {
           status: 'active',
           nextBillingDate: admin.firestore.Timestamp.fromDate(expiryDate),
           paymentMethod: paymentMethod,
           paymentChannel: paymentChannel
        }
      });
      
      console.log(`Sukses: Pengguna ${userUid} telah ditingkatkan ke premium via ${paymentChannel}.`);
      
      return {
        statusCode: 200,
        body: 'Webhook received and processed (User upgraded).',
      };

    } catch (error) {
      console.error(`Gagal memproses webhook untuk external_id: ${payload.external_id}`, error);
      return { statusCode: 500, body: 'Internal Server Error' };
    }
  }

  return {
    statusCode: 200,
    body: 'Webhook event received (status not PAID).',
  };
};
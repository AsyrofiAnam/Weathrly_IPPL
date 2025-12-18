const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

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
    console.error('Firebase admin initialization error in get-netlify-token', e.stack);
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { firebaseToken } = JSON.parse(event.body);
        if (!firebaseToken) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Firebase token is required.' }) };
        }

        const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        const uid = decodedToken.uid;

        const netlifyToken = jwt.sign(
            {
                exp: Math.floor(Date.now() / 1000) + (60 * 60),
                sub: uid, // Subject = User ID
                app_metadata: {
                    authorization: { roles: ['user'] }
                }
            },
            process.env.JWT_SIGNING_SECRET
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ netlify_token: netlifyToken }),
        };

    } catch (error) {
        console.error('Error creating Netlify token:', error);
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid Firebase token.' }) };
    }
};
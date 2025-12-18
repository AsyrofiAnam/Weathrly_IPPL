const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');

const {
    FIREBASE_SERVICE_ACCOUNT_KEY,
    SENDGRID_API_KEY,
    GEMINI_API_KEY,
    OPENWEATHER_API_KEY,
    TELEGRAM_BOT_TOKEN
} = process.env;

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(Buffer.from(FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('ascii'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
sgMail.setApiKey(SENDGRID_API_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); 
const timezoneOffsets = { 'WIB': 7, 'WITA': 8, 'WIT': 9 };
const dayMapping = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

exports.handler = async (event, context) => {
    console.log("Fungsi Ringkasan Harian Dimulai...");
    const now = new Date();

    try {
        const usersSnapshot = await db.collection('users')
            .where('plan', '==', 'premium')
            .where('dailySummary.enabled', '==', true)
            .get();

        if (usersSnapshot.empty) {
            return { statusCode: 200, body: 'Tidak ada pengguna premium dengan ringkasan harian aktif.' };
        }

        const summaryPromises = [];
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            const userId = userDoc.id;
            const settings = user.dailySummary;

            if (!settings || !settings.time || !settings.timezone) {
                console.log(`Pengaturan ringkasan tidak lengkap untuk ${user.email}`);
                continue;
            }

            const [settingHour, settingMinute] = settings.time.split(':').map(Number);
            const timezoneOffset = timezoneOffsets[settings.timezone] || 7;
            const userLocalTime = new Date(now.getTime() + timezoneOffset * 60 * 60 * 1000);
            const userCurrentHour = userLocalTime.getUTCHours();
            const userCurrentMinute = userLocalTime.getUTCMinutes();

            if (userCurrentHour === settingHour && userCurrentMinute === settingMinute) {
                console.log(`Waktu ringkasan harian cocok untuk ${user.email}. Memproses...`);
                
                summaryPromises.push(processUserSummary(user, userId, userLocalTime, userCurrentHour));
            }
        }

        await Promise.all(summaryPromises);
        console.log(`Fungsi Ringkasan Harian selesai. ${summaryPromises.length} ringkasan diproses.`);
        return { statusCode: 200, body: `Proses Ringkasan Harian selesai. ${summaryPromises.length} ringkasan dikirim.` };

    } catch (error) {
        console.error('Error di fungsi Ringkasan Harian handler:', error);
        return { statusCode: 500, body: `Error: ${error.message}` };
    }
};

async function processUserSummary(user, userId, userLocalTime, settingHour) {
    try {
        const locationsSnapshot = await db.collection('users').doc(userId).collection('locations').get();
        const locationMap = new Map();
        locationsSnapshot.forEach(doc => {
            locationMap.set(doc.id, doc.data());
        });

        if (locationMap.size === 0) {
            console.log(`Batal kirim ringkasan: ${user.email} tidak punya lokasi.`);
            return;
        }

        const schedulesSnapshot = await db.collection('users').doc(userId).collection('schedules').get();
        if (schedulesSnapshot.empty) {
            console.log(`Batal kirim ringkasan: ${user.email} tidak punya jadwal.`);
            return;
        }

        const todayDay = dayMapping[userLocalTime.getUTCDay()];

        const todaySchedules = schedulesSnapshot.docs
            .map(doc => doc.data())
            .filter(s => s.days && s.days.includes(todayDay))
            .sort((a, b) => a.time.localeCompare(b.time));

        if (todaySchedules.length === 0) {
            console.log(`Tidak ada jadwal untuk ${user.email} hari ${todayDay}. Ringkasan tidak dikirim.`);
            return;
        }

        const forecastPromises = todaySchedules.map(schedule => {
            const location = locationMap.get(schedule.locationId);
            if (!location) return null;
            return getForecastForSchedule(schedule, location, userLocalTime);
        });

        const scheduleForecasts = (await Promise.all(forecastPromises)).filter(Boolean);

        if (scheduleForecasts.length === 0) {
            console.log(`Gagal mengambil prakiraan cuaca untuk semua jadwal ${user.email}.`);
            return;
        }

        const generatedText = await generateDailySummaryNarrative(user, scheduleForecasts, todayDay, settingHour);

        const notificationChannels = {};
        if (user.emailNotificationsEnabled !== false) {
            notificationChannels.email = user.email;
        }
        if (user.telegramChatId) {
            notificationChannels.telegram = user.telegramChatId;
        }

        if (Object.keys(notificationChannels).length === 0) {
            console.log(`Batal kirim ringkasan: ${user.email} menonaktifkan semua notifikasi.`);
            return;
        }

        await sendSummaryNotification(notificationChannels, generatedText, user, todayDay, settingHour); 
        
    } catch (error) {
        console.error(`Gagal memproses ringkasan untuk ${user.email}:`, error);
    }
}

async function getForecastForSchedule(schedule, location, userLocalTime) {
    try {
        const forecastData = await get5DayForecast(location.latitude, location.longitude);
        if (!forecastData) return null;

        const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
        
        const targetDate = new Date(userLocalTime.getTime());
        targetDate.setUTCHours(scheduleHour, scheduleMinute, 0, 0); 
        
        const forecast = findClosestForecast(forecastData.list, targetDate);

        return {
            scheduleName: schedule.name,
            locationName: schedule.locationName,
            scheduleTime: schedule.time,
            forecast: forecast
        };
    } catch (error) {
        console.error(`Gagal mengambil prakiraan untuk jadwal ${schedule.name}:`, error);
        return null;
    }
}

async function generateDailySummaryNarrative(user, scheduleForecasts, dayName, settingHour) {
    const userName = user.displayName || user.email.split('@')[0];

    // [MODIFIKASI] Logika untuk sapaan dinamis
    let greeting = 'Halo';
    let emoji = '👋';
    if (settingHour >= 5 && settingHour < 11) { // 05:00 - 10:59
        greeting = 'Selamat pagi';
        emoji = '☀️';
    } else if (settingHour >= 11 && settingHour < 15) { // 11:00 - 14:59
        greeting = 'Selamat siang';
        emoji = '☀️';
    } else if (settingHour >= 15 && settingHour < 19) { // 15:00 - 18:59
        greeting = 'Selamat sore';
        emoji = '🌇';
    } else { // 19:00 - 04:59
        greeting = 'Selamat malam';
        emoji = '🌙';
    }
    const finalGreeting = `${greeting}, ${userName}! ${emoji}`;

    let schedulePromptData = '';
    scheduleForecasts.forEach((item, index) => {
        const { scheduleName, locationName, scheduleTime, forecast } = item;
        const { main: fcMain, weather: fcWeather } = forecast;
        
        schedulePromptData += `
Jadwal ${index + 1}:
- Nama Jadwal: ${scheduleName}
- Waktu: ${scheduleTime}
- Lokasi: ${locationName}
- Prakiraan Cuaca: ${fcWeather[0].description}
- Suhu: ${Math.round(fcMain.temp)}°C
- Terasa Seperti: ${Math.round(fcMain.feels_like)}°C
`;
    });

    const prompt = `
        Anda adalah "Asisten Weathrly" dari aplikasi Weathrly. Gaya bicara Anda santai, hangat, dan
        super personal seperti teman akrab yang mengingatkan. Gunakan bahasa sehari-hari yang tidak 
        kaku, seolah sedang mengobrol via chat. Gunakan kata ganti "kamu", bukan "Anda". 

        Tugas Anda adalah membuat isi "Ringkasan Harian" untuk pengguna.
        Ini adalah rangkuman dari SEMUA jadwal mereka untuk hari ini.
        Buat pesannya singkat, padat, dan jelas.

        Ikuti struktur ini DENGAN TEPAT:

        1. Sapaan Dinamis: Gunakan sapaan yang sudah disiapkan: "${finalGreeting}"
        2. Kalimat Pembuka: Buat pembuka yang santai seperti teman yang lagi nyapa dan ngasih update cuaca buat hari ${dayName}.
           - Jangan gunakan kalimat kaku seperti "Sesuai permintaanmu" atau "Berikut rangkumannya".
        3. Daftar Jadwal (Singkat & Mengalir):
           - Tulis tiap jadwal dengan format [Nama Jadwal] ([Waktu] di [Lokasi])
           - Di bawahnya, tulis satu kalimat ringkas yang menyatukan deskripsi cuaca dan saran praktis.
           - Fokus pada makna cuaca buat aktivitas mereka, bukan sekadar data.
           - Gunakan nada percakapan santai dan alami, dan beri jarak satu baris antar jadwal.

           Contoh format (bukan untuk ditiru kata per kata):

           **Lari Pagi (06:30 di Taman Kota)**
           Udara pagi ini terasa sejuk 24°C dan agak berawan, pas banget buat lari tanpa kepanasan, tapi tetap siapin handuk kecil ya biar nggak kedinginan habis keringetan.

           **Pulang Kantor (17:00 di Kantor Pusat)**
           Kayaknya langit sore bakal mendung dan mungkin turun hujan ringan, terasa 28°C tapi agak lembap. Bawa payung kecil aja, cukup buat jaga-jaga biar nggak basah di jalan.
           
           **Makan Malam (19:30 di Resto Senja)**
           Malam ini cerah dengan suhu sekitar 25°C, suasananya bakal adem dan tenang. Waktu yang pas buat santai sambil ngobrol santai bareng teman.

        4. Penutup Hangat: "Tutup dengan kalimat positif yang memberi semangat untuk menjalani hari. Contohnya bisa bernada santai seperti “Semoga harimu lancar dan menyenangkan!” atau yang seirama."
        5. Tanda Tangan: Akhiri HANYA dengan "- Asisten Weathrly". JANGAN tambahkan "Salam," atau "Tim Weathrly".

        ATURAN PENTING:
        JANGAN PERNAH menggunakan bahasa promosi, marketing, atau kata-kata ajakan untuk 'upgrade', 'premium', 'gratis', 'penawaran', 'diskon', 'terbaik', 'nikmati'.
        Fokus HANYA pada cuaca, jadwal, dan saran yang relevan. Ini adalah notifikasi obrolan, bukan promosi.

        Berikut adalah data untuk hari ini (${dayName}):
        ${schedulePromptData}

        Pastikan outputnya adalah satu blok teks yang siap dimasukkan ke dalam email.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().replace(/\n/g, '<br>');
    } catch (error) {
        console.error("Gagal generate konten Gemini (Ringkasan Harian):", error);
        return `Hai ${userName}, ini ringkasan harian Anda. Sayangnya, terjadi kesalahan saat membuat narasi. Silakan cek jadwal Anda di aplikasi.`;
    }
}

async function sendSummaryNotification(channels, htmlMessage, user, dayName, settingHour) {
    const sendPromises = [];
    
    let emoji = '☀️'; // Default
    if (settingHour < 5 || settingHour >= 19) { // 19:00 - 04:59
        emoji = '🌙';
    } else if (settingHour >= 15) { // 15:00 - 18:59
        emoji = '🌇';
    }
    const subject = `${emoji} Ringkasan Cuaca Weathrly (Hari ${dayName})`;

    if (channels.email) {
        const plainTextVersion = htmlMessage.replace(/<br\s*\/?>/gi, '\n');
        const msg = {
            to: channels.email,
            from: {
                name: 'Weathrly',
                email: 'asisten@weathrly.web.id',
            },
            subject: subject,
            text: plainTextVersion,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    ${htmlMessage}
                    <br><br>
                    <p style="font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
                        P.S. Pastikan jadwal Anda tetap diperbarui agar notifikasi cuaca selalu akurat.
                    </p>
                </div>
            `,
        };
        sendPromises.push(sgMail.send(msg).then(() => console.log(`Ringkasan Harian Email berhasil dikirim ke ${channels.email}`)));
    }

    if (channels.telegram) {
        // Buat judul untuk telegram
        const telegramHeader = `*${subject}*\n\n`;
        sendPromises.push(sendTelegramMessage(channels.telegram, telegramHeader + htmlMessage, true));
    }

    await Promise.all(sendPromises);
}

async function sendTelegramMessage(chatId, htmlMessage, useMarkdown = false) {
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    let text = '';
    let parse_mode = useMarkdown ? 'Markdown' : undefined;

    if (useMarkdown) {
        text = htmlMessage
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
            .replace(/<b>(.*?)<\/b>/gi, '*$1*')
            .replace(/<i\s*\/?>/gi, '_')
            .replace(/<\/i>/gi, '_')
            .replace(/<[^>]*>?/gm, '');
    } else {
        text = htmlMessage
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '</p>\n')
            .replace(/<[^>]*>?/gm, '');
        parse_mode = undefined;
    }

    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: parse_mode
    };
    try {
        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Telegram API error: ${errorData.description}`);
        }
        console.log(`Ringkasan Harian Telegram terkirim ke chat ID ${chatId}`);
    } catch (error) {
        console.error(`Gagal mengirim Ringkasan Harian Telegram ke ${chatId}:`, error);
    }
}

function get5DayForecast(lat, lon) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=id`;
    return fetch(apiUrl).then(res => res.json()).catch(err => null);
}

function findClosestForecast(forecastList, targetDate) {
    let closest = null;
    let smallestDiff = Infinity;
    for (const item of forecastList) {
        const diff = Math.abs(targetDate.getTime() - (new Date(item.dt * 1000).getTime()));
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closest = item;
        }
    }
    return closest;
}
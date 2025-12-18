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
const HOT_THRESHOLD = 30; // Batas suhu untuk "panas"

exports.handler = async (event, context) => {
    console.log("Fungsi Pengecekan Jadwal Dimulai...");
    const now = new Date();

    try {
        const usersSnapshot = await db.collection('users').get();
        if (usersSnapshot.empty) {
            return { statusCode: 200, body: 'Tidak ada pengguna.' };
        }

        const notificationPromises = [];
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            const userId = userDoc.id;
            const plan = user.plan || 'free';
            const schedulesSnapshot = await db.collection('users').doc(userId).collection('schedules').get();
            if (schedulesSnapshot.empty) continue;

            for (const scheduleDoc of schedulesSnapshot.docs) {
                const schedule = scheduleDoc.data();
                if (!schedule.time || !schedule.timezone || !schedule.days) {
                    console.log(`Melewatkan jadwal tidak lengkap untuk ${user.email}`);
                    continue;
                }
                
                const notificationMinutes = (plan === 'premium' && schedule.notificationTime) 
                    ? parseInt(schedule.notificationTime, 10) 
                    : 60;

                const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
                const timezoneOffset = timezoneOffsets[schedule.timezone] || 7;
                const userLocalTime = new Date(now.getTime() + timezoneOffset * 60 * 60 * 1000);
                const userCurrentDayIndex = userLocalTime.getUTCDay();
                const userCurrentDay = dayMapping[userCurrentDayIndex];
                const userNextDayIndex = (userCurrentDayIndex + 1) % 7;
                const userNextDay = dayMapping[userNextDayIndex];

                const checkAndProcess = async (targetDate, targetDay) => {
                    if (!schedule.days.includes(targetDay)) {
                        return;
                    }

                    const scheduleDateUTC = new Date(Date.UTC(
                        targetDate.getUTCFullYear(),
                        targetDate.getUTCMonth(),
                        targetDate.getUTCDate(),
                        scheduleHour - timezoneOffset,
                        scheduleMinute
                    ));
                    
                    const notificationTimeUTC = new Date(scheduleDateUTC.getTime() - notificationMinutes * 60 * 1000);

                    if (now.getUTCFullYear() === notificationTimeUTC.getUTCFullYear() &&
                        now.getUTCMonth() === notificationTimeUTC.getUTCMonth() &&
                        now.getUTCDate() === notificationTimeUTC.getUTCDate() &&
                        now.getUTCHours() === notificationTimeUTC.getUTCHours() &&
                        now.getUTCMinutes() === notificationTimeUTC.getUTCMinutes()) {

                        console.log(`Jadwal cocok (untuk ${targetDay}) ${user.email}! Nama: "${schedule.name}". Memproses...`);
                        
                        const notificationId = notificationTimeUTC.toISOString();
                        const lockRef = db.collection('users').doc(userId).collection('schedules').doc(scheduleDoc.id).collection('sentAlerts').doc(notificationId);
                        const lockDoc = await lockRef.get();

                        if (lockDoc.exists) {
                            console.log(`[Duplikat] Notifikasi ${notificationId} sudah terkirim. Melewatkan.`);
                            return;
                        }
                        
                        const notificationChannels = getNotificationChannels(user, plan);
                        if (!notificationChannels) {
                            console.log(`Melewatkan ${user.email} karena semua notifikasi nonaktif.`);
                            return;
                        }

                        if (!schedule.locationId) {
                            console.log(`Jadwal "${schedule.name}" tidak memiliki locationId. Melewatkan.`);
                            return;
                        }
                        const locationDoc = await db.collection('users').doc(userId).collection('locations').doc(schedule.locationId).get();
                        if (!locationDoc.exists) {
                            console.log(`Lokasi dengan ID ${schedule.locationId} (dari jadwal "${schedule.name}") tidak ditemukan.`);
                            return;
                        }
                        const location = locationDoc.data();
                        const alertCondition = schedule.alertCondition;
                        
                        if (plan === 'premium' && user.smartAlertsEnabled === true && alertCondition && alertCondition !== 'none') {
                            console.log(`[Smart Alert] Jadwal "${schedule.name}" punya kondisi: ${alertCondition}. Memeriksa cuaca...`);
                            
                            const [currentWeather, forecastData] = await Promise.all([
                                getCurrentWeather(location.latitude, location.longitude),
                                get5DayForecast(location.latitude, location.longitude)
                            ]);

                            if (!currentWeather || !forecastData) { 
                                console.log("[Smart Alert] Gagal ambil data cuaca (current or forecast)."); 
                                return; 
                            }
                            
                            const scheduleTime = new Date(Date.now() + notificationMinutes * 60 * 1000); 
                            const forecastForSchedule = findClosestForecast(forecastData.list, scheduleTime);
                            const conditionMet = checkWeatherCondition(forecastForSchedule, alertCondition);

                            if (conditionMet) {
                                console.log(`[Smart Alert] Kondisi ${alertCondition} TERPENUHI.`);
                                await lockRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp(), type: 'smart-alert' });
                                
                                notificationPromises.push(processAndSendSmartAlert(user, schedule, currentWeather, forecastForSchedule, notificationChannels, notificationMinutes));
                            } else {
                                console.log(`[Smart Alert] Kondisi ${alertCondition} TIDAK terpenuhi. Notifikasi dibatalkan.`);
                                return;
                            }

                        } else {
                            console.log(`[Regular Alert] Jadwal "${schedule.name}" adalah notifikasi standar.`);
                            await lockRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp(), type: 'regular' });
                            notificationPromises.push(
                                processAndSendNotification(user, schedule, location.latitude, location.longitude, notificationChannels, notificationMinutes)
                            );
                        }
                    }
                };

                await checkAndProcess(userLocalTime, userCurrentDay);
                const tomorrowDate = new Date(userLocalTime.getTime() + 24 * 60 * 60 * 1000);
                await checkAndProcess(tomorrowDate, userNextDay);
            }
        }

        await Promise.all(notificationPromises);
        console.log(`Fungsi selesai. ${notificationPromises.length} notifikasi diproses.`);
        return { statusCode: 200, body: `Proses selesai. ${notificationPromises.length} notifikasi diproses.` };

    } catch (error) {
        console.error('Error di fungsi handler:', error);
        return { statusCode: 500, body: `Error: ${error.message}` };
    }
};

function formatMinutesToText(minutes) {
    if (!minutes || minutes < 0) minutes = 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    let text = '';
    if (hours > 0) {
        text += `${hours} jam`;
    }
    if (remainingMinutes > 0) {
        if (hours > 0) text += ' ';
        text += `${remainingMinutes} menit`;
    }
    if (text === '') text = 'sekarang juga'; 
    return text;
}


function getNotificationChannels(user, plan) {
    const channels = {};
    if (user.emailNotificationsEnabled !== false) {
        channels.email = user.email;
    }
    if (plan === 'premium' && user.telegramChatId) {
        channels.telegram = user.telegramChatId;
    }

    if (Object.keys(channels).length === 0) {
        return null;
    }
    return channels;
}

function checkWeatherCondition(forecast, condition) {
    if (!forecast) return false;
    const weatherId = forecast.weather[0].id;
    const feelsLike = forecast.main.feels_like;
    if (condition === 'hujan') {
        return weatherId >= 200 && weatherId < 600;
    }
    if (condition === 'panas') {
        return feelsLike > HOT_THRESHOLD;
    }
    return false;
}

async function processAndSendSmartAlert(user, schedule, currentWeather, forecast, channels, notificationMinutes) {
    try {
        const generatedText = await generateSmartAlertNarrative(user, schedule, currentWeather, forecast, notificationMinutes);
        const sendPromises = [];

        if (channels.email) {
            const plainTextVersion = generatedText.replace(/<br\s*\/?>/gi, '\n');
            const msg = {
                to: channels.email,
                from: { name: 'Weathrly', email: 'asisten@weathrly.web.id' },
                subject: `⚠️ Peringatan Cuaca: "${schedule.name}"`,
                text: plainTextVersion,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        ${generatedText.replace(/\n/g, '<br>')}
                        <br><br>
                        <p style="font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
                            P.S. Pastikan jadwal Anda tetap diperbarui agar notifikasi cuaca selalu akurat.
                        </p>
                    </div>
                `,
            };
            sendPromises.push(sgMail.send(msg).then(() => console.log(`Smart Alert Email berhasil dikirim ke ${channels.email}`)));
        }

        if (channels.telegram) {
            sendPromises.push(sendTelegramMessage(channels.telegram, generatedText));
        }

        await Promise.all(sendPromises);
        console.log(`Smart Alert berhasil diproses untuk ${user.email} (Jadwal: "${schedule.name}")`);

    } catch (error) {
        console.error(`Gagal memproses Smart Alert untuk ${user.email}:`, error);
    }
}

async function generateSmartAlertNarrative(user, schedule, currentWeather, forecast, notificationMinutes) {
    const userName = user.displayName || user.email.split('@')[0];
    
    const { main: currentMain, weather: currentWeatherDesc } = currentWeather;
    const { main: forecastMain, weather: forecastWeatherDesc } = forecast;
    
    let conditionText = schedule.alertCondition;
    if (conditionText === 'hujan') conditionText = 'bakal hujan';
    if (conditionText === 'panas') conditionText = `bakal panas banget (terasa di atas ${HOT_THRESHOLD}°C)`;

    const timeText = formatMinutesToText(notificationMinutes);

    const prompt = `
        Anda adalah "Asisten Weathrly" dari aplikasi Weathrly. Gaya bicara Anda santai, hangat, dan
        super personal seperti teman akrab yang mengingatkan. Gunakan bahasa sehari-hari yang tidak 
        kaku, seolah sedang mengobrol via chat. Gunakan kata ganti "kamu".
        
        Tugas Anda adalah membuat isi notifikasi "Peringatan Cerdas",
        yaitu pesan khusus yang muncul saat kondisi cuaca yang diminta pengguna (misal: hujan) akan terjadi.
        Ini bukan pengingat biasa, tapi pesan khusus yang sifatnya penting buat mereka.

        Ikuti struktur ini DENGAN TEPAT:

        1. Sapaan Personal: Mulai dengan "Hai [Nama Pengguna],"
        2. Kalimat Konteks (Peringatan): Buat pembuka yang santai tapi tetap jelas untuk memberitahu kalau kondisi cuaca yang diminta pengguna bakal terjadi di waktu jadwalnya ${timeText} lagi. Hindari nada formal atau terlalu kaku.
        3. Alasan & Detail Awal: Jelaskan alasan notifikasi ini muncul dengan gaya natural. Sertakan bahwa ini dikirim karena pengguna minta diberi tahu hanya jika kondisi tertentu akan terjadi di ${schedule.locationName}.
        4. Kondisi Cuaca Saat Ini: Ceritakan dengan gaya percakapan bagaimana cuaca sekarang terasa di sekitar ${schedule.locationName} berdasarkan data suhu, rasa panas/dingin, dan kelembapan. Jangan hanya melaporkan angka, tapi gambarkan suasananya.
        4. Detail Cuaca (Prakiraan): Lanjutkan dengan cerita ringan tentang bagaimana kondisi cuaca akan berubah atau terasa nanti saat jadwal berlangsung. Gunakan gaya bercerita, bukan laporan.
        5. Saran/Rekomendasi: Berikan saran praktis yang relevan dengan kondisi cuaca dan jadwal pengguna ${timeText} lagi, disampaikan dengan nada peduli dan bersahabat.
        6. Penutup Ramah: Akhiri dengan kalimat penutup positif dan hangat yang cocok dengan suasana peringatannya.
           (Contoh: "Hati-hati di jalan ya!" atau "Semoga tetap seru walaupun [Kondisi]!")
        7. Tanda Tangan: Akhiri HANYA dengan "- Asisten Weathrly". JANGAN tambahkan "Salam," atau "Tim Weathrly".

        ATURAN PENTING:
        JANGAN PERNAH menggunakan bahasa promosi, marketing, atau kata-kata ajakan untuk 'upgrade', 'premium', 'gratis', 'penawaran', 'diskon', 'terbaik', 'nikmati'.
        Fokus HANYA pada cuaca, jadwal, dan saran yang relevan. Ini adalah notifikasi obrolan, bukan promosi.

        Berikut adalah datanya:
        - Nama Pengguna: ${userName}
        - Nama Jadwal: ${schedule.name}
        - Waktu Jadwal: ${schedule.time}
        - Lokasi: ${schedule.locationName} 
        
        - [BARU] Data Cuaca Saat Ini (Sekarang):
            - Kondisi: ${currentWeatherDesc[0].description}
            - Suhu: ${Math.round(currentMain.temp)}°C
            - Terasa Seperti: ${Math.round(currentMain.feels_like)}°C
            - Kelembapan: ${currentMain.humidity}%
            
        - Data Prakiraan Cuaca (untuk ${timeText} lagi):
            - Kondisi: ${forecastWeatherDesc[0].description}
            - Suhu: ${Math.round(forecastMain.temp)}°C
            - Terasa Seperti: ${Math.round(forecastMain.feels_like)}°C
            - Kelembapan: ${forecastMain.humidity}%

        Pastikan outputnya adalah satu blok teks yang siap dimasukkan ke dalam email/pesan.
        JANGAN gunakan "⚠️ **Peringatan Cuaca untuk Jadwalmu!**" di dalam isi email. Biarkan subjek email yang menanganinya.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().replace(/\n/g, '<br>');
    } catch (error) {
        console.error("Gagal generate konten Gemini (Smart Alert):", error);
        return `Hai ${userName}, Peringatan Cuaca untuk jadwal "${schedule.name}" (${timeText} lagi). Cuaca diperkirakan ${forecastWeatherDesc[0].description} (terasa ${Math.round(forecastMain.feels_like)}°C). Harap bersiap.`;
    }
}

async function sendTelegramMessage(chatId, htmlMessage) {
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const plainText = htmlMessage
        .replace(/<br\s*\/?>/gi, '\n') 
        .replace(/<\/p>/gi, '</p>\n') 
        .replace(/<[^>]*>?/gm, ''); 

    const payload = {
        chat_id: chatId,
        text: plainText,
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
        console.log(`Notifikasi Telegram terkirim ke chat ID ${chatId}`);
    } catch (error) {
        console.error(`Gagal mengirim pesan Telegram ke ${chatId}:`, error);
    }
}

async function getCurrentWeather(lat, lon) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=id`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Gagal mengambil data cuaca saat ini:", error);
        return null;
    }
}

async function processAndSendNotification(user, schedule, lat, lon, channels, notificationMinutes) {
    try {
        const [current, forecastData] = await Promise.all([
            getCurrentWeather(lat, lon),
            get5DayForecast(lat, lon)
        ]);

        if (!current || !forecastData) {
            console.log(`Data cuaca tidak lengkap untuk jadwal ${schedule.name}`);
            return;
        }

        const scheduleTime = new Date(Date.now() + notificationMinutes * 60 * 1000); 
        const forecastForSchedule = findClosestForecast(forecastData.list, scheduleTime);
        const generatedText = await generateWeatherNarrative(current, forecastForSchedule, schedule, user, notificationMinutes);
        
        const sendPromises = [];

        if (channels.email) {
            const plainTextVersion = generatedText.replace(/<br\s*\/?>/gi, '\n');
            const msg = {
                to: channels.email,
                from: { name: 'Weathrly', email: 'asisten@weathrly.web.id' },
                subject: `🔔 Weathrly: Pengingat Jadwal "${schedule.name}"`,
                text: plainTextVersion,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        ${generatedText.replace(/\n/g, '<br>')}
                        <br><br>
                        <p style="font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
                            P.S. Pastikan jadwal Anda tetap diperbarui agar notifikasi cuaca selalu akurat.
                        </p>
                    </div>
                `,
            };
            sendPromises.push(sgMail.send(msg).then(() => console.log(`Email berhasil dikirim ke ${channels.email}`)));
        }

        if (channels.telegram) {
            sendPromises.push(sendTelegramMessage(channels.telegram, generatedText));
        }

        await Promise.all(sendPromises);
        console.log(`Notifikasi berhasil diproses untuk ${user.email} (Jadwal: "${schedule.name}")`);

    } catch (error) {
        console.error(`Gagal memproses notifikasi untuk ${user.email}:`, error);
    }
}

async function generateWeatherNarrative(currentWeather, forecastWeather, schedule, user, notificationMinutes) {
    if (!currentWeather || !forecastWeather) {
        return "Sayangnya, kami tidak dapat mengambil data prakiraan cuaca saat ini. Mohon periksa kembali nanti.";
    }
    const userName = user.displayName || user.email.split('@')[0];
    const { main: currentMain, weather: currentWeatherDesc } = currentWeather;
    const { main: forecastMain, weather: forecastWeatherDesc } = forecastWeather;
    const timeText = formatMinutesToText(notificationMinutes);
    
    const prompt = `
        Anda adalah "Asisten Weathrly" dari aplikasi Weathrly. Gaya bicara Anda santai, hangat, dan
        super personal seperti teman akrab yang mengingatkan. Gunakan bahasa sehari-hari yang tidak 
        kaku, seolah sedang mengobrol via chat. Gunakan kata ganti "kamu", bukan "Anda". 
        JANGAN gunakan format Halo [Nama Jadwal]. Mulai selalu dengan sapaan ke nama pengguna.
        Tugas Anda adalah membuat isi email notifikasi berdasarkan data yang saya berikan.
        Ikuti struktur ini DENGAN TEPAT:
        1. Sapaan Personal: Mulai dengan "Hai [Nama Pengguna],"
        2. Kalimat Konteks: Buat kalimat pembuka yang santai untuk mengingatkan jadwal mereka dan waktunya. (Contoh: "Cuma mau ngingetin, jadwal '[Nama Jadwal]' kamu bakal mulai ${timeText} lagi nih.")
        3. Cuaca Saat Ini (Ceritakan, Jangan Laporkan): Jelaskan cuaca saat ini di [Lokasi] menggunakan gaya percakapan yang mengalir.
           - JANGAN hanya menyebutkan data seperti "Suhu 28°C dengan kelembapan 80%". Alih-alih, ceritakan rasanya.
           - Gabungkan suhu, feels like, kondisi langit, dan kelembapan menjadi cerita singkat.        
        4. [MODIFIKASI] Prakiraan ${timeText} Kedepan (Fokus Perubahan & Makna): Berikan prediksi cuaca untuk ${timeText} mendatang berdasarkan data "Prakiraan Cuaca". Ini adalah bagian terpenting.
           - Kalau ada perubahan signifikan (misal: dari cerah ke hujan), sebutkan dengan jelas dan beri tahu apa artinya untuk jadwal mereka. Buat seolah-olah kamu memberi 'bocoran' cuaca.      
        5. Saran/Rekomendasi: Berikan saran singkat yang relevan dan masuk akal dengan jadwal serta prakiraan cuaca ${timeText} lagi (bukan cuaca saat ini). Gunakan gaya bicara seperti teman yang peduli.
           - Jika akan hujan untuk jadwal "Lari sore", gunakan nada yang tetap menyemangati sambil menyarankan solusi.
           - Jika cuaca cerah dan panas, arahkan pada kenyamanan dan perlindungan.          
           - Jika cerah dan tenang untuk aktivitas santai seperti “Piknik” atau “Jalan sore”, beri nada antusias dan positif.
           - Jika cuaca ekstrem (misal hujan lebat atau panas menyengat), arahkan untuk menunda atau mengganti aktivitas.
        6. Penutup Ramah: Akhiri dengan kalimat penutup yang positif dan relevan dengan jadwalnya. (Contoh: "Semoga perjalanan pulang Anda lancar!" atau "Semoga olahraganya seru ya!").
        7. Tanda Tangan: Akhiri HANYA dengan "- Asisten Weathrly". JANGAN tambahkan "Salam," atau "Tim Weathrly".

        ATURAN PENTING:
        JANGAN PERNAH menggunakan bahasa promosi, marketing, atau kata-kata ajakan untuk 'upgrade', 'premium', 'gratis', 'penawaran', 'diskon', 'terbaik', 'nikmati'.
        Fokus HANYA pada cuaca, jadwal, dan saran yang relevan. Ini adalah notifikasi obrolan, bukan promosi.
        
        Berikut adalah datanya:
        - Nama Pengguna: ${userName}
        - Nama Jadwal: ${schedule.name}
        - Waktu Jadwal: ${schedule.time}
        - Zona Waktu: ${schedule.timezone}
        - Lokasi: ${schedule.locationName} 
        - Data Cuaca Saat Ini:
            - Kondisi: ${currentWeatherDesc[0].description}
            - Suhu: ${Math.round(currentMain.temp)}°C
            - Terasa Seperti: ${Math.round(currentMain.feels_like)}°C
            - Kelembapan: ${currentMain.humidity}%
        - Data Prakiraan Cuaca (untuk ${timeText} lagi):
            - Kondisi: ${forecastWeatherDesc[0].description}
            - Suhu: ${Math.round(forecastMain.temp)}°C
            - Terasa Seperti: ${Math.round(forecastMain.feels_like)}°C
            - Kelembapan: ${forecastMain.humidity}%
        Pastikan outputnya adalah satu blok teks yang siap dimasukkan ke dalam email.
    `;
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gagal generate konten Gemini:", error);
        return `Hai ${userName}, jadwal "${schedule.name}" Anda akan dimulai dalam ${timeText}. Cuaca diperkirakan ${forecastWeatherDesc[0].description} dengan suhu sekitar ${Math.round(forecastMain.temp)}°C.`;
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
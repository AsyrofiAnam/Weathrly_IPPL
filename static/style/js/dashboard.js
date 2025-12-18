const firebaseConfig = {
    apiKey: "AIzaSyCc6_x7GtGCpAfyNWpuDVEKQ2qJdzygSII",
    authDomain: "weathrly-cc25-1.firebaseapp.com",
    projectId: "weathrly-cc25-1",
    storageBucket: "weathrly-cc25-1.firebasestorage.app",
    messagingSenderId: "175538007441",
    appId: "1:175538007441:web:4b9158a036a6fec27f7e30"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
let currentUser = null;
let currentUserData = null;
let userLocations = [];

async function fetchWeather(lat, lon) {
    const apiUrl = `/.netlify/functions/get-weather?lat=${lat}&lon=${lon}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const weatherData = await response.json();
        updateWeatherUI(weatherData);
    } catch (error) {
        showNotification('Gagal memuat data cuaca saat ini.', 'error');
    }
}

function updateWeatherUI(data) {
    const weatherDetailsEl = document.getElementById('main-weather-details');
    const weatherIconEl = document.getElementById('weather-icon');

    if (!data || !data.main || !data.weather) {
        return;
    }

    const temperature = Math.round(data.main.temp);
    const description = data.weather[0].description;
    const feelsLike = Math.round(data.main.feels_like);
    const humidity = data.main.humidity;
    const iconCode = data.weather[0].icon;

    weatherDetailsEl.innerHTML = `
    <div class="flex justify-center items-center text-center">
        <div class="px-4 sm:px-6">
            <p class="text-3xl sm:text-4xl font-bold">${temperature}°C</p>
            <p class="text-sm mt-1" style="color: var(--text-color-secondary);">Suhu Saat Ini</p>
        </div>
        <div class="self-stretch border-l" style="border-color: var(--card-border);"></div>
        <div class="px-4 sm:px-6 text-left">
            <p class="font-semibold text-lg">${description.charAt(0).toUpperCase() + description.slice(1)}</p>
            <p class="text-sm mt-0.5" style="color: var(--text-color-secondary);">Terasa Seperti: <strong>${feelsLike}°C</strong></p>
            <p class="text-sm" style="color: var(--text-color-secondary);">Kelembapan: <strong>${humidity}%</strong></p>
        </div>
    </div>
    `;
    weatherIconEl.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
    weatherIconEl.alt = `Ikon cuaca: ${description}`;
}

function resetWeatherUI() {
    const weatherDetailsEl = document.getElementById('main-weather-details');
    const weatherIconEl = document.getElementById('weather-icon');
    weatherDetailsEl.innerHTML = `
    <div class="flex justify-center items-center text-center">
        <div class="px-4 sm:px-6">
            <p class="text-3xl sm:text-4xl font-bold">--°C</p>
            <p class="text-sm mt-1" style="color: var(--text-color-secondary);">Suhu Saat Ini</p>
        </div>
        <div class="self-stretch border-l" style="border-color: var(--card-border);"></div>
        <div class="px-4 sm:px-6 text-left">
            <p class="font-semibold text-lg">-----</p>
            <p class="text-sm mt-0.5" style="color: var(--text-color-secondary);">Terasa Seperti: <strong>--°C</strong></p>
            <p class="text-sm" style="color: var(--text-color-secondary);">Kelembapan: <strong>--%</strong></p>
        </div>
    </div>
    `;
    weatherIconEl.src = 'https://openweathermap.org/img/wn/02d@4x.png';
    weatherIconEl.alt = 'Ilustrasi cuaca';
}

function showNotification(message, type = 'success') {
    const backgroundColor = type === 'success'
        ? 'linear-gradient(to right, #34D399, #10B981)'
        : 'linear-gradient(to right, #F87171, #EF4444)';
    Toastify({
        text: message, duration: 5000, close: false, gravity: "top", position: "center", stopOnFocus: true,
        style: {
            background: backgroundColor, backdropFilter: 'blur(5px)', border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px', color: '#fff', fontWeight: '500', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        },
    }).showToast();
}

function isPremiumUser() {
    return currentUserData && currentUserData.plan === 'premium';
}

function toggleCollapsibleSection(toggle, container) {
    if (toggle.checked) {
        container.classList.remove('collapsed');
    } else {
        container.classList.add('collapsed');
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const html = document.documentElement;
    
    const navbar = document.getElementById('navbar');
    const avatarButton = document.getElementById('avatar-button');
    const logoutDropdown = document.getElementById('logout-dropdown');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconMenu = document.getElementById('icon-menu');
    const iconClose = document.getElementById('icon-close');
    const themeToggleInput = document.getElementById('theme-toggle-input');
    const themeToggleMobile = document.getElementById('theme-toggle-mobile');
    
    const locationModal = document.getElementById('location-modal');
    const scheduleModal = document.getElementById('schedule-modal');
    const upgradeModal = document.getElementById('upgrade-modal');
    const telegramModal = document.getElementById('telegram-modal');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmUpgradeBtn = document.getElementById('confirm-upgrade-btn'); // [TAMBAHKAN INI]
    
    const locationForm = document.getElementById('location-form');
    const locationInput = document.getElementById('location-search-input');
    const locationContainer = document.getElementById('location-container');
    const locationDisplayCard = document.getElementById('location-display-card');
    const emptyLocationMsg = document.getElementById('empty-location-msg');
    const addLocationBtn = document.getElementById('add-location-btn');
    const upgradeForLocationsMsg = document.getElementById('upgrade-for-locations-msg');
    const getCurrentLocationBtn = document.getElementById('get-current-location-btn');
    
    const scheduleForm = document.getElementById('schedule-form');
    const scheduleContainer = document.getElementById('schedule-container');
    const emptyScheduleMsg = document.getElementById('empty-schedule-msg');
    const scheduleDisplayCard = document.getElementById('schedule-display-card');
    const addScheduleBtn = document.getElementById('add-schedule-btn');
    const upgradeForSchedulesMsg = document.getElementById('upgrade-for-schedules-msg');
    const scheduleLocationSelect = document.getElementById('schedule-location');
    const noLocationWarning = document.getElementById('no-location-warning');
    
    const emailNotificationToggle = document.getElementById('email-notification-toggle');
    
    const dailySummaryCard = document.getElementById('daily-summary-card');
    const dailySummaryToggle = document.getElementById('daily-summary-toggle');
    const summaryTimeInput = document.getElementById('summary-time');
    const summaryTimezoneSelect = document.getElementById('summary-timezone');
    const dailySummaryOptionsContainer = document.getElementById('daily-summary-options-container');
    
    const smartAlertCard = document.getElementById('smart-alert-card');
    const smartAlertToggle = document.getElementById('smart-alert-toggle');
    const smartAlertScheduleList = document.getElementById('smart-alert-schedule-list');
    const smartAlertOptionsContainer = document.getElementById('smart-alert-options-container');
    
    const telegramForm = document.getElementById('telegram-form');
    const telegramConnectBtn = document.getElementById('telegram-connect-btn');
    const telegramInput = document.getElementById('telegram-username');
    const telegramStep1 = document.getElementById('telegram-step-1');
    const telegramStep2 = document.getElementById('telegram-step-2');
    const telegramVerificationInput = document.getElementById('telegram-verification-code');
    const telegramSubmitBtn = document.getElementById('telegram-submit-btn');
    
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const closeConfirmationBtns = document.querySelectorAll('.close-confirmation-btn');

    document.body.classList.add('no-scroll');
    let map;
    let marker;
    let isEditingLocation = false;
    let isEditingSchedule = false;
    let editingDocId = null;
    let confirmCallback = null;

    function openConfirmationModal(message, onConfirm) {
        confirmationMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmationModal.classList.remove('hidden', 'modal-closing');
    }

    function closeConfirmationModal() {
        confirmationModal.classList.add('modal-closing');
        setTimeout(() => {
            confirmationModal.classList.add('hidden');
            confirmCallback = null;
        }, 200);
    }

    confirmDeleteBtn.addEventListener('click', () => {
        if (typeof confirmCallback === 'function') {
            confirmCallback();
        }
        closeConfirmationModal();
    });

    closeConfirmationBtns.forEach(btn => btn.addEventListener('click', closeConfirmationModal));

    let isLoggingOut = false;

    let urlNotificationShown = false;

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            const userDocRef = db.collection('users').doc(user.uid);

            userDocRef.onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        currentUserData = doc.data();
                        updateUserInfoUI(user, currentUserData);
                        applyPlanLimitations();

                        // [BARU] Atur Link Pengaturan agar sesuai slug pengguna
                        const userSlug = currentUserData.slug || 'user';
                        const settingsUrl = `/${userSlug}/settings`;

                        const settingsLinkDesktop = document.getElementById('settings-link-desktop');
                        if (settingsLinkDesktop) settingsLinkDesktop.href = settingsUrl;

                        const settingsLinkMobile = document.getElementById('settings-link-mobile');
                        if (settingsLinkMobile) settingsLinkMobile.href = settingsUrl;

                        loadLocations();
                        loadSchedules();

                        if (isPremiumUser()) {
                            loadDailySummarySettings();
                            loadNotificationSettings();
                            loadSmartAlertSchedules();
                        }

                        if (currentUserData.slug) {
                            const correctPath = `/${currentUserData.slug}`;
                            if (window.location.pathname !== correctPath) {
                                // Ganti URL di browser tanpa reload
                                history.replaceState(null, '', correctPath);
                            }
                        }

                        if (!urlNotificationShown) {
                            showPaymentNotificationFromURL();
                            urlNotificationShown = true;
                        }

                        const loadingOverlay = document.getElementById('loading-overlay');
                        if (loadingOverlay && loadingOverlay.style.display !== 'none') {
                            setTimeout(() => {
                                loadingOverlay.style.opacity = '0';
                                document.body.classList.remove('no-scroll');
                                setTimeout(() => loadingOverlay.style.display = 'none', 500);
                            }, 500);
                        }
                    } else {
                        isLoggingOut = true;
                        firebase.auth().signOut();
                    }
                },
                (error) => {
                    
                    isLoggingOut = true;
                    firebase.auth().signOut();
                }
            );
        } else {
            if (!isLoggingOut) {
                window.location.href = '/';
            }
        }
    });

    function showPaymentNotificationFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');

        if (paymentStatus === 'success') {
            showNotification(
                'Pembayaran berhasil! Akun Anda kini aktif sebagai Premium.',
                'success'
            );
            history.replaceState(null, '', window.location.pathname);
        } else if (paymentStatus === 'failed') {
            showNotification(
                'Pembayaran gagal atau dibatalkan. Silakan coba lagi.',
                'error'
            );
            history.replaceState(null, '', window.location.pathname);
        }
    }

    function updateUserInfoUI(user, userData) {
        const displayName = userData.displayName || user.displayName || user.email.split('@')[0];
        document.getElementById('dropdown-user-name').textContent = displayName;
        document.getElementById('dropdown-user-email').textContent = userData.email || user.email;
        document.getElementById('mobile-dropdown-user-name').textContent = displayName;
        document.getElementById('mobile-dropdown-user-email').textContent = userData.email || user.email;
        const photoURL = userData.photoURL || user.photoURL;
        if (photoURL) {
            document.getElementById('user-avatar').src = photoURL;
            document.getElementById('mobile-user-avatar').src = photoURL;
        }
        emailNotificationToggle.checked = userData.emailNotificationsEnabled !== false;
    }

    function applyPlanLimitations() {
        const isPremium = isPremiumUser();
        const premiumTeaserCard = document.getElementById('premium-teaser-card');
        const dashboardGrid = document.getElementById('dashboard-grid');
        const upgradeButtons = document.querySelectorAll('#upgrade-btn-nav, #upgrade-btn-mobile');
        const upgradeMessages = document.querySelectorAll('#upgrade-for-locations-msg, #upgrade-for-schedules-msg, #notification-upgrade-msg');
        const locationSubtitle = document.getElementById('location-subtitle');
        const scheduleSubtitle = document.getElementById('schedule-subtitle');
        const scheduleNotificationTimeGroup = document.getElementById('schedule-notification-time-group');
        const freeScheduleMessage = document.querySelector('.free-feature-message');
        const premiumLocks = document.querySelectorAll('.premium-feature-lock');
        const premiumControls = document.querySelectorAll('.premium-feature-control');

        if (isPremium) {
            premiumTeaserCard.classList.add('hidden');
            dailySummaryCard.classList.remove('hidden');
            smartAlertCard.classList.remove('hidden');
            dashboardGrid.classList.remove('lg:grid-cols-[1.9fr_1fr]');
            upgradeButtons.forEach(btn => btn.classList.add('hidden'));
            upgradeMessages.forEach(msg => msg.classList.add('hidden'));
            locationSubtitle.textContent = 'Anda dapat menambahkan hingga 5 lokasi.';
            scheduleSubtitle.textContent = 'Anda dapat menambahkan hingga 5 jadwal.';
            scheduleNotificationTimeGroup.classList.remove('hidden');
            if (freeScheduleMessage) freeScheduleMessage.classList.add('hidden');
            premiumLocks.forEach(lock => lock.classList.add('hidden'));
            premiumControls.forEach(control => {
                control.classList.remove('opacity-60');
                const btn = control.querySelector('button[id$="-connect-btn"]');
                if (btn) {
                    btn.classList.replace('btn-disabled', 'btn-cta');
                    btn.disabled = false;
                }
            });
        } else {
            premiumTeaserCard.classList.remove('hidden');
            dailySummaryCard.classList.add('hidden');
            smartAlertCard.classList.add('hidden');
            dashboardGrid.classList.add('lg:grid-cols-[1.9fr_1fr]');
            upgradeButtons.forEach(btn => btn.classList.remove('hidden'));
            document.getElementById('notification-upgrade-msg').classList.remove('hidden');
            locationSubtitle.textContent = 'Anda hanya dapat memiliki satu lokasi utama di paket gratis.';
            scheduleSubtitle.textContent = 'Anda hanya dapat memiliki satu jadwal aktif di paket gratis.';
            scheduleNotificationTimeGroup.classList.add('hidden');
            if (freeScheduleMessage) freeScheduleMessage.classList.remove('hidden');
            premiumLocks.forEach(lock => lock.classList.remove('hidden'));
            premiumControls.forEach(control => {
                control.classList.add('opacity-60');
                const btn = control.querySelector('button[id$="-connect-btn"]');
                if (btn) {
                    btn.classList.replace('btn-cta', 'btn-disabled');
                    btn.disabled = true;
                }
            });
        }
    }

    async function loadLocations() {
        if (!currentUser) return;
        const locationsCollection = db.collection('users').doc(currentUser.uid).collection('locations');
        const maxLocations = isPremiumUser() ? 5 : 1;
        const snapshot = await locationsCollection.orderBy('createdAt').limit(maxLocations).get();
        locationDisplayCard.innerHTML = '';
        userLocations = [];
        if (snapshot.empty) {
            emptyLocationMsg.classList.remove('hidden');
            locationDisplayCard.classList.add('hidden');
            resetWeatherUI();
            document.getElementById('main-weather-location').textContent = 'Cuaca Saat Ini';
        } else {
            emptyLocationMsg.classList.add('hidden');
            locationDisplayCard.classList.remove('hidden');
            snapshot.forEach(doc => {
                const locationData = doc.data();
                userLocations.push({ id: doc.id, ...locationData });
                const cardEl = document.createElement('div');
                cardEl.innerHTML = getRenderedLocationCardHTML(locationData.name, doc.id);
                locationDisplayCard.appendChild(cardEl.firstElementChild);
            });
            const firstLoc = userLocations[0];
            fetchWeather(firstLoc.latitude, firstLoc.longitude);
            document.getElementById('main-weather-location').textContent = `Cuaca Saat Ini di ${firstLoc.name}`;
        }
        if (snapshot.size >= maxLocations) {
            addLocationBtn.disabled = true;
            addLocationBtn.classList.add('opacity-60', 'cursor-not-allowed', 'disabled');
            if (!isPremiumUser()) {
                upgradeForLocationsMsg.classList.remove('hidden');
            }
        } else {
            addLocationBtn.disabled = false;
            addLocationBtn.classList.remove('opacity-60', 'cursor-not-allowed', 'disabled');
            upgradeForLocationsMsg.classList.add('hidden');
        }
    }

    async function loadSchedules() {
        if (!currentUser) return;
        const schedulesCollection = db.collection('users').doc(currentUser.uid).collection('schedules');
        const maxSchedules = isPremiumUser() ? 5 : 1;
        const snapshot = await schedulesCollection.orderBy('createdAt').limit(maxSchedules).get();
        scheduleDisplayCard.innerHTML = '';
        if (snapshot.empty) {
            emptyScheduleMsg.classList.remove('hidden');
            scheduleDisplayCard.classList.add('hidden');
        } else {
            emptyScheduleMsg.classList.add('hidden');
            scheduleDisplayCard.classList.remove('hidden');
            snapshot.forEach(doc => {
                const scheduleData = doc.data();
                const cardEl = document.createElement('div');
                cardEl.innerHTML = getRenderedScheduleCardHTML(scheduleData, doc.id);
                scheduleDisplayCard.appendChild(cardEl.firstElementChild);
            });
        }
        if (snapshot.size >= maxSchedules) {
            addScheduleBtn.disabled = true;
            addScheduleBtn.classList.add('opacity-60', 'cursor-not-allowed', 'disabled');
            if (!isPremiumUser()) {
                upgradeForSchedulesMsg.classList.remove('hidden');
            }
        } else {
            addScheduleBtn.disabled = false;
            addScheduleBtn.classList.remove('opacity-60', 'cursor-not-allowed', 'disabled');
            upgradeForSchedulesMsg.classList.add('hidden');
        }
    }

    window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));

    const applyTheme = (theme) => {
        const isDark = theme === 'dark';
        html.classList.toggle('dark', isDark);
        themeToggleInput.checked = isDark;
        themeToggleMobile.checked = isDark;
    };

    const setTheme = (isDark) => {
        const currentTheme = isDark ? 'dark' : 'light';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    };

    themeToggleInput.addEventListener('change', (e) => setTheme(e.target.checked));
    themeToggleMobile.addEventListener('change', (e) => setTheme(e.target.checked));
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    const handleLogout = (e) => {
        e.preventDefault();
        isLoggingOut = true;
        firebase.auth().signOut().then(() => {
            showNotification('Anda berhasil keluar.', 'success');
            setTimeout(() => { window.location.href = '/'; }, 1500);
        }).finally(() => {
            setTimeout(() => { isLoggingOut = false; }, 3000);
        });
    };

    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('logout-btn-mobile').addEventListener('click', handleLogout);

    avatarButton.addEventListener('click', () => {
        logoutDropdown.classList.toggle('hidden');
        logoutDropdown.classList.toggle('opacity-0');
        logoutDropdown.classList.toggle('scale-95');
    });

    window.addEventListener('click', (e) => {
        if (!avatarButton.contains(e.target) && !logoutDropdown.contains(e.target)) {
            logoutDropdown.classList.add('hidden', 'opacity-0', 'scale-95');
        }
    });

    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('menu-open');
        iconMenu.classList.toggle('hidden');
        iconClose.classList.toggle('hidden');
    });

    getCurrentLocationBtn.addEventListener('click', getCurrentLocation);

    emailNotificationToggle.addEventListener('change', async (e) => {
        if (!currentUser) return;
        const isEnabled = e.target.checked;
        const userDocRef = db.collection('users').doc(currentUser.uid);
        try {
            await userDocRef.update({ emailNotificationsEnabled: isEnabled });
            const status = isEnabled ? "diaktifkan" : "dinonaktifkan";
            showNotification(`Notifikasi email berhasil ${status}.`, 'success');
        } catch (error) {
            showNotification('Gagal menyimpan pengaturan. Coba lagi.', 'error');
            e.target.checked = !isEnabled;
        }
    });

    const openModal = (modal) => modal.classList.remove('hidden');
    const closeModal = (modal) => modal.classList.add('hidden');

    addLocationBtn.addEventListener('click', () => {
        prepareLocationModalForAdd();
        openModal(locationModal);
        setTimeout(initializeMap, 100);
    });
    addScheduleBtn.addEventListener('click', () => {
        prepareScheduleModalForAdd();
        openModal(scheduleModal);
    });
    document.querySelectorAll('#upgrade-btn-nav, #upgrade-btn-sidebar, #upgrade-btn-mobile, .upgrade-popup-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(locationModal);
            closeModal(scheduleModal);
            openModal(upgradeModal);
        });
    });
    document.querySelectorAll('.modal-backdrop, .close-modal-btn').forEach(el => {
        el.addEventListener('click', () => {
            closeModal(locationModal);
            closeModal(scheduleModal);
            closeModal(upgradeModal);
            closeModal(telegramModal);
            if (!confirmationModal.classList.contains('hidden')) {
                closeConfirmationModal();
            }
        });
    });

    function initializeMap() {
        if (map) { map.invalidateSize(); return; }
        const savedZoom = localStorage.getItem('weathrly_map_zoom');
        const initialZoom = savedZoom ? parseInt(savedZoom, 10) : 5;
        const bounds = L.latLngBounds(L.latLng(-11, 95), L.latLng(6, 141));
        map = L.map('map', { center: [-2.5, 118], zoom: initialZoom, maxBounds: bounds, minZoom: 5 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        map.on('zoomend', () => localStorage.setItem('weathrly_map_zoom', map.getZoom()));

        map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            updateMarker(lat, lng);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id&zoom=18`);
                const data = await response.json();
                let locationName = 'Lokasi tidak dikenal';
                if (data && data.address) {
                    const addr = data.address;
                    const place = addr.suburb || addr.village || addr.town || addr.city || addr.county;
                    const state = addr.state || addr.region || '';
                    if (place && state) {
                        locationName = place.toLowerCase() !== state.toLowerCase() ? `${place}, ${state}` : place;
                    } else if (place || state) {
                        locationName = place || state;
                    } else if (data.display_name) {
                        locationName = data.display_name;
                    }
                } else if (data.display_name) {
                    locationName = data.display_name;
                }
                locationInput.value = locationName;
            } catch (error) {
                showNotification('Gagal mengambil nama lokasi.', 'error');
            }
        });
    }

    function updateMarker(lat, lon) {
        if (marker) { map.removeLayer(marker); }
        marker = L.marker([lat, lon]).addTo(map);
        map.setView([lat, lon], map.getZoom());
    }

    locationInput.addEventListener('change', async function (e) {
        const query = e.target.value;
        if (query.length < 3) return;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=id&limit=1`);
            const data = await response.json();
            if (data.length > 0) {
                const { lat, lon } = data[0];
                updateMarker(parseFloat(lat), parseFloat(lon));
            } else { showNotification('Lokasi tidak ditemukan.', 'error'); }
        } catch (error) { showNotification('Gagal mencari lokasi.', 'error'); }
    });

    function prepareLocationModalForAdd() {
        isEditingLocation = false;
        editingDocId = null;
        locationForm.reset();
        if (marker) { map.removeLayer(marker); marker = null; }
        if (map) { map.setView([-2.5, 118], 5); }
        document.getElementById('location-modal-title').textContent = 'Tambah Lokasi Baru';
        document.getElementById('location-submit-btn').textContent = 'Simpan Lokasi';
    }

    locationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const newLocationName = locationInput.value;
        const locationCoords = marker ? marker.getLatLng() : null;
        if (!newLocationName || !locationCoords) {
            showNotification('Nama lokasi dan pin di peta tidak boleh kosong.', 'error');
            return;
        }
        const locationData = { name: newLocationName, latitude: locationCoords.lat, longitude: locationCoords.lng };
        const locationsCollection = db.collection('users').doc(currentUser.uid).collection('locations');
        let promise;
        if (isEditingLocation && editingDocId) {
            locationData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            promise = locationsCollection.doc(editingDocId).update(locationData);
        } else {
            locationData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            promise = locationsCollection.add(locationData);
        }
        promise.then(() => {
            const message = isEditingLocation ? `Lokasi berhasil diperbarui` : `Lokasi berhasil disimpan`;
            showNotification(message, 'success');
            loadLocations();
            closeModal(locationModal);
        }).catch(() => showNotification('Terjadi kesalahan. Coba lagi.', 'error')
        ).finally(() => {
            isEditingLocation = false;
            editingDocId = null;
        });
    });

    function getRenderedLocationCardHTML(locationName, docId) {
        return `
        <div class="inner-card p-4 rounded-lg flex items-center justify-between" data-id="${docId}">
            <p class="location-name font-semibold text-md">${locationName}</p>
            <div class="flex items-center gap-2">
                <button id="edit-location-btn" class="action-btn p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                </button>
                <button id="delete-location-btn" class="action-btn p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                </button>
            </div>
        </div>`;
    }

    locationContainer.addEventListener('click', (e) => {
        const card = e.target.closest('[data-id]');
        if (!card) return;
        const docId = card.getAttribute('data-id');
        const deleteBtn = e.target.closest('#delete-location-btn');
        const editBtn = e.target.closest('#edit-location-btn');

        if (deleteBtn) {
            openConfirmationModal(
                'Apakah Anda yakin ingin menghapus lokasi ini? Jadwal yang terkait dengan lokasi ini mungkin perlu diperbarui.',
                () => {
                    db.collection('users').doc(currentUser.uid).collection('locations').doc(docId).delete()
                        .then(() => {
                            showNotification('Lokasi berhasil dihapus.', 'success');
                            loadLocations();
                            loadSchedules();
                            loadSmartAlertSchedules();
                        })
                        .catch(() => showNotification('Gagal menghapus lokasi.', 'error'));
                }
            );
        }

        if (editBtn) {
            editingDocId = docId;
            isEditingLocation = true;
            locationInput.value = card.querySelector('.location-name').textContent;
            document.getElementById('location-modal-title').textContent = 'Edit Lokasi';
            document.getElementById('location-submit-btn').textContent = 'Simpan Perubahan';
            openModal(locationModal);
            db.collection('users').doc(currentUser.uid).collection('locations').doc(editingDocId).get()
                .then((doc) => {
                    if (doc.exists) {
                        const { latitude, longitude } = doc.data();
                        setTimeout(() => {
                            initializeMap();
                            updateMarker(latitude, longitude);
                        }, 100);
                    } else {
                        showNotification('Gagal memuat data lokasi.', 'error');
                    }
                })
                .catch(() => showNotification('Gagal memuat data lokasi.', 'error'));
        }
    });

    function populateLocationDropdown() {
        scheduleLocationSelect.innerHTML = '';
        if (userLocations.length > 0) {
            userLocations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc.id;
                option.textContent = loc.name;
                scheduleLocationSelect.appendChild(option);
            });
            scheduleLocationSelect.disabled = false;
            noLocationWarning.classList.add('hidden');
            document.getElementById('schedule-submit-btn').disabled = false;
        } else {
            const option = document.createElement('option');
            option.textContent = 'Tidak ada lokasi tersimpan';
            scheduleLocationSelect.appendChild(option);
            scheduleLocationSelect.disabled = true;
            noLocationWarning.classList.remove('hidden');
            document.getElementById('schedule-submit-btn').disabled = true;
        }
    }

    function prepareScheduleModalForAdd() {
        isEditingSchedule = false;
        editingDocId = null;
        scheduleForm.reset();
        document.getElementById('schedule-notification-time').value = '60';
        document.querySelectorAll('input[name="day"]').forEach(cb => cb.checked = false);
        populateLocationDropdown();
        document.getElementById('schedule-modal-title').textContent = 'Tambah Jadwal Baru';
        document.getElementById('schedule-submit-btn').textContent = 'Simpan Jadwal';
    }

    scheduleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const selectedOption = scheduleLocationSelect.options[scheduleLocationSelect.selectedIndex];
        const scheduleData = {
            name: document.getElementById('schedule-name').value,
            locationId: selectedOption.value,
            locationName: selectedOption.textContent,
            time: document.getElementById('schedule-time').value,
            days: Array.from(document.querySelectorAll('input[name="day"]:checked')).map(cb => cb.value),
            timezone: document.getElementById('schedule-timezone').value,
            notificationTime: isPremiumUser() ? document.getElementById('schedule-notification-time').value : '60'
        };
        if (scheduleData.days.length === 0) {
            showNotification('Silakan pilih minimal satu hari.', 'error');
            return;
        }
        const schedulesCollection = db.collection('users').doc(currentUser.uid).collection('schedules');
        let promise;
        if (isEditingSchedule && editingDocId) {
            scheduleData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            promise = schedulesCollection.doc(editingDocId).update(scheduleData);
        } else {
            scheduleData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            promise = schedulesCollection.add(scheduleData);
        }
        promise.then(() => {
            const message = isEditingSchedule ? 'Jadwal berhasil diperbarui!' : 'Jadwal berhasil disimpan!';
            showNotification(message, 'success');
            loadSchedules();
            loadSmartAlertSchedules();
            closeModal(scheduleModal);
        }).catch(() => showNotification('Gagal menyimpan jadwal.', 'error')
        ).finally(() => {
            isEditingSchedule = false;
            editingDocId = null;
        });
    });

    function getRenderedScheduleCardHTML(scheduleData, docId) {
        const { name, locationName, days, time, timezone, notificationTime } = scheduleData;
        const formatNotificationTime = (minutes) => {
            const mins = parseInt(minutes, 10);
            if (isNaN(mins)) return '1 jam';
            const hours = Math.floor(mins / 60);
            const remainingMinutes = mins % 60;
            let text = '';
            if (hours > 0) text += `${hours} jam`;
            if (remainingMinutes > 0) {
                if (hours > 0) text += ' ';
                text += `${remainingMinutes} menit`;
            }
            return text || '1 jam';
        };
        const notificationText = formatNotificationTime(notificationTime);
        return `
        <div class="inner-card p-4 rounded-lg" data-id="${docId}">
            <div class="flex items-center justify-between">
                <div>
                    <p class="schedule-name font-bold text-lg">${name}</p>
                    <p class="schedule-location text-sm font-semibold" style="color: var(--text-color-primary);">${locationName}</p>
                    <p class="schedule-details text-sm" style="color: var(--text-color-secondary);">
                        <span class="schedule-days">${days.join(', ')}</span> - Pukul <span class="schedule-time">${time}</span> <span class="schedule-timezone">${timezone || 'WIB'}</span>
                    </p>
                    ${isPremiumUser() ? `
                    <p class="schedule-notification-info text-xs mt-1" style="color: var(--text-color-secondary);">
                        Notifikasi akan dikirim ${notificationText} lebih awal
                    </p>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <button id="edit-schedule-btn" class="action-btn p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                    </button>
                    <button id="delete-schedule-btn" class="action-btn p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
            </div>
        </div>`;
    }

    scheduleContainer.addEventListener('click', function (e) {
        const card = e.target.closest('[data-id]');
        if (!card) return;
        const docId = card.getAttribute('data-id');
        const deleteBtn = e.target.closest('#delete-schedule-btn');
        const editBtn = e.target.closest('#edit-schedule-btn');

        if (deleteBtn) {
            openConfirmationModal(
                'Apakah Anda yakin ingin menghapus jadwal ini? Tindakan ini tidak dapat dibatalkan.',
                () => {
                    db.collection('users').doc(currentUser.uid).collection('schedules').doc(docId).delete()
                        .then(() => {
                            showNotification('Jadwal berhasil dihapus.', 'success');
                            loadSchedules();
                            loadSmartAlertSchedules();
                        })
                        .catch(() => showNotification('Gagal menghapus jadwal.', 'error'));
                }
            );
        }

        if (editBtn) {
            editingDocId = docId;
            isEditingSchedule = true;
            db.collection('users').doc(currentUser.uid).collection('schedules').doc(editingDocId).get()
                .then(doc => {
                    if (doc.exists) {
                        const scheduleData = doc.data();
                        populateLocationDropdown();
                        document.getElementById('schedule-name').value = scheduleData.name;
                        scheduleLocationSelect.value = scheduleData.locationId;
                        document.getElementById('schedule-time').value = scheduleData.time;
                        document.getElementById('schedule-timezone').value = scheduleData.timezone || 'WIB';
                        document.getElementById('schedule-notification-time').value = scheduleData.notificationTime || '60';
                        document.querySelectorAll('input[name="day"]').forEach(checkbox => {
                            checkbox.checked = scheduleData.days.includes(checkbox.value);
                        });
                        document.getElementById('schedule-modal-title').textContent = 'Edit Jadwal';
                        document.getElementById('schedule-submit-btn').textContent = 'Simpan Perubahan';
                        openModal(scheduleModal);
                    } else {
                        showNotification('Gagal memuat data jadwal untuk diedit.', 'error');
                    }
                }).catch(() => showNotification('Terjadi kesalahan saat memuat data.', 'error'));
        }
    });

    function loadDailySummarySettings() {
        if (!isPremiumUser()) return;
        const summary = currentUserData.dailySummary;
        dailySummaryToggle.checked = summary ? summary.enabled : false;
        summaryTimeInput.value = summary ? summary.time : '07:00';
        summaryTimezoneSelect.value = summary ? summary.timezone : 'WIB';
        toggleCollapsibleSection(dailySummaryToggle, dailySummaryOptionsContainer);
    }

    async function saveDailySummarySettings(showToggleNotification = false) {
        if (!currentUser) return;
        const settings = {
            enabled: dailySummaryToggle.checked,
            time: summaryTimeInput.value,
            timezone: summaryTimezoneSelect.value
        };
        try {
            await db.collection('users').doc(currentUser.uid).update({ dailySummary: settings });
            currentUserData.dailySummary = settings;
            if (showToggleNotification) {
                const status = settings.enabled ? "diaktifkan" : "dinonaktifkan";
                showNotification(`Notifikasi ringkasan berhasil ${status}.`, 'success');
            }
        } catch (error) {
            showNotification('Gagal menyimpan pengaturan ringkasan.', 'error');
            if (showToggleNotification) {
                dailySummaryToggle.checked = !settings.enabled;
            }
        }
    }

    dailySummaryToggle.addEventListener('change', () => {
        toggleCollapsibleSection(dailySummaryToggle, dailySummaryOptionsContainer);
        saveDailySummarySettings(true)
    });
    summaryTimeInput.addEventListener('change', () => saveDailySummarySettings(false));
    summaryTimezoneSelect.addEventListener('change', () => saveDailySummarySettings(false));

    async function loadSmartAlertSchedules() {
        if (!isPremiumUser() || !currentUser) return;
        smartAlertToggle.checked = currentUserData.smartAlertsEnabled || false;
        toggleCollapsibleSection(smartAlertToggle, smartAlertOptionsContainer);

        const schedulesCollection = db.collection('users').doc(currentUser.uid).collection('schedules');
        const snapshot = await schedulesCollection.orderBy('createdAt').get();

        smartAlertScheduleList.innerHTML = '';

        if (snapshot.empty) {
            smartAlertScheduleList.innerHTML = `
            <div id="empty-smart-alert-msg" class="text-center py-4 text-sm" style="color: var(--text-color-secondary);">
                <p>Anda belum memiliki jadwal untuk diatur.</p>
                <p>Silakan buat jadwal terlebih dahulu.</p>
            </div>`;
        } else {
            snapshot.forEach(doc => {
                const schedule = { id: doc.id, ...doc.data() };
                const alertCondition = schedule.alertCondition || 'none';
                const scheduleElement = document.createElement('div');
                scheduleElement.className = 'inner-card p-3 rounded-lg flex items-center justify-between';
                scheduleElement.setAttribute('data-schedule-id', schedule.id);
                scheduleElement.innerHTML = `
                <span class="font-semibold text-sm">${schedule.name}</span>
                <div class="flex items-center gap-2">
                    <label class="radio-label">
                        <input type="radio" name="alert-condition-${schedule.id}" value="hujan" ${alertCondition === 'hujan' ? 'checked' : ''}>
                        <span>Hujan</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="alert-condition-${schedule.id}" value="panas" ${alertCondition === 'panas' ? 'checked' : ''}>
                        <span>Panas</span>
                    </label>
                </div>
                `;
                smartAlertScheduleList.appendChild(scheduleElement);
            });
        }
    }

    smartAlertToggle.addEventListener('change', async (e) => {
        if (!currentUser) return;
        toggleCollapsibleSection(smartAlertToggle, smartAlertOptionsContainer);
        const isEnabled = e.target.checked;
        try {
            await db.collection('users').doc(currentUser.uid).update({ smartAlertsEnabled: isEnabled });
            currentUserData.smartAlertsEnabled = isEnabled;
            const status = isEnabled ? "diaktifkan" : "dinonaktifkan";
            showNotification(`Peringatan Cerdas berhasil ${status}.`, 'success');
        } catch (error) {
            showNotification('Gagal menyimpan pengaturan.', 'error');
            e.target.checked = !isEnabled;
            toggleCollapsibleSection({ checked: !isEnabled }, smartAlertOptionsContainer);
        }
    });

    smartAlertScheduleList.addEventListener('click', async (e) => {
        if (e.target.type === 'radio') {
            const scheduleId = e.target.closest('[data-schedule-id]').getAttribute('data-schedule-id');
            if (!currentUser || !scheduleId) return;

            const scheduleRef = db.collection('users').doc(currentUser.uid).collection('schedules').doc(scheduleId);
            const conditionToSet = e.target.value;

            const scheduleDoc = await scheduleRef.get();
            const currentCondition = scheduleDoc.data().alertCondition;

            if (currentCondition === conditionToSet) {
                e.preventDefault();
                e.target.checked = false;
                try {
                    await scheduleRef.update({ alertCondition: firebase.firestore.FieldValue.delete() });
                } catch (error) {
                    console.error("Gagal menonaktifkan peringatan:", error);
                }
            } else {
                try {
                    await scheduleRef.update({ alertCondition: conditionToSet });
                } catch (error) {
                    console.error("Gagal menyimpan pengaturan peringatan:", error);
                }
            }
        }
    });

    function loadNotificationSettings() {
        if (!isPremiumUser()) return;
        if (currentUserData.telegramUsername) {
            updateNotificationUI('telegram', currentUserData.telegramUsername);
        } else {
            resetNotificationUI('telegram');
        }
    }

    function updateNotificationUI(platform, value) {
        document.getElementById(`${platform}-connect-btn`).classList.add('hidden');
        document.getElementById(`${platform}-connected-state`).classList.remove('hidden');
        document.getElementById(`${platform}-status-text`).textContent = `Terhubung ke: @${value}`;
        document.getElementById(`${platform}-notification-group`).setAttribute(`data-${platform}-value`, value);
    }

    function resetNotificationUI(platform) {
        document.getElementById(`${platform}-connect-btn`).classList.remove('hidden');
        document.getElementById(`${platform}-connected-state`).classList.add('hidden');
        const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
        document.getElementById(`${platform}-status-text`).textContent = `Hubungkan ${platformName} untuk notifikasi langsung.`;
        document.getElementById(`${platform}-notification-group`).removeAttribute(`data-${platform}-value`);
    }

    function resetTelegramModal() {
        telegramForm.reset();
        telegramStep1.classList.remove('hidden');
        telegramStep2.classList.add('hidden');
        telegramSubmitBtn.textContent = 'Lanjutkan';
        telegramSubmitBtn.disabled = false;
        telegramInput.required = true;
        telegramVerificationInput.required = false;
    }

    telegramConnectBtn.addEventListener('click', () => {
        if (!isPremiumUser()) { openModal(upgradeModal); return; }
        resetTelegramModal();
        document.getElementById('telegram-modal-title').textContent = 'Hubungkan Telegram';
        openModal(telegramModal);
    });

    confirmUpgradeBtn.addEventListener('click', redirectToPayment);

    telegramForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) {
            showNotification('Sesi tidak valid, silakan muat ulang halaman.', 'error');
            return;
        }

        telegramSubmitBtn.disabled = true;

        try {
            const firebaseToken = await currentUser.getIdToken();
            const tokenResponse = await fetch('/.netlify/functions/get-netlify-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firebaseToken: firebaseToken }),
            });

            if (!tokenResponse.ok) {
                throw new Error('Gagal mendapatkan otorisasi. Silakan coba lagi.');
            }

            const { netlify_token } = await tokenResponse.json();

            const isStep1 = !telegramStep1.classList.contains('hidden');

            if (isStep1) {
                const username = telegramInput.value;

                telegramSubmitBtn.textContent = 'Mengirim...';
                const response = await fetch('/.netlify/functions/2-request-telegram-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${netlify_token}`
                    },
                    body: JSON.stringify({ telegramUsername: username })
                });
                const data = await response.json();
                if (!response.ok) { throw new Error(data.error || 'Gagal mengirim kode.'); }
                showNotification('Kode verifikasi telah dikirim.', 'success');

                telegramStep1.classList.add('hidden');
                telegramStep2.classList.remove('hidden');
                telegramInput.required = false;
                telegramVerificationInput.required = true;
                telegramSubmitBtn.textContent = 'Verifikasi & Simpan';
                telegramVerificationInput.focus();

            } else {
                const code = telegramVerificationInput.value;

                telegramSubmitBtn.textContent = 'Memverifikasi...';
                const response = await fetch('/.netlify/functions/3-verify-telegram-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${netlify_token}`
                    },
                    body: JSON.stringify({ code: code })
                });

                const data = await response.json();
                if (!response.ok) { throw new Error(data.error || 'Gagal verifikasi.'); }
                currentUserData.telegramUsername = data.telegramUsername;
                updateNotificationUI('telegram', data.telegramUsername);
                showNotification('Telegram berhasil terhubung!', 'success');
                closeModal(telegramModal);
            }
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            telegramSubmitBtn.disabled = false;
        }
    });

    document.getElementById('notification-settings').addEventListener('click', async (e) => {
        const editTelegram = e.target.closest('#edit-telegram-btn');
        const deleteTelegram = e.target.closest('#delete-telegram-btn');
        const userDocRef = db.collection('users').doc(currentUser.uid);

        if (editTelegram) {
            resetTelegramModal();
            document.getElementById('telegram-modal-title').textContent = 'Edit Telegram';
            telegramInput.value = currentUserData.telegramUsername ? `@${currentUserData.telegramUsername}` : '';
            openModal(telegramModal);
        }
        if (deleteTelegram) {
            openConfirmationModal(
                'Apakah Anda yakin ingin menghapus koneksi Telegram?',
                async () => {
                    try {
                        await userDocRef.update({
                            telegramUsername: firebase.firestore.FieldValue.delete(),
                            telegramChatId: firebase.firestore.FieldValue.delete()
                        });

                        delete currentUserData.telegramUsername;
                        delete currentUserData.telegramChatId;

                        resetNotificationUI('telegram');
                        showNotification('Koneksi Telegram berhasil dihapus.', 'success');
                    } catch (error) {
                        showNotification('Gagal menghapus koneksi.', 'error');
                    }
                }
            );
        }
    });

    async function getCurrentLocation() {
        if (!navigator.geolocation) {
            showNotification('Browser Anda tidak mendukung Geolocation.', 'error');
            return;
        }
        showNotification('Mencari lokasi Anda...', 'success');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                updateMarker(latitude, longitude);
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=id&zoom=18`);
                    const data = await response.json();
                    let locationName = 'Lokasi tidak dikenal';
                    if (data && data.address) {
                        const addr = data.address;
                        const place = addr.suburb || addr.village || addr.town || addr.city || addr.county;
                        const state = addr.state || addr.region || '';
                        if (place && state) {
                            locationName = `${place}, ${state}`;
                        } else if (place) {
                            locationName = place;
                        } else if (data.display_name) {
                            locationName = data.display_name.split(',').slice(0, 2).join(',');
                        }
                    } else if (data.display_name) {
                        locationName = data.display_name.split(',').slice(0, 2).join(',');
                    }
                    locationInput.value = locationName;
                    showNotification('Lokasi berhasil ditemukan!', 'success');
                } catch (error) {
                    showNotification('Gagal mendapatkan nama lokasi dari koordinat.', 'error');
                }
            },
            (error) => {
                let message = 'Gagal mendapatkan lokasi: ';
                switch (error.code) {
                    case error.PERMISSION_DENIED: message += 'Anda menolak permintaan lokasi.'; break;
                    case error.POSITION_UNAVAILABLE: message += 'Informasi lokasi tidak tersedia.'; break;
                    case error.TIMEOUT: message += 'Permintaan lokasi timed out.'; break;
                    default: message += 'Terjadi kesalahan yang tidak diketahui.'; break;
                }
                showNotification(message, 'error');
            }
        );
    }

    async function redirectToPayment() {
        if (!currentUser) {
            showNotification('Sesi Anda tidak valid. Silakan login kembali.', 'error');
            return;
        }

        confirmUpgradeBtn.disabled = true;
        confirmUpgradeBtn.textContent = 'Mengarahkan...';

        try {
            const firebaseToken = await currentUser.getIdToken();

            const response = await fetch('/.netlify/functions/create-payment-link', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${firebaseToken}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Gagal membuat link pembayaran.');
            }

            window.location.href = data.paymentUrl;

        } catch (error) {
            showNotification(error.message, 'error');
            confirmUpgradeBtn.disabled = false;
            confirmUpgradeBtn.textContent = 'Tingkatkan Sekarang';
        }
    }
});
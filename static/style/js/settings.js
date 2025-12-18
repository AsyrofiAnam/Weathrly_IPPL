const firebaseConfig = {
    apiKey: "AIzaSyCc6_x7GtGCpAfyNWpuDVEKQ2qJdzygSII",
    authDomain: "weathrly-cc25-1.firebaseapp.com",
    projectId: "weathrly-cc25-1",
    storageBucket: "weathrly-cc25-1.firebasestorage.app",
    messagingSenderId: "175538007441",
    appId: "1:175538007441:web:4b9158a036a6fec27f7e30"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const avatarButton = document.getElementById('avatar-button');
    const logoutDropdown = document.getElementById('logout-dropdown');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconMenu = document.getElementById('icon-menu');
    const iconClose = document.getElementById('icon-close');
    const themeToggleInput = document.getElementById('theme-toggle-input');
    const themeToggleMobile = document.getElementById('theme-toggle-mobile');

    const navDashboardLink = document.getElementById('nav-dashboard-link');
    const mobileDashboardLink = document.getElementById('mobile-dashboard-link');
    const logoLink = document.getElementById('logo-link');

    window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));

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

    const handleLogout = (e) => {
        e.preventDefault();
        auth.signOut().then(() => {
            window.location.href = '/';
        });
    };

    const settingsLogoutBtn = document.getElementById('settings-logout-btn');
    if (settingsLogoutBtn) settingsLogoutBtn.addEventListener('click', handleLogout);

    const applyTheme = (theme) => {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        if (themeToggleInput) themeToggleInput.checked = isDark;
        if (themeToggleMobile) themeToggleMobile.checked = isDark;
    };

    const setTheme = (isDark) => {
        const currentTheme = isDark ? 'dark' : 'light';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    };

    if (themeToggleInput) themeToggleInput.addEventListener('change', (e) => setTheme(e.target.checked));
    if (themeToggleMobile) themeToggleMobile.addEventListener('change', (e) => setTheme(e.target.checked));

    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    const tabAccount = document.getElementById('tab-account');
    const tabSubscription = document.getElementById('tab-subscription');
    const contentAccount = document.getElementById('content-account');
    const contentSubscription = document.getElementById('content-subscription');
    const loadingOverlay = document.getElementById('loading-overlay');

    function switchTab(tabName) {
        if (tabName === 'account') {
            tabAccount.classList.add('active');
            tabSubscription.classList.remove('active');
            contentAccount.classList.remove('hidden');
            contentSubscription.classList.add('hidden');
        } else {
            tabAccount.classList.remove('active');
            tabSubscription.classList.add('active');
            contentAccount.classList.add('hidden');
            contentSubscription.classList.remove('hidden');
        }
    }

    tabAccount.addEventListener('click', () => switchTab('account'));
    tabSubscription.addEventListener('click', () => switchTab('subscription'));

    const settingsAvatarEl = document.getElementById('settings-user-avatar');
    const settingsNameEl = document.getElementById('settings-user-name');
    const settingsEmailEl = document.getElementById('settings-user-email');
    const settingsIdEl = document.getElementById('settings-user-id');
    const copyIdBtn = document.getElementById('copy-id-btn');

    const navDropdownName = document.getElementById('dropdown-user-name');
    const navDropdownEmail = document.getElementById('dropdown-user-email');
    const mobileUserAvatar = document.getElementById('mobile-user-avatar');
    const mobileDropdownName = document.getElementById('mobile-dropdown-user-name');
    const mobileDropdownEmail = document.getElementById('mobile-dropdown-user-email');
    const navUserAvatar = document.getElementById('user-avatar');

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const userDataDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDataDoc.exists ? userDataDoc.data() : {};

            const displayName = userData.displayName || user.displayName || user.email.split('@')[0];
            const photoURL = userData.photoURL || user.photoURL || 'https://via.placeholder.com/100';
            const email = userData.email || user.email;

            const userSlug = userData.slug || user.uid;
            const dashboardUrl = `/${userSlug}`;

            navDashboardLink.href = dashboardUrl;
            mobileDashboardLink.href = dashboardUrl;
            logoLink.href = dashboardUrl;

            navDropdownName.textContent = displayName;
            navDropdownEmail.textContent = email;
            navUserAvatar.src = photoURL;
            mobileDropdownName.textContent = displayName;
            mobileDropdownEmail.textContent = email;
            mobileUserAvatar.src = photoURL;

            settingsNameEl.textContent = displayName;
            settingsEmailEl.textContent = email;
            settingsIdEl.value = user.uid;
            settingsAvatarEl.src = photoURL;

            const upgradeBtns = document.querySelectorAll('#upgrade-btn-nav, #upgrade-btn-mobile');
            upgradeBtns.forEach(btn => btn.classList.add('hidden'));

            updateSubscriptionUI(userData.plan, userData.subscriptionDetails);

            setTimeout(() => {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => loadingOverlay.style.display = 'none', 500);
            }, 500);
        } else {
            window.location.href = '/';
        }
    });


    const planCard = document.getElementById('plan-card');
    const planName = document.getElementById('plan-name');
    const planRenewal = document.getElementById('plan-renewal');
    const planStatusBadge = document.getElementById('plan-status-badge');

    const premiumSettingsContainer = document.getElementById('premium-settings-container');
    const freePlanUpgradeContainer = document.getElementById('free-plan-upgrade-container');

    const paymentMethodText = document.getElementById('payment-method-text');
    const paymentMethodIcon = document.getElementById('payment-method-icon');

    const tabUpgradeBtn = document.getElementById('tab-upgrade-btn');

    function updateSubscriptionUI(plan, details) {
        planCard.className = "p-6 rounded-xl relative overflow-hidden transition-all duration-300 border";
        planCard.style.borderColor = "var(--input-border)";

        if (plan === 'premium') {
            planCard.style.background = "linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%)";
            if (document.documentElement.classList.contains('dark')) {
                planCard.style.background = "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)";
            }

            planName.innerHTML = `Premium <svg class="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
            planStatusBadge.textContent = "Aktif";
            planStatusBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";

            const nextBillingDate = details?.nextBillingDate ? new Date(details.nextBillingDate.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "30 hari lagi";
            planRenewal.textContent = `Berakhir pada: ${nextBillingDate}`;

            premiumSettingsContainer.classList.remove('hidden');
            freePlanUpgradeContainer.classList.add('hidden');

            const method = details?.paymentChannel || details?.paymentMethod || 'Unknown';
            const cleanMethod = method.replace(/_/g, ' ').toUpperCase();
            paymentMethodIcon.textContent = cleanMethod.substring(0, 4);
            paymentMethodText.textContent = `Dibayar menggunakan ${cleanMethod}`;

        } else {
            planCard.style.background = "var(--inner-card-bg)";
            planName.textContent = "Gratis";
            planStatusBadge.textContent = "Aktif";
            planRenewal.textContent = "Anda menggunakan paket gratis selamanya.";

            premiumSettingsContainer.classList.add('hidden');
            freePlanUpgradeContainer.classList.remove('hidden');

            tabUpgradeBtn.onclick = redirectToPayment;
        }
    }

    if (copyIdBtn) {
        copyIdBtn.addEventListener('click', () => {
            settingsIdEl.select();
            settingsIdEl.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(settingsIdEl.value).then(() => {
                Toastify({ text: "ID berhasil disalin!", duration: 3000, gravity: "top", position: "center", style: { background: "#10B981", borderRadius: "8px" } }).showToast();
            });
        });
    }

    const modal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    let currentActionCallback = null;

    const openModal = (title, message, action) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        currentActionCallback = action;
        modal.classList.remove('hidden');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        currentActionCallback = null;
    };

    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    if (confirmActionBtn) {
        confirmActionBtn.addEventListener('click', () => {
            if (currentActionCallback) currentActionCallback();
            closeModal();
        });
    }

    const deleteAccountTrigger = document.getElementById('delete-account-trigger');
    if (deleteAccountTrigger) {
        deleteAccountTrigger.addEventListener('click', () => {
            openModal(
                "Hapus Akun Permanen",
                "Apakah Anda yakin? Semua data lokasi, jadwal, dan pengaturan akan dihapus permanen dan tidak dapat dikembalikan.",
                async () => {
                    try {
                        const user = auth.currentUser;
                        if (user) {
                            // Peringatan: Hapus akun butuh re-auth jika login sudah lama
                            await db.collection('users').doc(user.uid).delete();
                            await user.delete();
                            window.location.href = '/';
                        }
                    } catch (error) {
                        Toastify({ text: "Gagal hapus akun. Silakan login ulang dan coba lagi.", style: { background: "#EF4444", borderRadius: "8px" } }).showToast();
                        setTimeout(() => {
                            auth.signOut().then(() => window.location.href = '/');
                        }, 2000);
                    }
                }
            );
        });
    }

    async function redirectToPayment() {
        if (!currentUser) return;

        const btn = this;
        const originalText = btn.textContent;
        btn.textContent = 'Memuat...';
        btn.disabled = true;

        try {
            const firebaseToken = await currentUser.getIdToken();
            const response = await fetch('/.netlify/functions/create-payment-link', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${firebaseToken}` },
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Gagal membuat link.');

            window.location.href = data.paymentUrl;

        } catch (error) {
            Toastify({ text: error.message, style: { background: "#EF4444", borderRadius: "8px" } }).showToast();
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
});
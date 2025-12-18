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
const auth = firebase.auth();

function slugify(text) {
    if (!text) return 'user';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

function showNotification(message, type = 'success') {
    const backgroundColor = type === 'success'
        ? 'linear-gradient(to right, #34D399, #10B981)'
        : 'linear-gradient(to right, #F87171, #EF4444)';

    Toastify({
        text: message,
        duration: 5000,
        close: false,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
        style: {
            background: backgroundColor,
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: '500',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        },
    }).showToast();
}

async function saveUserToFirestore(user) {
    const userRef = db.collection('users').doc(user.uid);
    const doc = await userRef.get();

    const displayName = user.displayName || user.email.split('@')[0];
    const slug = slugify(displayName);

    if (!doc.exists) {
        await userRef.set({
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            slug: slug,
            photoURL: user.photoURL || null,
            role: 'user',
            plan: 'free',
            subscriptionStatus: 'active',
            emailNotificationsEnabled: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return { slug: slug, role: 'user' };
    } else {
        await userRef.update({
            displayName: displayName,
            slug: slug,
            photoURL: user.photoURL || null
        });

        const userData = doc.data();
        return { slug: userData.slug, role: userData.role || 'user' };
    }
}

const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
    if (user && !firebase.auth().isSignInWithEmailLink(window.location.href)) {
        try {
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();

            if (doc.exists) {
                const userData = doc.data();
                const userRole = userData.role || 'user';
                const userSlug = userData.slug || 'user';

                if (userRole === 'admin') {
                    console.log('User adalah Admin. Mengarahkan ke dashboard admin...');
                    window.location.href = '/admin';
                } else {
                    console.log('User biasa. Mengarahkan ke dashboard user...');
                    window.location.href = `/${userSlug}`;
                }
            } else {
                const result = await saveUserToFirestore(user);
                if (result.role === 'admin') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = `/${result.slug}`;
                }
            }
        } catch (error) {
            console.error("Gagal redirect:", error);
            window.location.href = '/dashboard';
        }
    }
});

(function () {
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Silakan masukkan kembali email Anda untuk verifikasi.');
        }
        if (email) {
            firebase.auth().signInWithEmailLink(email, window.location.href)
                .then((result) => {
                    window.localStorage.removeItem('emailForSignIn');
                    const user = result.user;
                    showNotification('Login berhasil! Menyiapkan akun Anda...', 'success');
                    return saveUserToFirestore(user);
                })
                .then((result) => {
                    if (result.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = `/${result.slug}`;
                    }
                })
                .catch((error) => {
                    console.error(error);
                    showNotification('Gagal memverifikasi email', 'error');
                });
        }
    }
})();

document.addEventListener('DOMContentLoaded', () => {

    const loadingOverlay = document.getElementById('loading-overlay');
    const body = document.body;
    body.classList.add('no-scroll');
    setTimeout(() => {
        loadingOverlay.style.opacity = '0';
        body.classList.remove('no-scroll');
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    }, 2000);

    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithPopup(provider)
                .then((result) => {
                    const user = result.user;
                    showNotification('Login berhasil!', 'success');
                    return saveUserToFirestore(user);
                })
                .then((result) => {
                    if (result.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = `/${result.slug}`;
                    }
                })
                .catch((error) => {
                    console.error(error);
                    showNotification('Terjadi kesalahan saat login', 'error');
                });
        });
    }

    const emailForm = document.getElementById('email-form');
    const emailInput = document.getElementById('email-input');
    const emailFormContainer = document.getElementById('email-form-container');
    const verificationFormContainer = document.getElementById('verification-form-container');
    const userEmailDisplay = document.getElementById('user-email-display');

    if (emailForm) {
        emailForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = emailInput.value;
            if (!email) return;

            const actionCodeSettings = {
                url: window.location.href.split('?')[0],
                handleCodeInApp: true
            };

            firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
                .then(() => {
                    window.localStorage.setItem('emailForSignIn', email);
                    showNotification('Email verifikasi telah dikirim ke ' + email, 'success');
                    userEmailDisplay.textContent = email;
                    emailFormContainer.classList.add('hidden');
                    verificationFormContainer.classList.remove('hidden');
                })
                .catch((error) => {
                    console.error(error);
                    showNotification('Gagal mengirim email', 'error');
                });
        });
    }

    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    const themeToggleDesktop = document.getElementById('theme-toggle-desktop');
    const themeToggleMobile = document.getElementById('theme-toggle-mobile');
    const lightLogos = document.querySelectorAll('.light-logo');
    const darkLogos = document.querySelectorAll('.dark-logo');
    const html = document.documentElement;

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            html.classList.add('dark');
            if (themeToggleDesktop) themeToggleDesktop.checked = true;
            if (themeToggleMobile) themeToggleMobile.checked = true;
            lightLogos.forEach(el => el.style.display = 'none');
            darkLogos.forEach(el => el.style.display = 'block');
        } else {
            html.classList.remove('dark');
            if (themeToggleDesktop) themeToggleDesktop.checked = false;
            if (themeToggleMobile) themeToggleMobile.checked = false;
            lightLogos.forEach(el => el.style.display = 'block');
            darkLogos.forEach(el => el.style.display = 'none');
        }
    };

    const handleThemeChange = (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };

    if (themeToggleDesktop) themeToggleDesktop.addEventListener('change', handleThemeChange);
    if (themeToggleMobile) themeToggleMobile.addEventListener('change', handleThemeChange);

    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconMenu = document.getElementById('icon-menu');
    const iconClose = document.getElementById('icon-close');

    const toggleMenu = () => {
        mobileMenu.classList.toggle('menu-open');
        iconMenu.classList.toggle('hidden');
        iconClose.classList.toggle('hidden');
    };

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMenu);
        const mobileNavLinks = mobileMenu.querySelectorAll('a');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (mobileMenu.classList.contains('menu-open')) {
                    toggleMenu();
                }
            });
        });
    }

    const revealElements = document.querySelectorAll('.reveal-hidden');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    revealElements.forEach(el => {
        observer.observe(el);
    });
});
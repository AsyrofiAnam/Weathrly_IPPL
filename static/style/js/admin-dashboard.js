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

let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const rowsPerPage = 10;
let currentFilter = 'all';

function showNotification(text, type = 'success') {
    const bg = type === 'success' ? "linear-gradient(to right, #34D399, #10B981)" : "linear-gradient(to right, #F87171, #EF4444)";
    Toastify({
        text: text, duration: 3000, close: true, gravity: "top", position: "center", stopOnFocus: true,
        style: {
            background: bg, backdropFilter: 'blur(5px)', border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", padding: "12px 20px", fontSize: "14px", fontWeight: "500"
        }
    }).showToast();
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists && doc.data().role === 'admin') {
                // Fade out loader
                const loader = document.getElementById('loading-overlay');
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);

                initDashboard(user, doc.data());
            } else {
                window.location.href = '/dashboard';
            }
        } catch (error) {
            console.error("Auth error", error);
            window.location.href = '/dashboard';
        }
    } else {
        window.location.href = '/';
    }
});

function initDashboard(user, userData) {
    document.getElementById('admin-email').textContent = user.email;
    if (user.photoURL) document.getElementById('admin-avatar').src = user.photoURL;
    fetchUsersAndStats();
    setupNavbarInteractions();
}

function setupNavbarInteractions() {
    const avatarBtn = document.getElementById('avatar-button');
    const dropdown = document.getElementById('logout-dropdown');

    avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        dropdown.classList.toggle('opacity-0');
        dropdown.classList.toggle('scale-95');
    });

    window.addEventListener('click', () => {
        dropdown.classList.add('hidden', 'opacity-0', 'scale-95');
    });

    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;

    const applyTheme = (isDark) => {
        if (isDark) {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.checked = true;
        } else {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            themeToggle.checked = false;
        }
    };

    themeToggle.addEventListener('change', (e) => applyTheme(e.target.checked));
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme === 'dark');

    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 20) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    });
}

async function fetchUsersAndStats() {
    try {
        const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();

        let total = 0, premium = 0, free = 0, recent = 0, newUsersThisMonth = 0;
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        allUsers = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const userData = { id: doc.id, ...data };
            allUsers.push(userData);

            total++;
            if (data.plan === 'premium') premium++;
            else free++;

            const joinedDate = data.createdAt ? data.createdAt.toDate() : new Date(0);
            if (joinedDate > sevenDaysAgo) recent++;
            if (joinedDate >= startOfThisMonth) newUsersThisMonth++;
        });

        const usersBeforeThisMonth = total - newUsersThisMonth;
        let growthPercentage = 0;
        let growthSymbol = "+";

        if (usersBeforeThisMonth > 0) {
            growthPercentage = ((newUsersThisMonth / usersBeforeThisMonth) * 100).toFixed(1);
        } else if (total > 0) {
            growthPercentage = 100;
        }

        document.getElementById('stat-total-users').textContent = total.toLocaleString();
        document.getElementById('stat-premium-users').textContent = premium.toLocaleString();
        document.getElementById('stat-free-users').textContent = free.toLocaleString();
        document.getElementById('stat-new-users').textContent = recent.toLocaleString();

        const growthEl = document.getElementById('growth-text');
        growthEl.textContent = `${growthSymbol}${growthPercentage}% bulan ini`;
        growthEl.className = growthPercentage >= 0
            ? "text-xs mt-2 font-mono text-green-600 dark:text-green-400"
            : "text-xs mt-2 font-mono text-red-600 dark:text-red-400";

        filteredUsers = [...allUsers];
        updatePagination();

    } catch (error) {
        console.error("Error fetching data:", error);
        showNotification("Gagal memuat data pengguna", "error");
    }
}

function renderTable(users) {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center opacity-60">Tidak ada pengguna ditemukan.</td></tr>`;
        document.getElementById('display-range').textContent = "0-0";
        return;
    }

    users.forEach(user => {
        const date = user.createdAt ? user.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        const isPremium = user.plan === 'premium';

        // Gunakan class custom alih-alih Tailwind inline
        const badgeClass = isPremium ? 'badge badge-premium' : 'badge badge-free';
        const icon = isPremium ? 'Premium' : 'Free';

        // Role Badge Logic
        const role = user.role || 'user';
        const roleBadgeClass = role === 'admin' ? 'badge badge-admin' : 'badge badge-user';

        const tr = document.createElement('tr');
        tr.className = "table-row"; // Class custom

        const safeName = (user.displayName || 'Tanpa Nama').replace(/'/g, "&apos;");
        const safeRole = role;
        const safePlan = user.plan || 'free';

        let avatarHTML;
        if (user.photoURL) {
            avatarHTML = `<img src="${user.photoURL}" alt="${safeName}" class="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-600">`;
        } else {
            avatarHTML = `
                        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                            ${safeName.charAt(0).toUpperCase()}
                        </div>
                    `;
        }

        tr.innerHTML = `
                    <td class="p-5 pl-6 font-semibold flex items-center gap-3" style="color: var(--text-color-primary);">
                        ${avatarHTML}
                        ${safeName}
                    </td>
                    <td class="p-5 opacity-80" style="color: var(--text-color-secondary);">${user.email}</td>
                    <td class="p-5">
                        <span class="${roleBadgeClass}">
                            ${role}
                        </span>
                    </td>
                    <td class="p-5">
                        <span class="${badgeClass}">
                            ${icon}
                        </span>
                    </td>
                    <td class="p-5 font-mono text-xs opacity-70" style="color: var(--text-color-secondary);">${date}</td>
                    <td class="p-5 text-center">
                        <div class="flex justify-center gap-2">
                             <button onclick="openEditModal('${user.id}', '${safeName}', '${safeRole}', '${safePlan}')" class="btn-action-edit" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                            </button>
                            <button onclick="openDeleteModal('${user.id}')" class="btn-action-delete" title="Hapus">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                            </button>
                        </div>
                    </td>
                `;
        tbody.appendChild(tr);
    });
}

function updatePagination() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    renderTable(paginatedUsers);

    document.getElementById('display-count').textContent = filteredUsers.length;
    const displayStart = filteredUsers.length > 0 ? startIndex + 1 : 0;
    const displayEnd = Math.min(endIndex, filteredUsers.length);
    document.getElementById('display-range').textContent = `${displayStart}-${displayEnd}`;

    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = endIndex >= filteredUsers.length;
}

document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        updatePagination();
    }
});

document.getElementById('next-page-btn').addEventListener('click', () => {
    if ((currentPage * rowsPerPage) < filteredUsers.length) {
        currentPage++;
        updatePagination();
    }
});

window.switchTab = function (tabName) {
    const statsBtn = document.getElementById('btn-tab-stats');
    const usersBtn = document.getElementById('btn-tab-users');
    const statsContent = document.getElementById('tab-stats');
    const usersContent = document.getElementById('tab-users');

    if (tabName === 'stats') {
        statsBtn.classList.add('active');
        usersBtn.classList.remove('active');
        statsContent.classList.remove('hidden');
        usersContent.classList.add('hidden');
    } else {
        statsBtn.classList.remove('active');
        usersBtn.classList.add('active');
        statsContent.classList.add('hidden');
        usersContent.classList.remove('hidden');
    }
}

document.getElementById('search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    applyFilters(term, currentFilter);
});

document.getElementById('filter-btn').addEventListener('click', function () {
    if (currentFilter === 'all') {
        currentFilter = 'premium';
        this.textContent = 'Filter: Premium';
    } else if (currentFilter === 'premium') {
        currentFilter = 'free';
        this.textContent = 'Filter: Free';
    } else {
        currentFilter = 'all';
        this.textContent = 'Filter: Semua';
    }
    const term = document.getElementById('search-input').value.toLowerCase();
    applyFilters(term, currentFilter);
});

function applyFilters(searchTerm, statusFilter) {
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = (user.displayName && user.displayName.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm));

        let matchesStatus = true;
        if (statusFilter === 'premium') matchesStatus = user.plan === 'premium';
        if (statusFilter === 'free') matchesStatus = user.plan !== 'premium';

        return matchesSearch && matchesStatus;
    });
    currentPage = 1;
    updatePagination();
}

document.getElementById('export-btn').addEventListener('click', () => {
    const headers = ["ID", "Nama", "Email", "Role", "Plan", "Bergabung"];
    const rows = filteredUsers.map(u => [
        u.id,
        `"${u.displayName || ''}"`,
        u.email,
        u.role || 'user',
        u.plan,
        u.createdAt ? u.createdAt.toDate().toISOString().split('T')[0] : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = '/');
});

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return; // Pencegahan error jika modal tidak ditemukan

    modal.classList.add('modal-closing');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('modal-closing');
    }, 200);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('hidden');
    void modal.offsetWidth;
}

window.openEditModal = function (id, name, role, plan) {
    document.getElementById('edit-doc-id').value = id;
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-role').value = role;
    document.getElementById('edit-plan').value = plan;
    showModal('edit-modal');
}

window.saveUserChanges = function () {
    const docId = document.getElementById('edit-doc-id').value;
    const newRole = document.getElementById('edit-role').value;
    const newPlan = document.getElementById('edit-plan').value;

    const btn = document.querySelector('#edit-modal button:last-child');
    const originalText = btn.textContent;
    btn.textContent = "Menyimpan...";
    btn.disabled = true;

    db.collection('users').doc(docId).update({
        role: newRole,
        plan: newPlan
    }).then(() => {
        showNotification("Data pengguna berhasil diperbarui!");
        closeModal('edit-modal');
        fetchUsersAndStats();
    }).catch(err => {
        console.error(err);
        showNotification("Gagal memperbarui data.", "error");
    }).finally(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    });
}

window.openDeleteModal = function (id) {
    document.getElementById('delete-doc-id').value = id;
    showModal('delete-modal');
}

window.confirmDeleteUser = function () {
    const docId = document.getElementById('delete-doc-id').value;

    const btn = document.querySelector('#delete-modal button:last-child');
    const originalText = btn.textContent;
    btn.textContent = "Menghapus...";
    btn.disabled = true;

    db.collection('users').doc(docId).delete().then(() => {
        showNotification("Pengguna telah dihapus.", "success");
        closeModal('delete-modal');
        fetchUsersAndStats();
    }).catch(err => {
        console.error(err);
        showNotification("Gagal menghapus pengguna.", "error");
    }).finally(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    });
}
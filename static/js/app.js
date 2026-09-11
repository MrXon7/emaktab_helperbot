// Telegram WebApp Initialization
const tg = window.Telegram?.WebApp;
if (tg) {
    try {
        tg.ready();
        tg.expand();
    } catch(e) {
        console.error("TG ready error:", e);
    }
}

// Auth Header olish (Telegram initData yoki Dev User)
function getAuthHeaders() {
    let authVal = tg?.initData;
    if (!authVal) {
        // Agar Telegram bo'lmasa, mahalliy dev user
        authVal = localStorage.getItem('emaktab_dev_user') || 'dev_user_1';
    }
    return {
        'Authorization': `Bearer ${authVal}`,
        'Content-Type': 'application/json'
    };
}

// State
let students = [];
let currentUser = null;
let isBulkRunning = false;
let shouldStopBulk = false;
let selectedStatusFilter = 'all'; // 'all' | 'pending' | 'success' | 'failed'

// DOM Elements
const studentsContainer = document.getElementById('students-container');
const emptyState = document.getElementById('empty-state');
const fileInput = document.getElementById('excel-file-input');
const btnOpenExcelMenu = document.getElementById('btn-open-excel-menu');
const modalExcelMenu = document.getElementById('modal-excel-menu');
const btnAddManual = document.getElementById('btn-add-manual');
const modalStudentForm = document.getElementById('modal-student-form');
const btnCloseFormModal = document.getElementById('btn-close-form-modal');
const btnSubmitForm = document.getElementById('btn-submit-form');
const modalFormTitle = document.getElementById('modal-form-title');
const formStudent = document.getElementById('form-student');
const inputEditId = document.getElementById('input-edit-id');
const searchInput = document.getElementById('search-input');
const filterSchool = document.getElementById('filter-school');
const filterGrade = document.getElementById('filter-grade');
const btnMainAction = document.getElementById('btn-main-action');
const mainActionText = document.getElementById('main-action-text');

// Loader Elements
const globalTopLoader = document.getElementById('global-top-loader');
const modalUploadLoading = document.getElementById('modal-upload-loading');
const uploadLoadingText = document.getElementById('upload-loading-text');

// Subscription & Onboarding Elements
const subscriptionBanner = document.getElementById('subscription-banner');
const subIcon = document.getElementById('sub-icon');
const subText = document.getElementById('sub-text');
const subBadge = document.getElementById('sub-badge');
const btnOpenSubModal = document.getElementById('btn-open-sub-modal');
const modalOnboardingSub = document.getElementById('modal-onboarding-sub');
const btnCloseSubModal = document.getElementById('btn-close-sub-modal');
const pendingOrderAlert = document.getElementById('pending-order-alert');
const regFullname = document.getElementById('reg-fullname');
const regPhone = document.getElementById('reg-phone');
const regRegion = document.getElementById('reg-region');
const regSchool = document.getElementById('reg-school');
const regGrade = document.getElementById('reg-grade');
const calcStudentsRange = document.getElementById('calc-students-range');
const calcStudentsVal = document.getElementById('calc-students-val');
const rateBadge = document.getElementById('rate-badge');
const calcTotalAmount = document.getElementById('calc-total-amount');
const calcOriginalAmount = document.getElementById('calc-original-amount');
const calcDiscountBadge = document.getElementById('calc-discount-badge');
const calcSavedAmount = document.getElementById('calc-saved-amount');
const subCardNumber = document.getElementById('sub-card-number');
const subCardHolder = document.getElementById('sub-card-holder');
const subAdminLink = document.getElementById('sub-admin-link');
const btnCopyCard = document.getElementById('btn-copy-card');
const btnSubmitOrder = document.getElementById('btn-submit-order');
const modalOferta = document.getElementById('modal-oferta');
const btnOpenOferta = document.getElementById('btn-open-oferta');
const btnCloseOferta = document.getElementById('btn-close-oferta');

// Tariff Card Elements
const tariffCardMonthly = document.getElementById('tariff-card-monthly');
const tariffMonthlyTitle = document.getElementById('tariff-monthly-title');
const tariffMonthlySubtitle = document.getElementById('tariff-monthly-subtitle');
const tariffMonthlyBadge = document.getElementById('tariff-monthly-badge');
const tariffMonthlyLine = document.getElementById('tariff-monthly-line');
const tariffMonthlyPrice = document.getElementById('tariff-monthly-price');

const tariffCardAcademic = document.getElementById('tariff-card-academic');
const tariffAcademicTitle = document.getElementById('tariff-academic-title');
const tariffAcademicSubtitle = document.getElementById('tariff-academic-subtitle');
const tariffAcademicDaysBadge = document.getElementById('tariff-academic-days-badge');
const tariffAcademicLine = document.getElementById('tariff-academic-line');
const tariffAcademicPrice = document.getElementById('tariff-academic-price');
const tariffAcademicDiscountBadge = document.getElementById('tariff-academic-discount-badge');
const academicDaysTag = document.getElementById('academic-days-tag');

// Admin Elements
const btnOpenAdminPanel = document.getElementById('btn-open-admin-panel');
const modalAdminPanel = document.getElementById('modal-admin-panel');
const btnCloseAdminPanel = document.getElementById('btn-close-admin-panel');
const tabBtnOrders = document.getElementById('tab-btn-orders');
const tabBtnSettings = document.getElementById('tab-btn-settings');
const tabBtnUsers = document.getElementById('tab-btn-users');
const tabContentOrders = document.getElementById('tab-content-orders');
const tabContentSettings = document.getElementById('tab-content-settings');
const tabContentUsers = document.getElementById('tab-content-users');
const adminOrdersList = document.getElementById('admin-orders-list');
const adminOrdersFilter = document.getElementById('admin-orders-filter');
const adminOrdersCountBadge = document.getElementById('admin-orders-count-badge');
const btnRefreshOrders = document.getElementById('btn-refresh-orders');
const formAdminSettings = document.getElementById('form-admin-settings');
const adminInputPrice = document.getElementById('admin-input-price');
const adminInputDiscount = document.getElementById('admin-input-discount');
const adminInputCard = document.getElementById('admin-input-card');
const adminInputHolder = document.getElementById('admin-input-holder');
const adminInputContact = document.getElementById('admin-input-contact');
const adminUsersList = document.getElementById('admin-users-list');
const btnRefreshUsers = document.getElementById('btn-refresh-users');

// Stat Cards
const statCardPending = document.getElementById('stat-card-pending');
const statCardSuccess = document.getElementById('stat-card-success');
const statCardFailed = document.getElementById('stat-card-failed');
const statPending = document.getElementById('stat-pending');
const statSuccess = document.getElementById('stat-success');
const statFailed = document.getElementById('stat-failed');

// Active Filter Elements
const activeFilterBadgeContainer = document.getElementById('active-filter-badge-container');
const activeFilterText = document.getElementById('active-filter-text');
const btnClearStatusFilter = document.getElementById('btn-clear-status-filter');

// Bulk Progress Elements
const bulkProgressContainer = document.getElementById('bulk-progress-container');
const bulkProgressBar = document.getElementById('bulk-progress-bar');
const bulkProgressPercent = document.getElementById('bulk-progress-percent');
const bulkStatusText = document.getElementById('bulk-status-text');

// Calculation State
let currentPricePerMonth = 800;
let currentPricePerQuarter = 2000;
let currentAcademicDiscountPercent = 20;
let selectedTariff = 'academic_year'; // 'monthly' yoki 'academic_year'
let selectedStudentsCount = 30;
let selectedDurationDays = 260;

// -------------------------------------------------------------
function initApp() {
    loadPublicSettings();
    loadUserProfile();
    loadStudentsFromServer();
    loadMyLatestOrder();
    initSubscriptionCalculator();
    initAdminPanel();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

async function loadUserProfile() {
    try {
        const resp = await fetch('/api/me', {
            headers: getAuthHeaders()
        });
        if (resp.ok) {
            currentUser = await resp.json();
            renderSubscriptionBanner();
            checkAdminAndOnboarding();
        }
    } catch (e) {
        console.error('User profilini yuklashda xato:', e);
    }
}

function renderSubscriptionBanner() {
    if (!currentUser || !subscriptionBanner) return;
    subscriptionBanner.className = 'rounded-2xl p-3 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border transition-all';

    const sCount = students.length;
    const maxS = currentUser.maxStudents || 10;

    if (currentUser.plan === 'active') {
        subscriptionBanner.classList.add('bg-emerald-50', 'text-emerald-800', 'border-emerald-200');
        subIcon.innerHTML = '<i class="fa-solid fa-crown text-emerald-600 text-base"></i>';
        const days = currentUser.daysLeft ?? 0;
        subText.innerHTML = `<b>Faol obuna:</b> ${days} kun qoldi (${sCount}/${maxS} o'quvchi)`;
        subBadge.className = 'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        subBadge.textContent = 'VIP';
    } else if (currentUser.plan === 'blocked') {
        subscriptionBanner.classList.add('bg-rose-50', 'text-rose-800', 'border-rose-200');
        subIcon.innerHTML = '<i class="fa-solid fa-ban text-rose-600 text-base"></i>';
        subText.innerHTML = `<b>Hisobingiz bloklangan!</b> Iltimos, admin bilan bog'laning: @emaktabro_bot`;
        subBadge.className = 'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700';
        subBadge.textContent = 'Bloklangan';

        if (btnMainAction) btnMainAction.disabled = true;
        if (btnAddManual) btnAddManual.disabled = true;
        if (btnOpenExcelMenu) btnOpenExcelMenu.disabled = true;
    } else {
        // trial (7 kunlik sinov)
        subscriptionBanner.classList.add('bg-amber-50', 'text-amber-800', 'border-amber-200');
        subIcon.innerHTML = '<i class="fa-solid fa-box-open text-amber-600 text-base"></i>';
        const days = currentUser.daysLeft ?? 7;
        if (currentUser.isExpired) {
            subText.innerHTML = `<b>7 kunlik sinov muddati tugadi!</b> Davom etish uchun obuna xarid qiling.`;
            subBadge.className = 'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700';
            subBadge.textContent = 'Tugadi';
        } else {
            subText.innerHTML = `<b>Sinov rejimi:</b> ${days} kun qoldi (${sCount}/${maxS} ta o'quvchi)`;
            subBadge.className = 'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700';
            subBadge.textContent = `${days} kun`;
        }
    }
}

// Helper: Global Top Loader Bar
function showGlobalLoader() {
    if (globalTopLoader) {
        globalTopLoader.classList.remove('-translate-y-full', 'opacity-0');
        globalTopLoader.classList.add('animate-pulse');
    }
}

function hideGlobalLoader() {
    if (globalTopLoader) {
        globalTopLoader.classList.add('-translate-y-full', 'opacity-0');
        globalTopLoader.classList.remove('animate-pulse');
    }
}

function renderStudentsSkeleton() {
    if (!studentsContainer) return;
    studentsContainer.innerHTML = `
        <div class="space-y-2.5 py-1">
            <div class="p-3.5 bg-white rounded-2xl border border-border shadow-xs animate-pulse space-y-2.5">
                <div class="flex items-center justify-between">
                    <div class="h-4 bg-slate-200 rounded-lg w-1/3"></div>
                    <div class="h-5 bg-slate-100 rounded-full w-16"></div>
                </div>
                <div class="h-3 bg-slate-100 rounded-lg w-1/2"></div>
                <div class="flex items-center gap-2 pt-1">
                    <div class="h-3.5 bg-slate-100 rounded-lg w-24"></div>
                    <div class="h-3.5 bg-slate-100 rounded-lg w-20"></div>
                </div>
            </div>
            <div class="p-3.5 bg-white rounded-2xl border border-border shadow-xs animate-pulse space-y-2.5">
                <div class="flex items-center justify-between">
                    <div class="h-4 bg-slate-200 rounded-lg w-2/5"></div>
                    <div class="h-5 bg-slate-100 rounded-full w-16"></div>
                </div>
                <div class="h-3 bg-slate-100 rounded-lg w-3/5"></div>
                <div class="flex items-center gap-2 pt-1">
                    <div class="h-3.5 bg-slate-100 rounded-lg w-20"></div>
                    <div class="h-3.5 bg-slate-100 rounded-lg w-24"></div>
                </div>
            </div>
            <div class="p-3.5 bg-white rounded-2xl border border-border shadow-xs animate-pulse space-y-2.5">
                <div class="flex items-center justify-between">
                    <div class="h-4 bg-slate-200 rounded-lg w-1/4"></div>
                    <div class="h-5 bg-slate-100 rounded-full w-16"></div>
                </div>
                <div class="h-3 bg-slate-100 rounded-lg w-2/5"></div>
                <div class="flex items-center gap-2 pt-1">
                    <div class="h-3.5 bg-slate-100 rounded-lg w-28"></div>
                </div>
            </div>
        </div>
    `;
}

async function loadStudentsFromServer(showSkeleton = false) {
    showGlobalLoader();
    if (showSkeleton || students.length === 0) {
        renderStudentsSkeleton();
    }

    try {
        const resp = await fetch('/api/students', {
            headers: getAuthHeaders()
        });
        if (resp.ok) {
            const data = await resp.json();
            students = data.students || [];
            updateFilters();
            renderStudents();
            updateStats();
            renderSubscriptionBanner();
        } else {
            console.error('Serverdan yuklashda xato:', resp.status);
            renderStudents();
        }
    } catch (e) {
        console.error('Tarmoq xatosi:', e);
        renderStudents();
    } finally {
        hideGlobalLoader();
    }
}

// Helper: Haptic Feedback
function triggerHaptic(type = 'light') {
    if (tg?.HapticFeedback) {
        if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
        else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
        else tg.HapticFeedback.impactOccurred('medium');
    }
}

// -------------------------------------------------------------
// 2. EXCEL MENU & NAMUNA MODAL
// -------------------------------------------------------------
btnOpenExcelMenu.addEventListener('click', openExcelMenu);
function openExcelMenu() {
    modalExcelMenu.classList.remove('hidden');
    triggerHaptic();
}
function closeExcelMenu() {
    modalExcelMenu.classList.add('hidden');
}
function chooseExcelFile() {
    closeExcelMenu();
    fileInput.click();
}

fileInput.addEventListener('change', handleExcelUpload);

async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    triggerHaptic();
    showGlobalLoader();
    if (modalUploadLoading) {
        modalUploadLoading.classList.remove('hidden');
    }
    if (uploadLoadingText) {
        uploadLoadingText.textContent = `"${file.name}" yuklanmoqda va Supabase bazasiga saqlanmoqda...`;
    }

    try {
        let authVal = tg?.initData || localStorage.getItem('emaktab_dev_user') || 'dev_user_1';
        const resp = await fetch('/api/upload-excel', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authVal}`
            },
            body: formData
        });
        const result = await resp.json().catch(() => ({}));

        if (resp.ok && result.students) {
            await loadStudentsFromServer(true);
            await loadUserProfile();
            triggerHaptic('success');
            let msg = `${result.count} ta o'quvchi muvaffaqiyatli saqlandi!`;
            if (result.skipped > 0) {
                msg += ` (${result.skipped} ta o'quvchi limit sababli qoldirildi)`;
            }
            showToast(msg);
        } else {
            showToast(result.detail || 'Fayl saqlanmadi', true);
            triggerHaptic('error');
        }
    } catch (err) {
        showToast('Bog\'lanishda xatolik: ' + err.message, true);
        triggerHaptic('error');
    } finally {
        fileInput.value = '';
        if (modalUploadLoading) {
            modalUploadLoading.classList.add('hidden');
        }
        hideGlobalLoader();
    }
}

// -------------------------------------------------------------
// 3. STATISTIKA KARTALARI ORQALI FILTRLASH
// -------------------------------------------------------------
statCardPending.addEventListener('click', () => toggleStatusFilter('pending'));
statCardSuccess.addEventListener('click', () => toggleStatusFilter('success'));
statCardFailed.addEventListener('click', () => toggleStatusFilter('failed'));
btnClearStatusFilter.addEventListener('click', () => toggleStatusFilter('all'));

function toggleStatusFilter(status) {
    if (selectedStatusFilter === status || status === 'all') {
        selectedStatusFilter = 'all';
    } else {
        selectedStatusFilter = status;
    }

    triggerHaptic();
    updateStatCardStyles();
    renderStudents();
}

function updateStatCardStyles() {
    statCardPending.className = 'stat-card bg-white rounded-2xl p-3 border-2 border-border shadow-sm flex flex-col justify-between cursor-pointer transition active:scale-95 hover:shadow-md';
    statCardSuccess.className = 'stat-card bg-white rounded-2xl p-3 border-2 border-border shadow-sm flex flex-col justify-between cursor-pointer transition active:scale-95 hover:shadow-md';
    statCardFailed.className = 'stat-card bg-white rounded-2xl p-3 border-2 border-border shadow-sm flex flex-col justify-between cursor-pointer transition active:scale-95 hover:shadow-md';

    if (selectedStatusFilter === 'pending') {
        statCardPending.classList.add('active-pending');
        activeFilterBadgeContainer.classList.remove('hidden');
        activeFilterText.textContent = 'Filtr: Kutilayotgan o\'quvchilar';
    } else if (selectedStatusFilter === 'success') {
        statCardSuccess.classList.add('active-success');
        activeFilterBadgeContainer.classList.remove('hidden');
        activeFilterText.textContent = 'Filtr: Muvaffaqiyatli kirilganlar';
    } else if (selectedStatusFilter === 'failed') {
        statCardFailed.classList.add('active-failed');
        activeFilterBadgeContainer.classList.remove('hidden');
        activeFilterText.textContent = 'Filtr: Xatolik yuz berganlar';
    } else {
        activeFilterBadgeContainer.classList.add('hidden');
    }
}

// -------------------------------------------------------------
// 4. O'QUVCHI QO'SHISH VA TAHRIRLASH (SUPABASE DB BILAN)
// -------------------------------------------------------------
btnAddManual.addEventListener('click', () => openStudentForm());
btnCloseFormModal.addEventListener('click', () => modalStudentForm.classList.add('hidden'));

function openStudentForm(student = null) {
    if (student) {
        modalFormTitle.textContent = 'O\'quvchini tahrirlash';
        inputEditId.value = student.id;
        document.getElementById('input-name').value = student.name;
        document.getElementById('input-school').value = student.schoolName;
        document.getElementById('input-grade').value = student.grade;
        document.getElementById('input-login').value = student.login;
        document.getElementById('input-password').value = student.password;
        document.getElementById('input-parent-login').value = student.parentLogin || '';
        document.getElementById('input-parent-password').value = student.parentPassword || '';
    } else {
        modalFormTitle.textContent = 'Yangi o\'quvchi qo\'shish';
        inputEditId.value = '';
        formStudent.reset();
        document.getElementById('input-school').value = 'Maktab';
        document.getElementById('input-grade').value = '1-A';
        document.getElementById('input-parent-login').value = '';
        document.getElementById('input-parent-password').value = '';
    }
    modalStudentForm.classList.remove('hidden');
    triggerHaptic();
}

function editStudent(id) {
    const student = students.find(s => s.id === id);
    if (student) {
        openStudentForm(student);
    }
}

formStudent.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = inputEditId.value;

    const payload = {
        name: document.getElementById('input-name').value.trim(),
        schoolName: document.getElementById('input-school').value.trim() || 'Maktab',
        grade: document.getElementById('input-grade').value.trim() || '1-A',
        login: document.getElementById('input-login').value.trim(),
        password: document.getElementById('input-password').value.trim(),
        parentLogin: document.getElementById('input-parent-login').value.trim(),
        parentPassword: document.getElementById('input-parent-password').value.trim()
    };

    if (btnSubmitForm) {
        btnSubmitForm.disabled = true;
        btnSubmitForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Saqlanmoqda...';
    }
    showGlobalLoader();

    try {
        if (editId) {
            // Tahrirlash (PUT)
            const resp = await fetch(`/api/students/${editId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) {
                showToast('O\'quvchi ma\'lumotlari yangilandi');
                await loadStudentsFromServer();
                triggerHaptic('success');
                modalStudentForm.classList.add('hidden');
            } else {
                showToast(data.detail || 'Tahrirlashda xatolik', true);
                triggerHaptic('error');
            }
        } else {
            // Yangi qo'shish (POST)
            const resp = await fetch('/api/students', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) {
                showToast('Yangi o\'quvchi saqlandi');
                await loadStudentsFromServer();
                await loadUserProfile();
                triggerHaptic('success');
                modalStudentForm.classList.add('hidden');
            } else {
                showToast(data.detail || 'Saqlashda xatolik', true);
                triggerHaptic('error');
            }
        }
    } catch (err) {
        showToast('Tarmoq xatosi: ' + err.message, true);
        triggerHaptic('error');
    } finally {
        if (btnSubmitForm) {
            btnSubmitForm.disabled = false;
            btnSubmitForm.innerHTML = 'Saqlash';
        }
        hideGlobalLoader();
    }
});

async function deleteStudent(id) {
    if (!confirm('O\'quvchini o\'chirmoqchimisiz?')) return;

    showGlobalLoader();
    try {
        const resp = await fetch(`/api/students/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (resp.ok) {
            students = students.filter(s => s.id !== id);
            updateFilters();
            renderStudents();
            updateStats();
            await loadUserProfile();
            triggerHaptic('success');
            showToast('O\'quvchi o\'chirildi');
        } else {
            const data = await resp.json().catch(() => ({}));
            showToast(data.detail || 'O\'chirishda xatolik', true);
            triggerHaptic('error');
        }
    } catch (err) {
        showToast('O\'chirishda xatolik: ' + err.message, true);
        triggerHaptic('error');
    } finally {
        hideGlobalLoader();
    }
}

// -------------------------------------------------------------
// 5. FILTRLASH VA QIDIRUV
// -------------------------------------------------------------
searchInput.addEventListener('input', renderStudents);
filterSchool.addEventListener('change', renderStudents);
filterGrade.addEventListener('change', renderStudents);

function updateFilters() {
    const schools = [...new Set(students.map(s => s.schoolName).filter(Boolean))];
    const grades = [...new Set(students.map(s => s.grade).filter(Boolean))];

    filterSchool.innerHTML = '<option value="all">Barcha maktablar</option>' + 
        schools.map(s => `<option value="${s}">${s}</option>`).join('');

    filterGrade.innerHTML = '<option value="all">Barcha sinflar</option>' + 
        grades.map(g => `<option value="${g}">${g}</option>`).join('');
}

function getFilteredStudents() {
    const query = searchInput.value.toLowerCase().trim();
    const selectedSchool = filterSchool.value;
    const selectedGrade = filterGrade.value;

    return students.filter(s => {
        const matchQuery = !query || 
            s.name.toLowerCase().includes(query) || 
            s.login.toLowerCase().includes(query) ||
            s.id.toLowerCase().includes(query);

        const matchSchool = selectedSchool === 'all' || s.schoolName === selectedSchool;
        const matchGrade = selectedGrade === 'all' || s.grade === selectedGrade;
        const matchStatus = selectedStatusFilter === 'all' || s.status === selectedStatusFilter;

        return matchQuery && matchSchool && matchGrade && matchStatus;
    });
}

function updateStats() {
    const pending = students.filter(s => s.status === 'pending').length;
    const success = students.filter(s => s.status === 'success').length;
    const failed = students.filter(s => s.status === 'failed').length;

    statPending.textContent = pending;
    statSuccess.textContent = success;
    statFailed.textContent = failed;
}

// -------------------------------------------------------------
// 6. UI CHIQARISH (RENDER)
// -------------------------------------------------------------
function renderStudents() {
    const filtered = getFilteredStudents();

    if (students.length === 0) {
        emptyState.classList.remove('hidden');
        studentsContainer.innerHTML = '';
        studentsContainer.appendChild(emptyState);
        return;
    }

    emptyState.classList.add('hidden');

    if (filtered.length === 0) {
        studentsContainer.innerHTML = `
            <div class="text-center py-8 text-slate-400 text-xs font-medium bg-white rounded-2xl border border-dashed border-slate-300">
                Ushbu filtr bo'yicha hech qanday o'quvchi topilmadi
            </div>
        `;
        return;
    }

    studentsContainer.innerHTML = filtered.map(student => {
        let statusBadge = '';
        let borderClass = 'border-border';

        if (student.status === 'success') {
            const timeAgo = student.successAt ? getTimeAgo(student.successAt) : 'Hozir';
            statusBadge = `
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200" title="${timeAgo}">
                    <i class="fa-solid fa-check mr-1 text-[9px]"></i> Tayyor (${timeAgo})
                </span>
            `;
            borderClass = 'border-emerald-200 bg-emerald-50/20';
        } else if (student.status === 'failed') {
            statusBadge = `
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200" title="${student.message || ''}">
                    <i class="fa-solid fa-triangle-exclamation mr-1 text-[9px]"></i> Xatolik
                </span>
            `;
            borderClass = 'border-rose-200 bg-rose-50/20';
        } else if (student.status === 'processing') {
            statusBadge = `
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 animate-pulse">
                    <i class="fa-solid fa-spinner fa-spin mr-1 text-[9px]"></i> Kirilmoqda...
                </span>
            `;
            borderClass = 'border-blue-300 bg-blue-50/30';
        } else {
            statusBadge = `
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                    <i class="fa-regular fa-clock mr-1 text-[9px]"></i> Kutilmoqda
                </span>
            `;
        }

        const initials = student.name.charAt(0).toUpperCase();

        let messageHtml = '';
        if (student.message) {
            if (student.status === 'success') {
                messageHtml = `<p class="text-[10px] text-emerald-600 font-semibold truncate" title="${student.message}"><i class="fa-solid fa-circle-check mr-1 text-[9px]"></i>${student.message}</p>`;
            } else if (student.status === 'failed') {
                messageHtml = `<p class="text-[10px] text-rose-500 font-medium truncate" title="${student.message}"><i class="fa-solid fa-circle-exclamation mr-1 text-[9px]"></i>${student.message}</p>`;
            } else if (student.status === 'processing') {
                messageHtml = `<p class="text-[10px] text-blue-500 font-medium truncate" title="${student.message}"><i class="fa-solid fa-spinner fa-spin mr-1 text-[9px]"></i>${student.message}</p>`;
            } else {
                messageHtml = `<p class="text-[10px] text-slate-500 font-medium truncate" title="${student.message}"><i class="fa-solid fa-circle-info mr-1 text-[9px]"></i>${student.message}</p>`;
            }
        } else {
            const parentText = student.parentLogin ? ` | Ota-ona: ${student.parentLogin}` : '';
            messageHtml = `<span class="text-[10px] text-slate-400 font-mono truncate block" title="O'quvchi: ${student.login}${parentText}">Login: ${student.login}${parentText}</span>`;
        }

        return `
            <div class="bg-white rounded-2xl p-2.5 sm:p-3 border ${borderClass} shadow-sm transition hover:shadow-md space-y-2">
                <!-- Yuqori qator: Ism, Maktab va Status -->
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs sm:text-sm shadow-sm shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0 flex-1">
                            <h4 class="text-xs sm:text-[13px] font-bold text-slate-900 truncate leading-snug">${student.name}</h4>
                            <div class="flex items-center space-x-1.5 text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                                <span class="bg-slate-100 px-1.5 py-0.2 rounded font-semibold text-slate-700 shrink-0">${student.grade}</span>
                                <span class="shrink-0">•</span>
                                <span class="truncate">${student.schoolName}</span>
                                <span class="shrink-0">•</span>
                                ${student.parentLogin 
                                    ? `<span class="text-emerald-600 font-semibold shrink-0" title="Ota-ona logini: ${student.parentLogin}"><i class="fa-solid fa-user-group text-[9px] mr-0.5"></i>Ota-ona bor</span>` 
                                    : `<span class="text-slate-400 shrink-0" title="Ota-ona kiritilmagan"><i class="fa-solid fa-user-xmark text-[9px] mr-0.5"></i>Ota-onasiz</span>`}
                            </div>
                        </div>
                    </div>
                    <div class="shrink-0">
                        ${statusBadge}
                    </div>
                </div>

                <!-- Pastki qator: Status xabari va Harakat tugmalari -->
                <div class="flex items-center justify-between pt-1.5 border-t border-slate-100/80 gap-2">
                    <div class="min-w-0 flex-1">
                        ${messageHtml}
                    </div>
                    <div class="flex items-center space-x-1 shrink-0">
                        <!-- Kirish -->
                        <button onclick="startSingleLogin('${student.id}')" class="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-primary font-bold text-[10px] transition flex items-center space-x-1 active:scale-95" title="Kirish">
                            <i class="fa-solid fa-play text-[8px]"></i>
                            <span>Kirish</span>
                        </button>
                        <!-- Tahrirlash -->
                        <button onclick="editStudent('${student.id}')" class="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition active:scale-95" title="Tahrirlash">
                            <i class="fa-solid fa-pen-to-square text-[10px]"></i>
                        </button>
                        <!-- O'chirish -->
                        <button onclick="deleteStudent('${student.id}')" class="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition active:scale-95" title="O'chirish">
                            <i class="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(timestamp) {
    const diffHours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Yangi';
    if (diffHours < 24) return `${diffHours}s oldin`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}k oldin`;
}

// -------------------------------------------------------------
// 7. AVTOMATIK KIRISH (SUPABASE STATUS UPDATE BILAN)
// -------------------------------------------------------------
async function startSingleLogin(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;

    student.status = 'processing';
    student.message = '';
    renderStudents();
    triggerHaptic();

    try {
        const resp = await fetch('/api/login-single', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(student)
        });
        const result = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            student.status = 'failed';
            student.message = result.detail || 'Xatolik yuz berdi';
            triggerHaptic('error');
            if (resp.status === 403) {
                showToast(result.detail || 'Obuna xatosi', true);
                await loadUserProfile();
            } else if (resp.status === 429) {
                showToast(result.detail || 'Juda ko\'p so\'rov', true);
            }
        } else {
            student.status = result.status;
            student.message = result.message || '';
            if (result.status === 'success') {
                student.successAt = Date.now();
            }
            triggerHaptic(result.status === 'success' ? 'success' : 'error');
        }
    } catch (err) {
        student.status = 'failed';
        student.message = 'Tarmoq xatosi: ' + err.message;
        triggerHaptic('error');
    } finally {
        renderStudents();
        updateStats();
    }
}

btnMainAction.addEventListener('click', () => {
    if (isBulkRunning) {
        stopBulkAutomation();
    } else {
        startBulkAutomation();
    }
});

function stopBulkAutomation() {
    shouldStopBulk = true;
    isBulkRunning = false;
    btnMainAction.classList.remove('bg-rose-600', 'hover:bg-rose-700');
    btnMainAction.classList.add('bg-primary', 'hover:bg-primary-dark');
    mainActionText.textContent = 'AVTOMATIK KIRISH';
    bulkProgressContainer.classList.add('hidden');
    triggerHaptic('error');
    showToast('Jarayon to\'xtatildi');
}

async function startBulkAutomation() {
    const pendingStudents = getFilteredStudents().filter(s => s.status === 'pending');
    if (pendingStudents.length === 0) {
        showToast('Kutilayotgan (pending) o\'quvchilar yo\'q');
        return;
    }

    isBulkRunning = true;
    shouldStopBulk = false;
    btnMainAction.classList.remove('bg-primary', 'hover:bg-primary-dark');
    btnMainAction.classList.add('bg-rose-600', 'hover:bg-rose-700');
    mainActionText.textContent = 'TO\'XTATISH';
    bulkProgressContainer.classList.remove('hidden');
    triggerHaptic();

    let completed = 0;
    const total = pendingStudents.length;

    for (const student of pendingStudents) {
        if (shouldStopBulk) break;

        student.status = 'processing';
        bulkStatusText.textContent = `${student.name} ga kirilmoqda...`;
        renderStudents();

        try {
            const resp = await fetch('/api/login-single', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(student)
            });
            const result = await resp.json().catch(() => ({}));

            if (!resp.ok) {
                student.status = 'failed';
                student.message = result.detail || 'Xatolik yuz berdi';
                if (resp.status === 403) {
                    showToast(result.detail || 'Obuna xatosi. Jarayon to\'xtatildi.', true);
                    await loadUserProfile();
                    break;
                }
                if (resp.status === 429) {
                    showToast(result.detail || 'Tezlik limiti. 10s kutilyapti...', true);
                    await new Promise(r => setTimeout(r, 10000));
                }
            } else {
                student.status = result.status;
                student.message = result.message || '';
                if (result.status === 'success') {
                    student.successAt = Date.now();
                }
            }
        } catch (err) {
            student.status = 'failed';
            student.message = 'Tarmoq xatosi: ' + err.message;
        }

        completed++;
        const percent = Math.round((completed / total) * 100);
        bulkProgressBar.style.width = percent + '%';
        bulkProgressPercent.textContent = percent + '%';

        renderStudents();
        updateStats();
        await new Promise(r => setTimeout(r, 400));
    }

    stopBulkAutomation();
    triggerHaptic('success');
    showToast(`Ommaviy jarayon yakunlandi! (${completed}/${total})`);
}

function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = `fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xl transition-all ${isError ? 'bg-rose-600' : 'bg-slate-900/90 backdrop-blur-md'}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// -------------------------------------------------------------
// 8. ONBOARDING & CHORAKLIK OBUNA KALKULYATORI
// -------------------------------------------------------------

function checkAdminAndOnboarding() {
    if (!currentUser) return;

    // Admin bo'lsa yuqoridagi tugmani ko'rsatish
    if (currentUser.isAdmin && btnOpenAdminPanel) {
        btnOpenAdminPanel.classList.remove('hidden');
        btnOpenAdminPanel.classList.add('inline-flex');
    }

    // Agar oddiy sinf rahbar hali ro'yxatdan o'tmagan bo'lsa, oynani avtomatik ochish
    if (!currentUser.isAdmin && !currentUser.isRegistered && modalOnboardingSub) {
        if (regFullname && !regFullname.value) {
            regFullname.value = currentUser.fullName || currentUser.name || '';
        }
        openSubscriptionModal();
    }
}

function openSubscriptionModal() {
    if (!modalOnboardingSub) return;
    if (currentUser) {
        if (regFullname && !regFullname.value) regFullname.value = currentUser.fullName || currentUser.name || '';
        if (regPhone && !regPhone.value) regPhone.value = currentUser.phone || '';
        if (regSchool && !regSchool.value) regSchool.value = currentUser.schoolName || '';
        if (regGrade && !regGrade.value) regGrade.value = currentUser.grade || '';
        if (regRegion && !regRegion.value) regRegion.value = currentUser.region || '';
    }
    recalcSubscription();
    modalOnboardingSub.classList.remove('hidden');
    triggerHaptic();
}

function closeSubscriptionModal() {
    if (modalOnboardingSub) {
        modalOnboardingSub.classList.add('hidden');
    }
}

function openOfertaModal() {
    if (modalOferta) {
        modalOferta.classList.remove('hidden');
        triggerHaptic();
    }
}

function closeOfertaModal() {
    if (modalOferta) {
        modalOferta.classList.add('hidden');
        triggerHaptic();
    }
}

window.openOfertaModal = openOfertaModal;
window.closeOfertaModal = closeOfertaModal;

function getAcademicYearRemainingInfo() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = Jan, 4 = May, 8 = Sep
    const currentDay = now.getDate();

    let targetYear = currentYear;
    if (currentMonth > 4 || (currentMonth === 4 && currentDay > 25)) {
        targetYear += 1;
    }
    const may25 = new Date(targetYear, 4, 25, 23, 59, 59);

    const diffTime = may25.getTime() - now.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const remainingMonths = Math.max(1, Math.min(9, Math.ceil(diffDays / 30)));

    return {
        targetYear,
        days: diffDays,
        months: remainingMonths,
        may25Date: may25
    };
}

function selectTariff(tariff) {
    selectedTariff = tariff;

    if (tariff === 'monthly') {
        // 1 Oylik: Tanlangan (Ko'k)
        if (tariffCardMonthly) {
            tariffCardMonthly.className = 'tariff-card active cursor-pointer relative p-3 rounded-2xl border-2 border-primary bg-primary text-white transition shadow-md flex flex-col justify-between ring-2 ring-primary/20';
        }
        if (tariffMonthlyTitle) tariffMonthlyTitle.className = 'font-extrabold text-xs text-white';
        if (tariffMonthlySubtitle) tariffMonthlySubtitle.className = 'text-[10px] text-blue-100 mt-0.5';
        if (tariffMonthlyBadge) tariffMonthlyBadge.className = 'px-2 py-0.5 bg-white/20 text-white rounded-lg text-[10px] font-bold';
        if (tariffMonthlyLine) tariffMonthlyLine.className = 'mt-2.5 pt-2 border-t border-white/20 flex items-baseline justify-between';
        if (tariffMonthlyPrice) tariffMonthlyPrice.className = 'text-xs font-black text-white';

        // 25-Maygacha: Tanlanmagan (Oq)
        if (tariffCardAcademic) {
            tariffCardAcademic.className = 'tariff-card cursor-pointer relative p-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-700 hover:border-primary transition shadow-xs flex flex-col justify-between';
        }
        if (tariffAcademicTitle) tariffAcademicTitle.className = 'font-extrabold text-xs text-slate-900';
        if (tariffAcademicSubtitle) tariffAcademicSubtitle.className = 'text-[10px] text-slate-400 mt-0.5';
        if (tariffAcademicDaysBadge) tariffAcademicDaysBadge.className = 'px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold';
        if (tariffAcademicLine) tariffAcademicLine.className = 'mt-2.5 pt-2 border-t border-slate-100 flex items-baseline justify-between';
        if (tariffAcademicPrice) tariffAcademicPrice.className = 'text-xs font-black text-slate-900';
    } else {
        // 25-Maygacha: Tanlangan (Ko'k)
        if (tariffCardAcademic) {
            tariffCardAcademic.className = 'tariff-card active cursor-pointer relative p-3 rounded-2xl border-2 border-primary bg-primary text-white transition shadow-md flex flex-col justify-between ring-2 ring-primary/20';
        }
        if (tariffAcademicTitle) tariffAcademicTitle.className = 'font-extrabold text-xs text-white';
        if (tariffAcademicSubtitle) tariffAcademicSubtitle.className = 'text-[10px] text-blue-100 mt-0.5';
        if (tariffAcademicDaysBadge) tariffAcademicDaysBadge.className = 'px-2 py-0.5 bg-white/20 text-white rounded-lg text-[10px] font-bold backdrop-blur-xs';
        if (tariffAcademicLine) tariffAcademicLine.className = 'mt-2.5 pt-2 border-t border-white/20 flex items-baseline justify-between';
        if (tariffAcademicPrice) tariffAcademicPrice.className = 'text-xs font-black text-white';

        // 1 Oylik: Tanlanmagan (Oq)
        if (tariffCardMonthly) {
            tariffCardMonthly.className = 'tariff-card cursor-pointer relative p-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-700 hover:border-primary transition shadow-xs flex flex-col justify-between';
        }
        if (tariffMonthlyTitle) tariffMonthlyTitle.className = 'font-extrabold text-xs text-slate-900';
        if (tariffMonthlySubtitle) tariffMonthlySubtitle.className = 'text-[10px] text-slate-400 mt-0.5';
        if (tariffMonthlyBadge) tariffMonthlyBadge.className = 'px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold';
        if (tariffMonthlyLine) tariffMonthlyLine.className = 'mt-2.5 pt-2 border-t border-slate-100 flex items-baseline justify-between';
        if (tariffMonthlyPrice) tariffMonthlyPrice.className = 'text-xs font-black text-slate-900';
    }

    triggerHaptic();
    recalcSubscription();
}

async function loadPublicSettings() {
    try {
        const resp = await fetch('/api/settings/public');
        if (resp.ok) {
            const data = await resp.json();
            currentPricePerMonth = data.pricePerStudentMonth || 800;
            currentPricePerQuarter = data.pricePerStudentQuarter || 2000;
            if (data.academicDiscountPercent !== undefined) {
                const parsedDiscount = parseInt(data.academicDiscountPercent);
                currentAcademicDiscountPercent = !isNaN(parsedDiscount) ? parsedDiscount : 20;
            }
            if (tariffAcademicDiscountBadge) {
                if (currentAcademicDiscountPercent > 0) {
                    tariffAcademicDiscountBadge.textContent = `🏆 -${currentAcademicDiscountPercent}% CHEGIRMA`;
                    tariffAcademicDiscountBadge.classList.remove('hidden');
                } else {
                    tariffAcademicDiscountBadge.classList.add('hidden');
                }
            }
            if (rateBadge) {
                rateBadge.textContent = `1 o'quvchi / 1 oy: ${currentPricePerMonth.toLocaleString('uz-UZ')} so'm`;
            }
            if (subCardNumber) subCardNumber.textContent = data.cardNumber || '9860 1234 5678 9012';
            if (subCardHolder) subCardHolder.textContent = data.cardHolder || 'ADMIN ISM FAMILIYA';
            if (subAdminLink) {
                const contact = data.adminTelegramContact || '@emaktabro_bot';
                subAdminLink.textContent = contact;
                subAdminLink.href = 'https://t.me/' + contact.replace('@', '');
            }
            recalcSubscription();
        }
    } catch (e) {
        console.error('Sozlamalarni yuklashda xato:', e);
    }
}

function initSubscriptionCalculator() {
    if (btnOpenSubModal) {
        btnOpenSubModal.addEventListener('click', openSubscriptionModal);
    }
    if (btnCloseSubModal) {
        btnCloseSubModal.addEventListener('click', closeSubscriptionModal);
    }

    // O'quvchilar soni slayderi
    if (calcStudentsRange) {
        calcStudentsRange.addEventListener('input', (e) => {
            selectedStudentsCount = parseInt(e.target.value) || 30;
            if (calcStudentsVal) calcStudentsVal.textContent = `${selectedStudentsCount} ta`;
            recalcSubscription();
        });
    }

    // Tarif tanlash kartochkalari
    if (tariffCardMonthly) {
        tariffCardMonthly.addEventListener('click', () => selectTariff('monthly'));
    }
    if (tariffCardAcademic) {
        tariffCardAcademic.addEventListener('click', () => selectTariff('academic_year'));
    }

    // Karta raqamidan nusxa olish
    if (btnCopyCard && subCardNumber) {
        btnCopyCard.addEventListener('click', () => {
            const cardNum = subCardNumber.textContent.replace(/\s+/g, '');
            navigator.clipboard.writeText(cardNum).then(() => {
                triggerHaptic('success');
                showToast('Karta raqami nusxalandi');
            }).catch(() => {
                showToast(subCardNumber.textContent);
            });
        });
    }

    // To'lov qildim va so'rov yuborish
    if (btnSubmitOrder) {
        btnSubmitOrder.addEventListener('click', handleRegisterAndSubmitOrder);
    }

    // Ommaviy oferta modali tinglovchilari
    if (btnOpenOferta) {
        btnOpenOferta.addEventListener('click', openOfertaModal);
    }
    if (btnCloseOferta) {
        btnCloseOferta.addEventListener('click', closeOfertaModal);
    }
    if (modalOferta) {
        modalOferta.addEventListener('click', (e) => {
            if (e.target === modalOferta) closeOfertaModal();
        });
    }

    // Boshlang'ich tarif holatini JS orqali o'rnatish (vizual + narx to'g'ri bo'lishi uchun)
    selectTariff('academic_year');
}

function recalcSubscription() {
    const academicInfo = getAcademicYearRemainingInfo();

    // 1. Oylik narx
    const monthlyBase = selectedStudentsCount * currentPricePerMonth;

    // 2. 25-maygacha o'quv yili pro-rata narxi
    const academicBase = monthlyBase * academicInfo.months;
    const discountPercent = academicInfo.months > 1 ? currentAcademicDiscountPercent : 0;
    const academicDiscounted = discountPercent > 0
        ? Math.round((academicBase * (100 - discountPercent) / 100) / 1000) * 1000
        : academicBase;
    const academicSaved = academicBase - academicDiscounted;

    // UI kartochkalaridagi narxlarni yangilash
    if (tariffMonthlyPrice) {
        tariffMonthlyPrice.textContent = `${monthlyBase.toLocaleString('uz-UZ')} so'm`;
    }
    if (tariffAcademicPrice) {
        tariffAcademicPrice.textContent = `${academicDiscounted.toLocaleString('uz-UZ')} so'm`;
    }
    if (tariffAcademicDaysBadge) {
        tariffAcademicDaysBadge.textContent = `${academicInfo.days} kun`;
    }
    if (tariffAcademicSubtitle) {
        tariffAcademicSubtitle.textContent = `25-maygacha (${academicInfo.months} oylik)`;
    }
    if (academicDaysTag) {
        academicDaysTag.textContent = `25-maygacha (${academicInfo.days} kun qoldi)`;
    }

    // Tanlangan tarif bo'yicha jami summani chiqarish
    let totalAmount = monthlyBase;
    let originalAmount = 0;
    let savedAmount = 0;

    if (selectedTariff === 'monthly') {
        selectedDurationDays = 30;
        totalAmount = monthlyBase;
        originalAmount = 0;
        savedAmount = 0;
    } else {
        selectedDurationDays = academicInfo.days;
        totalAmount = academicDiscounted;
        originalAmount = academicBase;
        savedAmount = academicSaved;
    }

    if (calcTotalAmount) {
        calcTotalAmount.textContent = `${totalAmount.toLocaleString('uz-UZ')} so'm`;
    }

    if (calcOriginalAmount && calcDiscountBadge && calcSavedAmount) {
        if (savedAmount > 0) {
            calcOriginalAmount.textContent = `${originalAmount.toLocaleString('uz-UZ')} so'm`;
            calcOriginalAmount.classList.remove('hidden');
            calcSavedAmount.textContent = savedAmount.toLocaleString('uz-UZ');
            calcDiscountBadge.innerHTML = `🎉 <b>${savedAmount.toLocaleString('uz-UZ')} so'm tejaldi</b> (O'quv yili uchun ${discountPercent}% chegirma)`;
            calcDiscountBadge.classList.remove('hidden');
        } else {
            calcOriginalAmount.classList.add('hidden');
            calcDiscountBadge.classList.add('hidden');
        }
    }

    return totalAmount;
}

async function handleRegisterAndSubmitOrder() {
    const fullName = regFullname?.value.trim();
    const phone = regPhone?.value.trim();
    const schoolName = regSchool?.value.trim();
    const grade = regGrade?.value.trim();
    const region = regRegion?.value.trim() || '';

    if (!fullName || !phone || !schoolName || !grade) {
        showToast("Iltimos, barcha anketadagi ma'lumotlarni to'ldiring!", true);
        triggerHaptic('error');
        return;
    }

    btnSubmitOrder.disabled = true;
    btnSubmitOrder.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yuborilmoqda...';

    try {
        // 1. Profilni saqlash (ro'yxatdan o'tish)
        const regResp = await fetch('/api/register', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ fullName, phone, schoolName, grade, region })
        });

        if (!regResp.ok) {
            const err = await regResp.json().catch(() => ({}));
            throw new Error(err.detail || 'Profilni saqlashda xatolik');
        }

        // 2. To'lov so'rovini yuborish
        const totalAmount = recalcSubscription();
        const academicInfo = getAcademicYearRemainingInfo();
        const orderResp = await fetch('/api/subscription-orders', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                studentsCount: selectedStudentsCount,
                quartersCount: selectedTariff === 'monthly' ? 1 : academicInfo.months,
                durationDays: selectedDurationDays,
                amountUzs: totalAmount,
                tariffType: selectedTariff
            })
        });

        if (!orderResp.ok) {
            const err = await orderResp.json().catch(() => ({}));
            throw new Error(err.detail || 'So\'rov yuborishda xatolik');
        }

        triggerHaptic('success');
        showToast("To'lov so'rovingiz qabul qilindi! Admin tez orada tasdiqlaydi.");
        closeSubscriptionModal();
        await loadUserProfile();
        await loadMyLatestOrder();
    } catch (err) {
        showToast(err.message, true);
        triggerHaptic('error');
    } finally {
        btnSubmitOrder.disabled = false;
        btnSubmitOrder.innerHTML = '<i class="fa-solid fa-paper-plane"></i> To\'lov qildim va so\'rov yuborish';
    }
}

async function loadMyLatestOrder() {
    try {
        const resp = await fetch('/api/subscription-orders/my', {
            headers: getAuthHeaders()
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data.order && data.order.status === 'pending') {
                if (pendingOrderAlert) pendingOrderAlert.classList.remove('hidden');
            } else {
                if (pendingOrderAlert) pendingOrderAlert.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error('So\'nggi so\'rovni yuklashda xato:', e);
    }
}


// -------------------------------------------------------------
// 9. ADMIN BOSHQARUV PANELI
// -------------------------------------------------------------

function openAdminPanelModal() {
    if (modalAdminPanel) {
        modalAdminPanel.classList.remove('hidden');
    }
    switchAdminTab('orders');
    triggerHaptic();
}
window.openAdminPanelModal = openAdminPanelModal;

function closeAdminPanelModal() {
    if (modalAdminPanel) {
        modalAdminPanel.classList.add('hidden');
    }
}
window.closeAdminPanelModal = closeAdminPanelModal;

function initAdminPanel() {
    if (btnOpenAdminPanel) {
        btnOpenAdminPanel.addEventListener('click', openAdminPanelModal);
    }

    if (btnCloseAdminPanel) {
        btnCloseAdminPanel.addEventListener('click', closeAdminPanelModal);
    }

    // Tablar
    if (tabBtnOrders) tabBtnOrders.addEventListener('click', () => switchAdminTab('orders'));
    if (tabBtnSettings) tabBtnSettings.addEventListener('click', () => switchAdminTab('settings'));
    if (tabBtnUsers) tabBtnUsers.addEventListener('click', () => switchAdminTab('users'));

    // Yangilash tugmalari va filtr
    if (btnRefreshOrders) btnRefreshOrders.addEventListener('click', loadAdminOrders);
    if (adminOrdersFilter) adminOrdersFilter.addEventListener('change', loadAdminOrders);
    if (btnRefreshUsers) btnRefreshUsers.addEventListener('click', loadAdminUsers);

    // Sozlamalarni saqlash
    if (formAdminSettings) {
        formAdminSettings.addEventListener('submit', handleSaveAdminSettings);
    }
}

function switchAdminTab(tab) {
    [tabBtnOrders, tabBtnSettings, tabBtnUsers].forEach(b => {
        if (b) {
            b.className = 'admin-tab-btn py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition text-center cursor-pointer';
        }
    });
    [tabContentOrders, tabContentSettings, tabContentUsers].forEach(c => {
        if (c) c.classList.add('hidden');
    });

    if (tab === 'orders') {
        if (tabBtnOrders) tabBtnOrders.className = 'admin-tab-btn active py-1.5 rounded-lg bg-white text-primary shadow-xs transition text-center cursor-pointer';
        if (tabContentOrders) tabContentOrders.classList.remove('hidden');
        loadAdminOrders();
    } else if (tab === 'settings') {
        if (tabBtnSettings) tabBtnSettings.className = 'admin-tab-btn active py-1.5 rounded-lg bg-white text-primary shadow-xs transition text-center cursor-pointer';
        if (tabContentSettings) tabContentSettings.classList.remove('hidden');
        loadAdminSettings();
    } else if (tab === 'users') {
        if (tabBtnUsers) tabBtnUsers.className = 'admin-tab-btn active py-1.5 rounded-lg bg-white text-primary shadow-xs transition text-center cursor-pointer';
        if (tabContentUsers) tabContentUsers.classList.remove('hidden');
        loadAdminUsers();
    }
    triggerHaptic();
}
window.switchAdminTab = switchAdminTab;

async function loadAdminOrders() {
    if (!adminOrdersList) return;
    adminOrdersList.innerHTML = `
        <div class="p-6 text-center space-y-2">
            <i class="fa-solid fa-circle-notch fa-spin text-primary text-xl"></i>
            <div class="text-xs font-semibold text-slate-500">So'rovlar yuklanmoqda...</div>
        </div>
    `;

    const filterStatus = adminOrdersFilter ? adminOrdersFilter.value : 'pending';

    try {
        const resp = await fetch(`/api/admin/orders?status=${encodeURIComponent(filterStatus)}`, { headers: getAuthHeaders() });
        if (!resp.ok) throw new Error('So\'rovlarni yuklab bo\'lmadi');
        const data = await resp.json();
        const orders = data.orders || [];

        if (adminOrdersCountBadge) {
            if (filterStatus === 'pending') {
                if (orders.length > 0) {
                    adminOrdersCountBadge.textContent = `${orders.length} ta`;
                    adminOrdersCountBadge.classList.remove('hidden');
                } else {
                    adminOrdersCountBadge.classList.add('hidden');
                }
            } else {
                adminOrdersCountBadge.classList.add('hidden');
            }
        }

        if (orders.length === 0) {
            const emptyMsg = filterStatus === 'pending'
                ? 'Yangi kutilayotgan to\'lov so\'rovlari mavjud emas.'
                : 'To\'lov so\'rovlari mavjud emas.';
            adminOrdersList.innerHTML = `<div class="text-center py-8 text-xs text-slate-400">${emptyMsg}</div>`;
            return;
        }

        adminOrdersList.innerHTML = '';
        orders.forEach(order => {
            const isPending = order.status === 'pending';
            const statusBadge = isPending 
                ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">Kutilmoqda</span>'
                : (order.status === 'approved' 
                    ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">Tasdiqlangan</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">Rad etilgan</span>');

            const tariffName = order.tariffType === 'monthly' ? '1 Oylik (30 kun)' : `25-Maygacha (${order.durationDays || '—'} kun)`;

            const card = document.createElement('div');
            card.className = 'p-3 bg-white border border-border rounded-xl shadow-xs space-y-2 text-xs transition-all duration-300';
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="font-bold text-slate-900">${order.userName || 'Foydalanuvchi'}</div>
                    ${statusBadge}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600">
                    <div>🏫 <b>Maktab:</b> ${order.schoolName || '—'} ${order.grade || ''}</div>
                    <div>📞 <b>Tel:</b> ${order.phone || '—'}</div>
                    <div>👨‍🎓 <b>O'quvchilar:</b> ${order.studentsCount} ta</div>
                    <div>📅 <b>Tarif:</b> ${tariffName}</div>
                    <div>💰 <b>To'lov:</b> <span class="font-bold text-emerald-600">${(order.amountUzs || 0).toLocaleString('uz-UZ')} so'm</span></div>
                    <div>🕒 <b>Vaqt:</b> ${order.createdAt}</div>
                </div>
                ${isPending ? `
                    <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button class="btn-approve-order flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer" data-id="${order.id}">
                            <i class="fa-solid fa-check"></i> Tasdiqlash
                        </button>
                        <button class="btn-reject-order flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer" data-id="${order.id}">
                            <i class="fa-solid fa-xmark"></i> Rad etish
                        </button>
                    </div>
                ` : ''}
            `;

            if (isPending) {
                const btnApprove = card.querySelector('.btn-approve-order');
                const btnReject = card.querySelector('.btn-reject-order');
                btnApprove.addEventListener('click', () => adminApproveOrder(order.id, card, btnApprove));
                btnReject.addEventListener('click', () => adminRejectOrder(order.id, card, btnReject));
            }

            adminOrdersList.appendChild(card);
        });
    } catch (err) {
        adminOrdersList.innerHTML = `<div class="text-center py-6 text-xs text-rose-500">${err.message}</div>`;
    }
}

async function adminApproveOrder(orderId, cardElement, btnElement) {
    if (!confirm('Ushbu to\'lovni tasdiqlab, obunani faollashtirmoqchimisiz?')) return;

    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    showGlobalLoader();

    try {
        const resp = await fetch(`/api/admin/orders/${orderId}/approve`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!resp.ok) throw new Error('Tasdiqlashda xatolik');
        triggerHaptic('success');
        showToast('Obuna muvaffaqiyatli faollashtirildi!');

        if (cardElement) {
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.95)';
            setTimeout(() => {
                loadAdminOrders();
            }, 250);
        } else {
            loadAdminOrders();
        }
    } catch (err) {
        showToast(err.message, true);
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Tasdiqlash';
        }
    } finally {
        hideGlobalLoader();
    }
}

async function adminRejectOrder(orderId, cardElement, btnElement) {
    const reason = prompt('Rad etish sababini kiriting:', 'To\'lov cheki tasdiqlanmadi');
    if (reason === null) return;

    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    showGlobalLoader();

    try {
        const resp = await fetch(`/api/admin/orders/${orderId}/reject`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason })
        });
        if (!resp.ok) throw new Error('Rad etishda xatolik');
        triggerHaptic();
        showToast('So\'rov rad etildi');

        if (cardElement) {
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.95)';
            setTimeout(() => {
                loadAdminOrders();
            }, 250);
        } else {
            loadAdminOrders();
        }
    } catch (err) {
        showToast(err.message, true);
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerHTML = '<i class="fa-solid fa-xmark"></i> Rad etish';
        }
    } finally {
        hideGlobalLoader();
    }
}

async function loadAdminSettings() {
    showGlobalLoader();
    try {
        const resp = await fetch('/api/admin/settings', { headers: getAuthHeaders() });
        if (resp.ok) {
            const data = await resp.json();
            if (adminInputPrice) adminInputPrice.value = data.price_per_student_month || data.price_per_student_quarter || '800';
            if (adminInputDiscount) adminInputDiscount.value = data.academic_discount_percent !== undefined ? data.academic_discount_percent : '20';
            if (adminInputCard) adminInputCard.value = data.card_number || '';
            if (adminInputHolder) adminInputHolder.value = data.card_holder || '';
            if (adminInputContact) adminInputContact.value = data.admin_telegram_contact || '';
        }
    } catch (e) {
        console.error('Admin sozlamalarni yuklashda xato:', e);
    } finally {
        hideGlobalLoader();
    }
}

async function handleSaveAdminSettings(e) {
    e.preventDefault();
    const btnSubmit = formAdminSettings ? formAdminSettings.querySelector('button[type="submit"]') : null;
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saqlanmoqda...';
    }
    showGlobalLoader();

    const payload = {
        pricePerStudentMonth: adminInputPrice.value.trim(),
        pricePerStudentQuarter: adminInputPrice.value.trim(),
        academicDiscountPercent: adminInputDiscount ? adminInputDiscount.value.trim() : '20',
        cardNumber: adminInputCard.value.trim(),
        cardHolder: adminInputHolder.value.trim(),
        adminTelegramContact: adminInputContact.value.trim()
    };

    try {
        const resp = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('Saqlashda xatolik');
        triggerHaptic('success');
        showToast('Sozlamalar saqlandi!');
        loadPublicSettings();
    } catch (err) {
        showToast(err.message, true);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Sozlamalarni saqlash';
        }
        hideGlobalLoader();
    }
}

async function loadAdminUsers() {
    if (!adminUsersList) return;
    adminUsersList.innerHTML = `
        <div class="p-6 text-center space-y-2">
            <i class="fa-solid fa-circle-notch fa-spin text-primary text-xl"></i>
            <div class="text-xs font-semibold text-slate-500">O'qituvchilar ro'yxati yuklanmoqda...</div>
        </div>
    `;

    try {
        const resp = await fetch('/api/admin/users', { headers: getAuthHeaders() });
        if (!resp.ok) throw new Error('Foydalanuvchilarni yuklab bo\'lmadi');
        const data = await resp.json();
        const users = data.users || [];

        if (users.length === 0) {
            adminUsersList.innerHTML = '<div class="text-center py-8 text-xs text-slate-400">Foydalanuvchilar mavjud emas.</div>';
            return;
        }

        adminUsersList.innerHTML = '';
        users.forEach(u => {
            const planBadge = u.plan === 'active' 
                ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">VIP</span>'
                : (u.plan === 'trial'
                    ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">Sinov</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">Bloklangan</span>');

            const card = document.createElement('div');
            card.className = 'p-3 bg-white border border-border rounded-xl shadow-xs space-y-2 text-xs';
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="font-bold text-slate-900">${u.fullName || u.name || 'Sinf rahbar'}</div>
                    ${planBadge}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600">
                    <div>🏫 <b>Maktab:</b> ${u.schoolName || '—'} ${u.grade || ''}</div>
                    <div>📞 <b>Tel:</b> ${u.phone || '—'}</div>
                    <div>👨‍🎓 <b>O'quvchilar:</b> ${u.studentCount || 0} / ${u.maxStudents}</div>
                    <div>📅 <b>Tugash:</b> ${u.expiresAt ? u.expiresAt.substring(0, 10) : 'Muddatsiz'}</div>
                </div>
                <div class="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                    <button class="btn-extend-user flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-calendar-plus"></i> Uzaytirish
                    </button>
                    <button class="btn-terminate-user flex-1 py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-bold transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-stop"></i> Tugatish
                    </button>
                </div>
            `;

            card.querySelector('.btn-extend-user').addEventListener('click', () => adminExtendUser(u.id, u.fullName || u.name));
            card.querySelector('.btn-terminate-user').addEventListener('click', () => adminTerminateUser(u.id, u.fullName || u.name));

            adminUsersList.appendChild(card);
        });
    } catch (err) {
        adminUsersList.innerHTML = `<div class="text-center py-6 text-xs text-rose-500">${err.message}</div>`;
    }
}

async function adminExtendUser(userId, userName) {
    const daysStr = prompt(`${userName} uchun obunani necha kunga uzaytirmoqchisiz? (Masalan: 30, 65, 130, 270):`, '65');
    if (!daysStr) return;
    const days = parseInt(daysStr);
    if (isNaN(days) || days <= 0) {
        showToast("Noto'g'ri kun kiritildi", true);
        return;
    }

    const studentsStr = prompt(`${userName} uchun o'quvchilar soni limitini kiriting (bo'sh qoldirsangiz o'zgarmaydi):`, '35');
    const maxStudents = studentsStr ? parseInt(studentsStr) : null;

    showGlobalLoader();
    try {
        const resp = await fetch(`/api/admin/users/${userId}/extend`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ days, maxStudents: isNaN(maxStudents) ? null : maxStudents })
        });
        if (!resp.ok) throw new Error('Uzaytirishda xatolik');
        triggerHaptic('success');
        showToast(`Obuna ${days} kunga uzaytirildi!`);
        loadAdminUsers();
    } catch (err) {
        showToast(err.message, true);
    } finally {
        hideGlobalLoader();
    }
}

async function adminTerminateUser(userId, userName) {
    if (!confirm(`${userName} ning obunasini to'xtatmoqchimisiz? Foydalanuvchi muddati tugagan holatiga o'tkaziladi.`)) return;

    showGlobalLoader();
    try {
        const resp = await fetch(`/api/admin/users/${userId}/terminate`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!resp.ok) throw new Error('To\'xtatishda xatolik');
        triggerHaptic();
        showToast('Obuna to\'xtatildi');
        loadAdminUsers();
    } catch (err) {
        showToast(err.message, true);
    } finally {
        hideGlobalLoader();
    }
}


// Telegram WebApp Initialization
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
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
const modalFormTitle = document.getElementById('modal-form-title');
const formStudent = document.getElementById('form-student');
const inputEditId = document.getElementById('input-edit-id');
const searchInput = document.getElementById('search-input');
const filterSchool = document.getElementById('filter-school');
const filterGrade = document.getElementById('filter-grade');
const btnMainAction = document.getElementById('btn-main-action');
const mainActionText = document.getElementById('main-action-text');

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

// -------------------------------------------------------------
// 1. MA'LUMOTLARNI SUPABASE BAZASIDAN YUKLASH
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadStudentsFromServer();
});

async function loadStudentsFromServer() {
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
        } else {
            console.error('Serverdan yuklashda xato:', resp.status);
        }
    } catch (e) {
        console.error('Tarmoq xatosi:', e);
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
    showToast('Excel yuklanmoqda va Supabase ga saqlanmoqda...');

    try {
        let authVal = tg?.initData || localStorage.getItem('emaktab_dev_user') || 'dev_user_1';
        const resp = await fetch('/api/upload-excel', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authVal}`
            },
            body: formData
        });
        const result = await resp.json();

        if (resp.ok && result.students) {
            // Yangi yuklangan o'quvchilarni serverdan to'liq qayta olamiz
            await loadStudentsFromServer();
            triggerHaptic('success');
            showToast(`${result.count} ta o'quvchi bazaga saqlandi!`);
        } else {
            showToast('Xatolik: ' + (result.detail || 'Fayl saqlanmadi'), true);
        }
    } catch (err) {
        showToast('Bog\'lanishda xatolik: ' + err.message, true);
    } finally {
        fileInput.value = '';
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
    } else {
        modalFormTitle.textContent = 'Yangi o\'quvchi qo\'shish';
        inputEditId.value = '';
        formStudent.reset();
        document.getElementById('input-school').value = 'Maktab';
        document.getElementById('input-grade').value = '1-A';
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
        password: document.getElementById('input-password').value.trim()
    };

    try {
        if (editId) {
            // Tahrirlash (PUT)
            const resp = await fetch(`/api/students/${editId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                showToast('O\'quvchi ma\'lumotlari yangilandi');
                await loadStudentsFromServer();
            } else {
                showToast('Tahrirlashda xatolik', true);
            }
        } else {
            // Yangi qo'shish (POST)
            const resp = await fetch('/api/students', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                showToast('Yangi o\'quvchi saqlandi');
                await loadStudentsFromServer();
            } else {
                showToast('Saqlashda xatolik', true);
            }
        }
    } catch (err) {
        showToast('Tarmoq xatosi: ' + err.message, true);
    }

    modalStudentForm.classList.add('hidden');
    triggerHaptic('success');
});

async function deleteStudent(id) {
    if (!confirm('O\'quvchini o\'chirmoqchimisiz?')) return;

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
            triggerHaptic();
            showToast('O\'quvchi o\'chirildi');
        }
    } catch (err) {
        showToast('O\'chirishda xatolik: ' + err.message, true);
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

        return `
            <div class="bg-white rounded-2xl p-3.5 border ${borderClass} shadow-sm transition hover:shadow-md flex items-center justify-between space-x-2.5">
                <div class="flex items-center space-x-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                        ${initials}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center space-x-1.5">
                            <h4 class="text-xs font-bold text-slate-900 truncate">${student.name}</h4>
                        </div>
                        <div class="flex items-center space-x-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span class="bg-slate-100 px-1.5 py-0.2 rounded font-semibold text-slate-700">${student.grade}</span>
                            <span>•</span>
                            <span class="truncate max-w-[110px]">${student.schoolName}</span>
                        </div>
                        ${student.message ? `<p class="text-[10px] text-rose-500 font-medium truncate mt-0.5">${student.message}</p>` : ''}
                    </div>
                </div>

                <div class="flex items-center space-x-1.5 shrink-0">
                    ${statusBadge}
                    <!-- Tahrirlash -->
                    <button onclick="editStudent('${student.id}')" class="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition" title="Tahrirlash">
                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                    </button>
                    <!-- Kirish -->
                    <button onclick="startSingleLogin('${student.id}')" class="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-primary transition" title="Kirish">
                        <i class="fa-solid fa-play text-xs"></i>
                    </button>
                    <!-- O'chirish -->
                    <button onclick="deleteStudent('${student.id}')" class="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition" title="O'chirish">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
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
        const result = await resp.json();

        student.status = result.status;
        student.message = result.message || '';
        if (result.status === 'success') {
            student.successAt = Date.now();
        }
        triggerHaptic(result.status === 'success' ? 'success' : 'error');
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
            const result = await resp.json();
            student.status = result.status;
            student.message = result.message || '';
            if (result.status === 'success') {
                student.successAt = Date.now();
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

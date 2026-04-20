const API_URL = "http://localhost:3000";

/* -------------------------------------------------------------------------- */
/*                                Utility Functions                           */
/* -------------------------------------------------------------------------- */

function formatDoctorName(name) {
    if (!name) return "";
    const clean = name.trim();
    if (clean.toLowerCase().startsWith('dr.') || clean.toLowerCase().startsWith('dr ')) {
        return clean;
    }
    return `Dr. ${clean}`;
}

/* -------------------------------------------------------------------------- */
/*                        Auth Page (Login/Register) Logic                    */
/* -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    // This runs on every page load. Check if we are on auth.html by presence of forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await loginNew();
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await registerNew();
        });

        // Hospital Preloading
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('role') === 'doctor') {
            loadHospitals();
        }
    }

    // Dashboard Init
    if (window.location.pathname.includes('patient_dashboard')) {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user) window.location.href = 'index.html';
        document.getElementById('displayPatientId').innerText = user.userId;
        document.getElementById('displayPatientName').innerText = user.name || "Patient";


        // Load Data
        getMyRecords();
        loadAuditLog();
    }

    if (window.location.pathname.includes('doctor_dashboard')) {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user) window.location.href = 'index.html';
        document.getElementById('displayDoctorId').innerText = user.userId;
        document.getElementById('displayDoctorName').innerText = formatDoctorName(user.name) || "Doctor";
    }

    if (window.location.pathname.includes('pharmacist_dashboard')) {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user) window.location.href = 'index.html';
        const elId = document.getElementById('displayPharmacistId');
        if (elId) elId.innerText = user.userId;
        const elName = document.getElementById('displayPharmacistName');
        if (elName) elName.innerText = user.name || "Pharmacist";
    }
});

/* -------------------------------------------------------------------------- */
/*                             New Auth Functions                             */
/* -------------------------------------------------------------------------- */

async function loginNew() {
    // Get Role from URL query param (set in index.html)
    const urlParams = new URLSearchParams(window.location.search);
    // Default to patient if missing, but index.html ensures it's there
    const role = urlParams.get('role') || 'patient';

    const userId = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPass').value;

    if (!userId || !password) {
        showNotification("Please enter User ID and Password", "error");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, password, role })
        });

        if (res.ok) {
            const user = await res.json();
            localStorage.setItem('currentUser', JSON.stringify(user));

            showNotification("Login Successful! Redirecting...", "success");

            setTimeout(() => {
                if (role === 'patient') {
                    window.location.href = 'patient_dashboard.html';
                } else if (role === 'pharmacist') {
                    window.location.href = 'pharmacist_dashboard.html';
                } else {
                    window.location.href = 'doctor_dashboard.html';
                }
            }, 1000);

        } else {
            const txt = await res.text();
            showNotification(txt, "error");
        }
    } catch (err) {
        console.error(err);
        if (err.message.includes("Failed to fetch")) {
            showNotification("Cannot connect to Server! Is it running?", "error");
        } else {
            showNotification("Login connection failed: " + err.message, "error");
        }
    }
}

async function sendOtp() {
    let phone = document.getElementById('regPhone').value.trim();
    const phoneCode = document.getElementById('regCountryCode') ? document.getElementById('regCountryCode').value : '';
    phone = phone ? (phone.startsWith('+') ? phone : phoneCode + phone) : '';

    if (!phone) {
        showNotification("Please enter Phone Number first", "error");
        return;
    }

    const btn = document.getElementById('btnSendOtp');
    btn.disabled = true;
    btn.innerText = "Sending...";

    try {
        const res = await fetch(`${API_URL}/sendRegistrationOtp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });

        const txt = await res.text();
        if (res.ok) {
            showNotification(txt, "success");
            btn.innerText = "OTP Sent!";
            setTimeout(() => { btn.disabled = false; btn.innerText = "Resend OTP"; }, 30000);
        } else {
            showNotification(txt, "error");
            btn.disabled = false;
            btn.innerText = "Send OTP";
        }
    } catch (err) {
        showNotification("Error sending OTP", "error");
        btn.disabled = false;
        btn.innerText = "Send OTP";
    }
}

async function registerNew() {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') || 'patient';

    const name = document.getElementById('regName').value.trim();
    const userId = document.getElementById('regId').value.trim();

    let phone = document.getElementById('regPhone').value.trim();
    const phoneCode = document.getElementById('regCountryCode') ? document.getElementById('regCountryCode').value : '';
    phone = phone ? (phone.startsWith('+') ? phone : phoneCode + phone) : '';

    const otp = document.getElementById('regOtp').value.trim();
    const password = document.getElementById('regPass').value;
    const confirmPass = document.getElementById('regConfirmPass').value;

    if (!userId || !password || !name || !phone || !otp) {
        showNotification("Please fill all fields, including Phone and OTP", "error");
        return;
    }

    if (password !== confirmPass) {
        showNotification("Passwords do not match", "error");
        return;
    }

    // Build User Object
    const userData = {
        userId,
        password,
        name,
        role,
        phone,
        otp
    };

    // Doctor Extras
    if (role === 'doctor') {
        const hospSelect = document.getElementById('regHospitalSelect');
        userData.hospitalId = hospSelect.value;
        userData.hospitalName = hospSelect.options[hospSelect.selectedIndex].text;
        userData.department = document.getElementById('regDepartmentSelect').value;
        userData.specialization = document.getElementById('regSpecialization').value;
        userData.specialist = userData.department; // Map department to specialist
        userData.registrationNumber = document.getElementById('regRegistrationNumber').value;
        userData.experienceYears = document.getElementById('regExperience').value;
        userData.workingHours = document.getElementById('regWorkingHours').value;

        if (!userData.hospitalId || !userData.department || !userData.registrationNumber) {
            showNotification("Please select Hospital, Department and fill Registration Number.", "error");
            return;
        }
    }

    // Pharmacist Extras
    if (role === 'pharmacist') {
        userData.shopName = document.getElementById('regShopName').value.trim();
        userData.license = document.getElementById('regPharmacistLicense').value.trim();

        if (!userData.shopName || !userData.license) {
            showNotification("Please fill all pharmacy details.", "error");
            return;
        }
    }

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });

        if (res.ok) {
            showNotification("Registration Successful! Please Sign In.", "success");

            // Clear registration form
            document.getElementById('regName').value = "";
            document.getElementById('regId').value = "";
            document.getElementById('regPhone').value = "";
            document.getElementById('regOtp').value = "";
            document.getElementById('regPass').value = "";
            document.getElementById('regConfirmPass').value = "";

            if (role === 'doctor') {
                document.getElementById('regSpecialization').value = "";
                document.getElementById('regHospitalSelect').value = "";
                document.getElementById('regDepartmentSelect').innerHTML = '<option value="">Select Department</option>';
                document.getElementById('regRegistrationNumber').value = "";
                document.getElementById('regExperience').value = "";
                document.getElementById('regWorkingHours').value = "";
            }

            const btn = document.getElementById('btnSendOtp');
            if (btn) { btn.disabled = false; btn.innerText = "Send OTP"; }

            // Slide back to login
            document.getElementById('container').classList.remove("right-panel-active");
            // Auto-fill login ID
            document.getElementById('loginId').value = userId;
        } else {
            const txt = await res.text();
            showNotification(txt, "error");
        }
    } catch (err) {
        console.error(err);
        showNotification("Error connecting to server.", "error");
    }
}

const hospitalCache = {}; // Simple cache for hospital objects

async function loadHospitals() {
    const selector = document.getElementById('regHospitalSelect');
    if (!selector) return;

    try {
        const res = await fetch(`${API_URL}/hospitals`);
        if (res.ok) {
            const hospitals = await res.json();
            selector.innerHTML = '<option value="">Select Hospital</option>';
            hospitals.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.hospitalId;
                opt.text = h.hospitalName;
                selector.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Failed to load hospitals", err);
    }
}

async function loadDepartments() {
    const hospId = document.getElementById('regHospitalSelect').value;
    const selector = document.getElementById('regDepartmentSelect');
    if (!selector || !hospId) return;

    selector.innerHTML = '<option value="">Loading...</option>';

    try {
        const res = await fetch(`${API_URL}/hospitals/${hospId}/specializations`);
        if (res.ok) {
            const specializations = await res.json();
            selector.innerHTML = '<option value="">Select Specialization</option>';
            specializations.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.text = s;
                selector.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Failed to load specializations", err);
        selector.innerHTML = '<option value="">Error loading</option>';
    }
}

// Utility for Toast Notifications
function showNotification(msg, type) {
    const notif = document.getElementById('notification');
    if (notif) {
        notif.style.display = 'block';
        notif.innerText = msg;
        notif.style.backgroundColor = type === 'success' ? '#e8f5e9' : '#ffebee';
        notif.style.color = type === 'success' ? '#2e7d32' : '#c62828';

        setTimeout(() => {
            notif.style.display = 'none';
        }, 4000);
    } else {
        alert(msg);
    }
}


/* -------------------------------------------------------------------------- */
/*                            Doctor Dashboard Logic (Add Record)             */
/* -------------------------------------------------------------------------- */

async function searchPatientForRecord() {
    let searchType = null;
    let queryValue = '';

    const typeInput = document.getElementById('recordSearchType');
    if (typeInput) searchType = typeInput.value;

    const errorEl = document.getElementById('searchPatientError');
    errorEl.style.display = 'none';

    if (searchType === 'num') {
        const phoneInp = document.getElementById('recordSearchPhone').value.trim();
        const code = document.getElementById('recordCountryCode') ? document.getElementById('recordCountryCode').value : '';
        queryValue = phoneInp ? (phoneInp.startsWith('+') ? phoneInp : code + phoneInp) : '';
        if (!phoneInp) {
            errorEl.innerText = "Please enter a phone number.";
            errorEl.style.display = 'block';
            return;
        }
    } else {
        queryValue = document.getElementById('recordSearchIdInput').value.trim();
        if (!queryValue) {
            errorEl.innerText = "Please enter a Patient Wallet/ID.";
            errorEl.style.display = 'block';
            return;
        }
    }

    try {
        const res = await fetch(`${API_URL}/searchPatients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryValue })
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById('step1-search').style.display = 'none';

            if (data.length === 1) {
                const patient = data[0];
                selectPatientForAddRecord(patient.name, patient.dob, patient.patientId);
            } else if (data.length === 0) {
                errorEl.innerText = "No patient found. Please check the ID or Phone Number.";
                errorEl.style.display = 'block';
                document.getElementById('step1-search').style.display = 'block';
            } else {
                let html = '<p style="text-align:center; color:var(--secondary-color);">Multiple patients found. Please select one:</p>';
                html += '<div style="display:flex; flex-direction:column; gap:10px;">';
                data.forEach(p => {
                    html += `
                    <div class="patient-select-card" 
                         style="padding:15px; background:#f8f9fa; border:1px solid #ddd; border-radius:8px; cursor:pointer;"
                         onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'"
                         onclick="selectPatientForAddRecord('${p.name}', '${p.dob}', '${p.patientId}')">
                        <div style="font-weight:bold; color:var(--primary-color);">${p.name}</div>
                        <div style="font-size:0.9rem; color:#666;">Phone: ${p.phone} | DOB: ${p.dob}</div>
                        <div style="font-size:0.8rem; color:#888; font-family:monospace;">ID: ${p.patientId}</div>
                    </div>`;
                });
                html += '</div>';

                const step15 = document.getElementById('step1.5-multiple-choice');
                if (step15) {
                    step15.innerHTML = html;
                    step15.style.display = 'block';
                }
            }
        } else {
            const text = await res.text();
            errorEl.innerText = text;
            errorEl.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        errorEl.innerText = "Error connecting to server.";
        errorEl.style.display = 'block';
    }
}

function selectPatientForAddRecord(name, dob, patientId) {
    const step15 = document.getElementById('step1.5-multiple-choice');
    if (step15) step15.style.display = 'none';

    document.getElementById('confirmPatName').innerText = name;
    document.getElementById('confirmPatDob').innerText = dob;
    document.getElementById('confirmPatId').innerText = patientId;
    document.getElementById('recordPatientId').value = patientId;
    document.getElementById('formPatName').innerText = name;

    document.getElementById('step2-confirm').style.display = 'block';
}

async function confirmPatientAndCheckAccess() {
    const patientId = document.getElementById('recordPatientId').value;
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // Show loading state
    document.getElementById('step2-confirm').style.display = 'none';
    document.getElementById('step-access-checking').style.display = 'block';

    try {
        const res = await fetch(`${API_URL}/checkAccess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId, doctorId: user.userId })
        });

        document.getElementById('step-access-checking').style.display = 'none';

        if (res.ok) {
            const data = await res.json();
            if (data.hasAccess) {
                // Show Step 3 (Form)
                document.getElementById('step3-form').style.display = 'block';
            } else {
                // Show No Access State
                document.getElementById('step-no-access').style.display = 'block';
            }
        } else {
            alert("Error checking access permissions.");
            resetSearchPatient();
        }
    } catch (err) {
        console.error(err);
        alert("Error connecting to server.");
        resetSearchPatient();
    }
}

function resetSearchPatient() {
    document.getElementById('recordSearchPhone').value = '';
    document.getElementById('recordPatientId').value = '';

    document.getElementById('step1-search').style.display = 'block';

    const step15 = document.getElementById('step1.5-multiple-choice');
    if (step15) step15.style.display = 'none';

    document.getElementById('step2-confirm').style.display = 'none';
    document.getElementById('step-access-checking').style.display = 'none';
    document.getElementById('step-no-access').style.display = 'none';
    document.getElementById('step3-form').style.display = 'none';

    // Clear form
    if (document.getElementById('disease')) document.getElementById('disease').value = '';
    if (document.getElementById('provisionalDiagnosis')) document.getElementById('provisionalDiagnosis').value = '';
    if (document.getElementById('finalDiagnosis')) document.getElementById('finalDiagnosis').value = '';
    if (document.getElementById('icdCode')) {
        document.getElementById('icdCode').value = '';
        document.getElementById('icdCode').style.backgroundColor = '#f9f9f9';
    }

    if (document.getElementById('visitType')) document.getElementById('visitType').value = 'Consultation';

    if (document.getElementById('chiefComplaint')) document.getElementById('chiefComplaint').value = '';
    if (document.getElementById('complaintDuration')) document.getElementById('complaintDuration').value = '';
    if (document.getElementById('medicalHistory')) document.getElementById('medicalHistory').value = '';

    // New Fields Reset
    if (document.getElementById('bloodPressure')) document.getElementById('bloodPressure').value = '';
    if (document.getElementById('heartRate')) document.getElementById('heartRate').value = '';
    if (document.getElementById('temperature')) document.getElementById('temperature').value = '';
    if (document.getElementById('notes')) document.getElementById('notes').value = '';

    // document.getElementById('reason').value = ''; // Deprecated/Removed from DOM
    document.getElementById('precautions').value = '';
    document.getElementById('medicines').value = '';
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    const fileName = document.getElementById('fileName');
    if (fileName) fileName.innerText = '';
}

async function addRecord() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user.role !== 'doctor') return alert("Only doctors can add records");

    const patientId = document.getElementById('recordPatientId').value.trim();
    const provisionalDiagnosis = document.getElementById('provisionalDiagnosis').value;
    const finalDiagnosis = document.getElementById('finalDiagnosis').value;
    const icdCode = document.getElementById('icdCode').value;

    const visitDate = document.getElementById('visitDate') ? document.getElementById('visitDate').value : '';
    const visitType = document.getElementById('visitType') ? document.getElementById('visitType').value : '';
    const hospitalName = document.getElementById('visitHospital') ? document.getElementById('visitHospital').value : '';
    const hospitalId = document.getElementById('visitHospitalId') ? document.getElementById('visitHospitalId').value : '';
    const department = document.getElementById('visitDepartment') ? document.getElementById('visitDepartment').value : '';

    const chiefComplaint = document.getElementById('chiefComplaint') ? document.getElementById('chiefComplaint').value : '';
    const complaintDuration = document.getElementById('complaintDuration') ? document.getElementById('complaintDuration').value : '';
    const medicalHistory = document.getElementById('medicalHistory') ? document.getElementById('medicalHistory').value : '';

    // const disease = document.getElementById('disease').value; // Deprecated
    // const reason = document.getElementById('reason').value; // Replaced by Notes
    const precautions = document.getElementById('precautions').value;
    const medicines = document.getElementById('medicines').value;

    // New Fields
    const bloodPressure = document.getElementById('bloodPressure').value;
    const heartRate = document.getElementById('heartRate').value;
    const temperature = document.getElementById('temperature').value;
    const notes = document.getElementById('notes').value;

    if (!patientId || !finalDiagnosis) {
        alert("Patient ID and Final Diagnosis are required.");
        return;
    }

    const formData = new FormData();
    formData.append('patientId', patientId);
    formData.append('doctorId', user.userId);
    formData.append('doctorName', user.name);

    formData.append('provisionalDiagnosis', provisionalDiagnosis);
    formData.append('finalDiagnosis', finalDiagnosis);
    formData.append('icdCode', icdCode);
    formData.append('disease', finalDiagnosis); // Legacy fallback

    formData.append('visitDate', visitDate);
    formData.append('visitType', visitType);
    formData.append('hospitalName', hospitalName);
    formData.append('hospitalId', hospitalId);
    formData.append('department', department);

    formData.append('chiefComplaint', chiefComplaint);
    formData.append('complaintDuration', complaintDuration);
    formData.append('medicalHistory', medicalHistory);

    formData.append('precautions', precautions);
    formData.append('medicines', medicines);

    // Append New Fields
    formData.append('bloodPressure', bloodPressure);
    formData.append('heartRate', heartRate);
    formData.append('temperature', temperature);
    formData.append('notes', notes);
    formData.append('reason', notes); // Map notes to reason for backward compatibility if needed

    // Check for file
    const fileInput = document.getElementById('fileInput');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
    }

    // Append appointmentId if it exists
    if (typeof currentAppointmentId !== 'undefined' && currentAppointmentId) {
        formData.append('appointmentId', currentAppointmentId);
    }

    try {
        const res = await fetch(`${API_URL}/addRecord`, {
            method: "POST",
            body: formData
        });

        const txt = await res.text();

        if (res.ok) {
            alert("Record Added: " + txt);
            currentAppointmentId = null; // Reset
            resetSearchPatient(); // Reset UI on success
        } else {
            alert("Error: " + txt);
        }
    } catch (err) {
        console.error(err);
        alert("Failed to add record");
    }
}


/* -------------------------------------------------------------------------- */
/*                            Patient Dashboard Logic                         */
/* -------------------------------------------------------------------------- */

async function searchDoctorForGrant() {
    const type = document.getElementById('docSearchType').value;
    let queryValue = '';

    if (type === 'num') {
        const phone = document.getElementById('grantDoctorPhone').value.trim();
        const code = document.getElementById('docCountryCode') ? document.getElementById('docCountryCode').value : '';
        if (!phone) return alert("Enter Doctor Phone Number");
        queryValue = phone.startsWith('+') ? phone : code + phone;
    } else {
        const docId = document.getElementById('grantDoctorId').value.trim();
        if (!docId) return alert("Enter Doctor ID");
        queryValue = docId;
    }

    const resultsArea = document.getElementById('docSearchResults');
    resultsArea.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

    try {
        const res = await fetch(`${API_URL}/searchDoctors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryValue })
        });

        if (res.ok) {
            const doctors = await res.json();
            if (doctors.length === 0) {
                resultsArea.innerHTML = '<p style="color:red; text-align:center;">No doctors found.</p>';
                return;
            }

            let html = '<p style="margin-bottom:10px; font-weight:600; font-size:0.9rem;">Select a Doctor:</p>';
            doctors.forEach(doc => {
                html += `
                <div style="padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:8px; cursor:pointer;" 
                     onclick="selectDoctorForGrant('${doc.name}', '${doc.doctorId}')">
                    <div style="font-weight:bold; color:var(--secondary-color);">${doc.name}</div>
                    <div style="font-size:0.8rem; color:#666;">${doc.specialization || 'General'} | ${doc.hospital || 'Hospital'}</div>
                    <div style="font-size:0.75rem; color:#888;">ID: ${doc.doctorId}</div>
                </div>`;
            });
            resultsArea.innerHTML = html;
        } else {
            const txt = await res.text();
            if (txt.includes("Cannot POST")) {
                resultsArea.innerHTML = `<p style="color:red; font-size:0.9rem;"><strong>Server Update Needed:</strong> The search endpoint was not found. Please <strong>restart your backend server</strong> (node server.js) to apply the latest changes.</p>`;
            } else {
                resultsArea.innerHTML = `<p style="color:red;">Error: ${txt}</p>`;
            }
        }
    } catch (err) {
        console.error(err);
        resultsArea.innerHTML = '<p style="color:red;">Connection failed. Is the server running?</p>';
    }
}

function selectDoctorForGrant(name, id) {
    document.getElementById('docSearchResults').innerHTML = '';
    document.getElementById('docSearchNumGroup').style.display = 'none';
    document.getElementById('docSearchIdGroup').style.display = 'none';

    document.getElementById('selectedDocName').innerText = name;
    document.getElementById('selectedDocId').innerText = id;
    document.getElementById('grantConfirmSection').style.display = 'block';
}

function resetDocSearch() {
    document.getElementById('grantConfirmSection').style.display = 'none';
    document.getElementById('docSearchResults').innerHTML = '';
    document.getElementById('grantDoctorPhone').value = '';
    document.getElementById('grantDoctorId').value = '';

    const type = document.getElementById('docSearchType').value;
    if (type === 'num') {
        document.getElementById('docSearchNumGroup').style.display = 'flex';
    } else {
        document.getElementById('docSearchIdGroup').style.display = 'flex';
    }
}

async function grantAccessFinal() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const docId = document.getElementById('selectedDocId').innerText;
    const durationDays = document.getElementById('grantDuration').value;

    try {
        const res = await fetch(`${API_URL}/grantAccess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientId: user.userId,
                doctorId: docId,
                durationDays: durationDays
            })
        });

        const txt = await res.text();
        if (res.ok) {
            alert("Success: " + txt);
            resetDocSearch();
            fetchAccessList(); // Refresh list
        } else {
            alert("Error: " + txt);
        }
    } catch (err) {
        console.error(err);
        alert("Failed to grant access");
    }
}

async function getMyRecords() {
    await loadHospitalsVisited();
}

async function loadHospitalsVisited() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const container = document.getElementById('recordsList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading your hospital visits...</p></div>';

    try {
        const res = await fetch(`${API_URL}/getHospitalsVisited/${user.userId}`);
        if (!res.ok) throw new Error("Failed to fetch visit history");

        const hospitals = await res.json();

        if (hospitals.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 40px; color: var(--text-muted);">
                    <i class="fas fa-hospital-alt" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No hospital records found. Visit a doctor to start your history.</p>
                </div>`;
            return;
        }

        let html = '<div class="hospital-list" style="display:flex; flex-direction:column; gap:15px;">';

        hospitals.forEach((hosp, hIdx) => {
            html += `
            <div class="hospital-card" style="border:1px solid #ddd; border-radius:12px; overflow:hidden; background:white; box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                <div class="hosp-header" style="background:#f8f9fa; padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" 
                     onclick="toggleNested('${user.userId}_hosp_${hIdx}')">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; background:var(--primary-color); color:white; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-hospital"></i>
                        </div>
                        <div>
                            <h4 style="margin:0; color:var(--text-dark);">${hosp.hospitalName}</h4>
                            <small style="color:var(--text-muted);">Visited ${hosp.doctorsConsulted.length} Doctor(s)</small>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down" id="icon_${user.userId}_hosp_${hIdx}"></i>
                </div>
                <div id="${user.userId}_hosp_${hIdx}" style="display:none; padding:15px; border-top:1px solid #eee; background:#fff;">
                    <p style="font-size:0.8rem; font-weight:700; color:#888; text-transform:uppercase; margin-bottom:10px;">Doctors Consulted</p>
                    <div style="display:flex; flex-direction:column; gap:10px;">`;

            hosp.doctorsConsulted.forEach((doc, dIdx) => {
                html += `
                    <div style="border:1px solid #eee; border-radius:8px; padding:12px; transition:0.3s;" onmouseover="this.style.background='#fcfcfc'" onmouseout="this.style.background='white'">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-user-md" style="color:var(--secondary-color);"></i>
                                <div>
                                    <span style="font-weight:600; color:#333;">${formatDoctorName(doc.doctorName)}</span>
                                    ${doc.doctorSpecialization ? `<span style="margin-left:8px; padding:2px 8px; background:var(--secondary-color); color:white; border-radius:4px; font-size:0.7rem; font-weight:700; text-transform:uppercase;">${doc.doctorSpecialization}</span>` : ''}
                                </div>
                            </div>
                            <small style="color:#666;">${doc.visitDate}</small>
                        </div>
                        <button class="btn btn-outline" style="font-size:0.75rem; padding:5px 12px; width:100%;" 
                                onclick="fetchSingleRecord('${doc.recordId}', '${user.userId}')">
                            <i class="fas fa-eye"></i> View Medical Record
                        </button>
                    </div>
`;
            });

            html += `</div></div></div>`;
        });

        html += '</div>';
        // Add a detailed record view area
        html += '<div id="detailedRecordView" style="margin-top:20px;"></div>';

        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red; text-align:center;">Error loading your medical history.</p>';
    }
}

function toggleNested(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon_' + id);
    if (el.style.display === 'none') {
        el.style.display = 'block';
        icon.className = 'fas fa-chevron-up';
    } else {
        el.style.display = 'none';
        icon.className = 'fas fa-chevron-down';
    }
}

async function fetchSingleRecord(recordId, patientId) {
    const detailArea = document.getElementById('detailedRecordView');
    detailArea.scrollIntoView({ behavior: 'smooth' });
    detailArea.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Loading record details...</div>';

    try {
        const res = await fetch(`${API_URL}/getRecords/${patientId}/${patientId}`);
        const data = await res.json();

        // Find the specific record
        const record = data.find(r => r._id === recordId);

        if (record) {
            // Re-use logic for rendering a single record card
            // We'll wrap it in a "Close" button
            let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="color:var(--primary-color);">Record Details</h3>
                    <button class="btn" onclick="document.getElementById('detailedRecordView').innerHTML=''" style="background:#eee; color:#666; border:none; padding:5px 10px;">Close</button>
                </div>
            `;

            // Simplified rendering for single view
            const dateObj = new Date(record.timestamp * 1000);
            const formattedDate = dateObj.toLocaleString();

            html += `
            <div class="record-item" style="border: 2px solid var(--primary-color); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                <div class="record-header" style="background:var(--primary-color); color:white; padding: 15px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <i class="fas fa-file-prescription" style="font-size:1.5rem; margin-right:10px;"></i>
                        <strong style="font-size:1.2rem;">${record.finalDiagnosis || record.disease || 'Medical Record'}</strong>
                        ${record.visitType ? `<span style="margin-left:10px; background:rgba(255,255,255,0.2); padding:2px 10px; border-radius:15px; font-size:0.8rem;">${record.visitType}</span>` : ''}
                    </div>
                    <span><i class="fas fa-clock"></i> ${formattedDate}</span>
                </div>
                
                <div class="record-body" style="padding: 20px; background:white;">
                    <!-- Top section: Hospital and Doctor -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                        <div style="background:#f0f7ff; padding:12px; border-radius:8px;">
                            <small style="color:#666; display:block;">Hospital & Department</small>
                            <strong>${record.hospitalName}</strong> / <span style="color:var(--secondary-color);">${record.department || 'General'}</span>
                        </div>
                        <div style="background:#f0f7ff; padding:12px; border-radius:8px;">
                            <small style="color:#666; display:block;">Consulting Doctor</small>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <strong>${formatDoctorName(record.doctorName)}</strong>
                                ${record.doctorSpecialization ? `<span style="padding:2px 8px; background:var(--secondary-color); color:white; border-radius:4px; font-size:0.65rem; font-weight:700;">${record.doctorSpecialization}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Clinical Vitals -->
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; margin-bottom:20px; background:#f9f9f9; padding:15px; border-radius:8px;">
                        <div style="text-align:center; border-right:1px solid #eee;">
                            <small style="color:#888;">Blood Pressure</small>
                            <div style="font-weight:700; color:#333;">${record.bloodPressure || '--/--'} <small style="font-weight:400;">mmHg</small></div>
                        </div>
                        <div style="text-align:center; border-right:1px solid #eee;">
                            <small style="color:#888;">Heart Rate</small>
                            <div style="font-weight:700; color:#333;">${record.heartRate || '--'} <small style="font-weight:400;">BPM</small></div>
                        </div>
                        <div style="text-align:center;">
                            <small style="color:#888;">Temperature</small>
                            <div style="font-weight:700; color:#333;">${record.temperature || '--'} <small style="font-weight:400;">°F</small></div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom: 20px;">
                         <div>
                             <p style="font-weight:700; color:#555; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-notes-medical" style="color:var(--primary-color);"></i> Findings & History
                             </p>
                             <div style="display:flex; flex-direction:column; gap:10px; background:#fafafa; padding:15px; border-radius:8px; border:1px solid #eee;">
                                ${record.chiefComplaint ? `<div><small style="color:#888;">Chief Complaint:</small> <div style="font-size:0.9rem;">${record.chiefComplaint} (${record.complaintDuration || 'N/A'})</div></div>` : ''}
                                ${record.medicalHistory ? `<div><small style="color:#888;">Medical History:</small> <div style="font-size:0.9rem;">${record.medicalHistory}</div></div>` : ''}
                                ${record.provisionalDiagnosis ? `<div><small style="color:#888;">Provisional Diagnosis:</small> <div style="font-size:0.9rem;">${record.provisionalDiagnosis}</div></div>` : ''}
                                <div><small style="color:#888;">Final Diagnosis:</small> <div style="font-weight:bold; color:var(--primary-color); underline">${record.finalDiagnosis || record.disease}</div></div>
                                ${record.icdCode ? `<div><small style="color:#888;">ICD Code:</small> <code>${record.icdCode}</code></div>` : ''}
                             </div>
                         </div>
                         <div>
                             <p style="font-weight:700; color:#555; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-clipboard-list" style="color:var(--primary-color);"></i> Observations & Notes
                             </p>
                             <div style="background:#fafafa; padding:15px; border-radius:8px; border:1px solid #eee; min-height:100px; font-size:0.9rem; line-height:1.5;">
                                ${record.notes || record.reason || 'No additional notes provided.'}
                             </div>
                         </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom: 20px;">
                        <div>
                            <p style="font-weight:700; color:#2e7d32; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-pills"></i> Medications Prescribed
                            </p>
                            <div style="background:#e8f5e9; padding:12px; border-radius:8px; border-left:4px solid #4caf50; min-height:60px; font-family:monospace; white-space:pre-line;">
                                ${record.medicines || 'No medications prescribed'}
                            </div>
                        </div>
                        <div>
                            <p style="font-weight:700; color:#ef6c00; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                                <i class="fas fa-user-shield"></i> Precautions & Advice
                            </p>
                            <div style="background:#fff3e0; padding:12px; border-radius:8px; border-left:4px solid #ff9800; min-height:60px;">
                                ${record.precautions || 'No specific precautions'}
                            </div>
                        </div>
                    </div>

                    <!-- File Attachment Section -->
                    ${record.file && record.file.hasFile ? `
                    <div style="border-top:1px solid #eee; padding-top:15px;">
                        <p style="font-weight:700; color:#555; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-paperclip"></i> Attached Document
                        </p>
                        <div style="display:flex; align-items:center; justify-content:space-between; background:#f8f9fa; padding:12px; border-radius:8px;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <i class="fas ${record.file.mimeType.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'}" style="font-size:1.5rem; color:#d63031;"></i>
                                <span>${record.file.originalName}</span>
                            </div>
                            <a href="${API_URL}/getFile/${record._id}?requesterId=${patientId}" target="_blank" class="btn" 
                               style="background:var(--primary-color); color:white; text-decoration:none; padding:8px 20px; border-radius:6px; font-size:0.9rem;">
                               <i class="fas fa-download"></i> View / Download
                            </a>
                        </div>
                    </div>` : ''}
                </div>
            </div>`;

            detailArea.innerHTML = html;
        } else {
            detailArea.innerHTML = '<p style="color:red;">Record not found or access denied.</p>';
        }

    } catch (err) {
        console.error(err);
        detailArea.innerHTML = '<p style="color:red;">Failed to load record details.</p>';
    }
}

/* -------------------------------------------------------------------------- */
/*                        Access Control Logic (Patient)                      */
/* -------------------------------------------------------------------------- */

async function fetchAccessList() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const container = document.getElementById('accessListContainer');

    // Safety check if element exists (might be on wrong page)
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/getAccessList/${user.userId}`);

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server Error: ${res.status} ${res.statusText} - ${errorText}`);
        }

        const list = await res.json();

        if (!Array.isArray(list)) {
            throw new Error("Invalid response format: expected array");
        }

        if (list.length === 0) {
            container.innerHTML = '<p class="text-muted">No doctors have access to your data.</p>';
            return;
        }

        let html = '<ul style="list-style:none; padding:0;">';
        list.forEach(item => {
            html += `
            <li style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                <div>
                    <strong style="color:var(--text-dark);">${item.doctorName}</strong>
                    <small style="color:var(--text-muted); display:block;">ID: ${item.doctorId} | ${item.hospital || 'Hospital'}</small>
                    ${item.expiresAt ? `<small style="color:#e74c3c;">Expires: ${new Date(item.expiresAt).toLocaleDateString()}</small>` : ''}
                    ${item.type === 'emergency' ? `<small style="color:#e74c3c; font-weight:bold; display:block;">[EMERGENCY ACCESS]</small>` : ''}
                    ${item.type === 'Visit Code' ? `<small style="color:#6c5ce7; font-weight:bold; display:block;">[VISIT TOKEN ACCESS]</small>` : ''}
                </div>
                <button class="btn" style="background: #ffebee; color: #c62828; padding: 5px 12px; border-radius: 6px; font-size: 0.8rem; border:none;" 
                    onclick="revokeAccess('${item.doctorId}')">
                    <i class="fas fa-trash-alt"></i> Revoke
                </button>
            </li>`;
        });
        html += '</ul>';
        container.innerHTML = html;

    } catch (err) {
        console.error("fetchAccessList Error:", err);
        container.innerHTML = `<p style="color:red">Failed to load access list: ${err.message}</p>`;
    }
}

async function revokeAccess(doctorId) {
    if (!confirm("Are you sure you want to revoke access for this doctor?")) return;

    const user = JSON.parse(localStorage.getItem('currentUser'));

    try {
        const res = await fetch(`${API_URL}/revokeAccess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId: user.userId, doctorId })
        });

        const txt = await res.text();
        alert(txt);
        // Refresh the list to show it's gone
        fetchAccessList();
    } catch (err) {
        console.error(err);
        alert("Error revoking access");
    }
}

// Duplicate functions removed. Use the ones defined above.

/* -------------------------------------------------------------------------- */
/*                            Profile Management                              */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                            Profile Management                              */
/* -------------------------------------------------------------------------- */

function toggleEditProfile() {
    const editSection = document.getElementById('patientInfoEdit');
    if (editSection.style.display === 'block') {
        editSection.style.display = 'none';
    } else {
        editSection.style.display = 'block';
        // Pre-fill
        const user = JSON.parse(localStorage.getItem('currentUser'));
        document.getElementById('editName').value = user.name || "";
        document.getElementById('editPhone').value = user.phone || "";
        document.getElementById('editGender').value = user.gender || "";
        document.getElementById('editDOB').value = user.dob || "";
        document.getElementById('editBloodGroup').value = user.bloodGroup || "";
    }
}

async function updateProfile() {
    const name = document.getElementById('editName').value;
    const phone = document.getElementById('editPhone').value;
    const gender = document.getElementById('editGender').value;
    const dob = document.getElementById('editDOB').value;
    const bloodGroup = document.getElementById('editBloodGroup').value;

    const user = JSON.parse(localStorage.getItem('currentUser'));

    try {
        const res = await fetch(`${API_URL}/updateProfile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.userId, name, phone, gender, dob, bloodGroup })
        });

        if (res.ok) {
            const updatedUser = await res.json();
            // Update LocalStorage
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));

            // Update UI
            alert("Profile Updated!");
            document.getElementById('displayPatientName').innerText = updatedUser.name;
            document.getElementById('pPhone').innerText = updatedUser.phone || "Not Set";
            document.getElementById('pGender').innerText = updatedUser.gender || "Not Set";
            document.getElementById('pDOB').innerText = updatedUser.dob || "Not Set";
            document.getElementById('pBloodGroup').innerText = updatedUser.bloodGroup || "Not Set";

            toggleEditProfile(); // close form
        } else {
            alert("Failed to update profile");
        }
    } catch (err) {
        console.error(err);
        alert("Error updating profile");
    }
}

/* -------------------------------------------------------------------------- */
/*                        Doctor Profile Management                           */
/* -------------------------------------------------------------------------- */

function toggleDoctorEditProfile() {
    const editSection = document.getElementById('doctorInfoEdit');
    if (editSection.style.display === 'block') {
        editSection.style.display = 'none';
    } else {
        editSection.style.display = 'block';
        // Pre-fill
        const user = JSON.parse(localStorage.getItem('currentUser'));
        document.getElementById('editDocName').value = user.name || "";
        document.getElementById('editDocHospital').value = user.hospitalName || user.hospital || "";
        document.getElementById('editDocSpecialization').value = user.specialization || "";
        document.getElementById('editDocLicense').value = user.registrationNumber || user.license || "";

        // Populate new fields if they exist
        if (document.getElementById('editDocPhone')) document.getElementById('editDocPhone').value = user.phone || "";
        if (document.getElementById('editDocExp')) document.getElementById('editDocExp').value = user.experienceYears || "";
        if (document.getElementById('editDocHours')) document.getElementById('editDocHours').value = user.workingHours || "";
    }
}

async function updateDoctorProfile() {
    const name = document.getElementById('editDocName').value;
    const hospital = document.getElementById('editDocHospital') ? document.getElementById('editDocHospital').value : '';
    const shopName = document.getElementById('editShopName') ? document.getElementById('editShopName').value : '';
    const specialization = document.getElementById('editDocSpecialization') ? document.getElementById('editDocSpecialization').value : '';
    const registrationNumber = document.getElementById('editDocLicense').value;
    const phone = document.getElementById('editDocPhone') ? document.getElementById('editDocPhone').value : '';
    const experienceYears = document.getElementById('editDocExp') ? document.getElementById('editDocExp').value : '';
    const workingHours = document.getElementById('editDocHours') ? document.getElementById('editDocHours').value : '';

    const user = JSON.parse(localStorage.getItem('currentUser'));

    try {
        const res = await fetch(`${API_URL}/updateProfile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: user.userId,
                name,
                hospital,
                specialization,
                registrationNumber,
                phone,
                experienceYears,
                workingHours,
                shopName,
                license: user.role === 'pharmacist' ? registrationNumber : undefined
            })
        });

        if (res.ok) {
            const updatedUser = await res.json();
            // Update LocalStorage
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));

            // Update UI
            alert("Doctor Profile Updated!");
            document.getElementById('displayDoctorName').innerText = updatedUser.name;

            // Update Bio Section
            if (document.getElementById('bioName')) document.getElementById('bioName').innerText = updatedUser.name || "N/A";
            if (document.getElementById('bioHospital')) document.getElementById('bioHospital').innerText = updatedUser.hospitalName || "Not Set";
            if (document.getElementById('bioSpecialization')) document.getElementById('bioSpecialization').innerText = updatedUser.specialization || updatedUser.specialist || updatedUser.department || "Not Set";
            if (document.getElementById('bioLicense')) document.getElementById('bioLicense').innerText = updatedUser.registrationNumber || "Not Set";
            if (document.getElementById('bioExperience')) document.getElementById('bioExperience').innerText = (updatedUser.experienceYears ? updatedUser.experienceYears + "+ Years" : "Not Set");
            if (document.getElementById('bioPhone')) document.getElementById('bioPhone').innerText = updatedUser.phone || "Not Set";
            if (document.getElementById('bioHours')) document.getElementById('bioHours').innerText = updatedUser.workingHours || "Not Set";

            // Pharmacist Specific UI Updates
            if (document.getElementById('dispShopName')) document.getElementById('dispShopName').innerText = updatedUser.shopName || "Not Set";
            if (document.getElementById('dispLicense')) document.getElementById('dispLicense').innerText = updatedUser.license || "Not Set";

            toggleDoctorEditProfile(); // close form
        } else {
            alert("Failed to update profile");
        }
    } catch (err) {
        console.error(err);
        alert("Error updating profile");
    }
}

/* -------------------------------------------------------------------------- */
/*                            Doctor Dashboard Logic                          */
/* -------------------------------------------------------------------------- */

async function fetchPatientRecords() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const resultList = document.getElementById('patientSearchResults');
    const recordsParams = document.getElementById('patientRecordsList');

    let searchType = null;
    let query = '';
    const typeInput = document.getElementById('historySearchType');
    if (typeInput) searchType = typeInput.value;

    if (searchType === 'num') {
        const phoneInp = document.getElementById('fetchPatientPhone').value.trim();
        const code = document.getElementById('historyCountryCode') ? document.getElementById('historyCountryCode').value : '';
        query = phoneInp ? (phoneInp.startsWith('+') ? phoneInp : code + phoneInp) : '';
        if (!phoneInp) return alert("Enter Phone Number");
    } else {
        query = document.getElementById('fetchPatientIdOnly').value.trim();
        if (!query) return alert("Enter Patient ID");
    }

    // Clear previous results
    resultList.innerHTML = '<div style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    recordsParams.innerHTML = '';

    try {
        const searchRes = await fetch(`${API_URL}/searchPatients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query })
        });

        const users = await searchRes.json();

        if (users.length === 0) {
            resultList.innerHTML = '<p style="color:red; text-align:center;">No patient found.</p>';
        } else if (users.length === 1) {
            // Exact match - auto fetch
            resultList.innerHTML = `<p style="color:green; text-align:center;">Found: ${users[0].name} (${users[0].phone})</p>`;
            // Use Hash directly
            await fetchAndDisplayRecords(users[0].userIdHash, user.userId, 'patientRecordsList', true);
        } else {
            // Multiple matches - show selection list
            let html = '<p style="text-align:center; color:var(--secondary-color);">Multiple patients found. Please select one:</p>';
            html += '<div style="display:flex; flex-direction:column; gap:10px;">';

            users.forEach(u => {
                html += `
                <div class="patient-select-card" 
                     style="padding:15px; background:#f8f9fa; border:1px solid #ddd; border-radius:8px; cursor:pointer; transition:0.3s;"
                     onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'"
                     onclick="selectPatientForRecords('${u.userIdHash}', '${u.name}', '${u.phone}')">
                    <div style="font-weight:bold; color:var(--primary-color);">${u.name}</div>
                    <div style="font-size:0.9rem; color:#666;">Phone: ${u.phone || 'N/A'} | DOB: ${u.dob || 'N/A'}</div>
                </div>`;
            });
            html += '</div>';
            resultList.innerHTML = html;
        }

    } catch (err) {
        console.error(err);
        resultList.innerHTML = '<p style="color:red; text-align:center;">Error searching patient.</p>';
    }
}

async function selectPatientForRecords(hashId, name, phone) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    document.getElementById('patientSearchResults').innerHTML =
        `<div style="padding:10px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:6px; color:#2e7d32; text-align:center;">
            Selected: <strong>${name}</strong> (${phone})
         </div>`;

    await fetchAndDisplayRecords(hashId, user.userId, 'patientRecordsList', true);
}

async function emergencyAccess() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user.role !== 'doctor') return alert("Only doctors can use emergency override");

    let patientId = '';
    const typeInput = document.getElementById('historySearchType');
    if (typeInput && typeInput.value === 'num') {
        return alert("Emergency override requires Patient Wallet/ID, not Phone Number. Please search by Patient ID.");
    } else {
        patientId = document.getElementById('fetchPatientIdOnly').value.trim();
    }

    if (!patientId) return alert("Please enter Patient ID first");

    if (!confirm("Are you sure you want to trigger an Emergency Override? This action will be logged and audited.")) return;

    try {
        const res = await fetch(`${API_URL}/emergencyAccess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                doctorId: user.userId,
                patientId: patientId
            })
        });

        const txt = await res.text();
        alert(txt);

        // Fetch records after override
        if (res.ok) fetchPatientRecords();
    } catch (err) {
        console.error(err);
        alert("Failed to perform emergency override");
    }
}

async function emergencyAccessForAddRecord() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user.role !== 'doctor') return alert("Only doctors can use emergency override");

    const patientId = document.getElementById('recordPatientId').value.trim();
    if (!patientId) return alert("Please confirm patient first to use Emergency Override");

    if (!confirm("Are you sure you want to trigger an Emergency Override? This action will be logged and audited.")) return;

    try {
        const res = await fetch(`${API_URL}/emergencyAccess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                doctorId: user.userId,
                patientId: patientId
            })
        });

        const txt = await res.text();
        alert(txt);

        // Transition to Step 3 if successful
        if (res.ok) {
            document.getElementById('step-no-access').style.display = 'none';
            document.getElementById('step3-form').style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        alert("Failed to perform emergency override");
    }
}

/* -------------------------------------------------------------------------- */
/*                             Shared Logic                                   */
/* -------------------------------------------------------------------------- */


async function fetchAndDisplayRecords(patientId, requesterId, elementId, isHashed = false) {
    const displayArea = document.getElementById(elementId);
    displayArea.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading records...</p></div>';

    try {
        const queryParam = isHashed ? '?isHashed=true' : '';
        const res = await fetch(`${API_URL}/getRecords/${patientId}/${requesterId}${queryParam}`);

        // Handle text response (e.g. "Approval required")
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                let html = '';
                data.forEach((rec, index) => {
                    const dateObj = new Date(rec.timestamp * 1000);
                    const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

                    const currUserStr = localStorage.getItem('currentUser');
                    const isPharmacist = currUserStr ? JSON.parse(currUserStr).role === 'pharmacist' : false;

                    html += `
                    <div class="record-item" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        <div class="record-header" style="background:#f8f9fa; padding: 12px 15px; border-bottom: 1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <i class="fas fa-file-medical-alt" style="color:var(--primary-color); margin-right:8px;"></i>
                                <strong style="color:#333;">${isPharmacist ? 'Prescription' : (rec.finalDiagnosis || rec.disease || 'See Details')}</strong>
                                ${!isPharmacist && rec.icdCode && rec.icdCode !== '[Hidden]' ? `<span style="background:var(--secondary-color); color:white; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:10px;">ICD: ${rec.icdCode}</span>` : ''}
                                ${rec.isVerified ? `<span title="Digitally Signed by Provider" style="margin-left:8px; color:#2e7d32; font-size:0.8rem; background:#e8f5e9; padding:2px 6px; border-radius:4px; border:1px solid #c8e6c9;"><i class="fas fa-check-circle"></i> Verified</span>` : ''}
                            </div>
                            <small style="color:#666;"><i class="fas fa-clock"></i> ${formattedDate}</small>
                        </div>
                        
                        <div class="record-body" style="padding: 15px;">
                            ${!isPharmacist && rec.visitDate && rec.visitDate !== '[Hidden]' ? `
                            <div style="margin-bottom: 15px; display:flex; gap:15px; background: #e3f2fd; padding: 10px; border-radius:6px; border: 1px solid #bbdefb; font-size:0.9rem; flex-wrap:wrap;">
                                <div style="color:#0d47a1;"><strong><i class="fas fa-calendar-alt"></i> Date:</strong> ${rec.visitDate}</div>
                                <div style="color:#0d47a1;"><strong><i class="fas fa-stethoscope"></i> Type:</strong> ${rec.visitType}</div>
                                <div style="color:#0d47a1;"><strong><i class="fas fa-hospital-alt"></i> Hospital:</strong> ${rec.hospitalName}</div>
                            </div>` : ''}
                            
                            ${!isPharmacist && rec.chiefComplaint && rec.chiefComplaint !== '[Hidden]' ? `
                            <div style="margin-bottom: 15px; background: #ffebee; padding: 10px; border-left: 3px solid #e53935;">
                                <strong><i class="fas fa-exclamation-circle" style="color:#e53935; margin-right:5px;"></i> Chief Complaint:</strong>
                                <span>${rec.chiefComplaint} ${rec.complaintDuration ? `(Duration: ${rec.complaintDuration})` : ''}</span>
                            </div>` : ''}

                            ${!isPharmacist && rec.medicalHistory && rec.medicalHistory !== '[Hidden]' ? `
                            <div style="margin-bottom: 15px; background: #e8eaed; padding: 10px; border-left: 3px solid #78909c;">
                                <strong><i class="fas fa-history" style="color:#78909c; margin-right:5px;"></i> Medical History:</strong>
                                <span>${rec.medicalHistory}</span>
                            </div>` : ''}
                            
                            ${!isPharmacist && rec.provisionalDiagnosis && rec.provisionalDiagnosis !== '[Hidden]' ? `
                            <div style="margin-bottom: 15px; background: #fffde7; padding: 10px; border-left: 3px solid #fbc02d;">
                                <strong><i class="fas fa-search" style="color:#fbc02d; margin-right:5px;"></i> Provisional Diagnosis:</strong>
                                <span>${rec.provisionalDiagnosis}</span>
                            </div>` : ''}
                            <!-- Vitals Grid -->
                             ${!isPharmacist && (rec.bloodPressure || rec.heartRate || rec.temperature) ? `
                            <div style="display:flex; gap: 20px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #eee;">
                                ${rec.bloodPressure ? `<div><small style="color:#888;">BP</small><div style="font-weight:bold;">${rec.bloodPressure}</div></div>` : ''}
                                ${rec.heartRate ? `<div><small style="color:#888;">Pulse</small><div style="font-weight:bold;">${rec.heartRate} bpm</div></div>` : ''}
                                ${rec.temperature ? `<div><small style="color:#888;">Temp</small><div style="font-weight:bold;">${rec.temperature}</div></div>` : ''}
                            </div>` : ''}

                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                                <div>
                                    <p style="margin-bottom:5px;"><strong style="color:var(--secondary-color);"><i class="fas fa-pills" style="width:20px;"></i> Rx (Medicines):</strong></p>
                                    <div style="background:#e8f5e9; padding:8px; border-radius:5px; color:#2e7d32;">${rec.medicines || 'None'}</div>
                                </div>
                                ${!isPharmacist ? `
                                <div>
                                    <p style="margin-bottom:5px;"><strong style="color:#e67e22;"><i class="fas fa-exclamation-triangle" style="width:20px;"></i> Precautions:</strong></p>
                                    <div style="background:#fff3e0; padding:8px; border-radius:5px; color:#ef6c00;">${rec.precautions || 'None'}</div>
                                </div>` : ''}
                            </div>

                            ${!isPharmacist && (rec.notes || rec.reason) ? `
                            <div style="margin-top: 15px;">
                                <p style="margin-bottom:5px;"><strong><i class="fas fa-sticky-note" style="width:20px;"></i> Clinical Notes:</strong></p>
                                <p style="color:#555; font-style:italic;">${rec.notes || rec.reason}</p>
                            </div>` : ''}

                            ${rec.file && rec.file.hasFile && !isPharmacist ?
                            `<div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                                <button class="btn" style="padding: 6px 12px; font-size: 0.9rem; background: var(--secondary-color); color: white; border: none; border-radius: 4px; cursor: pointer;" 
                                onclick="viewFile('${rec._id}')">
                                    <i class="fas fa-paperclip"></i> View Attachment (${rec.file.originalName})
                                </button>
                             </div>`
                            : ''}
                        </div>
                        <div class="record-footer" style="background:#fafafa; padding: 5px 15px; text-align:right; font-size:0.8rem; color:#aaa; border-top:1px solid #f0f0f0;">
                            <i class="fas fa-lock" style="color:#2e7d32;"></i> Encrypted Record
                        </div>
                    </div>`;
                });
                displayArea.innerHTML = html;
            } else {
                displayArea.innerHTML = `
                <div style="text-align:center; padding: 40px; color: var(--text-muted);">
                    <i class="far fa-folder-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No medical records found for this patient.</p>
                </div>`;
            }
        } else {
            const text = await res.text();
            displayArea.innerHTML = `<div class="dashboard-card" style="text-align:center; color:#d63031;"><i class="fas fa-lock"></i> ${text}</div>`;
        }
    } catch (err) {
        console.error(err);
        displayArea.innerHTML = '<p style="color:red; text-align:center;">Error fetching records.</p>';
    }
}

async function viewFile(recordId) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return alert("Please log in again");

    // We open in new tab/window by setting location is tricky with headers?
    // Actually we need to fetch with auth then show. 
    // To keep it simple, we can use a temporary URL if we fetch as Blob.

    // Show loading
    showNotification("Decrypting file...", "success");

    try {
        const res = await fetch(`${API_URL}/getFile/${recordId}?requesterId=${user.userId}`);

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } else {
            const txt = await res.text();
            alert("Error viewing file: " + txt);
        }
    } catch (err) {
        console.error(err);
        alert("Failed to fetch file");
    }
}


async function loadAuditLog() {
    // Only for patient dashboard
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const tableBody = document.getElementById('auditTableBody');
    if (!tableBody) return;

    try {
        const res = await fetch(`${API_URL}/audit/${user.userId}`);
        const logs = await res.json();

        let html = '';
        if (logs.length === 0) {
            html = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#999;">No security logs found for your account.</td></tr>';
        } else {
            logs.forEach(log => {
                const date = new Date(log.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString();

                let badgeColor = "#e8f5e9";
                let badgeText = "#2e7d32";
                if (log.txHash === "Secured") { badgeColor = "#e3f2fd"; badgeText = "#1565c0"; }
                if (log.txHash === "Verifiable") { badgeColor = "#fff3e0"; badgeText = "#e65100"; }

                html += `
                <tr style="border-bottom: 1px solid #f1f1f1;">
                    <td style="padding:12px; white-space:nowrap;">
                        <div style="font-weight:600; color:#333;">${timeStr}</div>
                        <div style="font-size:0.75rem; color:#888;">${dateStr}</div>
                    </td>
                    <td style="padding:12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:32px; height:32px; background:#f0f2f5; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--primary-color);">
                                <i class="fas ${log.icon || 'fa-shield-alt'}"></i>
                            </div>
                            <span style="font-weight:600; color:#444;">${log.type}</span>
                        </div>
                    </td>
                    <td style="padding:12px; color:#666; font-size:0.9rem;">${log.details}</td>
                    <td style="padding:12px; text-align:right;">
                        <span class="badge" style="background:${badgeColor}; color:${badgeText}; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; border: 1px solid rgba(0,0,0,0.05);">
                            <i class="fas fa-lock"></i> ${log.txHash}
                        </span>
                    </td>
                </tr>`;
            });
        }
        tableBody.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

async function loadHospSummary() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const summaryArea = document.getElementById('hospSummary');
    if (!summaryArea) return;

    try {
        const res = await fetch(`${API_URL}/getHospitalsVisited/${user.userId}`);
        if (!res.ok) throw new Error("Fetch failed");
        const list = await res.json();

        if (list.length === 0) {
            summaryArea.innerHTML = '<p style="color:#888;">No hospitals visited yet.</p>';
        } else {
            let html = '<ul style="list-style:none; padding:0; margin:10px 0;">';
            list.slice(0, 3).forEach(h => {
                html += `<li style="padding:8px 0; border-bottom:1px solid #eee; display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-hospital" style="color:var(--primary-color);"></i>
                    <span style="font-weight:600; font-size:0.9rem;">${h.hospitalName}</span>
                </li>`;
            });
            if (list.length > 3) html += `<li style="color:#888; font-size:0.8rem; margin-top:5px;">+ ${list.length - 3} more...</li>`;
            html += '</ul>';
            summaryArea.innerHTML = html;
        }
    } catch (err) {
        console.error(err);
        summaryArea.innerHTML = '<p style="color:red;">Error loading history.</p>';
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

/* -------------------------------------------------------------------------- */
/*                        Sidebar Navigation Logic                            */
/* -------------------------------------------------------------------------- */

function showSection(sectionId, linkElement) {
    // 1. Hide all Content Sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => {
        sec.style.display = 'none';
    });

    // 2. Show the selected section
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
    }

    // 3. Update Sidebar Active State
    // Remove active class from all links
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    navLinks.forEach(link => link.classList.remove('active'));

    // Add active class to clicked link
    if (linkElement) {
        linkElement.classList.add('active');
    }
}

/* -------------------------------------------------------------------------- */
/*                        APPOINTMENT BOOKING LOGIC                          */
/* -------------------------------------------------------------------------- */

async function loadBookingHospitals() {
    const selector = document.getElementById('bookHospitalSelect');
    if (!selector) return;

    try {
        const res = await fetch(`${API_URL}/hospitals`);
        const hospitals = await res.json();
        selector.innerHTML = '<option value="">Select Hospital</option>';
        hospitals.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.hospitalId;
            opt.dataset.name = h.hospitalName;
            opt.text = h.hospitalName;
            selector.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load hospitals", err);
    }
}

async function loadBookingDepartments() {
    const hospId = document.getElementById('bookHospitalSelect').value;
    const selector = document.getElementById('bookDeptSelect');
    if (!selector || !hospId) return;

    try {
        const res = await fetch(`${API_URL}/hospitals/${hospId}/specializations`);
        const specializations = await res.json();
        selector.innerHTML = '<option value="">Select Specialization</option>';
        specializations.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.text = s;
            selector.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load specializations", err);
    }
}

async function loadBookingDoctors() {
    const hospId = document.getElementById('bookHospitalSelect').value;
    const dept = document.getElementById('bookDeptSelect').value;
    const selector = document.getElementById('bookDoctorSelect');
    if (!selector || !hospId || !dept) return;

    selector.innerHTML = '<option value="">Searching for doctors...</option>';

    try {
        const res = await fetch(`${API_URL}/getDoctorsByHospitalSpecialization/${hospId}/${dept}`);
        const doctors = await res.json();
        selector.innerHTML = '<option value="">Select Doctor</option>';
        doctors.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.userIdHash;
            opt.dataset.name = d.name;
            opt.text = `${formatDoctorName(d.name)} (${d.specialist || d.specialization || 'General'})`;
            selector.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load doctors", err);
    }
}

async function loadAvailableSlots() {
    const doctorId = document.getElementById('bookDoctorSelect').value;
    const date = document.getElementById('bookDate').value;
    const container = document.getElementById('slotsContainer');
    if (!container || !doctorId || !date) return;

    container.innerHTML = '<p>Loading slots...</p>';

    try {
        const res = await fetch(`${API_URL}/getAvailableSlots/${doctorId}/${date}`);
        const slots = await res.json();

        let html = '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px;">';
        slots.forEach(s => {
            html += `
            <button type="button" 
                class="slot-btn ${s.isAvailable ? 'available' : 'booked'}" 
                onclick="${s.isAvailable ? `selectSlot(this, '${s.slot}')` : ''}"
                ${!s.isAvailable ? 'disabled' : ''}>
                ${s.slot}
            </button>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error("Failed to load slots", err);
        container.innerHTML = '<p style="color:red">Error loading slots</p>';
    }
}

let selectedTimeSlot = null;
function selectSlot(btn, slot) {
    // Remove active from all
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTimeSlot = slot;
}

async function bookAppointment() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const hospitalSelect = document.getElementById('bookHospitalSelect');
    const hospitalId = hospitalSelect.value;
    const hospitalName = hospitalSelect.options[hospitalSelect.selectedIndex].dataset.name;
    const department = document.getElementById('bookDeptSelect').value;
    const doctorSelect = document.getElementById('bookDoctorSelect');
    const doctorId = doctorSelect.value;
    const doctorName = doctorSelect.options[doctorSelect.selectedIndex].dataset.name;
    const appointmentDate = document.getElementById('bookDate').value;

    if (!hospitalId || !department || !doctorId || !appointmentDate || !selectedTimeSlot) {
        return alert("Please select all fields and a time slot.");
    }

    const body = {
        patientId: user.userId,
        patientName: user.name,
        doctorId,
        doctorName,
        hospitalId,
        hospitalName,
        department,
        appointmentDate,
        timeSlot: selectedTimeSlot
    };

    try {
        const res = await fetch(`${API_URL}/bookAppointment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            alert("Appointment Booked Successfully!");
            location.reload(); // Simple way to refresh UI
        } else {
            const txt = await res.text();
            alert("Error: " + txt);
        }
    } catch (err) {
        console.error(err);
        alert("Failed to book appointment");
    }
}

async function loadMyAppointments() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const container = document.getElementById('patientAppointmentsList');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/getAppointments?userId=${user.userId}&role=patient`);
        const list = await res.json();

        if (list.length === 0) {
            container.innerHTML = '<p class="text-muted">No appointments found.</p>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        list.forEach(a => {
            let status = a.status;

            // [NEW] Auto-show "Completed" if time has passed
            try {
                const now = new Date();
                const slotParts = a.timeSlot.split(" - ");
                if (slotParts.length === 2) {
                    const endTimeStr = slotParts[1];
                    const [time, modifier] = endTimeStr.split(" ");
                    let [hours, minutes] = time.split(":").map(Number);
                    if (modifier === "PM" && hours !== 12) hours += 12;
                    if (modifier === "AM" && hours === 12) hours = 0;

                    const [y, m, d] = a.appointmentDate.split("-").map(Number);
                    const apptEndTime = new Date(y, m - 1, d, hours, minutes, 0);

                    if (now > apptEndTime && status === 'Approved') {
                        status = 'Completed';
                    }
                }
            } catch (e) { console.error("Auto-complete logic error:", e); }

            const statusClass = status.toLowerCase();
            let statusStyle = "";
            let statusIcon = "";

            if (statusClass === 'approved') { statusStyle = "background:#e8f5e9; color:#2e7d32;"; statusIcon = "fa-check-circle"; }
            else if (statusClass === 'pending') { statusStyle = "background:#fff3e0; color:#ef6c00;"; statusIcon = "fa-hourglass-half"; }
            else if (statusClass === 'rejected') { statusStyle = "background:#ffebee; color:#c62828;"; statusIcon = "fa-times-circle"; }
            else if (statusClass === 'completed') { statusStyle = "background:#e3f2fd; color:#1565c0;"; statusIcon = "fa-calendar-check"; }
            else { statusStyle = "background:#eee; color:#666;"; statusIcon = "fa-info-circle"; }

            html += `
            <div style="border: 1px solid #eee; border-radius: 12px; padding: 18px; display: flex; justify-content: space-between; align-items: start; background: white; transition: 0.3s; position: relative; overflow: hidden;" 
                 onmouseover="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 5px 15px rgba(0,0,0,0.05)'" 
                 onmouseout="this.style.borderColor='#eee'; this.style.boxShadow='none'">
                
                <div style="display: flex; gap: 15px;">
                    <div style="width: 50px; height: 50px; background: #f0f7ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--secondary-color); font-size: 1.2rem;">
                        <i class="fas fa-hospital"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 5px 0; font-size: 1.05rem; color: #333;">${a.hospitalName}</h4>
                        <div style="display: flex; align-items: center; color: #666; font-size: 0.85rem; margin-bottom: 5px;">
                             <i class="fas fa-user-md" style="margin-right: 6px; width: 14px;"></i> 
                             <span>${formatDoctorName(a.doctorName)} <span style="color: #999; margin-left: 5px;">(${a.department})</span></span>
                        </div>
                        <div style="display: flex; gap: 15px; color: #888; font-size: 0.8rem;">
                            <span><i class="fas fa-calendar" style="margin-right: 5px;"></i> ${a.appointmentDate}</span>
                            <span><i class="fas fa-clock" style="margin-right: 5px;"></i> ${a.timeSlot}</span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                     <span style="padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; display: flex; align-items: center; gap: 6px; ${statusStyle}">
                        <i class="fas ${statusIcon}"></i> ${status}
                     </span>
                     ${status === 'Approved' && a.visitCode ? `
                        <div style="background: #fff3e0; border: 1px dashed #ef6c00; color: #e65100; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; text-align: center;">
                            <small style="display:block; font-size: 0.6rem; text-transform:uppercase; margin-bottom:2px;">Visit Code</small>
                            ${a.visitCode}
                        </div>
                     ` : ''}
                     <small style="color: #bbb; font-size: 0.7rem;">Ref: #${a._id.substring(a._id.length - 6)}</small>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

async function loadDoctorSchedule() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const dateInput = document.getElementById('scheduleDate');
    const container = document.getElementById('doctorScheduleTable');
    if (!container || !user) return;

    const date = dateInput.value || new Date().toISOString().split('T')[0];

    // Also load pending approvals globally
    loadDoctorPendingAppointments();

    // [NEW] Load Patients who gave access to this doctor
    loadReceivedAccess();

    // Update display date
    const dateDisplay = document.getElementById('scheduleDateDisplay');
    if (dateDisplay) {
        const d = new Date(date);
        dateDisplay.innerText = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    try {
        const res = await fetch(`${API_URL}/getDoctorSchedule/${user.userId}/${date}`);
        const schedule = await res.json();

        let html = `
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 15px; text-align: left; color: #666; font-weight: 600; border-bottom: 2px solid #eee; border-top-left-radius: 10px;">Time Slot</th>
                        <th style="padding: 15px; text-align: left; color: #666; font-weight: 600; border-bottom: 2px solid #eee;">Status</th>
                        <th style="padding: 15px; text-align: left; color: #666; font-weight: 600; border-bottom: 2px solid #eee;">Patient Name</th>
                        <th style="padding: 15px; text-align: right; color: #666; font-weight: 600; border-bottom: 2px solid #eee; border-top-right-radius: 10px;">Actions</th>
                    </tr>
                </thead>
                <tbody>`;

        schedule.forEach(s => {
            const statusClass = s.status.toLowerCase();
            let statusStyle = "";
            let rowBg = s.status === 'Available' ? "transparent" : "#fff";
            let textColor = s.status === 'Available' ? "#999" : "#333";

            if (statusClass === 'approved') statusStyle = "background:#e8f5e9; color:#2e7d32; border: 1px solid #c8e6c9;";
            else if (statusClass === 'pending') statusStyle = "background:#fff3e0; color:#ef6c00; border: 1px solid #ffe0b2;";
            else if (statusClass === 'completed') statusStyle = "background:#e3f2fd; color:#1565c0; border: 1px solid #bbdefb;";
            else if (statusClass === 'available') statusStyle = "background:#f5f5f5; color:#888; border: 1px solid #eee;";
            else statusStyle = "background:#ffebee; color:#c62828; border: 1px solid #ffcdd2;";

            html += `
                <tr style="background: ${rowBg}; transition: 0.2s;" onmouseover="this.style.background='#fcfcfc'" onmouseout="this.style.background='${rowBg}'">
                    <td style="padding: 15px; border-bottom: 1px solid #eee; font-weight: 500; color: ${textColor};">
                        <i class="far fa-clock" style="margin-right: 8px; font-size: 0.9rem; opacity: 0.7;"></i> ${s.timeSlot}
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #eee;">
                        <span style="padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; ${statusStyle}">
                            ${s.status}
                        </span>
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #eee; font-weight: 600; color: ${textColor};">
                        ${s.patientName !== '-' ? `<i class="fas fa-user-circle" style="margin-right: 8px; color: #ccc;"></i> ${s.patientName}` : `<span style="color:#ddd">Empty Slot</span>`}
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #eee; text-align: right;">
                        ${s.status === 'Pending' ? `
                            <button class="btn" style="background: var(--primary-color); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; margin-left: 5px;" onclick="updateApptStatus('${s.appointmentId}', 'Approved')">Approve</button>
                            <button class="btn" style="background: #ff4757; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; margin-left: 5px;" onclick="updateApptStatus('${s.appointmentId}', 'Rejected')">Reject</button>
                        ` : ''}
                        ${s.status === 'Approved' ? `
                            <button class="btn" style="background: var(--secondary-color); color: white; border: none; padding: 6px 15px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" onclick="openClinicEntry('${s.appointmentId}', '${s.patientName}')">
                                <i class="fas fa-notes-medical" style="margin-right: 5px;"></i> Start Consultation
                            </button>
                        ` : ''}
                        ${s.status === 'Available' ? '<span style="color:#eee">--</span>' : ''}
                        ${s.status === 'Completed' ? '<i class="fas fa-check-circle" style="color: #4caf50; font-size: 1.2rem;"></i>' : ''}
                    </td>
                </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

async function updateApptStatus(id, status) {
    try {
        const res = await fetch(`${API_URL}/updateAppointmentStatus`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: id, status })
        });
        if (res.ok) {
            loadDoctorSchedule();
            loadDoctorPendingAppointments();
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadDoctorPendingAppointments() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const section = document.getElementById('pendingApptsSection');
    const container = document.getElementById('pendingApptsList');
    const badge = document.getElementById('pendingCountBadge');
    if (!container || !user) return;

    try {
        const res = await fetch(`${API_URL}/getAppointments?userId=${user.userId}&role=doctor`);
        const appointments = await res.json();
        const pending = appointments.filter(a => a.status === 'Pending');

        if (pending.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        badge.innerText = pending.length;

        let html = '';
        pending.forEach(a => {
            const dateObj = new Date(a.appointmentDate);
            const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            html += `
            <div style="background: white; border: 1px solid #ffe0b2; border-radius: 10px; padding: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 45px; height: 45px; background: #fff3e0; color: #ef6c00; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div>
                        <div style="font-weight: 700; color: var(--text-dark); font-size: 1rem;">${a.patientName}</div>
                        <div style="font-size: 0.85rem; color: #666;">
                            <i class="far fa-calendar-alt" style="margin-right: 5px;"></i><strong>${formattedDate}</strong> 
                            <i class="far fa-clock" style="margin-left: 10px; margin-right: 5px;"></i>${a.timeSlot}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline" style="padding: 8px 12px; font-size: 0.8rem;" onclick="document.getElementById('scheduleDate').value='${a.appointmentDate}'; loadDoctorSchedule();">
                        <i class="fas fa-eye"></i> View Date
                    </button>
                    <button class="btn" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600;" onclick="updateApptStatus('${a._id}', 'Approved')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600;" onclick="updateApptStatus('${a._id}', 'Rejected')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error("Failed to load pending appointments", err);
    }
}

let currentAppointmentId = null;

async function loadReceivedAccess() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const container = document.getElementById('receivedAccessList');
    if (!container || !user) return;

    try {
        const res = await fetch(`${API_URL}/getReceivedAccess/${user.userId}`);
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<p style="color: #888; grid-column: 1/-1;">No patients have currently granted you record access.</p>';
            return;
        }

        let html = '';
        let visibleCount = 0;

        data.forEach(p => {
            const expiry = new Date(p.expiresAt);
            const now = new Date();
            const diffMs = p.expiresAt ? (expiry - now) : Infinity;

            // Skip expired sessions
            if (p.expiresAt && diffMs <= 0) return;

            visibleCount++;
            let timeRemaining = "";
            let timerColor = "#334155";
            let timerBg = "#f8fafc";
            let timerBorder = "#e2e8f0";

            if (!p.expiresAt) {
                timeRemaining = "Permanent Access";
                timerColor = "#059669";
                timerBg = "#ecfdf5";
                timerBorder = "#a7f3d0";
            } else {
                const totalMins = Math.floor(diffMs / 60000);
                const hours = Math.floor(totalMins / 60);
                const mins = totalMins % 60;

                if (hours > 0) timeRemaining = `${hours}h ${mins}m remaining`;
                else timeRemaining = `${mins}m remaining`;

                if (totalMins < 60) {
                    timerColor = "#e11d48";
                    timerBg = "#fff1f2";
                    timerBorder = "#fecaca";
                }
            }

            // Map internal types to user-friendly labels
            let displayType = p.type || "Manual Grant";
            if (displayType === "regular") displayType = "Manual Grant";

            const badgeBg = displayType === 'Visit Code' ? '#ede9fe' : (displayType === 'emergency' ? '#fee2e2' : '#d1fae5');
            const badgeColor = displayType === 'Visit Code' ? '#5b21b6' : (displayType === 'emergency' ? '#991b1b' : '#047857');

            html += `
            <div style="background: white; border: 1px solid #e0e7ff; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-weight: 700; font-size: 1.1rem; color: #1e293b;">${p.patientName}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">DOB: ${p.dob || 'N/A'}</div>
                    </div>
                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">
                        ${displayType}
                    </span>
                </div>

                <div style="background: ${timerBg}; padding: 10px 12px; border-radius: 8px; border: 1px solid ${timerBorder}; transition: 0.3s;">
                    <div style="font-size: 0.75rem; color: ${timerColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fas fa-${!p.expiresAt ? 'check-circle' : 'hourglass-half'}" style="margin-right: 5px;"></i> ${!p.expiresAt ? 'Access Status' : 'Access Timer'}
                    </div>
                    <div style="font-weight: 800; color: ${timerColor}; font-size: 1.05rem; margin-top: 2px;">
                        ${timeRemaining}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 5px;">
                    <button class="btn" style="background: #6c5ce7; color: white; padding: 8px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; border: none; cursor: pointer;" 
                        onclick="quickViewRecords('${p.patientId}', '${p.patientName}')">
                        <i class="fas fa-history"></i> View Past
                    </button>
                    <button class="btn" style="background: #20bf6b; color: white; padding: 8px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; border: none; cursor: pointer;" 
                        onclick="quickAddRecord('${p.patientId}', '${p.patientName}', '${p.dob}')">
                        <i class="fas fa-plus-circle"></i> Add New
                    </button>
                </div>
            </div>`;
        });

        if (visibleCount === 0) {
            container.innerHTML = '<p style="color: #888; grid-column: 1/-1;">No active access permissions found.</p>';
        } else {
            container.innerHTML = html;
        }
    } catch (err) {
        console.error("loadReceivedAccess Error:", err);
        container.innerHTML = '<p style="color: red; grid-column: 1/-1;">Error loading permissions list.</p>';
    }
}

// Shortcuts for Quick Action from Access List
window.quickViewRecords = async function (id, name) {
    showSection('section-search-patient', document.querySelector('[onclick*="section-search-patient"]'));
    // Pre-fill search (automatically triggers because of Smart Search fix)
    const idInput = document.getElementById('fetchPatientIdOnly');
    const typeSelect = document.getElementById('historySearchType');
    if (typeSelect) {
        typeSelect.value = 'id';
        toggleHistorySearch(); // Set UI
    }
    if (idInput) {
        idInput.value = id;
        fetchPatientRecords(); // Trigger
    }
};

window.quickAddRecord = function (id, name, dob) {
    showSection('section-add-record', document.querySelector('[onclick*="section-add-record"]'));
    // Skip searching - go direct to confirmation
    selectPatientForAddRecord(name, dob || "Not Provided", id);
};

function openClinicEntry(apptId, patientName) {
    currentAppointmentId = apptId;
    showSection('section-add-record', document.querySelector('[onclick*="section-add-record"]'));
    alert("Starting consultation for " + patientName + ". Please enter the Patient ID to proceed.");
}

/* -------------------------------------------------------------------------- */
/*                 Symptom-Based Hospital Recommendation Feature              */
/* -------------------------------------------------------------------------- */

const commonSymptoms = [
    // 1 Cardiology
    "chest pain", "heart pain", "palpitations", "shortness of breath", "heart attack",
    "chest tightness", "rapid heartbeat", "fainting", "heartburn confusion", "cold sweats", "fatigue on exertion",

    // 2 Neurology
    "headache", "migraine", "seizure", "stroke", "paralysis", "dizziness",
    "tremors", "tingling sensation", "loss of balance", "slurred speech", "vision disturbances", "sudden weakness on one side",

    // 3 Gastroenterology
    "stomach pain", "acidity", "digestion",
    "constipation", "diarrhea", "bloating", "jaundice", "loss of appetite", "acid reflux",

    // 4 Pulmonology
    "breathing difficulty", "asthma", "cough", "lung problem",
    "chest heaviness", "night cough", "persistent cold", "breathlessness on walking", "snoring issues", "sleep apnea",

    // 5 General Medicine
    "fatigue", "chills", "sweating", "mild infections", "general weakness", "routine health check",

    // 6 General Surgery
    "abdominal swelling", "piles", "fistula", "cyst", "abscess", "surgical follow-up",

    // 7 Orthopedics
    "joint pain", "fracture", "bone pain", "back pain", "knee pain", "shoulder pain",
    "neck pain", "muscle stiffness", "sprain", "sports injury", "difficulty walking",

    // 8 Dermatology
    "skin rash", "itching", "acne", "skin allergy", "eczema",
    "dandruff", "fungal infection", "pigmentation", "dark spots", "nail infection",

    // 9 ENT
    "ear pain", "throat pain", "nose problem", "hearing",
    "vertigo", "blocked ear", "loss of smell", "voice change", "nasal congestion", "throat infection",

    // 10 Urology
    "frequent urination", "male infertility", "testicular pain", "urinary retention", "bladder pain", "erectile dysfunction",

    // 11 Oncology
    "cancer", "tumor", "chemotherapy",
    "persistent cough with blood", "unusual bleeding", "long-term fatigue", "abnormal growth", "suspicious mole",

    // 12 Nephrology
    "kidney pain", "urinary problem", "dialysis",
    "high creatinine", "reduced urine output", "swollen ankles", "protein in urine", "chronic swelling",

    // 13 Cardiothoracic Surgery
    "severe valve disorder", "bypass requirement", "chest trauma", "lung mass", "aortic aneurysm",

    // 14 Neurosurgery
    "brain swelling", "spinal injury", "severe nerve pain", "brain hemorrhage",

    // 15 Critical Care
    "septic shock", "multi-organ failure", "severe trauma", "ventilator support", "cardiac arrest",

    // 16 Endocrinology
    "excessive thirst", "diabetes", "weight fluctuations", "hair thinning", "delayed puberty", "hormonal acne",

    // 17 Rheumatology
    "morning stiffness", "joint swelling", "chronic fatigue", "muscle pain", "autoimmune flare-ups",

    // 18 Plastic Surgery
    "facial deformity", "cosmetic consultation", "burn scars", "trauma reconstruction", "skin graft",

    // 19 Anesthesiology
    "chronic back pain", "nerve pain", "surgical fitness", "pain relief consultation",

    // 20 Radiology
    "scan referral", "imaging evaluation", "diagnostic imaging", "fracture imaging",

    // 21 Pediatrics
    "child fever", "baby fever", "pediatric", "child health",
    "delayed speech", "frequent infections", "child vomiting", "bedwetting", "growth delay",

    // 22 Neonatology
    "newborn jaundice", "neonatal infection", "feeding difficulty", "nicu admission",

    // 23 Pediatric Cardiology
    "blue baby syndrome", "rapid heartbeat in child", "congenital defect",

    // 24 Pediatric Neurology
    "autism evaluation", "hyperactivity", "development delay", "seizures in child",

    // 25 Pediatric Pulmonology
    "recurrent bronchitis", "breathing noise in child", "chronic wheezing",

    // 26 Emergency Medicine
    "emergency", "accident", "trauma", "injury",
    "stroke symptoms", "severe accident", "sudden unconsciousness", "poisoning", "severe allergic reaction",

    // 27 Gynecology & Obstetrics
    "pregnancy", "maternity", "menstrual", "period pain", "women health",
    "infertility", "vaginal infection", "heavy bleeding", "abdominal cramps", "prenatal care",

    // 28 Psychiatry
    "mental health", "depression", "anxiety", "stress",
    "panic attacks", "hallucinations", "suicidal thoughts", "mood swings", "addiction",

    // 29 Hematology
    "frequent infections", "excessive bleeding", "pale skin", "clotting disorder", "blood cancer suspicion",

    // 30 Ophthalmology
    "eye problem", "vision", "eye pain", "blurred vision",
    "dry eyes", "eye redness", "double vision", "eye discharge", "light sensitivity"
];

function handleSymptomInput(value) {
    const suggestionsBox = document.getElementById('symptomSuggestions');
    if (!value || value.length < 1) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const val = value.toLowerCase();
    const filtered = commonSymptoms.filter(s => s.toLowerCase().includes(val));

    if (filtered.length > 0) {
        let html = '';
        filtered.forEach(s => {
            // Highlight the matching part
            const regex = new RegExp(`(${val})`, 'gi');
            const highlighted = s.replace(regex, "<strong>$1</strong>");

            html += `<div style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #eee; text-align: left; transition: 0.2s;" 
                          onmouseover="this.style.background='#f0f2f5'; this.style.paddingLeft='20px'" 
                          onmouseout="this.style.background='white'; this.style.paddingLeft='15px'"
                          onclick="selectSymptomSuggestion('${s}')">
                      <i class="fas fa-search" style="margin-right: 10px; color: #6c5ce7; font-size: 0.8rem;"></i>
                      ${highlighted}
                    </div>`;
        });
        suggestionsBox.innerHTML = html;
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
}

function selectSymptomSuggestion(symptom) {
    document.getElementById('symptomSearch').value = symptom;
    document.getElementById('symptomSuggestions').style.display = 'none';
    getHospitalRecommendation(); // Trigger search immediately
}

// Close suggestions on click outside
document.addEventListener('click', (e) => {
    const box = document.getElementById('symptomSuggestions');
    const input = document.getElementById('symptomSearch');
    if (box && e.target !== input && !box.contains(e.target)) {
        box.style.display = 'none';
    }
});

async function getHospitalRecommendation() {
    const complaint = document.getElementById('symptomSearch').value.trim();
    if (!complaint) {
        showNotification("Please describe your symptoms first", "error");
        return;
    }

    const resultsArea = document.getElementById('recommendationResults');
    resultsArea.style.display = 'block';
    resultsArea.innerHTML = '<div style="text-align:center; padding: 30px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Analyzing symptoms & searching hospitals...</p></div>';

    try {
        const res = await fetch(`${API_URL}/recommend-hospital`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ complaint })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            let html = `
                <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #fff;">
                    <span style="font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; opacity: 0.8;">Possible Specialization Required:</span>
                    <h3 style="margin: 5px 0 0 0; color: #fff; font-size: 1.4rem;">${data.specialization}</h3>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">`;

            data.recommendations.forEach(rec => {
                const hosp = rec.hospital;
                const doctors = rec.doctors;

                html += `
                    <div class="hosp-recommendation-card" style="background: white; color: #333; border-radius: 18px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); position: relative; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.3s;">
                        <div style="position: absolute; top:0; left:0; width: 6px; height: 100%; background: #6c5ce7;"></div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: #6c5ce7; font-size: 1.25rem; font-weight: 700; line-height: 1.2;">${hosp.hospitalName}</h4>
                            <div style="background: #efecff; color: #6c5ce7; padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: bold;">RECOMMENDED</div>
                        </div>
                        <p style="font-size: 0.85rem; color: #636e72; margin-bottom: 20px; display: flex; align-items: center;">
                            <i class="fas fa-map-marker-alt" style="margin-right: 8px; color: #a29bfe;"></i> ${hosp.address}, ${hosp.city}
                        </p>
                        
                        <div style="border-top: 1.5px dashed #eee; padding-top: 20px; flex-grow: 1;">
                            <p style="font-size: 0.75rem; font-weight: 800; margin-bottom: 15px; color: #b2bec3; text-transform: uppercase; letter-spacing: 0.5px;">Specialists at this facility:</p>`;

                if (doctors.length > 0) {
                    doctors.forEach(doc => {
                        html += `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f9f9fb; padding: 12px; border-radius: 12px; border: 1px solid #f1f1f5;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 35px; height: 35px; background: #e0e0ff; color: #6c5ce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                                        <i class="fas fa-user-md"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.9rem; color: #2d3436;">${formatDoctorName(doc.name)}</div>
                                        <div style="font-size: 0.7rem; color: #636e72; font-weight: 500;">${doc.experienceYears || '5+'} Years Experience</div>
                                    </div>
                                </div>
                                <button class="btn btn-primary" style="padding: 7px 14px; font-size: 0.75rem; border-radius: 8px; box-shadow: 0 4px 10px rgba(9, 132, 227, 0.2);" 
                                        onclick="bookFromRecommendation('${hosp.hospitalId}', '${data.specialization}', '${doc.userIdHash}')">
                                    Book
                                </button>
                            </div>`;
                    });
                } else {
                    html += `
                        <div style="text-align: center; padding: 15px; background: #fff8f8; border-radius: 12px; margin-bottom: 15px;">
                            <p style="font-size: 0.85rem; font-style: italic; color: #e17055; margin: 0;">No specific doctors listed for this specialization yet.</p>
                        </div>
                        <button class="btn btn-primary" style="width: 100%; margin-top: auto; padding: 12px; border-radius: 12px; font-weight: bold; background: #6c5ce7; border: none;" 
                                 onclick="bookFromRecommendation('${hosp.hospitalId}', '${data.specialization}', '')">
                            Quick Appointment
                         </button>`;
                }

                html += `</div></div>`;
            });

            html += `</div>`;
            resultsArea.innerHTML = html;
        } else {
            resultsArea.innerHTML = `
                <div style="text-align:center; background: rgba(255,255,255,0.15); padding: 35px; border-radius: 20px; border: 2px dashed rgba(255,255,255,0.2);">
                    <i class="fas fa-search-minus" style="font-size: 2.5rem; margin-bottom: 15px; color: #fff; opacity: 0.7;"></i>
                    <p style="margin: 0; font-size: 1.1rem; font-weight: 500;">${data.message || "We couldn't find a matching specialization."}</p>
                    <button class="btn" onclick="document.getElementById('symptomSearch').value=''; document.getElementById('recommendationResults').style.display='none';" 
                            style="margin-top: 15px; background: white; color: #6c5ce7; font-size: 0.8rem; padding: 8px 20px; border-radius: 8px;">Try Again</button>
                </div>`;
        }
    } catch (err) {
        console.error(err);
        resultsArea.innerHTML = `
            <div style="text-align:center; padding: 25px; background: rgba(255,0,0,0.1); border-radius: 15px;">
                <p>Failed to connect to server. Please ensure the backend is running.</p>
            </div>`;
    }
}

function bookFromRecommendation(hospId, specialization, docIdHash) {
    const appointmentLink = document.querySelector('.sidebar-nav .nav-link[onclick*="section-appointments"]');
    showSection('section-appointments', appointmentLink);

    // Explicitly call the initialization functions
    loadBookingHospitals();
    loadMyAppointments();

    showNotification("Found matching facility! Setting up your booking...", "success");

    // Automation of selective dropdowns
    let attempts = 0;
    const interval = setInterval(() => {
        const hospSelect = document.getElementById('bookHospitalSelect');
        if (hospSelect && hospSelect.options.length > 1) {
            hospSelect.value = hospId;
            loadBookingDepartments();
            clearInterval(interval);

            let deptAttempts = 0;
            const deptInterval = setInterval(() => {
                const deptSelect = document.getElementById('bookDeptSelect');
                if (deptSelect && deptSelect.options.length > 1) {
                    deptSelect.value = specialization;
                    loadBookingDoctors();
                    clearInterval(deptInterval);

                    if (docIdHash) {
                        let docAttempts = 0;
                        const docInterval = setInterval(() => {
                            const docSelect = document.getElementById('bookDoctorSelect');
                            if (docSelect && docSelect.options.length > 1) {
                                docSelect.value = docIdHash;
                                loadAvailableSlots();
                                clearInterval(docInterval);
                                showNotification("Doctor and slot options loaded!", "success");
                            }
                            if (++docAttempts > 30) clearInterval(docInterval);
                        }, 150);
                    }
                }
                if (++deptAttempts > 30) clearInterval(deptInterval);
            }, 150);
        }
        if (++attempts > 30) clearInterval(interval);
    }, 150);
}

/* -------------------------------------------------------------------------- */
/*                        Visit Token System Functions                        */
/* -------------------------------------------------------------------------- */

let currentVisitPatient = null; // Stores { patientId, patientName, expiry }

async function verifyPatientVisitCode() {
    const input = document.getElementById('visitTokenInput');
    const code = input.value.trim().toUpperCase();
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const errorDiv = document.getElementById('tokenVerificationError');
    const successDiv = document.getElementById('tokenVerificationSuccess');
    const btn = document.getElementById('btnVerifyToken');

    if (!code) {
        showTokenError("Please enter a visit code.");
        return;
    }

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
        const res = await fetch(`${API_URL}/verifyVisitCode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitCode: code, doctorId: user.userId })
        });

        // Use a more generic error handling if data is not JSON
        let data;
        const text = await res.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }

        if (res.ok) {
            currentVisitPatient = data;
            document.getElementById('tokenPatName').innerText = data.patientName;
            successDiv.style.display = 'block';
            input.value = '';
            showNotification("Access granted successfully!", "success");
        } else {
            showTokenError(typeof data === 'string' ? data : (data.message || "Verification failed"));
        }
    } catch (err) {
        console.error(err);
        showTokenError("Server connection error. Please try again.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-alt"></i> Verify & Grant Access';
    }
}

function showTokenError(msg) {
    const errorDiv = document.getElementById('tokenVerificationError');
    const errorMsg = document.getElementById('tokenErrorMsg');
    if (errorMsg) errorMsg.innerText = msg;
    if (errorDiv) errorDiv.style.display = 'block';
    showNotification(msg, "error");
}

function viewRecordsFromToken() {
    if (!currentVisitPatient) return;
    showSection('section-search-patient', document.querySelector('[onclick*="section-search-patient"]'));

    // Pre-fill search by ID 
    const historyIdInput = document.getElementById('fetchPatientIdOnly');
    if (historyIdInput) {
        setHistorySearchType('id');
        historyIdInput.value = currentVisitPatient.patientId;
        fetchPatientRecords();
    }
}

function startVisitFromToken() {
    if (!currentVisitPatient) return;
    showSection('section-add-record', document.querySelector('[onclick*="section-add-record"]'));

    // Start the add record flow
    const recordIdInput = document.getElementById('recordSearchIdInput');
    if (recordIdInput) {
        setRecordSearchType('id');
        recordIdInput.value = currentVisitPatient.patientId;
        searchPatientForRecord();
    }
}

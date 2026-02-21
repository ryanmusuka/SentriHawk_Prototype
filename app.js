// === GLOBAL STATE ===
const state = { user: null, building: null };

// === 1. AUTHENTICATION & SESSION MANAGEMENT ===

// 1.1 Run this immediately when the script loads
document.addEventListener("DOMContentLoaded", checkSession);

function checkSession() {
    const savedSession = sessionStorage.getItem('sentrihawk_session');
    if (savedSession) {
        console.log("Restoring active session...");
        const parsed = JSON.parse(savedSession);
        state.user = parsed.userData;
        state.building = parsed.buildingData;
        
        // Skip login screen
        transitionToApp();
    }
}

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    // Security Note: In production (FastAPI), passwords MUST be hashed using bcrypt/Argon2.
    // NEVER store or compare plaintext passwords in a real database.
    const result = authenticateUser(user, pass); 

    if (result.success) {
        state.user = result.userData;
        state.building = result.buildingData;
        
        // Simulating JWT Storage: Save session so refresh doesn't log user out
        sessionStorage.setItem('sentrihawk_session', JSON.stringify({
            userData: state.user,
            buildingData: state.building
        }));
        
        transitionToApp();
    } else {
        triggerLoginError();
    }
}

function transitionToApp() {
    // UI Updates
    document.getElementById('login-view').classList.remove('view-active');
    document.getElementById('login-view').classList.add('view-hidden');
    document.getElementById('app-view').classList.remove('view-hidden');
    
    // Populate Sidebar Profile
    document.getElementById('display-name').textContent = state.user.name;
    document.getElementById('display-building').textContent = state.building.name;
    document.getElementById('role-badge').textContent = state.user.role;

    routeUser(); // Proceed to load the correct dashboard
}

function triggerLoginError() {
    // Better UX than an alert()
    const btn = document.querySelector('#login-form .btn-primary');
    const originalText = btn.innerText;
    btn.style.backgroundColor = 'var(--danger)';
    btn.innerText = 'AUTHORIZATION FAILED';
    
    setTimeout(() => {
        btn.style.backgroundColor = 'var(--primary-action)';
        btn.innerText = originalText;
    }, 2000);
}

function logout() { 
    sessionStorage.removeItem('sentrihawk_session');
    location.reload(); 
}

// 2. ROUTING & NAVIGATION
function routeUser() {
    const role = state.user.role;
    
    if (role === 'guard') {
        document.getElementById('nav-guard').classList.remove('hidden');
        switchGuardView('guard-dashboard');
        populateGuardDashboard();
    } else if (role === 'tenant' || role === 'hos') {
        document.getElementById('nav-tenant').classList.remove('hidden');
        document.getElementById('tenant-dashboard').classList.remove('view-hidden');
        document.getElementById('tenant-dashboard').classList.add('view-active');
        populateTenantDashboard();
    }
}

// Guard Sub-navigation
function switchGuardView(viewId, navElement = null) {
    // 1. Move the Orange Active Accent
    if (navElement) {
        // Find all links inside the guard nav and remove the active class
        const navItems = document.querySelectorAll('#nav-guard .nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        
        // Add the active class to the link that was just clicked
        navElement.classList.add('active');
    }

    // 2. Hide all guard views
    const allGuardViews = [
        'guard-dashboard', 'guard-registration', 
        'guard-history', 'guard-deliveries', 
        'guard-communicate', 'guard-settings'
    ];
    
    allGuardViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('view-hidden');
            el.classList.remove('view-active');
        }
    });

    // 3. Show the requested view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('view-hidden');
        targetView.classList.add('view-active');
    }

    // Run specific setup scripts if needed
    if (viewId === 'guard-registration') {
        setupRegistrationView();
    }
}

let activeVisitorId = null;
let currentDashboardFilter = 'ALL';

function setDashboardFilter(filter) {
    currentDashboardFilter = filter;
    const titleEl = document.getElementById('guard-table-title');
    
    // Dynamically change the table title based on the click
    if (filter === 'EXPECTED') titleEl.innerText = 'Expected Arrivals';
    else if (filter === 'ON_SITE') titleEl.innerText = 'Currently On Site';
    else if (filter === 'INCIDENTS') titleEl.innerText = 'Flagged Entities';
    else titleEl.innerText = 'Recent Activity';
    
    populateGuardDashboard(); // Redraw the table with the new filter
}

// === 3. DASHBOARD POPULATION (Dynamic & Interactive) ===
function populateGuardDashboard() {
    const tbody = document.getElementById('guard-overview-table');
    tbody.innerHTML = ''; 
    
    const visitors = getVisitors(); 
    
    // --- 1. THE MATH ENGINE ---
    let expectedCount = 0;
    let onSiteCount = 0;
    let incidentCount = 0;

    visitors.forEach(v => {
        const currentStatus = v.status || (v.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
        if (currentStatus === 'EXPECTED') expectedCount++;
        if (currentStatus === 'ON SITE') onSiteCount++;
        if (v.isBlacklisted) incidentCount++;
    });

    document.getElementById('stat-expected').innerText = expectedCount;
    document.getElementById('stat-onsite').innerText = onSiteCount;
    document.getElementById('stat-incidents').innerText = incidentCount;

    // --- 2. FILTER & DRAW THE TABLE ---
    let displayVisitors = visitors.slice().reverse(); // Show newest first
    
    // Apply the active filter
    if (currentDashboardFilter === 'EXPECTED') {
        displayVisitors = displayVisitors.filter(v => (v.status || (v.isBlacklisted ? 'FLAGGED' : 'EXPECTED')) === 'EXPECTED');
    } else if (currentDashboardFilter === 'ON_SITE') {
        displayVisitors = displayVisitors.filter(v => v.status === 'ON SITE');
    } else if (currentDashboardFilter === 'INCIDENTS') {
        displayVisitors = displayVisitors.filter(v => v.isBlacklisted);
    } else {
        displayVisitors = displayVisitors.slice(0, 8); // ALL Activity: Just show last 8
    }

    displayVisitors.forEach(v => {
        const currentStatus = v.status || (v.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
        
        let statusClass = 'status-cleared'; 
        if (currentStatus === 'FLAGGED') statusClass = 'status-flagged'; 
        if (currentStatus === 'ON SITE') statusClass = 'status-active'; 
        if (currentStatus === 'CHECKED OUT') statusClass = 'status-cleared'; 

        const displayName = v.isGhost ? "VIP GUEST" : v.name;
        
        // Time logic: Show dash if no time is recorded yet
        const timeIn = v.time_in ? v.time_in : '-';
        const timeOut = v.time_out ? v.time_out : '-';

        tbody.innerHTML += `
            <tr onclick="openVisitorProfile('${v.id}')">
                <td><strong>${displayName}</strong></td>
                <td>${v.destination || 'Unknown'}</td> <td><span class="status-tag ${statusClass}">${currentStatus}</span></td>
                <td>${timeIn}</td>
                <td>${timeOut}</td>
            </tr>
        `;
    });
}
// === Tier-Based Feature Locking ===
function setupRegistrationView() {
    // Look at the building data saved during login
    const tier = state.building.tier || 1; 

    if (tier === 1) {
        // Tier 1: Force manual mode, hide the "Back to Scan" button completely
        toggleRegMode('manual');
        document.getElementById('btn-back-to-scan').style.display = 'none'; 
    } else {
        // Tier 2 & 3: Allow scanning, show the back button
        toggleRegMode('scan');
        document.getElementById('btn-back-to-scan').style.display = 'block';
    }
}

function toggleRegMode(mode) {
    if (mode === 'scan') {
        document.getElementById('reg-scan-mode').classList.remove('hidden');
        document.getElementById('reg-manual-mode').classList.add('hidden');
    } else {
        document.getElementById('reg-scan-mode').classList.add('hidden');
        document.getElementById('reg-manual-mode').classList.remove('hidden');
    }
}

// === TENANT DIRECTORY LOGIC ===
function openTenantGrid() {
    const grid = document.getElementById('tenant-grid');
    grid.innerHTML = ''; 
    
    // Draw the 13 obsidian boxes (relies on 'tenants' array from data.js)
    tenants.forEach(t => {
        grid.innerHTML += `
            <div class="tenant-card" onclick="selectTenant('${t.name}', this)">
                <div class="tenant-logo">${t.logo}</div>
                <div class="tenant-name">${t.name}</div>
            </div>
        `;
    });
    
    document.getElementById('tenant-directory-modal').classList.remove('hidden');
}

function closeTenantGrid() {
    document.getElementById('tenant-directory-modal').classList.add('hidden');
}

function selectTenant(tenantName, element) {
    // 1. Flash the box orange
    element.classList.add('selected-flash');
    
    // 2. Wait 250ms for the visual effect, then execute
    setTimeout(() => {
        closeTenantGrid();
        
        // 3. Update the UI on the form to show the selection
        const destBox = document.getElementById('destination-selector');
        const destText = document.getElementById('destination-text');
        const destInput = document.getElementById('v-destination');
        
        if (destInput) destInput.value = tenantName; 
        if (destText) destText.innerText = tenantName; 
        if (destBox) destBox.classList.add('has-selection'); 
        
    }, 250);
}

// === VISITOR PROFILE LOGIC ===

function closeVisitorProfile() {
    document.getElementById('visitor-profile-modal').classList.add('hidden');
    activeVisitorId = null;
}

function openVisitorProfile(id) {
    const visitors = getVisitors();
    const visitor = visitors.find(v => v.id === id);
    if (!visitor) return;

    activeVisitorId = id; 

    document.getElementById('vp-name').innerText = visitor.name;
    document.getElementById('vp-id').innerText = visitor.document_id || `ID-${Math.floor(Math.random() * 90000) + 10000}`;
    document.getElementById('vp-phone').innerText = visitor.phone || `+1 555 ${Math.floor(Math.random() * 9000) + 1000}`;
    document.getElementById('vp-company').innerText = visitor.company;
    
    const statusEl = document.getElementById('vp-status');
    const currentStatus = visitor.status || (visitor.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
    statusEl.innerText = currentStatus;

    // Smart Button Logic
    const btnArrived = document.getElementById('btn-mark-arrived');
    const btnSignOut = document.getElementById('btn-sign-out');
    
    btnArrived.style.display = 'none';
    btnSignOut.style.display = 'none';

    if (currentStatus === 'EXPECTED' && !visitor.isBlacklisted) {
        btnArrived.style.display = 'block'; // Show Arrival button
    } else if (currentStatus === 'ON SITE') {
        btnSignOut.style.display = 'block'; // Show Sign Out button
    }

    document.getElementById('visitor-profile-modal').classList.remove('hidden');
}

function markVisitorArrived() {
    if (!activeVisitorId) return;

    let visitors = getVisitors();
    const visitorIndex = visitors.findIndex(v => v.id === activeVisitorId);
    
    if (visitorIndex !== -1) {
        visitors[visitorIndex].status = 'ON SITE';
        // Auto-stamp Time In
        visitors[visitorIndex].time_in = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); 
        visitors[visitorIndex].last_seen = new Date().toLocaleString(); 
        
        sessionStorage.setItem('sentrihawk_visitors', JSON.stringify(visitors));
    }

    closeVisitorProfile();
    populateGuardDashboard(); 
}

// NEW: Sign Out function
function signVisitorOut() {
    if (!activeVisitorId) return;

    let visitors = getVisitors();
    const visitorIndex = visitors.findIndex(v => v.id === activeVisitorId);
    
    if (visitorIndex !== -1) {
        visitors[visitorIndex].status = 'CHECKED OUT';
        // Auto-stamp Time Out
        visitors[visitorIndex].time_out = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); 
        
        sessionStorage.setItem('sentrihawk_visitors', JSON.stringify(visitors));
    }

    closeVisitorProfile();
    populateGuardDashboard(); 
}

// 4. GUARD ACTIONS (Scanning & Silent Alarm)
function simulateScan() {
    const text = document.getElementById('scan-text');
    text.innerText = "Extracting details...";
    
    setTimeout(() => {
        text.innerText = "Scan complete";
        document.getElementById('v-name').value = "John Doe";
        document.getElementById('v-id').value = "ID-99321";
    }, 1200);
}

// === 4. GUARD ACTIONS (Registration) ===
function verifyVisitor(e) {
    e.preventDefault();
    
    const rawName = document.getElementById('v-name').value;
    const docId = document.getElementById('v-id').value;
    const contact = document.getElementById('v-contact').value;
    const org = document.getElementById('v-org').value || "Walk-in Visitor";
    const dest = document.getElementById('v-destination').value; // Extracted correctly
    
    const searchName = rawName.toLowerCase();
    
    if (searchName.includes("bad") || searchName.includes("restricted")) {
        // Assume you have triggerSilentAlarm() defined somewhere in app.js
        triggerSilentAlarm();
        return; 
    } 
    
    addVisitor({
        name: rawName,
        document_id: docId,
        phone: contact,
        company: org,
        destination: dest,
        isBlacklisted: false,
        isGhost: false,
        status: 'ON SITE',
        time_in: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
    
    alert(`Access Granted. ${rawName} has been securely logged.`);
    
    // Clear form inputs
    document.getElementById('v-name').value = '';
    document.getElementById('v-id').value = '';
    document.getElementById('v-contact').value = '';
    document.getElementById('v-org').value = '';
    
    // Reset destination UI specifically
    document.getElementById('v-destination').value = '';
    const destText = document.getElementById('destination-text');
    const destBox = document.getElementById('destination-selector');
    
    if (destText) destText.innerText = '+ Select Destination Tenant';
    if (destBox) destBox.classList.remove('has-selection');
    
    switchGuardView('guard-dashboard'); 
    populateGuardDashboard(); 
}

// 5. TENANT ACTIONS (Ghost Protocol)
function openGhostModal() { document.getElementById('ghost-modal').classList.remove('hidden'); }
function closeGhostModal() { 
    document.getElementById('ghost-modal').classList.add('hidden'); 
    document.getElementById('qrcode').innerHTML = ''; 
    document.getElementById('ghost-name').value = '';
}

function generateGhostQR() {
    const name = document.getElementById('ghost-name').value;
    if(!name) return alert("Please enter a name.");

    // 1. Generate Token
    const token = `SH_GHOST_${Date.now()}`;
    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: token, width: 160, height: 160 });

    // 2. Save Ghost to Database so the Guard can see them
    addVisitor({
        name: "VIP GUEST", 
        real_name: name,   
        company: "Confidential",
        type: "vip",
        isGhost: true,
        status: 'EXPECTED' 
    });

    // 3. Re-render Tenant Dash to show the new VIP
    populateTenantDashboard();
    console.log("Ghost Pass Generated and Logged to Database.");
}

function triggerSilentAlarm() {
    document.getElementById('silent-alarm-banner').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('silent-alarm-banner').classList.add('hidden');
    }, 4000);
}
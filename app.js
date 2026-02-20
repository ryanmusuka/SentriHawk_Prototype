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
    // Securely wipe the session token
    sessionStorage.removeItem('sentrihawk_session');
    // Wipe mock database state if you want a clean slate (Optional)
    // localStorage.removeItem('sentrihawk_visitors');
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
function switchGuardView(viewId) {
    document.getElementById('guard-dashboard').classList.add('view-hidden');
    document.getElementById('guard-dashboard').classList.remove('view-active');
    
    document.getElementById('guard-registration').classList.add('view-hidden');
    document.getElementById('guard-registration').classList.remove('view-active');

    document.getElementById(viewId).classList.remove('view-hidden');
    document.getElementById(viewId).classList.add('view-active');
}

// 3. DASHBOARD POPULATION
function populateGuardDashboard() {
    const tbody = document.getElementById('guard-overview-table');
    tbody.innerHTML = ''; // Clear existing
    
    const visitors = getVisitors(); // Fetch from localStorage
    
    // Only show the last 5 visitors to keep the guard's view clean
    const recentVisitors = visitors.slice(-5).reverse(); 

    recentVisitors.forEach(v => {
        // We reuse the styling logic
        const statusClass = v.isBlacklisted ? 'status-flagged' : 'status-cleared';
        const statusText = v.isBlacklisted ? 'RESTRICTED' : 'CLEARED';
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${v.name}</strong></td>
                <td>${v.company}</td>
                <td><span class="status-tag ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
}

// === GLOBAL VARIABLE FOR ACTIVE PROFILE ===
let activeVisitorId = null;

// === 3. DASHBOARD POPULATION (Updated for interactivity) ===
function populateGuardDashboard() {
    const tbody = document.getElementById('guard-overview-table');
    tbody.innerHTML = ''; 
    
    const visitors = getVisitors(); // Fetches from localStorage
    const recentVisitors = visitors.slice(-8).reverse(); // Show last 8

    recentVisitors.forEach(v => {
        // Default status logic if not set
        const currentStatus = v.status || (v.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
        
        // Dynamic styling based on status
        let statusClass = 'status-cleared'; // Default Green
        if (currentStatus === 'FLAGGED') statusClass = 'status-flagged'; // Red
        if (currentStatus === 'ON SITE') statusClass = 'status-active'; // We'll add a blue tag for this

        // Notice the onclick event passing the visitor's unique ID
        tbody.innerHTML += `
            <tr onclick="openVisitorProfile('${v.id}')">
                <td><strong>${v.name}</strong></td>
                <td>${v.company}</td>
                <td><span class="status-tag ${statusClass}">${currentStatus}</span></td>
            </tr>
        `;
    });
}

// === NEW: VISITOR PROFILE LOGIC ===

function openVisitorProfile(id) {
    const visitors = getVisitors();
    const visitor = visitors.find(v => v.id === id);
    if (!visitor) return;

    activeVisitorId = id; // Store ID globally for the update function

    // Populate modal fields
    document.getElementById('vp-name').innerText = visitor.name;
    // Add mock fallbacks for data we might not have captured yet
    document.getElementById('vp-id').innerText = visitor.document_id || `ID-${Math.floor(Math.random() * 90000) + 10000}`;
    document.getElementById('vp-phone').innerText = visitor.phone || `+1 555 ${Math.floor(Math.random() * 9000) + 1000}`;
    document.getElementById('vp-company').innerText = visitor.company;
    
    const statusEl = document.getElementById('vp-status');
    const currentStatus = visitor.status || (visitor.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
    statusEl.innerText = currentStatus;

    // Button Logic: Hide the "Arrived" button if they are already on site or flagged
    const btn = document.getElementById('btn-mark-arrived');
    if (currentStatus === 'ON SITE' || visitor.isBlacklisted) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'block';
    }

    // Show modal
    document.getElementById('visitor-profile-modal').classList.remove('hidden');
}

function closeVisitorProfile() {
    document.getElementById('visitor-profile-modal').classList.add('hidden');
    activeVisitorId = null;
}

function markVisitorArrived() {
    if (!activeVisitorId) return;

    // 1. Fetch current database
    let visitors = getVisitors();
    
    // 2. Find and update the specific visitor
    const visitorIndex = visitors.findIndex(v => v.id === activeVisitorId);
    if (visitorIndex !== -1) {
        visitors[visitorIndex].status = 'ON SITE';
        visitors[visitorIndex].last_seen = new Date().toLocaleString(); // Update timestamp
        
        // 3. Save back to localStorage
        localStorage.setItem('sentrihawk_visitors', JSON.stringify(visitors));
    }

    // 4. Close modal and re-render the UI
    closeVisitorProfile();
    populateGuardDashboard(); // Updates the Guard table instantly
    
    // If the Tenant portal is open in another tab/view, this ensures it gets updated
    if (document.getElementById('tenant-dashboard').classList.contains('view-active')) {
        populateTenantDashboard();
    }
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

function verifyVisitor(e) {
    e.preventDefault();
    
    // Get the raw input
    const rawName = document.getElementById('v-name').value;
    const searchName = rawName.toLowerCase();
    
    // 1. Check ACL (Access Control List) for Blacklist
    if (searchName.includes("bad") || searchName.includes("restricted")) {
        triggerSilentAlarm();
        return; // Stop execution, do not save to database
    } 
    
    // 2. SAVE TO DATABASE 
    // We call addVisitor from data.js, which saves to localStorage
    const newVisitor = addVisitor({
        name: rawName,
        company: "Walk-in Visitor", // Defaulting for prototype
        isBlacklisted: false,
        isGhost: false
    });

    console.log("New Visitor Saved:", newVisitor);
    
    // 3. UI Feedback & Routing
    alert(`Access Granted. ${rawName} has been securely logged.`);
    
    // Clear form
    document.getElementById('v-name').value = '';
    document.getElementById('v-id').value = '';
    
    // Send guard back to the overview dashboard
    switchGuardView('guard-dashboard'); 
    
    // Refresh the guard's table so they see the person they just admitted!
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
    if(!name) return;
    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: `SH_GHOST_${Date.now()}`, width: 160, height: 160 });
}
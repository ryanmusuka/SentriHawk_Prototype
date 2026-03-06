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
    initSettingsTab();
    loadSavedTheme()
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
    const tier = state.building?.tier || 1; 

    // Hide BOTH navbars first
    const navGuard = document.getElementById('nav-guard');
    const navTenant = document.getElementById('nav-tenant');
    const navHOS = document.getElementById('nav-hos');

    if (navGuard) navGuard.classList.add('hidden');
    if (navTenant) navTenant.classList.add('hidden');
    if (navHOS) navHOS.classList.add('hidden');

    // Combine all possible view IDs across all roles
    const allAppViews = [
        // Guard Views
        'guard-dashboard', 'guard-registration', 'guard-history', 
        'guard-deliveries', 'guard-communicate', 
        // Tenant Views
        'tenant-dashboard', 'tenant-pre-reg', 'tenant-history', 
        'tenant-communicate', 'tenant-calendar-view', 'tenant-deliveries',
        // HOS Views
        'hos-dashboard', 'hos-analytics', 'hos-surveillance', 
        'hos-watchlist', 'hos-history',
        // Shared Views
        'settings-view'
    ];
    
    // Force every single view into a hidden state
    allAppViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('view-hidden');
            el.classList.remove('view-active');
        }
    });

    // ==========================================
    // 2. ROLE-BASED ROUTING (Rebuilding the UI)
    // ==========================================

    if (role === 'guard') {
        if (navGuard) navGuard.classList.remove('hidden');

        // --- TIER FEATURE LOCK (GUARD: DELIVERIES) ---
        const deliveryNavBtn = document.getElementById('nav-guard-deliveries'); 
        if (deliveryNavBtn) {
            if (tier === 1) {
                deliveryNavBtn.classList.add('tier-locked');
            } else {
                deliveryNavBtn.classList.remove('tier-locked');
            }
        }

        switchGuardView('guard-dashboard');
        if (typeof populateGuardDashboard === 'function') populateGuardDashboard();

    } else if (role === 'tenant') {
        if (navTenant) navTenant.classList.remove('hidden');

        // --- TIER FEATURE LOCK (TENANT: PRE-REGISTRATION) ---
        const preRegNavBtn = document.getElementById('nav-tenant-prereg'); 
        const preRegDashBtn = document.getElementById('btn-dashboard-prereg'); // Grab the dashboard button
        
        if (tier === 1) {
            if (preRegDashBtn) preRegDashBtn.classList.add('hidden'); // Hide the dashboard button
            console.warn("Security Alert: Ghost Protocol UI locked for Tier 1 tenant.");
        } else {
            if (preRegNavBtn) preRegNavBtn.classList.remove('tier-locked');
            if (preRegDashBtn) preRegDashBtn.classList.remove('hidden'); // Show the dashboard button
        }

        // Switch to the tenant dashboard and pass the first nav item to highlight it
        const firstTenantNavItem = document.querySelector('#nav-tenant .nav-item');
        switchTenantView('tenant-dashboard', firstTenantNavItem);
        
        if (typeof populateTenantDashboard === 'function') populateTenantDashboard();
    } else if (role === 'hos') { 
        if (navHOS) navHOS.classList.remove('hidden');

        // Feature Flag: Analytics (Requires Tier 2 or 3)
        const analyticsBtn = document.getElementById('nav-hos-analytics');
        if (analyticsBtn) {
            tier >= 2 ? analyticsBtn.classList.remove('tier-locked') : analyticsBtn.classList.add('tier-locked');
        }

        // Feature Flag: Live Surveillance (Requires Tier 3)
        const surveillanceBtn = document.getElementById('nav-hos-surveillance');
        if (surveillanceBtn) {
            tier === 3 ? surveillanceBtn.classList.remove('tier-locked') : surveillanceBtn.classList.add('tier-locked');
        }

        // Initialize HOS View
        const firstHOSNavItem = document.querySelector('#nav-hos .nav-item');
        switchHOSView('hos-dashboard', firstHOSNavItem);
    }
}

// Close any open modal if the user clicks the dark background overlay
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.add('hidden');
        
        // Safety cleanup if they close the manual watchlist modal this way
        if (event.target.id === 'modal-manual-watchlist') {
            closeManualWatchlistModal(); 
        }
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
        'guard-communicate', 'settings-view'
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
    if (viewId === 'guard-registration') setupRegistrationView();
    if (viewId === 'guard-history') {
        // If the saved historyDate is older than today's actual date, reset it to today
        const actualToday = new Date();
        if (historyDate.toDateString() !== actualToday.toDateString()) {
            historyDate = actualToday;
        }
        updateHistoryUI(); 
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
    
    const visitors = getGuardVisitors(); 
    
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
        // 1. Guard Status & Data Extraction
        const currentStatus = v.status || (v.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
        const latestVisit = (v.visits && v.visits.length > 0) ? v.visits[v.visits.length - 1] : {};
        
        // Use visits data if available, fallback to root object data
        const timeInStr = latestVisit.time_in || v.timeIn || '--:--';
        const timeOutStr = latestVisit.time_out || v.timeOut || '--:--';
        const dest = latestVisit.company || v.company || 'Unknown';
        
        // Guard specific: Hide the real name if they are a Ghost protocol VIP
        const displayName = v.isGhost ? "VIP GUEST" : v.name;

        // 2. Evaluate Status Badges (Using the exact styling from the Tenant view)
        let statusBadge = `<span class="status-tag" style="background: #e2e8f0; color: #475569;">Unknown</span>`;
        if (currentStatus === 'EXPECTED') statusBadge = `<span class="status-tag" style="background: #fef08a; color: black;">Expected</span>`;
        if (currentStatus === 'ON SITE' || currentStatus === 'ON_SITE') statusBadge = `<span class="status-tag" style="background: #bbf7d0; color: #166534;">On Site</span>`;
        if (currentStatus === 'CHECKED OUT' || currentStatus === 'SIGNED_OUT') statusBadge = `<span class="status-tag" style="background: #e2e8f0; color: #475569;">Signed Out</span>`;
        if (currentStatus === 'FLAGGED' || currentStatus === 'RESTRICTED' || v.isBlacklisted) statusBadge = `<span class="status-tag text-danger" style="background: #fee2e2;">Restricted</span>`;

        // 3. Create and inject the table row (Tenant method)
        const tr = document.createElement('tr');
        
        // Keep the Guard's ability to click the row to see the profile
        tr.setAttribute('onclick', `openVisitorProfile('${v.id}')`);
        tr.style.cursor = 'pointer'; // Adds a pointer so guards know it's clickable

        // Notice we kept the 5 columns so it aligns with the Guard's table headers
        tr.innerHTML = `
            <td style="font-weight: 500;">
                ${displayName} 
                ${v.isVIP ? '<span style="color: #eab308; margin-left: 5px; font-size: 0.8rem;">★ VIP</span>' : ''}
            </td>
            <td>${dest}</td> 
            <td>${statusBadge}</td>
            <td>${timeInStr}</td>
            <td>${timeOutStr}</td>
        `;
        tbody.appendChild(tr);
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
    const visitors = getGuardVisitors();
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

    let visitors = getGuardVisitors();
    const visitorIndex = visitors.findIndex(v => v.id === activeVisitorId);
    
    if (visitorIndex !== -1) {
        let visitor = visitors[visitorIndex];
        visitor.status = 'ON SITE';
        
        // 1. Ensure the visits array exists
        if (!visitor.visits) {
            visitor.visits = [];
        }
        
        // 2. Dynamically build the exact record the History tab is looking for
        const todayStr = new Date().toISOString().split('T')[0];
        visitor.visits.push({
            date: todayStr,
            destination: visitor.company || 'Unknown',
            time_in: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            time_out: null
        });
        
        visitor.last_seen = new Date().toLocaleString(); 
        
        // Save to the database
        sessionStorage.setItem('sentrihawk_guard_visitors', JSON.stringify(visitors));
    }

    closeVisitorProfile();
    populateGuardDashboard(); 
}

function signVisitorOut() {
    if (!activeVisitorId) return;

    let visitors = getGuardVisitors();
    const visitorIndex = visitors.findIndex(v => v.id === activeVisitorId);
    
    if (visitorIndex !== -1) {
        let visitor = visitors[visitorIndex];
        
        // Change status so the dashboard badge updates
        visitor.status = 'CHECKED OUT'; 
        
        // Find the most recent visit (the one we just created during sign-in)
        if (visitor.visits && visitor.visits.length > 0) {
            let latestVisit = visitor.visits[visitor.visits.length - 1];
            latestVisit.time_out = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } else {
            // Failsafe: If a guard somehow signs someone out without signing them in first
            const todayStr = new Date().toISOString().split('T')[0];
            visitor.visits = [{
                date: todayStr,
                destination: visitor.company || 'Unknown',
                time_in: '--:--',
                time_out: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            }];
        }
        
        visitor.last_seen = new Date().toLocaleString(); 
        
        // Save back to the correct Guard database
        sessionStorage.setItem('sentrihawk_guard_visitors', JSON.stringify(visitors));
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
    const dest = document.getElementById('v-destination').value; 
    
    // Capture VRN if element exists
    const vrnElement = document.getElementById('v-vehicle');
    const vrn = vrnElement ? vrnElement.value : "N/A";
    
    const searchName = rawName.toLowerCase();
    
    if (searchName.includes("bad") || searchName.includes("restricted")) {
        triggerSilentAlarm();
        return; 
    } 
    
    let visitors = getGuardVisitors();
    let todayDate = new Date().toISOString().split('T')[0];
    let timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    // Check if person exists to append visit, or create new
    let existingPersonIndex = visitors.findIndex(v => (v.document_id && v.document_id === docId) || v.name.toLowerCase() === searchName);

    if (existingPersonIndex !== -1) {
        // Person exists, update status, VRN, and append visit
        visitors[existingPersonIndex].status = 'ON SITE';
        visitors[existingPersonIndex].vrn = vrn;
        if(!visitors[existingPersonIndex].visits) visitors[existingPersonIndex].visits = [];
        visitors[existingPersonIndex].visits.push({ date: todayDate, time_in: timeString, time_out: null, destination: dest });
        sessionStorage.setItem('sentrihawk_visitors', JSON.stringify(visitors));
    } else {
        // New person
        addVisitor({
            name: rawName,
            document_id: docId,
            phone: contact,
            company: org,
            vrn: vrn,
            isBlacklisted: false,
            isGhost: false,
            status: 'ON SITE',
            visits: [{ date: todayDate, time_in: timeString, time_out: null, destination: dest }]
        });
    }
    
    alert(`Success. ${rawName} has been securely logged.`);
    
    // Clear form inputs
    document.getElementById('v-name').value = '';
    document.getElementById('v-id').value = '';
    document.getElementById('v-contact').value = '';
    document.getElementById('v-org').value = '';
    if (vrnElement) vrnElement.value = '';
    
    // Reset destination UI specifically
    const destInput = document.getElementById('v-destination');
    if(destInput) destInput.value = '';
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
    const todayStr = new Date().toISOString().split('T')[0];
    addVisitor({
        name: "VIP GUEST", 
        real_name: name,   
        company: "Confidential",
        type: "vip",
        isGhost: true,
        status: 'EXPECTED',
        visits: [{ date: todayStr, time_in: null, time_out: null, destination: "Confidential" }]
    });

    // 3. Re-render Tenant Dash to show the new VIP
    // populateTenantDashboard(); // Assuming you still have this function defined elsewhere or it's mocked
    console.log("Ghost Pass Generated and Logged to Database.");
}

function triggerSilentAlarm() {
    document.getElementById('silent-alarm-banner').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('silent-alarm-banner').classList.add('hidden');
    }, 4000);
}


// === 6. HISTORY TAB LOGIC ENGINE ===
let historyDate = new Date(); 

function changeHistoryDate(offset) {
    historyDate.setDate(historyDate.getDate() + offset);
    updateHistoryUI();
}

function updateHistoryUI() {
    const today = new Date();
    const displayEl = document.getElementById('history-date-display');
    
    if (historyDate.toDateString() === today.toDateString()) {
        displayEl.innerText = "Today";
    } else {
        displayEl.innerText = historyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    renderHistoryTable();
}

function renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return; // Fail gracefully if UI isn't loaded yet
    tbody.innerHTML = '';
    
    const searchInput = document.getElementById('history-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const targetDate = historyDate.toISOString().split('T')[0];
    const visitors = getGuardVisitors();
    
    let matches = visitors.filter(person => {
        const matchSearch = person.name.toLowerCase().includes(searchTerm) || 
                            (person.phone && person.phone.includes(searchTerm)) || 
                            (person.company && person.company.toLowerCase().includes(searchTerm));
        const hasVisitOnDate = person.visits && person.visits.some(visit => visit.date === targetDate);
        return matchSearch && hasVisitOnDate;
    });
    
    // --- THE FIX: Update the UI counter ---
    const countHeader = document.getElementById('history-total-count');
    if (countHeader) {
        const plural = matches.length === 1 ? '' : 's';
        countHeader.innerText = `${matches.length} Visitor${plural}`;
    }
    // --------------------------------------

    if (matches.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 40px;">No records found for this date.</td></tr>`;
        return;
    }

    matches.forEach(person => {
        tbody.innerHTML += `
            <tr onclick="openHistoryProfile('${person.id}')" style="cursor: pointer;">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar-circle">${person.name.charAt(0)}</div>
                        <strong>${person.name}</strong>
                    </div>
                </td>
                <td>${person.document_id || 'N/A'}</td>
                <td>${person.company || 'Walk-in'}</td>
                <td>${targetDate}</td>
            </tr>
        `;
    });
}

function openHistoryProfile(personId) {
    const person = getGuardVisitors().find(v => v.id === personId);
    if (!person) return;
    
    document.getElementById('history-main-list').classList.add('hidden');
    document.getElementById('history-profile-view').classList.remove('hidden');
    
    document.getElementById('hp-name').innerText = person.name;
    document.getElementById('hp-contact').innerText = person.phone || 'N/A';
    document.getElementById('hp-vrn').innerText = person.vrn || 'N/A';
    document.getElementById('hp-id').innerText = person.document_id || 'N/A';
    document.getElementById('hp-org').innerText = person.company || 'N/A';
    
    const visitsBody = document.getElementById('hp-visits-body');
    visitsBody.innerHTML = '';
    
    // Display all visits sorted by newest first
    const sortedVisits = [...(person.visits || [])].reverse();
    sortedVisits.forEach(visit => {
        visitsBody.innerHTML += `
            <tr>
                <td>${visit.date}</td>
                <td>${visit.destination || 'Unknown'}</td>
                <td>${visit.time_in || '-'}</td>
                <td>${visit.time_out || '-'}</td>
            </tr>
        `;
    });
}

function closeHistoryProfile() {
    document.getElementById('history-profile-view').classList.add('hidden');
    document.getElementById('history-main-list').classList.remove('hidden');
}

// === CUSTOM CALENDAR ENGINE ===
let currentCalDate = new Date(); // Tracks the month currently being viewed in the dropdown

function toggleCustomCalendar(e) {
    if(e) e.stopPropagation(); // Prevents this click from immediately closing the calendar
    const cal = document.getElementById('custom-calendar-dropdown');
    
    cal.classList.toggle('hidden');
    
    if (!cal.classList.contains('hidden')) {
        // When opening, reset the view to whatever date is currently selected in the app
        currentCalDate = new Date(historyDate); 
        renderCalendar();
    }
}

document.addEventListener('click', function(event) {
    const wrapper = document.getElementById('custom-date-wrapper');
    const cal = document.getElementById('custom-calendar-dropdown');
    
    // If the click happened outside the wrapper, hide the calendar
    if (wrapper && !wrapper.contains(event.target)) {
        cal.classList.add('hidden');
    }
});

function changeCalendarMonth(offset, e) {
    if(e) e.stopPropagation(); // Stop click from closing dropdown
    currentCalDate.setMonth(currentCalDate.getMonth() + offset);
    renderCalendar();
}

function renderCalendar() {
    const monthYear = document.getElementById('calendar-month-year');
    const grid = document.getElementById('calendar-days-grid');
    
    // Update Header
    monthYear.innerText = currentCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    grid.innerHTML = '';
    
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    
    // Figure out starting day and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Inject empty slots for days before the 1st
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="calendar-day empty"></div>`;
    }
    
    // Inject actual days
    for (let d = 1; d <= daysInMonth; d++) {
        // Check if this day is the currently selected historyDate
        const isSelected = (d === historyDate.getDate() && month === historyDate.getMonth() && year === historyDate.getFullYear());
        const selectedClass = isSelected ? 'selected' : '';
        
        grid.innerHTML += `<div class="calendar-day ${selectedClass}" onclick="selectCustomDate(${year}, ${month}, ${d}, event)">${d}</div>`;
    }
}

function selectCustomDate(year, month, day, e) {
    if(e) e.stopPropagation();
    
    // Set the main app date (Noon prevents weird timezone shifts pushing it a day back)
    historyDate = new Date(year, month, day, 12, 0, 0); 
    
    // Hide the dropdown calendar
    document.getElementById('custom-calendar-dropdown').classList.add('hidden');
    
    // Update the UI using your existing function!
    updateHistoryUI(); 
}

// --- DELIVERIES LOGIC ---

let activePackages = [];
let collectedPackages = [];
let packageCounter = 1; 
let activeTenantRequestSource = null; 

// 1. Open/Close General Modals
function openLogPackageModal() {
    const modal = document.getElementById('modal-log-package');
    modal.classList.remove('hidden'); 
    modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden'); 
    modal.style.display = 'none';
}

// 2. Open Specific Package Details Modal
function openPackageDetails(pkgId) {
    // Find the package in our array
    const pkg = activePackages.find(p => p.id === pkgId);
    if (!pkg) return;
    
    // Populate the profile card
    document.getElementById('detail-courier').innerText = pkg.courier;
    document.getElementById('detail-info').innerText = pkg.details;
    document.getElementById('detail-destination').innerText = pkg.destination;
    document.getElementById('detail-time').innerText = pkg.time;
    
    // Wire up the "Mark Collected" button on the profile card
    const collectBtn = document.getElementById('detail-btn-collect');
    collectBtn.onclick = function() {
        // Close profile card and open the handover form
        closeModal('modal-package-details');
        openCollectModal(pkg.id, pkg.courier);
    };
    
    // Show the profile card
    const modal = document.getElementById('modal-package-details');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

// 3. Action Buttons
function notifyRecipient() {
    // For now, this just shows an alert. Later it can trigger an email/SMS API.
    alert("Notification sent to the tenant!");
    closeModal('modal-package-details');
}

function openCollectModal(pkgId, courierName) {
    document.getElementById('collect-pkg-id').value = pkgId;
    document.getElementById('collect-pkg-name').innerText = `Handing over: ${courierName}`;
    
    const modal = document.getElementById('modal-mark-collected');
    modal.classList.remove('hidden'); 
    modal.style.display = 'flex';
}

// 4. Tenant Grid Logic
function openTenantGridFor(source) {
    activeTenantRequestSource = source;
    
    // Temporarily hide the active modal so the grid can take over
    if (source === 'package') {
        document.getElementById('modal-log-package').classList.add('hidden');
        document.getElementById('modal-log-package').style.display = 'none';
    } else if (source === 'collection') {
        document.getElementById('modal-mark-collected').classList.add('hidden');
        document.getElementById('modal-mark-collected').style.display = 'none';
    }

    const grid = document.getElementById('tenant-grid');
    grid.innerHTML = ''; 
    
    tenants.forEach(t => {
        grid.innerHTML += `
            <div class="tenant-card" onclick="selectTenant('${t.name}', this)">
                <div class="tenant-logo">${t.logo}</div>
                <div class="tenant-name">${t.name}</div>
            </div>
        `;
    });
    
    const directoryModal = document.getElementById('tenant-directory-modal');
    directoryModal.classList.remove('hidden');
    directoryModal.style.display = 'flex'; 
}

function closeTenantGrid() {
    document.getElementById('tenant-directory-modal').classList.add('hidden');
    document.getElementById('tenant-directory-modal').style.display = 'none';
}

function selectTenant(tenantName, element) {
    element.classList.add('selected-flash');
    
    setTimeout(() => {
        closeTenantGrid();
        
        if (activeTenantRequestSource === 'package') {
            document.getElementById('pkg-destination-display').innerText = tenantName;
            document.getElementById('pkg-destination-display').style.color = '#1e293b'; 
            document.getElementById('pkg-destination-value').value = tenantName;
            
            const pkgModal = document.getElementById('modal-log-package');
            pkgModal.classList.remove('hidden');
            pkgModal.style.display = 'flex';
            
        } else if (activeTenantRequestSource === 'collection') {
            document.getElementById('collect-tenant-display').innerText = tenantName;
            document.getElementById('collect-tenant-display').style.color = '#1e293b';
            document.getElementById('collect-tenant-value').value = tenantName;
            
            const collectModal = document.getElementById('modal-mark-collected');
            collectModal.classList.remove('hidden');
            collectModal.style.display = 'flex';
            
        } else {
            // VISITOR FLOW
            const destBox = document.getElementById('destination-selector');
            const destText = document.getElementById('destination-text');
            const destInput = document.getElementById('v-destination');
            
            if (destInput) destInput.value = tenantName; 
            if (destText) destText.innerText = tenantName; 
            if (destBox) destBox.classList.add('has-selection'); 
        }
        
        activeTenantRequestSource = null;
    }, 250);
}

// 5. Submit a New Package
function submitNewPackage() {
    const courier = document.getElementById('pkg-courier').value;
    const details = document.getElementById('pkg-details').value;
    const destination = document.getElementById('pkg-destination-value').value; 

    if (!courier || !details || !destination) {
        alert("Please fill in all package details and select a destination.");
        return;
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timestamp = `${dateString}, ${timeString}`;

    // Store properties individually for cleaner UI later
    const newPackage = {
        id: 'pkg-' + packageCounter++,
        courier: courier,
        details: details,
        destination: destination,
        time: timestamp
    };

    activePackages.push(newPackage);
    
    document.getElementById('pkg-courier').value = '';
    document.getElementById('pkg-details').value = '';
    document.getElementById('pkg-destination-value').value = '';
    document.getElementById('pkg-destination-display').innerText = '+ Select Destination Tenant';
    
    closeModal('modal-log-package');
    renderDeliveries();
}


// 6. Mark Package as Collected
function submitCollectedPackage() {
    const pkgId = document.getElementById('collect-pkg-id').value;
    const employeeName = document.getElementById('collect-employee-name').value;
    const tenant = document.getElementById('collect-tenant-value').value; 

    if (!employeeName || !tenant) {
        alert("Please enter the employee's name and select a company.");
        return;
    }

    const packageIndex = activePackages.findIndex(p => p.id === pkgId);
    if (packageIndex > -1) {
        const collectedPkg = activePackages.splice(packageIndex, 1)[0];
        collectedPkg.collectedBy = employeeName;
        collectedPkg.collectedTenant = tenant;
        
        const now = new Date();
        collectedPkg.collectedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // -----------------------------------------------

        collectedPackages.push(collectedPkg);
    }

    document.getElementById('collect-employee-name').value = '';
    document.getElementById('collect-tenant-value').value = '';
    document.getElementById('collect-tenant-display').innerText = '+ Select Company';
    
    closeModal('modal-mark-collected');
    renderDeliveries();
}

// 7. Render the UI
function renderDeliveries() {
    const awaitingList = document.getElementById('awaiting-pickup-list');
    const collectedList = document.getElementById('collected-history-list');

    awaitingList.innerHTML = '';
    collectedList.innerHTML = '';

   // Draw Awaiting Packages
    if (activePackages.length === 0) {
        awaitingList.innerHTML = '<tr><td colspan="3" style="padding: 16px; text-align: center; color: var(--text-muted);">No packages waiting.</td></tr>';
    } else {
        activePackages.forEach(pkg => {
            awaitingList.innerHTML += `
                <tr class="table-row-hover" onclick="openPackageDetails('${pkg.id}')">
                    <td style="padding: 16px 8px; color: var(--text-main);"><strong>${pkg.courier}</strong></td>
                    <td style="padding: 16px 8px; color: var(--text-main);">${pkg.destination}</td>
                    <td style="padding: 16px 8px; color: var(--text-muted);">${pkg.time}</td>
                </tr>
            `;
        });
    }

    // Draw Collected History
    if (collectedPackages.length === 0) {
        // Updated colspan to 3 to account for the new Time column
        collectedList.innerHTML = '<tr><td colspan="3" style="padding: 16px; text-align: center; color: var(--text-muted);">No collections today.</td></tr>';
    } else {
        collectedPackages.forEach(pkg => {
            collectedList.innerHTML += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 16px 8px; vertical-align: top;">
                        <strong style="color: var(--text-main);">${pkg.courier}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${pkg.details}</div>
                    </td>
                    <td style="padding: 16px 8px;">
                        <div style="font-weight: 600; color: var(--text-main);">${pkg.collectedBy}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${pkg.collectedTenant}</div>
                    </td>
                    <td style="padding: 16px 8px; color: var(--text-main);">
                        ${pkg.collectedTime}
                    </td>
                </tr>
            `;
        });
    }
}

// Run this once when the page loads
renderDeliveries();

// --- COMMUNICATE TAB LOGIC ---

let currentSystemTier = 3; 

const recentChats = [
    { id: 'c1', name: 'Sarah Jenkins', company: 'Stark Industries', lastMsg: 'I will be right down.', time: '10:42 AM' },
    { id: 'c2', name: 'Marcus Chen', company: 'Nexus Tech', lastMsg: 'Can you hold the package?', time: '09:15 AM' },
    { id: 'c3', name: 'Elena Rodriguez', company: 'Wayne Enterprises', lastMsg: 'Thanks, guard.', time: 'Yesterday' },
];

let activeChatId = null;

function initCommunicateTab() {
    const premiumElements = document.querySelectorAll('.premium-feature');
    premiumElements.forEach(el => {
        if (currentSystemTier === 1) {
            el.style.display = 'none';
        } else {
            el.style.display = el.id === 'quick-replies-bar' ? 'flex' : (el.id === 'btn-emergency-broadcast' ? 'flex' : 'inline-block');
        }
    });
    renderChatList();
}

function filterTenants() {
    // 1. Get the search text and convert to lowercase for easier matching
    const searchTerm = document.getElementById('comm-search-bar').value.toLowerCase();
    
    // 2. Loop through your chat data
    recentChats.forEach(chat => {
        const row = document.getElementById(`chat-row-${chat.id}`);
        
        if (row) {
            // Check if name or company includes the search term
            const matchesName = chat.name.toLowerCase().includes(searchTerm);
            const matchesCompany = chat.company.toLowerCase().includes(searchTerm);
            
            // 3. Show if it matches, hide if it doesn't
            if (matchesName || matchesCompany) {
                row.style.display = 'block';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

function renderChatList() {
    const listContainer = document.getElementById('chat-tenant-list');
    listContainer.innerHTML = '';

    recentChats.forEach(chat => {
        listContainer.innerHTML += `
            <div id="chat-row-${chat.id}" class="chat-list-item" onclick="selectChat('${chat.id}', '${chat.name}', '${chat.company}')">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                    <strong class="chat-name-text">${chat.name}</strong>
                    <span class="chat-time-text">${chat.time}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="chat-msg-text">${chat.lastMsg}</span>
                    <span class="chat-company-text">${chat.company}</span>
                </div>
            </div>
        `;
    });
}

function selectChat(id, name, company) {
    activeChatId = id;

    // Remove 'selected' class from all rows, add to the clicked one
    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('selected'));
    const selectedRow = document.getElementById(`chat-row-${id}`);
    if (selectedRow) selectedRow.classList.add('selected');

    // Update Header
    document.getElementById('active-chat-name').innerText = name;
    document.getElementById('active-chat-company').innerText = company;

    // Load Mock Messages using the new CSS classes
    const msgArea = document.getElementById('chat-messages-area');
    msgArea.innerHTML = `
        <div class="bubble-tenant">
            Are there any packages for me today?
        </div>
        <div class="bubble-guard">
            Yes, a FedEx box arrived 10 mins ago. I logged it in the system.
        </div>
        <div class="bubble-tenant">
            Perfect, ${recentChats.find(c => c.id === id).lastMsg}
        </div>
    `;
    
    msgArea.scrollTop = msgArea.scrollHeight;
}

function handleChatEnter(event) {
    if (event.key === 'Enter') sendChatMessage();
}

function sendQuickReply(text) {
    document.getElementById('chat-input-field').value = text;
    sendChatMessage();
}

function sendChatMessage() {
    if (!activeChatId) {
        alert("Please select a tenant from the list first.");
        return;
    }

    const input = document.getElementById('chat-input-field');
    const msgText = input.value.trim();
    if (!msgText) return;

    const msgArea = document.getElementById('chat-messages-area');
    
    // Add Guard's message using the orange bubble class
    msgArea.innerHTML += `<div class="bubble-guard">${msgText}</div>`;

    input.value = '';
    msgArea.scrollTop = msgArea.scrollHeight; 
}

// Run init
initCommunicateTab();

// --- EMERGENCY MODAL LOGIC ---

function openEmergencyModal() {
    // Show the modal by removing 'hidden' class (matching your existing modal logic)
    document.getElementById('modal-emergency').classList.remove('hidden');
    // Reset dropdown
    document.getElementById('emergency-type-select').value = ""; 
}

function closeEmergencyModal() {
    document.getElementById('modal-emergency').classList.add('hidden');
}

function sendEmergencyBroadcast() {
    const reason = document.getElementById('emergency-type-select').value;

    if (!reason) {
        alert("Please select a reason before sending.");
        return;
    }

    // Prototype confirmation
    alert(`🚨 EMERGENCY ALERT: "${reason}" broadcasted to all tenants successfully.`);
    closeEmergencyModal();
}

// Ensure the Emergency button has the trigger (add this to your init function)
document.getElementById('btn-emergency-broadcast').onclick = openEmergencyModal;

// --- SETTINGS / CONTROL CENTER LOGIC ---

function initSettingsTab() {
    // Safety check: Make sure a user is actually logged in before building settings
    if (!state.user || !state.user.role) {
        console.warn("No user logged in. Skipping settings initialization.");
        return; 
    }
    
    renderRoleSpecificSettings();
}

function renderRoleSpecificSettings() {
    const container = document.getElementById('role-specific-card');
    if (!container) return; // Prevent errors if HTML isn't loaded

    let htmlContent = '';

    // Automatically determine role based on login info!
    // Using .toLowerCase() just in case your DB returns "Guard" instead of "guard"
    const userRole = state.user.role.toLowerCase(); 

    switch(userRole) {
        case 'guard':
            htmlContent = `
                <h3>Guard Controls</h3>
                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-text">
                            <strong>Quick Reply Editor</strong>
                            <span>Customize the fast-reply chips in the Communicate tab.</span>
                        </div>
                    </div>
                    <button class="btn-settings-action">Edit Chips</button>
                </div>
            `;
            break;

        case 'tenant':
            htmlContent = `
                <h3>Tenant Privacy</h3>
                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-text">
                            <strong>Auto-Approve List</strong>
                            <span>Add regular visitors (e.g., family) to skip guard alerts.</span>
                        </div>
                    </div>
                    <button class="btn-settings-action">Manage Guests</button>
                </div>
            `;
            break;

        case 'hos':
            htmlContent = `
                <h3>Administrative Actions</h3>
                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-icon"></div>
                        <div class="setting-text">
                            <strong>System Audit Logs</strong>
                            <span>Access highly restricted entry history and guard activity.</span>
                        </div>
                    </div>
                    <button class="btn-settings-action" style="background: #dc2626;">View Logs</button>
                </div>
            `;
            break;
    }

    container.innerHTML = htmlContent;
}

// Simple Theme Toggle Logic
function toggleDarkMode() {
    const isDark = document.getElementById('setting-theme').checked;
    if (isDark) {
        document.body.classList.add('dark-mode');
        console.log("Obsidian Dark Mode: ON");
    } else {
        document.body.classList.remove('dark-mode');
        console.log("Light Mode: ON");
    }
}

// --- THEME TOGGLE LOGIC ---

function toggleDarkMode() {
    const isDark = document.getElementById('setting-theme').checked;
    
    if (isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('sentrihawk_theme', 'dark'); // Save preference
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('sentrihawk_theme', 'light'); // Save preference
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('sentrihawk_theme');
    const themeToggle = document.getElementById('setting-theme');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        // Make sure the UI toggle switch matches the saved state!
        if (themeToggle) themeToggle.checked = true; 
    }
}

/**
 * switchTenantView: Manages state-driven navigation for the Tenant Portal
 * @param {string} viewId - The DOM ID of the section to display
 * @param {HTMLElement} navElement - The clicked anchor tag (for UI styling)
 */
function switchTenantView(viewId, navElement = null) {
    // 1. UI Feedback: Update active state
    if (navElement) {
        document.querySelectorAll('#nav-tenant .nav-item').forEach(item => item.classList.remove('active'));
        navElement.classList.add('active');
    }

    // 2. State Cleanup: Hide all possible Tenant-specific views
    const allTenantViews = [
        'tenant-dashboard', 'tenant-pre-reg', 'tenant-history',
        'tenant-deliveries', 'tenant-communicate', 'settings-view',
        'tenant-calendar-view' 
    ];
    
    allTenantViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('view-hidden');
            el.classList.remove('view-active');
        }
    });

    // 3. View Activation
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('view-hidden');
        targetView.classList.add('view-active');
    }

    // 4. Controller Layer: Data Fetching & Rendering
    switch(viewId) {
        case 'tenant-dashboard':
            if (typeof updateTenantStats === 'function') updateTenantStats(); 
            break;
            
        case 'tenant-pre-reg':
            // Feature Gating based on Tier
            const tier = state.building?.tier || 1;
            const vipBtn = document.getElementById('btn-vip-register');
            if (vipBtn) vipBtn.style.display = tier >= 2 ? '' : 'none';
            break;

        case 'tenant-communicate':
            renderTenantChatList();
            break;
        
        case 'tenant-deliveries':
            renderTenantDeliveries();
            break;

        case 'tenant-history':
            renderTenantHistoryTable();
            break;

        case 'tenant-calendar-view': 
            if (typeof renderMainCalendar === 'function') renderMainCalendar();
            break;
    }
}

/**
 * Populates the Tenant Dashboard 
 * @param {string} filter - 'ALL', 'EXPECTED', 'ON_SITE', 'VIP', 'BLACKLIST'
 */
function populateTenantDashboard(filter = 'ALL') {
    // 1. Data Privacy Guardrail: Identify the current tenant
    const myTenantId = state.user.username; 
    
    // Defensive Programming: Failsafe in case state is corrupted
    if (!myTenantId) {
        console.error("Security Fault: No Tenant ID found in active state.");
        return;
    }

    // 2. Fetch fresh data directly from your unified storage function
    const allVisitors = getTenantVisitors(); 

    // 3. Data Isolation: Filter visitors strictly to my tenant's destination
    const myVisitors = allVisitors.filter(v => v.destination === myTenantId);
    // 3. Calculate Dashboard Statistics
    let expectedCount = 0;
    let onsiteCount = 0;
    let vipCount = 0;
    let blacklistCount = 0;

    myVisitors.forEach(v => {
        if (v.status === 'EXPECTED') expectedCount++;
        if (v.status === 'ON_SITE') onsiteCount++;
        if (v.isVIP) vipCount++;
        if (v.status === 'RESTRICTED' || v.isBlacklisted) blacklistCount++;
    });

    // Update DOM Stats Cards
    document.getElementById('tenant-stat-expected').textContent = expectedCount;
    document.getElementById('tenant-stat-onsite').textContent = onsiteCount;
    document.getElementById('tenant-stat-vip').textContent = vipCount;
    document.getElementById('tenant-stat-blacklist').textContent = blacklistCount;

    // 4. Apply Dynamic UI Filters
    let displayVisitors = myVisitors;
    const titleEl = document.getElementById('tenant-table-title');

    switch(filter) {
        case 'EXPECTED':
            displayVisitors = myVisitors.filter(v => v.status === 'EXPECTED');
            titleEl.textContent = "Expected Visitors";
            break;
        case 'ON_SITE':
            displayVisitors = myVisitors.filter(v => v.status === 'ON_SITE');
            titleEl.textContent = "Currently In Building";
            break;
        case 'VIP':
            displayVisitors = myVisitors.filter(v => v.isVIP);
            titleEl.textContent = "VIPs Arriving";
            break;
        case 'BLACKLIST':
            displayVisitors = myVisitors.filter(v => v.status === 'RESTRICTED' || v.isBlacklisted);
            titleEl.textContent = "Blacklist Alerts";
            break;
        default:
            titleEl.textContent = "Recent Activity";
            break;
    }

    // Sort by most recent entry
    displayVisitors.sort((a, b) => new Date(b.timeIn || b.date) - new Date(a.timeIn || a.date));

    // 5. Render the Table Rows
    const tbody = document.getElementById('tenant-overview-table');
    tbody.innerHTML = ''; // Clear previous

    if (displayVisitors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 20px;">No records found.</td></tr>`;
        return;
    }

    displayVisitors.forEach(v => {
        // Evaluate Status Badges
        let statusBadge = `<span class="status-tag" style="background: #e2e8f0; color: #475569;">Unknown</span>`;
        if (v.status === 'EXPECTED') statusBadge = `<span class="status-tag" style="background: #fef08a; color: black;">Expected</span>`;
        if (v.status === 'ON_SITE') statusBadge = `<span class="status-tag" style="background: #bbf7d0; color: #166534;">On Site</span>`;
        if (v.status === 'SIGNED_OUT') statusBadge = `<span class="status-tag" style="background: #e2e8f0; color: #475569;">Signed Out</span>`;
        if (v.status === 'RESTRICTED' || v.isBlacklisted) statusBadge = `<span class="status-tag text-danger" style="background: #fee2e2;">Restricted</span>`;

        const timeInStr = v.timeIn ? v.timeIn : '--:--';
        const timeOutStr = v.timeOut ? v.timeOut : '--:--';

        // Create and inject the table row
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500;">
                ${v.name} 
                ${v.isVIP ? '<span style="color: #eab308; margin-left: 5px; font-size: 0.8rem;">★ VIP</span>' : ''}
            </td>
            <td>${statusBadge}</td>
            <td>${timeInStr}</td>
            <td>${timeOutStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Wrapper function mapped to the onclick events in the HTML
function setTenantFilter(filterType) {
    populateTenantDashboard(filterType);
}
// === FULL PAGE CALENDAR ENGINE ===
let mainCalDate = new Date(); 
let currentViewMode = 'month'; 

function changeMainMonth(offset) {
    mainCalDate.setMonth(mainCalDate.getMonth() + offset);
    renderMainCalendar();
}

function resetMainToToday() {
    mainCalDate = new Date();
    renderMainCalendar();
}

// Passed the button element as 'btn' to avoid browser event bugs
function setCalView(viewType, btn) {
    currentViewMode = viewType;
    
    // Manage active states
    const btns = document.querySelectorAll('.cal-seg-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    if(viewType === 'month') {
        renderMainCalendar();
    } else {
        document.getElementById('tenant-calendar-grid').innerHTML = 
            `<div style="grid-column: span 7; padding: 20px; text-align: center; color: var(--text-muted); background: var(--bg-card); display: flex; align-items: center; justify-content: center;">${viewType.charAt(0).toUpperCase() + viewType.slice(1)} view coming soon!</div>`;
    }
}

function renderMainCalendar() {
    const title = document.getElementById('main-cal-title');
    const grid = document.getElementById('tenant-calendar-grid'); 
    
    if (!title || !grid) {
        console.error("SentriHawk Error: Could not find calendar title or grid elements.");
        return;
    }
    
    title.innerText = mainCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    grid.innerHTML = ''; // Clear out the grid
    
    const year = mainCalDate.getFullYear();
    const month = mainCalDate.getMonth();
    
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1; 
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(); 
    
    // 1. Draw empty padding days
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="main-cal-day empty"></div>`;
    }
    
    // 2. Draw actual month days
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const displayDay = isToday ? `<span class="today-circle">${d}</span>` : d;
        
        grid.innerHTML += `
            <div class="main-cal-day" onclick="alert('Clicked on ${month + 1}/${d}/${year}')">
                <span class="cal-day-number">${displayDay}</span>
            </div>
        `;
    }
}

// CALL IT IMMEDIATELY so it isn't a blank box on refresh
renderMainCalendar();

// === TENANT HISTORY STATE & ENGINE ===
let tHistoryDate = new Date(); 
let tCurrentCalDate = new Date(); 

function changeTenantHistoryDate(offset) {
    tHistoryDate.setDate(tHistoryDate.getDate() + offset);
    updateTenantHistoryUI();
}

function updateTenantHistoryUI() {
    const today = new Date();
    const displayEl = document.getElementById('t-history-date-display');
    
    if (tHistoryDate.toDateString() === today.toDateString()) {
        displayEl.innerText = "Today";
    } else {
        displayEl.innerText = tHistoryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    renderTenantHistoryTable();
}

function renderTenantHistoryTable() {
    const tbody = document.getElementById('t-history-table-body');
    if (!tbody) return; 
    tbody.innerHTML = '';
    
    const searchInput = document.getElementById('t-history-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const targetDate = tHistoryDate.toISOString().split('T')[0];
    const visitors = getGuardVisitors();
    
    const currentTenantId = state.user.username; // Security Scope
    
    let matches = visitors.filter(person => {
        // 1. SEARCH FILTER
        const matchSearch = person.name.toLowerCase().includes(searchTerm) || 
                            (person.phone && person.phone.includes(searchTerm));
                            
        // 2. SECURITY & DATE FILTER: Did they visit THIS tenant on THIS date?
        const hasValidVisit = person.visits && person.visits.some(visit => 
            visit.date === targetDate && visit.destination === currentTenantId
        );
        
        return matchSearch && hasValidVisit;
    });
    
    // Update the UI counter
    const countHeader = document.getElementById('t-history-total-count');
    if (countHeader) {
        const plural = matches.length === 1 ? '' : 's';
        countHeader.innerText = `${matches.length} Visitor${plural}`;
    }

    if (matches.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 40px;">No records found for this date.</td></tr>`;
        return;
    }

    matches.forEach(person => {
        // Find the specific visit data for today to show time in/out
        const todaysVisit = person.visits.find(v => v.date === targetDate && v.destination === currentTenantId) || {};

        tbody.innerHTML += `
            <tr onclick="openTenantHistoryProfile('${person.id}')" style="cursor: pointer;">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar-circle">${person.name.charAt(0)}</div>
                        <strong>${person.name}</strong>
                    </div>
                </td>
                <td>${person.document_id || 'N/A'}</td>
                <td>${todaysVisit.time_in || '--:--'}</td>
                <td>${todaysVisit.time_out || '--:--'}</td>
            </tr>
        `;
    });
}

// === TENANT PROFILE VIEW ===
function openTenantHistoryProfile(personId) {
    const person = getGuardVisitors().find(v => v.id === personId);
    if (!person) return;
    
    document.getElementById('t-history-main-list').classList.add('hidden');
    document.getElementById('t-history-profile-view').classList.remove('hidden');
    
    document.getElementById('t-hp-name').innerText = person.name;
    document.getElementById('t-hp-contact').innerText = person.phone || 'N/A';
    document.getElementById('t-hp-vrn').innerText = person.vrn || 'N/A';
    document.getElementById('t-hp-id').innerText = person.document_id || 'N/A';
    
    const visitsBody = document.getElementById('t-hp-visits-body');
    visitsBody.innerHTML = '';
    
    // SECURITY FILTER: Only show visits related to this tenant!
    const tenantVisits = [...(person.visits || [])]
        .filter(visit => visit.destination === state.user.username)
        .reverse();

    tenantVisits.forEach(visit => {
        visitsBody.innerHTML += `
            <tr>
                <td>${visit.date}</td>
                <td>${visit.time_in || '-'}</td>
                <td>${visit.time_out || '-'}</td>
            </tr>
        `;
    });
}

function closeTenantHistoryProfile() {
    document.getElementById('t-history-profile-view').classList.add('hidden');
    document.getElementById('t-history-main-list').classList.remove('hidden');
}

// === TENANT CALENDAR ENGINE ===
function toggleTenantCustomCalendar(e) {
    if(e) e.stopPropagation(); 
    const cal = document.getElementById('t-custom-calendar-dropdown');
    cal.classList.toggle('hidden');
    if (!cal.classList.contains('hidden')) {
        tCurrentCalDate = new Date(tHistoryDate); 
        renderTenantCalendar();
    }
}

// Ensure clicking outside closes the tenant calendar
document.addEventListener('click', function(event) {
    const wrapper = document.getElementById('t-custom-date-wrapper');
    const cal = document.getElementById('t-custom-calendar-dropdown');
    if (wrapper && !wrapper.contains(event.target) && cal) {
        cal.classList.add('hidden');
    }
});

function changeTenantCalendarMonth(offset, e) {
    if(e) e.stopPropagation(); 
    tCurrentCalDate.setMonth(tCurrentCalDate.getMonth() + offset);
    renderTenantCalendar();
}

function renderTenantCalendar() {
    const monthYear = document.getElementById('t-calendar-month-year');
    const grid = document.getElementById('t-calendar-days-grid');
    
    monthYear.innerText = tCurrentCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    grid.innerHTML = '';
    
    const year = tCurrentCalDate.getFullYear();
    const month = tCurrentCalDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="calendar-day empty"></div>`;
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
        const isSelected = (d === tHistoryDate.getDate() && month === tHistoryDate.getMonth() && year === tHistoryDate.getFullYear());
        const selectedClass = isSelected ? 'selected' : '';
        grid.innerHTML += `<div class="calendar-day ${selectedClass}" onclick="selectTenantCustomDate(${year}, ${month}, ${d}, event)">${d}</div>`;
    }
}

function selectTenantCustomDate(year, month, day, e) {
    if(e) e.stopPropagation();
    tHistoryDate = new Date(year, month, day, 12, 0, 0); 
    document.getElementById('t-custom-calendar-dropdown').classList.add('hidden');
    updateTenantHistoryUI(); 
}

// === TENANT DELIVERIES LOGIC ===

function renderTenantDeliveries() {
    const awaitingList = document.getElementById('t-awaiting-pickup-list');
    const collectedList = document.getElementById('t-collected-history-list');

    if (!awaitingList || !collectedList) return;

    awaitingList.innerHTML = '';
    collectedList.innerHTML = '';

    // Security Scope: Only fetch packages matching this tenant's ID/Name
    // Make sure 'destination' from the guard dropdown matches how you store state.user.username
    const myTenantId = state.user.username; 

    // 1. Filter and Draw Awaiting Packages
    const myActivePackages = activePackages.filter(pkg => pkg.destination === myTenantId);

    if (myActivePackages.length === 0) {
        awaitingList.innerHTML = '<tr><td colspan="3" style="padding: 16px; text-align: center; color: var(--text-muted);">You have no packages waiting at reception.</td></tr>';
    } else {
        myActivePackages.forEach(pkg => {
            awaitingList.innerHTML += `
                <tr class="table-row-hover">
                    <td style="padding: 16px 8px; color: var(--text-main);"><strong>${pkg.courier}</strong></td>
                    <td style="padding: 16px 8px; color: var(--text-muted);">${pkg.details || 'N/A'}</td>
                    <td style="padding: 16px 8px; color: var(--text-main); font-weight: 500;">${pkg.time}</td>
                </tr>
            `;
        });
    }

    // 2. Filter and Draw Collected History
    // Check both destination and collectedTenant depending on how the Guard assigned it
    const myCollectedPackages = collectedPackages.filter(pkg => 
        pkg.destination === myTenantId || pkg.collectedTenant === myTenantId
    );

    if (myCollectedPackages.length === 0) {
        collectedList.innerHTML = '<tr><td colspan="3" style="padding: 16px; text-align: center; color: var(--text-muted);">No collections logged today.</td></tr>';
    } else {
        myCollectedPackages.forEach(pkg => {
            collectedList.innerHTML += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 16px 8px; vertical-align: top;">
                        <strong style="color: var(--text-main);">${pkg.courier}</strong>
                    </td>
                    <td style="padding: 16px 8px;">
                        <div style="font-weight: 600; color: var(--text-main);">${pkg.collectedBy}</div>
                    </td>
                    <td style="padding: 16px 8px; color: var(--text-main);">
                        ${pkg.collectedTime}
                    </td>
                </tr>
            `;
        });
    }
}


// === TENANT COMMUNICATE LOGIC ===

const tenantChats = [
    { id: 'tc1', name: 'P. Karonjoto', role: 'Current Guard', lastMsg: 'Your visitor is waiting at the lobby.', time: '10:42 AM' },
    { id: 'tc2', name: 'Head Of Security', role: 'Property Admin', lastMsg: 'The plumber will arrive at 2 PM.', time: 'Yesterday' },
    { id: 'tc3', name: 'J. Chimbetu', role: 'Non-Active', lastMsg: 'Package held overnight.', time: 'Tuesday' },
];

let tActiveChatId = null;

function renderTenantChatList() {
    const listContainer = document.getElementById('t-chat-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    tenantChats.forEach(chat => {
        // Visually pin/highlight the active front desk guard
        const isPinned = chat.id === 'tc1' ? 'border-left: 3px solid var(--primary-action);' : '';

        listContainer.innerHTML += `
            <div id="t-chat-row-${chat.id}" class="chat-list-item" style="${isPinned}" onclick="selectTenantChat('${chat.id}', '${chat.name}', '${chat.role}')">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                    <strong class="chat-name-text">${chat.name}</strong>
                    <span class="chat-time-text">${chat.time}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span class="chat-msg-text">${chat.lastMsg}</span>
                    <span class="chat-company-text">${chat.role}</span>
                </div>
            </div>
        `;
    });
}

function filterTenantChats() {
    const searchTerm = document.getElementById('t-comm-search-bar').value.toLowerCase();
    
    tenantChats.forEach(chat => {
        const row = document.getElementById(`t-chat-row-${chat.id}`);
        if (row) {
            const matchesName = chat.name.toLowerCase().includes(searchTerm);
            const matchesRole = chat.role.toLowerCase().includes(searchTerm);
            row.style.display = (matchesName || matchesRole) ? 'block' : 'none';
        }
    });
}

function handleTenantChatEnter(event) {
    if (event.key === 'Enter') sendTenantChatMessage();
}

function sendTenantQuickReply(text) {
    document.getElementById('t-chat-input-field').value = text;
    sendTenantChatMessage();
}

function selectTenantChat(id, name, role) {
    tActiveChatId = id;

    // Toggle active selection state
    document.querySelectorAll('#t-chat-list .chat-list-item').forEach(el => el.classList.remove('selected'));
    const selectedRow = document.getElementById(`t-chat-row-${id}`);
    if (selectedRow) selectedRow.classList.add('selected');

    document.getElementById('t-active-chat-name').innerText = name;
    document.getElementById('t-active-chat-role').innerText = role;

    const msgArea = document.getElementById('t-chat-messages-area');
    
    // STRICT COPY of the Guard layout: 
    // bubble-tenant = Incoming/Left Side (Guard speaking to Tenant)
    // bubble-guard = Outgoing/Right Side (Tenant replying)
    msgArea.innerHTML = `
        <div class="bubble-tenant">
            Hello, please let us know if you need any assistance today.
        </div>
        <div class="bubble-guard">
            Thank you, will do.
        </div>
        <div class="bubble-tenant">
            ${tenantChats.find(c => c.id === id).lastMsg}
        </div>
    `;
    
    msgArea.scrollTop = msgArea.scrollHeight;
}

function sendTenantChatMessage() {
    if (!tActiveChatId) {
        alert("Please select a conversation from the list first.");
        return;
    }

    const input = document.getElementById('t-chat-input-field');
    const msgText = input.value.trim();
    if (!msgText) return;

    const msgArea = document.getElementById('t-chat-messages-area');
    
    // STRICT COPY: Using bubble-guard so the sent message pops up on the RIGHT side
    msgArea.innerHTML += `<div class="bubble-guard">${msgText}</div>`;

    input.value = '';
    msgArea.scrollTop = msgArea.scrollHeight; 
}

// === EMERGENCY ALERT LOGIC ===

function openTenantEmergencyModal() {
    document.getElementById('t-modal-emergency').classList.remove('hidden');
}

function closeTenantEmergencyModal() {
    document.getElementById('t-modal-emergency').classList.add('hidden');
    document.getElementById('t-emergency-type-select').value = ""; // Reset dropdown
}

function sendTenantEmergency() {
    const select = document.getElementById('t-emergency-type-select');
    const emergencyType = select.value;
    
    if (!emergencyType) {
        alert("Please select the type of emergency.");
        return;
    }
    
    // 1. Close the tenant modal
    closeTenantEmergencyModal();  
}

// ==========================================
// HOS VIEW CONTROLLER
// ==========================================
function switchHOSView(viewId, navElement = null) {
    // 1. UI Feedback: Update active state on the sidebar
    if (navElement) {
        // Feature Flag Check: Prevent clicking if tier-locked
        if (navElement.classList.contains('tier-locked')) {
            alert("Upgrade Required: This feature is not available on your current building tier.");
            return; 
        }
        document.querySelectorAll('#nav-hos .nav-item').forEach(item => item.classList.remove('active'));
        navElement.classList.add('active');
    }

    // 2. State Cleanup: Hide all possible HOS-specific views
    const allHOSViews = [
        'hos-dashboard', 'hos-analytics', 'hos-surveillance', 
        'hos-watchlist', 'hos-audit', 'settings-view'
    ];
    
    allHOSViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('view-hidden');
            el.classList.remove('view-active');
        }
    });

    // 3. View Activation
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('view-hidden');
        targetView.classList.add('view-active');
    }

    // 4. Data Routing
    switch(viewId) {
        case 'hos-dashboard':
            renderHOSDashboard(); 
            break;
        case 'hos-analytics':
            renderHOSAnalytics(); 
            break;
        case 'hos-surveillance':
            renderHOSSurveillance();
            break;
        case 'hos-watchlist':
            renderHOSWatchlist(); 
            break;
        case 'hos-audit': renderUnifiedAudit(); break;
    }
}

// === HOS DASHBOARD STATE ===
let currentHOSFilter = 'ALL';

function setHOSFilter(filter) {
    currentHOSFilter = filter;
    
    // Optional: Update the Activity Feed Title dynamically
    const feedTitle = document.getElementById('hos-feed-title'); 
    if (feedTitle) {
        if (filter === 'EXPECTED') feedTitle.innerText = 'Expected Arrivals Feed';
        else if (filter === 'ON_SITE') feedTitle.innerText = 'On-Premises Feed';
        else if (filter === 'INCIDENTS') feedTitle.innerText = 'Security Alerts Feed';
        else feedTitle.innerText = 'Live Activity Feed';
    }
    
    renderHOSDashboard(); // Redraw with the new filter
}

// The HOS Filter Controller
function setHOSFilter(filter) {
    currentHOSFilter = filter;
    
    const titleEl = document.getElementById('hos-feed-title');
    
    // Dynamically change the Feed title based on the active KPI filter
    if (titleEl) {
        if (filter === 'EXPECTED') {
            titleEl.innerText = 'Expected Arrivals Feed';
        } else if (filter === 'ON_SITE') {
            titleEl.innerText = 'Currently On-Premises';
        } else if (filter === 'INCIDENTS') {
            titleEl.innerText = 'Security Alerts Feed';
        } else {
            titleEl.innerText = 'Live Activity Feed';
        }
    }
    
    // Redraw the dashboard to apply the filter logic you already built inside renderHOSDashboard
    renderHOSDashboard(); 
}

function renderHOSDashboard() {
    console.log("Rendering HOS Dashboard...");
    
    const tierDisplay = document.getElementById('hos-tier-display');
    const tier = state.building?.tier || 1;
    if (tierDisplay) tierDisplay.textContent = tier;

    // SINGLE SOURCE OF TRUTH: Fetch the exact same data the Guard uses
    const visitors = getGuardVisitors(); 
    
    // --- 1. THE MATH ENGINE (O(N) Complexity) ---
    let expectedCount = 0;
    let onSiteCount = 0;
    let incidentCount = 0;

    visitors.forEach(v => {
        const currentStatus = v.status || (v.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
        
        if (currentStatus === 'EXPECTED') expectedCount++;
        if (currentStatus === 'ON SITE' || currentStatus === 'ON_SITE') onSiteCount++;
        
        // Security logic: Any blacklisted or restricted entity is an alert
        if (v.isBlacklisted || currentStatus === 'FLAGGED' || currentStatus === 'RESTRICTED') incidentCount++;
    });

    // Update KPI DOM Elements
    const kpiActive = document.getElementById('hos-kpi-active');
    const kpiExpected = document.getElementById('hos-kpi-expected');
    const kpiAlerts = document.getElementById('hos-kpi-alerts');
    
    if (kpiActive) kpiActive.textContent = onSiteCount;
    if (kpiExpected) kpiExpected.textContent = expectedCount;
    if (kpiAlerts) kpiAlerts.textContent = incidentCount;

    // --- 2. POPULATE LIVE ACTIVITY FEED (With Filtering) ---
    const feedContainer = document.getElementById('hos-activity-feed');
    if (feedContainer) {
        feedContainer.innerHTML = ''; 
        
        let displayEvents = visitors.slice().reverse(); // Show newest first
        
        // Apply the active click filter from the KPIs
        if (currentHOSFilter === 'EXPECTED') {
            displayEvents = displayEvents.filter(v => (v.status || (v.isBlacklisted ? 'FLAGGED' : 'EXPECTED')) === 'EXPECTED');
        } else if (currentHOSFilter === 'ON_SITE') {
            displayEvents = displayEvents.filter(v => v.status === 'ON SITE' || v.status === 'ON_SITE');
        } else if (currentHOSFilter === 'INCIDENTS') {
            displayEvents = displayEvents.filter(v => v.isBlacklisted || v.status === 'FLAGGED');
        }
        
        // Windowing: Only show top 15 to prevent DOM bloat
        displayEvents = displayEvents.slice(0, 15);

        if (displayEvents.length === 0) {
            feedContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 20px;">No activity matches this filter.</p>';
        } else {
            displayEvents.forEach(visitor => {
                const eventDiv = document.createElement('div');
                eventDiv.style.cssText = "padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; gap: 10px; align-items: start;";
                
                const currentStatus = visitor.status || (visitor.isBlacklisted ? 'FLAGGED' : 'EXPECTED');
                
                // Determine icon based on status
                let icon = '🟢'; // Default / On Site
                if (currentStatus === 'EXPECTED') icon = '🟡';
                if (currentStatus === 'SIGNED_OUT' || currentStatus === 'CHECKED OUT') icon = '⚪';
                if (visitor.isBlacklisted || currentStatus === 'FLAGGED') icon = '🔴';

                // Format time string
                const timeStr = visitor.timeIn || (visitor.visits && visitor.visits.length > 0 ? visitor.visits[visitor.visits.length - 1].time_in : 'Pending');
                
                eventDiv.innerHTML = `
                    <div style="font-size: 1.2rem;">${icon}</div>
                    <div>
                        <div style="color: var(--text-main); font-weight: 600; font-size: 0.95rem;">
                            ${visitor.isGhost ? "VIP GUEST" : (visitor.name || 'Unknown')} 
                            <span style="font-weight: 400; font-size: 0.85rem; color: var(--text-muted);">is ${currentStatus.toLowerCase()}</span>
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">
                            Destination: ${visitor.company || 'Unknown'} • Time: ${timeStr}
                        </div>
                    </div>
                `;
                feedContainer.appendChild(eventDiv);
            });
        }
    }
    
   // ==========================================
    // 2. POPULATE PRIORITY QUEUE
    // ==========================================
    const queueContainer = document.getElementById('hos-priority-queue');
    if (queueContainer) {
        // Fetch the sorted, weighted array of active alerts
        const activeAlerts = generatePriorityAlerts(tier);
        
        // UPDATE THE KPI COUNTER: Sync the visual number with the actual active alerts!
        const kpiAlerts = document.getElementById('hos-kpi-alerts');
        if (kpiAlerts) kpiAlerts.textContent = activeAlerts.length;

        queueContainer.innerHTML = ''; // Clear existing

        if (activeAlerts.length === 0) {
            queueContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 10px;">
                    <span style="font-size: 2.5rem; opacity: 0.3;">🛡️</span>
                    <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 500;">No active threats detected.</p>
                    <p style="color: var(--text-muted); font-size: 0.8rem; opacity: 0.7;">System operating within normal parameters.</p>
                </div>
            `;
        } else {
            // Render the sorted alerts
            activeAlerts.forEach(alert => {
                const alertDiv = document.createElement('div');
                alertDiv.style.cssText = `padding: 15px; border-bottom: 1px solid ${alert.color}; background-color: ${alert.bg}; transition: all 0.3s ease;`;
                
                alertDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="color: ${alert.color}; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.5px;">${alert.title}</span>
                        <span style="color: var(--text-muted); font-size: 0.75rem; font-weight: 600;">${alert.time}</span>
                    </div>
                    <div style="color: var(--text-main); font-size: 0.95rem; margin-bottom: 12px; line-height: 1.4;">
                        ${alert.message}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="dismissHOSAlert('${alert.id}')" class="btn-primary" style="background-color: ${alert.color}; border: none; padding: 6px 12px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
                            ${alert.severity === 4 ? 'DISPATCH ESCORT' : 'DISPATCH GUARD'}
                        </button>
                        <button onclick="dismissHOSAlert('${alert.id}')" style="background-color: transparent; border: 1px solid var(--text-muted); color: var(--text-muted); padding: 6px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border-radius: 6px;">
                            DISMISS
                        </button>
                    </div>
                `;
                queueContainer.appendChild(alertDiv);
            });
        }
    }
}

// Set to track IDs of alerts the HOS has resolved/dismissed
const dismissedHOSAlerts = new Set();
function generatePriorityAlerts(tier) {
    let alerts = [];
    const visitors = getGuardVisitors();

    // 1. DYNAMIC ALERTS: Watchlist & Ghost Protocol (from Database)
    visitors.forEach(v => {
        // Only show alerts if they haven't been dismissed
        if (v.isBlacklisted && !dismissedHOSAlerts.has(`acl_${v.id}`)) {
            alerts.push({
                id: `acl_${v.id}`,
                severity: 2,
                title: "⚠️ ACL MATCH DETECTED",
                message: `Facial geometry match for restricted entity: <b>${v.name}</b> at Main Checkpoint.`,
                time: v.timeIn || "Just now",
                color: "var(--danger)",
                bg: "rgba(239, 68, 68, 0.05)"
            });
        }
        
        // VIP Ghost Protocol Arrivals (Only if they are ON SITE)
        const status = v.status || "EXPECTED";
        if (v.isGhost && (status === "ON SITE" || status === "ON_SITE") && !dismissedHOSAlerts.has(`vip_${v.id}`)) {
            alerts.push({
                id: `vip_${v.id}`,
                severity: 4,
                title: "💎 GHOST PROTOCOL ARRIVAL",
                message: `VIP Guest requires immediate discrete escort to ${v.company || 'Host'}.`,
                time: v.timeIn || "Just now",
                color: "#3b82f6", // Blue
                bg: "rgba(59, 130, 246, 0.05)"
            });
        }
    });

    // 2. HARDCODED ALERTS: Hardware Failures & Panic Alarms
    // We only inject these to demonstrate system capabilities (especially for higher tiers)
    if (!dismissedHOSAlerts.has('panic_mock_1')) {
        alerts.push({
            id: 'panic_mock_1',
            severity: 1, // HIGHEST PRIORITY
            title: "🚨 TENANT PANIC ALARM",
            message: "<b>Romaine Joni</b> triggered an 'Intruder' alert in Suite 402.",
            time: "1 min ago",
            color: "#b91c1c", // Dark Red
            bg: "rgba(185, 28, 28, 0.1)"
        });
    }

    if (tier >= 2 && !dismissedHOSAlerts.has('hw_mock_1')) {
        alerts.push({
            id: 'hw_mock_1',
            severity: 3,
            title: "⚙️ HARDWARE ANOMALY",
            message: "Gate 3 turnstile motor unresponsive. Failsafe activated (Locked).",
            time: "14 mins ago",
            color: "var(--primary-action)", // Orange
            bg: "rgba(234, 88, 12, 0.05)"
        });
    }

    // 3. THE SORTING ALGORITHM (O(N log N) Complexity)
    // Sort ascending by severity (1 is first, 4 is last)
    alerts.sort((a, b) => a.severity - b.severity);

    return alerts;
}

// Action Controller: Handles dismissing an alert
function dismissHOSAlert(alertId) {
    dismissedHOSAlerts.add(alertId);
    renderHOSDashboard(); // Redraw the dashboard to remove it
}

// ==========================================
// HOS ANALYTICS: MOCK DATA & STATE
// ==========================================
let trafficChartInstance = null;
let tenantChartInstance = null;
let peakChartInstance = null;
let incidentChartInstance = null;

// The static labels for the charts
const topTenantsLabels = ['Wayne Enterprises', 'Stark Industries', 'Daily Bugle', 'Oscorp', 'Other'];
const peakTimeLabels = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
const incidentLabels = ['Tailgating', 'Banned Entity Match', 'Hardware Failure', 'Manual Override', 'Panic Alarm'];

const analyticsData = {
    '24H': {
        vol: 184, volChange: '+12% vs yesterday', volColor: 'var(--success)',
        inc: 2, incChange: 'No change vs yesterday', incColor: 'var(--text-muted)',
        time: '32s', watchlist: 45,
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        traffic: [5, 12, 65, 42, 45, 15],
        tenantData: [65, 45, 30, 24, 20],
        peakData: [2, 45, 25, 38, 20, 30, 15, 9],
        incidentData: [1, 0, 0, 1, 0]
    },
    '7D': {
        vol: 1420, volChange: '+5% vs last week', volColor: 'var(--success)',
        inc: 12, incChange: '-2 vs last week', incColor: 'var(--success)',
        time: '38s', watchlist: 45,
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        traffic: [190, 210, 205, 230, 245, 80, 60],
        tenantData: [520, 380, 210, 190, 120],
        peakData: [15, 280, 150, 210, 140, 190, 65, 20],
        incidentData: [5, 2, 1, 4, 0]
    },
    '30D': {
        vol: 6840, volChange: '-2% vs last month', volColor: 'var(--danger)',
        inc: 91, incChange: '+3 vs last month', incColor: 'var(--danger)',
        time: '45s', watchlist: 46,
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        traffic: [1600, 1750, 1680, 1810],
        tenantData: [2100, 1800, 1200, 950, 790],
        peakData: [45, 1150, 650, 890, 580, 720, 210, 85],
        incidentData: [24, 8, 15, 42, 2]
    },
    '6M': {
        vol: 22400, volChange: '+15% vs prev 6 months', volColor: 'var(--success)',
        inc: 285, incChange: '-10 vs prev 6 months', incColor: 'var(--success)',
        time: '42s', watchlist: 52,
        labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
        traffic: [6800, 7100, 6200, 7400, 7800, 7200],
        tenantData: [14500, 11200, 8100, 5200, 3500],
        peakData: [150, 3800, 2100, 2900, 1850, 2400, 800, 280],
        incidentData: [75, 28, 42, 110, 10]
    },
    'YTD': {
        vol: 42345, volChange: '+8% vs last YTD', volColor: 'var(--success)',
        inc: 465, incChange: '-4 vs last YTD', incColor: 'var(--success)',
        time: '40s', watchlist: 57,
        labels: ['Jan', 'Feb', 'Mar'],
        traffic: [7400, 7800, 7200],
        tenantData: [8200, 5800, 4100, 2500, 1800],
        peakData: [280, 7500, 4200, 5800, 3900, 4800, 1400, 520],
        incidentData: [140, 52, 85, 190, 18]
    }
};

// ==========================================
// HOS ANALYTICS: RENDERERS
// ==========================================

function renderHOSAnalytics() {
    // Default load is 30 Days
    const defaultTab = document.querySelector('.time-filter:nth-child(3)');
    updateAnalyticsTimeframe('30D', defaultTab);
}

// Controller for the Date Range Picker
function updateAnalyticsTimeframe(range, element) {
    if (element) {
        document.querySelectorAll('.time-filter').forEach(el => {
            el.style.background = 'transparent';
            el.style.color = 'var(--text-muted)';
        });
        element.style.background = 'var(--primary-action)';
        element.style.color = 'white';
    }

    const data = analyticsData[range];

    // Update KPI DOM Elements
    document.getElementById('analytics-kpi-vol').textContent = data.vol.toLocaleString();
    const volChange = document.getElementById('analytics-kpi-vol-change');
    volChange.textContent = data.volChange;
    volChange.style.color = data.volColor;

    document.getElementById('analytics-kpi-incidents').textContent = data.inc.toLocaleString();
    const incChange = document.getElementById('analytics-kpi-incidents-change');
    incChange.textContent = data.incChange;
    incChange.style.color = data.incColor;

    document.getElementById('analytics-kpi-time').textContent = data.time;
    document.getElementById('analytics-kpi-watchlist').textContent = data.watchlist;

    // Render ALL Charts with the selected timeframe's data
    renderTrafficChart(data.labels, data.traffic);
    renderTenantPieChart(data.tenantData);
    renderBottomAnalyticsCharts(data.peakData, data.incidentData);
}

// 1. Draw Line Chart (Traffic)
function renderTrafficChart(labels, dataPoints) {
    const ctx = document.getElementById('trafficLineChart').getContext('2d');
    if (trafficChartInstance) trafficChartInstance.destroy();

    trafficChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Visitor Footfall',
                data: dataPoints,
                borderColor: '#EA580C', 
                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
        }
    });
}

// 2. Draw Pie Chart (Tenants)
function renderTenantPieChart(dataPoints) {
    const ctx = document.getElementById('tenantPieChart').getContext('2d');
    if (tenantChartInstance) tenantChartInstance.destroy();

    tenantChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: topTenantsLabels,
            datasets: [{
                data: dataPoints,
                backgroundColor: ['#3b82f6', '#EA580C', '#10B981', '#8B5CF6', '#64748B'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { family: "'Inter', sans-serif" } } } }
        }
    });
}

// 3. Draw Bottom Row Bar Charts (Peak Traffic & Incidents)
function renderBottomAnalyticsCharts(peakData, incidentData) {
    // Peak Times Bar Chart (Vertical)
    const ctxPeak = document.getElementById('peakTimesChart');
    if (ctxPeak) {
        if (peakChartInstance) peakChartInstance.destroy(); 
        
        peakChartInstance = new Chart(ctxPeak, {
            type: 'bar',
            data: {
                labels: peakTimeLabels,
                datasets: [{
                    label: 'Average Visitor Volume',
                    data: peakData,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 4, barPercentage: 0.6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(100, 116, 139, 0.1)' } }, x: { grid: { display: false } } }
            }
        });
    }

    // Incident Breakdown Chart (Horizontal)
    const ctxIncident = document.getElementById('incidentBreakdownChart');
    if (ctxIncident) {
        if (incidentChartInstance) incidentChartInstance.destroy(); 
        
        incidentChartInstance = new Chart(ctxIncident, {
            type: 'bar',
            data: {
                labels: incidentLabels,
                datasets: [{
                    label: 'Occurrences',
                    data: incidentData,
                    backgroundColor: ['#eab308', '#ef4444', '#f97316', '#3b82f6', '#991b1b'],
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', // Flips it horizontal
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, grid: { color: 'rgba(100, 116, 139, 0.1)' } }, y: { grid: { display: false } } }
            }
        });
    }
}

// ==========================================
// HOS SURVEILLANCE: MOCK AI ENGINE & STATE
// ==========================================
const CAMERAS = [
    { id: 'CAM-01', name: 'Main Lobby North', scanner: true },
    { id: 'CAM-02', name: 'Main Lobby South', scanner: false },
    { id: 'CAM-03', name: 'Turnstile Bank A', scanner: true },
    { id: 'CAM-04', name: 'Turnstile Bank B', scanner: false },
    { id: 'CAM-05', name: 'Elevator Lobby', scanner: true },
    { id: 'CAM-06', name: 'Loading Bay', scanner: false },
    { id: 'CAM-07', name: 'Perimeter West', scanner: false },
    { id: 'CAM-08', name: 'Garage Entry', scanner: false }
];

let telemetryInterval = null;

function renderHOSSurveillance() {
    const grid = document.getElementById('surveillance-grid');
    if (!grid) return;
    
    // 1. Build the Camera Grid
    grid.innerHTML = '';
    CAMERAS.forEach(cam => {
        // We randomly add an 'alert-active' class to CAM-03 to simulate a detection
        const isAlert = cam.id === 'CAM-03' ? 'alert-active' : '';
        const alertTag = isAlert ? `<div class="cam-tag" style="background: var(--danger); color: white;">FACIAL REC MATCH</div>` : '';
        const scannerHtml = cam.scanner ? `<div class="cam-scanner"></div>` : '';
        
        const camHtml = `
            <div class="cam-feed ${isAlert}" onclick="expandCamera('${cam.id}', '${cam.name}')">
                ${scannerHtml}
                ${alertTag}
                <div class="cam-label">${cam.id}: ${cam.name}</div>
                <span style="color: #334155; font-weight: 700; opacity: 0.5;">FEED OFFLINE</span>
            </div>
        `;
        grid.innerHTML += camHtml;
    });

    // 2. Start the AI Telemetry Simulation Engine
    startTelemetryEngine();
}

function expandCamera(id, name) {
    const modal = document.getElementById('modal-expanded-cam');
    const label = document.getElementById('expanded-cam-label');
    
    if (modal && label) {
        label.textContent = `${id}: ${name} (ENLARGED HIGH-RES FEED)`;
        modal.classList.remove('hidden');
    }
}

function startTelemetryEngine() {
    const feed = document.getElementById('ai-telemetry-feed');
    if (!feed) return;
    
    // Clear previous intervals to prevent duplicates if user tabs back and forth
    if (telemetryInterval) clearInterval(telemetryInterval);
    
    // Initial populate
    feed.innerHTML = `
        <div style="color: var(--text-muted);">[SYSTEM] Neural Engine Initialized...</div>
        <div style="color: var(--text-muted);">[SYSTEM] Calibrating Bounding Boxes...</div>
    `;

    const mockEvents = [
        { cam: 'CAM-01', msg: 'Identity Verified: Taylor Kane (Host)', color: 'var(--success)' },
        { cam: 'CAM-03', msg: 'WARNING: Watchlist Match Detected (98%)', color: 'var(--danger)' },
        { cam: 'CAM-05', msg: 'Multiple Entities Detected in Zone', color: 'var(--text-main)' },
        { cam: 'CAM-08', msg: 'License Plate Scanned: XYZ-123', color: 'var(--primary-action)' },
        { cam: 'CAM-02', msg: 'Ghost Protocol: VIP Approaching Turnstile', color: '#3b82f6' }
    ];

    // Push a new log every 4 seconds to make the UI feel alive
    telemetryInterval = setInterval(() => {
        const randomEvent = mockEvents[Math.floor(Math.random() * mockEvents.length)];
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second:'2-digit' });
        
        const logEntry = document.createElement('div');
        logEntry.style.cssText = `border-left: 2px solid ${randomEvent.color}; padding-left: 8px; animation: slideIn 0.3s ease;`;
        logEntry.innerHTML = `
            <span style="color: var(--text-muted);">${timeStr} - ${randomEvent.cam}</span><br>
            <span style="color: ${randomEvent.color};">${randomEvent.msg}</span>
        `;
        
        feed.appendChild(logEntry);
        
        // Auto-scroll to bottom
        feed.scrollTop = feed.scrollHeight;
    }, 4000);
}

renderHOSSurveillance() 
// (Update the switch case in your routeUser / switchHOSView function!)

// ==========================================
// HOS WATCHLIST & THREAT INTELLIGENCE STATE
// ==========================================

// Mock State for the prototype
let pendingThreats = [
    { id: 'pt1', name: 'Marcus Vance', flaggedBy: 'Wayne Enterprises (Suite 401)', reason: 'Aggressive behavior towards reception staff.', time: 'Today, 09:12 AM' },
    { id: 'pt2', name: 'Unknown Courier', flaggedBy: 'Stark Industries', reason: 'Attempted to tailgate into secure lab area.', time: 'Yesterday, 16:45 PM' }
];

let activeWatchlist = [
    { id: 'aw1', name: 'Benjamin Wright', level: 'CRITICAL', reason: 'Former Employee - Hostile Termination', expiry: 'Permanent' },
    { id: 'aw2', name: 'Sarah Jenkins', level: 'WARNING', reason: 'Stalking/Harassment of Employee', expiry: 'Oct 12, 2026' },
    { id: 'aw3', name: 'John Doe (Alias)', level: 'MONITOR', reason: 'Known corporate espionage suspect', expiry: 'Dec 01, 2026' }
];

let currentApprovingThreatId = null;

function renderHOSWatchlist() {
    // 1. Render Pending Grid
    const pendingGrid = document.getElementById('watchlist-pending-grid');
    if (pendingGrid) {
        pendingGrid.innerHTML = '';
        if (pendingThreats.length === 0) {
            pendingGrid.innerHTML = `<p style="color: var(--text-muted);">No pending reviews. The queue is clear.</p>`;
        } else {
            pendingThreats.forEach(t => {
                pendingGrid.innerHTML += `
                    <div class="card" style="border: 1px solid var(--danger); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--danger);"></div>
                        <h3 style="margin: 0 0 5px 0; color: var(--text-main);">${t.name}</h3>
                        <p style="margin: 0 0 10px 0; font-size: 0.8rem; color: var(--text-muted);">Flagged by: <b>${t.flaggedBy}</b></p>
                        <div style="background: var(--hover-bg); padding: 10px; border-radius: 6px; font-size: 0.85rem; color: var(--text-main); margin-bottom: 15px;">
                            " ${t.reason} "
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn-primary" style="flex: 1; padding: 6px; font-size: 0.8rem; background: var(--danger); border: none;" onclick="openApproveModal('${t.id}')">REVIEW</button>
                            <button class="btn-primary" style="flex: 1; padding: 6px; font-size: 0.8rem; background: transparent; color: var(--text-main); border: 1px solid var(--border-color);" onclick="rejectThreat('${t.id}')">DISMISS</button>
                        </div>
                    </div>
                `;
            });
        }
    }

    // 2. Render Active Table
    renderWatchlistTable();
}

function renderWatchlistTable(filterText = '') {
    const tbody = document.getElementById('watchlist-active-table');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const filteredList = activeWatchlist.filter(w => w.name.toLowerCase().includes(filterText.toLowerCase()));

    if (filteredList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No restricted entities found.</td></tr>`;
        return;
    }

    filteredList.forEach(w => {
        let levelBadge = '';
        if (w.level === 'CRITICAL') levelBadge = `<span style="background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">🔴 CRITICAL</span>`;
        if (w.level === 'WARNING') levelBadge = `<span style="background: rgba(234, 88, 12, 0.1); color: #eab308; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">🟠 WARNING</span>`;
        if (w.level === 'MONITOR') levelBadge = `<span style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">🟡 MONITOR</span>`;

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px 8px; font-weight: 600; color: var(--text-main);">${w.name}</td>
                <td style="padding: 12px 8px;">${levelBadge}</td>
                <td style="padding: 12px 8px; color: var(--text-muted); font-size: 0.85rem;">${w.reason}</td>
                <td style="padding: 12px 8px; color: var(--text-muted); font-size: 0.85rem;">${w.expiry}</td>
                <td style="padding: 12px 8px;">
                    <button style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; text-decoration: underline; font-size: 0.8rem;" onclick="removeWatchlist('${w.id}')">Revoke</button>
                </td>
            </tr>
        `;
    });
}

// === INTERACTIVE CONTROLLERS ===

function filterWatchlistTable() {
    const query = document.getElementById('watchlist-search').value;
    renderWatchlistTable(query);
}

function openApproveModal(id) {
    currentApprovingThreatId = id;
    const threat = pendingThreats.find(t => t.id === id);
    
    document.getElementById('modal-threat-name').textContent = threat.name;
    document.getElementById('modal-threat-tenant').textContent = `Flagged by: ${threat.flaggedBy}`;
    document.getElementById('modal-timeline-tenant').textContent = threat.flaggedBy;
    
    document.getElementById('modal-approve-threat').classList.remove('hidden');
}

function closeApproveModal() {
    document.getElementById('modal-approve-threat').classList.add('hidden');
    currentApprovingThreatId = null;
}

function confirmAddWatchlist() {
    if (!currentApprovingThreatId) return;
    
    const threatIndex = pendingThreats.findIndex(t => t.id === currentApprovingThreatId);
    const threat = pendingThreats[threatIndex];
    const level = document.getElementById('modal-threat-level').value;

    // Move to Active array
    activeWatchlist.push({
        id: 'aw_' + Date.now(),
        name: threat.name,
        level: level,
        reason: threat.reason,
        expiry: 'Permanent (Manual Review Required)'
    });

    // Remove from Pending array
    pendingThreats.splice(threatIndex, 1);
    
    closeApproveModal();
    renderHOSWatchlist(); // Re-render to show updated arrays
    
    alert(`SUCCESS: ${threat.name} classified as ${level}. AI Camera Models are updating...`);
}

function rejectThreat(id) {
    pendingThreats = pendingThreats.filter(t => t.id !== id);
    renderHOSWatchlist();
}

function removeWatchlist(id) {
    if(confirm("Are you sure you want to revoke this ban and allow this entity back into the building?")) {
        activeWatchlist = activeWatchlist.filter(w => w.id !== id);
        renderHOSWatchlist();
    }
}

// === MANUAL WATCHLIST ENTRY CONTROLLERS ===

function openManualWatchlistModal() {
    document.getElementById('modal-manual-watchlist').classList.remove('hidden');
}

function closeManualWatchlistModal() {
    document.getElementById('modal-manual-watchlist').classList.add('hidden');
    document.getElementById('mw-name').value = '';
    document.getElementById('mw-id').value = '';
    document.getElementById('mw-reason').value = '';
    document.getElementById('mw-level').value = 'CRITICAL';
    document.getElementById('mw-expiry').value = 'Permanent';
}

function submitManualWatchlist(e) {
    e.preventDefault(); // Stop page from refreshing
    
    // 1. Harvest data from the DOM
    const name = document.getElementById('mw-name').value;
    const reason = document.getElementById('mw-reason').value;
    const level = document.getElementById('mw-level').value;
    const expiry = document.getElementById('mw-expiry').value;
    
    // 2. Manipulate State: Push to the Active Watchlist array
    activeWatchlist.push({
        id: 'aw_' + Date.now(),
        name: name,
        level: level,
        reason: reason + ' (Manual Entry by HOS)',
        expiry: expiry
    });
    
    // 3. UI Cleanup & Re-render
    closeManualWatchlistModal();
    renderHOSWatchlist(); 
    
    // 4. User Feedback
    alert(`SUCCESS: ${name} added to Watchlist as ${level}. Core databases updated.`);
}

// ==========================================
// HOS AUDIT TRAIL LOGIC
// ==========================================

function renderUnifiedAudit() {
    const tbody = document.getElementById('audit-unified-table');
    if (!tbody) return;

    const searchTerm = (document.getElementById('audit-search')?.value || '').toLowerCase();
    const categoryFilter = document.getElementById('audit-category')?.value || 'ALL';

    tbody.innerHTML = '';
    let combinedLogs = [];

    // 1. Gather Visitor Access Logs
    if (categoryFilter === 'ALL' || categoryFilter === 'ACCESS') {
        const visitors = getGuardVisitors();
        visitors.forEach(v => {
            combinedLogs.push({
                time: v.timeIn || 'Unknown Time',
                type: 'ACCESS',
                typeColor: 'var(--success)',
                actor: v.name || 'Unknown',
                details: `Processed entry for destination: ${v.company || 'Unknown'}`,
                status: v.isBlacklisted ? 'DENIED' : 'GRANTED',
                statusColor: v.isBlacklisted ? 'var(--danger)' : 'var(--text-main)',
                sortTime: new Date().getTime() - Math.random() * 10000 // Mock sort time
            });
        });
    }

    // 2. Gather Security/Threat Logs
    if (categoryFilter === 'ALL' || categoryFilter === 'SECURITY') {
        combinedLogs.push({
            time: '14 mins ago', type: 'SECURITY', typeColor: 'var(--danger)',
            actor: 'System AI', details: 'Hardware Anomaly Detected - Gate 3 Motor Unresponsive', status: 'ALERT GENERATED', statusColor: '#eab308', sortTime: new Date().getTime()
        });
        combinedLogs.push({
            time: '2 hrs ago', type: 'SECURITY', typeColor: 'var(--danger)',
            actor: 'HOS Admin', details: 'Added Entity "Benjamin Wright" to Watchlist (CRITICAL)', status: 'ENFORCED', statusColor: 'var(--success)', sortTime: new Date().getTime() - 7200000
        });
    }

    // 3. Gather System Logs
    if (categoryFilter === 'ALL' || categoryFilter === 'SYSTEM') {
        combinedLogs.push({
            time: '45 mins ago', type: 'SYSTEM', typeColor: '#3b82f6',
            actor: 'Guard 02', details: 'Terminal Login - Lobby Kiosk A', status: 'SUCCESS', statusColor: 'var(--success)', sortTime: new Date().getTime() - 2700000
        });
        combinedLogs.push({
            time: '3 hrs ago', type: 'SYSTEM', typeColor: '#3b82f6',
            actor: 'IP: 192.168.1.104', details: 'Failed Authentication (Bad Password)', status: 'DENIED', statusColor: 'var(--danger)', sortTime: new Date().getTime() - 10800000
        });
    }

    // Filter by search term
    if (searchTerm) {
        combinedLogs = combinedLogs.filter(log => 
            log.actor.toLowerCase().includes(searchTerm) || 
            log.details.toLowerCase().includes(searchTerm)
        );
    }

    // Render Table
    if (combinedLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">No audit records found matching criteria.</td></tr>`;
        return;
    }

    combinedLogs.forEach(log => {
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 15px; color: var(--text-muted);">${log.time}</td>
                <td style="padding: 15px;">
                    <span style="border: 1px solid ${log.typeColor}; color: ${log.typeColor}; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${log.type}</span>
                </td>
                <td style="padding: 15px; font-weight: 600; color: var(--text-main);">${log.actor}</td>
                <td style="padding: 15px; color: var(--text-muted);">${log.details}</td>
                <td style="padding: 15px; font-weight: 700; color: ${log.statusColor};">${log.status}</td>
                <td style="padding: 15px; text-align: center; opacity: 0.5;" title="Log Hash Verified">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </td>
            </tr>
        `;
    });
}
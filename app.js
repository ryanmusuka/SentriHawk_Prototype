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
    if (navGuard) navGuard.classList.add('hidden');
    if (navTenant) navTenant.classList.add('hidden');

    // Combine all possible view IDs across all roles
    const allAppViews = [
        'guard-dashboard', 'guard-registration', 'guard-history', 
        'guard-deliveries', 'guard-communicate', 
        'tenant-dashboard', 'tenant-pre-reg', 'tenant-history', 
        'tenant-employees', 'tenant-communicate', 
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

    } else if (role === 'tenant' || role === 'hos') {
        if (navTenant) navTenant.classList.remove('hidden');

        // --- TIER FEATURE LOCK (TENANT: PRE-REGISTRATION) ---
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
    
    alert(`Access Granted. ${rawName} has been securely logged.`);
    
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
    // 1. UI Feedback: Update the active navigation link
    if (navElement) {
        const navItems = document.querySelectorAll('#nav-tenant .nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        navElement.classList.add('active');
    }

    // 2. State Cleanup: Hide all possible Tenant-specific views
    const allTenantViews = [
        'tenant-dashboard', 
        'tenant-pre-reg', 
        'tenant-history', 
        'tenant-employees',
        'settings-view',
        'tenant-calendar-view' 
    ];
    
    allTenantViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('view-hidden');
            el.classList.remove('view-active');
        }
    });

    // 3. View Activation: Show the target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('view-hidden');
        targetView.classList.add('view-active');
        console.log(`SentriHawk Log: Switched to Tenant View [${viewId}]`);
    } else {
        console.warn(`SentriHawk Warning: Attempted to route to non-existent view: ${viewId}`);
        return; 
    }

    // 4. View-Specific Logic (Controller Layer)
    switch(viewId) {
        case 'tenant-dashboard':
            if (typeof updateTenantStats === 'function') {
                updateTenantStats(); 
            }
            break;
            
        case 'tenant-pre-reg':
            console.info("Ghost Protocol: Ready for secure VIP input.");
            if (typeof clearPreRegForm === 'function') {
                clearPreRegForm();
            }
            break;

        case 'tenant-history':
            if (typeof renderTenantHistory === 'function') {
                renderTenantHistory();
            }
            break;

        case 'tenant-employees':
            if (typeof loadEmployeeDirectory === 'function') {
                loadEmployeeDirectory();
            }
            break;
            
        case 'calendar-view': // <-- ADDED: Call the render function exactly when opened
            if (typeof renderMainCalendar === 'function') {
                renderMainCalendar();
            }
            break;
    }
}

/**
 * Populates the Tenant Dashboard by filtering the global data to ONLY 
 * include visitors explicitly bound to the logged-in tenant.
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
/**
 * SENTRIHAWK MOCK DATABASE
 * ------------------------------------------------
 * This file acts as the backend. It contains:
 * 1. Users (Auth & Authorization)
 * 2. Buildings (Configuration per Tier)
 * 3. Tenants (Destinations within buildings)
 * 4. Visitors (Biometric Data & ACL Status)
 */

// --- 1. CONFIGURATION & TIERS ---
const TIERS = {
    1: { name: "CORE", features: ["Manual Entry", "Basic Logs"], theme: "theme-core" },
    2: { name: "PRO", features: ["OCR Scanning", "Fast Pass"], theme: "theme-pro" },
    3: { name: "AI", features: ["Facial Rec", "Passive CCTV", "Zone Tracking"], theme: "theme-ai" }
};

// --- 2. BUILDINGS ---
const BUILDINGS = [
    { 
        id: "bld_1", 
        name: "Standard Plaza", 
        tier: 1, 
        elevatorSpeed: 1, 
        description: "Entry-level commercial space."
    },
    { 
        id: "bld_2", 
        name: "Tech Hub Towers", 
        tier: 2, 
        elevatorSpeed: 2, 
        description: "Modern corporate center with OCR gates."
    },
    { 
        id: "bld_3", 
        name: "Fortress Prime", 
        tier: 3, 
        elevatorSpeed: 4, 
        description: "High-security facility with active AI surveillance."
    }
];

// --- 3. USERS (LOGIN CREDENTIALS) ---
const USERS = [
    // --- SUPER ADMIN ---
    { 
        username: "admin", 
        pass: "admin123", 
        role: "super_admin", 
        tier: 3, 
        buildingId: "all", 
        name: "System Administrator" 
    },

    // --- TIER 1: Standard Plaza ---
    { username: "guard1", pass: "pass123", role: "guard", tier: 1, buildingId: "bld_1", name: "Officer Smith" },
    { username: "tenant1", pass: "pass123", role: "tenant", tier: 1, buildingId: "bld_1", name: "Acme Accounting" },
    { username: "hos1", pass: "pass123", role: "hos", tier: 1, buildingId: "bld_1", name: "Plaza Manager" },

    // --- TIER 2: Tech Hub Towers ---
    { username: "guard2", pass: "pass123", role: "guard", tier: 2, buildingId: "bld_2", name: "Officer Jones" },
    { username: "tenant2", pass: "pass123", role: "tenant", tier: 2, buildingId: "bld_2", name: "Cyberdyne Systems" },
    { username: "hos2", pass: "pass123", role: "hos", tier: 2, buildingId: "bld_2", name: "Tower Director" },

    // --- TIER 3: Fortress Prime ---
    { username: "guard3", pass: "pass123", role: "guard", tier: 3, buildingId: "bld_3", name: "Unit 734" },
    { username: "tenant3", pass: "pass123", role: "tenant", tier: 3, buildingId: "bld_3", name: "Stark Industries" },
    { username: "hos3", pass: "pass123", role: "hos", tier: 3, buildingId: "bld_3", name: "Security Chief" }
];

// === TENANT DIRECTORY DATA ===
const tenants = [
    { id: 't1', name: 'Nexus Innovations', logo: '🚀' },
    { id: 't2', name: 'Stark Logistics', logo: '📦' },
    { id: 't3', name: 'Quantum Financial', logo: '📈' },
    { id: 't4', name: 'Aegis Security', logo: '🛡️' },
    { id: 't5', name: 'Vertex Studios', logo: '🎨' },
    { id: 't6', name: 'Horizon Legal', logo: '⚖️' },
    { id: 't7', name: 'Omni Health', logo: '🏥' },
    { id: 't8', name: 'Apex Engineering', logo: '⚙️' },
    { id: 't9', name: 'Lumina Media', logo: '🎬' },
    { id: 't10', name: 'Crescent Foods', logo: '🍔' },
    { id: 't11', name: 'Echo Tech', logo: '💻' },
    { id: 't12', name: 'Vanguard Partners', logo: '🤝' },
    { id: 't13', name: 'Nimbus Cloud', logo: '☁️' }
];

// --- 5. VISITORS (TEST CASES) ---
const generateMockVector = () => Array.from({length: 10}, () => Math.random().toFixed(4));
// --- 5. VISITORS (TEST CASES) ---
const GUARD_STORAGE_KEY = 'sentrihawk_guard_visitors';
const TENANT_STORAGE_KEY = 'sentrihawk_tenant_visitors';
const todayStr = new Date().toISOString().split('T')[0];

const GUARD_VISITORS = [
    {
        id: "vis_001",
        name: "John Doe",
        document_id: "ID-99321",
        phone: "+1 555 0192",
        company: "Delivery Co",
        vrn: "ABC-123",
        isBlacklisted: false,
        isGhost: false,
        status: "EXPECTED",
        visits: [
            { date: todayStr, time_in: null, time_out: null, destination: "Stark Logistics" }
        ]
    },
    {
        id: "vis_002",
        name: "VIP GUEST", 
        real_name: "Senator Armstrong",
        document_id: "GOV-001",
        phone: "Classified",
        company: "Government",
        vrn: "STATE-1",
        isBlacklisted: false,
        isGhost: true, 
        status: "EXPECTED",
        visits: [
            { date: todayStr, time_in: null, time_out: null, destination: "Quantum Financial" }
        ]
    },
    {
        id: "vis_003",
        name: "Lazlo Panaflex",
        document_id: "ID-RESTRICTED",
        phone: "Unknown",
        company: "Unknown",
        vrn: "N/A",
        isBlacklisted: true, 
        isGhost: false,
        status: "FLAGGED",
        visits: [
            { date: "2026-02-15", time_in: "14:22", time_out: "14:25", destination: "Aegis Security" }
        ]
    }
];

const TENANT_VISITORS = [
    // === TENANT 1: Acme Accounting (username: tenant1) ===
    { id: 'v101', name: 'Alice Cooper', destination: 'tenant1', status: 'EXPECTED', isVIP: true, isBlacklisted: false, timeIn: null, timeOut: null, date: todayStr },
    { id: 'v102', name: 'Bob Builder', destination: 'tenant1', status: 'ON_SITE', isVIP: false, isBlacklisted: false, timeIn: '09:00', timeOut: null, date: todayStr },
    { id: 'v103', name: 'Jobho Chipangura', destination: 'tenant1', status: 'RESTRICTED', isVIP: false, isBlacklisted: true, timeIn: null, timeOut: null, date: todayStr },
    { id: 'v104', name: 'Charlie Davis', destination: 'tenant1', status: 'EXPECTED', isVIP: false, isBlacklisted: false, timeIn: null, timeOut: null, date: todayStr },

    // === TENANT 2: Cyberdyne Systems (username: tenant2) ===
    { id: 'v201', name: 'Sarah Connor', destination: 'tenant2', status: 'EXPECTED', isVIP: false, isBlacklisted: false, timeIn: null, timeOut: null, date: todayStr },
    { id: 'v202', name: 'Miles Dyson', destination: 'tenant2', status: 'ON_SITE', isVIP: true, isBlacklisted: false, timeIn: '10:15', timeOut: null, date: todayStr },
    { id: 'v203', name: 'T-1000', destination: 'tenant2', status: 'RESTRICTED', isVIP: false, isBlacklisted: true, timeIn: null, timeOut: null, date: todayStr },

    // === TENANT 3: Stark Industries (username: tenant3) ===
    { id: 'v301', name: 'Tony Stark', destination: 'tenant3', status: 'EXPECTED', isVIP: true, isBlacklisted: false, timeIn: null, timeOut: null, date: todayStr },
    { id: 'v302', name: 'Peter Parker', destination: 'tenant3', status: 'ON_SITE', isVIP: false, isBlacklisted: false, timeIn: '08:45', timeOut: null, date: todayStr },
    { id: 'v303', name: 'Nick Fury', destination: 'tenant3', status: 'ON_SITE', isVIP: true, isBlacklisted: false, timeIn: '11:00', timeOut: null, date: todayStr },
    { id: 'v304', name: 'Justin Hammer', destination: 'tenant3', status: 'RESTRICTED', isVIP: false, isBlacklisted: true, timeIn: null, timeOut: null, date: todayStr }
];

// --- 6. LOGIC & HELPERS ---

// --- 6. LOGIC & HELPERS ---

// For the Guard Dashboard
function getGuardVisitors() {
    const storedData = sessionStorage.getItem(GUARD_STORAGE_KEY);
    if (storedData) return JSON.parse(storedData);
    
    sessionStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(GUARD_VISITORS));
    return GUARD_VISITORS;
}

// For the Tenant Dashboard
function getTenantVisitors() {
    const storedData = sessionStorage.getItem(TENANT_STORAGE_KEY);
    if (storedData) return JSON.parse(storedData);
    
    sessionStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(TENANT_VISITORS));
    return TENANT_VISITORS;
}

// Init Storage on load
function initStorage() {
    if (!sessionStorage.getItem(GUARD_STORAGE_KEY)) {
        sessionStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(GUARD_VISITORS));
    }
    if (!sessionStorage.getItem(TENANT_STORAGE_KEY)) {
        sessionStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(TENANT_VISITORS));
    }
}
initStorage();

function addVisitor(visitorData) {
    let visitors = getGuardVisitors();
    
    const newVisitor = {
        id: 'v' + Date.now(), // Generate a unique ID based on timestamp
        ...visitorData,
        last_seen: new Date().toLocaleString()
    };
    
    visitors.push(newVisitor);
    
    // 3. Write strictly to sessionStorage
    sessionStorage.setItem(GUARD_STORAGE_KEY, JSON.stringify(visitors));
    
    return newVisitor;
}

// Reset Database Helper
function resetDatabase() {
    localStorage.removeItem('sentrihawk_visitors');
    location.reload();
}

// Authentication Logic
function authenticateUser(user, pass) {
    // 1. Find user in USERS array
    const foundUser = USERS.find(u => u.username === user && u.pass === pass);
    
    if (foundUser) {
        // 2. Find their building data
        const building = BUILDINGS.find(b => b.id === foundUser.buildingId) || { name: "Global Admin" };
        
        // 3. Return combined profile
        return {
            success: true,
            userData: foundUser,
            buildingData: building
        };
    }
    return { success: false, message: "Invalid Credentials" };
}

// Run initialization
initStorage();
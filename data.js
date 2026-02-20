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

// --- 4. TENANTS (DESTINATIONS) ---
const TENANT_DIRECTORY = [
    { id: "t_01", buildingId: "bld_1", name: "Law Firm A", floor: 3, logo: "⚖️" },
    { id: "t_02", buildingId: "bld_1", name: "Dr. Green", floor: 5, logo: "⚕️" },
    { id: "t_03", buildingId: "bld_2", name: "Dev Squad", floor: 12, logo: "💻" },
    { id: "t_04", buildingId: "bld_2", name: "Marketing G", floor: 8, logo: "🎨" },
    { id: "t_05", buildingId: "bld_3", name: "R&D Lab", floor: 45, logo: "🧪" },
    { id: "t_06", buildingId: "bld_3", name: "Server Farm", floor: "B2", logo: "🔒" } // FIXED: Added quotes to B2
];

// --- 5. VISITORS (TEST CASES) ---
const generateMockVector = () => Array.from({length: 10}, () => Math.random().toFixed(4));

// FIXED: Renamed to DEFAULT_VISITORS to match your function logic below
const DEFAULT_VISITORS = [
    {
        id: "vis_001",
        name: "John Doe",
        type: "standard",
        company: "Delivery Co",
        isBlacklisted: false,
        isGhost: false,
        face_vector: generateMockVector(),
        last_seen: "2023-10-24 09:00"
    },
    {
        id: "vis_002",
        name: "VIP GUEST", 
        real_name: "Senator Armstrong",
        type: "vip",
        company: "Government",
        isBlacklisted: false,
        isGhost: true, 
        face_vector: generateMockVector(),
        last_seen: "2023-10-23 14:00"
    },
    {
        id: "vis_003",
        name: "Lazlo Panaflex",
        type: "restricted",
        company: "Unknown",
        isBlacklisted: true, 
        isGhost: false,
        face_vector: generateMockVector(),
        last_seen: "2023-09-12 18:30"
    }
];

// --- 6. LOGIC & HELPERS ---

// Initialize Storage
function initStorage() {
    if (!localStorage.getItem('sentrihawk_visitors')) {
        // FIXED: Now correctly references DEFAULT_VISITORS
        localStorage.setItem('sentrihawk_visitors', JSON.stringify(DEFAULT_VISITORS));
        console.log("Database Initialized with Default Data");
    }
}

// Get All Visitors
function getVisitors() {
    const stored = localStorage.getItem('sentrihawk_visitors');
    return stored ? JSON.parse(stored) : DEFAULT_VISITORS;
}

// Add New Visitor
function addVisitor(visitorData) {
    const currentVisitors = getVisitors();
    
    const newVisitor = {
        id: `vis_${Date.now()}`,
        face_vector: generateMockVector(),
        last_seen: new Date().toLocaleString(),
        ...visitorData
    };
    
    currentVisitors.push(newVisitor);
    localStorage.setItem('sentrihawk_visitors', JSON.stringify(currentVisitors));
    return newVisitor;
}

// Reset Database Helper
function resetDatabase() {
    localStorage.removeItem('sentrihawk_visitors');
    location.reload();
}

// ADDED: Authentication Logic (Required for Login Page)
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
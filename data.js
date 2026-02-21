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

const DEFAULT_VISITORS = [
    {
        id: "vis_001",
        name: "John Doe",
        type: "standard",
        company: "Delivery Co",
        destination: "Stark Logistics", // Added Destination
        isBlacklisted: false,
        isGhost: false,
        face_vector: generateMockVector(),
        last_seen: "2023-10-24 09:00",
        status: "EXPECTED"
    },
    {
        id: "vis_002",
        name: "VIP GUEST", 
        real_name: "Senator Armstrong",
        type: "vip",
        company: "Government",
        destination: "Quantum Financial", // Added Destination
        isBlacklisted: false,
        isGhost: true, 
        face_vector: generateMockVector(),
        last_seen: "2023-10-23 14:00",
        status: "EXPECTED"
    },
    {
        id: "vis_003",
        name: "Lazlo Panaflex",
        type: "restricted",
        company: "Unknown",
        destination: "Aegis Security", // Added Destination
        isBlacklisted: true, 
        isGhost: false,
        face_vector: generateMockVector(),
        last_seen: "2023-09-12 18:30",
        status: "FLAGGED"
    }
];

// --- 6. LOGIC & HELPERS ---
const STORAGE_KEY = 'sentrihawk_visitors';

function getVisitors() {
    // 1. Read strictly from sessionStorage
    const storedData = sessionStorage.getItem(STORAGE_KEY);
    
    if (storedData) {
        return JSON.parse(storedData);
    }
    
    // 2. If empty, seed the demo data into sessionStorage
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VISITORS));
    return DEFAULT_VISITORS;
}

function addVisitor(visitorData) {
    let visitors = getVisitors();
    
    const newVisitor = {
        id: 'v' + Date.now(), // Generate a unique ID based on timestamp
        ...visitorData,
        last_seen: new Date().toLocaleString()
    };
    
    visitors.push(newVisitor);
    
    // 3. Write strictly to sessionStorage
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
    
    return newVisitor;
}

// Reset Database Helper
function resetDatabase() {
    sessionStorage.removeItem(STORAGE_KEY); // Changed from localStorage to sessionStorage
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

// Initialize Storage
if (!sessionStorage.getItem(STORAGE_KEY)) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VISITORS));
    console.log("Database Initialized with Default Data");
}
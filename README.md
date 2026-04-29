# 🦅 SentriHawk: Enterprise Visitor Management & Security Platform

**SentriHawk** is a next-generation Identity and Access Management (IAM) and physical security solution designed to modernize corporate visitor management. By leveraging automated identity document parsing (OCR), biometric authentication, and AI-driven surveillance, SentriHawk eliminates manual friction at security checkpoints while maintaining rigorous security protocols and immutable audit trails.

## 🚀 The Hook
**Redefining Corporate Security through Biometric Intelligence.**
SentriHawk replaces insecure, "analog" paper logbooks with a dual-interface platform, a desktop/tablet app for security personnel and a web portal for building tenants. Built to solve high latency and low data integrity in lobby management, it ensures that "security theater" becomes actual, data-driven protection.

---

## 🛠️ Tech Stack
* **Frontend (Prototype):** Vanilla JavaScript (ES6+), HTML5, CSS3 (Flexbox/Variables).
* **State Management:** State-driven architecture using a single-page approach (toggling views based on role/tier).
* **Persistence:** Web Storage API (`localStorage`) for mock relational data.
* **UI/UX:** Responsive design with "skins" optimized for the different user types (guard, tenant or head of security).
* **Security Logic:** Regex-based silent alarm triggers and cryptographic vector simulation for biometrics.

---

## ✨ Key Features
* **Biometric Vectorization:** Never stores raw images; converts faces/fingerprints into non-reversible mathematical strings.
* **The "Ghost Protocol":** Secure, QR-based anonymous VIP access that shifts liability to the host while protecting guest privacy.
* **Silent Alarm System:** Discreetly alerts guards to "Blacklisted" or "High Risk" individuals without escalating tension.
* **OCR ID Parsing:** Automated extraction of data from national IDs and passports to eliminate "fat-finger" errors (simulated in this prototype).

---

## 🛡️ Prototype Tier Offerings

The prototype demonstrates a tiered feature-gating strategy.

### Tier 1: SentriHawk Core (Biometric Entry)
* **Manual Onboarding:** Capture visitor details manually.
* **One-Time Enrollment:** First-time registration of ID, photo, and fingerprint.
* **Instant Verification:** Returning visitors scan for entry in <3 seconds.
* **Basic Simulation:** Includes a "Scan" button for simple liveness check simulations.

### Tier 2: SentriHawk Pro (Smart Scanning)
* **OCR Integration:** To scan ID.
* **Fake ID Detection:** Validation of cryptographic checksums in ID MRZ codes.
* **Self-Service Kiosk:** Supports a standalone "Kiosk Mode" for visitor self-registration.

### Tier 3: SentriHawk AI (Advanced Surveillance)
* **Passive Recognition:** Simulates real-time face detection from CCTV RTSP streams.
* **Zone Tracking:** Creates a "breadcrumb" movement heatmap as visitors move through zones.
* **Ghost Protocol:** Generation of secure, time-bound QR codes for anonymous access.

---

## 🔑 Prototype Access Credentials
Use the following credentials to test the different "skins" and tier features. The password for all accounts is `pass123`.

| Tier | Role | Username | Password |
| :--- | :--- | :--- | :--- |
| **Tier 1** | Guard | `guard1` | `pass123` |
| | Tenant | `tenant1` | `pass123` |
| | Admin | `hos1` | `pass123` |
| **Tier 2** | Guard | `guard2` | `pass123` |
| | Tenant | `tenant2` | `pass123` |
| | Admin | `hos2` | `pass123` |
| **Tier 3** | Guard | `guard3` | `pass123` |
| | Tenant | `tenant3` | `pass123` |
| | Admin | `hos3` | `pass123` |

---

## 🧠 Lessons Learned
* **Vectorization vs. Storage:** Learned why storing raw biometrics is a critical security risk and how vector embeddings provide a "one-way" cryptographic safeguard.
* **State-Driven UI:** Implementing a single-page architecture with vanilla JS taught me how to manage complex UI transitions without the overhead of a framework.
* **Human-Centric Security:** Designing "Silent Alarms" highlighted the importance of de-escalation in physical security software design.

---

## 📄 License
This project is licensed under the MIT License.

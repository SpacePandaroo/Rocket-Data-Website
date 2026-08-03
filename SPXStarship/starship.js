// =======================================
// Google Sheet Configurations
// =======================================

const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/1i5KDL4Qf-10XTgSDpHcbjpLTg8-4ApXtmJ9ESCwuBXw/export?format=csv&gid=";

const CONFIG = {
    ship: {
        gid: "1394959447",
        containerId: "ship-cards-container",
        modalId: "ship-modal",
        openBtnId: "open-ship-card",
        closeBtnId: "close-ship-modal",
        label: "Starship"
    },
    booster: {
        gid: "1433904430",
        containerId: "booster-cards-container",
        modalId: "booster-modal",
        openBtnId: "open-booster-card",
        closeBtnId: "close-booster-modal",
        label: "Booster"
    },
    flight: {
        gid: "1518191008",
        containerId: "flight-cards-container",
        modalId: "flight-modal",
        openBtnId: "open-flight-card",
        closeBtnId: "close-flight-modal",
        label: "Flight History"
    }
};

// Column indices matching Ship & Booster sheets (Col A - Col H):
const SHIP_BOOSTER_COLUMNS = {
    serial: 0,          // Col A
    block: 1,           // Col B
    status: 2,          // Col C
    location: 3,        // Col D
    finalStack: 4,      // Col E
    firstCryo: 5,       // Col F
    firstStaticFire: 6, // Col G
    notes: 7            // Col H
};

// Column indices matching Flight History sheet (0-indexed: A=0, B=1...):
const FLIGHT_COLUMNS = {
    utcTime: 5,         // Col F
    version: 9,         // Col J
    s1Serial: 10,       // Col K
    s1FlightNum: 11,    // Col L
    s2Serial: 12,       // Col M
    s2FlightNum: 13,    // Col N
    pad: 15,            // Col P
    s1Turnaround: 17,   // Col R
    s2Turnaround: 18,   // Col S
    missionName: 21,    // Col V
    outcome: 22,        // Col W
    s1Landing: 23,      // Col X
    s2Landing: 24       // Col Y
};

// Data Caches
const cache = {
    ship: null,
    booster: null,
    flight: null
};

// =======================================
// Shared Helpers & Validation
// =======================================

function hasText(value) {
    return String(value ?? "").trim() !== "";
}

function getStatusBadgeClass(statusStr) {
    if (!statusStr) return "status-unknown";
    const status = statusStr.toLowerCase();

    if (status.includes("success") || status.includes("active") || status.includes("testing") || status.includes("stacked") || status.includes("ready")) {
        return "status-active";
    }
    if (status.includes("partial") || status.includes("retired") || status.includes("display")) {
        return "status-retired";
    }
    if (status.includes("failure") || status.includes("scrapped") || status.includes("destroyed") || status.includes("dismantled") || status.includes("lost")) {
        return "status-scrapped";
    }
    return "status-default";
}

// =======================================
// Card Builders
// =======================================

function buildShipBoosterCards(type, rows) {
    const typeConfig = CONFIG[type];
    const container = document.getElementById(typeConfig.containerId);
    if (!container) return;

    container.innerHTML = "";

    const validRows = rows.filter(row => {
        const serial = row[SHIP_BOOSTER_COLUMNS.serial];
        return hasText(serial) && serial.toLowerCase() !== "serial";
    });

    if (validRows.length === 0) {
        container.innerHTML = `<p class="empty-notice">No ${typeConfig.label} vehicles found in dataset.</p>`;
        return;
    }

    validRows.forEach(row => {
        const serial = row[SHIP_BOOSTER_COLUMNS.serial] || `Unknown ${typeConfig.label}`;
        const block = row[SHIP_BOOSTER_COLUMNS.block] || "N/A";
        const status = row[SHIP_BOOSTER_COLUMNS.status] || "Unknown";
        const location = row[SHIP_BOOSTER_COLUMNS.location] || "N/A";
        const finalStack = row[SHIP_BOOSTER_COLUMNS.finalStack] || "N/A";
        const firstCryo = row[SHIP_BOOSTER_COLUMNS.firstCryo] || "N/A";
        const firstStaticFire = row[SHIP_BOOSTER_COLUMNS.firstStaticFire] || "N/A";
        const notes = row[SHIP_BOOSTER_COLUMNS.notes] || "";

        const card = document.createElement("div");
        card.className = "card ship-card";
        const badgeClass = getStatusBadgeClass(status);

        card.innerHTML = `
            <div class="ship-card-header">
                <h3>${serial}</h3>
                <span class="status-badge ${badgeClass}">${status}</span>
            </div>
            
            <div class="ship-card-body">
                <p><strong>Block:</strong> ${block}</p>
                <p><strong>Location:</strong> ${location}</p>
                
                <div class="milestones-grid">
                    <div class="milestone-item">
                        <span class="milestone-label">Final Stack</span>
                        <span class="milestone-value">${finalStack}</span>
                    </div>
                    <div class="milestone-item">
                        <span class="milestone-label">First Cryo</span>
                        <span class="milestone-value">${firstCryo}</span>
                    </div>
                    <div class="milestone-item">
                        <span class="milestone-label">First Static Fire</span>
                        <span class="milestone-value">${firstStaticFire}</span>
                    </div>
                </div>

                <p class="ship-notes">${hasText(notes) ? `<strong>Notes:</strong> ${notes}` : "&nbsp;"}</p>
            </div>
        `;

        container.appendChild(card);
    });
}

function buildFlightCards(rows) {
    const container = document.getElementById(CONFIG.flight.containerId);
    if (!container) return;

    container.innerHTML = "";

    const validRows = rows.filter(row => {
        const mission = row[FLIGHT_COLUMNS.missionName];
        return hasText(mission) && mission.toLowerCase() !== "mission name";
    });

    if (validRows.length === 0) {
        container.innerHTML = `<p class="empty-notice">No flight records found in dataset.</p>`;
        return;
    }

    validRows.forEach(row => {
        const missionName = row[FLIGHT_COLUMNS.missionName] || "Unknown Mission";
        const utcTime = row[FLIGHT_COLUMNS.utcTime] || "N/A";
        const version = row[FLIGHT_COLUMNS.version] || "N/A";
        const s1Serial = row[FLIGHT_COLUMNS.s1Serial] || "N/A";
        const s1FlightNum = row[FLIGHT_COLUMNS.s1FlightNum] || "";
        const s2Serial = row[FLIGHT_COLUMNS.s2Serial] || "N/A";
        const s2FlightNum = row[FLIGHT_COLUMNS.s2FlightNum] || "";
        const pad = row[FLIGHT_COLUMNS.pad] || "N/A";
        const s1Turnaround = row[FLIGHT_COLUMNS.s1Turnaround] || "N/A";
        const s2Turnaround = row[FLIGHT_COLUMNS.s2Turnaround] || "N/A";
        const outcome = row[FLIGHT_COLUMNS.outcome] || "Unknown";
        const s1Landing = row[FLIGHT_COLUMNS.s1Landing] || "N/A";
        const s2Landing = row[FLIGHT_COLUMNS.s2Landing] || "N/A";

        const card = document.createElement("div");
        card.className = "card ship-card flight-card";
        const badgeClass = getStatusBadgeClass(outcome);

        card.innerHTML = `
            <div class="ship-card-header">
                <h3>${missionName}</h3>
                <span class="status-badge ${badgeClass}">${outcome}</span>
            </div>
            
            <div class="ship-card-body">
                <p><strong>UTC Time:</strong> ${utcTime}</p>
                <p><strong>Pad / Version:</strong> ${pad} | ${version}</p>
                <p><strong>Booster (S1):</strong> ${s1Serial} ${hasText(s1FlightNum) ? `(#${s1FlightNum})` : ""} &mdash; <em>Turnaround: ${s1Turnaround}</em></p>
                <p><strong>Ship (S2):</strong> ${s2Serial} ${hasText(s2FlightNum) ? `(#${s2FlightNum})` : ""} &mdash; <em>Turnaround: ${s2Turnaround}</em></p>
                
                <div class="milestones-grid">
                    <div class="milestone-item">
                        <span class="milestone-label">S1 Landing</span>
                        <span class="milestone-value">${s1Landing}</span>
                    </div>
                    <div class="milestone-item">
                        <span class="milestone-label">S2 Landing</span>
                        <span class="milestone-value">${s2Landing}</span>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function buildCards(type, rows) {
    if (type === "flight") {
        buildFlightCards(rows);
    } else {
        buildShipBoosterCards(type, rows);
    }
}

// =======================================
// Modal & Data Controllers
// =======================================

function loadAndOpenModal(type) {
    const typeConfig = CONFIG[type];
    const modal = document.getElementById(typeConfig.modalId);
    const container = document.getElementById(typeConfig.containerId);
    if (!modal) return;

    modal.classList.remove("hidden");

    if (cache[type]) {
        buildCards(type, cache[type]);
        return;
    }

    if (container) {
        container.innerHTML = `<p class="loading-notice">Loading ${typeConfig.label} data...</p>`;
    }

    const csvUrl = `${SHEET_BASE_URL}${typeConfig.gid}`;

    Papa.parse(csvUrl, {
        download: true,
        skipEmptyLines: true,

        complete(results) {
            const rows = results.data || [];
            cache[type] = rows.slice(1).filter(row => row && row.some(hasText));
            buildCards(type, cache[type]);
        },

        error(err) {
            console.error(`Error loading ${typeConfig.label} tracking sheet:`, err);
            if (container) {
                container.innerHTML = `<p class="error-notice">Unable to load ${typeConfig.label} data at this time.</p>`;
            }
        }
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("hidden");
    }
}

// =======================================
// Event Initialization
// =======================================

function initEvents() {
    ["ship", "booster", "flight"].forEach(type => {
        const typeConfig = CONFIG[type];
        const cardTarget = document.getElementById(typeConfig.openBtnId);
        const closeBtn = document.getElementById(typeConfig.closeBtnId);
        const modal = document.getElementById(typeConfig.modalId);

        if (cardTarget) {
            cardTarget.onclick = () => loadAndOpenModal(type);
        }

        if (closeBtn) {
            closeBtn.onclick = () => closeModal(typeConfig.modalId);
        }

        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeModal(typeConfig.modalId);
                }
            };
        }
    });

    document.onkeydown = (e) => {
        if (e.key === "Escape") {
            closeModal(CONFIG.ship.modalId);
            closeModal(CONFIG.booster.modalId);
            closeModal(CONFIG.flight.modalId);
        }
    };
}

// Run initialization whether DOM is loading or already loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEvents);
} else {
    initEvents();
}
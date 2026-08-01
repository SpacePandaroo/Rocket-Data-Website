// =======================================
// Google Sheet Configuration
// =======================================

const SHEET_ID = "1Mn5YJAYFo_1A1HmpxjThOBpXxbVFVyMNYWBjcoCipcU";

const LAUNCH_SHEET_GID = "0";
const VEHICLE_SHEET_GID = "78973610";

const LAUNCH_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${LAUNCH_SHEET_GID}`;
const VEHICLE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${VEHICLE_SHEET_GID}`;

// 0-based index column mapping matching the Launch Sheet structure
const COLUMN_INDICES = {
    totalFlights: 0,   // Column A: Global launch index counter
    date: 5,           // Column F: Launch timestamp
    vehicleFamily: 7,  // Column H: Rocket main family
    vehicleSub: 8,     // Column I: Rocket sub-variant
    vehicleConfig: 9,  // Column J: Detailed rocket configuration
    missionName: 21,   // Column V: Payload / Mission title
    outcome: 23,       // Column X: Success / Failure status
    s1Landing: 24,     // Column Y: First-stage landing result
    s2Landing: 25      // Column Z: Second-stage disposition
};

// 0-based index column mapping matching the Vehicle Sheet structure
const VEHICLE_COLUMNS = {
    family: 1,                   // Column B: Vehicle main family
    subFamily: 2,                // Column C: Sub-family designation
    configuration: 3,            // Column D: Specific configuration designation
    launches: 4,                 // Column E: Total launch count for configuration
    success: 5,                  // Column F: Successful missions
    partial: 6,                  // Column G: Partial success missions
    failure: 7,                  // Column H: Failed missions
    status: 8,                   // Column I: Active / Retired status
    lifespan: 10,                // Column K: Total active span (e.g., "1990 - 2020")
    yearsActive: 11,             // Column L: Total operational years
    firstLaunch: 12,             // Column M: Initial orbital attempt date
    averageFamilyTurnaround: 13, // Column N: Avg cadence for entire vehicle family
    averageConfigTurnaround: 14, // Column O: Avg cadence for specific configuration
    lastLaunch: 15               // Column P: Most recent orbital attempt date
};

// =======================================
// Data Validation & Parsing Helpers
// =======================================

/**
 * Checks whether a raw cell value contains non-whitespace text.
 */
function hasText(value) {
    return String(value ?? "").trim() !== "";
}

/**
 * Converts formatted string inputs (e.g. "1,234") into clean numbers.
 */
function parseNumericValue(value) {
    if (!hasText(value)) return 0;

    const num = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(num) ? num : 0;
}

/**
 * Converts string dates or Excel serial timestamps into UTC Javascript Date objects.
 * Sets date-only inputs to 12:00:00 UTC to prevent local timezone offsets from rolling dates back.
 */
function parseLaunchDate(value) {
    if (!hasText(value)) return null;

    // Handle Excel numeric timestamp values
    if (typeof value === "number") {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(excelEpoch.getTime() + value * 86400000);
    }

    const raw = String(value).trim();

    // Match ISO/standard date-only strings (YYYY-MM-DD or YYYY/MM/DD)
    const dateOnlyMatch = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (dateOnlyMatch) {
        const year = parseInt(dateOnlyMatch[1], 10);
        const month = parseInt(dateOnlyMatch[2], 10) - 1;
        const day = parseInt(dateOnlyMatch[3], 10);
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }

    // Standard JavaScript fallback for full date-time strings
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// =======================================
// Launch Processing & Recent History
// =======================================

/**
 * Extracts and structures single launch row data into a clean object.
 */
function buildLaunchEntry(row) {
    const vehicle = [
        row[COLUMN_INDICES.vehicleFamily],
        row[COLUMN_INDICES.vehicleSub],
        row[COLUMN_INDICES.vehicleConfig]
    ]
        .filter(hasText)
        .join(" / ");

    return {
        date: row[COLUMN_INDICES.date],
        vehicle: vehicle,
        missionName: row[COLUMN_INDICES.missionName],
        outcome: row[COLUMN_INDICES.outcome],
        s1Landing: row[COLUMN_INDICES.s1Landing],
        s2Landing: row[COLUMN_INDICES.s2Landing]
    };
}

/**
 * Renders the 7-day launch history list in the "Recent Launches" UI card.
 */
function buildRecentLaunches(launches) {
    const list = document.getElementById("recent-launches");
    if (!list) return;

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);

    const recent = launches
        .map(entry => ({
            ...entry,
            parsedDate: parseLaunchDate(entry.date)
        }))
        .filter(entry => (
            entry.parsedDate &&
            entry.parsedDate >= cutoff &&
            entry.parsedDate <= now
        ))
        .sort((a, b) => b.parsedDate - a.parsedDate);

    list.innerHTML = "";

    if (recent.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No launches in the last 7 days";
        list.appendChild(li);
        return;
    }

    recent.forEach(entry => {
        const li = document.createElement("li");

        li.textContent = [
            entry.date,
            entry.missionName,
            entry.vehicle,
            entry.outcome,
            entry.s1Landing ? `S1: ${entry.s1Landing}` : "",
            entry.s2Landing ? `S2: ${entry.s2Landing}` : ""
        ]
            .filter(hasText)
            .join(" | ");

        list.appendChild(li);
    });
}

// =======================================
// Vehicle Card & Modal Builders
// =======================================

/**
 * Groups vehicle data by main family and generates overview UI cards.
 */
function buildVehicleCards(rows) {
    const container = document.getElementById("vehicle-families");
    if (!container) return;

    container.innerHTML = "";

    const families = {};

    rows.forEach(row => {
        const family = row[VEHICLE_COLUMNS.family];
        if (!hasText(family)) return;

        if (!families[family]) {
            families[family] = [];
        }
        families[family].push(row);
    });

    Object.entries(families).forEach(([family, vehicles]) => {
        const launches = vehicles.reduce((sum, row) => sum + parseNumericValue(row[VEHICLE_COLUMNS.launches]), 0);
        const success = vehicles.reduce((sum, row) => sum + parseNumericValue(row[VEHICLE_COLUMNS.success]), 0);
        const partial = vehicles.reduce((sum, row) => sum + parseNumericValue(row[VEHICLE_COLUMNS.partial]), 0);
        const failure = vehicles.reduce((sum, row) => sum + parseNumericValue(row[VEHICLE_COLUMNS.failure]), 0);

        const weightedSuccess = success + (partial * 0.5);
        const successRate = launches ? ((weightedSuccess / launches) * 100).toFixed(2) : "0.00";

        const card = document.createElement("div");
        card.className = "card family-card";

        card.innerHTML = `
            <h2>${family} Family</h2>
            <p>Launches: ${launches}</p>
            <p>Success Rate: ${successRate}%</p>
            <p>Success: ${success}</p>
            <p>Partial: ${partial}</p>
            <p>Failure: ${failure}</p>
            <p>Configurations: ${vehicles.length}</p>
        `;

        card.onclick = () => openVehicleModal(family, vehicles);

        container.appendChild(card);
    });
}

/**
 * Displays detailed information modal for a selected vehicle family.
 */
function openVehicleModal(family, vehicles) {
    const modal = document.getElementById("vehicle-modal");
    const body = document.getElementById("modal-body");
    if (!modal || !body) return;

    // Extract Average Family Turnaround (Column N / Index 13)
    const familyTurnaroundRow = vehicles.find(row => hasText(row[VEHICLE_COLUMNS.averageFamilyTurnaround]));
    const familyTurnaroundVal = familyTurnaroundRow
        ? parseNumericValue(familyTurnaroundRow[VEHICLE_COLUMNS.averageFamilyTurnaround])
        : 0;

    const avgFamilyTurnaround = familyTurnaroundVal > 0 ? `${familyTurnaroundVal} days` : "N/A";

    const familyInfo = {
        lifespan: vehicles.map(row => row[VEHICLE_COLUMNS.lifespan]).filter(hasText)[0] || "N/A",

        firstLaunch: vehicles
            .map(row => parseLaunchDate(row[VEHICLE_COLUMNS.firstLaunch]))
            .filter(Boolean)
            .sort((a, b) => a - b)[0],

        lastLaunch: vehicles
            .map(row => parseLaunchDate(row[VEHICLE_COLUMNS.lastLaunch]))
            .filter(Boolean)
            .sort((a, b) => b - a)[0]
    };

    let html = `
        <h2>${family} Family</h2>

        <div class="family-summary">
            <p><strong>Lifespan:</strong> ${familyInfo.lifespan}</p>
            <p><strong>Avg Family Turnaround:</strong> ${avgFamilyTurnaround}</p>
            <p>
                <strong>First Launch:</strong> 
                ${familyInfo.firstLaunch 
                    ? familyInfo.firstLaunch.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC" 
                    : "N/A"}
            </p>
            <p>
                <strong>Last Launch:</strong> 
                ${familyInfo.lastLaunch 
                    ? familyInfo.lastLaunch.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC" 
                    : "N/A"}
            </p>
        </div>

        <hr>

        <h3>Configurations</h3>
    `;

    vehicles.forEach(row => {
        const launches = parseNumericValue(row[VEHICLE_COLUMNS.launches]);
        const success = parseNumericValue(row[VEHICLE_COLUMNS.success]);
        const partial = parseNumericValue(row[VEHICLE_COLUMNS.partial]);
        const failure = parseNumericValue(row[VEHICLE_COLUMNS.failure]);
        const weighted = success + (partial * 0.5);

        const rate = launches ? ((weighted / launches) * 100).toFixed(2) : "0.00";

        // Parse individual configuration dates
        const configFirst = parseLaunchDate(row[VEHICLE_COLUMNS.firstLaunch]);
        const configLast = parseLaunchDate(row[VEHICLE_COLUMNS.lastLaunch]);

        const formattedFirst = configFirst
            ? configFirst.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC"
            : "N/A";

        const formattedLast = configLast
            ? configLast.toLocaleString("en-US", { timeZone: "UTC" }) + " UTC"
            : "N/A";

        // Extract Configuration Turnaround (Column O / Index 14)
        const configTurnaroundVal = parseNumericValue(row[VEHICLE_COLUMNS.averageConfigTurnaround]);
        const configTurnaround = configTurnaroundVal > 0 ? `${configTurnaroundVal} days` : "N/A";

        html += `
        <div class="vehicle-config">
            <h3>${row[VEHICLE_COLUMNS.configuration]}</h3>
            <p>Sub Family: ${row[VEHICLE_COLUMNS.subFamily] || "N/A"}</p>
            <p>Status: ${row[VEHICLE_COLUMNS.status] || "Unknown"}</p>
            <p>First Launch: ${formattedFirst}</p>
            <p>Last Launch: ${formattedLast}</p>
            <p>Config Turnaround: ${configTurnaround}</p>
            <p>Launches: ${launches}</p>
            <p>Success: ${success}</p>
            <p>Partial: ${partial}</p>
            <p>Failure: ${failure}</p>
            <p>Success Rate: ${rate}%</p>
        </div>
        `;
    });

    body.innerHTML = html;
    modal.classList.remove("hidden");
}

// =======================================
// Data Loaders & Execution Flow
// =======================================

/**
 * Fetches and processes launch dataset.
 */
function loadLaunchSheet() {
    Papa.parse(LAUNCH_CSV_URL, {
        download: true,
        skipEmptyLines: true,

        complete(results) {
            const rows = results.data || [];
            const dataRows = rows.slice(1).filter(row => row && row.some(hasText));

            const totalFlights = Math.max(
                ...dataRows.map(row => parseNumericValue(row[COLUMN_INDICES.totalFlights]))
            );

            const countElement = document.getElementById("total-count");
            if (countElement) {
                countElement.textContent = totalFlights.toLocaleString();
            }

            buildRecentLaunches(dataRows.map(buildLaunchEntry));
        },

        error(error) {
            console.error("Error loading launch sheet:", error);
        }
    });
}

/**
 * Fetches and processes vehicle family statistics dataset.
 */
function loadVehicleSheet() {
    Papa.parse(VEHICLE_CSV_URL, {
        download: true,
        skipEmptyLines: true,

        complete(results) {
            const rows = results.data || [];
            const dataRows = rows.slice(1).filter(row => row && row.some(hasText));

            buildVehicleCards(dataRows);
        },

        error(error) {
            console.error("Error loading vehicle sheet:", error);
        }
    });
}

// Initialize event listeners for the modal close triggers
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("vehicle-modal");
    const closeBtn = document.getElementById("close-modal");

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.classList.add("hidden");
    }

    if (modal) {
        modal.onclick = (event) => {
            if (event.target === modal) {
                modal.classList.add("hidden");
            }
        };
    }
});

// Kick off async data fetching
loadLaunchSheet();
loadVehicleSheet();
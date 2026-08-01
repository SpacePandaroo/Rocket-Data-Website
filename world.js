// =======================================
// Google Sheet Configuration
// =======================================

const SHEET_ID = "15f0ig9CIZE-m705V-9YRzQBVwJ3Bbj0wvFU0y9zarlU";
const GID = "0"; // Main sheet containing overall launch history

// Direct CSV export URL for PapaParse to fetch
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// 0-based index column mapping matching the Launch Sheet structure
const COLUMN_INDICES = {
    countryCount: 1,    // Column B: Aggregated launch count per region
    country: 5,         // Column F: Launch origin country
    date: 6,            // Column G: Launch date timestamp
    vehicleFamily: 8,   // Column I: Rocket main family
    vehicleSub: 9,      // Column J: Rocket sub-variant
    vehicleConfig: 10,  // Column K: Rocket detailed configuration
    missionName: 22,    // Column W: Payload / Mission title
    outcome: 23,        // Column X: Success / Failure status
    s1Landing: 24,      // Column Y: First-stage landing result
    s2Landing: 25       // Column Z: Second-stage landing/disposition result
};

// Country definitions used to match spreadsheet data to card UI elements
const COUNTRY_CARD_DEFINITIONS = [
    { label: "United States", aliases: ["united states"] },
    { label: "Russia/Former Soviet Union", aliases: ["russia"] },
    { label: "Europe", aliases: ["europe"] },
    { label: "Japan", aliases: ["japan"] },
    { label: "China", aliases: ["china"] },
    { label: "India", aliases: ["india"] },
    {
        label: "Minor Space Nations",
        aliases: [
            "minor - south korea",
            "minor - israel",
            "minor - north korea",
            "minor - iran",
            "minor - brazil",
            "minor - australia"
        ]
    }
];

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
 * Normalizes text headers for robust matching (lowercase, alphanumeric single spaces).
 */
function normalizeHeader(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/**
 * Converts formatted string inputs (e.g. "1,234") into clean numbers.
 */
function parseNumericValue(value) {
    if (value === null || value === undefined) return NaN;
    const cleaned = String(value).replace(/,/g, "").trim();
    if (cleaned === "") return NaN;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
}

/**
 * Converts string dates or Excel serial timestamps into UTC Javascript Date objects.
 * Sets date-only inputs to 12:00:00 UTC to prevent local timezone offsets from rolling dates back a day.
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
        const month = parseInt(dateOnlyMatch[2], 10) - 1; // 0-indexed month
        const day = parseInt(dateOnlyMatch[3], 10);
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }

    // Standard JavaScript fallback for full date-time strings
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normalizes country strings for case-insensitive alias matching.
 */
function normalizeCountry(value) {
    return String(value ?? "").toLowerCase().trim();
}

/**
 * Checks if a row's country field matches any of the defined region aliases.
 */
function matchesCountryAliases(value, aliases) {
    const normalizedValue = normalizeCountry(value);
    return aliases.some(alias => alias && normalizedValue.includes(alias));
}

// =======================================
// Data Processing & UI Builders
// =======================================

/**
 * Extracts and structures single launch row data into a clean object.
 */
function buildLaunchEntry(row) {
    // Combine vehicle columns while stripping empty parts and removing duplicates
    const vehicleParts = [
        row[COLUMN_INDICES.vehicleFamily],
        row[COLUMN_INDICES.vehicleSub],
        row[COLUMN_INDICES.vehicleConfig]
    ]
        .filter(hasText)
        .map(value => String(value).trim());

    const uniqueVehicleParts = [];
    vehicleParts.forEach(part => {
        if (!uniqueVehicleParts.includes(part)) {
            uniqueVehicleParts.push(part);
        }
    });

    return {
        country: row[COLUMN_INDICES.country] ?? "",
        date: row[COLUMN_INDICES.date] ?? "",
        missionName: row[COLUMN_INDICES.missionName] ?? "",
        vehicle: uniqueVehicleParts.join(" / "),
        outcome: row[COLUMN_INDICES.outcome] ?? "",
        s1Landing: row[COLUMN_INDICES.s1Landing] ?? "",
        s2Landing: row[COLUMN_INDICES.s2Landing] ?? ""
    };
}

/**
 * Parses out row data for country statistics tracking.
 */
function buildCountryEntry(row) {
    const countValue = parseNumericValue(row[COLUMN_INDICES.countryCount]);
    return {
        country: row[COLUMN_INDICES.country] ?? "",
        count: Number.isFinite(countValue) ? countValue : 0
    };
}

/**
 * Finds the chronologically most recent launch from an array of launch entries.
 */
function getLatestLaunch(entries) {
    const parsedEntries = entries
        .map(entry => ({
            ...entry,
            parsedDate: parseLaunchDate(entry.date)
        }))
        .filter(entry => entry.parsedDate !== null);

    if (parsedEntries.length === 0) return null;

    parsedEntries.sort((a, b) => b.parsedDate - a.parsedDate);
    return parsedEntries[0];
}

/**
 * Renders the 7-day launch history list in the "Recent Launches" UI card.
 */
function buildRecentLaunches(data) {
    const list = document.getElementById("recent-launches");
    if (!list) return;

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);

    // Filter launches occurring within the past 7 days up to the current date
    const recentRows = data
        .map(entry => ({
            ...entry,
            parsedDate: parseLaunchDate(entry.date)
        }))
        .filter(entry => {
            return (
                entry.parsedDate &&
                entry.parsedDate >= cutoff &&
                entry.parsedDate <= now
            );
        })
        .sort((a, b) => b.parsedDate - a.parsedDate);

    list.innerHTML = "";

    if (recentRows.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No launches in the last 7 days";
        list.appendChild(li);
        return;
    }

    recentRows.forEach(entry => {
        const li = document.createElement("li");

        const titleParts = [entry.date, entry.missionName].filter(hasText);
        const title = titleParts.length > 0 ? titleParts.join(" — ") : "Unknown launch";

        const detailParts = [];
        if (hasText(entry.country)) detailParts.push(`Country: ${String(entry.country).trim()}`);
        if (hasText(entry.vehicle)) detailParts.push(`Vehicle: ${entry.vehicle}`);
        if (hasText(entry.outcome)) detailParts.push(`Outcome: ${String(entry.outcome).trim()}`);
        if (hasText(entry.s1Landing)) detailParts.push(`S1: ${String(entry.s1Landing).trim()}`);
        if (hasText(entry.s2Landing)) detailParts.push(`S2: ${String(entry.s2Landing).trim()}`);

        li.textContent = detailParts.length > 0
            ? `${title} | ${detailParts.join(" | ")}`
            : title;

        list.appendChild(li);
    });
}

/**
 * Calculates summary metrics (total launches & latest launch info) and injects into regional cards.
 */
function populateCountryCards(countryEntries, launchEntries) {
    const countryEntriesWithMeta = countryEntries
        .map((entry, index) => ({ ...entry, __index: index }))
        .filter(entry => hasText(entry.country));

    const usedIndexes = new Set();

    COUNTRY_CARD_DEFINITIONS.forEach(definition => {
        let matchingEntries = [];

        // Aggregate unassigned countries under Minor Space Nations
        if (definition.label === "Minor Space Nations") {
            matchingEntries = countryEntriesWithMeta.filter(entry => !usedIndexes.has(entry.__index));
        } else {
            matchingEntries = countryEntriesWithMeta.filter(entry => {
                return (
                    !usedIndexes.has(entry.__index) &&
                    matchesCountryAliases(entry.country, definition.aliases)
                );
            });

            matchingEntries.forEach(entry => usedIndexes.add(entry.__index));
        }

        const card = document.querySelector(`.country-card[data-country="${definition.label}"]`);
        if (!card) return;

        const summary = card.querySelector(".country-summary");
        if (!summary) return;

        const totalCount = matchingEntries.reduce((max, entry) => Math.max(max, entry.count), 0);

        const matchingLaunches = launchEntries.filter(launch => {
            return matchesCountryAliases(launch.country, definition.aliases);
        });

        const latestLaunch = getLatestLaunch(matchingLaunches);

        summary.innerHTML = `
            <strong>Latest:</strong> ${latestLaunch ? `${latestLaunch.date} — ${latestLaunch.missionName || "Unknown mission"}` : "No launches recorded"}<br>
            <strong>Count:</strong> ${totalCount.toLocaleString()}
        `;
    });
}

/**
 * Optional utility function to dynamically create a preview HTML table if required.
 */
function buildTable(data) {
    const table = document.getElementById("sheetTable");
    if (!table) return;

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    if (data.length === 0) return;

    const headers = Object.keys(data[0]);

    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;
    tbody.innerHTML = "";

    data.forEach(row => {
        const tr = document.createElement("tr");
        headers.forEach(header => {
            const td = document.createElement("td");
            td.textContent = row[header];
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// =======================================
// Main Execution Loader
// =======================================

/**
 * Async entrypoint: downloads the CSV file via PapaParse and populates UI elements.
 */
async function loadLaunchSheet() {
    Papa.parse(CSV_URL, {
        download: true,
        skipEmptyLines: true,

        complete: function(results) {
            const rows = results.data || [];
            if (rows.length === 0) return;

            const headerRow = rows[0] || [];
            const dataRows = rows.slice(1).filter(row => row && row.some(hasText));

            // Dynamically locate the global launch tally column header
            const flightsHeaderIndex = headerRow.findIndex(
                header => normalizeHeader(header) === "total world flights"
            );

            // Extract maximum launch index count across all rows
            const numericFlights = dataRows
                .map(row => parseNumericValue(row[flightsHeaderIndex]))
                .filter(value => Number.isFinite(value));

            const maxFlights = numericFlights.length > 0 ? Math.max(...numericFlights) : 0;

            const countElement = document.getElementById("total-count");
            if (countElement) {
                countElement.textContent = maxFlights.toLocaleString();
            }

            // Build recent launch timeline and update country summary cards
            const launchEntries = dataRows.map(buildLaunchEntry);
            buildRecentLaunches(launchEntries);

            const countryEntries = dataRows.map(buildCountryEntry);
            populateCountryCards(countryEntries, launchEntries);
        },

        error: function(error) {
            console.error("Sheet loading error:", error);
        }
    });
}

// Kick off sheet data request on script initialization
loadLaunchSheet();
// =======================================
// Google Sheet Settings
// =======================================
// These settings define the Google Sheet to load and the exported CSV URL.
// The page fetches the sheet data as CSV so it can display launch statistics.
// =======================================

const SHEET_ID = "15f0ig9CIZE-m705V-9YRzQBVwJ3Bbj0wvFU0y9zarlU";
const GID = "0";

const CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// =======================================
// Helpers
// =======================================
// These helper functions parse the sheet values, normalize text, and build the objects used by the page.
// =======================================

const COLUMN_INDICES = {
    countryCount: 1,    // Column B in the sheet
    country: 5,         // Column F
    date: 6,            // Column G
    vehicleFamily: 8,   // Column I
    vehicleSub: 9,      // Column J
    vehicleConfig: 10,  // Column K
    missionName: 20,    // Column U
    outcome: 21,        // Column V
    s1Landing: 22,      // Column W
    s2Landing: 23       // Column X
};

// Convert spreadsheet values to numbers safely, ignoring commas and empty strings.
function parseNumericValue(value) {
    if (value === null || value === undefined) return NaN;

    const cleaned = String(value).replace(/,/g, "").trim();
    if (cleaned === "") return NaN;

    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
}

// Normalize a header string so it can be compared in a case-insensitive way.
function normalizeHeader(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

// Check whether a value contains text after trimming whitespace.
function hasText(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
}

// Parse a launch date from spreadsheet text or Excel-style numeric date values.
function parseLaunchDate(value) {
    if (!hasText(value)) return null;

    // Some sheets can export dates as numbers relative to Excel's epoch.
    if (typeof value === "number") {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(excelEpoch.getTime() + value * 86400000);
    }

    const raw = String(value).trim();
    const candidates = [raw];

    // If the date is in a format like YYYY/MM/DD or YYYY-MM-DD, normalize it.
    const isoMatch = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (isoMatch) {
        candidates.push(`${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`);
    }

    for (const candidate of candidates) {
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    return null;
}

// Build a launch entry object from a sheet row.
function buildLaunchEntry(row) {
    const vehicleParts = [
        row[COLUMN_INDICES.vehicleFamily],
        row[COLUMN_INDICES.vehicleSub],
        row[COLUMN_INDICES.vehicleConfig]
    ]
        .filter(hasText)
        .map(value => String(value).trim());

    // Remove duplicate vehicle parts before combining them.
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

// Render the recent launches list on the homepage.
function buildRecentLaunches(data) {
    const list = document.getElementById("recent-launches");
    if (!list) return;

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 7);

    const recentRows = data
        .map(entry => ({
            ...entry,
            parsedDate: parseLaunchDate(entry.date)
        }))
        .filter(entry => {
            return entry.parsedDate &&
                entry.parsedDate >= cutoff &&
                entry.parsedDate <= now;
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
        const title = titleParts.length > 0
            ? titleParts.join(" — ")
            : "Unknown launch";

        const detailParts = [];

        if (hasText(entry.country)) {
            detailParts.push(`Country: ${String(entry.country).trim()}`);
        }

        if (hasText(entry.vehicle)) {
            detailParts.push(`Vehicle: ${entry.vehicle}`);
        }

        if (hasText(entry.outcome)) {
            detailParts.push(`Outcome: ${String(entry.outcome).trim()}`);
        }

        if (hasText(entry.s1Landing)) {
            detailParts.push(`S1: ${String(entry.s1Landing).trim()}`);
        }

        if (hasText(entry.s2Landing)) {
            detailParts.push(`S2: ${String(entry.s2Landing).trim()}`);
        }

        li.textContent = detailParts.length > 0
            ? `${title} | ${detailParts.join(" | ")}`
            : title;

        list.appendChild(li);
    });
}

// Build a country summary object from a sheet row.
function buildCountryEntry(row) {
    const countValue = parseNumericValue(row[COLUMN_INDICES.countryCount]);

    return {
        country: row[COLUMN_INDICES.country] ?? "",
        count: Number.isFinite(countValue) ? countValue : 0
    };
}

// Populate the country cards using summary counts and latest launch information.
function populateCountryCards(countryEntries, launchEntries) {
    const countryEntriesWithMeta = countryEntries
        .map((entry, index) => ({ ...entry, __index: index }))
        .filter(entry => hasText(entry.country));

    const usedIndexes = new Set();

    COUNTRY_CARD_DEFINITIONS.forEach(definition => {
        let matchingEntries = [];

        if (definition.label === "Minor Space Nations") {
            // The last group contains all countries not matched by the main categories.
            matchingEntries = countryEntriesWithMeta.filter(entry => !usedIndexes.has(entry.__index));
        } else {
            matchingEntries = countryEntriesWithMeta.filter(entry => {
                return !usedIndexes.has(entry.__index) &&
                    matchesCountryAliases(entry.country, definition.aliases);
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

// =======================================
// Load Sheet
// =======================================
// Fetch the CSV, parse it, and render the counts and launch summaries.
// =======================================

async function loadSheet() {
    Papa.parse(CSV_URL, {
        download: true,
        skipEmptyLines: true,

        complete: function(results) {
            const rows = results.data || [];

            if (rows.length === 0) return;

            const headerRow = rows[0] || [];
            const dataRows = rows.slice(1).filter(row => row && row.some(hasText));

            const flightsHeaderIndex = headerRow.findIndex(
                header => normalizeHeader(header) === "total world flights"
            );

            // Find the largest numeric value in the flights column and show it as the total.
            const numericFlights = dataRows
                .map(row => parseNumericValue(row[flightsHeaderIndex]))
                .filter(value => Number.isFinite(value));

            const maxFlights = numericFlights.length > 0
                ? Math.max(...numericFlights)
                : 0;

            const countElement = document.getElementById("total-count");
            if (countElement) {
                countElement.textContent = maxFlights.toLocaleString();
            }

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

// =======================================
// Build HTML Table
// =======================================
// This helper builds a table if the page includes an element with id="sheetTable".
// =======================================

function buildTable(data) {
    const table = document.getElementById("sheetTable");
    if (!table) return;

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    if (data.length === 0) return;

    const headers = Object.keys(data[0]);

    thead.innerHTML =
        "<tr>" +
        headers.map(h => `<th>${h}</th>`).join("") +
        "</tr>";

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
// Start
// =======================================

loadSheet();

const COUNTRY_CARD_DEFINITIONS = [
    {
        label: "United States",
        aliases: ["united states"]
    },
    {
        label: "Russia/Former Soviet Union",
        aliases: ["russia"]
    },
    {
        label: "Europe",
        aliases: ["europe"]
    },
    {
        label: "Japan",
        aliases: ["japan"]
    },
    {
        label: "China",
        aliases: ["china"]
    },
    {
        label: "India",
        aliases: ["india"]
    },
    {
        label: "Minor Space Nations",
        aliases: ["minor - south korea", "minor - israel", "minor - north korea", "minor - iran", "minor - brazil", "minor - australia"]
    }
];

function normalizeCountry(value) {
    return String(value ?? "").toLowerCase().trim();
}

function matchesCountryAliases(value, aliases) {
    const normalizedValue = normalizeCountry(value);

    return aliases.some(alias => {
        return alias && normalizedValue.includes(alias);
    });
}

function getLatestLaunch(entries) {
    const parsedEntries = entries
        .map(entry => ({
            ...entry,
            parsedDate: parseLaunchDate(entry.date)
        }))
        .filter(entry => entry.parsedDate);

    if (parsedEntries.length === 0) return null;

    parsedEntries.sort((a, b) => b.parsedDate - a.parsedDate);
    return parsedEntries[0];
}
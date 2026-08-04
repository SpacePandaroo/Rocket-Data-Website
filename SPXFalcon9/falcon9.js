// =======================================
// Google Sheets Configurations
// =======================================

const F9_SHEET_ID = "1u1heWnqn8pGBNQDsGATj1YCYD-IVzPYTY8dbAOYhbGg";
const F9_OVERVIEW_GID = "124260063";
const F9_NOTES_GID = "97245776";
const F9_ATTEMPTS_GID = "1730659231";

const URLs = {
    f9Overview: `https://docs.google.com/spreadsheets/d/${F9_SHEET_ID}/export?format=csv&gid=${F9_OVERVIEW_GID}`,
    f9Notes: `https://docs.google.com/spreadsheets/d/${F9_SHEET_ID}/export?format=csv&gid=${F9_NOTES_GID}`,
    f9Attempts: `https://docs.google.com/spreadsheets/d/${F9_SHEET_ID}/export?format=csv&gid=${F9_ATTEMPTS_GID}`
};

const F9_OVERVIEW_COLS = {
    serial: 0,
    block: 1,
    flights: 2,
    firstFlight: 4,
    latestFlight: 5,
    avgTurn: 7,
    worstTurn: 8,
    bestTurn: 9
};

const F9_NOTES_COLS = {
    serial: 0,
    block: 1,
    flights: 2,
    lastFlownFrom: 4,
    lastLandedAt: 5,
    currentStatus: 6,
    notes: 8
};

const DataStore = {
    f9Overview: [],
    f9Notes: [],
    f9Attempts: []
};

function hasText(value) {
    if (value === null || value === undefined) return false;
    const str = String(value).trim().toUpperCase();
    return str !== "" && str !== "NO DATA" && str !== "&MDASH;" && str !== "—";
}

function normalizeSerial(serialStr) {
    if (!serialStr) return "";
    const clean = String(serialStr).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^\d+$/.test(clean)) return `B${clean}`;
    return clean;
}

// =======================================
// Parse Launch Outcomes & Landing Data
// =======================================

function parseAttemptsData() {
    if (!DataStore.f9Attempts || DataStore.f9Attempts.length === 0) return;

    try {
        // 1. Parse Falcon 9 Launch Outcomes (Rows 4 to 8, Cols B to D)
        const rows = DataStore.f9Attempts.slice(3, 8);
        rows.forEach((row, idx) => {
            const itemNumber = idx + 1;
            const outcomeType = row?.[1] ? String(row[1]).trim() : "";
            const attemptsCount = row?.[2] ? String(row[2]).trim() : "0";
            const extraVal = row?.[3] ? String(row[3]).trim() : "";

            const labelEl = document.getElementById(`label-outcome-${itemNumber}`);
            const countEl = document.getElementById(`count-outcome-${itemNumber}`);

            if (labelEl && outcomeType) labelEl.textContent = `${outcomeType}:`;
            if (countEl) {
                countEl.textContent = (extraVal && extraVal !== "0" && extraVal !== "0%") ? `${attemptsCount} (${extraVal})` : attemptsCount;
            }
        });

        // 2. Parse Falcon Heavy Launch Outcomes (Rows 4 to 8, Cols F to H)
        rows.forEach((row, idx) => {
            const itemNumber = idx + 1;
            const outcomeType = row?.[5] ? String(row[5]).trim() : "";
            const attemptsCount = row?.[6] ? String(row[6]).trim() : "0";
            const extraVal = row?.[7] ? String(row[7]).trim() : "";

            const labelEl = document.getElementById(`fh-label-outcome-${itemNumber}`);
            const countEl = document.getElementById(`fh-count-outcome-${itemNumber}`);

            if (labelEl && outcomeType) labelEl.textContent = `${outcomeType}:`;
            if (countEl) {
                countEl.textContent = (extraVal && extraVal !== "0" && extraVal !== "0%") ? `${attemptsCount} (${extraVal})` : attemptsCount;
            }
        });

        // 3. Parse Falcon 9 Landing Data (Rows 27 to 35, Columns B through D)
        const landingRows = DataStore.f9Attempts.slice(26, 35);
        const f9LandingData = [];
        landingRows.forEach(row => {
            const site = row?.[1] ? String(row[1]).trim() : "";
            const stats = row?.[2] ? String(row[2]).trim() : "";
            const rate = row?.[3] ? String(row[3]).trim() : "";
            if (site || stats || rate) {
                f9LandingData.push({ site, stats, rate });
            }
        });
        renderLandingStatsUI("landing-metrics-list", "stat-f9-landings-total", f9LandingData);

        // 4. Parse Falcon Heavy Landing Data (Rows 27 to 35, Columns F through H)
        const fhLandingData = [];
        landingRows.forEach(row => {
            const site = row?.[5] ? String(row[5]).trim() : "";
            const stats = row?.[6] ? String(row[6]).trim() : "";
            const rate = row?.[7] ? String(row[7]).trim() : "";
            if (site || stats || rate) {
                fhLandingData.push({ site, stats, rate });
            }
        });
        renderLandingStatsUI("fh-landing-metrics-list", "stat-fh-landings-total", fhLandingData);

    } catch (e) {
        console.error("Error parsing attempts data:", e);
    }
}

function renderLandingStatsUI(containerId, totalSpanId, landingData) {
    const container = document.getElementById(containerId);
    const totalSpan = document.getElementById(totalSpanId);
    if (!container) return;

    container.innerHTML = "";
    let overallHeaderRate = "Tracked";

    landingData.forEach((item, idx) => {
        if (idx === 0 && item.site.toLowerCase().includes("success rate")) {
            overallHeaderRate = `${item.stats} (${item.rate})`;
            return;
        }

        const p = document.createElement("p");
        p.style.margin = "0.2rem 0";
        p.style.display = "flex";
        p.style.justifyContent = "space-between";
        
        p.innerHTML = `
            <span>&bull; <strong>${item.site}</strong>:</span>
            <span>${item.stats} <span style="opacity: 0.8; font-size: 0.9em;">(${item.rate})</span></span>
        `;
        container.appendChild(p);
    });

    if (totalSpan) {
        totalSpan.textContent = overallHeaderRate;
    }
}

// =======================================
// Top Dashboard Metrics
// =======================================

function calculateTopStats() {
    if (!DataStore.f9Overview || DataStore.f9Overview.length === 0) return;

    let maxFlights = -1;
    let mostFlownSerial = "N/A";
    let bestTurnaroundDays = Infinity;
    let bestTurnaroundSerial = "N/A";
    let activeBoostersCount = 0;

    const statusMap = {};
    DataStore.f9Notes.forEach(nRow => {
        const serialKey = normalizeSerial(nRow[F9_NOTES_COLS.serial]);
        const statusVal = nRow[F9_NOTES_COLS.currentStatus];
        if (serialKey && hasText(statusVal) && !statusMap[serialKey]) {
            statusMap[serialKey] = statusVal;
        }
    });

    DataStore.f9Overview.forEach(row => {
        const serial = String(row[F9_OVERVIEW_COLS.serial] || "").trim();
        if (!hasText(serial) || serial.toLowerCase() === "serial" || serial.toLowerCase() === "booster") return;

        const flights = parseInt(row[F9_OVERVIEW_COLS.flights] || "0", 10);
        const bestTurnStr = String(row[F9_OVERVIEW_COLS.bestTurn] || "").trim();
        const fullSerial = serial.toUpperCase().startsWith("B") ? serial : `B${serial}`;
        const status = (statusMap[normalizeSerial(fullSerial)] || "").toLowerCase();

        if (!isNaN(flights) && flights > maxFlights) {
            maxFlights = flights;
            mostFlownSerial = fullSerial;
        }

        const turnNum = parseFloat(bestTurnStr.replace(/[^0-9.]/g, ""));
        if (!isNaN(turnNum) && turnNum > 0 && turnNum < bestTurnaroundDays) {
            bestTurnaroundDays = turnNum;
            bestTurnaroundSerial = `${fullSerial} (${turnNum} days)`;
        }

        if (status.includes("active") || status.includes("expendable") || status.includes("awaiting")) {
            activeBoostersCount++;
        }
    });

    const mostFlownEl = document.getElementById("stat-most-flown");
    const bestTurnEl = document.getElementById("stat-quickest-turn");
    const activeEl = document.getElementById("stat-active-fleet");

    if (mostFlownEl) mostFlownEl.textContent = `${mostFlownSerial} (${maxFlights} flights)`;
    if (bestTurnEl) bestTurnEl.textContent = bestTurnaroundSerial !== "N/A" ? bestTurnaroundSerial : "N/A";
    if (activeEl) activeEl.textContent = `${activeBoostersCount} Boosters`;
}

// =======================================
// Modal Detail Inspector
// =======================================

function openBoosterDetailModal(serial, overviewRow) {
    const detailModal = document.getElementById("vehicle-detail-modal");
    const modalTitle = document.getElementById("vehicle-detail-title");
    const container = document.getElementById("vehicle-detail-body");
    if (!detailModal || !container) return;

    const cols = F9_OVERVIEW_COLS;
    const val = (idx) => hasText(overviewRow?.[idx]) ? overviewRow[idx] : "&mdash;";

    if (modalTitle) modalTitle.textContent = `${serial} — Booster History & Log`;

    const targetKey = normalizeSerial(serial);
    const boosterNotes = DataStore.f9Notes.filter(r => normalizeSerial(r[F9_NOTES_COLS.serial]) === targetKey);

    let notesHtml = "";
    if (boosterNotes.length > 0) {
        boosterNotes.forEach((nRow) => {
            const flownFrom = nRow[F9_NOTES_COLS.lastFlownFrom] || "N/A";
            const landedAt = nRow[F9_NOTES_COLS.lastLandedAt] || "N/A";
            const status = nRow[F9_NOTES_COLS.currentStatus] || "N/A";
            const noteText = nRow[F9_NOTES_COLS.notes] || "";

            notesHtml += `
                <div class="note-entry-card" style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background: rgba(0,0,0,0.2);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                        <strong style="color: var(--accent-blue);">Status: ${status}</strong>
                        <span style="font-size: 0.85rem; opacity: 0.7;">From: ${flownFrom} &rarr; To: ${landedAt}</span>
                    </div>
                    <p style="margin: 0; font-size: 0.95rem; line-height: 1.4;">${noteText}</p>
                </div>
            `;
        });
    } else {
        notesHtml = `<p style="opacity: 0.7;">No logged notes found for booster ${serial}.</p>`;
    }

    container.innerHTML = `
        <div class="detail-sections-container">
            <section class="detail-section" style="margin-bottom: 1.5rem;">
                <h3 style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.3rem; color: var(--accent-blue);">Overview Metrics</h3>
                <div class="milestones-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                    <div><strong>Block:</strong> ${val(cols.block)}</div>
                    <div><strong>Flight Count:</strong> ${val(cols.flights)}</div>
                    <div><strong>First Flight:</strong> ${val(cols.firstFlight)}</div>
                    <div><strong>Latest Flight:</strong> ${val(cols.latestFlight)}</div>
                    <div><strong>Avg Turnaround:</strong> ${val(cols.avgTurn)}</div>
                    <div><strong>Best Turnaround:</strong> ${val(cols.bestTurn)}</div>
                    <div><strong>Worst Turnaround:</strong> ${val(cols.worstTurn)}</div>
                </div>
            </section>
            <section class="detail-section">
                <h3 style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 0.3rem; color: var(--accent-blue);">Booster Notes & Logs</h3>
                <div class="notes-list-wrapper">${notesHtml}</div>
            </section>
        </div>
    `;

    detailModal.classList.remove("hidden");
}

// =======================================
// Main Grid Renderer
// =======================================

function renderBoosterGrid() {
    const mainContainer = document.getElementById("f9-booster-cards-container");
    if (!mainContainer) return;

    mainContainer.innerHTML = "";

    if (!DataStore.f9Overview || DataStore.f9Overview.length === 0) {
        mainContainer.innerHTML = `<p class="empty-notice" style="text-align: center; padding: 2rem;">No booster records found in dataset.</p>`;
        return;
    }

    const validBoosters = DataStore.f9Overview.filter(row => {
        const serial = String(row?.[F9_OVERVIEW_COLS.serial] || "").trim();
        const lowerSerial = serial.toLowerCase();
        
        if (!hasText(serial)) return false;
        if (lowerSerial === "serial" || lowerSerial === "booster") return false;
        if (lowerSerial.includes("falcon 9 boosters") || lowerSerial.includes("falcon 9")) return false;
        
        return true;
    });

    const statusMap = {};
    DataStore.f9Notes.forEach(nRow => {
        const serialKey = normalizeSerial(nRow?.[F9_NOTES_COLS.serial]);
        const statusVal = nRow?.[F9_NOTES_COLS.currentStatus];
        if (serialKey && hasText(statusVal) && !statusMap[serialKey]) {
            statusMap[serialKey] = statusVal;
        }
    });

    const blockGroups = {};
    validBoosters.forEach(row => {
        let block = String(row?.[F9_OVERVIEW_COLS.block] || "Other / Unknown").trim();
        if (/^\d+$/.test(block)) block = `Block ${block}`;
        if (!blockGroups[block]) blockGroups[block] = [];
        blockGroups[block].push(row);
    });

    Object.keys(blockGroups).forEach(blockName => {
        const boosters = blockGroups[blockName];

        const section = document.createElement("section");
        section.className = "block-group-section";
        section.style.marginBottom = "2.5rem";

        section.innerHTML = `
            <h2 class="block-title" style="color: var(--accent-blue); border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 0.5rem; margin-bottom: 1.25rem;">
                ${blockName} (${boosters.length})
            </h2>
            <div class="cards-grid-family block-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;"></div>
        `;

        const gridContainer = section.querySelector(".block-grid");

        boosters.forEach(row => {
            const rawSerial = String(row?.[F9_OVERVIEW_COLS.serial] || "Unknown").trim();
            const boosterNum = rawSerial.replace(/^B/i, "");
            const displayTitle = `Booster ${boosterNum}`;
            const fullSerial = rawSerial.toUpperCase().startsWith("B") ? rawSerial : `B${rawSerial}`;

            const block = row?.[F9_OVERVIEW_COLS.block] || "N/A";
            const flights = row?.[F9_OVERVIEW_COLS.flights] || "0";
            const latestFlight = row?.[F9_OVERVIEW_COLS.latestFlight] || "N/A";
            const avgTurn = row?.[F9_OVERVIEW_COLS.avgTurn] || "N/A";
            const status = statusMap[normalizeSerial(fullSerial)] || "N/A";

            const card = document.createElement("div");
            card.className = "card family-card booster-card";
            card.style.cursor = "pointer";

            card.innerHTML = `
                <h2>${displayTitle}</h2>
                <p>Status: ${status}</p>
                <p>Block: ${block}</p>
                <p>Flights: ${flights}</p>
                <p>Latest Flight: ${latestFlight}</p>
                <p>Avg Turnaround: ${avgTurn}</p>
            `;

            card.onclick = () => openBoosterDetailModal(fullSerial, row);
            gridContainer.appendChild(card);
        });

        mainContainer.appendChild(section);
    });
}

// =======================================
// Data Fetcher
// =======================================

function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data || []),
            error: (err) => reject(err)
        });
    });
}

async function loadAllFalcon9Data() {
    const mainContainer = document.getElementById("f9-booster-cards-container");
    if (mainContainer) {
        mainContainer.innerHTML = `<p class="loading-notice" style="text-align: center; padding: 2rem;">Loading Falcon 9 Fleet...</p>`;
    }

    try {
        const [overviewData, notesData, attemptsData] = await Promise.all([
            fetchCSV(URLs.f9Overview),
            fetchCSV(URLs.f9Notes),
            fetchCSV(URLs.f9Attempts)
        ]);

        DataStore.f9Overview = overviewData;
        DataStore.f9Notes = notesData;
        DataStore.f9Attempts = attemptsData;

        calculateTopStats();
        parseAttemptsData();
        renderBoosterGrid();
    } catch (err) {
        console.error("Error loading Falcon 9 CSV datasets:", err);
        if (mainContainer) {
            mainContainer.innerHTML = `<p class="error-notice" style="text-align: center; color: #ff6b6b; padding: 2rem;">Unable to load Falcon 9 data. Check console for details.</p>`;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAllFalcon9Data();

    const detailModal = document.getElementById("vehicle-detail-modal");
    const closeDetailBtn = document.getElementById("close-vehicle-detail");

    if (closeDetailBtn && detailModal) {
        closeDetailBtn.onclick = () => detailModal.classList.add("hidden");
    }

    if (detailModal) {
        detailModal.onclick = (e) => {
            if (e.target === detailModal) detailModal.classList.add("hidden");
        };
    }
});
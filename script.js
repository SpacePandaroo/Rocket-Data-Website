// =======================================
// Google Sheet Settings
// =======================================

const SHEET_ID = "15f0ig9CIZE-m705V-9YRzQBVwJ3Bbj0wvFU0y9zarlU";
const GID = "0";

const CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;


// =======================================
// Load Sheet
// =======================================

function parseNumericValue(value) {
    if (value === null || value === undefined) return NaN;

    const cleaned = String(value).replace(/,/g, "").trim();
    if (cleaned === "") return NaN;

    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
}

async function loadSheet() {
    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,

        complete: function(results) {
            const data = results.data || [];

            const flightsHeader = Object.keys(data[0] || {}).find(
                key => key.trim().toLowerCase() === "total world flights"
            );

            const numericFlights = data
                .map(row => parseNumericValue(row[flightsHeader]))
                .filter(value => Number.isFinite(value));

            const maxFlights = numericFlights.length > 0
                ? Math.max(...numericFlights)
                : 0;

            const countElement = document.getElementById("total-count");
            if (countElement) {
                countElement.textContent = maxFlights.toLocaleString();
            }
        },

        error: function(error) {
            console.error("Sheet loading error:", error);
        }
    });
}


// =======================================
// Build HTML Table
// =======================================

function buildTable(data) {

    const table = document.getElementById("sheetTable");

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    if (data.length === 0) return;


    // Build Header

    const headers = Object.keys(data[0]);

    thead.innerHTML =
        "<tr>" +
        headers.map(h => `<th>${h}</th>`).join("") +
        "</tr>";


    // Build Rows

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
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

async function loadSheet() {

    Papa.parse(CSV_URL, {
    download: true,
    header: true,

    complete: function(results) {
        const data = results.data;

        // Find highest number in "Total World Flights"
        const maxFlights = Math.max(
            data.map(row => Number(row["Total World Flights"]))
        );

        // Put it into your HTML
        document.getElementById("total-count").textContent = maxFlights.toLocaleString();
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
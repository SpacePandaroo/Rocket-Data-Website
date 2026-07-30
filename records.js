const spreadsheetID = "15f0ig9CIZE-m705V-9YRzQBVwJ3Bbj0wvFU0y9zarlU";


function loadSheetRange(range, callback) {

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetID}/gviz/tq?tqx=out:csv&range=${range}`;

    Papa.parse(url, {
        download: true,
        header: false,
        complete: function(results) {
            callback(results.data);
        }
    });

}


function createRankingTable(range, tableID) {

    loadSheetRange(range, function(data) {

        const table = document.querySelector(tableID);

        data.forEach(row => {

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${row[0]}</td>
                <td>${row[1]}</td>
                <td>${row[2]}</td>
            `;

            table.appendChild(tr);

        });

    });

}



document.addEventListener("DOMContentLoaded", () => {

    // Most Flown Family
    createRankingTable("B28:D37", "#family-ranking");


    // Most Flown Subfamily
    createRankingTable("F28:H37", "#subfamily-ranking");

    //Most Flown Configuration
    createRankingTable("J28:L37", "#configuration-ranking");

});
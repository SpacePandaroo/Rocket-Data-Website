// =======================================
// Google Sheet Settings
// =======================================

const SHEET_ID = "1wvDim8CPsWJoQYLiSDkJhfKS2nINDKRHWAcyjsnV9UY";

const LAUNCH_SHEET_GID = "0";
const VEHICLE_SHEET_GID = "1074736179";


const LAUNCH_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${LAUNCH_SHEET_GID}`;

const VEHICLE_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${VEHICLE_SHEET_GID}`;


// =======================================
// Launch Sheet Columns
// =======================================

const COLUMN_INDICES = {

    totalFlights: 0,
    date: 5,
    vehicleFamily: 7,
    vehicleSub: 8,
    vehicleConfig: 9,
    missionName: 19,
    outcome: 20,
    s1Landing: 21,
    s2Landing: 22

};


// =======================================
// Vehicle Sheet Columns
// =======================================

const VEHICLE_COLUMNS = {

    family: 1,            // B
    subFamily: 2,         // C
    configuration: 3,     // D

    launches: 4,          // E
    success: 5,           // F
    partial: 6,           // G
    failure: 7,           // H

    status: 8,            // I

    lifespan: 10,         // K
    yearsActive: 11,      // L
    firstLaunch: 12,      // M
    lastLaunch: 13        // N

};


// =======================================
// Helpers
// =======================================

function hasText(value) {

    return String(value ?? "").trim() !== "";

}


function parseNumericValue(value) {

    if (!hasText(value))
        return 0;


    const num =
        Number(
            String(value)
                .replace(/,/g, "")
                .trim()
        );


    return Number.isFinite(num)
        ? num
        : 0;

}


function parseLaunchDate(value) {

    if (!hasText(value))
        return null;


    const date =
        new Date(value);


    return Number.isNaN(date.getTime())
        ? null
        : date;

}


// =======================================
// Launch Data
// =======================================

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


// =======================================
// Recent Launches
// =======================================

function buildRecentLaunches(launches) {


    const list =
        document.getElementById("recent-launches");


    if (!list)
        return;



    const now =
        new Date();


    const cutoff =
        new Date();


    cutoff.setDate(
        now.getDate() - 7
    );



    const recent =
        launches

            .map(entry => ({

                ...entry,
                parsedDate:
                    parseLaunchDate(entry.date)

            }))

            .filter(entry =>

                entry.parsedDate &&
                entry.parsedDate >= cutoff &&
                entry.parsedDate <= now

            )

            .sort((a, b) =>

                b.parsedDate - a.parsedDate

            );



    list.innerHTML = "";



    if (recent.length === 0)
    {


        const li =
            document.createElement("li");


        li.textContent =
            "No launches in the last 7 days";


        list.appendChild(li);

        return;

    }



    recent.forEach(entry => {


        const li =
            document.createElement("li");


        li.textContent = [

            entry.date,
            entry.missionName,
            entry.vehicle,
            entry.outcome,
            entry.s1Landing
                ? `S1: ${entry.s1Landing}`
                : "",
            entry.s2Landing
                ? `S2: ${entry.s2Landing}`
                : ""

        ]
            .filter(hasText)
            .join(" | ");



        list.appendChild(li);


    });


}


// =======================================
// Vehicle Family Cards
// =======================================

function buildVehicleCards(rows) {


    const container =
        document.getElementById(
            "vehicle-families"
        );


    if (!container)
        return;



    container.innerHTML = "";



    const families = {};



    rows.forEach(row => {


        const family =
            row[VEHICLE_COLUMNS.family];


        if (!hasText(family))
            return;



        if (!families[family])
        {

            families[family] = [];

        }


        families[family].push(row);


    });



    Object.entries(families)

        .forEach(([family, vehicles]) => {



            const launches =
                vehicles.reduce(

                    (sum, row) =>

                        sum +
                        parseNumericValue(
                            row[VEHICLE_COLUMNS.launches]
                        ),

                    0

                );



            const success =
                vehicles.reduce(

                    (sum, row) =>

                        sum +
                        parseNumericValue(
                            row[VEHICLE_COLUMNS.success]
                        ),

                    0

                );



            const partial =
                vehicles.reduce(

                    (sum, row) =>

                        sum +
                        parseNumericValue(
                            row[VEHICLE_COLUMNS.partial]
                        ),

                    0

                );



            const failure =
                vehicles.reduce(

                    (sum, row) =>

                        sum +
                        parseNumericValue(
                            row[VEHICLE_COLUMNS.failure]
                        ),

                    0

                );



            const weightedSuccess =
                success + (partial * 0.5);



            const card =
                document.createElement("div");



            card.className =
                "card family-card";



            card.innerHTML = `

            <h2>
                ${family} Family
            </h2>


            <p>
                Launches:
                ${launches}
            </p>


            <p>
                Success Rate:
                ${launches
                    ? ((weightedSuccess / launches) * 100)
                        .toFixed(2)
                    : "0.00"
                }%
            </p>


            <p>
                Success:
                ${success}
            </p>


            <p>
                Partial:
                ${partial}
            </p>


            <p>
                Failure:
                ${failure}
            </p>


            <p>
                Configurations:
                ${vehicles.length}
            </p>

        `;



            card.onclick = () => {

                openVehicleModal(
                    family,
                    vehicles
                );

            };



            container.appendChild(card);


        });


}


// =======================================
// Vehicle Detail Popup
// =======================================

function openVehicleModal(family, vehicles) {


    const modal =
        document.getElementById(
            "vehicle-modal"
        );


    const body =
        document.getElementById(
            "modal-body"
        );


    const familyInfo = {

        lifespan:
            vehicles
                .map(row => row[VEHICLE_COLUMNS.lifespan])
                .filter(hasText)[0] || "N/A",


        firstLaunch:
            vehicles
                .map(row => parseLaunchDate(row[VEHICLE_COLUMNS.firstLaunch]))
                .filter(Boolean)
                .sort((a, b) => a - b)[0],


        lastLaunch:
            vehicles
                .map(row => parseLaunchDate(row[VEHICLE_COLUMNS.lastLaunch]))
                .filter(Boolean)
                .sort((a, b) => b - a)[0]

    };

    const activeYears = vehicles
        .flatMap(row => [

            row[VEHICLE_COLUMNS.firstLaunch],
            row[VEHICLE_COLUMNS.lastLaunch]

        ])
        .map(date => parseLaunchDate(date))
        .filter(Boolean)
        .map(date => date.getFullYear());


    const familyYears =
        activeYears.length
            ? `${Math.min(...activeYears)} - ${Math.max(...activeYears)}`
            : "N/A";



    let html = `

        <h2>
            ${family} Family
        </h2>


        <div class="family-summary">


            <p>
                <strong>Lifespan:</strong>
                ${familyInfo.lifespan}
            </p>


            <p>
                <strong>Years Active:</strong>
                ${familyYears}
            </p>


            <p>
                <strong>First Launch:</strong>
                ${familyInfo.firstLaunch
            ? familyInfo.firstLaunch.toLocaleString("en-US", {
                timeZone: "UTC"
            }) + " UTC"
            : "N/A"}
            </p>


            <p>
                <strong>Last Launch:</strong>
                ${familyInfo.lastLaunch
            ? familyInfo.lastLaunch.toLocaleString("en-US", {
                timeZone: "UTC"
            }) + " UTC"
            : "N/A"}
            </p>


        </div>


        <hr>


        <h3>
            Configurations
        </h3>

    `;



    vehicles.forEach(row => {



        const launches =
            parseNumericValue(
                row[VEHICLE_COLUMNS.launches]
            );


        const success =
            parseNumericValue(
                row[VEHICLE_COLUMNS.success]
            );


        const partial =
            parseNumericValue(
                row[VEHICLE_COLUMNS.partial]
            );


        const failure =
            parseNumericValue(
                row[VEHICLE_COLUMNS.failure]
            );


        const weighted =
            success + (partial * 0.5);



        const rate =
            launches
                ? ((weighted / launches) * 100)
                    .toFixed(2)
                : "0.00";



        html += `


        <div class="vehicle-config">


            <h3>
                ${row[VEHICLE_COLUMNS.configuration]}
            </h3>


            <p>
                Sub Family:
                ${row[VEHICLE_COLUMNS.subFamily] || "N/A"}
            </p>


            <p>
                Status:
                ${row[VEHICLE_COLUMNS.status] || "Unknown"}
            </p>


            <p>
                Launches:
                ${launches}
            </p>


            <p>
                Success:
                ${success}
            </p>


            <p>
                Partial:
                ${partial}
            </p>


            <p>
                Failure:
                ${failure}
            </p>


            <p>
                Success Rate:
                ${rate}%
            </p>


        </div>


        `;


    });



    body.innerHTML =
        html;



    modal.classList.remove(
        "hidden"
    );

}


// =======================================
// Load Launch Sheet
// =======================================

function loadLaunchSheet() {


    Papa.parse(

        LAUNCH_CSV_URL,

        {

            download: true,
            skipEmptyLines: true,


            complete(results) {


                const rows =
                    results.data;



                const dataRows =
                    rows
                        .slice(1)
                        .filter(row =>
                            row.some(hasText)
                        );



                const totalFlights =
                    Math.max(

                        ...dataRows.map(row =>

                            parseNumericValue(
                                row[COLUMN_INDICES.totalFlights]
                            )

                        )

                    );



                const count =
                    document.getElementById(
                        "total-count"
                    );



                if (count)
                {

                    count.textContent =
                        totalFlights.toLocaleString();

                }



                buildRecentLaunches(

                    dataRows.map(
                        buildLaunchEntry
                    )

                );


            }

        }

    );


}


// =======================================
// Load Vehicle Sheet
// =======================================

function loadVehicleSheet() {


    Papa.parse(

        VEHICLE_CSV_URL,

        {

            download: true,
            skipEmptyLines: true,


            complete(results) {


                const rows =
                    results.data
                        .slice(1)
                        .filter(row =>
                            row.some(hasText)
                        );



                buildVehicleCards(rows);


            }

        }

    );


}


// =======================================
// Modal Controls
// =======================================

document.addEventListener(
    "DOMContentLoaded",
    () => {


        const modal =
            document.getElementById(
                "vehicle-modal"
            );


        const close =
            document.getElementById(
                "close-modal"
            );


        close.onclick = () => {

            modal.classList.add(
                "hidden"
            );

        };



        modal.onclick = (event) => {

            if (event.target === modal)
            {

                modal.classList.add(
                    "hidden"
                );

            }

        };


    }
);


// =======================================
// Start
// =======================================

loadLaunchSheet();

loadVehicleSheet();
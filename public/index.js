let robotMarkers = {}; // Object to keep track of markers for all robots
const editedPositions =
  JSON.parse(localStorage.getItem("editedPositions")) || {}; // Ensure it's defined

// Display all robot markers on the map
function displayAllRobotMarkers(robots) {
  Object.values(robotMarkers).forEach((marker) => {
    map.removeLayer(marker); // Clear existing markers
  });
  robotMarkers = {}; // Reset markers

  robots.forEach((robot) => {
    const position =
      getPositionFromLocalStorage(robot.serialNumber) || robot.position;

    if (
      position &&
      position.latitude !== undefined &&
      position.longitude !== undefined
    ) {
      const marker = L.marker([position.latitude, position.longitude])
        .addTo(map)
        .bindPopup(
          `<div>
            <strong>${robot.name || robot.serialNumber}</strong><br>
            (${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)})
          </div>`
        );
      robotMarkers[robot.serialNumber] = marker;
    }
  });

  // Adjust map view to fit all markers
  const bounds = L.latLngBounds(
    Object.values(robotMarkers).map((marker) => marker.getLatLng())
  );
  if (bounds.isValid()) {
    map.fitBounds(bounds);
  }
}

// Filter robots in the list and map
function filterRobots() {
  const searchTerm = document
    .getElementById("robot-search")
    .value.toLowerCase();
  const robots = document.querySelectorAll(".robot-item");

  robots.forEach((robot) => {
    const name = robot.querySelector("h3").textContent.toLowerCase();
    const serial = robot.querySelector("p").textContent.toLowerCase();

    if (name.includes(searchTerm) || serial.includes(searchTerm)) {
      robot.style.display = "block";
      const position = getPositionFromLocalStorage(robot.dataset.serial);
      if (position && robotMarkers[robot.dataset.serial]) {
        robotMarkers[robot.dataset.serial].addTo(map);
      }
    } else {
      robot.style.display = "none";
      if (robotMarkers[robot.dataset.serial]) {
        map.removeLayer(robotMarkers[robot.dataset.serial]);
      }
    }
  });

  // Adjust map view after filtering
  const bounds = L.latLngBounds(
    Object.values(robotMarkers).map((marker) => marker.getLatLng())
  );
  if (bounds.isValid()) {
    map.fitBounds(bounds);
  }
}

// Save edited position to Local Storage
function savePositionToLocalStorage(serialNumber, latitude, longitude) {
  // Save the new position to Local Storage
  editedPositions[serialNumber] = { latitude, longitude };
  localStorage.setItem("editedPositions", JSON.stringify(editedPositions));

  // Update Marker on the map
  if (robotMarkers[serialNumber]) {
    map.removeLayer(robotMarkers[serialNumber]);
  }
  const marker = L.marker([latitude, longitude])
    .addTo(map)
    .bindPopup(
      `<div>
        <strong>${serialNumber}</strong><br>
        (${latitude.toFixed(6)}, ${longitude.toFixed(6)})
      </div>`
    );
  robotMarkers[serialNumber] = marker;

  // Adjust map view to the new marker
  map.setView([latitude, longitude], 15);

  console.log(
    `Position updated for ${serialNumber}: (${latitude}, ${longitude})`
  );
}

// Get position from Local Storage
function getPositionFromLocalStorage(serialNumber) {
  return editedPositions[serialNumber];
}

// Load robots and display markers
async function loadRobots() {
  try {
    const response = await fetch("/api/robots");

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();

    const container = document.getElementById("robots-container");
    container.innerHTML = data.robots
      .map(
        (robot) => `
          <div class="robot-item" data-serial="${robot.serialNumber}">
            <h3>${robot.name}</h3>
            <p>Model: ${robot.modelTypeCode}</p>
            <p>SN: ${robot.serialNumber}</p>
            <p>Online: ${robot.online}
              <span class="status-indicator ${robot.online ? "status-online" : "status-offline"}"></span>
            </p>
          </div>
        `
      )
      .join("");

    // Add click handlers
    document.querySelectorAll(".robot-item").forEach((item) => {
      item.addEventListener("click", () => selectRobot(item.dataset.serial));
    });

    // Display all markers
    displayAllRobotMarkers(data.robots);
    filterRobots();
  } catch (error) {
    console.error("Error loading robots:", error);
    document.getElementById("robots-container").innerHTML =
      '<div class="error">Error loading robots. Please try again later.</div>';
  }
}

// Fetch device details
async function fetchDeviceDetails(serialNumber) {
  try {
    const response = await fetch(`/api/robots/${serialNumber}/device`);
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const deviceData = await response.json();

    let deviceDetailsHTML = "";

    // Vacuum status
    if (deviceData.vacuum?.enabled !== undefined) {
      deviceDetailsHTML += `
        <div class="stat-card">
          <h4>Vacuum</h4>
          <p>${deviceData.vacuum.enabled ? "Enabled" : "Disabled"}</p>
        </div>`;
    }

    // Clean Water Tank Level
    if (deviceData.cleanWaterTank?.level !== undefined) {
      deviceDetailsHTML += `
        <div class="stat-card">
          <h4>Clean Water Tank Level</h4>
          <p>${deviceData.cleanWaterTank.level}%</p>
        </div>`;
    }

    // Recovery Water Tank Level
    if (deviceData.recoveryWaterTank?.level !== undefined) {
      deviceDetailsHTML += `
        <div class="stat-card">
          <h4>Recovery Water Tank Level</h4>
          <p>${deviceData.recoveryWaterTank.level}%</p>
        </div>`;
    }

    // Rolling Brush details
    if (deviceData.rollingBrush) {
      deviceDetailsHTML += `
        <div class="stat-card">
          <h4>Rolling Brush</h4>
          <p>${deviceData.rollingBrush.enabled ? "Enabled" : "Disabled"}</p>
          <p>Put Down: ${deviceData.rollingBrush.ifPutDown ? "Yes" : "No"}</p>
        </div>`;
    }

    // Spray details
    if (deviceData.spray) {
      deviceDetailsHTML += `
        <div class="stat-card">
          <h4>Spray</h4>
          <p>${deviceData.spray.isRunning ? "Running" : "Stopped"}</p>
          <p>Water Level: ${deviceData.spray.waterLevel}%</p>
        </div>`;
    }

    // Display the details or a fallback message
    document.getElementById("device-details").innerHTML =
      deviceDetailsHTML ||
      '<div class="error">No device details available.</div>';
  } catch (error) {
    console.error("Error fetching device details:", error);
    document.getElementById("device-details").innerHTML =
      '<div class="error">Error loading device details. Please try again later.</div>';
  }
}

// Handle robot selection
async function selectRobot(serialNumber) {
  document
    .querySelectorAll(".robot-item")
    .forEach((i) => i.classList.remove("selected"));
  document
    .querySelector(`[data-serial="${serialNumber}"]`)
    .classList.add("selected");

  try {
    const statusResponse = await fetch(`/api/robots/${serialNumber}/status`);
    if (!statusResponse.ok) {
      throw new Error(`Error: ${statusResponse.statusText}`);
    }

    const status = await statusResponse.json();

    let position = status.position;
    const editedPosition = getPositionFromLocalStorage(serialNumber);
    if (editedPosition) {
      position = editedPosition;
    }

    if (position) {
      if (robotMarkers[serialNumber]) {
        map.removeLayer(robotMarkers[serialNumber]);
      }
      const marker = L.marker([position.latitude, position.longitude])
        .addTo(map)
        .bindPopup(
          `<div><strong>${serialNumber}</strong><br>
            (${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)})
          </div>`
        );
      robotMarkers[serialNumber] = marker;
      map.setView([position.latitude, position.longitude], 15);
    }

    document.getElementById("robot-details").innerHTML = `
    <div class="robot-card">
      <h4>${status.name || serialNumber}</h4>
      <div class="robot-info">
        <p><strong>Serial Number: </strong> ${serialNumber}</p>
        <p><strong>Status: </strong> ${status.taskState || "Unknown"}</p>
        <p><strong>Battery: </strong> ${status.battery?.powerPercentage || "N/A"
      }%</p>
        <p><strong>Status: </strong> ${status.taskState || "Unknown"}</p>
        <p><strong>Speed: </strong> ${(
        status.speedKilometerPerHour || 0
      ).toFixed(3)} km/h</p>
        <p><strong>Emergency Stop: </strong> ${status.emergencyStop?.enabled ? "Enabled" : "Disabled"
      }</p>
        <p><strong>Current Task: </strong> ${status.executingTask?.name || "None"
      } (${status.executingTask?.progress || 0}% complete${status.executingTask?.timeRemaining
        ? `, ${status.executingTask.timeRemaining} mins remaining`
        : ""
      })</p>
      </div>
    </div>`;
    await fetchDeviceDetails(serialNumber);
  } catch (error) {
    console.error("Error fetching robot details:", error);
    document.getElementById("robot-details").innerHTML =
      '<div class="error">Error loading robot details. Please try again later.</div>';
  }
}

// Initialize the map
const map = L.map("map").setView([13.7563, 100.5018], 13); // Default view of Bangkok
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

document
  .getElementById("edit-location-form")
  .addEventListener("submit", (event) => {
    event.preventDefault();

    const latitude = parseFloat(document.getElementById("latitude").value);
    const longitude = parseFloat(document.getElementById("longitude").value);

    const selectedRobot = document.querySelector(".robot-item.selected");
    if (!selectedRobot) {
      alert("Please select a robot first.");
      return;
    }

    const serialNumber = selectedRobot.dataset.serial;

    // Save the new position and update the map
    savePositionToLocalStorage(serialNumber, latitude, longitude);
    alert(`Position updated for robot ${serialNumber}.`);
  });

//search
document.getElementById("robot-search").addEventListener("input", filterRobots);

function filterRobots() {
  const searchTerm = document
    .getElementById("robot-search")
    .value.toLowerCase();
  const robots = document.querySelectorAll(".robot-item");

  robots.forEach((robot) => {
    const name = robot.querySelector("h3").textContent.toLowerCase();
    const serial = robot.querySelector("p").textContent.toLowerCase();
    const robotSerial = robot.dataset.serial;

    // Check if search term matches robot name or serial number
    if (name.includes(searchTerm) || serial.includes(searchTerm)) {
      robot.style.display = "block";
      const position = getPositionFromLocalStorage(robotSerial);
      if (position && robotMarkers[robotSerial]) {
        // Ensure marker is displayed when robot is found
        robotMarkers[robotSerial].addTo(map);
      }
    } else {
      robot.style.display = "none";
      if (robotMarkers[robotSerial]) {
        map.removeLayer(robotMarkers[robotSerial]);
      }
    }
  });

  // Adjust map view after filtering to fit remaining visible markers
  const bounds = L.latLngBounds(
    Object.values(robotMarkers).map((marker) => marker.getLatLng())
  );
  if (bounds.isValid()) {
    map.fitBounds(bounds);
  }
}


// Load robots initially and refresh every 30 seconds
loadRobots();
setInterval(loadRobots, 30000);

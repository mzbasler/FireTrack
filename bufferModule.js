(function (namespace) {
  let bufferLayer = null;
  let bufferPolygon = null;
  let isDrawing = false;
  let points = [];
  let drawingOverlay = null;

  function initialize() {
    const map = namespace.MapModule.getMap();
    if (!map) {
      console.error("Mapa não disponível para o módulo de buffer!");
      return false;
    }

    // Create buffer layer group
    bufferLayer = L.layerGroup().addTo(map);

    // Setup drawing overlay with error handling
    try {
      setupDrawingOverlay(map);
    } catch (error) {
      console.error("Erro ao configurar overlay de desenho:", error);
      // Fallback overlay implementation
      drawingOverlay = {
        update: function (text) {
          console.log("Instrução de desenho:", text);
        },
        _div: null,
      };
    }

    // Setup event listeners
    const addBufferBtn = document.getElementById("addBufferBtn");
    if (addBufferBtn) {
      addBufferBtn.addEventListener("click", startDrawing);
    }

    document.addEventListener("heatPointsUpdated", checkFocosNoBuffer);

    return true;
  }

  function setupDrawingOverlay(map) {
    // Verify map container exists
    const mapContainer = map.getContainer();
    if (!mapContainer) {
      throw new Error("Container do mapa não encontrado");
    }

    // Create overlay div element
    const overlayDiv = document.createElement("div");
    overlayDiv.className = "drawing-overlay";
    overlayDiv.style.display = "none";
    overlayDiv.style.position = "absolute";
    overlayDiv.style.top = "10px";
    overlayDiv.style.left = "50%";
    overlayDiv.style.transform = "translateX(-50%)";
    overlayDiv.style.zIndex = "1000";
    overlayDiv.style.padding = "10px 15px";
    overlayDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    overlayDiv.style.color = "white";
    overlayDiv.style.borderRadius = "5px";
    overlayDiv.style.fontWeight = "bold";
    overlayDiv.style.pointerEvents = "none";

    // Add to map container
    mapContainer.appendChild(overlayDiv);

    // Configure overlay object
    drawingOverlay = {
      _div: overlayDiv,
      update: function (text) {
        if (!this._div) return;
        this._div.innerHTML = text || "";
        this._div.style.display = text ? "block" : "none";

        // Center overlay
        if (text && mapContainer) {
          const mapWidth = mapContainer.offsetWidth;
          const overlayWidth = this._div.offsetWidth;
          this._div.style.left = `${(mapWidth - overlayWidth) / 2}px`;
        }
      },
    };

    // Prevent map interaction through overlay
    L.DomEvent.disableClickPropagation(overlayDiv);
    L.DomEvent.disableScrollPropagation(overlayDiv);
  }

  function startDrawing() {
    if (isDrawing) return;

    const map = namespace.MapModule.getMap();
    if (!map) return;

    isDrawing = true;
    points = [];
    map.dragging.disable();
    map._container.style.cursor = "crosshair";

    if (drawingOverlay) {
      drawingOverlay.update("Clique no primeiro ponto do buffer");
    }

    map.on("click", handleMapClick);
    document.addEventListener("keydown", handleKeyPress);
  }

  function handleMapClick(e) {
    if (!isDrawing) return;

    points.push(e.latlng);

    if (points.length === 1) {
      if (drawingOverlay) {
        drawingOverlay.update("Clique no segundo ponto para definir o raio");
      }

      // Mark first point
      L.circleMarker(points[0], {
        radius: 5,
        color: "#ff4500",
        fillColor: "#ff4500",
        fillOpacity: 1,
      }).addTo(bufferLayer);
    } else if (points.length === 2) {
      finishDrawing();
    }
  }

  function finishDrawing() {
    const map = namespace.MapModule.getMap();
    if (!map) return;

    isDrawing = false;
    map.dragging.enable();
    map._container.style.cursor = "";

    if (drawingOverlay) {
      drawingOverlay.update("");
    }

    map.off("click", handleMapClick);
    document.removeEventListener("keydown", handleKeyPress);

    createBuffer(points);
    addBufferToList(points);
  }

  function createBuffer(points) {
    if (!points || points.length !== 2 || !bufferLayer) return;

    bufferLayer.clearLayers();

    const lineCoords = points.map((p) => [p.lat, p.lng]);
    const line = turf.lineString(
      lineCoords.map((coord) => [coord[1], coord[0]])
    );
    const distance = turf.distance(
      turf.point([lineCoords[0][1], lineCoords[0][0]]),
      turf.point([lineCoords[1][1], lineCoords[1][0]]),
      { units: "kilometers" }
    );

    const point = turf.point([lineCoords[0][1], lineCoords[0][0]]);
    bufferPolygon = turf.buffer(point, distance, { units: "kilometers" });

    // Add buffer polygon to map
    L.geoJSON(bufferPolygon, {
      style: {
        color: "#3388ff",
        weight: 2,
        opacity: 0.7,
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      },
    }).addTo(bufferLayer);

    // Add markers for points
    points.forEach((point, index) => {
      L.circleMarker([point.lat, point.lng], {
        radius: 5,
        color: index === 0 ? "#ff4500" : "#32cd32",
        fillColor: index === 0 ? "#ff4500" : "#32cd32",
        fillOpacity: 1,
      }).addTo(bufferLayer);
    });

    checkFocosNoBuffer();
  }

  function checkFocosNoBuffer() {
    if (!bufferPolygon) return;

    const heatPoints = namespace.DataModule.getHeatPoints();
    if (!heatPoints || heatPoints.length === 0) return;

    const focosCount = heatPoints.filter((point) => {
      const pt = turf.point([point.longitude, point.latitude]);
      return turf.booleanPointInPolygon(pt, bufferPolygon);
    }).length;

    if (focosCount > 0) {
      showAlert(`Focos detectados no buffer: ${focosCount}`);
    }
  }

  function addBufferToList(points) {
    if (!points || points.length !== 2) return;

    const distance = turf
      .distance(
        turf.point([points[0].lng, points[0].lat]),
        turf.point([points[1].lng, points[1].lat]),
        { units: "kilometers" }
      )
      .toFixed(2);

    const bufferItem = document.createElement("div");
    bufferItem.className = "geofence-item buffer-item";
    bufferItem.innerHTML = `
      <div class="geofence-header">
        <span class="geofence-name">Buffer (${distance} km)</span>
        <button class="delete-btn">&times;</button>
      </div>
    `;

    // Add delete functionality
    bufferItem.querySelector(".delete-btn").addEventListener("click", () => {
      if (bufferLayer) bufferLayer.clearLayers();
      bufferPolygon = null;
      bufferItem.remove();
    });

    // Add to geofence list
    const geofenceList = document.getElementById("geofenceList");
    if (geofenceList) {
      geofenceList.appendChild(bufferItem);
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Escape") {
      cancelDrawing();
    }
  }

  function cancelDrawing() {
    if (!isDrawing) return;

    if (bufferLayer) bufferLayer.clearLayers();
    isDrawing = false;
    points = [];

    const map = namespace.MapModule.getMap();
    if (map) {
      map.dragging.enable();
      map._container.style.cursor = "";
      map.off("click", handleMapClick);
    }

    if (drawingOverlay) {
      drawingOverlay.update("");
    }

    document.removeEventListener("keydown", handleKeyPress);
  }

  function showAlert(message) {
    const alertsContainer = document.getElementById("alerts");
    if (!alertsContainer) return;

    const alertDiv = document.createElement("div");
    alertDiv.className = "alert-notification alert alert-danger";
    alertDiv.innerHTML = `
      <i class="bi bi-exclamation-triangle"></i> ${message}
      <span class="float-end">&times;</span>
    `;

    alertDiv.querySelector(".float-end").addEventListener("click", () => {
      alertDiv.remove();
    });

    alertsContainer.prepend(alertDiv);
  }

  namespace.BufferModule = {
    init: initialize,
    getBufferPolygon: function () {
      return bufferPolygon;
    },
    cancelDrawing: cancelDrawing,
  };
})(window.FireTrack || (window.FireTrack = {}));

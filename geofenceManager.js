(function (namespace) {
  let geofenceLayer = null;
  let importedGeofences = [];
  let isActive = true;

  function initialize() {
    const map = namespace.MapModule.getMap();
    if (!map) {
      console.error("Mapa não disponível para o gerenciador de áreas!");
      return false;
    }

    geofenceLayer = L.layerGroup().addTo(map);
    document
      .getElementById("geofenceToggle")
      ?.addEventListener("change", toggleGeofenceLayer);
    document
      .getElementById("geofenceFile")
      ?.addEventListener("change", handleFileSelect);
    document.addEventListener("heatPointsUpdated", checkFocosInGeofences);

    return true;
  }

  function toggleGeofenceLayer(e) {
    isActive = e?.target?.checked ?? true;
    const map = namespace.MapModule.getMap();

    if (!geofenceLayer || !map) return;

    if (isActive) {
      geofenceLayer.addTo(map);
    } else {
      geofenceLayer.remove();
    }
  }

  function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          let geojson;
          if (file.name.endsWith(".kml")) {
            const kml = new DOMParser().parseFromString(
              e.target.result,
              "text/xml"
            );
            geojson = toGeoJSON.kml(kml);
          } else {
            geojson = JSON.parse(e.target.result);
          }

          addGeofenceToMap(geojson, file.name);
        } catch (error) {
          console.error(`Erro ao processar arquivo ${file.name}:`, error);
          showAlert(`Erro ao processar arquivo: ${file.name}`);
        }
      };
      reader.onerror = () => console.error(`Erro ao ler arquivo ${file.name}`);
      reader.readAsText(file);
    });

    event.target.value = "";
  }

  function addGeofenceToMap(geojson, name) {
    const color = getRandomColor();
    const layer = L.geoJSON(geojson, {
      style: {
        color: color,
        weight: 3,
        opacity: 0.7,
        fillColor: color,
        fillOpacity: 0.2,
      },
      onEachFeature: function (feature, layer) {
        if (feature.properties) {
          const props = Object.entries(feature.properties)
            .filter(
              ([key, value]) =>
                value !== null && value !== undefined && value !== ""
            )
            .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
            .join("<br>");

          if (props) layer.bindPopup(props);
        }
      },
    }).addTo(geofenceLayer);

    const geofenceInfo = {
      id: `geofence-${Date.now()}`,
      name: name,
      layer: layer,
      color: color,
    };

    importedGeofences.push(geofenceInfo);
    addGeofenceToList(geofenceInfo);
    checkFocosInGeofences();
  }

  function addGeofenceToList(geofence) {
    const geofenceList = document.getElementById("geofenceList");
    if (!geofenceList) return;

    const emptyAlert = geofenceList.querySelector(".alert-info");
    if (emptyAlert) emptyAlert.remove();

    const geofenceItem = document.createElement("div");
    geofenceItem.className = "geofence-item";
    geofenceItem.innerHTML = `
      <div class="geofence-header">
        <span class="geofence-name">${geofence.name}</span>
        <button class="delete-btn">&times;</button>
      </div>
    `;

    geofenceItem.querySelector(".delete-btn").addEventListener("click", () => {
      geofenceLayer.removeLayer(geofence.layer);
      importedGeofences = importedGeofences.filter((g) => g.id !== geofence.id);
      geofenceItem.remove();

      if (geofenceList.children.length === 0) {
        const emptyAlert = document.createElement("div");
        emptyAlert.className = "alert alert-info";
        emptyAlert.innerHTML =
          '<i class="bi bi-info-circle"></i> Nenhuma área cadastrada ainda';
        geofenceList.appendChild(emptyAlert);
      }
    });

    geofenceItem
      .querySelector(".geofence-name")
      .addEventListener("click", () => {
        const map = namespace.MapModule.getMap();
        if (map) map.fitBounds(geofence.layer.getBounds());
      });

    geofenceList.appendChild(geofenceItem);
  }

  function checkFocosInGeofences() {
    if (importedGeofences.length === 0) return;

    const heatPoints = namespace.DataModule.getHeatPoints();
    if (!heatPoints || heatPoints.length === 0) return;

    importedGeofences.forEach((geofence) => {
      let focosCount = 0;

      heatPoints.forEach((point) => {
        const pt = turf.point([point.longitude, point.latitude]);
        geofence.layer.eachLayer((layer) => {
          if (layer.feature && layer.feature.geometry) {
            const geom = layer.feature.geometry;
            if (
              (geom.type === "Polygon" || geom.type === "MultiPolygon") &&
              turf.inside(pt, layer.feature)
            ) {
              focosCount++;
            }
          }
        });
      });

      if (focosCount > 0) {
        showAlert(
          `${focosCount} foco(s) detectado(s) na área "${geofence.name}"`
        );
        geofence.layer.setStyle({
          weight: 4,
          opacity: 0.9,
          fillOpacity: 0.3,
        });
      }
    });
  }

  function getRandomColor() {
    const colors = [
      "#3388FF",
      "#33A02C",
      "#FB9A99",
      "#E31A1C",
      "#FF7F00",
      "#6A3D9A",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
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

  namespace.GeofenceManager = {
    init: initialize,
    getGeofences: function () {
      return importedGeofences;
    },
  };
})(window.FireTrack || (window.FireTrack = {}));

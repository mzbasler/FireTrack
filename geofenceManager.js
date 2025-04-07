(function (namespace) {
  let geofenceLayer = null;
  let importedGeofences = [];
  let isActive = true;
  const STORAGE_KEY = "firetrack_geofences";

  function initialize() {
    const map = namespace.MapModule.getMap();
    if (!map) {
      console.error("Mapa não disponível para o gerenciador de áreas!");
      return false;
    }

    geofenceLayer = L.layerGroup().addTo(map);

    // Configurar toggle de visibilidade
    document
      .getElementById("geofenceToggle")
      ?.addEventListener("change", toggleGeofenceLayer);

    // Permitir seleção múltipla de arquivos
    const fileInput = document.getElementById("geofenceFile");
    if (fileInput) {
      fileInput.setAttribute("multiple", "true");
      fileInput.addEventListener("change", handleFileSelect);
    }

    document.addEventListener("heatPointsUpdated", checkFocosInGeofences);

    // Carregar áreas salvas do localStorage
    loadSavedGeofences();

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

          addGeofenceToMap(geojson, file.name, e.target.result);
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

  function addGeofenceToMap(geojson, name, rawContent) {
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
      // Adiciona a propriedade interactive para garantir que o buffer possa ser criado sobre as áreas
      interactive: false
    }).addTo(geofenceLayer);

    const geofenceInfo = {
      id: `geofence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      layer: layer,
      color: color,
      type: name.split(".").pop().toLowerCase(),
      rawContent: rawContent,
      category: "planting" // Categoria para diferenciar áreas de plantio e buffers
    };

    importedGeofences.push(geofenceInfo);
    addGeofenceToList(geofenceInfo, "planting");
    saveGeofencesToLocalStorage();
    checkFocosInGeofences();
  }

  function addGeofenceToList(geofence, category) {
    // Escolhe o container correto baseado na categoria
    const listContainerId = category === "planting" ? "plantingAreaList" : "bufferList";
    const geofenceList = document.getElementById(listContainerId);
    if (!geofenceList) return;

    const emptyAlert = geofenceList.querySelector(".alert-info");
    if (emptyAlert) emptyAlert.remove();

    const geofenceItem = document.createElement("div");
    geofenceItem.className = "geofence-item";
    geofenceItem.dataset.id = geofence.id;
    geofenceItem.innerHTML = `
      <div class="geofence-header">
        <span class="geofence-name">
          <span class="geofence-color" style="display:inline-block; width:12px; height:12px; background-color:${geofence.color}; margin-right:5px; border-radius:50%;"></span>
          ${geofence.name}
        </span>
        <button class="delete-btn">&times;</button>
      </div>
    `;

    geofenceItem.querySelector(".delete-btn").addEventListener("click", () => {
      removeGeofence(geofence.id);
      geofenceItem.remove();

      if (geofenceList.children.length === 0) {
        const emptyAlert = document.createElement("div");
        emptyAlert.className = "alert alert-info";
        emptyAlert.innerHTML = category === "planting" ?
          '<i class="bi bi-info-circle"></i> Nenhuma área de plantio cadastrada' :
          '<i class="bi bi-info-circle"></i> Nenhum buffer cadastrado';
        geofenceList.appendChild(emptyAlert);
      }
    });

    geofenceItem
      .querySelector(".geofence-name")
      .addEventListener("click", () => {
        const map = namespace.MapModule.getMap();
        if (map && geofence.layer && geofence.layer.getBounds) {
          map.fitBounds(geofence.layer.getBounds());
        }
      });

    geofenceList.appendChild(geofenceItem);
  }

  function removeGeofence(id) {
    const geofence = importedGeofences.find((g) => g.id === id);
    if (geofence && geofenceLayer) {
      geofenceLayer.removeLayer(geofence.layer);
    }

    importedGeofences = importedGeofences.filter((g) => g.id !== id);
    saveGeofencesToLocalStorage();
  }

  function saveGeofencesToLocalStorage() {
    try {
      const geofencesToSave = importedGeofences.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        type: g.type,
        rawContent: g.rawContent,
        category: g.category || "planting" // Garante que geofences antigos tenham uma categoria
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(geofencesToSave));
    } catch (error) {
      console.error("Erro ao salvar áreas no localStorage:", error);
    }
  }

  function loadSavedGeofences() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) return;

      const geofences = JSON.parse(savedData);

      geofences.forEach((geofence) => {
        try {
          let geojson;

          if (geofence.type === "kml") {
            const kml = new DOMParser().parseFromString(
              geofence.rawContent,
              "text/xml"
            );
            geojson = toGeoJSON.kml(kml);
          } else {
            geojson = JSON.parse(geofence.rawContent);
          }

          // Recriar a camada com a mesma cor original
          const layer = L.geoJSON(geojson, {
            style: {
              color: geofence.color,
              weight: 3,
              opacity: 0.7,
              fillColor: geofence.color,
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
            // Adiciona a propriedade interactive para garantir que o buffer possa ser criado sobre as áreas
            interactive: false
          }).addTo(geofenceLayer);

          // Reconstruir o objeto geofence com a nova camada
          const restoredGeofence = {
            ...geofence,
            layer: layer,
            category: geofence.category || "planting" // Garante que geofences antigos tenham uma categoria
          };

          importedGeofences.push(restoredGeofence);
          addGeofenceToList(restoredGeofence, restoredGeofence.category);
        } catch (error) {
          console.error(`Erro ao restaurar geofence ${geofence.name}:`, error);
        }
      });
    } catch (error) {
      console.error("Erro ao carregar áreas do localStorage:", error);
    }
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
        const areaType = geofence.category === "planting" ? "área de plantio" : "buffer";
        showAlert(
          `${focosCount} foco(s) detectado(s) na ${areaType} "${geofence.name}"`
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
    clearAll: function () {
      if (geofenceLayer) {
        geofenceLayer.clearLayers();
      }
      importedGeofences = [];
      localStorage.removeItem(STORAGE_KEY);

      // Limpar as duas listas
      const plantingAreaList = document.getElementById("plantingAreaList");
      if (plantingAreaList) {
        plantingAreaList.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> Nenhuma área de plantio cadastrada
          </div>
        `;
      }
      
      const bufferList = document.getElementById("bufferList");
      if (bufferList) {
        bufferList.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> Nenhum buffer cadastrado
          </div>
        `;
      }
      
      // Notificar o BufferModule para limpar seus buffers também
      if (namespace.BufferModule && typeof namespace.BufferModule.clearBuffers === 'function') {
        namespace.BufferModule.clearBuffers();
      }
    },
  };
})(window.FireTrack || (window.FireTrack = {}));
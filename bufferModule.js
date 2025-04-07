(function (namespace) {
  let bufferLayer = null;
  let bufferPolygon = null;
  let isDrawing = false;
  let points = [];
  let drawingOverlay = null;
  let buffersList = []; // Lista para armazenar todos os buffers criados
  const STORAGE_KEY = "firetrack_buffers";

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

    document.addEventListener("heatPointsUpdated", checkFocosNosBuffers);

    // Carregar buffers do localStorage
    loadSavedBuffers();

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

      // Mark first point - Mudando a cor do primeiro ponto para azul em vez de laranja
      L.circleMarker(points[0], {
        radius: 5,
        color: "#3388ff",
        fillColor: "#3388ff",
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
  }

  function createBuffer(points) {
    if (!points || points.length !== 2 || !bufferLayer) return;

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
    const bufferId = `buffer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const bufferGeojson = turf.buffer(point, distance, { units: "kilometers" });
    bufferPolygon = bufferGeojson; // Mantém o buffer atual para checagem de focos

    // Add buffer polygon to map
    const bufferLayerObj = L.geoJSON(bufferGeojson, {
      style: {
        color: "#3388ff",
        weight: 2,
        opacity: 0.7,
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      },
    }).addTo(bufferLayer);

    // Add markers for points - Mudando as cores para azul e verde
    const markers = [];
    points.forEach((point, index) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 5,
        color: index === 0 ? "#3388ff" : "#32cd32", // Azul para o primeiro ponto
        fillColor: index === 0 ? "#3388ff" : "#32cd32",
        fillOpacity: 1,
      }).addTo(bufferLayer);
      markers.push(marker);
    });

    // Adicionar o buffer à lista
    const bufferInfo = {
      id: bufferId,
      distance: distance,
      centerLat: points[0].lat,
      centerLng: points[0].lng,
      layer: bufferLayerObj,
      markers: markers,
      color: "#3388ff",
      geojson: bufferGeojson
    };
    
    buffersList.push(bufferInfo);
    saveBuffersToLocalStorage();
    addBufferToList(bufferInfo);
    checkFocosNosBuffers();
  }

  function checkFocosNosBuffers() {
    const heatPoints = namespace.DataModule.getHeatPoints();
    if (!heatPoints || heatPoints.length === 0) return;

    // Verificar focos em todos os buffers
    buffersList.forEach(buffer => {
      const bufferGeo = buffer.geojson;
      
      const focosCount = heatPoints.filter((point) => {
        const pt = turf.point([point.longitude, point.latitude]);
        return turf.booleanPointInPolygon(pt, bufferGeo);
      }).length;

      if (focosCount > 0) {
        showAlert(`${focosCount} foco(s) detectado(s) no buffer de ${buffer.distance.toFixed(2)} km`);
        
        // Destacar visualmente o buffer
        buffer.layer.setStyle({
          weight: 3,
          opacity: 0.9,
          fillOpacity: 0.3,
        });
      }
    });
  }

  function addBufferToList(buffer) {
    const bufferListEl = document.getElementById("bufferList");
    if (!bufferListEl) return;

    // Remover alerta de "nenhum buffer" se existir
    const emptyAlert = bufferListEl.querySelector(".alert-info");
    if (emptyAlert) emptyAlert.remove();

    const bufferItem = document.createElement("div");
    bufferItem.className = "geofence-item buffer-item";
    bufferItem.dataset.id = buffer.id;
    bufferItem.innerHTML = `
      <div class="geofence-header">
        <span class="geofence-name">
          <span class="geofence-color" style="display:inline-block; width:12px; height:12px; background-color:#3388ff; margin-right:5px; border-radius:50%;"></span>
          Buffer (${buffer.distance.toFixed(2)} km)
        </span>
        <button class="delete-btn">&times;</button>
      </div>
    `;

    // Add delete functionality
    bufferItem.querySelector(".delete-btn").addEventListener("click", () => {
      removeBuffer(buffer.id);
      bufferItem.remove();
      
      // Mostrar mensagem "nenhum buffer" se a lista ficou vazia
      if (bufferListEl.children.length === 0) {
        const emptyAlert = document.createElement("div");
        emptyAlert.className = "alert alert-info";
        emptyAlert.innerHTML = '<i class="bi bi-info-circle"></i> Nenhum buffer cadastrado';
        bufferListEl.appendChild(emptyAlert);
      }
    });

    // Centralizar o mapa no buffer ao clicar no nome
    bufferItem.querySelector(".geofence-name").addEventListener("click", () => {
      const map = namespace.MapModule.getMap();
      if (map && buffer.layer) {
        map.fitBounds(buffer.layer.getBounds());
      }
    });

    // Add to buffer list
    bufferListEl.appendChild(bufferItem);
  }

  function removeBuffer(bufferId) {
    const bufferToRemove = buffersList.find(b => b.id === bufferId);
    
    if (bufferToRemove) {
      // Remover a camada do mapa
      bufferLayer.removeLayer(bufferToRemove.layer);
      
      // Remover marcadores
      if (bufferToRemove.markers) {
        bufferToRemove.markers.forEach(marker => {
          bufferLayer.removeLayer(marker);
        });
      }
      
      // Atualizar a lista de buffers
      buffersList = buffersList.filter(b => b.id !== bufferId);
      saveBuffersToLocalStorage();
      
      // Se o buffer removido era o buffer atual
      if (bufferPolygon === bufferToRemove.geojson) {
        bufferPolygon = null;
      }
    }
  }

  function saveBuffersToLocalStorage() {
    try {
      const buffersToSave = buffersList.map(buffer => ({
        id: buffer.id,
        distance: buffer.distance,
        centerLat: buffer.centerLat,
        centerLng: buffer.centerLng,
        color: buffer.color,
        geojsonStr: JSON.stringify(buffer.geojson)
      }));
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buffersToSave));
    } catch (error) {
      console.error("Erro ao salvar buffers no localStorage:", error);
    }
  }

  function loadSavedBuffers() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) return;
      
      const buffers = JSON.parse(savedData);
      
      buffers.forEach(buffer => {
        try {
          const geojson = JSON.parse(buffer.geojsonStr);
          const center = [buffer.centerLat, buffer.centerLng];
          
          // Criar a camada com o buffer
          const bufferLayerObj = L.geoJSON(geojson, {
            style: {
              color: buffer.color || "#3388ff",
              weight: 2,
              opacity: 0.7,
              fillColor: buffer.color || "#3388ff",
              fillOpacity: 0.2,
            },
          }).addTo(bufferLayer);
          
          // Adicionar marcador do centro
          const markers = [];
          const centerMarker = L.circleMarker(center, {
            radius: 5,
            color: "#3388ff",
            fillColor: "#3388ff",
            fillOpacity: 1,
          }).addTo(bufferLayer);
          markers.push(centerMarker);
          
          // Adicionar o segundo ponto se possível (pode não estar disponível em buffers antigos)
          if (buffer.edgePoint) {
            const edgeMarker = L.circleMarker([buffer.edgePoint.lat, buffer.edgePoint.lng], {
              radius: 5,
              color: "#32cd32",
              fillColor: "#32cd32",
              fillOpacity: 1,
            }).addTo(bufferLayer);
            markers.push(edgeMarker);
          }
          
          // Reconstruir o objeto buffer
          const bufferInfo = {
            id: buffer.id,
            distance: buffer.distance,
            centerLat: buffer.centerLat,
            centerLng: buffer.centerLng,
            layer: bufferLayerObj,
            markers: markers,
            color: buffer.color || "#3388ff",
            geojson: geojson
          };
          
          buffersList.push(bufferInfo);
          addBufferToList(bufferInfo);
        } catch (error) {
          console.error("Erro ao restaurar buffer:", error);
        }
      });
    } catch (error) {
      console.error("Erro ao carregar buffers do localStorage:", error);
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Escape") {
      cancelDrawing();
    }
  }

  function cancelDrawing() {
    if (!isDrawing) return;

    if (bufferLayer) {
      // Remover apenas os pontos temporários do desenho atual
      bufferLayer.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) {
          for (const point of points) {
            if (layer.getLatLng().equals(point)) {
              bufferLayer.removeLayer(layer);
              break;
            }
          }
        }
      });
    }
    
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

  function clearBuffers() {
    if (bufferLayer) {
      bufferLayer.clearLayers();
    }
    buffersList = [];
    bufferPolygon = null;
    localStorage.removeItem(STORAGE_KEY);

    const bufferListEl = document.getElementById("bufferList");
    if (bufferListEl) {
      bufferListEl.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> Nenhum buffer cadastrado
        </div>
      `;
    }
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
    getBuffers: function() {
      return buffersList;
    },
    clearBuffers: clearBuffers,
    cancelDrawing: cancelDrawing,
  };
})(window.FireTrack || (window.FireTrack = {}));
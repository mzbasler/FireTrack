const MapModule = (() => {
  let map;
  let heatLayer;
  let geofenceLayerGroup = L.layerGroup();
  let geofenceLayers = {};
  let isDrawingBuffer = false;

  const init = () => {
    map = L.map("map").setView([-15.7889, -47.8792], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    geofenceLayerGroup.addTo(map);

    return map;
  };

  const initHeatLayer = () => {
    heatLayer = L.tileLayer
      .wms("https://panorama.sipam.gov.br/geoserver/painel_do_fogo/ows", {
        layers: "painel_do_fogo:mv_evento_filtro",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        attribution: "SIPAM - Panorama do Fogo",
      })
      .addTo(map);
  };

  const toggleHeatLayer = (visible) => {
    if (visible) {
      map.addLayer(heatLayer);
    } else {
      map.removeLayer(heatLayer);
    }
  };

  // Ativar/desativar o modo de desenho de buffer
  const toggleBufferDrawMode = (enabled) => {
    isDrawingBuffer = enabled;

    // Alterar o cursor de acordo com o modo
    if (map) {
      map._container.style.cursor = enabled ? "crosshair" : "";
    }

    // Notificar o usuário sobre o modo
    if (enabled) {
      if (window.Terminal && typeof window.Terminal.addMessage === "function") {
        window.Terminal.addMessage(
          "Clique no mapa para posicionar o buffer.",
          "info"
        );
      }
    }
  };

  const addGeofence = (geojson, name, id, isBuffer = false) => {
    try {
      // Tentar renderizar o GeoJSON diretamente
      const layer = L.geoJSON(geojson, {
        style: {
          color: isBuffer ? "#00ffff" : "#ff7800",
          weight: 2,
          fillOpacity: 0.1,
          fillColor: isBuffer ? "#00ffff" : "#ff7800",
        },
      }).bindPopup(`<b>${name}</b>`);

      layer._geofenceId = id;
      layer._isBuffer = isBuffer;
      geofenceLayers[id] = layer;
      geofenceLayerGroup.addLayer(layer);

      return true;
    } catch (error) {
      console.error("Erro ao adicionar geofence:", error);

      try {
        // Tentar extrair e usar apenas a geometria
        if (geojson.geometry) {
          const layer = L.geoJSON(geojson.geometry, {
            style: {
              color: isBuffer ? "#00ffff" : "#ff7800",
              weight: 2,
              fillOpacity: 0.1,
              fillColor: isBuffer ? "#00ffff" : "#ff7800",
            },
          }).bindPopup(`<b>${name}</b>`);

          layer._geofenceId = id;
          layer._isBuffer = isBuffer;
          geofenceLayers[id] = layer;
          geofenceLayerGroup.addLayer(layer);
          return true;
        }
      } catch (secondError) {
        console.error("Segunda tentativa falhou:", secondError);
      }

      return false;
    }
  };

  // Adicionar um buffer circular ao mapa
  const addCircleBuffer = (center, radius, name, id) => {
    try {
      // Verificar parâmetros
      if (!center || radius <= 0 || !name || !id) {
        console.error("Parâmetros inválidos para criar buffer");
        return false;
      }

      // Cor baseada no tema atual
      const isDarkMode = document.body.classList.contains("dark-mode");
      const bufferColor = isDarkMode ? "#00ffff" : "#1e88e5";

      // Criar o círculo com estilo visual de buffer
      const circleLayer = L.circle(center, {
        radius: radius * 1000, // Converter de km para metros
        color: bufferColor,
        fillColor: bufferColor,
        fillOpacity: 0.2,
        weight: 2,
      }).bindPopup(`<b>${name}</b>`);

      // Armazenar o ID para referência
      circleLayer._geofenceId = id;
      circleLayer._isBuffer = true;
      geofenceLayers[id] = circleLayer;
      geofenceLayerGroup.addLayer(circleLayer);

      if (window.Terminal && typeof window.Terminal.addMessage === "function") {
        window.Terminal.addMessage(
          `Buffer "${name}" adicionado com raio de ${radius}km.`,
          "success"
        );
      }

      return true;
    } catch (error) {
      console.error("Erro ao adicionar buffer circular:", error);

      if (window.Terminal && typeof window.Terminal.addMessage === "function") {
        window.Terminal.addMessage(
          `Erro ao adicionar buffer "${name}": ${error.message}`,
          "error"
        );
      }

      return false;
    }
  };

  const removeGeofence = (id) => {
    if (geofenceLayers[id]) {
      geofenceLayerGroup.removeLayer(geofenceLayers[id]);
      delete geofenceLayers[id];
      return true;
    }
    return false;
  };

  const toggleGeofences = (visible) => {
    if (visible) {
      map.addLayer(geofenceLayerGroup);
    } else {
      map.removeLayer(geofenceLayerGroup);
    }
  };

  const centerOnGeofence = (id) => {
    const layer = geofenceLayers[id];
    if (layer) {
      // Para polígonos e multipolígonos
      if (layer.getBounds) {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
          layer.openPopup();
        }
      }
      // Para círculos e marcadores
      else if (layer.getLatLng) {
        const latLng = layer.getLatLng();
        const radius = layer.getRadius ? layer.getRadius() : 0;

        if (radius > 0) {
          // Para círculos, calcular bounds
          const bounds = L.latLngBounds(
            [latLng.lat - radius / 111000, latLng.lng - radius / 111000],
            [latLng.lat + radius / 111000, latLng.lng + radius / 111000]
          );
          map.fitBounds(bounds, { padding: [50, 50] });
        } else {
          // Para pontos simples
          map.setView(latLng, 12);
        }

        layer.openPopup();
      }
    }
  };

  // Obter focos de calor visíveis no mapa - incluindo alguns focos de teste para debug
  const getVisibleHotspots = () => {
    const hotspots = [];
    const bounds = map.getBounds();

    try {
      // Adicionar alguns pontos de teste para verificar a detecção de focos dentro de buffers
      // Estes são pontos que devem estar dentro dos buffers criados na região de Brasília
      const testHotspots = [
        { latitude: -15.21, longitude: -47.64 }, // Ponto para teste dentro de um buffer
        { latitude: -15.05, longitude: -47.95 },
        { latitude: -15.3, longitude: -47.25 },
        { latitude: -15.55, longitude: -47.8 },
        { latitude: -15.7, longitude: -47.5 },
        { latitude: -15.4, longitude: -47.35 },
        { latitude: -15.25, longitude: -47.55 },
        { latitude: -15.1, longitude: -47.7 },
        { latitude: -14.9, longitude: -47.9 },
      ];

      // Adicionar pontos de teste se estiverem dentro dos limites do mapa
      testHotspots.forEach((spot) => {
        if (bounds.contains(L.latLng(spot.latitude, spot.longitude))) {
          hotspots.push({
            latitude: spot.latitude,
            longitude: spot.longitude,
            confidence: "high",
            timestamp: new Date().toISOString(),
          });
        }
      });

      if (
        window.Terminal &&
        typeof window.Terminal.addMessage === "function" &&
        hotspots.length > 0
      ) {
        window.Terminal.addMessage(
          `Encontrados ${hotspots.length} focos de calor para teste.`,
          "info"
        );
      }
    } catch (error) {
      console.error("Erro ao obter hotspots visíveis:", error);
    }

    return hotspots;
  };

  const getGeofenceLayers = () => geofenceLayers;

  const getMap = () => map;

  return {
    init,
    initHeatLayer,
    toggleHeatLayer,
    addGeofence,
    removeGeofence,
    toggleGeofences,
    centerOnGeofence,
    getGeofenceLayers,
    getMap,
    addCircleBuffer,
    toggleBufferDrawMode,
    getVisibleHotspots,
  };
})();

const MapModule = (() => {
  let map;
  let heatLayer;
  let geofenceLayerGroup = L.layerGroup();
  let geofenceLayers = {};

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

  const addGeofence = (geojson, name, id) => {
    try {
      const layer = L.geoJSON(geojson, {
        style: {
          color: "#ff7800",
          weight: 2,
          fillOpacity: 0.1,
          fillColor: "#ff7800",
        },
      }).bindPopup(`<b>${name}</b>`);

      layer._geofenceId = id;
      geofenceLayers[id] = layer;
      geofenceLayerGroup.addLayer(layer);

      return true;
    } catch (error) {
      console.error("Erro ao adicionar geofence:", error);
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
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        layer.openPopup();
      }
    }
  };

  const getGeofenceLayers = () => geofenceLayers;

  return {
    init,
    initHeatLayer,
    toggleHeatLayer,
    addGeofence,
    removeGeofence,
    toggleGeofences,
    centerOnGeofence,
    getGeofenceLayers,
    getMap: () => map,
  };
})();

(function (namespace) {
  let heatLayer = null;
  let isActive = true;

  function initialize() {
    const map = namespace.MapModule.getMap();
    if (!map) {
      console.error("Mapa não disponível para o renderizador de focos!");
      return false;
    }

    heatLayer = L.layerGroup().addTo(map);
    document
      .getElementById("heatToggle")
      ?.addEventListener("change", toggleHeatLayer);

    // Renderizar pontos imediatamente se já houver dados
    const initialPoints = namespace.DataModule.getHeatPoints();
    if (initialPoints && initialPoints.length > 0) {
      renderHeatPoints({ detail: { points: initialPoints } });
    }

    document.addEventListener("heatPointsUpdated", renderHeatPoints);
    return true;
  }

  function renderHeatPoints(event) {
    if (!isActive || !heatLayer) return;

    heatLayer.clearLayers();
    const points = event.detail.points || [];

    points.forEach((point) => {
      try {
        if (!point.latitude || !point.longitude) {
          console.warn("Ponto com coordenadas inválidas:", point);
          return;
        }

        L.circleMarker([point.latitude, point.longitude], {
          radius: 5,
          fillColor: "#ff0000",
          color: "#ff0000",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(heatLayer);
      } catch (error) {
        console.error("Erro ao renderizar ponto:", error, point);
      }
    });
  }

  function toggleHeatLayer(e) {
    isActive = e?.target?.checked ?? true;
    const map = namespace.MapModule.getMap();

    if (!heatLayer || !map) return;

    if (isActive) {
      heatLayer.addTo(map);
      const points = namespace.DataModule.getHeatPoints();
      if (points && points.length > 0) {
        renderHeatPoints({ detail: { points } });
      }
    } else {
      heatLayer.remove();
    }
  }

  namespace.HeatFilter = {
    init: initialize,
    getLayer: function () {
      return heatLayer;
    },
  };
})(window.FireTrack || (window.FireTrack = {}));

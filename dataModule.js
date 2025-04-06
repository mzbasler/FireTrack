(function (namespace) {
  let heatPoints = [];
  let lastUpdate = null;

  function calculateCentroid(polygon) {
    let sumX = 0;
    let sumY = 0;
    let validPoints = 0;

    if (!Array.isArray(polygon)) {
      console.error("Polígono inválido:", polygon);
      return [0, 0];
    }

    polygon.forEach((coord) => {
      if (Array.isArray(coord) && coord.length >= 2) {
        const x = parseFloat(coord[0]);
        const y = parseFloat(coord[1]);

        if (!isNaN(x) && !isNaN(y)) {
          sumX += x;
          sumY += y;
          validPoints++;
        }
      }
    });

    if (validPoints === 0) {
      console.error("Nenhum ponto válido no polígono:", polygon);
      return [0, 0];
    }

    return [sumX / validPoints, sumY / validPoints];
  }

  function extractCoordinates(features) {
    let extractedPoints = [];

    if (!features || !Array.isArray(features)) {
      console.error("Features inválidas:", features);
      return extractedPoints;
    }

    features.forEach((feature) => {
      try {
        if (!feature.geometry) {
          console.warn("Feature sem geometria:", feature);
          return;
        }

        const geomType = feature.geometry.type;
        let coordinates = [];

        if (geomType === "Point") {
          coordinates.push([
            feature.geometry.coordinates[0],
            feature.geometry.coordinates[1],
          ]);
        } else if (geomType === "MultiPoint") {
          feature.geometry.coordinates.forEach((point) => {
            if (Array.isArray(point) && point.length >= 2) {
              coordinates.push([point[0], point[1]]);
            }
          });
        } else if (geomType === "Polygon") {
          if (
            Array.isArray(feature.geometry.coordinates) &&
            feature.geometry.coordinates.length > 0 &&
            Array.isArray(feature.geometry.coordinates[0])
          ) {
            const polygon = feature.geometry.coordinates[0];
            const centroid = calculateCentroid(polygon);
            coordinates.push(centroid);
          }
        } else if (geomType === "LineString") {
          if (
            Array.isArray(feature.geometry.coordinates) &&
            feature.geometry.coordinates.length > 0
          ) {
            const midIndex = Math.floor(
              feature.geometry.coordinates.length / 2
            );
            if (Array.isArray(feature.geometry.coordinates[midIndex])) {
              coordinates.push(feature.geometry.coordinates[midIndex]);
            }
          }
        } else if (geomType === "MultiPolygon") {
          if (Array.isArray(feature.geometry.coordinates)) {
            feature.geometry.coordinates.forEach((polygonSet) => {
              if (Array.isArray(polygonSet) && polygonSet.length > 0) {
                const polygon = polygonSet[0];
                if (Array.isArray(polygon)) {
                  const centroid = calculateCentroid(polygon);
                  coordinates.push(centroid);
                }
              }
            });
          }
        }

        for (let i = 0; i < coordinates.length; i++) {
          const coord = coordinates[i];

          if (!Array.isArray(coord) || coord.length < 2) {
            continue;
          }

          let longitude = coord[0];
          let latitude = coord[1];

          if (typeof longitude !== "number" || typeof latitude !== "number") {
            longitude = parseFloat(longitude);
            latitude = parseFloat(latitude);
          }

          if (
            isNaN(longitude) ||
            isNaN(latitude) ||
            Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180
          ) {
            continue;
          }

          extractedPoints.push({
            latitude: latitude,
            longitude: longitude,
          });
        }
      } catch (error) {
        console.error("Erro ao processar feature:", error);
      }
    });

    return extractedPoints;
  }

  async function loadData() {
    try {
      console.log("Carregando dados de focos de calor...");

      const wfsUrl =
        "https://panorama.sipam.gov.br/geoserver/painel_do_fogo/ows";
      const params = new URLSearchParams({
        service: "WFS",
        version: "2.0.0",
        request: "GetFeature",
        typeName: "painel_do_fogo:mv_evento_filtro",
        outputFormat: "application/json",
        maxFeatures: 1000,
        srsName: "EPSG:4326",
      });

      const response = await fetch(`${wfsUrl}?${params}`);
      if (!response.ok) throw new Error("Falha ao obter dados do servidor WFS");

      const data = await response.json();
      heatPoints = extractCoordinates(data.features);
      lastUpdate = new Date();

      document.dispatchEvent(
        new CustomEvent("heatPointsUpdated", {
          detail: { points: heatPoints },
        })
      );

      return heatPoints.length;
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      return 0;
    }
  }

  namespace.DataModule = {
    loadData: loadData,
    getHeatPoints: function () {
      return heatPoints;
    },
    getLastUpdate: function () {
      return lastUpdate;
    },
  };
})(window.FireTrack || (window.FireTrack = {}));

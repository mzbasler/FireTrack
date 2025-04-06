/**
 * Módulo para importação de arquivos KML e GeoJSON
 */
(function (namespace) {
  // Variáveis do módulo
  let importedLayers = [];
  let layerGroup = null;

  // Cache de cores para consistência visual
  const colors = [
    "#3388FF",
    "#33A02C",
    "#FB9A99",
    "#E31A1C",
    "#FF7F00",
    "#6A3D9A",
    "#CAB2D6",
    "#FFFF99",
    "#B15928",
    "#1F78B4",
  ];

  // Função para inicializar o módulo
  function initialize() {
    console.log("Inicializando módulo de importação...");

    // Verificar se o mapa está disponível
    const map = namespace.MapModule.getMap();
    if (!map) {
      console.error("Mapa não disponível para o módulo de importação!");
      return false;
    }

    // Criar grupo de camadas se não existir
    if (!layerGroup) {
      layerGroup = L.layerGroup().addTo(map);
    }

    // Configurar elementos DOM
    const fileInput = document.getElementById("fileInput");
    const fileList = document.getElementById("fileList");
    const clearLayersBtn = document.getElementById("clearLayers");

    if (!fileInput || !fileList || !clearLayersBtn) {
      console.error("Elementos DOM necessários não encontrados!");
      return false;
    }

    // Adicionar event listener para seleção de arquivos
    fileInput.addEventListener("change", handleFileSelect);

    // Adicionar event listener para limpar camadas
    clearLayersBtn.addEventListener("click", clearAllLayers);

    console.log("Módulo de importação inicializado com sucesso.");
    return true;
  }

  // Função para lidar com a seleção de arquivos
  function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`Processando ${files.length} arquivo(s)...`);

    // Processar cada arquivo selecionado
    Array.from(files).forEach((file) => {
      const fileName = file.name;
      const fileExt = fileName.split(".").pop().toLowerCase();

      console.log(`Processando arquivo: ${fileName} (${fileExt})`);

      if (fileExt === "kml") {
        processKMLFile(file);
      } else if (fileExt === "geojson" || fileExt === "json") {
        processGeoJSONFile(file);
      } else {
        console.warn(`Formato de arquivo não suportado: ${fileExt}`);
      }
    });

    // Limpar o input para permitir selecionar os mesmos arquivos novamente
    event.target.value = "";
  }

  // Função para processar arquivo KML
  function processKMLFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        // Converter KML para GeoJSON usando togeojson
        const kmlContent = e.target.result;
        const kmlDoc = new DOMParser().parseFromString(kmlContent, "text/xml");
        const geojsonData = toGeoJSON.kml(kmlDoc);

        // Adicionar ao mapa
        addGeoJSONToMap(geojsonData, file.name);
      } catch (error) {
        console.error(`Erro ao processar arquivo KML ${file.name}:`, error);
        alert(`Erro ao processar arquivo KML: ${file.name}`);
      }
    };

    reader.onerror = function () {
      console.error(`Erro ao ler arquivo KML ${file.name}`);
      alert(`Erro ao ler arquivo KML: ${file.name}`);
    };

    reader.readAsText(file);
  }

  // Função para processar arquivo GeoJSON
  function processGeoJSONFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        // Parsear JSON
        const geojsonData = JSON.parse(e.target.result);

        // Verificar se é um GeoJSON válido
        if (!geojsonData.type || !geojsonData.features) {
          throw new Error("Formato GeoJSON inválido");
        }

        // Adicionar ao mapa
        addGeoJSONToMap(geojsonData, file.name);
      } catch (error) {
        console.error(`Erro ao processar arquivo GeoJSON ${file.name}:`, error);
        alert(`Erro ao processar arquivo GeoJSON: ${file.name}`);
      }
    };

    reader.onerror = function () {
      console.error(`Erro ao ler arquivo GeoJSON ${file.name}`);
      alert(`Erro ao ler arquivo GeoJSON: ${file.name}`);
    };

    reader.readAsText(file);
  }

  // Função para adicionar GeoJSON ao mapa
  function addGeoJSONToMap(geojsonData, fileName) {
    const map = namespace.MapModule.getMap();

    // Escolher uma cor para a camada
    const colorIndex = importedLayers.length % colors.length;
    const layerColor = colors[colorIndex];

    // Criar camada com o GeoJSON
    const layer = L.geoJSON(geojsonData, {
      style: {
        color: layerColor,
        weight: 3,
        opacity: 0.7,
        fillColor: layerColor,
        fillOpacity: 0.2,
      },
      onEachFeature: function (feature, layer) {
        // Adicionar popup com propriedades, se existirem
        if (feature.properties) {
          const propertyList = Object.entries(feature.properties)
            .filter(
              ([key, value]) =>
                value !== null && value !== undefined && value !== ""
            )
            .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
            .join("<br>");

          if (propertyList) {
            layer.bindPopup(propertyList);
          }
        }
      },
    }).addTo(layerGroup);

    // Ajustar visualização para incluir a nova camada
    try {
      map.fitBounds(layer.getBounds());
    } catch (e) {
      console.warn("Não foi possível ajustar a visualização para a camada", e);
    }

    // Adicionar à lista de camadas importadas
    const layerInfo = {
      id: `layer-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: fileName,
      layer: layer,
      color: layerColor,
    };

    importedLayers.push(layerInfo);

    // Atualizar a lista visual de camadas
    updateLayerList();

    // Verificar se há focos nas áreas importadas
    checkFocosInImportedLayers();
  }

  // Função para atualizar a lista visual de camadas
  function updateLayerList() {
    const fileList = document.getElementById("fileList");
    if (!fileList) return;

    // Limpar lista atual
    fileList.innerHTML = "";

    // Adicionar cada camada à lista
    importedLayers.forEach((layerInfo) => {
      const layerItem = document.createElement("div");
      layerItem.className = "file-item";
      layerItem.innerHTML = `
              <span>
                  <span class="layer-color" style="background-color: ${layerInfo.color}"></span>
                  ${layerInfo.name}
              </span>
              <span class="remove-btn" data-id="${layerInfo.id}">×</span>
          `;

      fileList.appendChild(layerItem);

      // Adicionar event listener para remover camada
      layerItem
        .querySelector(".remove-btn")
        .addEventListener("click", function () {
          removeLayer(this.getAttribute("data-id"));
        });
    });
  }

  // Função para remover uma camada
  function removeLayer(layerId) {
    // Encontrar o índice da camada na lista
    const layerIndex = importedLayers.findIndex((info) => info.id === layerId);

    if (layerIndex === -1) return;

    // Remover do mapa
    layerGroup.removeLayer(importedLayers[layerIndex].layer);

    // Remover da lista
    importedLayers.splice(layerIndex, 1);

    // Atualizar a lista visual
    updateLayerList();
  }

  // Função para limpar todas as camadas
  function clearAllLayers() {
    // Limpar o grupo de camadas
    layerGroup.clearLayers();

    // Limpar a lista
    importedLayers = [];

    // Atualizar a lista visual
    updateLayerList();
  }

  // Função para verificar se há focos de calor nas áreas importadas
  function checkFocosInImportedLayers() {
    if (importedLayers.length === 0) return;

    const heatPoints = namespace.DataModule.getHeatPoints();
    if (!heatPoints || heatPoints.length === 0) return;

    // Para cada camada importada
    importedLayers.forEach((layerInfo) => {
      let focosCount = 0;

      // Para cada ponto de foco de calor
      heatPoints.forEach((point) => {
        // Verificar se o ponto está dentro de alguma geometria na camada
        const pointGeoJSON = turf.point([point.longitude, point.latitude]);

        // Obter todas as features da camada
        layerInfo.layer.eachLayer(function (layer) {
          // Tentar obter a geometria do Leaflet
          if (layer.feature && layer.feature.geometry) {
            // Converter para formato Turf compatível
            const geom = layer.feature.geometry;

            if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
              try {
                // Use turf.inside para verificar se o ponto está dentro do polígono
                if (turf.inside(pointGeoJSON, layer.feature)) {
                  focosCount++;
                }
              } catch (e) {
                console.warn("Erro ao verificar ponto em polígono:", e);
              }
            }
          }
        });
      });

      // Se houver focos, destacar a camada e mostrar o número de focos
      if (focosCount > 0) {
        console.log(
          `${focosCount} focos encontrados na camada ${layerInfo.name}`
        );

        // Destacar a camada
        layerInfo.layer.setStyle({
          weight: 4,
          opacity: 0.9,
          fillOpacity: 0.3,
        });

        // Mostrar alerta
        const alertDiv = document.getElementById("alert");
        const alertCount = document.getElementById("alertCount");

        if (alertDiv && alertCount) {
          alertCount.textContent = `${focosCount} foco(s) detectado(s) na área "${layerInfo.name}"`;
          alertDiv.style.display = "block";
        }
      }
    });
  }

  // Interface pública do módulo
  namespace.ImportModule = {
    init: initialize,
    getImportedLayers: function () {
      return importedLayers;
    },
    clearAllLayers: clearAllLayers,
    checkFocosInLayers: checkFocosInImportedLayers,
  };
})(window.SIPAM || (window.SIPAM = {}));

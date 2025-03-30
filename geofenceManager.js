const GeofenceManager = (() => {
  // Garantir que geofences seja sempre um array, mesmo se o localStorage estiver corrompido
  let geofences = [];

  // Inicializar geofences com segurança
  try {
    const storedGeofences = localStorage.getItem("geofences");
    if (storedGeofences) {
      const parsed = JSON.parse(storedGeofences);
      if (Array.isArray(parsed)) {
        geofences = parsed;
      } else {
        console.error("Formato inválido de geofences no localStorage");
        localStorage.removeItem("geofences"); // Limpar dados inválidos
      }
    }
  } catch (error) {
    console.error("Erro ao carregar geofences do localStorage:", error);
    localStorage.removeItem("geofences"); // Limpar dados corrompidos
  }

  const init = () => {
    document
      .getElementById("geofenceFile")
      .addEventListener("change", handleFileUpload);
    document
      .getElementById("geofenceToggle")
      .addEventListener("change", (e) => {
        MapModule.toggleGeofences(e.target.checked);
      });

    // Configurar botão de buffer
    setupBufferButton();

    // Criar o modal para buffer (apenas uma vez na inicialização)
    createBufferModal();

    renderGeofenceList();
    loadExistingGeofences();
  };

  // Criar o modal para opções de buffer
  const createBufferModal = () => {
    // Verificar se o modal já existe
    if (document.getElementById("bufferModal")) return;

    // Criar o modal
    const modalHtml = `
      <div class="modal fade" id="bufferModal" tabindex="-1" aria-labelledby="bufferModalLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="bufferModalLabel">Adicionar Área Buffer</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body">
              <p>Escolha como deseja criar o buffer:</p>
              <div class="d-grid gap-2">
                <button id="bufferMouseBtn" class="btn btn-primary">
                  <i class="bi bi-mouse"></i> Clicar no mapa
                </button>
                <button id="bufferRadiusBtn" class="btn btn-secondary">
                  <i class="bi bi-bullseye"></i> Definir raio no centro do mapa
                </button>
              </div>
              <div id="bufferHelp" class="form-text mt-3">
                Buffer é uma área circular para monitoramento de focos de calor.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Adicionar o modal ao corpo do documento
    const modalContainer = document.createElement("div");
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    // Adicionar estilos específicos para o tema escuro
    const modalStyle = document.createElement("style");
    modalStyle.innerHTML = `
      body.dark-mode .modal-content {
        background-color: #333;
        color: #00ff00;
        border-color: rgba(0, 255, 0, 0.2);
      }
      
      body.dark-mode .modal-header {
        border-bottom-color: rgba(0, 255, 0, 0.2);
      }
      
      body.dark-mode .modal-footer {
        border-top-color: rgba(0, 255, 0, 0.2);
      }
      
      body.dark-mode .btn-close {
        filter: invert(1) hue-rotate(90deg);
      }
      
      body.dark-mode #bufferMouseBtn,
      body.dark-mode #bufferRadiusBtn {
        background-color: #222;
        color: #00ff00;
        border-color: rgba(0, 255, 0, 0.5);
      }
      
      body.dark-mode #bufferMouseBtn:hover,
      body.dark-mode #bufferRadiusBtn:hover {
        background-color: #444;
      }
      
      body.dark-mode #bufferHelp {
        color: rgba(0, 255, 0, 0.7);
      }
    `;
    document.head.appendChild(modalStyle);

    // Configurar os listeners para os botões do modal
    document.getElementById("bufferMouseBtn").addEventListener("click", () => {
      // Fechar modal
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("bufferModal")
      );
      modal.hide();

      // Ativar modo de desenho por clique no mapa
      if (MapModule.toggleBufferDrawMode) {
        MapModule.toggleBufferDrawMode(true);

        if (
          window.Terminal &&
          typeof window.Terminal.addMessage === "function"
        ) {
          window.Terminal.addMessage(
            "Clique no mapa para posicionar o buffer.",
            "info"
          );
        }
      }
    });

    document.getElementById("bufferRadiusBtn").addEventListener("click", () => {
      // Fechar modal
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("bufferModal")
      );
      modal.hide();

      // Usar o centro atual do mapa
      addCustomBuffer();
    });
  };

  // Configurar botão de adicionar buffer
  const setupBufferButton = () => {
    const bufferButton = document.getElementById("addBufferBtn");
    if (bufferButton) {
      bufferButton.addEventListener("click", showBufferModal);
    }
  };

  // Exibir o modal de buffer
  const showBufferModal = () => {
    const modalElement = document.getElementById("bufferModal");
    if (!modalElement) {
      console.error("Modal de buffer não encontrado");
      return;
    }

    // Inicializar e mostrar o modal do Bootstrap
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  };

  // Função para adicionar buffer personalizado com centro do mapa
  const addCustomBuffer = () => {
    try {
      // Obter o mapa
      const map = MapModule.getMap();
      if (!map) {
        alert("Mapa não inicializado!");
        return;
      }

      // Obter o centro do mapa atual
      const center = map.getCenter();

      // Pedir nome e raio ao usuário
      const name = prompt(
        "Digite um nome para esta área de buffer:",
        "Buffer " + new Date().toLocaleDateString()
      );
      if (!name) return;

      let radius = prompt("Digite o raio do buffer em km:", "5");
      radius = parseFloat(radius);
      if (isNaN(radius) || radius <= 0) {
        alert("Raio inválido! Use um valor numérico positivo.");
        return;
      }

      // Criar um buffer usando turf.js
      const point = turf.point([center.lng, center.lat]);
      const buffer = turf.buffer(point, radius, { units: "kilometers" });

      const newGeofence = {
        id: Date.now(),
        name: name.trim(),
        date: new Date().toISOString(),
        geometry: buffer,
        type: "buffer",
        center: [center.lat, center.lng],
        radius: radius,
      };

      // Adicionar buffer ao mapa
      if (MapModule.addCircleBuffer) {
        MapModule.addCircleBuffer(
          [center.lat, center.lng],
          radius,
          name,
          newGeofence.id
        );
      } else {
        MapModule.addGeofence(buffer, name, newGeofence.id);
      }

      // Registrar o buffer
      geofences.push(newGeofence);
      saveGeofences();
      renderGeofenceList();

      if (window.Terminal && typeof window.Terminal.addMessage === "function") {
        window.Terminal.addMessage(
          `Buffer "${name}" adicionado com raio de ${radius}km.`,
          "success"
        );
      }

      // Disparar verificação de alertas para o novo buffer
      if (
        window.AlertSystem &&
        typeof window.AlertSystem.checkAlerts === "function"
      ) {
        setTimeout(() => window.AlertSystem.checkAlerts(), 1000);
      }
    } catch (error) {
      console.error("Erro ao criar buffer:", error);
      alert("Erro ao criar buffer: " + error.message);
    }
  };

  // Função para filtrar geofences inválidos
  const cleanupGeofences = () => {
    const originalCount = geofences.length;
    geofences = geofences.filter((g) => g && g.id && g.name && g.geometry);

    if (originalCount !== geofences.length) {
      console.log(
        `Removidas ${originalCount - geofences.length} áreas inválidas`
      );
      saveGeofences();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const name = prompt("Digite um nome para esta área:");
    if (!name || name.trim() === "") {
      alert("O nome da área é obrigatório!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let geojson;

        if (file.name.endsWith(".kml")) {
          const kml = new DOMParser().parseFromString(
            event.target.result,
            "text/xml"
          );
          geojson = toGeoJSON.kml(kml);
        } else if (
          file.name.endsWith(".geojson") ||
          file.name.endsWith(".json")
        ) {
          geojson = JSON.parse(event.target.result);
        } else {
          throw new Error("Formato de arquivo não suportado");
        }

        // Verifica se o GeoJSON é válido
        if (
          !geojson ||
          ((!geojson.features || geojson.features.length === 0) &&
            !geojson.geometry &&
            !geojson.coordinates)
        ) {
          throw new Error("Arquivo sem dados geográficos válidos");
        }

        // Cria um buffer, usando a geometria correta
        let validGeojson = geojson;
        const buffer = turf.buffer(validGeojson, 5, { units: "kilometers" });

        const newGeofence = {
          id: Date.now(),
          name: name.trim(),
          date: new Date().toISOString(),
          geometry: buffer,
        };

        if (MapModule.addGeofence(buffer, name, newGeofence.id)) {
          geofences.push(newGeofence);
          saveGeofences();
          renderGeofenceList();
          alert("Área cadastrada com sucesso!");

          // Disparar verificação de alertas para o novo geofence
          if (
            window.AlertSystem &&
            typeof window.AlertSystem.checkAlerts === "function"
          ) {
            setTimeout(() => window.AlertSystem.checkAlerts(), 1000);
          }
        }
      } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        alert(
          `Erro: ${error.message}\nVerifique se o arquivo é um KML/GeoJSON válido.`
        );
      } finally {
        // Reset input para permitir novo upload do mesmo arquivo
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const loadExistingGeofences = () => {
    // Primeiro limpar quaisquer geofences inválidos
    cleanupGeofences();

    // Depois carregar as geofences válidas
    geofences.forEach((gf) => {
      try {
        if (gf.geometry && gf.name && gf.id) {
          // Verificar se é um buffer (para usar o método adequado)
          if (
            gf.type === "buffer" &&
            gf.center &&
            gf.radius &&
            MapModule.addCircleBuffer
          ) {
            MapModule.addCircleBuffer(gf.center, gf.radius, gf.name, gf.id);
          } else {
            MapModule.addGeofence(gf.geometry, gf.name, gf.id);
          }
        }
      } catch (error) {
        console.error(`Erro ao carregar área ${gf.id}:`, error);
      }
    });
  };

  const deleteGeofence = (id) => {
    if (confirm("Tem certeza que deseja excluir esta área permanentemente?")) {
      geofences = geofences.filter((g) => g.id !== id);
      saveGeofences();
      MapModule.removeGeofence(id);
      renderGeofenceList();
    }
  };

  const saveGeofences = () => {
    localStorage.setItem("geofences", JSON.stringify(geofences));
  };

  const renderGeofenceList = () => {
    const listContainer = document.getElementById("geofenceList");

    // Limpar qualquer conteúdo anterior
    listContainer.innerHTML = "";

    // Verificar e limpar geofences inválidos
    cleanupGeofences();

    // Verificação explícita se o array está vazio
    if (!geofences || geofences.length === 0) {
      listContainer.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> Nenhuma área cadastrada ainda
        </div>
      `;
      return;
    }

    // Construir a lista apenas se houver geofences válidos
    const validGeofences = geofences.filter((g) => g && g.id && g.name);

    if (validGeofences.length === 0) {
      listContainer.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> Nenhuma área cadastrada ainda
        </div>
      `;
      return;
    }

    // Renderizar apenas geofences válidos
    listContainer.innerHTML = validGeofences
      .map((geofence) => {
        const date = new Date(geofence.date);
        const formattedDate = isNaN(date.getTime())
          ? "Data desconhecida"
          : date.toLocaleDateString("pt-BR");

        // Adicionar ícone de acordo com o tipo
        let typeIcon = '<i class="bi bi-geo-alt"></i>';
        if (geofence.type === "buffer") {
          typeIcon = '<i class="bi bi-bullseye"></i>';
        }

        return `
          <div class="geofence-item" data-id="${geofence.id}">
            <div class="geofence-header">
              <span class="geofence-name">${typeIcon} ${
          geofence.name || "Área sem nome"
        }</span>
              <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${
                geofence.id
              }" title="Excluir área">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <small class="text-muted">Cadastrada em: ${formattedDate}</small>
          </div>
        `;
      })
      .join("");

    // Add event listeners
    document.querySelectorAll(".geofence-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".delete-btn")) return;
        const id = parseInt(item.dataset.id);
        MapModule.centerOnGeofence(id);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        deleteGeofence(id);
      });
    });
  };

  // Método para obter todas as geofences, incluindo buffers criados manualmente
  const getGeofences = () => {
    const storedGeofences = geofences.filter(
      (g) => g && g.id && g.name && g.geometry
    );

    // Tentar encontrar buffers no mapa que não estejam na lista
    try {
      const map = MapModule.getMap();
      if (!map) return storedGeofences;

      const mapLayers = MapModule.getGeofenceLayers();
      const additionalGeofences = [];

      Object.entries(mapLayers).forEach(([id, layer]) => {
        // Verificar se este layer já está na lista de geofences armazenados
        const existsInStored = storedGeofences.some((g) => g.id == id);
        if (!existsInStored) {
          try {
            // Se for um círculo
            if (layer.getRadius) {
              const center = layer.getLatLng();
              const radius = layer.getRadius() / 1000; // converter para km

              // Criar buffer usando turf
              const point = turf.point([center.lng, center.lat]);
              const buffer = turf.buffer(point, radius, {
                units: "kilometers",
              });

              additionalGeofences.push({
                id:
                  parseInt(id) || Date.now() + Math.floor(Math.random() * 1000),
                name:
                  layer._popupContent?.replace(/<\/?[^>]+(>|$)/g, "") ||
                  `Buffer Ativo`,
                date: new Date().toISOString(),
                geometry: buffer,
                type: "buffer",
                center: [center.lat, center.lng],
                radius: radius,
              });
            }
            // Se for um layer GeoJSON
            else if (layer.toGeoJSON) {
              const geometry = layer.toGeoJSON();

              additionalGeofences.push({
                id:
                  parseInt(id) || Date.now() + Math.floor(Math.random() * 1000),
                name:
                  layer._popupContent?.replace(/<\/?[^>]+(>|$)/g, "") ||
                  `Área Ativa`,
                date: new Date().toISOString(),
                geometry: geometry,
              });
            }
          } catch (e) {
            console.warn("Erro ao processar camada do mapa:", e);
          }
        }
      });

      if (additionalGeofences.length > 0) {
        // Juntar com os armazenados e retornar
        return [...storedGeofences, ...additionalGeofences];
      }
    } catch (e) {
      console.error("Erro ao buscar áreas no mapa:", e);
    }

    return storedGeofences;
  };

  // Método para registrar buffers criados programaticamente
  const addBufferToGeofences = (bufferGeofence) => {
    // Garantir que o objeto tem os campos necessários
    if (
      !bufferGeofence ||
      !bufferGeofence.id ||
      !bufferGeofence.name ||
      !bufferGeofence.geometry
    ) {
      console.error("Buffer de geofence inválido:", bufferGeofence);
      return false;
    }

    // Adicionar tipo se não existir
    if (!bufferGeofence.type) {
      bufferGeofence.type = "buffer";
    }

    // Verificar se já existe
    const existingIndex = geofences.findIndex(
      (g) => g.id === bufferGeofence.id
    );
    if (existingIndex >= 0) {
      // Atualizar existente
      geofences[existingIndex] = bufferGeofence;
    } else {
      // Adicionar novo
      geofences.push(bufferGeofence);
    }

    saveGeofences();
    renderGeofenceList();

    return true;
  };

  return {
    init,
    getGeofences,
    addBufferToGeofences,
  };
})();

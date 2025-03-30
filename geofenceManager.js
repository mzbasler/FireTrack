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
                  <i class="bi bi-mouse"></i> Clicar 2x no mapa (definir centro e raio)
                </button>
                <button id="bufferRadiusBtn" class="btn btn-secondary">
                  <i class="bi bi-bullseye"></i> Clique + definir raio em km
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
      const modalElement = document.getElementById("bufferModal");
      try {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        } else {
          // Alternativa se o objeto modal não existir
          modalElement.classList.remove("show");
          modalElement.style.display = "none";
          document.body.classList.remove("modal-open");
          const backdrop = document.querySelector(".modal-backdrop");
          if (backdrop) {
            backdrop.parentNode.removeChild(backdrop);
          }
        }
      } catch (error) {
        console.warn("Erro ao fechar modal:", error);
        // Tentar forçar fechamento manual
        modalElement.classList.remove("show");
        modalElement.style.display = "none";
        document.body.classList.remove("modal-open");
        document
          .querySelectorAll(".modal-backdrop")
          .forEach((el) => el.remove());
      }

      // Verificar e ativar o BufferDrawingModule
      if (window.BufferDrawingModule) {
        try {
          window.BufferDrawingModule.toggleDrawingMode(true);

          if (window.Terminal) {
            window.Terminal.addMessage(
              "Modo de desenho de buffer ativado. Clique no mapa para definir o centro e depois clique novamente para definir o raio.",
              "info"
            );
          }
        } catch (error) {
          console.error("Erro ao ativar modo de desenho de buffer:", error);
          alert("Erro ao ativar modo de desenho. Tente novamente.");
        }
      } else {
        console.error("BufferDrawingModule não está disponível");
        alert(
          "Erro: Módulo de desenho de buffer não está disponível. Tente usar o método alternativo."
        );
      }
    });

    document.getElementById("bufferRadiusBtn").addEventListener("click", () => {
      // Fechar modal
      const modalElement = document.getElementById("bufferModal");
      try {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        } else {
          // Alternativa se o objeto modal não existir
          modalElement.classList.remove("show");
          modalElement.style.display = "none";
          document.body.classList.remove("modal-open");
          const backdrop = document.querySelector(".modal-backdrop");
          if (backdrop) {
            backdrop.parentNode.removeChild(backdrop);
          }
        }
      } catch (error) {
        console.warn("Erro ao fechar modal:", error);
        // Tentar forçar fechamento manual
        modalElement.classList.remove("show");
        modalElement.style.display = "none";
        document.body.classList.remove("modal-open");
        document
          .querySelectorAll(".modal-backdrop")
          .forEach((el) => el.remove());
      }

      // Usar o modo de criação de buffer por clique + raio definido
      if (window.Terminal) {
        window.Terminal.addMessage(
          "Clique no mapa para definir o centro do buffer.",
          "info"
        );
      }

      // Alterar cursor
      const mapEl = document.getElementById("map");
      if (mapEl) {
        mapEl.style.cursor = "crosshair";
      }

      // Adicionar um listener de clique único
      const map = MapModule.getMap();
      const clickHandler = (e) => {
        const center = e.latlng;

        // Remover o evento de clique após o primeiro clique
        map.off("click", clickHandler);

        // Restaurar cursor
        if (mapEl) {
          mapEl.style.cursor = "";
        }

        // Solicitar raio via prompt
        const radiusInput = prompt("Digite o raio do buffer em km:", "5");
        const radius = parseFloat(radiusInput);

        if (!radiusInput || isNaN(radius) || radius <= 0) {
          alert("Raio inválido. Operação cancelada.");
          return;
        }

        // Solicitar nome
        const name = prompt("Digite um nome para este buffer:");
        if (!name || name.trim() === "") {
          alert(
            "É necessário fornecer um nome para o buffer. Operação cancelada."
          );
          return;
        }

        // Criar buffer
        const bufferId = Date.now();

        // Criar objeto GeoJSON
        const point = turf.point([center.lng, center.lat]);
        const options = { steps: 128, units: "kilometers" };
        const buffer = turf.buffer(point, radius, options);

        // Criar objeto de geofence
        const newGeofence = {
          id: bufferId,
          name: name.trim(),
          date: new Date().toISOString(),
          geometry: buffer,
          type: "buffer",
          center: [center.lat, center.lng],
          radius: radius,
        };

        // Adicionar ao mapModule
        MapModule.addCircleBuffer(
          [center.lat, center.lng],
          radius,
          name,
          bufferId
        );

        // Adicionar ao GeofenceManager
        geofences.push(newGeofence);
        saveGeofences();
        renderGeofenceList();

        // Notificar
        if (window.Terminal) {
          window.Terminal.addMessage(
            `Buffer "${name}" criado com raio de ${radius}km.`,
            "success"
          );
        }

        // Verificar alertas para o novo buffer
        if (
          window.AlertSystem &&
          typeof window.AlertSystem.checkAlerts === "function"
        ) {
          setTimeout(() => window.AlertSystem.checkAlerts(), 1000);
        }

        alert("Buffer circular cadastrado com sucesso!");
      };

      map.on("click", clickHandler);
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
    try {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } catch (error) {
      console.error("Erro ao exibir modal:", error);
      // Alternativa se bootstrap.Modal não estiver disponível
      modalElement.classList.add("show");
      modalElement.style.display = "block";
      document.body.classList.add("modal-open");

      // Criar backdrop
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop fade show";
      document.body.appendChild(backdrop);
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
            MapModule.addGeofence(
              gf.geometry,
              gf.name,
              gf.id,
              gf.type === "buffer"
            );
          }
        }
      } catch (error) {
        console.error(`Erro ao carregar área ${gf.id}:`, error);
      }
    });
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

  const deleteGeofence = (id) => {
    if (confirm("Tem certeza que deseja excluir esta área permanentemente?")) {
      geofences = geofences.filter((g) => g.id !== id);
      saveGeofences();
      MapModule.removeGeofence(id);
      renderGeofenceList();
    }
  };

  const saveGeofences = () => {
    // Verificar visualmente os geofences antes de salvar
    console.log("Salvando geofences:", geofences);
    localStorage.setItem("geofences", JSON.stringify(geofences));

    // Verificar se foi salvo corretamente
    const saved = localStorage.getItem("geofences");
    console.log("Geofences salvos:", saved);
  };

  const renderGeofenceList = () => {
    console.log("Renderizando lista de geofences:", geofences);

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

    // Separar entre áreas normais e buffers
    const normalGeofences = validGeofences.filter((g) => g.type !== "buffer");
    const bufferGeofences = validGeofences.filter((g) => g.type === "buffer");

    let html = "";

    // Renderizar áreas normais
    if (normalGeofences.length > 0) {
      html += `<div class="geofence-category">Áreas</div>`;
      html += normalGeofences
        .map((geofence) => {
          const date = new Date(geofence.date);
          const formattedDate = isNaN(date.getTime())
            ? "Data desconhecida"
            : date.toLocaleDateString("pt-BR");

          return `
          <div class="geofence-item" data-id="${geofence.id}">
            <div class="geofence-header">
              <span class="geofence-name"><i class="bi bi-geo-alt"></i> ${
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
    }

    // Renderizar buffers
    if (bufferGeofences.length > 0) {
      html += `<div class="geofence-category ${
        normalGeofences.length > 0 ? "mt-3" : ""
      }">Buffers</div>`;
      html += bufferGeofences
        .map((geofence) => {
          const date = new Date(geofence.date);
          const formattedDate = isNaN(date.getTime())
            ? "Data desconhecida"
            : date.toLocaleDateString("pt-BR");

          const radiusInfo = geofence.radius
            ? `Raio: ${geofence.radius.toFixed(1)}km`
            : "";

          return `
          <div class="geofence-item buffer-item" data-id="${geofence.id}">
            <div class="geofence-header">
              <span class="geofence-name"><i class="bi bi-bullseye"></i> ${
                geofence.name || "Buffer sem nome"
              }</span>
              <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${
                geofence.id
              }" title="Excluir buffer">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <small class="text-muted">${radiusInfo} • ${formattedDate}</small>
          </div>
        `;
        })
        .join("");
    }

    // Atualizar o HTML
    listContainer.innerHTML = html;

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
                type: layer._isBuffer ? "buffer" : undefined,
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
    renderGeofenceList,
  };
})();

const BufferDrawingModule = (() => {
  let isDrawingMode = false;
  let centerPoint = null;
  let map = null;
  let centerMarker = null;
  let previewCircle = null;
  let drawingOverlay = null;
  let mouseMoveListener = null;

  const init = () => {
    // Obter referência ao mapa
    map = MapModule.getMap();

    // Criar botão para adicionar buffer
    setupBufferControl();

    // Adicionar evento de clique ao mapa
    map.on("click", handleMapClick);

    // Criar overlay para instruções
    createDrawingOverlay();
  };

  const setupBufferControl = () => {
    // Encontrar o container da área de arquivo
    const fileInputContainer = document.querySelector(
      ".mb-4:has(#geofenceFile)"
    );

    if (fileInputContainer) {
      // Criar o botão de buffer após o input file
      const bufferButton = document.createElement("button");
      bufferButton.id = "addBufferBtn";
      bufferButton.className = "btn btn-outline-primary mt-2 buffer-btn";
      bufferButton.innerHTML = '<i class="bi bi-circle"></i> Adicionar buffer';
      bufferButton.title =
        "Clique para ativar o modo de criação de buffer circular";

      // Inserir após o container do input file
      fileInputContainer.appendChild(bufferButton);

      // Adicionar listener ao botão
      bufferButton.addEventListener("click", toggleDrawingMode);
    }
  };

  const createDrawingOverlay = () => {
    // Criar overlay para instruções de desenho
    drawingOverlay = document.createElement("div");
    drawingOverlay.className = "drawing-overlay";
    drawingOverlay.innerHTML =
      "<p>Clique no mapa para definir o centro do buffer</p>";
    document.querySelector(".map-container").appendChild(drawingOverlay);
  };

  const toggleDrawingMode = () => {
    isDrawingMode = !isDrawingMode;
    const bufferBtn = document.getElementById("addBufferBtn");

    if (isDrawingMode) {
      // Ativar modo de desenho
      bufferBtn.classList.add("active");

      // Exibir mensagem de instrução
      drawingOverlay.style.display = "block";

      // Registrar evento no terminal
      if (window.Terminal) {
        window.Terminal.addMessage("Modo de criação de buffer ativado", "info");
      }

      // Mudar o cursor
      document.getElementById("map").style.cursor = "crosshair";
    } else {
      // Desativar modo de desenho
      bufferBtn.classList.remove("active");

      // Esconder mensagem de instrução
      drawingOverlay.style.display = "none";

      // Limpar desenho em progresso
      clearDrawing();

      // Restaurar cursor
      document.getElementById("map").style.cursor = "";

      // Registrar evento no terminal
      if (window.Terminal) {
        window.Terminal.addMessage(
          "Modo de criação de buffer desativado",
          "info"
        );
      }
    }
  };

  const handleMapClick = (e) => {
    if (!isDrawingMode) return;

    const clickedLatLng = e.latlng;

    if (!centerPoint) {
      // Primeiro clique - definir o centro
      centerPoint = clickedLatLng;

      // Adicionar marcador para o centro
      centerMarker = L.marker(centerPoint).addTo(map);

      // Atualizar mensagem de instrução
      drawingOverlay.innerHTML = "<p>Clique para definir o raio do buffer</p>";

      // Registrar no terminal
      if (window.Terminal) {
        window.Terminal.addMessage(
          `Centro do buffer definido em: ${centerPoint.lat.toFixed(
            6
          )}, ${centerPoint.lng.toFixed(6)}`,
          "info"
        );
      }

      // Adicionar visualização prévia ao mover o mouse
      mouseMoveListener = (e) => {
        const mouseLatLng = e.latlng;
        const radius = centerPoint.distanceTo(mouseLatLng);

        // Atualizar ou criar o círculo de visualização
        if (previewCircle) {
          previewCircle.setRadius(radius);
        } else {
          previewCircle = L.circle(centerPoint, {
            radius: radius,
            color: document.body.classList.contains("dark-mode")
              ? "#00ffff"
              : "#1e88e5",
            fillColor: document.body.classList.contains("dark-mode")
              ? "#00ffff"
              : "#1e88e5",
            fillOpacity: 0.2,
            weight: 2,
            dashArray: "5, 5",
          }).addTo(map);
        }
      };

      // Adicionar o listener de movimento do mouse
      map.on("mousemove", mouseMoveListener);
    } else {
      // Segundo clique - definir o raio e criar o círculo
      const radiusInMeters = centerPoint.distanceTo(clickedLatLng);

      // Remover a visualização prévia e o listener
      if (previewCircle) {
        map.removeLayer(previewCircle);
        previewCircle = null;
      }

      if (mouseMoveListener) {
        map.off("mousemove", mouseMoveListener);
        mouseMoveListener = null;
      }

      // Criar ponto para o centro
      const point = turf.point([centerPoint.lng, centerPoint.lat]);

      // Converter raio de metros para quilômetros para o turf.buffer
      const radiusInKm = radiusInMeters / 1000;

      // Criar buffer usando Turf.js com mais steps para um círculo mais suave
      const options = { steps: 128, units: "kilometers" };
      const buffer = turf.buffer(point, radiusInKm, options);

      // Pedir um nome para o buffer
      const bufferName = prompt("Digite um nome para este buffer:");

      if (bufferName && bufferName.trim() !== "") {
        // Criar geofence no sistema
        const newGeofence = {
          id: Date.now(),
          name: bufferName.trim(),
          date: new Date().toISOString(),
          geometry: buffer,
          type: "buffer", // Adicionar tipo para diferenciar de áreas normais
        };

        // Adicionar ao mapa usando o GeofenceManager existente
        if (MapModule.addGeofence(buffer, bufferName, newGeofence.id, true)) {
          // true para marcar como buffer
          // Adicionar à lista de geofences
          const geofences = JSON.parse(
            localStorage.getItem("geofences") || "[]"
          );
          geofences.push(newGeofence);
          localStorage.setItem("geofences", JSON.stringify(geofences));

          // Atualizar lista visual de geofences
          if (typeof GeofenceManager.renderGeofenceList === "function") {
            GeofenceManager.renderGeofenceList();
          }

          // Notificar o usuário
          alert("Buffer circular cadastrado com sucesso!");

          // Registrar no terminal
          if (window.Terminal) {
            window.Terminal.addMessage(
              `Buffer "${bufferName}" criado com raio de ${radiusInKm.toFixed(
                2
              )} km`,
              "success"
            );
          }
        }

        // Resetar o modo de desenho
        clearDrawing();
        toggleDrawingMode();
      } else {
        // Usuário cancelou o prompt
        clearDrawing();
        alert(
          "Operação cancelada: é necessário fornecer um nome para o buffer."
        );
      }
    }
  };

  const clearDrawing = () => {
    // Limpar marcador do centro
    if (centerMarker) {
      map.removeLayer(centerMarker);
      centerMarker = null;
    }

    // Limpar círculo de prévia
    if (previewCircle) {
      map.removeLayer(previewCircle);
      previewCircle = null;
    }

    // Remover listener de movimento do mouse
    if (mouseMoveListener) {
      map.off("mousemove", mouseMoveListener);
      mouseMoveListener = null;
    }

    // Resetar variáveis
    centerPoint = null;

    // Resetar instruções
    drawingOverlay.innerHTML =
      "<p>Clique no mapa para definir o centro do buffer</p>";
  };

  return {
    init,
  };
})();

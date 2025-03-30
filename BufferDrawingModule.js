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

    // Criar overlay para instruções
    createDrawingOverlay();
  };

  const createDrawingOverlay = () => {
    // Criar overlay para instruções de desenho se ainda não existir
    if (!document.querySelector(".drawing-overlay")) {
      drawingOverlay = document.createElement("div");
      drawingOverlay.className = "drawing-overlay";
      drawingOverlay.innerHTML =
        "<p>Clique no mapa para definir o centro do buffer</p>";
      document.querySelector(".map-container").appendChild(drawingOverlay);
      drawingOverlay.style.display = "none"; // Inicialmente escondido
    } else {
      drawingOverlay = document.querySelector(".drawing-overlay");
    }
  };

  const toggleDrawingMode = (enable) => {
    isDrawingMode = enable !== undefined ? enable : !isDrawingMode;

    if (isDrawingMode) {
      // Ativar modo de desenho
      // Exibir mensagem de instrução
      drawingOverlay.style.display = "block";

      // Adicionar evento de clique ao mapa (se ainda não estiver adicionado)
      map.off("click", handleMapClick); // Remover para evitar duplicação
      map.on("click", handleMapClick);

      // Registrar evento no terminal
      if (window.Terminal) {
        window.Terminal.addMessage("Modo de criação de buffer ativado", "info");
      }

      // Mudar o cursor
      document.getElementById("map").style.cursor = "crosshair";
    } else {
      // Desativar modo de desenho
      // Esconder mensagem de instrução
      drawingOverlay.style.display = "none";

      // Limpar desenho em progresso
      clearDrawing();

      // Remover o evento de clique do mapa
      map.off("click", handleMapClick);

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

      // Converter raio de metros para quilômetros para o turf.buffer
      const radiusInKm = radiusInMeters / 1000;

      // Pedir um nome para o buffer
      const bufferName = prompt("Digite um nome para este buffer:");

      if (bufferName && bufferName.trim() !== "") {
        // Criar buffer no sistema
        const bufferId = Date.now();

        try {
          // Criar ponto para o centro
          const point = turf.point([centerPoint.lng, centerPoint.lat]);

          // Criar buffer usando Turf.js com mais steps para um círculo mais suave
          const options = { steps: 128, units: "kilometers" };
          const buffer = turf.buffer(point, radiusInKm, options);

          // Criar geofence no sistema
          const newGeofence = {
            id: bufferId,
            name: bufferName.trim(),
            date: new Date().toISOString(),
            geometry: buffer,
            type: "buffer", // Essencial: define o tipo como buffer para categorização correta
            center: [centerPoint.lat, centerPoint.lng],
            radius: radiusInKm,
          };

          console.log("Tentando salvar novo buffer:", newGeofence);

          // CORREÇÃO: Manipular diretamente o array de geofences no localStorage
          let geofences = [];
          try {
            const stored = localStorage.getItem("geofences");
            if (stored) {
              geofences = JSON.parse(stored);
              if (!Array.isArray(geofences)) {
                geofences = [];
              }
            }
          } catch (e) {
            console.error("Erro ao carregar geofences do localStorage:", e);
            geofences = [];
          }

          // Adicionar o novo buffer ao array
          geofences.push(newGeofence);

          // Salvar o array atualizado no localStorage
          localStorage.setItem("geofences", JSON.stringify(geofences));

          // Log para verificar se o buffer foi adicionado
          console.log("Buffer adicionado ao localStorage:", newGeofence);
          console.log("Geofences atualizados:", geofences);

          // Forçar atualização da lista visual
          if (
            window.GeofenceManager &&
            typeof window.GeofenceManager.renderGeofenceList === "function"
          ) {
            window.GeofenceManager.renderGeofenceList();
          }

          // Adicionar visualmente ao mapa
          MapModule.addCircleBuffer(
            [centerPoint.lat, centerPoint.lng],
            radiusInKm,
            bufferName.trim(),
            bufferId
          );

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

          // Verificar alertas para o novo buffer
          if (
            window.AlertSystem &&
            typeof window.AlertSystem.checkAlerts === "function"
          ) {
            setTimeout(() => {
              window.AlertSystem.checkAlerts();
            }, 1000);
          }
        } catch (error) {
          console.error("Erro ao criar buffer:", error);
          if (window.Terminal) {
            window.Terminal.addMessage(
              `Erro ao criar buffer: ${error.message}`,
              "error"
            );
          }
          alert(`Erro ao criar buffer: ${error.message}`);
        }

        // Resetar o modo de desenho
        clearDrawing();
        toggleDrawingMode(false);
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
    toggleDrawingMode,
  };
})();

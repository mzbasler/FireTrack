const AlertSystem = (() => {
  let lastCheckedHotspots = {}; // Armazenar os últimos hotspots para evitar alertas duplicados
  let cachedHotspots = []; // Cache dos focos de calor mais recentes
  let isUpdating = false; // Controla se uma atualização está em andamento

  const init = () => {
    // Adicionar botão de atualização ao lado do switch de focos de calor
    addUpdateButton();

    // Verificar alertas a cada 5 minutos
    setInterval(checkAlerts, 300000);

    // Verificar alertas inicialmente com pequeno delay
    setTimeout(() => {
      updateHotspots().then(() => checkAlerts());
    }, 3000);

    // Solicitar permissão para notificações
    requestNotificationPermission();

    // Adicionar log no terminal para debug
    if (window.Terminal && typeof window.Terminal.addMessage === "function") {
      window.Terminal.addMessage("Sistema de alertas inicializado.", "info");
    }
  };

  // Adiciona um botão de atualização ao lado do switch de focos de calor
  const addUpdateButton = () => {
    const heatToggleLabel = document.querySelector('label[for="heatToggle"]');
    if (!heatToggleLabel) return;

    const updateBtn = document.createElement("button");
    updateBtn.id = "updateHotspotsBtn";
    updateBtn.className = "btn btn-sm btn-outline-danger ms-2";
    updateBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    updateBtn.title = "Atualizar focos de calor";
    updateBtn.addEventListener("click", handleUpdateButtonClick);

    // Inserir após o label
    heatToggleLabel.parentNode.insertBefore(
      updateBtn,
      heatToggleLabel.nextSibling
    );

    // Adicionar estilo CSS inline para o botão se não existir no CSS
    if (!document.querySelector("style#updateBtnStyle")) {
      const style = document.createElement("style");
      style.id = "updateBtnStyle";
      style.innerHTML = `
        #updateHotspotsBtn {
          width: 32px;
          height: 32px;
          padding: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease;
        }
        #updateHotspotsBtn:hover {
          transform: rotate(180deg);
        }
        #updateHotspotsBtn.updating {
          animation: spin 1s linear infinite;
        }
        body.dark-mode #updateHotspotsBtn {
          color: #00ff00;
          border-color: rgba(0, 255, 0, 0.5);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  };

  const handleUpdateButtonClick = (e) => {
    e.preventDefault();
    if (isUpdating) return; // Evitar múltiplas atualizações simultâneas

    const btn = document.getElementById("updateHotspotsBtn");
    if (btn) {
      btn.classList.add("updating");
      btn.disabled = true;
    }

    showSystemMessage("Atualizando dados de focos de calor...");

    updateHotspots()
      .then(() => {
        showSystemMessage("Dados de focos atualizados com sucesso!", "success");
        checkAlerts();

        if (btn) {
          btn.classList.remove("updating");
          btn.disabled = false;
        }
      })
      .catch((error) => {
        showSystemMessage(`Erro ao atualizar focos: ${error.message}`, "error");

        if (btn) {
          btn.classList.remove("updating");
          btn.disabled = false;
        }
      });
  };

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      if (
        Notification.permission !== "denied" &&
        Notification.permission !== "granted"
      ) {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            showSystemMessage("Notificações ativadas com sucesso!");
          }
        });
      }
    } else {
      console.warn("Este navegador não suporta notificações desktop");
    }
  };

  // Atualiza os dados de focos de calor
  const updateHotspots = async () => {
    isUpdating = true;
    try {
      cachedHotspots = await fetchHotspots();
      isUpdating = false;
      return cachedHotspots;
    } catch (error) {
      isUpdating = false;
      throw error;
    }
  };

  const checkAlerts = async () => {
    try {
      showSystemMessage("Verificando focos de calor nas áreas monitoradas...");

      // Usar os hotspots em cache ou buscar novos se o cache estiver vazio
      let hotspots =
        cachedHotspots.length > 0 ? cachedHotspots : await updateHotspots();

      if (!hotspots || hotspots.length === 0) {
        showSystemMessage(
          "Nenhum foco de calor encontrado na verificação atual."
        );
        return;
      }

      // Obter geofences do gerenciador
      const geofences = GeofenceManager.getGeofences();
      if (!geofences || geofences.length === 0) {
        showSystemMessage(
          "Não há áreas de monitoramento cadastradas.",
          "warning"
        );
        return;
      }

      // Log para debug
      showSystemMessage(
        `Verificando ${hotspots.length} focos em ${geofences.length} áreas...`
      );

      let alertsFound = 0;
      let hotspotsChecked = 0;

      // Para cada geofence, verifica cada hotspot
      geofences.forEach((geofence) => {
        if (!geofence || !geofence.geometry) {
          console.log("Geofence inválido:", geofence);
          return;
        }

        hotspots.forEach((hotspot) => {
          hotspotsChecked++;
          if (!hotspot.latitude || !hotspot.longitude) return;

          // Cria um ponto Turf com as coordenadas do hotspot
          const point = turf.point([hotspot.longitude, hotspot.latitude]);

          try {
            // Verifica se o hotspot está dentro da geofence
            const isInside = checkPointInGeometry(point, geofence.geometry);

            // Se estiver dentro e não tiver sido alertado recentemente
            const hotspotKey = `${hotspot.latitude},${hotspot.longitude}`;
            if (
              isInside &&
              (!lastCheckedHotspots[geofence.id] ||
                !lastCheckedHotspots[geofence.id].includes(hotspotKey))
            ) {
              showAlert(geofence.name, hotspot);
              alertsFound++;

              // Registra este hotspot para evitar alertas duplicados
              if (!lastCheckedHotspots[geofence.id]) {
                lastCheckedHotspots[geofence.id] = [];
              }
              lastCheckedHotspots[geofence.id].push(hotspotKey);
            }
          } catch (e) {
            console.error("Erro ao verificar ponto:", e);
          }
        });
      });

      // Logs de conclusão
      if (alertsFound > 0) {
        showSystemMessage(
          `Detectados ${alertsFound} novos focos de calor em áreas monitoradas!`,
          "warning"
        );
      } else {
        showSystemMessage(
          `Verificação concluída. ${hotspotsChecked} focos verificados. Nenhum novo foco detectado nas áreas monitoradas.`
        );
      }
    } catch (error) {
      console.error("Erro ao verificar alertas:", error);
      showSystemMessage("Erro ao verificar alertas: " + error.message, "error");
    }
  };

  // Função melhorada para verificar se um ponto está em uma geometria, lidando com diferentes formatos
  const checkPointInGeometry = (point, geometry) => {
    try {
      // Caso 1: Tentar diretamente com a geometria fornecida
      return turf.booleanPointInPolygon(point, geometry);
    } catch (error) {
      try {
        // Caso 2: Se a geometria tiver uma propriedade 'geometry' (comum em features GeoJSON)
        if (geometry.geometry) {
          return turf.booleanPointInPolygon(point, geometry.geometry);
        }

        // Caso 3: Se for um FeatureCollection, verificar cada feature
        if (geometry.type === "FeatureCollection" && geometry.features) {
          return geometry.features.some((feature) => {
            try {
              return turf.booleanPointInPolygon(
                point,
                feature.geometry || feature
              );
            } catch (e) {
              return false;
            }
          });
        }

        // Caso 4: Para círculos, converter para polígono
        if (
          geometry.type === "Circle" ||
          (geometry._radius && geometry._latlng)
        ) {
          try {
            const center = geometry._latlng || [geometry.lat, geometry.lng];
            const radius = geometry._radius || geometry.radius;
            const circle = turf.circle(
              [center.lng, center.lat],
              radius / 1000,
              { units: "kilometers" }
            );
            return turf.booleanPointInPolygon(point, circle);
          } catch (e) {
            console.warn("Erro ao converter círculo:", e.message);
          }
        }

        // Caso 5: Verificar várias propriedades de coordenadas possíveis
        if (geometry.coordinates) {
          try {
            // Criar um polígono temporário para verificação
            const poly = { type: "Polygon", coordinates: geometry.coordinates };
            return turf.booleanPointInPolygon(point, poly);
          } catch (e) {
            console.warn("Erro ao usar coordinates:", e.message);
          }
        }

        return false;
      } catch (nestedError) {
        console.error("Erro ao verificar ponto na geometria:", nestedError);
        return false;
      }
    }
  };

  const showAlert = (geofenceName, hotspot) => {
    // Adicionar alerta visual na interface
    const alertsDiv = document.getElementById("alerts");
    const now = new Date();
    const alertHTML = `
      <div class="alert alert-danger alert-notification">
        <strong>🔥 Alerta!</strong> Foco detectado em ${geofenceName}<br>
        <small>Lat: ${hotspot.latitude.toFixed(
          4
        )}, Lon: ${hotspot.longitude.toFixed(4)}</small><br>
        <small>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</small>
      </div>
    `;

    alertsDiv.insertAdjacentHTML("afterbegin", alertHTML);

    // Enviar notificação push
    sendPushNotification(geofenceName, hotspot);

    // Registrar no terminal
    showSystemMessage(
      `ALERTA: Foco de calor detectado em ${geofenceName}`,
      "error"
    );

    // Adicionar evento de clique no alerta para centralizar o mapa
    const alertElement = alertsDiv.querySelector(".alert-notification");
    if (alertElement) {
      alertElement.addEventListener("click", () => {
        MapModule.getMap().setView([hotspot.latitude, hotspot.longitude], 13);
      });
    }
  };

  const sendPushNotification = (geofenceName, hotspot) => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "granted") {
      const notification = new Notification("🔥 Foco de calor detectado!", {
        body: `Área: ${geofenceName}\nCoordenadas: ${hotspot.latitude.toFixed(
          4
        )}, ${hotspot.longitude.toFixed(4)}`,
        icon: "https://cdn-icons-png.flaticon.com/512/785/785116.png",
        tag: `fire-${geofenceName}-${Date.now()}`,
        requireInteraction: true,
      });

      notification.onclick = function () {
        window.focus();
        // Centralizar o mapa no local do foco
        if (MapModule && MapModule.getMap()) {
          MapModule.getMap().setView([hotspot.latitude, hotspot.longitude], 13);
        }
        this.close();
      };
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          sendPushNotification(geofenceName, hotspot);
        }
      });
    }
  };

  const showSystemMessage = (message, type = "info") => {
    console.log(`[${type}] ${message}`);

    if (window.Terminal && typeof window.Terminal.addMessage === "function") {
      window.Terminal.addMessage(message, type);
    }
  };

  // Simula o download de dados de focos de calor
  const fetchHotspots = async () => {
    try {
      showSystemMessage(
        "Conectando à API do SIPAM para obter dados de focos..."
      );

      // Simular o tempo de resposta da API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Tentar obter focos do mapa, se disponível
      if (MapModule && typeof MapModule.getVisibleHotspots === "function") {
        const visibleHotspots = MapModule.getVisibleHotspots();
        if (visibleHotspots && visibleHotspots.length > 0) {
          showSystemMessage(
            `Recebidos ${visibleHotspots.length} focos de calor.`
          );
          return visibleHotspots;
        }
      }

      // Dados fixos para teste, incluindo o ponto que deve estar dentro do buffer azul
      const specificHotspots = [
        { latitude: -15.21, longitude: -47.64 }, // Ponto provavelmente dentro do buffer
        { latitude: -15.05, longitude: -47.95 },
        { latitude: -15.3, longitude: -47.25 },
        { latitude: -15.55, longitude: -47.8 },
        { latitude: -15.7, longitude: -47.5 },
        { latitude: -15.4, longitude: -47.35 },
        { latitude: -15.25, longitude: -47.55 },
        { latitude: -15.1, longitude: -47.7 },
        { latitude: -14.9, longitude: -47.9 },
      ];

      showSystemMessage(`Recebidos ${specificHotspots.length} focos de calor.`);
      return specificHotspots;
    } catch (error) {
      console.error("Erro ao buscar dados de hotspots:", error);
      showSystemMessage(
        "Falha ao obter dados de focos de calor. Verifique sua conexão.",
        "error"
      );
      return [];
    }
  };

  // API pública
  return {
    init,
    checkAlerts, // Expor para verificações manuais
    fetchHotspots, // Expor para debugging
    updateHotspots, // Expor para atualização manual
  };
})();

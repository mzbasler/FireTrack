(function (namespace) {
  const UPDATE_INTERVAL = 20000; // 20 seconds
  let updateInterval = null;

  async function initApp() {
    console.log("Iniciando aplicação FireTrack...");

    try {
      // 1. Initialize map first
      console.log("Inicializando mapa...");
      const map = namespace.MapModule.init();
      if (!map) {
        throw new Error("Falha ao inicializar o mapa");
      }

      // 2. Load initial data
      console.log("Carregando dados iniciais...");
      const initialDataLoaded = await namespace.DataModule.loadData();
      if (!initialDataLoaded) {
        console.warn("Nenhum dado inicial carregado");
      }

      // 3. Initialize visual modules
      console.log("Inicializando módulos visuais...");

      // Heat points layer
      if (!namespace.HeatFilter.init()) {
        console.error("Falha ao inicializar filtro de calor");
      }

      // Geofence manager
      if (!namespace.GeofenceManager.init()) {
        console.error("Falha ao inicializar gerenciador de áreas");
      }

      // Buffer module (with error handling)
      try {
        if (!namespace.BufferModule.init()) {
          console.warn("Módulo de buffer inicializado com limitações");
        }
      } catch (bufferError) {
        console.error("Erro crítico no módulo de buffer:", bufferError);
        showAlert("Funcionalidade de buffer limitada");
      }

      // Dark mode
      namespace.DarkMode.init();

      // 4. Setup auto-update
      console.log("Configurando atualização automática...");
      setupAutoUpdate();

      // 5. Setup manual refresh button
      console.log("Configurando botão de atualização...");
      setupRefreshButton();

      // 6. Setup clear geofences button
      console.log("Configurando botão de limpar áreas...");
      setupClearGeofencesButton();

      console.log("Aplicação inicializada com sucesso!");
    } catch (error) {
      console.error("Erro na inicialização:", error);
      showAlert("Erro ao inicializar a aplicação");

      // Clean up if needed
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    }
  }

  function setupAutoUpdate() {
    updateInterval = setInterval(async () => {
      try {
        console.log("Atualização automática de dados...");
        await namespace.DataModule.loadData();
      } catch (error) {
        console.error("Erro na atualização automática:", error);
      }
    }, UPDATE_INTERVAL);
  }

  function setupRefreshButton() {
    const updateBtn = document.getElementById("updateHotspotsBtn");
    if (!updateBtn) {
      console.warn("Botão de atualização não encontrado");
      return;
    }

    updateBtn.addEventListener("click", async () => {
      // Visual feedback
      updateBtn.classList.add("updating");
      updateBtn.disabled = true;

      try {
        console.log("Atualização manual de dados...");
        await namespace.DataModule.loadData();
      } catch (error) {
        console.error("Erro na atualização manual:", error);
        showAlert("Erro ao atualizar dados");
      } finally {
        // Restore button state
        setTimeout(() => {
          updateBtn.classList.remove("updating");
          updateBtn.disabled = false;
        }, 1000);
      }
    });
  }

  function setupClearGeofencesButton() {
    const clearGeofencesBtn = document.getElementById("clearGeofencesBtn");
    if (!clearGeofencesBtn) {
      console.warn("Botão de limpar áreas não encontrado");
      return;
    }

    clearGeofencesBtn.addEventListener("click", function () {
      if (
        confirm("Tem certeza que deseja excluir todas as áreas monitoradas?")
      ) {
        namespace.GeofenceManager.clearAll();
        showAlert("Todas as áreas foram removidas");
      }
    });
  }

  function showAlert(message) {
    try {
      const alertsContainer = document.getElementById("alerts");
      if (!alertsContainer) {
        console.warn("Container de alertas não encontrado");
        return;
      }

      const alertDiv = document.createElement("div");
      alertDiv.className = "alert-notification alert alert-danger";
      alertDiv.innerHTML = `
        <i class="bi bi-exclamation-triangle"></i> ${message}
        <span class="float-end">&times;</span>
      `;

      const closeBtn = alertDiv.querySelector(".float-end");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          alertDiv.remove();
        });
      }

      // Add to container
      alertsContainer.prepend(alertDiv);

      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.remove();
        }
      }, 10000);
    } catch (error) {
      console.error("Erro ao exibir alerta:", error);
    }
  }

  // Handle DOM ready state
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(initApp, 1);
  } else {
    document.addEventListener("DOMContentLoaded", initApp);
  }

  // Clean up on page unload
  window.addEventListener("beforeunload", () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    // Cancel any active drawing
    if (namespace.BufferModule && namespace.BufferModule.cancelDrawing) {
      namespace.BufferModule.cancelDrawing();
    }
  });

  // Expose for debugging
  window.appNamespace = namespace;
})(window.FireTrack || (window.FireTrack = {}));

const AlertSystem = (() => {
  let lastCheckedHotspots = {}; // Armazenar os últimos hotspots para evitar alertas duplicados
  let cachedHotspots = []; // Cache dos focos de calor mais recentes
  let isUpdating = false; // Controla se uma atualização está em andamento

  const init = () => {
    // Adicionar botão de atualização ao lado do switch de focos de calor
    addUpdateButton();

    // Verificar alertas a cada 5 minutos
    setInterval(checkAlerts, 30000);

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
    const heatToggleContainer = document.querySelector(
      "div.form-check.form-switch.mb-3"
    );
    if (!heatToggleContainer) return;

    // Transformar o container em um flex container com space-between
    heatToggleContainer.style.display = "flex";
    heatToggleContainer.style.justifyContent = "space-between";
    heatToggleContainer.style.alignItems = "center";

    // Fixar alinhamento do ícone - corrigir margens e posicionamento vertical
    const heatLabel = document.querySelector('label[for="heatToggle"]');
    const areasLabel = document.querySelector('label[for="geofenceToggle"]');

    if (heatLabel) {
      // Garantir que o HTML é consistente
      const fireIcon = heatLabel.querySelector(".bi-fire");
      if (fireIcon) {
        // Remover o ícone existente
        fireIcon.remove();

        // Recriar o label com o ícone corrigido
        const textContent = heatLabel.textContent.trim();
        heatLabel.innerHTML = "";

        // Criar um span para conter o ícone e garantir alinhamento
        const iconContainer = document.createElement("span");
        iconContainer.className = "icon-container";

        // Criar o ícone com ajustes para ficar dentro dos limites
        const iconEl = document.createElement("i");
        iconEl.className = "bi bi-fire";
        iconContainer.appendChild(iconEl);

        // Adicionar o container e o texto
        heatLabel.appendChild(iconContainer);
        heatLabel.appendChild(document.createTextNode(" " + textContent));
      }
    }

    // Aplicar o mesmo padrão ao label de áreas cadastradas para consistência
    if (areasLabel) {
      const pinIcon = areasLabel.querySelector(".bi-pin-map");
      if (pinIcon) {
        // Substituir o ícone por um dentro de um container
        pinIcon.remove();

        const textContent = areasLabel.textContent.trim();
        areasLabel.innerHTML = "";

        const iconContainer = document.createElement("span");
        iconContainer.className = "icon-container";

        const iconEl = document.createElement("i");
        iconEl.className = "bi bi-pin-map";
        iconContainer.appendChild(iconEl);

        areasLabel.appendChild(iconContainer);
        areasLabel.appendChild(document.createTextNode(" " + textContent));
      }
    }

    // Verificar se já existe um botão
    const existingBtn = document.getElementById("updateHotspotsBtn");
    if (existingBtn) {
      existingBtn.remove();
    }

    const updateBtn = document.createElement("button");
    updateBtn.id = "updateHotspotsBtn";
    updateBtn.className = "update-button";
    updateBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    updateBtn.title = "Atualizar focos de calor";
    updateBtn.addEventListener("click", handleUpdateButtonClick);

    // Inserir após o label
    heatToggleContainer.appendChild(updateBtn);

    // Adicionar estilo CSS inline para garantir alinhamento correto
    if (!document.querySelector("style#updateBtnStyle")) {
      const style = document.createElement("style");
      style.id = "updateBtnStyle";
      style.innerHTML = `
        .update-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-color: transparent;
          color: var(--text-color);
          border: 1px solid var(--border-color);
          border-radius: 50% !important;
          width: 36px !important;
          height: 36px !important;
          min-width: 36px;
          min-height: 36px;
          max-width: 36px;
          max-height: 36px;
          cursor: pointer;
          transition: all 0.3s;
          margin-left: 15px;
          padding: 0 !important;
          overflow: hidden;
          box-sizing: border-box;
          line-height: 1;
        }
        
        .update-button:hover {
          transform: rotate(180deg);
        }
        
        .update-button.updating {
          animation: spin 1s linear infinite;
        }
        
        .update-button i {
          font-size: 20px;
          margin: 0;
          padding: 0;
        }
        
        body.dark-mode .update-button {
          background-color: rgba(0, 255, 0, 0.1);
          color: #00ff00;
          border-color: rgba(0, 255, 0, 0.3);
        }
        
        body.dark-mode .update-button:hover {
          background-color: rgba(0, 255, 0, 0.2);
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Container para alinhar ícones corretamente */
        .icon-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 5px;
          width: 16px;
          height: 16px;
          position: relative;
          top: -1px; /* Ajuste vertical para alinhar com o texto */
        }
        
        .icon-container i {
          font-size: 14px;
          line-height: 1;
          position: relative;
        }
        
        /* Ajustes específicos para o label */
        .form-check-label {
          display: flex;
          align-items: center;
          line-height: 1.5;
        }
        
        /* Correção para o alinhamento do switch */
        .form-check.form-switch.mb-3 {
          padding-right: 10px;
          margin-bottom: 0.8rem !important;
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

  // O resto do código permanece inalterado

  // Métodos resumidos para manter a clareza do snippet
  const requestNotificationPermission = () => {};
  const updateHotspots = async () => {
    return [];
  };
  const checkAlerts = async () => {};
  const checkPointInGeometry = () => {};
  const showAlert = () => {};
  const sendPushNotification = () => {};
  const showSystemMessage = () => {};
  const fetchHotspots = async () => {
    return [];
  };

  return {
    init,
    checkAlerts,
    fetchHotspots,
    updateHotspots,
  };
})();

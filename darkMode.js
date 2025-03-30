const DarkMode = (() => {
  const init = () => {
    // Modificar o layout para adicionar o botão de tema
    setupControlsHeader();

    // Atualizar elementos informativos
    updateInfoElements();

    // Verificar preferência salva
    loadSavedTheme();

    // Adicionar listener para o botão
    document
      .getElementById("themeToggle")
      .addEventListener("click", toggleTheme);

    // Aplicar correções para o modo inicial
    applyDarkModeCorrections(document.body.classList.contains("dark-mode"));
  };

  const setupControlsHeader = () => {
    // Encontrar o título de controles
    const controlsHeading = document.querySelector(".sidebar h5");

    if (controlsHeading) {
      // Criar o wrapper para o cabeçalho
      const headerDiv = document.createElement("div");
      headerDiv.className = "controls-header";

      // Criar o título com a classe para estilização
      const title = document.createElement("h5");
      title.className = "controls-title";
      title.innerHTML = controlsHeading.innerHTML;

      // Criar o botão toggle
      const button = document.createElement("button");
      button.id = "themeToggle";
      button.className = "theme-toggle";
      button.innerHTML = '<i class="bi bi-moon"></i>';
      button.title = "Alternar modo escuro";

      // Adicionar elementos ao wrapper
      headerDiv.appendChild(title);
      headerDiv.appendChild(button);

      // Substituir o cabeçalho original pelo novo layout
      controlsHeading.parentNode.replaceChild(headerDiv, controlsHeading);
    }
  };

  const updateInfoElements = () => {
    // Encontrar o elemento de texto de formatos aceitos
    const formatText = document.querySelector("small.text-muted");
    if (formatText && !formatText.querySelector(".bi-info-circle")) {
      formatText.innerHTML = `<i class="bi bi-info-circle"></i> ${formatText.textContent}`;
    }

    // Atualizar o alerta com o ícone do mouse
    const mouseAlert = document.querySelector(".alert-light");
    if (mouseAlert) {
      // Garantir que mantemos a estrutura com o ícone
      const smallElement = mouseAlert.querySelector("small");
      if (smallElement) {
        const alertContent = smallElement.innerHTML;

        // Verificar se já tem o ícone
        if (!alertContent.includes("bi-mouse")) {
          // Extrair o texto sem HTML
          const textContent = alertContent.replace(/<[^>]*>/g, "").trim();

          // Reconstruir com o mesmo estilo do alerta de info
          mouseAlert.classList.remove("alert-light");
          mouseAlert.classList.add("alert-info");
          smallElement.innerHTML = `<i class="bi bi-mouse"></i> ${textContent}`;
        }
      }
    }
  };

  const loadSavedTheme = () => {
    const isDarkMode = localStorage.getItem("darkMode") === "true";
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      updateThemeToggleIcon(true);
    }
  };

  const updateThemeToggleIcon = (isDarkMode) => {
    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.innerHTML = isDarkMode
        ? '<i class="bi bi-sun"></i>'
        : '<i class="bi bi-moon"></i>';
    }
  };

  const applyDarkModeCorrections = (isDarkMode) => {
    // Ajustar elementos que precisam de correções específicas no modo escuro
    if (isDarkMode) {
      // Ajustar atributos OpenStreetMap
      const attributions = document.querySelectorAll(
        ".leaflet-control-attribution"
      );
      attributions.forEach((attr) => {
        attr.style.backgroundColor = "#222";
        attr.style.color = "#00ff00";
      });

      // Ajustar controles do mapa
      const mapControls = document.querySelectorAll(".leaflet-control a");
      mapControls.forEach((control) => {
        control.style.backgroundColor = "#333";
        control.style.color = "#00ff00";
        control.style.borderColor = "rgba(0, 255, 0, 0.2)";
      });
    } else {
      // Reverter ajustes se sair do modo escuro
      const attributions = document.querySelectorAll(
        ".leaflet-control-attribution"
      );
      attributions.forEach((attr) => {
        attr.style.backgroundColor = "";
        attr.style.color = "";
      });

      const mapControls = document.querySelectorAll(".leaflet-control a");
      mapControls.forEach((control) => {
        control.style.backgroundColor = "";
        control.style.color = "";
        control.style.borderColor = "";
      });
    }
  };

  const updateTerminalForDarkMode = (isDarkMode) => {
    // O terminal já tem estilos CSS que respondem ao modo escuro
    // Esta função é para qualquer ajuste adicional necessário via JavaScript

    if (window.Terminal && typeof window.Terminal.updateTheme === "function") {
      window.Terminal.updateTheme(isDarkMode);
    }
  };

  const toggleTheme = () => {
    const isDarkMode = document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", isDarkMode);

    // Atualizar ícone
    updateThemeToggleIcon(isDarkMode);

    // Atualizar terminal
    updateTerminalForDarkMode(isDarkMode);

    // Aplicar correções específicas
    applyDarkModeCorrections(isDarkMode);

    // Forçar redimensionamento do mapa
    setTimeout(() => {
      const map = MapModule.getMap();
      if (map) {
        map.invalidateSize();
      }
    }, 200);
  };

  return {
    init,
  };
})();

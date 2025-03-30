// Atualização para o terminal.js para responder ao tema claro/escuro

const Terminal = (() => {
  let messages = [];
  const maxMessages = 100;

  const init = () => {
    // Criar o terminal
    const terminalContainer = document.createElement("div");
    terminalContainer.className = "terminal-container";
    terminalContainer.id = "terminal";

    // Adicionar ao DOM
    document.querySelector(".container-fluid").appendChild(terminalContainer);

    // Verificar e aplicar o tema atual
    applyCurrentTheme();

    // Adicionar mensagens iniciais
    logSystemStart();

    // Configurar eventos para acompanhar atividades
    setupEventListeners();

    // Simular algumas conexões e verificações
    simulateInitialActivities();
  };

  const applyCurrentTheme = () => {
    // Verificar se o modo escuro está ativo no momento da inicialização
    const isDarkMode = document.body.classList.contains("dark-mode");
    updateTheme(isDarkMode);
  };

  const updateTheme = (isDarkMode) => {
    // Esta função é chamada pelo DarkMode.js quando o tema muda
    // Podemos usar para ajustes específicos do terminal que não podem ser feitos apenas com CSS

    addMessage(
      `Tema ${isDarkMode ? "escuro" : "claro"} aplicado ao terminal`,
      "info"
    );
  };

  const logSystemStart = () => {
    addMessage("Sistema iniciado. FireTrack v1.0.0 carregado.", "info");
    addMessage("Conectando aos servidores...", "info");
  };

  const setupEventListeners = () => {
    // Monitorar carregamento do mapa
    document.addEventListener("mapInitialized", () => {
      addMessage("Mapa inicializado com sucesso.", "success");
    });

    // Monitorar toggles de camadas
    document.getElementById("heatToggle").addEventListener("change", (e) => {
      if (e.target.checked) {
        addMessage("Camada de focos de calor ativada.", "info");
      } else {
        addMessage("Camada de focos de calor desativada.", "info");
      }
    });

    document
      .getElementById("geofenceToggle")
      .addEventListener("change", (e) => {
        if (e.target.checked) {
          addMessage("Camada de áreas monitoradas ativada.", "info");
        } else {
          addMessage("Camada de áreas monitoradas desativada.", "info");
        }
      });

    // Monitorar upload de arquivos
    document.getElementById("geofenceFile").addEventListener("change", () => {
      addMessage("Processando arquivo de geofence...", "info");
    });

    // Monitorar mudanças de tema
    document.getElementById("themeToggle").addEventListener("click", () => {
      // O evento é capturado aqui, mas o DarkMode.js irá chamar updateTheme()
      // Não precisamos fazer nada aqui
    });
  };

  const simulateInitialActivities = () => {
    // Simular conexão com API
    setTimeout(() => {
      addMessage(
        "Conectado ao servidor SIPAM. Autenticação bem-sucedida.",
        "success"
      );
    }, 1500);

    // Simular verificação de dados
    setTimeout(() => {
      addMessage("Verificando dados de focos de calor...", "info");
    }, 2500);

    // Simular recebimento de dados
    setTimeout(() => {
      const randomCount = Math.floor(Math.random() * 150) + 50;
      addMessage(
        `Recebidos dados de ${randomCount} focos de calor ativos.`,
        "info"
      );
    }, 3500);

    // Simular verificação periódica
    setInterval(() => {
      checkApiStatus();
    }, 30000);

    // Primeira verificação da API
    setTimeout(checkApiStatus, 5000);
  };

  const checkApiStatus = () => {
    // Simulação de verificação de API com resultado aleatório
    const statusOptions = [
      {
        message: "Conexão com API SIPAM: OK. Latência: 230ms",
        type: "success",
      },
      {
        message: "Conexão com API SIPAM: OK. Latência: 350ms",
        type: "success",
      },
      {
        message: "Conexão com API SIPAM: Latência alta (780ms)",
        type: "warning",
      },
      { message: "Atualizando cache de dados de focos...", type: "info" },
    ];

    const randomStatus =
      statusOptions[Math.floor(Math.random() * statusOptions.length)];
    addMessage(randomStatus.message, randomStatus.type);
  };

  const addMessage = (text, type = "info") => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    const message = {
      timestamp,
      text,
      type,
    };

    messages.push(message);

    // Limitar o número de mensagens
    if (messages.length > maxMessages) {
      messages.shift();
    }

    // Atualizar a visualização
    updateTerminalView();
  };

  const updateTerminalView = () => {
    const terminal = document.getElementById("terminal");
    if (!terminal) return;

    terminal.innerHTML = "";

    messages.forEach((msg) => {
      const line = document.createElement("div");
      line.className = `terminal-line`;

      // Construir a linha com timestamp e mensagem
      line.innerHTML = `
        <span class="terminal-timestamp">[${msg.timestamp}]</span>
        <span class="terminal-${msg.type}">${msg.text}</span>
      `;

      terminal.appendChild(line);
    });

    // Auto-scroll para a mensagem mais recente
    terminal.scrollTop = terminal.scrollHeight;
  };

  // API pública
  return {
    init,
    addMessage,
    updateTheme, // Expor esta função para ser chamada pelo DarkMode.js
  };
})();

// Tornar disponível globalmente para que DarkMode.js possa acessar
window.Terminal = Terminal;

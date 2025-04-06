(function (namespace) {
  function initialize() {
    const darkModeToggle = document.createElement("button");
    darkModeToggle.className = "theme-toggle";
    darkModeToggle.innerHTML = '<i class="bi bi-moon-stars"></i>';
    darkModeToggle.title = "Alternar modo escuro";

    const controlsHeader = document.querySelector(".controls-header");
    if (controlsHeader) {
      controlsHeader.prepend(darkModeToggle);
    }

    darkModeToggle.addEventListener("click", toggleDarkMode);

    // Verificar preferência do sistema
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      document.body.classList.add("dark-mode");
    }
  }

  function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    const icon = this.querySelector("i");
    if (icon) {
      icon.classList.toggle("bi-moon-stars");
      icon.classList.toggle("bi-sun");
    }
  }

  namespace.DarkMode = {
    init: initialize,
  };
})(window.FireTrack || (window.FireTrack = {}));

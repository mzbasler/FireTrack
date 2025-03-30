document.addEventListener("DOMContentLoaded", () => {
  // Inicializa módulos
  const map = MapModule.init();
  HeatFilter.init();
  GeofenceManager.init();
  AlertSystem.init();
  DarkMode.init();
  Terminal.init(); // Inicializa o terminal
  BufferDrawingModule.init(); // Inicializa o módulo de buffer

  // Configura toggles iniciais
  document.getElementById("heatToggle").checked = true;
  document.getElementById("geofenceToggle").checked = true;

  // Força redimensionamento do mapa após carga
  setTimeout(() => {
    map.invalidateSize();
    // Centraliza o mapa se houver geofences
    const layers = MapModule.getGeofenceLayers();
    if (Object.keys(layers).length > 0) {
      const bounds = L.featureGroup(Object.values(layers)).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds);
      }
    }

    // Dispara evento de inicialização do mapa para o terminal
    const mapInitEvent = new Event("mapInitialized");
    document.dispatchEvent(mapInitEvent);
  }, 500);

  // Solicita permissão para notificações
  if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
});

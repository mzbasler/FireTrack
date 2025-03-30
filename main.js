document.addEventListener("DOMContentLoaded", () => {
  // Inicializa módulos
  const map = MapModule.init();
  HeatFilter.init();
  GeofenceManager.init();
  AlertSystem.init();

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
  }, 500);

  // Solicita permissão para notificações
  if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
});

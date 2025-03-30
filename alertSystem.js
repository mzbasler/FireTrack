const AlertSystem = (() => {
  const init = () => {
    setInterval(checkAlerts, 300000); // 5 minutos
    checkAlerts();
  };

  const checkAlerts = async () => {
    const hotspots = await fetchHotspots();
    const geofences = GeofenceManager.getGeofences();
    const alertsDiv = document.getElementById("alerts");

    geofences.forEach((geofence) => {
      hotspots.forEach((hotspot) => {
        const point = turf.point([hotspot.longitude, hotspot.latitude]);
        if (turf.booleanPointInPolygon(point, geofence.geometry)) {
          showAlert(geofence.name, hotspot);
        }
      });
    });
  };

  const showAlert = (geofenceName, hotspot) => {
    const alertsDiv = document.getElementById("alerts");
    const now = new Date();
    const alertHTML = `
          <div class="alert alert-danger alert-notification">
              <strong>🔥 Alerta!</strong> Foco detectado em ${geofenceName}<br>
              <small>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</small>
          </div>
      `;

    alertsDiv.insertAdjacentHTML("afterbegin", alertHTML);

    if (Notification.permission === "granted") {
      new Notification("Fogo detectado!", {
        body: `Área: ${geofenceName}`,
      });
    }
  };

  const fetchHotspots = () => {
    return Promise.resolve([
      { latitude: -15.79, longitude: -47.93 },
      { latitude: -23.55, longitude: -46.63 },
    ]);
  };

  return { init };
})();

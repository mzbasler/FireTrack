(function (namespace) {
  let mapInstance = null;

  function initialize() {
    console.log("Inicializando o mapa...");

    if (!mapInstance) {
      mapInstance = L.map("map", {
        preferCanvas: true,
        zoomControl: false,
      }).setView([-10, -55], 5);

      // Controle de zoom personalizado
      L.control
        .zoom({
          position: "topright",
        })
        .addTo(mapInstance);

      // Camada base OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapInstance);

      // Camada WMS SIPAM
      L.tileLayer
        .wms("https://panorama.sipam.gov.br/geoserver/painel_do_fogo/ows", {
          layers: "painel_do_fogo:mv_evento_filtro",
          format: "image/png",
          transparent: true,
          opacity: 0.8,
          version: "1.3.0",
        })
        .addTo(mapInstance);

      console.log("Mapa inicializado com sucesso.");
    }

    return mapInstance;
  }

  namespace.MapModule = {
    init: initialize,
    getMap: function () {
      if (!mapInstance) return initialize();
      return mapInstance;
    },
  };
})(window.FireTrack || (window.FireTrack = {}));

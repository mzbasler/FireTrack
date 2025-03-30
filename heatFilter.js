const HeatFilter = (() => {
  const init = () => {
    MapModule.initHeatLayer();

    document.getElementById("heatToggle").addEventListener("change", (e) => {
      MapModule.toggleHeatLayer(e.target.checked);
    });
  };

  return { init };
})();

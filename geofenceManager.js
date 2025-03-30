const GeofenceManager = (() => {
  let geofences = JSON.parse(localStorage.getItem("geofences")) || [];

  const init = () => {
    document
      .getElementById("geofenceFile")
      .addEventListener("change", handleFileUpload);
    document
      .getElementById("geofenceToggle")
      .addEventListener("change", (e) => {
        MapModule.toggleGeofences(e.target.checked);
      });

    renderGeofenceList();
    loadExistingGeofences();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const name = prompt("Digite um nome para esta área:");
    if (!name || name.trim() === "") {
      alert("O nome da área é obrigatório!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let geojson;

        if (file.name.endsWith(".kml")) {
          const kml = new DOMParser().parseFromString(
            event.target.result,
            "text/xml"
          );
          geojson = toGeoJSON.kml(kml);
        } else if (
          file.name.endsWith(".geojson") ||
          file.name.endsWith(".json")
        ) {
          geojson = JSON.parse(event.target.result);
        } else {
          throw new Error("Formato de arquivo não suportado");
        }

        if (!geojson.features || geojson.features.length === 0) {
          throw new Error("Arquivo sem dados geográficos válidos");
        }

        const buffer = turf.buffer(geojson, 5, { units: "kilometers" });

        const newGeofence = {
          id: Date.now(),
          name: name.trim(),
          date: new Date().toISOString(),
          geometry: buffer.geometry,
        };

        if (MapModule.addGeofence(buffer.geometry, name, newGeofence.id)) {
          geofences.push(newGeofence);
          saveGeofences();
          renderGeofenceList();
          alert("Área cadastrada com sucesso!");
        }
      } catch (error) {
        console.error("Erro ao processar arquivo:", error);
        alert(
          `Erro: ${error.message}\nVerifique se o arquivo é um KML/GeoJSON válido.`
        );
      } finally {
        // Reset input para permitir novo upload do mesmo arquivo
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const loadExistingGeofences = () => {
    geofences.forEach((gf) => {
      try {
        if (gf.geometry && gf.name && gf.id) {
          MapModule.addGeofence(gf.geometry, gf.name, gf.id);
        }
      } catch (error) {
        console.error(`Erro ao carregar área ${gf.id}:`, error);
      }
    });
  };

  const deleteGeofence = (id) => {
    if (confirm("Tem certeza que deseja excluir esta área permanentemente?")) {
      geofences = geofences.filter((g) => g.id !== id);
      saveGeofences();
      MapModule.removeGeofence(id);
      renderGeofenceList();
    }
  };

  const saveGeofences = () => {
    localStorage.setItem("geofences", JSON.stringify(geofences));
  };

  const renderGeofenceList = () => {
    const listContainer = document.getElementById("geofenceList");

    if (geofences.length === 0) {
      listContainer.innerHTML = `
              <div class="alert alert-info">
                  <i class="bi bi-info-circle"></i> Nenhuma área cadastrada ainda
              </div>
          `;
      return;
    }

    listContainer.innerHTML = geofences
      .map((geofence) => {
        const date = new Date(geofence.date);
        const formattedDate = isNaN(date.getTime())
          ? "Data desconhecida"
          : date.toLocaleDateString("pt-BR");

        return `
              <div class="geofence-item" data-id="${geofence.id}">
                  <div class="geofence-header">
                      <span class="geofence-name">${
                        geofence.name || "Área sem nome"
                      }</span>
                      <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${
                        geofence.id
                      }" title="Excluir área">
                          <i class="bi bi-trash"></i>
                      </button>
                  </div>
                  <small class="text-muted">Cadastrada em: ${formattedDate}</small>
              </div>
          `;
      })
      .join("");

    // Add event listeners
    document.querySelectorAll(".geofence-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".delete-btn")) return;
        const id = parseInt(item.dataset.id);
        MapModule.centerOnGeofence(id);
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        deleteGeofence(id);
      });
    });
  };

  const getGeofences = () => geofences;

  return {
    init,
    getGeofences,
  };
})();

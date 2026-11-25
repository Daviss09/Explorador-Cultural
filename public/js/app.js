import {
  BRAZIL_REGIONS,
  CULTURAL_CATEGORIES,
  MAP_CONFIG,
} from "./config/mapConstants.js?v=2";
import { buildCreatePinPopupElement } from "./components/popupTemplates.js?v=2";
import { CulturalMapController } from "./map/culturalMap.js?v=2";
import { PinApiService } from "./services/pinApiService.js?v=2";
import { loadBrazilGeographies } from "./services/ibgeService.js?v=2";
import { createSafeElement } from "./utils/sanitize.js?v=2";

function readAppConfigFromDom() {
  const configScript = document.getElementById("app-config-data");
  if (!configScript) {
    return {};
  }
  try {
    return JSON.parse(configScript.textContent || "{}");
  } catch {
    return {};
  }
}

function renderRegionLegend(container) {
  if (!container) return;
  container.replaceChildren();

  for (const region of BRAZIL_REGIONS) {
    const item = createSafeElement("li", { className: "map-legend__item" });
    const swatch = createSafeElement("span", {
      className: "map-legend__swatch",
      attrs: { "aria-hidden": "true" },
    });
    swatch.style.backgroundColor = region.color;

    const label = createSafeElement("span", {
      className: "map-legend__label",
      text: region.nome,
    });

    item.appendChild(swatch);
    item.appendChild(label);
    container.appendChild(item);
  }
}

function renderCategoryFilterSelect(selectEl) {
  if (!selectEl) return;
  for (const cat of CULTURAL_CATEGORIES) {
    selectEl.appendChild(
      createSafeElement("option", {
        text: cat.label,
        attrs: { value: cat.value },
      }),
    );
  }
}

function showToast(toastEl, message, variant = "success") {
  if (!toastEl) return;
  toastEl.className = `map-toast map-toast--${variant}`;
  toastEl.textContent = message;
  toastEl.classList.remove("d-none");

  clearTimeout(toastEl._hideTimer);
  toastEl._hideTimer = setTimeout(() => {
    toastEl.classList.add("d-none");
  }, 4200);
}

async function bootstrap() {
  const mapContainer = document.getElementById("cultural-map");
  if (!mapContainer) return;

  const legendList = document.getElementById("region-legend-list");
  const legendToggleBtn = document.getElementById("legend-toggle-btn");
  const legendBody = document.getElementById("legend-body");
  const loadingOverlay = document.getElementById("map-loading-overlay");
  const loadingLabel = document.getElementById("map-loading-label");
  const zoomHintBtn = document.getElementById("zoom-municipios-btn");
  const resetViewBtn = document.getElementById("reset-brazil-btn");
  const zoomStatusBadge = document.getElementById("zoom-status-badge");
  const pinCounterEl = document.getElementById("pins-counter-value");
  const categoryFilterEl = document.getElementById("category-filter-select");
  const dbBannerEl = document.getElementById("db-status-banner");
  const toastEl = document.getElementById("map-toast");

  const navbarSearchForm = document.getElementById("navbar-search-form");
  const navbarSearchInput = document.getElementById("navbar-search-input");
  const searchResultsMenu = document.getElementById("navbar-search-results");

  renderRegionLegend(legendList);
  renderCategoryFilterSelect(categoryFilterEl);

  if (legendToggleBtn && legendBody) {
    legendToggleBtn.addEventListener("click", () => {
      const expanded = legendToggleBtn.getAttribute("aria-expanded") === "true";
      legendToggleBtn.setAttribute("aria-expanded", String(!expanded));
      legendBody.classList.toggle("d-none", expanded);
    });
  }

  const appConfig = readAppConfigFromDom();
  const currentUserId =
    typeof appConfig.currentUserId === "number" &&
    Number.isInteger(appConfig.currentUserId) &&
    appConfig.currentUserId > 0
      ? appConfig.currentUserId
      : null;
  const pinService = new PinApiService(appConfig);
  let currentPins = [];

  const updateZoomIndicators = (zoom) => {
    const municipiosActive = zoom >= MAP_CONFIG.MUNICIPIO_VISIBLE_ZOOM;
    if (zoomStatusBadge) {
      zoomStatusBadge.textContent = municipiosActive
        ? `Zoom ${zoom} · Municípios visíveis`
        : `Zoom ${zoom} · Aproxime (6+) para fronteiras municipais`;
    }
    if (zoomHintBtn) {
      zoomHintBtn.classList.toggle("d-none", municipiosActive);
    }
  };

  const mapController = new CulturalMapController({
    container: mapContainer,
    cartoApiKey: appConfig.cartoApiKey || '',
    currentUserId,
    onZoomChanged: updateZoomIndicators,
    onDeletePin: async (pin) => {
      await pinService.deletePin(pin.id);
      mapController.closePopup();
      showToast(
        toastEl,
        `Pin "${pin.titulo}" excluído com sucesso.`,
        "success",
      );
    },
    onMunicipioClick: ({ latlng, cidade, estado, regiao }) => {
      if (currentUserId === null) {
        showToast(toastEl, "Faça login ou cadastre-se para criar pins culturais.", "info");
        return;
      }

      const popupContent = buildCreatePinPopupElement({
        cidade,
        estado,
        regiao,
        latlng,
        onPublish: async (validatedPin) => {
          const created = await pinService.publishPin(validatedPin);
          mapController.closePopup();
          if (dbBannerEl) {
            dbBannerEl.classList.add("d-none");
          }
          showToast(
            toastEl,
            `Pin "${created.titulo}" publicado em ${created.cidade}/${created.estado}!`,
            "success",
          );
        },
      });

      mapController.openCreatePopup({
        latlng,
        contentElement: popupContent,
      });
    },
  });

  updateZoomIndicators(mapController.getZoom());

  if (zoomHintBtn) {
    zoomHintBtn.addEventListener("click", () =>
      mapController.zoomToMunicipios(),
    );
  }
  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", () =>
      mapController.resetBrazilView(),
    );
  }
  if (categoryFilterEl) {
    categoryFilterEl.addEventListener("change", () => {
      const visibleCount = mapController.setFilters({
        category: categoryFilterEl.value,
      });
      if (pinCounterEl) {
        pinCounterEl.textContent = String(visibleCount);
      }
    });
  }

  // Integração com a barra de pesquisa do cabeçalho (filtra pins + sugere municípios)
  const renderSearchDropdown = (term) => {
    if (!searchResultsMenu) return;
    const clean = term.trim();
    if (clean.length < 2) {
      searchResultsMenu.classList.add("d-none");
      searchResultsMenu.replaceChildren();
      return;
    }

    const lower = clean.toLowerCase();
    const matchingPins = currentPins
      .filter((p) =>
        `${p.titulo} ${p.cidade} ${p.estado} ${p.categoria}`
          .toLowerCase()
          .includes(lower),
      )
      .slice(0, 4);
    const matchingCities = mapController.searchCities(clean, 4);

    searchResultsMenu.replaceChildren();

    if (matchingPins.length === 0 && matchingCities.length === 0) {
      searchResultsMenu.appendChild(
        createSafeElement("div", {
          className: "search-dropdown__empty",
          text: "Nenhum pin ou município encontrado.",
        }),
      );
      searchResultsMenu.classList.remove("d-none");
      return;
    }

    if (matchingPins.length > 0) {
      searchResultsMenu.appendChild(
        createSafeElement("div", {
          className: "search-dropdown__section",
          text: "Pins Culturais",
        }),
      );
      for (const pin of matchingPins) {
        const btn = createSafeElement("button", {
          className: "search-dropdown__item",
          attrs: { type: "button" },
        });
        btn.appendChild(createSafeElement("strong", { text: pin.titulo }));
        btn.appendChild(
          createSafeElement("span", {
            text: `${pin.cidade} — ${pin.estado}`,
          }),
        );
        btn.addEventListener("click", () => {
          mapController.flyToPin(pin);
          searchResultsMenu.classList.add("d-none");
        });
        searchResultsMenu.appendChild(btn);
      }
    }

    if (matchingCities.length > 0) {
      searchResultsMenu.appendChild(
        createSafeElement("div", {
          className: "search-dropdown__section",
          text: "Ir para município",
        }),
      );
      for (const cityItem of matchingCities) {
        const props = cityItem.feature.properties ?? {};
        const btn = createSafeElement("button", {
          className: "search-dropdown__item",
          attrs: { type: "button" },
        });
        btn.appendChild(
          createSafeElement("strong", {
            text: `${props.cidade} — ${props.estado}`,
          }),
        );
        btn.appendChild(
          createSafeElement("span", { text: props.regiao || "Brasil" }),
        );
        btn.addEventListener("click", () => {
          mapController.flyToMunicipio(cityItem);
          searchResultsMenu.classList.add("d-none");
        });
        searchResultsMenu.appendChild(btn);
      }
    }

    searchResultsMenu.classList.remove("d-none");
  };

  if (navbarSearchInput) {
    navbarSearchInput.addEventListener("input", () => {
      const val = navbarSearchInput.value;
      const visibleCount = mapController.setFilters({ searchTerm: val });
      if (pinCounterEl) {
        pinCounterEl.textContent = String(visibleCount);
      }
      renderSearchDropdown(val);
    });

    document.addEventListener("click", (event) => {
      if (searchResultsMenu && !navbarSearchForm?.contains(event.target)) {
        searchResultsMenu.classList.add("d-none");
      }
    });
  }

  if (navbarSearchForm && navbarSearchInput) {
    navbarSearchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const val = navbarSearchInput.value.trim();
      const visibleCount = mapController.setFilters({ searchTerm: val });
      if (pinCounterEl) {
        pinCounterEl.textContent = String(visibleCount);
      }
      if (!val) {
        searchResultsMenu?.classList.add("d-none");
        return;
      }
      const firstPin = currentPins.find((p) =>
        `${p.titulo} ${p.cidade} ${p.estado}`
          .toLowerCase()
          .includes(val.toLowerCase()),
      );
      if (firstPin) {
        mapController.flyToPin(firstPin);
        searchResultsMenu?.classList.add("d-none");
        return;
      }
      const firstCity = mapController.searchCities(val, 1)[0];
      if (firstCity) {
        mapController.flyToMunicipio(firstCity);
        searchResultsMenu?.classList.add("d-none");
      }
    });
  }

  // 1) Carregamento das camadas geográficas do IBGE
  try {
    if (loadingLabel) {
      loadingLabel.textContent = "Carregando malhas geográficas do IBGE...";
    }
    const geographies = await loadBrazilGeographies();
    mapController.setGeographies(geographies);
  } catch (err) {
    showToast(
      toastEl,
      err?.message || "Erro ao carregar malhas territoriais do IBGE.",
      "error",
    );
  } finally {
    if (loadingOverlay) {
      loadingOverlay.classList.add("d-none");
    }
  }

  // 2) Carga inicial + sincronização contínua com o banco MySQL via PHP/PDO
  await pinService.startRealtimeSync(
    (pins) => {
      currentPins = pins;
      if (dbBannerEl) {
        dbBannerEl.classList.add("d-none");
      }
      const visibleCount = mapController.setPins(pins);
      if (pinCounterEl) {
        pinCounterEl.textContent = String(visibleCount);
      }
      if (
        searchResultsMenu &&
        !searchResultsMenu.classList.contains("d-none") &&
        navbarSearchInput
      ) {
        renderSearchDropdown(navbarSearchInput.value);
      }
    },
    (err) => {
      if (dbBannerEl) {
        dbBannerEl.classList.remove("d-none");
        dbBannerEl.textContent =
          err?.message ||
          "Erro ao conectar ao banco MySQL (exploradorcultural).";
      }
    },
  );
}

document.addEventListener("DOMContentLoaded", bootstrap);

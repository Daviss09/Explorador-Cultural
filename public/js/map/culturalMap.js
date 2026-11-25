import {
  BASEMAP_CONFIG,
  CATEGORY_BY_VALUE,
  LAYER_STYLES,
  MAP_CONFIG,
  VECTOR_PANES,
} from "../config/mapConstants.js";
import { buildPinDetailPopupElement } from "../components/popupTemplates.js";
import {
  buildMunicipioSpatialIndex,
  findMunicipioAtLatLng,
  normalizeForSearch,
  searchMunicipiosByName,
} from "../utils/geoLookup.js";

/**
 * Cria ícone customizado e acessível para os pins culturais sem depender de imagens externas.
 */
function createCulturalMarkerIcon(categoria) {
  const catMeta = CATEGORY_BY_VALUE[categoria];
  const color = catMeta?.color ?? "#2563eb";
  const iconClass = catMeta?.icon ?? "fa-landmark";

  return L.divIcon({
    className: "cultural-pin-icon-wrapper",
    html: `<div class="cultural-pin-marker" style="--pin-color: ${color};"><i class="fas ${iconClass}" aria-hidden="true"></i></div>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
    popupAnchor: [0, -32],
  });
}

/**
 * Controlador principal do mapa Leaflet com 3 camadas vetoriais em ordem estrita de z-index,
 * renderização em Canvas (`preferCanvas: true`) e gerenciamento de pins em tempo real.
 */
export class CulturalMapController {
  constructor({ container, onMunicipioClick, onZoomChanged, cartoApiKey }) {
    this.container = container;
    this.onMunicipioClick = onMunicipioClick;
    this.onZoomChanged = onZoomChanged;

    this.regioesLayer = null;
    this.estadosLayer = null;
    this.municipiosLayer = null;
    this.hoveredMunicipioLayer = null;
    this.municipiosVisible = false;
    this.spatialIndex = [];

    this.allPins = [];
    this.activeFilters = { category: "", searchTerm: "" };
    this.markersById = new Map();

    this._initMap(cartoApiKey || '');
  }

  _initMap(cartoApiKey) {
    this.map = L.map(this.container, {
      center: MAP_CONFIG.CENTER,
      zoom: MAP_CONFIG.INITIAL_ZOOM,
      minZoom: MAP_CONFIG.MIN_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM,
      preferCanvas: true,
      zoomControl: false,
      worldCopyJump: false,
    });

    L.control.zoom({ position: "topright" }).addTo(this.map);

    // Mapa base CARTO com API key quando disponível
    const tileUrl = cartoApiKey
      ? BASEMAP_CONFIG.TILE_URL + '?key=' + encodeURIComponent(cartoApiKey)
      : BASEMAP_CONFIG.TILE_URL;
    L.tileLayer(tileUrl, BASEMAP_CONFIG.OPTIONS).addTo(this.map);

    // Panes dedicados para garantir ordem estrita de empilhamento (z-index)
    const regioesPane = this.map.createPane(VECTOR_PANES.REGIOES.name);
    regioesPane.style.zIndex = String(VECTOR_PANES.REGIOES.zIndex);
    regioesPane.style.pointerEvents = "none";

    const estadosPane = this.map.createPane(VECTOR_PANES.ESTADOS.name);
    estadosPane.style.zIndex = String(VECTOR_PANES.ESTADOS.zIndex);
    estadosPane.style.pointerEvents = "none";

    const municipiosPane = this.map.createPane(VECTOR_PANES.MUNICIPIOS.name);
    municipiosPane.style.zIndex = String(VECTOR_PANES.MUNICIPIOS.zIndex);

    // Um renderer Canvas por pane garante que o z-index do DOM seja respeitado
    this.regioesRenderer = L.canvas({ pane: VECTOR_PANES.REGIOES.name });
    this.estadosRenderer = L.canvas({ pane: VECTOR_PANES.ESTADOS.name });
    this.municipiosRenderer = L.canvas({ pane: VECTOR_PANES.MUNICIPIOS.name });

    this.markersLayer = L.layerGroup().addTo(this.map);

    this.map.on("zoomend", () => {
      this._syncMunicipiosVisibility();
      if (typeof this.onZoomChanged === "function") {
        this.onZoomChanged(this.map.getZoom());
      }
    });

    // Permite clicar no mapa mesmo com zoom < 6: aproxima automaticamente e abre o município clicado
    this.map.on("click", (event) => {
      if (this.municipiosVisible || this.spatialIndex.length === 0) {
        return;
      }
      const match = findMunicipioAtLatLng(
        event.latlng.lat,
        event.latlng.lng,
        this.spatialIndex,
      );
      if (!match) {
        return;
      }

      const props = match.feature.properties ?? {};
      this.map.once("moveend", () => {
        if (typeof this.onMunicipioClick === "function") {
          this.onMunicipioClick({
            latlng: event.latlng,
            cidade: props.cidade,
            estado: props.estado,
            regiao: props.regiao,
            codarea: props.codarea,
          });
        }
      });
      this.map.setView(event.latlng, MAP_CONFIG.AUTO_FOCUS_ZOOM, {
        animate: true,
      });
    });
  }

  /**
   * Carrega as 3 camadas vetoriais do IBGE respeitando a ordem exata de empilhamento.
   */
  setGeographies({ regioesGeoJson, estadosGeoJson, municipiosGeoJson }) {
    // Camada 1 — Regiões do Brasil (Fundo, fillOpacity: 0.6, sem bordas)
    if (this.regioesLayer) {
      this.map.removeLayer(this.regioesLayer);
    }
    this.regioesLayer = L.geoJSON(regioesGeoJson, {
      pane: VECTOR_PANES.REGIOES.name,
      renderer: this.regioesRenderer,
      interactive: false,
      style: (feature) => LAYER_STYLES.REGIAO(feature?.properties?.codarea),
    }).addTo(this.map);

    // Camada 2 — Estados (Contorno médio #333333, weight: 2, sem preenchimento)
    if (this.estadosLayer) {
      this.map.removeLayer(this.estadosLayer);
    }
    this.estadosLayer = L.geoJSON(estadosGeoJson, {
      pane: VECTOR_PANES.ESTADOS.name,
      renderer: this.estadosRenderer,
      interactive: false,
      style: () => LAYER_STYLES.ESTADO,
    }).addTo(this.map);

    // Camada 3 — Municípios (Contorno fino #666666, weight: 0.5, exibida a partir do zoom 6)
    if (this.municipiosLayer) {
      this.map.removeLayer(this.municipiosLayer);
    }
    this.municipiosLayer = L.geoJSON(municipiosGeoJson, {
      pane: VECTOR_PANES.MUNICIPIOS.name,
      renderer: this.municipiosRenderer,
      interactive: true,
      style: () => LAYER_STYLES.MUNICIPIO_DEFAULT,
      onEachFeature: (feature, layer) => {
        const props = feature.properties ?? {};
        const cityText = props.estado
          ? `${props.cidade} — ${props.estado}`
          : props.cidade;

        // Tooltip seguro (Leaflet escapa string ou usa nó DOM com textContent)
        layer.bindTooltip(
          () => {
            const span = document.createElement("span");
            span.textContent = cityText;
            return span;
          },
          {
            sticky: true,
            direction: "top",
            className: "cultural-city-tooltip",
          },
        );

        layer.on({
          mouseover: (e) => {
            if (
              this.hoveredMunicipioLayer &&
              this.hoveredMunicipioLayer !== e.target
            ) {
              this.municipiosLayer.resetStyle(this.hoveredMunicipioLayer);
            }
            this.hoveredMunicipioLayer = e.target;
            e.target.setStyle(LAYER_STYLES.MUNICIPIO_HOVER);
          },
          mouseout: (e) => {
            this.municipiosLayer.resetStyle(e.target);
            if (this.hoveredMunicipioLayer === e.target) {
              this.hoveredMunicipioLayer = null;
            }
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            if (typeof this.onMunicipioClick === "function") {
              this.onMunicipioClick({
                latlng: e.latlng,
                cidade: props.cidade,
                estado: props.estado,
                regiao: props.regiao,
                codarea: props.codarea,
              });
            }
          },
        });
      },
    });

    this.spatialIndex = buildMunicipioSpatialIndex(municipiosGeoJson);
    this._syncMunicipiosVisibility();
  }

  _syncMunicipiosVisibility() {
    if (!this.municipiosLayer) {
      return;
    }
    const shouldShow = this.map.getZoom() >= MAP_CONFIG.MUNICIPIO_VISIBLE_ZOOM;

    if (shouldShow && !this.municipiosVisible) {
      this.municipiosLayer.addTo(this.map);
      this.municipiosVisible = true;
    } else if (!shouldShow && this.municipiosVisible) {
      if (this.hoveredMunicipioLayer) {
        this.municipiosLayer.resetStyle(this.hoveredMunicipioLayer);
        this.hoveredMunicipioLayer = null;
      }
      this.map.removeLayer(this.municipiosLayer);
      this.municipiosVisible = false;
    }
  }

  getZoom() {
    return this.map.getZoom();
  }

  zoomToMunicipios() {
    const targetZoom = Math.max(
      this.map.getZoom(),
      MAP_CONFIG.MUNICIPIO_VISIBLE_ZOOM,
    );
    this.map.setZoom(targetZoom, { animate: true });
  }

  resetBrazilView() {
    this.map.setView(MAP_CONFIG.CENTER, MAP_CONFIG.INITIAL_ZOOM, {
      animate: true,
    });
  }

  openCreatePopup({ latlng, contentElement }) {
    L.popup({
      maxWidth: 340,
      minWidth: 290,
      className: "cultural-leaflet-popup",
      autoPanPadding: [24, 72],
    })
      .setLatLng(latlng)
      .setContent(contentElement)
      .openOn(this.map);
  }

  closePopup() {
    this.map.closePopup();
  }

  /**
   * Atualiza todos os pins culturais recebidos em tempo real e aplica os filtros ativos.
   */
  setPins(pins) {
    this.allPins = Array.isArray(pins) ? pins : [];
    this._renderFilteredPins();
    return this.getVisiblePinCount();
  }

  setFilters({ category, searchTerm }) {
    if (category !== undefined) {
      this.activeFilters.category = category;
    }
    if (searchTerm !== undefined) {
      this.activeFilters.searchTerm = searchTerm;
    }
    this._renderFilteredPins();
    return this.getVisiblePinCount();
  }

  getVisiblePinCount() {
    return this.markersById.size;
  }

  _matchesFilter(pin) {
    const { category, searchTerm } = this.activeFilters;
    if (category && pin.categoria !== category) {
      return false;
    }
    if (searchTerm) {
      const needle = normalizeForSearch(searchTerm);
      const haystack = normalizeForSearch(
        `${pin.titulo} ${pin.descricao} ${pin.categoria} ${pin.cidade} ${pin.estado}`,
      );
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    return true;
  }

  _renderFilteredPins() {
    const filtered = this.allPins.filter(
      (pin) =>
        Number.isFinite(pin.latitude) &&
        Number.isFinite(pin.longitude) &&
        this._matchesFilter(pin),
    );

    const nextIds = new Set(filtered.map((p) => p.id));

    // Remove marcadores que saíram do filtro ou foram excluídos
    for (const [id, marker] of this.markersById.entries()) {
      if (!nextIds.has(id)) {
        this.markersLayer.removeLayer(marker);
        this.markersById.delete(id);
      }
    }

    // Adiciona ou atualiza marcadores preservando popups abertos sempre que possível
    for (const pin of filtered) {
      const existing = this.markersById.get(pin.id);
      if (existing) {
        existing.pinData = pin;
        if (existing.isPopupOpen()) {
          existing.setPopupContent(buildPinDetailPopupElement(pin));
        }
        continue;
      }

      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: createCulturalMarkerIcon(pin.categoria),
        title: `${pin.titulo} — ${pin.cidade}/${pin.estado}`,
        alt: `${pin.titulo} em ${pin.cidade}`,
      });

      marker.pinData = pin;
      marker.bindPopup(() => buildPinDetailPopupElement(marker.pinData), {
        maxWidth: 340,
        minWidth: 270,
        className: "cultural-leaflet-popup",
      });

      marker.addTo(this.markersLayer);
      this.markersById.set(pin.id, marker);
    }
  }

  flyToPin(pin) {
    if (
      !pin ||
      !Number.isFinite(pin.latitude) ||
      !Number.isFinite(pin.longitude)
    ) {
      return;
    }
    const marker = this.markersById.get(pin.id);
    const targetZoom = Math.max(this.map.getZoom(), 8);
    this.map.once("moveend", () => {
      if (marker) {
        marker.openPopup();
      }
    });
    this.map.setView([pin.latitude, pin.longitude], targetZoom, {
      animate: true,
    });
  }

  searchCities(query, limit = 5) {
    return searchMunicipiosByName(query, this.spatialIndex, limit);
  }

  flyToMunicipio(indexedMunicipio) {
    if (!indexedMunicipio) {
      return;
    }
    const latlng = L.latLng(
      indexedMunicipio.centerLat,
      indexedMunicipio.centerLng,
    );
    const props = indexedMunicipio.feature?.properties ?? {};
    this.map.once("moveend", () => {
      if (typeof this.onMunicipioClick === "function") {
        this.onMunicipioClick({
          latlng,
          cidade: props.cidade,
          estado: props.estado,
          regiao: props.regiao,
          codarea: props.codarea,
        });
      }
    });
    this.map.setView(latlng, Math.max(this.map.getZoom(), 8), {
      animate: true,
    });
  }
}

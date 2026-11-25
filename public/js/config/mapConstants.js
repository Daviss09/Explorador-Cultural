/**
 * Constantes geográficas, visuais e de endpoints do Mapa Cultural do Brasil.
 */

export const MAP_CONFIG = Object.freeze({
  CENTER: [-14.235, -51.925],
  INITIAL_ZOOM: 4,
  MIN_ZOOM: 3,
  MAX_ZOOM: 18,
  MUNICIPIO_VISIBLE_ZOOM: 6,
  AUTO_FOCUS_ZOOM: 7,
  BRAZIL_BOUNDS: {
    minLat: -35.0,
    maxLat: 6.0,
    minLng: -75.0,
    maxLng: -28.0,
  },
});

export const BASEMAP_CONFIG = Object.freeze({
  TILE_URL:
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
  OPTIONS: {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a> | Malhas: IBGE',
    subdomains: "abcd",
    maxZoom: 20,
  },
});

/**
 * URLs reais da API v3 de Malhas Geográficas e API v1 de Localidades do IBGE.
 * As malhas utilizam TopoJSON com qualidade mínima para carregamento rápido no navegador.
 */
export const IBGE_ENDPOINTS = Object.freeze({
  REGIOES_TOPOJSON:
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=regiao&formato=application/json&qualidade=minima",
  ESTADOS_TOPOJSON:
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/json&qualidade=minima",
  MUNICIPIOS_TOPOJSON:
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=municipio&formato=application/json&qualidade=minima",
  LOCALIDADES_MUNICIPIOS:
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado",
});

/**
 * Paleta oficial por código IBGE da macrorregião (Camada 1).
 * Ordem de exibição na legenda: Norte, Nordeste, Centro-Oeste, Sudeste, Sul.
 */
export const BRAZIL_REGIONS = Object.freeze([
  { code: "1", sigla: "N", nome: "Norte", color: "#a8e6cf" },
  { code: "2", sigla: "NE", nome: "Nordeste", color: "#ffd3b6" },
  { code: "5", sigla: "CO", nome: "Centro-Oeste", color: "#ffaaa5" },
  { code: "3", sigla: "SE", nome: "Sudeste", color: "#dcedc1" },
  { code: "4", sigla: "S", nome: "Sul", color: "#a8d8ea" },
]);

export const REGION_COLOR_BY_CODE = Object.freeze(
  Object.fromEntries(
    BRAZIL_REGIONS.map((region) => [region.code, region.color]),
  ),
);

/**
 * Ordem explícita de empilhamento (z-index) das camadas vetoriais no Leaflet.
 */
export const VECTOR_PANES = Object.freeze({
  REGIOES: { name: "regioesPane", zIndex: 410 },
  ESTADOS: { name: "estadosPane", zIndex: 420 },
  MUNICIPIOS: { name: "municipiosPane", zIndex: 430 },
});

export const LAYER_STYLES = Object.freeze({
  REGIAO: (codarea) => ({
    stroke: false,
    fill: true,
    fillColor: REGION_COLOR_BY_CODE[String(codarea)] ?? "#e2e8f0",
    fillOpacity: 0.6,
  }),
  ESTADO: {
    stroke: true,
    color: "#333333",
    weight: 2,
    opacity: 1,
    fill: false,
    fillOpacity: 0,
  },
  MUNICIPIO_DEFAULT: {
    stroke: true,
    color: "#666666",
    weight: 0.5,
    opacity: 0.9,
    // fill: true com fillOpacity: 0 mantém o interior transparente e clicável no Canvas
    fill: true,
    fillColor: "#1e293b",
    fillOpacity: 0,
  },
  MUNICIPIO_HOVER: {
    stroke: true,
    color: "#1d4ed8",
    weight: 1.6,
    opacity: 1,
    fill: true,
    fillColor: "#2563eb",
    fillOpacity: 0.14,
  },
});

export const PIN_LIMITS = Object.freeze({
  MAX_TITULO: 80,
  MAX_DESCRICAO: 1000,
  MAX_CATEGORIA: 60,
  MAX_CIDADE: 120,
});

export const CULTURAL_CATEGORIES = Object.freeze([
  {
    value: "Música/Dança",
    label: "Música/Dança",
    color: "#7c3aed",
    icon: "fa-music",
  },
  {
    value: "Culinária",
    label: "Culinária",
    color: "#ea580c",
    icon: "fa-utensils",
  },
  {
    value: "Festas Populares",
    label: "Festas Populares",
    color: "#db2777",
    icon: "fa-masks-theater",
  },
  {
    value: "Artesanato",
    label: "Artesanato",
    color: "#0d9488",
    icon: "fa-hands",
  },
  {
    value: "Folclore e Lendas",
    label: "Folclore e Lendas",
    color: "#0284c7",
    icon: "fa-book-open",
  },
  {
    value: "Patrimônio e Arquitetura",
    label: "Patrimônio e Arquitetura",
    color: "#b45309",
    icon: "fa-landmark",
  },
  { value: "Outros", label: "Outros", color: "#475569", icon: "fa-star" },
]);

export const CATEGORY_BY_VALUE = Object.freeze(
  Object.fromEntries(CULTURAL_CATEGORIES.map((cat) => [cat.value, cat])),
);

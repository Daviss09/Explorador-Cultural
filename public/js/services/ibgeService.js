import { IBGE_ENDPOINTS } from '../config/mapConstants.js';

/**
 * Converte um payload TopoJSON retornado pela API v3 de Malhas do IBGE em GeoJSON FeatureCollection.
 */
function convertTopologyToGeoJson(topology) {
    if (typeof window.topojson === 'undefined' || typeof window.topojson.feature !== 'function') {
        throw new Error('Biblioteca topojson-client não foi carregada.');
    }

    if (!topology || topology.type !== 'Topology' || !topology.objects) {
        throw new Error('Resposta TopoJSON inválida recebida do IBGE.');
    }

    const objectKeys = Object.keys(topology.objects);
    if (objectKeys.length === 0) {
        throw new Error('Objeto geográfico ausente no TopoJSON do IBGE.');
    }

    return window.topojson.feature(topology, topology.objects[objectKeys[0]]);
}

async function fetchJson(url, label) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`Falha ao carregar ${label} do IBGE (HTTP ${response.status}).`);
    }
    return response.json();
}

/**
 * Carrega em paralelo as malhas TopoJSON (Regiões, Estados, Municípios) e os nomes oficiais
 * dos 5.570+ municípios brasileiros na API do IBGE.
 */
export async function loadBrazilGeographies() {
    const [regioesTopo, estadosTopo, municipiosTopo, localidades] = await Promise.all([
        fetchJson(IBGE_ENDPOINTS.REGIOES_TOPOJSON, 'malha das regiões'),
        fetchJson(IBGE_ENDPOINTS.ESTADOS_TOPOJSON, 'malha dos estados'),
        fetchJson(IBGE_ENDPOINTS.MUNICIPIOS_TOPOJSON, 'malha dos municípios'),
        fetchJson(IBGE_ENDPOINTS.LOCALIDADES_MUNICIPIOS, 'lista de municípios'),
    ]);

    const regioesGeoJson = convertTopologyToGeoJson(regioesTopo);
    const estadosGeoJson = convertTopologyToGeoJson(estadosTopo);
    const municipiosGeoJson = convertTopologyToGeoJson(municipiosTopo);

    // Mapeia código IBGE (7 dígitos) -> metadados legíveis de cidade, UF e região
    const municipioLookup = new Map();
    if (Array.isArray(localidades)) {
        for (const loc of localidades) {
            const id = String(loc['municipio-id'] ?? '').trim();
            if (!id) continue;
            municipioLookup.set(id, {
                cidade: String(loc['municipio-nome'] ?? 'Município'),
                estado: String(loc['UF-sigla'] ?? ''),
                ufNome: String(loc['UF-nome'] ?? ''),
                regiao: String(loc['regiao-nome'] ?? ''),
            });
        }
    }

    // Enriquece cada feature municipal (que na API de Malhas traz apenas `codarea`)
    for (const feature of municipiosGeoJson.features) {
        const codarea = String(feature.properties?.codarea ?? '').trim();
        const info = municipioLookup.get(codarea);
        feature.properties = {
            codarea,
            cidade: info?.cidade ?? `Município ${codarea}`,
            estado: info?.estado ?? '',
            ufNome: info?.ufNome ?? '',
            regiao: info?.regiao ?? '',
        };
    }

    return {
        regioesGeoJson,
        estadosGeoJson,
        municipiosGeoJson,
    };
}

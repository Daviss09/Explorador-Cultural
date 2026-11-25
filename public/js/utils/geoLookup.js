/**
 * Utilitários espaciais leves para lookup ponto-em-polígono e busca textual de municípios.
 */

function computeRingBounds(ring, bounds) {
    for (let i = 0; i < ring.length; i += 1) {
        const [lng, lat] = ring[i];
        if (lng < bounds.minLng) bounds.minLng = lng;
        if (lng > bounds.maxLng) bounds.maxLng = lng;
        if (lat < bounds.minLat) bounds.minLat = lat;
        if (lat > bounds.maxLat) bounds.maxLat = lat;
    }
}

function computeFeatureBounds(geometry) {
    const bounds = {
        minLng: Infinity,
        minLat: Infinity,
        maxLng: -Infinity,
        maxLat: -Infinity,
    };

    if (!geometry || !geometry.coordinates) {
        return bounds;
    }

    if (geometry.type === 'Polygon') {
        for (const ring of geometry.coordinates) {
            computeRingBounds(ring, bounds);
        }
    } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
            for (const ring of polygon) {
                computeRingBounds(ring, bounds);
            }
        }
    }

    return bounds;
}

/**
 * Ray-casting clássico em um anel [lng, lat].
 */
function isPointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        const intersect =
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;

        if (intersect) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Verifica se o ponto pertence a um Polygon respeitando anel externo e eventuais buracos.
 */
function isPointInPolygonRings(lng, lat, rings) {
    if (!rings.length || !isPointInRing(lng, lat, rings[0])) {
        return false;
    }
    for (let i = 1; i < rings.length; i += 1) {
        if (isPointInRing(lng, lat, rings[i])) {
            return false;
        }
    }
    return true;
}

function isPointInGeometry(lng, lat, geometry) {
    if (!geometry) {
        return false;
    }
    if (geometry.type === 'Polygon') {
        return isPointInPolygonRings(lng, lat, geometry.coordinates);
    }
    if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
            if (isPointInPolygonRings(lng, lat, polygon)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Normaliza texto para busca sem acentuação e case-insensitive.
 */
export function normalizeForSearch(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Pré-indexa todos os municípios com bounding box e centro aproximado para busca O(1) de bbox.
 */
export function buildMunicipioSpatialIndex(municipiosGeoJson) {
    const features = municipiosGeoJson?.features ?? [];
    return features.map((feature) => {
        const bounds = computeFeatureBounds(feature.geometry);
        const props = feature.properties ?? {};
        const cidade = props.cidade ?? '';
        const estado = props.estado ?? '';
        return {
            feature,
            bounds,
            centerLat: (bounds.minLat + bounds.maxLat) / 2,
            centerLng: (bounds.minLng + bounds.maxLng) / 2,
            searchKey: normalizeForSearch(`${cidade} ${estado}`),
        };
    });
}

/**
 * Encontra qual município contém a coordenada (lat, lng).
 */
export function findMunicipioAtLatLng(lat, lng, indexedMunicipios) {
    for (let i = 0; i < indexedMunicipios.length; i += 1) {
        const item = indexedMunicipios[i];
        const b = item.bounds;
        if (lng < b.minLng || lng > b.maxLng || lat < b.minLat || lat > b.maxLat) {
            continue;
        }
        if (isPointInGeometry(lng, lat, item.feature.geometry)) {
            return item;
        }
    }
    return null;
}

/**
 * Busca municípios por nome ou "Cidade - UF".
 */
export function searchMunicipiosByName(query, indexedMunicipios, limit = 6) {
    const normalized = normalizeForSearch(query);
    if (normalized.length < 2) {
        return [];
    }

    const prefixMatches = [];
    const partialMatches = [];

    for (let i = 0; i < indexedMunicipios.length; i += 1) {
        const item = indexedMunicipios[i];
        if (!item.searchKey) {
            continue;
        }
        if (item.searchKey.startsWith(normalized)) {
            prefixMatches.push(item);
        } else if (item.searchKey.includes(normalized)) {
            partialMatches.push(item);
        }
        if (prefixMatches.length >= limit) {
            break;
        }
    }

    return [...prefixMatches, ...partialMatches].slice(0, limit);
}

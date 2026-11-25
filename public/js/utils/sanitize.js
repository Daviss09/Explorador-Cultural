import {
    CULTURAL_CATEGORIES,
    MAP_CONFIG,
    PIN_LIMITS,
} from '../config/mapConstants.js?v=2';

const ALLOWED_CATEGORY_SET = new Set([
    '',
    ...CULTURAL_CATEGORIES.map((category) => category.value),
]);

const CONTROL_CHARS_SINGLE_LINE = /[\u0000-\u001F\u007F]/g;
const CONTROL_CHARS_MULTILINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Escapa caracteres HTML especiais para uso seguro caso algum texto seja serializado.
 * Preferir sempre `textContent` ao montar nós DOM.
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Normaliza texto de linha única removendo caracteres de controle e espaços extras nas bordas.
 */
export function sanitizeSingleLine(value) {
    return String(value ?? '')
        .replace(CONTROL_CHARS_SINGLE_LINE, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normaliza texto multilinha preservando quebras de linha válidas e removendo bytes de controle.
 */
export function sanitizeMultiline(value) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(CONTROL_CHARS_MULTILINE, '')
        .trim();
}

/**
 * Conta codepoints Unicode (alinhado ao `.size()` de strings nas Regras do Firestore).
 */
export function countCodepoints(value) {
    return Array.from(String(value ?? '')).length;
}

/**
 * Verifica se um par latitude/longitude é finito e está dentro da caixa envolvente do Brasil.
 */
export function isValidCoordinateInBrazil(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return false;
    }
    const { minLat, maxLat, minLng, maxLng } = MAP_CONFIG.BRAZIL_BOUNDS;
    return (
        latitude >= minLat &&
        latitude <= maxLat &&
        longitude >= minLng &&
        longitude <= maxLng
    );
}

/**
 * Valida e higieniza os dados de um pin cultural antes do envio ao banco ou renderização.
 */
export function validateCulturalPinPayload(raw) {
    const errors = [];

    const titulo = sanitizeSingleLine(raw?.titulo);
    const descricao = sanitizeMultiline(raw?.descricao);
    const categoriaRaw = sanitizeSingleLine(raw?.categoria);
    const categoria = ALLOWED_CATEGORY_SET.has(categoriaRaw) ? categoriaRaw : '';
    const cidade = sanitizeSingleLine(raw?.cidade);
    const estado = sanitizeSingleLine(raw?.estado).toUpperCase();
    const latitude = Number(raw?.latitude);
    const longitude = Number(raw?.longitude);

    const tituloLen = countCodepoints(titulo);
    if (tituloLen === 0) {
        errors.push('Informe o título da manifestação cultural.');
    } else if (tituloLen > PIN_LIMITS.MAX_TITULO) {
        errors.push(`O título deve ter no máximo ${PIN_LIMITS.MAX_TITULO} caracteres.`);
    }

    const descricaoLen = countCodepoints(descricao);
    if (descricaoLen === 0) {
        errors.push('Informe a descrição da cultura ou tradição.');
    } else if (descricaoLen > PIN_LIMITS.MAX_DESCRICAO) {
        errors.push(`A descrição deve ter no máximo ${PIN_LIMITS.MAX_DESCRICAO} caracteres.`);
    }

    if (categoriaRaw !== '' && !ALLOWED_CATEGORY_SET.has(categoriaRaw)) {
        errors.push('Categoria selecionada inválida.');
    }

    if (countCodepoints(cidade) === 0 || countCodepoints(cidade) > PIN_LIMITS.MAX_CIDADE) {
        errors.push('Município inválido para o ponto selecionado.');
    }

    if (countCodepoints(estado) !== 2) {
        errors.push('UF inválida para o ponto selecionado.');
    }

    if (!isValidCoordinateInBrazil(latitude, longitude)) {
        errors.push('Coordenadas fora da área territorial do Brasil.');
    }

    return {
        valid: errors.length === 0,
        errors,
        data: {
            titulo,
            descricao,
            categoria,
            cidade,
            estado,
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
        },
    };
}

/**
 * Formata Timestamp do Firestore, Date ou ISO string para pt-BR.
 */
export function formatDatePtBr(value) {
    if (!value) {
        return 'Agora mesmo';
    }

    let date = null;
    if (typeof value?.toDate === 'function') {
        date = value.toDate();
    } else if (typeof value?.seconds === 'number') {
        date = new Date(value.seconds * 1000);
    } else if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
        date = new Date(value);
    }

    if (!date || Number.isNaN(date.getTime())) {
        return 'Agora mesmo';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}

/**
 * Cria um elemento DOM garantindo inserção segura de texto via `textContent`.
 */
export function createSafeElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    if (options.className) {
        element.className = options.className;
    }
    if (options.text !== undefined && options.text !== null) {
        element.textContent = String(options.text);
    }
    if (options.attrs) {
        for (const [key, val] of Object.entries(options.attrs)) {
            if (val !== undefined && val !== null) {
                element.setAttribute(key, String(val));
            }
        }
    }
    return element;
}

/**
 * Valida uma foto opcional selecionada pelo usuário antes do envio ao servidor.
 */
export function validateCulturalPinImage(file) {
    if (!file) {
        return { valid: true, error: null };
    }

    if (typeof File !== 'undefined' && !(file instanceof File)) {
        return { valid: false, error: 'Arquivo de imagem inválido.' };
    }

    const mime = String(file.type || '').toLowerCase();
    const ext = String(file.name || '').split('.').pop()?.toLowerCase() ?? '';
    const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
    const mimeOk = PIN_LIMITS.ALLOWED_IMAGE_TYPES.includes(mime);
    const extOk = mime === '' && allowedExt.has(ext);

    if (!mimeOk && !extOk) {
        return {
            valid: false,
            error: 'Formato de imagem inválido. Selecione JPG, PNG, WebP ou GIF.',
        };
    }

    if (file.size <= 0 || file.size > PIN_LIMITS.MAX_IMAGE_BYTES) {
        return {
            valid: false,
            error: 'A foto deve ter no máximo 5 MB.',
        };
    }

    return { valid: true, error: null };
}

/**
 * Garante que uma URL de mídia seja relativa segura ou HTTP(S).
 */
export function isSafeMediaUrl(value) {
    if (typeof value !== 'string') {
        return false;
    }
    const trimmed = value.trim();
    return (
        trimmed.startsWith('/') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://')
    );
}

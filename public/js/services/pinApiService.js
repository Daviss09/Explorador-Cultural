import { validateCulturalPinPayload } from '../utils/sanitize.js';

const SYNC_INTERVAL_MS = 4000;

/**
 * Serviço de comunicação em tempo real com a API PHP/PDO (MySQL `exploradorcultural`).
 * Realiza carga inicial completa e sincronização delta incremental por `afterId`
 * enquanto a aba está visível para exibir novos pins publicados por outros visitantes.
 */
export class PinApiService {
    constructor({ pinsEndpoint, csrfToken }) {
        this.pinsEndpoint = pinsEndpoint || '/pins';
        this.csrfToken = csrfToken || '';
        this.pinsById = new Map();
        this.maxId = 0;
        this.pollTimer = null;
        this.visibilityHandler = null;
        this.onUpdateCallback = null;
        this.onErrorCallback = null;
        this.syncInFlight = false;
    }

    isConfigured() {
        return Boolean(this.pinsEndpoint);
    }

    _getOrderedPins() {
        return Array.from(this.pinsById.values()).sort((a, b) => Number(b.id) - Number(a.id));
    }

    _mergePins(incomingPins) {
        let changed = false;
        for (const raw of incomingPins) {
            const id = Number(raw?.id);
            if (!Number.isFinite(id) || id <= 0) {
                continue;
            }
            if (id > this.maxId) {
                this.maxId = id;
            }
            if (!this.pinsById.has(id)) {
                changed = true;
            }
            this.pinsById.set(id, {
                id: String(id),
                numericId: id,
                titulo: String(raw?.titulo ?? ''),
                descricao: String(raw?.descricao ?? ''),
                categoria: String(raw?.categoria ?? ''),
                cidade: String(raw?.cidade ?? ''),
                estado: String(raw?.estado ?? ''),
                latitude: Number(raw?.latitude),
                longitude: Number(raw?.longitude),
                criadoEm: raw?.criadoEm ?? null,
            });
        }
        return changed;
    }

    async _fetchPins(afterId = 0) {
        const separator = this.pinsEndpoint.includes('?') ? '&' : '?';
        const url = afterId > 0 ? `${this.pinsEndpoint}${separator}afterId=${afterId}` : this.pinsEndpoint;

        const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok || !payload?.ok) {
            throw new Error(
                payload?.error || `Falha ao carregar pins do servidor (HTTP ${response.status}).`
            );
        }

        return Array.isArray(payload.pins) ? payload.pins : [];
    }

    async _pollDelta() {
        if (this.syncInFlight || document.visibilityState === 'hidden') {
            return;
        }
        this.syncInFlight = true;
        try {
            const delta = await this._fetchPins(this.maxId);
            if (delta.length > 0 && this._mergePins(delta) && typeof this.onUpdateCallback === 'function') {
                this.onUpdateCallback(this._getOrderedPins());
            }
        } catch {
            // Falhas pontuais de rede durante polling silencioso são ignoradas até a próxima tentativa
        } finally {
            this.syncInFlight = false;
        }
    }

    /**
     * Carrega todos os pins do MySQL e inicia sincronização contínua em segundo plano.
     */
    async startRealtimeSync(onData, onError) {
        this.onUpdateCallback = onData;
        this.onErrorCallback = onError;

        try {
            const initialPins = await this._fetchPins(0);
            this._mergePins(initialPins);
            onData(this._getOrderedPins());
        } catch (err) {
            if (typeof onError === 'function') {
                onError(err);
            }
        }

        this.stopRealtimeSync();

        this.pollTimer = window.setInterval(() => {
            this._pollDelta();
        }, SYNC_INTERVAL_MS);

        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                this._pollDelta();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    stopRealtimeSync() {
        if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
    }

    /**
     * Valida no cliente, envia via POST com token CSRF e atualiza o mapa imediatamente.
     */
    async publishPin(rawInput) {
        const validation = validateCulturalPinPayload(rawInput);
        if (!validation.valid) {
            throw new Error(validation.errors[0]);
        }

        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        const csrfToken = csrfMeta?.getAttribute('content') || this.csrfToken;

        const response = await fetch(this.pinsEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            credentials: 'same-origin',
            body: JSON.stringify(validation.data),
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok || !payload?.ok || !payload?.pin) {
            throw new Error(
                payload?.error || `Erro ao salvar pin no banco de dados (HTTP ${response.status}).`
            );
        }

        this._mergePins([payload.pin]);
        if (typeof this.onUpdateCallback === 'function') {
            this.onUpdateCallback(this._getOrderedPins());
        }

        return payload.pin;
    }
}

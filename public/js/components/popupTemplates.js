import {
    CATEGORY_BY_VALUE,
    CULTURAL_CATEGORIES,
    PIN_LIMITS,
} from '../config/mapConstants.js?v=2';
import {
    countCodepoints,
    createSafeElement,
    formatDatePtBr,
    isSafeMediaUrl,
    validateCulturalPinImage,
    validateCulturalPinPayload,
} from '../utils/sanitize.js?v=2';

/**
 * Constrói o formulário interativo de criação de Pin Cultural utilizando exclusivamente nós DOM
 * e `textContent` para prevenção absoluta contra XSS.
 */
export function buildCreatePinPopupElement({
    cidade,
    estado,
    regiao,
    latlng,
    onPublish,
}) {
    const container = createSafeElement('div', { className: 'cultural-popup cultural-popup--form' });

    // Cabeçalho geográfico automático (Cidade / UF)
    const header = createSafeElement('div', { className: 'cultural-popup__header' });
    const locationBadge = createSafeElement('div', { className: 'cultural-popup__location' });
    const pinIcon = createSafeElement('i', { className: 'fas fa-map-marker-alt me-1' });
    locationBadge.appendChild(pinIcon);
    const cityLabel = estado ? `${cidade} — ${estado}` : cidade;
    locationBadge.appendChild(document.createTextNode(cityLabel));
    header.appendChild(locationBadge);

    if (regiao) {
        const regionBadge = createSafeElement('span', {
            className: 'cultural-popup__region-tag',
            text: regiao,
        });
        header.appendChild(regionBadge);
    }

    const subtitle = createSafeElement('p', {
        className: 'cultural-popup__subtitle',
        text: 'Registrar manifestação cultural neste local',
    });
    header.appendChild(subtitle);
    container.appendChild(header);

    const form = createSafeElement('form', {
        className: 'cultural-popup__form',
        attrs: { novalidate: 'novalidate' },
    });

    // Campo 1: Título (obrigatório, máx. 80 caracteres)
    const titleGroup = createSafeElement('div', { className: 'cultural-popup__field' });
    const titleLabelRow = createSafeElement('div', { className: 'cultural-popup__label-row' });
    const titleLabel = createSafeElement('label', {
        text: 'Título da manifestação cultural *',
        attrs: { for: 'pin-titulo-input' },
    });
    const titleCounter = createSafeElement('span', {
        className: 'cultural-popup__counter',
        text: `0/${PIN_LIMITS.MAX_TITULO}`,
    });
    titleLabelRow.appendChild(titleLabel);
    titleLabelRow.appendChild(titleCounter);

    const titleInput = createSafeElement('input', {
        className: 'cultural-popup__input',
        attrs: {
            id: 'pin-titulo-input',
            name: 'titulo',
            type: 'text',
            maxlength: String(PIN_LIMITS.MAX_TITULO),
            required: 'required',
            placeholder: 'Ex: Frevo de Olinda, Círio de Nazaré...',
            autocomplete: 'off',
        },
    });
    titleGroup.appendChild(titleLabelRow);
    titleGroup.appendChild(titleInput);
    form.appendChild(titleGroup);

    // Campo 2: Categoria (opcional)
    const catGroup = createSafeElement('div', { className: 'cultural-popup__field' });
    const catLabel = createSafeElement('label', {
        text: 'Categoria (opcional)',
        attrs: { for: 'pin-categoria-select' },
    });
    const catSelect = createSafeElement('select', {
        className: 'cultural-popup__select',
        attrs: { id: 'pin-categoria-select', name: 'categoria' },
    });
    catSelect.appendChild(
        createSafeElement('option', {
            text: 'Selecione uma categoria...',
            attrs: { value: '' },
        })
    );
    for (const cat of CULTURAL_CATEGORIES) {
        catSelect.appendChild(
            createSafeElement('option', {
                text: cat.label,
                attrs: { value: cat.value },
            })
        );
    }
    catGroup.appendChild(catLabel);
    catGroup.appendChild(catSelect);
    form.appendChild(catGroup);

    // Campo 3: Descrição (obrigatória, máx. 1000 caracteres)
    const descGroup = createSafeElement('div', { className: 'cultural-popup__field' });
    const descLabelRow = createSafeElement('div', { className: 'cultural-popup__label-row' });
    const descLabel = createSafeElement('label', {
        text: 'Descrição da cultura / tradição *',
        attrs: { for: 'pin-descricao-input' },
    });
    const descCounter = createSafeElement('span', {
        className: 'cultural-popup__counter',
        text: `0/${PIN_LIMITS.MAX_DESCRICAO}`,
    });
    descLabelRow.appendChild(descLabel);
    descLabelRow.appendChild(descCounter);

    const descTextarea = createSafeElement('textarea', {
        className: 'cultural-popup__textarea',
        attrs: {
            id: 'pin-descricao-input',
            name: 'descricao',
            rows: '4',
            maxlength: String(PIN_LIMITS.MAX_DESCRICAO),
            required: 'required',
            placeholder: 'Conte a história, os costumes e a importância dessa expressão cultural...',
        },
    });
    descGroup.appendChild(descLabelRow);
    descGroup.appendChild(descTextarea);
    form.appendChild(descGroup);

    // Campo 4: Foto / Mídia (opcional)
    const photoGroup = createSafeElement('div', { className: 'cultural-popup__field' });
    const photoLabelRow = createSafeElement('div', { className: 'cultural-popup__label-row' });
    const photoLabel = createSafeElement('label', {
        text: 'Foto / Mídia (opcional)',
        attrs: { for: 'pin-foto-input' },
    });
    const photoHint = createSafeElement('span', {
        className: 'cultural-popup__counter',
        text: 'JPG, PNG, WebP ou GIF (máx. 5 MB)',
    });
    photoLabelRow.appendChild(photoLabel);
    photoLabelRow.appendChild(photoHint);

    const photoInput = createSafeElement('input', {
        className: 'cultural-popup__file-input',
        attrs: {
            id: 'pin-foto-input',
            name: 'foto',
            type: 'file',
            accept: 'image/jpeg,image/png,image/webp,image/gif',
        },
    });

    const previewBox = createSafeElement('div', {
        className: 'cultural-popup__preview d-none',
    });
    const previewImg = createSafeElement('img', {
        className: 'cultural-popup__preview-img',
        attrs: { alt: 'Pré-visualização da foto selecionada' },
    });
    const previewMeta = createSafeElement('div', {
        className: 'cultural-popup__preview-meta',
    });
    const previewName = createSafeElement('span', {
        className: 'cultural-popup__preview-name',
    });
    const removePhotoBtn = createSafeElement('button', {
        className: 'cultural-popup__remove-photo-btn',
        text: 'Remover',
        attrs: { type: 'button' },
    });
    previewMeta.appendChild(previewName);
    previewMeta.appendChild(removePhotoBtn);
    previewBox.appendChild(previewImg);
    previewBox.appendChild(previewMeta);

    photoGroup.appendChild(photoLabelRow);
    photoGroup.appendChild(photoInput);
    photoGroup.appendChild(previewBox);
    form.appendChild(photoGroup);

    // Área de erro inline
    const errorBox = createSafeElement('div', {
        className: 'cultural-popup__alert cultural-popup__alert--error d-none',
        attrs: { role: 'alert' },
    });
    form.appendChild(errorBox);

    // Botão de publicação
    const submitBtn = createSafeElement('button', {
        className: 'cultural-popup__submit',
        attrs: { type: 'submit' },
    });
    const btnIcon = createSafeElement('i', { className: 'fas fa-paper-plane me-1' });
    const btnText = createSafeElement('span', { text: 'Publicar Pin Cultural' });
    submitBtn.appendChild(btnIcon);
    submitBtn.appendChild(btnText);
    form.appendChild(submitBtn);

    let selectedPhotoFile = null;
    let previewObjectUrl = null;

    const clearSelectedPhoto = () => {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
        selectedPhotoFile = null;
        photoInput.value = '';
        previewImg.removeAttribute('src');
        previewName.textContent = '';
        previewBox.classList.add('d-none');
    };

    photoInput.addEventListener('change', () => {
        errorBox.classList.add('d-none');
        errorBox.textContent = '';

        const file = photoInput.files?.[0] ?? null;
        if (!file) {
            clearSelectedPhoto();
            return;
        }

        const checkImg = validateCulturalPinImage(file);
        if (!checkImg.valid) {
            clearSelectedPhoto();
            errorBox.textContent = checkImg.error;
            errorBox.classList.remove('d-none');
            return;
        }

        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
        }
        selectedPhotoFile = file;
        previewObjectUrl = URL.createObjectURL(file);
        previewImg.src = previewObjectUrl;
        previewName.textContent = file.name;
        previewBox.classList.remove('d-none');
    });

    removePhotoBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        clearSelectedPhoto();
        errorBox.classList.add('d-none');
        errorBox.textContent = '';
    });

    const updateCounters = () => {
        const tLen = countCodepoints(titleInput.value.trim());
        const dLen = countCodepoints(descTextarea.value.trim());
        titleCounter.textContent = `${tLen}/${PIN_LIMITS.MAX_TITULO}`;
        descCounter.textContent = `${dLen}/${PIN_LIMITS.MAX_DESCRICAO}`;
        titleCounter.classList.toggle('is-limit', tLen >= PIN_LIMITS.MAX_TITULO);
        descCounter.classList.toggle('is-limit', dLen >= PIN_LIMITS.MAX_DESCRICAO);
    };

    titleInput.addEventListener('input', () => {
        updateCounters();
        errorBox.classList.add('d-none');
    });
    descTextarea.addEventListener('input', () => {
        updateCounters();
        errorBox.classList.add('d-none');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorBox.classList.add('d-none');
        errorBox.textContent = '';

        const rawPayload = {
            titulo: titleInput.value,
            descricao: descTextarea.value,
            categoria: catSelect.value,
            cidade,
            estado,
            latitude: latlng.lat,
            longitude: latlng.lng,
        };

        const check = validateCulturalPinPayload(rawPayload);
        if (!check.valid) {
            errorBox.textContent = check.errors[0];
            errorBox.classList.remove('d-none');
            return;
        }

        if (selectedPhotoFile) {
            const imgCheck = validateCulturalPinImage(selectedPhotoFile);
            if (!imgCheck.valid) {
                errorBox.textContent = imgCheck.error;
                errorBox.classList.remove('d-none');
                return;
            }
        }

        submitBtn.disabled = true;
        btnIcon.className = 'fas fa-spinner fa-spin me-1';
        btnText.textContent = 'Publicando...';

        try {
            await onPublish({
                ...check.data,
                foto: selectedPhotoFile,
            });
            clearSelectedPhoto();
        } catch (err) {
            errorBox.textContent = err?.message || 'Não foi possível salvar o pin.';
            errorBox.classList.remove('d-none');
            submitBtn.disabled = false;
            btnIcon.className = 'fas fa-paper-plane me-1';
            btnText.textContent = 'Publicar Pin Cultural';
        }
    });

    container.appendChild(form);
    return container;
}

/**
 * Constrói o card de visualização de um Pin Cultural salvo usando estritamente `textContent`.
 */
export function buildPinDetailPopupElement(pin, { currentUserId = null, onDeletePin = null } = {}) {
    const container = createSafeElement('article', { className: 'cultural-popup cultural-popup--view' });

    const catMeta = CATEGORY_BY_VALUE[pin.categoria] ?? null;

    const topMeta = createSafeElement('div', { className: 'cultural-popup__meta-top' });
    const badge = createSafeElement('span', { className: 'cultural-popup__category-badge' });
    badge.style.backgroundColor = catMeta ? `${catMeta.color}1a` : '#f1f5f9';
    badge.style.color = catMeta ? catMeta.color : '#475569';
    badge.style.borderColor = catMeta ? `${catMeta.color}44` : '#cbd5e1';

    const icon = createSafeElement('i', {
        className: `fas ${catMeta?.icon ?? 'fa-compass'} me-1`,
    });
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(pin.categoria || 'Manifestação Cultural'));
    topMeta.appendChild(badge);
    container.appendChild(topMeta);

    const title = createSafeElement('h3', {
        className: 'cultural-popup__title',
        text: pin.titulo,
    });
    container.appendChild(title);

    const location = createSafeElement('div', { className: 'cultural-popup__place' });
    location.appendChild(createSafeElement('i', { className: 'fas fa-location-dot me-1' }));
    const placeLabel = pin.estado ? `${pin.cidade} — ${pin.estado}` : pin.cidade;
    location.appendChild(document.createTextNode(placeLabel));
    container.appendChild(location);

    if (isSafeMediaUrl(pin.imagemUrl)) {
        const mediaWrap = createSafeElement('div', { className: 'cultural-popup__media' });
        const mediaLink = createSafeElement('a', {
            className: 'cultural-popup__media-link',
            attrs: {
                href: pin.imagemUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                title: 'Abrir foto em tamanho original',
            },
        });
        const mediaImg = createSafeElement('img', {
            className: 'cultural-popup__media-img',
            attrs: {
                src: pin.imagemUrl,
                alt: `Foto de ${pin.titulo}`,
                loading: 'lazy',
            },
        });
        mediaImg.addEventListener('error', () => {
            mediaWrap.classList.add('d-none');
        });
        mediaLink.appendChild(mediaImg);
        mediaWrap.appendChild(mediaLink);
        container.appendChild(mediaWrap);
    }

    const body = createSafeElement('p', {
        className: 'cultural-popup__desc',
        text: pin.descricao,
    });
    container.appendChild(body);

    const footer = createSafeElement('div', { className: 'cultural-popup__footer' });
    footer.appendChild(createSafeElement('i', { className: 'far fa-clock me-1' }));
    footer.appendChild(
        document.createTextNode(`Publicado em ${formatDatePtBr(pin.criadoEm)}`)
    );
    container.appendChild(footer);

    const isOwner =
        Number.isInteger(currentUserId) &&
        currentUserId > 0 &&
        Number.isInteger(pin.usuarioId) &&
        pin.usuarioId === currentUserId &&
        typeof onDeletePin === 'function';

    if (isOwner) {
        const actions = createSafeElement('div', { className: 'cultural-popup__actions' });

        const deleteBtn = createSafeElement('button', {
            className: 'cultural-popup__delete-btn',
            attrs: { type: 'button' },
        });
        deleteBtn.appendChild(createSafeElement('i', { className: 'fas fa-trash-alt me-1' }));
        deleteBtn.appendChild(document.createTextNode('Excluir pin'));

        const confirmBox = createSafeElement('div', {
            className: 'cultural-popup__confirm-box d-none',
        });
        const confirmLabel = createSafeElement('span', {
            className: 'cultural-popup__confirm-label',
            text: 'Excluir este pin?',
        });
        const confirmBtns = createSafeElement('div', {
            className: 'cultural-popup__confirm-buttons',
        });

        const confirmBtn = createSafeElement('button', {
            className: 'cultural-popup__confirm-btn',
            attrs: { type: 'button' },
        });
        const confirmIcon = createSafeElement('i', { className: 'fas fa-check me-1' });
        const confirmText = createSafeElement('span', { text: 'Confirmar' });
        confirmBtn.appendChild(confirmIcon);
        confirmBtn.appendChild(confirmText);

        const cancelBtn = createSafeElement('button', {
            className: 'cultural-popup__cancel-btn',
            text: 'Cancelar',
            attrs: { type: 'button' },
        });

        confirmBtns.appendChild(confirmBtn);
        confirmBtns.appendChild(cancelBtn);
        confirmBox.appendChild(confirmLabel);
        confirmBox.appendChild(confirmBtns);

        const errorBox = createSafeElement('div', {
            className: 'cultural-popup__alert cultural-popup__alert--error d-none',
            attrs: { role: 'alert' },
        });

        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            errorBox.classList.add('d-none');
            errorBox.textContent = '';
            deleteBtn.classList.add('d-none');
            confirmBox.classList.remove('d-none');
        });

        cancelBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            errorBox.classList.add('d-none');
            errorBox.textContent = '';
            confirmBox.classList.add('d-none');
            deleteBtn.classList.remove('d-none');
        });

        confirmBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            errorBox.classList.add('d-none');
            errorBox.textContent = '';

            confirmBtn.disabled = true;
            cancelBtn.disabled = true;
            confirmIcon.className = 'fas fa-spinner fa-spin me-1';
            confirmText.textContent = 'Excluindo...';

            try {
                await onDeletePin(pin);
            } catch (err) {
                errorBox.textContent = err?.message || 'Não foi possível excluir o pin.';
                errorBox.classList.remove('d-none');
                confirmBtn.disabled = false;
                cancelBtn.disabled = false;
                confirmIcon.className = 'fas fa-check me-1';
                confirmText.textContent = 'Confirmar';
            }
        });

        actions.appendChild(deleteBtn);
        actions.appendChild(confirmBox);
        actions.appendChild(errorBox);
        container.appendChild(actions);
    }

    return container;
}

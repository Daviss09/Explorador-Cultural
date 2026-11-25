<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (!function_exists('url')) {
    require_once __DIR__ . '/../helpers.php';
}

$csrfToken = csrf_token();
$appClientConfig = [
    'pinsEndpoint' => url('pins'),
    'csrfToken' => $csrfToken,
    'cartoApiKey' => env('CARTO_API_KEY', ''),
];
?>
<!doctype html>
<html lang="pt-BR" data-bs-theme="light">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="<?= e($csrfToken) ?>" />
    <title>Explorador Cultural — Mapa Interativo do Brasil</title>
    <!-- Bootstrap 5.3.3 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
    <!-- Leaflet 1.9.4 CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <!-- Estilos do Mapa Cultural -->
    <link rel="stylesheet" href="<?= url('css/mapa.css') ?>" />
</head>

<body class="cultural-app-body">
    <header class="cultural-header">
        <nav class="navbar navbar-expand-lg bg-white border-bottom shadow-sm-subtle">
            <div class="container-fluid px-3 px-lg-4">
                <a class="navbar-brand fw-bold text-primary d-flex align-items-center" href="<?= url() ?>">
                    <i class="fas fa-compass me-2"></i>Explorador Cultural
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Alternar navegação">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarSupportedContent">
                    <form id="navbar-search-form" class="d-flex me-auto my-2 my-lg-0 position-relative cultural-search-form" role="search" autocomplete="off">
                        <input id="navbar-search-input" class="form-control me-2" type="search" placeholder="Pesquisar culturas ou cidades..." aria-label="Pesquisar culturas ou cidades" />
                        <button class="btn btn-outline-primary" type="submit" aria-label="Buscar">
                            <i class="fas fa-search"></i>
                        </button>
                        <div id="navbar-search-results" class="search-dropdown d-none" role="listbox" aria-label="Sugestões de busca"></div>
                    </form>
                    <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-2">
                        <?php if (!empty($_SESSION['user'])): ?>
                            <li class="nav-item me-2 text-secondary">
                                <i class="fas fa-user-circle me-1 text-primary"></i>Olá, <strong><?= e($_SESSION['user']['nome'] ?? '') ?></strong>
                            </li>
                            <li class="nav-item">
                                <a class="btn btn-outline-danger btn-sm" href="<?= url('user/logout') ?>">
                                    <i class="fas fa-sign-out-alt me-1"></i>Sair
                                </a>
                            </li>
                        <?php else: ?>
                            <li class="nav-item">
                                <a class="btn btn-outline-primary btn-sm px-3" href="<?= url('user/login') ?>">
                                    <i class="fas fa-sign-in-alt me-1"></i>Login
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="btn btn-primary btn-sm px-3" href="<?= url('user/cadastro') ?>">
                                    <i class="fas fa-user-plus me-1"></i>Cadastro
                                </a>
                            </li>
                        <?php endif; ?>
                    </ul>
                </div>
            </div>
        </nav>
    </header>

    <main class="cultural-map-workspace">
        <!-- Canvas do Mapa Leaflet -->
        <div id="cultural-map" class="cultural-map-canvas" role="region" aria-label="Mapa Cultural Interativo do Brasil"></div>

        <!-- Instrução visual discreta -->
        <div class="map-instruction-pill" role="note">
            <i class="fas fa-hand-pointer text-primary" aria-hidden="true"></i>
            <span>Clique em qualquer cidade para adicionar uma expressão cultural</span>
        </div>

        <!-- Painel de controle / filtros rápidos -->
        <aside class="map-hud-panel" aria-label="Filtros e status do mapa">
            <div class="map-hud-panel__row">
                <span class="map-stat-pill" title="Pins culturais visíveis">
                    <i class="fas fa-map-pin text-primary" aria-hidden="true"></i>
                    <strong id="pins-counter-value">0</strong>
                    <span>pins</span>
                </span>

                <select id="category-filter-select" class="form-select form-select-sm map-category-filter" aria-label="Filtrar pins por categoria">
                    <option value="">Todas as categorias</option>
                </select>

                <button id="reset-brazil-btn" type="button" class="btn btn-light btn-sm border" title="Centralizar no Brasil">
                    <i class="fas fa-expand-arrows-alt" aria-hidden="true"></i>
                </button>
            </div>

            <div class="map-hud-panel__subrow">
                <span id="zoom-status-badge" class="map-zoom-badge">Zoom 4</span>
                <button id="zoom-municipios-btn" type="button" class="btn btn-link btn-sm p-0 map-zoom-action">
                    Ver divisas municipais
                </button>
            </div>

            <div id="db-status-banner" class="map-db-banner d-none" role="status"></div>
        </aside>

        <!-- Legenda das Regiões do Brasil -->
        <section id="map-legend" class="map-legend" aria-label="Legenda das regiões do Brasil">
            <div class="map-legend__header">
                <h2 class="map-legend__title">Regiões do Brasil</h2>
                <button id="legend-toggle-btn" type="button" class="map-legend__toggle" aria-expanded="true" aria-controls="legend-body" title="Alternar legenda">
                    <i class="fas fa-layer-group" aria-hidden="true"></i>
                </button>
            </div>
            <div id="legend-body" class="map-legend__body">
                <ul id="region-legend-list" class="map-legend__list"></ul>
                <div class="map-legend__borders">
                    <div class="map-legend__border-item">
                        <span class="map-legend__line map-legend__line--state" aria-hidden="true"></span>
                        <span>Estados (UF)</span>
                    </div>
                    <div class="map-legend__border-item">
                        <span class="map-legend__line map-legend__line--city" aria-hidden="true"></span>
                        <span>Municípios (zoom &ge; 6)</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- Overlay inicial de carregamento das malhas do IBGE -->
        <div id="map-loading-overlay" class="map-loading-overlay" role="status" aria-live="polite">
            <div class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></div>
            <span id="map-loading-label">Carregando malhas geográficas...</span>
        </div>

        <!-- Feedback não-bloqueante de ações -->
        <div id="map-toast" class="map-toast d-none" role="status" aria-live="polite"></div>
    </main>

    <!-- Configuração segura dos endpoints da aplicação -->
    <script type="application/json" id="app-config-data">
        <?= json_encode($appClientConfig, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) ?>
    </script>

    <!-- Bootstrap 5.3.3 JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <!-- Leaflet 1.9.4 + TopoJSON Client 3.x -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/topojson-client@3/dist/topojson-client.min.js"></script>
    <!-- Aplicação modular do Mapa Cultural -->
    <script type="module" src="<?= url('js/app.js') ?>"></script>
</body>

</html>

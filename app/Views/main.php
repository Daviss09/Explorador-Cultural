<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (!function_exists('url')) {
    require_once __DIR__ . '/../helpers.php';
}
?>
<!doctype html>
<html lang="pt-BR" data-bs-theme="light">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Explorador Cultural</title>
    <!-- Bootstrap 5.3.3 CSS (Versão oficial e estável) -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
</head>

<body>
    <header>
        <nav class="navbar navbar-expand-lg bg-body-tertiary">
            <div class="container-fluid">
                <a class="navbar-brand fw-bold text-primary" href="<?= url() ?>">
                    <i class="fas fa-compass me-2"></i>Explorador Cultural
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarSupportedContent">
                    <form class="d-flex me-auto my-2 my-lg-0" role="search">
                        <input class="form-control me-2" type="search" placeholder="Pesquisar..." aria-label="Search" />
                        <button class="btn btn-outline-success" type="submit">
                            <i class="fas fa-search"></i>
                        </button>
                    </form>
                    <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-2">
                        <?php if (!empty($_SESSION['user'])): ?>
                            <li class="nav-item me-2 text-secondary">
                                <i class="fas fa-user-circle me-1 text-primary"></i>Olá, <strong><?= htmlspecialchars($_SESSION['user']['nome']) ?></strong>
                            </li>
                            <li class="nav-item">
                                <a class="btn btn-outline-danger btn-sm" href="<?= url('user/logout') ?>">
                                    <i class="fas fa-sign-out-alt me-1"></i>Sair
                                </a>
                            </li>
                        <?php else: ?>
                            <li class="nav-item">
                                <a class="btn btn-outline-primary" href="<?= url('user/login') ?>">
                                    <i class="fas fa-sign-in-alt me-1"></i>Login
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="btn btn-primary" href="<?= url('user/cadastro') ?>">
                                    <i class="fas fa-user-plus me-1"></i>Cadastro
                                </a>
                            </li>
                        <?php endif; ?>
                    </ul>
                </div>
            </div>
        </nav>
    </header>

    <main class="container py-5">
        
    </main>

    <!-- Bootstrap 5.3.3 JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>

</html>

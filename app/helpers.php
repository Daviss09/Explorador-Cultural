<?php

declare(strict_types=1);

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function url(string $path = ''): string
{
    return BASE_URL . '/' . ltrim($path, '/');
}

function redirect(string $path): never
{
    header('Location: ' . url($path));
    exit;
}

function render(string $view = 'cadastro', array $data = []): void
{
    extract($data, EXTR_SKIP);
    $viewFile = __DIR__ . '/Views/' . $view . '.php';
    if (!is_file($viewFile)) {
        $viewFile = __DIR__ . '/Views/cadastro.php';
    }
    require $viewFile;
}

function csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    return $_SESSION['_csrf'] ??= bin2hex(random_bytes(32));
}

function verify_csrf(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $submitted = $_POST['_csrf'] ?? '';
    if (!is_string($submitted) || !hash_equals($_SESSION['_csrf'] ?? '', $submitted)) {
        http_response_code(419);
        exit('A sessão expirou. Atualize a página e tente novamente.');
    }
}

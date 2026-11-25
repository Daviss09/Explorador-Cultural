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

/**
 * Carrega variáveis do arquivo .env (formato KEY=VALUE) uma única vez.
 */
function env(string $key, string $default = ''): string
{
    static $vars = null;
    if ($vars === null) {
        $vars = [];
        $envFile = __DIR__ . '/../.env';
        if (is_file($envFile)) {
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $vars[trim($parts[0])] = trim($parts[1]);
                }
            }
        }
    }
    return $vars[$key] ?? $default;
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

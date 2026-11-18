<?php

declare(strict_types=1);

// 0) Caminho base
if (!defined('BASE_URL')) {
    $base = dirname(dirname($_SERVER['SCRIPT_NAME']));
    define('BASE_URL', rtrim(str_replace('\\', '/', $base), '/'));
}

// 1) Autoload
spl_autoload_register(function (string $class) {
    $file = __DIR__ . '/../app/'
        . str_replace(['App\\', '\\'], ['', '/'], $class) . '.php';
    if (is_file($file)) require_once $file;
});

require_once __DIR__ . '/../app/helpers.php';

// 2) Interpretação da URL
$route = trim((string) ($_GET['url'] ?? ''), '/');
if ($route === '') {
    $route = 'user/index';
}
$url = explode('/', $route);
$url[0] = preg_replace('/[^a-zA-Z0-9_]/', '', $url[0] ?? 'user');
$url[1] = preg_replace('/[^a-zA-Z0-9_]/', '', $url[1] ?? 'index');
$controller = 'App\\Controllers\\' . ucfirst($url[0]) . 'Controller';
$method = $url[1] ?? 'index';
$params = array_slice($url, 2);

// 3) Validação e despacho (padrão é sempre a tela de cadastro)
if (!class_exists($controller) || !method_exists($controller, $method)) {
    $controller = 'App\\Controllers\\UserController';
    $method = 'index';
}

(new $controller())->$method(...$params);

<?php

declare(strict_types=1);

// 0) Caminho base
if (!defined('BASE_URL')) {
    $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
    if (basename($scriptDir) === 'public') {
        $base = dirname($scriptDir);
    } else {
        $base = $scriptDir;
    }
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
$rawRoute = trim((string) ($_GET['url'] ?? ''), '/');
$rawRoute = preg_replace('/\.php$/i', '', $rawRoute);

// Atalhos diretos de rota comuns
$routeAliases = [
    '' => ['UserController', 'index'],
    'index' => ['UserController', 'index'],
    'home' => ['UserController', 'index'],
    'cadastro' => ['UserController', 'cadastro'],
    'login' => ['UserController', 'login'],
    'logout' => ['UserController', 'logout'],
    'pins' => ['PinController', 'handle'],
    'pin/index' => ['PinController', 'index'],
    'pin/store' => ['PinController', 'store'],
    'pin/delete' => ['PinController', 'destroy'],
    'pin/destroy' => ['PinController', 'destroy'],
];

if (isset($routeAliases[$rawRoute])) {
    [$ctrlName, $method] = $routeAliases[$rawRoute];
    $controller = 'App\\Controllers\\' . $ctrlName;
    $params = [];
} elseif (preg_match('#^pins/(\d+)$#', $rawRoute, $matches)) {
    $controller = 'App\\Controllers\\PinController';
    $method = 'handle';
    $params = [(int) $matches[1]];
} else {
    $url = explode('/', $rawRoute);
    $url[0] = preg_replace('/[^a-zA-Z0-9_]/', '', $url[0] ?? 'user');
    $url[1] = preg_replace('/[^a-zA-Z0-9_]/', '', $url[1] ?? 'index');
    $controller = 'App\\Controllers\\' . ucfirst($url[0]) . 'Controller';
    $method = $url[1] ?? 'index';
    $params = array_slice($url, 2);
}

// 3) Validação e despacho (padrão é sempre a tela inicial/index)
if (!class_exists($controller) || !method_exists($controller, $method)) {
    $controller = 'App\\Controllers\\UserController';
    $method = 'index';
    $params = [];
}

(new $controller())->$method(...$params);

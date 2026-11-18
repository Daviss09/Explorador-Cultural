<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// Garante o carregamento dos helpers se a view for acessada diretamente
if (!function_exists('url')) {
    require_once __DIR__ . '/../helpers.php';
}

// Garante o carregamento dos modelos se a view for acessada diretamente
if (!class_exists('App\Models\Database')) {
    $dbFile = __DIR__ . '/../Models/Database.php';
    if (!file_exists($dbFile)) {
        $dbFile = __DIR__ . '/../../Models/Database.php';
    }
    if (file_exists($dbFile)) {
        require_once $dbFile;
    }
}
if (!class_exists('App\Models\User')) {
    $userFile = __DIR__ . '/../Models/User.php';
    if (!file_exists($userFile)) {
        $userFile = __DIR__ . '/../../Models/User.php';
    }
    if (file_exists($userFile)) {
        require_once $userFile;
    }
}

use App\Models\Database;
use App\Models\User;

$error = '';
$success = '';
$nome = '';

// Teste de conexão com o banco de dados
$dbConectado = false;
try {
    Database::connect();
    $dbConectado = true;
} catch (\Exception $e) {
    $error = 'Não foi possível conectar ao banco de dados: ' . $e->getMessage();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $dbConectado) {
    $nome = trim($_POST['username'] ?? '');
    $senha = $_POST['password'] ?? '';

    if ($nome === '' || $senha === '') {
        $error = 'Por favor, preencha o usuário e a senha.';
    } else {
        try {
            $user = User::authenticate($nome, $senha);
            if ($user) {
                $_SESSION['user'] = $user;
                header('Location: ' . url());
                exit;
            } else {
                $error = 'Usuário ou senha incorretos.';
            }
        } catch (\PDOException $e) {
            $error = 'Erro ao consultar banco de dados: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Explorador Cultural</title>
    <!-- Bootstrap 5.3.3 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Font Awesome Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --sb-primary: #4e73df;
            --sb-primary-dark: #224abe;
        }
        body {
            background-color: #f8f9fc;
            font-family: 'Nunito', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
        }
        .card {
            border: none;
            border-radius: .5rem;
            box-shadow: 0 .15rem 1.75rem 0 rgba(58,59,69,.15);
        }
        .card-header {
            background: var(--sb-primary);
            color: white;
            border-radius: .5rem .5rem 0 0 !important;
            font-weight: 700;
        }
        .btn-primary {
            background-color: var(--sb-primary);
            border-color: var(--sb-primary);
        }
        .btn-primary:hover {
            background-color: var(--sb-primary-dark);
            border-color: var(--sb-primary-dark);
        }
        .form-control:focus {
            border-color: var(--sb-primary);
            box-shadow: 0 0 0 .2rem rgba(78,115,223,.25);
        }
    </style>
</head>
<body>
<div class="container py-4">
    <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
            <div class="card">
                <div class="card-header text-center py-3">
                    <h5 class="mb-0"><i class="fas fa-sign-in-alt me-2"></i>Entrar</h5>
                </div>
                <div class="card-body p-4">
                    <?php if ($error): ?>
                        <div class="alert alert-danger alert-dismissible fade show" role="alert">
                            <i class="fas fa-exclamation-circle me-2"></i><?= htmlspecialchars($error) ?>
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                        </div>
                    <?php endif; ?>

                    <form method="POST">
                        <div class="mb-3">
                            <label class="form-label fw-semibold">Nome de Usuário</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-user"></i></span>
                                <input type="text" class="form-control" name="username"
                                       value="<?= htmlspecialchars($nome ?? '') ?>"
                                       placeholder="Digite seu usuário" required autofocus>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="form-label fw-semibold">Senha</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                <input type="password" class="form-control" name="password"
                                       placeholder="Digite sua senha" required>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">
                            <i class="fas fa-sign-in-alt me-2"></i>Entrar
                        </button>
                    </form>

                    <hr class="my-4">

                    <div class="text-center">
                        <p class="mb-2 text-muted">Ainda não tem conta? <a href="<?= url('user/cadastro') ?>" class="fw-bold text-decoration-none text-primary">Cadastre-se</a></p>
                        <a href="<?= url() ?>" class="text-secondary small text-decoration-none">
                            <i class="fas fa-arrow-left me-1"></i>Voltar para a Página Inicial
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Bootstrap 5.3.3 JS Bundle -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>

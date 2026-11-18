<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
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
$endereco = '';

// Teste rápido de conexão para exibir alerta amigável se o banco estiver indisponível
$dbConectado = false;
try {
    Database::connect();
    $dbConectado = true;
} catch (\Exception $e) {
    $error = 'Não foi possível conectar ao banco de dados: ' . $e->getMessage();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $dbConectado) {
    $nome = trim($_POST['username'] ?? '');
    $endereco = trim($_POST['endereco'] ?? '');
    $senha = $_POST['password'] ?? '';
    $confirm = $_POST['confirm_password'] ?? '';

    if ($nome === '' || $senha === '') {
        $error = 'Nome de usuário e senha são obrigatórios.';
    } elseif (strlen($nome) < 3) {
        $error = 'O nome de usuário deve ter pelo menos 3 caracteres.';
    } elseif (strlen($senha) < 6) {
        $error = 'A senha deve ter pelo menos 6 caracteres.';
    } elseif ($senha !== $confirm) {
        $error = 'As senhas não coincidem.';
    } else {
        try {
            if (User::nomeExists($nome)) {
                $error = 'Este nome de usuário já está cadastrado.';
            } else {
                User::create($nome, $senha, $endereco !== '' ? $endereco : null);
                $success = 'Cadastro realizado com sucesso! Usuário salvo no banco de dados.';
                $nome = '';
                $endereco = '';
            }
        } catch (\PDOException $e) {
            $error = 'Erro ao salvar usuário no banco de dados: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cadastro - Explorador Cultural</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@6.0.0-alpha.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-B/GM4XqrwHnWXNOWMbloTmrYXZg10cakYGmpfsR/bbzQ6JAJI4ihuyADKLnBgrCe" crossorigin="anonymous">
<script type="module" src="https://cdn.jsdelivr.net/npm/bootstrap@6.0.0-alpha.1/dist/js/bootstrap.bundle.min.js" integrity="sha384-1a/pXj49ZQ1aHEmrJ+gMw1otqoVsYwlEnlD8mIfY2TV03r20Y0CN7uqx1tQogjPL" crossorigin="anonymous"></script>
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
                    <h5 class="mb-0"><i class="fas fa-user-plus me-2"></i>Cadastro de Usuário</h5>
                </div>
                <div class="card-body p-4">
                    <?php if ($error): ?>
                        <div class="alert alert-danger"><?= htmlspecialchars($error) ?></div>
                    <?php endif; ?>

                    <?php if ($success): ?>
                        <div class="alert alert-success"><?= htmlspecialchars($success) ?></div>
                    <?php endif; ?>

                    <form method="POST">
                        <div class="mb-3">
                            <label class="form-label">Nome de Usuário</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-user"></i></span>
                                <input type="text" class="form-control" name="username"
                                       value="<?= htmlspecialchars($nome ?? '') ?>"
                                       placeholder="Digite seu usuário" required autofocus>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Endereço (opcional)</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-map-marker-alt"></i></span>
                                <input type="text" class="form-control" name="endereco"
                                       value="<?= htmlspecialchars($endereco ?? '') ?>"
                                       placeholder="Digite seu endereço">
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Senha</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                <input type="password" class="form-control" name="password"
                                       placeholder="Mínimo 6 caracteres" required>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="form-label">Confirmar Senha</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                <input type="password" class="form-control" name="confirm_password"
                                       placeholder="Repita a senha" required>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary w-100 py-2">
                            <i class="fas fa-user-plus me-2"></i>Cadastrar
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>

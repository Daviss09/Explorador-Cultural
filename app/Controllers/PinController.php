<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Pin;
use PDOException;

class PinController
{
    public function handle(): void
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'GET') {
            $this->index();
            return;
        }
        if ($method === 'POST') {
            $this->store();
            return;
        }

        $this->sendJson(['ok' => false, 'error' => 'Método HTTP não permitido.'], 405);
    }

    public function index(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        $afterId = isset($_GET['afterId']) && is_numeric($_GET['afterId'])
            ? max(0, (int) $_GET['afterId'])
            : 0;

        try {
            $pins = Pin::listAll($afterId);
            $this->sendJson([
                'ok' => true,
                'pins' => $pins,
            ]);
        } catch (PDOException) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Não foi possível conectar ao banco de dados MySQL. Verifique se o serviço está ativo no XAMPP.',
            ], 503);
        }
    }

    public function store(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }

        $expectedCsrf = (string) ($_SESSION['_csrf'] ?? '');
        $submittedCsrf = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $usuarioId = isset($_SESSION['user']['id']) ? (int) $_SESSION['user']['id'] : null;

        session_write_close();

        if ($expectedCsrf === '' || $submittedCsrf === '' || !hash_equals($expectedCsrf, $submittedCsrf)) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Sessão expirada (token CSRF inválido). Atualize a página e tente novamente.',
            ], 419);
            return;
        }

        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '', true);
        if (!is_array($payload)) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Corpo da requisição JSON inválido.',
            ], 400);
            return;
        }

        $validation = Pin::validateAndNormalize($payload);
        if (!$validation['valid']) {
            $this->sendJson([
                'ok' => false,
                'error' => $validation['errors'][0] ?? 'Dados inválidos.',
                'errors' => $validation['errors'],
            ], 422);
            return;
        }

        try {
            $created = Pin::create($validation['data'], $usuarioId);
            $this->sendJson([
                'ok' => true,
                'pin' => $created,
            ], 201);
        } catch (PDOException) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Erro ao gravar o pin no banco de dados MySQL.',
            ], 500);
        }
    }

    /**
     * @param array<string, mixed> $data
     */
    private function sendJson(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Pin;
use PDOException;

class PinController
{
    public function handle(?int $id = null): void
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
        if ($method === 'DELETE') {
            $this->destroy($id);
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
        $auth = $this->authenticateCsrfRequest();
        if ($auth === null) {
            return;
        }
        $usuarioId = $auth['usuarioId'];
        if ($usuarioId === null || $usuarioId <= 0) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Você precisa estar logado para criar um pin.',
            ], 401);
            return;
        }

        $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        $isJsonRequest = str_contains($contentType, 'application/json');

        if ($isJsonRequest) {
            $rawBody = file_get_contents('php://input');
            $payload = json_decode($rawBody ?: '', true);
            if (!is_array($payload)) {
                $this->sendJson([
                    'ok' => false,
                    'error' => 'Corpo da requisição JSON inválido.',
                ], 400);
                return;
            }
        } else {
            $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
            if ($contentLength > 0 && $_POST === [] && $_FILES === []) {
                $this->sendJson([
                    'ok' => false,
                    'error' => 'A imagem enviada excede o tamanho máximo permitido pelo servidor.',
                ], 413);
                return;
            }
            $payload = $_POST;
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

        $imagemPath = null;
        if (!$isJsonRequest && isset($_FILES['foto']) && is_array($_FILES['foto'])) {
            $uploadResult = $this->processUploadedPhoto($_FILES['foto']);
            if (!$uploadResult['ok']) {
                $this->sendJson([
                    'ok' => false,
                    'error' => $uploadResult['error'],
                ], $uploadResult['status']);
                return;
            }
            $imagemPath = $uploadResult['path'];
        }

        try {
            $created = Pin::create($validation['data'], $usuarioId, $imagemPath);
            $this->sendJson([
                'ok' => true,
                'pin' => $created,
            ], 201);
        } catch (PDOException) {
            if ($imagemPath !== null) {
                Pin::deleteLocalImage($imagemPath);
            }
            $this->sendJson([
                'ok' => false,
                'error' => 'Erro ao gravar o pin no banco de dados MySQL.',
            ], 500);
        }
    }

    public function destroy(?int $routeId = null): void
    {
        $auth = $this->authenticateCsrfRequest();
        if ($auth === null) {
            return;
        }
        $usuarioId = $auth['usuarioId'];

        if ($usuarioId === null || $usuarioId <= 0) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Você precisa estar logado para excluir um pin.',
            ], 401);
            return;
        }

        $pinId = $this->resolvePinId($routeId);
        if ($pinId <= 0) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Identificador do pin inválido.',
            ], 400);
            return;
        }

        try {
            $result = Pin::deleteOwnedByUser($pinId, $usuarioId);
            if ($result === 'not_found') {
                $this->sendJson([
                    'ok' => false,
                    'error' => 'Pin não encontrado.',
                ], 404);
                return;
            }
            if ($result === 'forbidden') {
                $this->sendJson([
                    'ok' => false,
                    'error' => 'Você só pode excluir os pins que você mesmo criou.',
                ], 403);
                return;
            }

            $this->sendJson([
                'ok' => true,
                'deletedId' => $pinId,
            ]);
        } catch (PDOException) {
            $this->sendJson([
                'ok' => false,
                'error' => 'Erro ao excluir o pin no banco de dados MySQL.',
            ], 500);
        }
    }

    /**
     * Lê o usuário da sessão e valida o token CSRF do cabeçalho HTTP.
     *
     * @return array{usuarioId: int|null}|null
     */
    private function authenticateCsrfRequest(): ?array
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
            return null;
        }

        return ['usuarioId' => $usuarioId];
    }

    private function resolvePinId(?int $routeId): int
    {
        if ($routeId !== null && $routeId > 0) {
            return $routeId;
        }

        if (isset($_GET['id']) && is_numeric($_GET['id'])) {
            return max(0, (int) $_GET['id']);
        }

        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '', true);
        if (is_array($payload) && isset($payload['id']) && is_numeric($payload['id'])) {
            return max(0, (int) $payload['id']);
        }

        return 0;
    }

    /**
     * Valida e armazena uma foto opcional enviada para o pin cultural.
     *
     * @param array<string, mixed> $file
     * @return array{ok: true, path: string|null}|array{ok: false, status: int, error: string}
     */
    private function processUploadedPhoto(array $file): array
    {
        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode === UPLOAD_ERR_NO_FILE) {
            return ['ok' => true, 'path' => null];
        }

        if ($errorCode === UPLOAD_ERR_INI_SIZE || $errorCode === UPLOAD_ERR_FORM_SIZE) {
            return [
                'ok' => false,
                'status' => 422,
                'error' => 'A foto deve ter no máximo 5 MB.',
            ];
        }

        if ($errorCode !== UPLOAD_ERR_OK) {
            return [
                'ok' => false,
                'status' => 400,
                'error' => 'Falha no envio da foto. Tente novamente.',
            ];
        }

        $tmpPath = (string) ($file['tmp_name'] ?? '');
        if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
            return [
                'ok' => false,
                'status' => 400,
                'error' => 'Arquivo de imagem inválido.',
            ];
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > Pin::MAX_IMAGE_BYTES) {
            return [
                'ok' => false,
                'status' => 422,
                'error' => 'A foto deve ter no máximo 5 MB.',
            ];
        }

        $allowedTypes = [
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            IMAGETYPE_GIF => 'gif',
        ];
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

        $imageInfo = @getimagesize($tmpPath);
        $detectedType = is_array($imageInfo) ? ($imageInfo[2] ?? null) : null;
        if (!is_int($detectedType) || !isset($allowedTypes[$detectedType])) {
            return [
                'ok' => false,
                'status' => 422,
                'error' => 'Formato de imagem inválido. Envie JPG, PNG, WebP ou GIF.',
            ];
        }

        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = $finfo ? finfo_file($finfo, $tmpPath) : false;
            if ($finfo) {
                finfo_close($finfo);
            }
            if (!is_string($mime) || !in_array($mime, $allowedMimes, true)) {
                return [
                    'ok' => false,
                    'status' => 422,
                    'error' => 'Formato de imagem inválido. Envie JPG, PNG, WebP ou GIF.',
                ];
            }
        }

        $uploadsDir = __DIR__ . '/../../public/uploads/pins';
        if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0755, true) && !is_dir($uploadsDir)) {
            return [
                'ok' => false,
                'status' => 500,
                'error' => 'Não foi possível preparar a pasta de imagens no servidor.',
            ];
        }

        $filename = bin2hex(random_bytes(16)) . '.' . $allowedTypes[$detectedType];
        $destination = $uploadsDir . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($tmpPath, $destination)) {
            return [
                'ok' => false,
                'status' => 500,
                'error' => 'Erro ao salvar a imagem enviada.',
            ];
        }

        return [
            'ok' => true,
            'path' => 'uploads/pins/' . $filename,
        ];
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

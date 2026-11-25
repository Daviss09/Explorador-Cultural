<?php

declare(strict_types=1);

namespace App\Models;

use PDO;

class Pin
{
    public const MAX_TITULO = 80;
    public const MAX_DESCRICAO = 1000;
    public const MAX_CIDADE = 120;
    public const MAX_IMAGE_BYTES = 5242880; // 5 MB

    public const ALLOWED_CATEGORIES = [
        '',
        'Música/Dança',
        'Culinária',
        'Festas Populares',
        'Artesanato',
        'Folclore e Lendas',
        'Patrimônio e Arquitetura',
        'Outros',
    ];

    public const ALLOWED_UFS = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
        'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
        'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
    ];

    private static bool $tableEnsured = false;

    /**
     * Garante que a tabela `pins_culturais` exista no banco `exploradorcultural`.
     */
    public static function ensureTable(): void
    {
        if (self::$tableEnsured) {
            return;
        }

        $pdo = Database::connect();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS `pins_culturais` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `titulo` VARCHAR(80) NOT NULL,
                `descricao` TEXT NOT NULL,
                `categoria` VARCHAR(60) NOT NULL DEFAULT "",
                `cidade` VARCHAR(120) NOT NULL,
                `estado` CHAR(2) NOT NULL,
                `latitude` DECIMAL(9,6) NOT NULL,
                `longitude` DECIMAL(9,6) NOT NULL,
                `imagem_url` VARCHAR(255) NULL DEFAULT NULL,
                `usuario_id` INT(11) NULL DEFAULT NULL,
                `criadoEm` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_pins_criado_em` (`criadoEm`),
                KEY `idx_pins_estado_cidade` (`estado`, `cidade`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $columnCheck = $pdo->query("SHOW COLUMNS FROM `pins_culturais` LIKE 'imagem_url'");
        if ($columnCheck !== false && $columnCheck->fetch() === false) {
            $pdo->exec(
                'ALTER TABLE `pins_culturais`
                 ADD COLUMN `imagem_url` VARCHAR(255) NULL DEFAULT NULL AFTER `longitude`'
            );
        }

        self::$tableEnsured = true;
    }

    /**
     * Lista todos os pins culturais ou apenas os inseridos após `$afterId` (sincronização delta).
     *
     * @return array<int, array<string, mixed>>
     */
    public static function listAll(int $afterId = 0): array
    {
        self::ensureTable();
        $pdo = Database::connect();

        if ($afterId > 0) {
            $stmt = $pdo->prepare(
                'SELECT id, titulo, descricao, categoria, cidade, estado, latitude, longitude, imagem_url, usuario_id, criadoEm
                 FROM pins_culturais
                 WHERE id > ?
                 ORDER BY id ASC
                 LIMIT 500'
            );
            $stmt->execute([$afterId]);
        } else {
            $stmt = $pdo->query(
                'SELECT id, titulo, descricao, categoria, cidade, estado, latitude, longitude, imagem_url, usuario_id, criadoEm
                 FROM pins_culturais
                 ORDER BY criadoEm DESC, id DESC
                 LIMIT 2000'
            );
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map([self::class, 'formatRow'], $rows);
    }

    /**
     * Valida e higieniza o payload recebido antes de gravar no MySQL.
     *
     * @param array<string, mixed> $input
     * @return array{valid: bool, errors: string[], data: array<string, mixed>}
     */
    public static function validateAndNormalize(array $input): array
    {
        $errors = [];

        $titulo = self::normalizeSingleLine((string) ($input['titulo'] ?? ''));
        $descricao = self::normalizeMultiline((string) ($input['descricao'] ?? ''));
        $categoria = self::normalizeSingleLine((string) ($input['categoria'] ?? ''));
        $cidade = self::normalizeSingleLine((string) ($input['cidade'] ?? ''));
        $estado = strtoupper(self::normalizeSingleLine((string) ($input['estado'] ?? '')));

        $latRaw = $input['latitude'] ?? null;
        $lngRaw = $input['longitude'] ?? null;
        $latitude = is_numeric($latRaw) ? (float) $latRaw : NAN;
        $longitude = is_numeric($lngRaw) ? (float) $lngRaw : NAN;

        $tituloLen = mb_strlen($titulo, 'UTF-8');
        if ($tituloLen === 0) {
            $errors[] = 'Informe o título da manifestação cultural.';
        } elseif ($tituloLen > self::MAX_TITULO) {
            $errors[] = 'O título deve ter no máximo ' . self::MAX_TITULO . ' caracteres.';
        }

        $descLen = mb_strlen($descricao, 'UTF-8');
        if ($descLen === 0) {
            $errors[] = 'Informe a descrição da cultura ou tradição.';
        } elseif ($descLen > self::MAX_DESCRICAO) {
            $errors[] = 'A descrição deve ter no máximo ' . self::MAX_DESCRICAO . ' caracteres.';
        }

        if (!in_array($categoria, self::ALLOWED_CATEGORIES, true)) {
            $errors[] = 'Categoria selecionada inválida.';
        }

        $cidadeLen = mb_strlen($cidade, 'UTF-8');
        if ($cidadeLen === 0 || $cidadeLen > self::MAX_CIDADE) {
            $errors[] = 'Município inválido para o ponto selecionado.';
        }

        if (!in_array($estado, self::ALLOWED_UFS, true)) {
            $errors[] = 'UF inválida para o ponto selecionado.';
        }

        if (
            !is_finite($latitude) || !is_finite($longitude) ||
            $latitude < -35.0 || $latitude > 6.0 ||
            $longitude < -75.0 || $longitude > -28.0
        ) {
            $errors[] = 'Coordenadas fora da área territorial do Brasil.';
        }

        return [
            'valid' => $errors === [],
            'errors' => $errors,
            'data' => [
                'titulo' => $titulo,
                'descricao' => $descricao,
                'categoria' => $categoria,
                'cidade' => $cidade,
                'estado' => $estado,
                'latitude' => round($latitude, 6),
                'longitude' => round($longitude, 6),
            ],
        ];
    }

    /**
     * Insere um novo pin cultural no banco de dados e retorna o registro salvo.
     *
     * @param array<string, mixed> $validatedData
     * @return array<string, mixed>
     */
    public static function create(array $validatedData, ?int $usuarioId = null, ?string $imagemUrl = null): array
    {
        self::ensureTable();
        $pdo = Database::connect();

        $stmt = $pdo->prepare(
            'INSERT INTO pins_culturais (titulo, descricao, categoria, cidade, estado, latitude, longitude, imagem_url, usuario_id)
             VALUES (:titulo, :descricao, :categoria, :cidade, :estado, :latitude, :longitude, :imagem_url, :usuario_id)'
        );

        $stmt->execute([
            ':titulo' => $validatedData['titulo'],
            ':descricao' => $validatedData['descricao'],
            ':categoria' => $validatedData['categoria'],
            ':cidade' => $validatedData['cidade'],
            ':estado' => $validatedData['estado'],
            ':latitude' => $validatedData['latitude'],
            ':longitude' => $validatedData['longitude'],
            ':imagem_url' => $imagemUrl,
            ':usuario_id' => $usuarioId,
        ]);

        $newId = (int) $pdo->lastInsertId();
        $select = $pdo->prepare(
            'SELECT id, titulo, descricao, categoria, cidade, estado, latitude, longitude, imagem_url, usuario_id, criadoEm
             FROM pins_culturais
             WHERE id = ?'
        );
        $select->execute([$newId]);
        $row = $select->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return [
                'id' => $newId,
                ...$validatedData,
                'imagemUrl' => $imagemUrl !== null ? url($imagemUrl) : null,
                'usuarioId' => $usuarioId,
                'criadoEm' => date('c'),
            ];
        }

        return self::formatRow($row);
    }

    /**
     * Exclui um pin cultural apenas se pertencer ao usuário informado.
     *
     * @return 'deleted'|'not_found'|'forbidden'
     */
    public static function deleteOwnedByUser(int $pinId, int $usuarioId): string
    {
        self::ensureTable();
        $pdo = Database::connect();

        $stmt = $pdo->prepare(
            'SELECT usuario_id, imagem_url
             FROM pins_culturais
             WHERE id = ?
             LIMIT 1'
        );
        $stmt->execute([$pinId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return 'not_found';
        }

        $ownerId = isset($row['usuario_id']) ? (int) $row['usuario_id'] : null;
        if ($ownerId === null || $ownerId !== $usuarioId) {
            return 'forbidden';
        }

        $deleteStmt = $pdo->prepare(
            'DELETE FROM pins_culturais
             WHERE id = ? AND usuario_id = ?
             LIMIT 1'
        );
        $deleteStmt->execute([$pinId, $usuarioId]);

        if ($deleteStmt->rowCount() <= 0) {
            return 'not_found';
        }

        if (!empty($row['imagem_url'])) {
            self::deleteLocalImage((string) $row['imagem_url']);
        }

        return 'deleted';
    }

    public static function deleteLocalImage(string $relativePath): void
    {
        $normalized = ltrim(str_replace('\\', '/', $relativePath), '/');
        if (!str_starts_with($normalized, 'uploads/pins/')) {
            return;
        }

        $uploadsDir = realpath(__DIR__ . '/../../public/uploads/pins');
        $targetFile = realpath(__DIR__ . '/../../public/' . $normalized);
        if (
            $uploadsDir !== false &&
            $targetFile !== false &&
            str_starts_with($targetFile, $uploadsDir . DIRECTORY_SEPARATOR) &&
            is_file($targetFile)
        ) {
            @unlink($targetFile);
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private static function formatRow(array $row): array
    {
        $rawDate = (string) ($row['criadoEm'] ?? '');
        $timestamp = $rawDate !== '' ? strtotime($rawDate) : false;
        $rawImagePath = isset($row['imagem_url']) ? trim((string) $row['imagem_url']) : '';

        return [
            'id' => (int) $row['id'],
            'titulo' => (string) $row['titulo'],
            'descricao' => (string) $row['descricao'],
            'categoria' => (string) ($row['categoria'] ?? ''),
            'cidade' => (string) $row['cidade'],
            'estado' => (string) $row['estado'],
            'latitude' => (float) $row['latitude'],
            'longitude' => (float) $row['longitude'],
            'imagemUrl' => $rawImagePath !== '' ? url($rawImagePath) : null,
            'usuarioId' => isset($row['usuario_id']) ? (int) $row['usuario_id'] : null,
            'criadoEm' => $timestamp !== false ? date('c', $timestamp) : $rawDate,
        ];
    }

    private static function normalizeSingleLine(string $value): string
    {
        $cleaned = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value) ?? '';
        $collapsed = preg_replace('/\s+/u', ' ', $cleaned) ?? '';
        return trim($collapsed);
    }

    private static function normalizeMultiline(string $value): string
    {
        $normalizedBreaks = str_replace(["\r\n", "\r"], "\n", $value);
        $cleaned = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $normalizedBreaks) ?? '';
        return trim($cleaned);
    }
}

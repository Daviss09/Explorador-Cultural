<?php

namespace App\Models;

use PDO;

class User
{
    public static function all(): array
    {
        return Database::connect()
            ->query('SELECT id, nome, cidade FROM usuario ORDER BY nome')
            ->fetchAll();
    }

    public static function find(int $id): ?array
    {
        $stmt = Database::connect()->prepare(
            'SELECT id, nome, cidade FROM usuario WHERE id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function nomeExists(string $nome): bool
    {
        $stmt = Database::connect()->prepare('SELECT 1 FROM usuario WHERE nome = ?');
        $stmt->execute([$nome]);
        return (bool) $stmt->fetchColumn();
    }

    public static function findByNome(string $nome): ?array
    {
        $stmt = Database::connect()->prepare(
            'SELECT id, nome, cidade, senha FROM usuario WHERE nome = ?'
        );
        $stmt->execute([$nome]);
        return $stmt->fetch() ?: null;
    }

    public static function authenticate(string $nome, string $senha): ?array
    {
        $user = self::findByNome($nome);
        if (!$user) {
            return null;
        }

        if (password_verify($senha, $user['senha'])) {
            unset($user['senha']);
            return $user;
        }

        return null;
    }

    public static function create(string $nome, string $senha, ?string $endereco = null): int
    {
        $hash = password_hash($senha, PASSWORD_DEFAULT);
        $stmt = Database::connect()->prepare(
            'INSERT INTO usuario (nome, cidade, senha) VALUES (?, ?, ?)'
        );
        $stmt->execute([$nome, $endereco, $hash]);
        return (int) Database::connect()->lastInsertId();
    }
}

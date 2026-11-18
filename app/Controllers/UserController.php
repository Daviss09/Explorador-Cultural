<?php

declare(strict_types=1);

namespace App\Controllers;

class UserController
{
    public function index(): void
    {
        require __DIR__ . '/../Views/main.php';
    }

    public function cadastro(): void
    {
        require __DIR__ . '/../Views/cadastro.php';
    }

    public function create(): void
    {
        $this->cadastro();
    }

    public function store(): void
    {
        $this->cadastro();
    }

    public function login(): void
    {
        require __DIR__ . '/../Views/login.php';
    }

    public function logout(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        unset($_SESSION['user']);
        session_destroy();
        header('Location: ' . url());
        exit;
    }
}

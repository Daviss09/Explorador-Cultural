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
        require __DIR__ . '/../Views/layouts/cadastro.php';
    }

    public function create(): void
    {
        $this->cadastro();
    }

    public function store(): void
    {
        $this->cadastro();
    }
}

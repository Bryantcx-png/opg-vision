<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed.', 405);

$email    = trim(strtolower($_POST['email']    ?? ''));
$password =      $_POST['password'] ?? '';

if (!$email || !$password) jsonError('Email and password are required.');

$stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonError('Incorrect email or password.', 401);
}

$token = createJwt((int) $user['id'], $user['email']);
jsonOk([
    'access_token' => $token,
    'token_type'   => 'bearer',
    'user'         => [
        'id'    => (int) $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'plan'  => $user['plan'],
    ],
]);

<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed.', 405);

$name     = trim($_POST['name']     ?? '');
$email    = trim(strtolower($_POST['email']    ?? ''));
$password =      $_POST['password'] ?? '';

if (!$name)              jsonError('Name is required.');
if (!$email)             jsonError('Email is required.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Invalid email address.');
if (strlen($password) < 8) jsonError('Password must be at least 8 characters.');

$pdo = db();

$check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$check->execute([$email]);
if ($check->fetch()) jsonError('An account with this email already exists.', 409);

$hash = password_hash($password, PASSWORD_BCRYPT);
$ins  = $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
$ins->execute([$name, $email, $hash]);
$userId = (int) $pdo->lastInsertId();

$token = createJwt($userId, $email);
jsonOk([
    'access_token' => $token,
    'token_type'   => 'bearer',
    'user'         => ['id' => $userId, 'name' => $name, 'email' => $email, 'plan' => 'free'],
]);

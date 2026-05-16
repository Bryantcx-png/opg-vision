<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed.', 405);

$user = requireAuth();

$password = $_POST['password'] ?? '';
if (strlen($password) < 8) jsonError('Password must be at least 8 characters.');

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
$stmt->execute([$hash, (int) $user['id']]);

jsonOk(['ok' => true]);

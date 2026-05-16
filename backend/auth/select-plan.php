<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed.', 405);

$user = requireAuth();

$plan = trim($_POST['plan'] ?? '');
$allowed = ['starter', 'professional', 'enterprise'];

if (!in_array($plan, $allowed, true)) {
    jsonError('Invalid plan. Choose starter, professional, or enterprise.');
}

$stmt = db()->prepare('UPDATE users SET plan = ? WHERE id = ?');
$stmt->execute([$plan, (int) $user['id']]);

jsonOk([
    'ok'   => true,
    'plan' => $plan,
    'user' => [
        'id'    => (int) $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'plan'  => $plan,
    ],
]);

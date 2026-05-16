<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Method not allowed.', 405);

$user = requireAuth();

$stmt = db()->prepare('SELECT COUNT(*) FROM cases WHERE user_id = ?');
$stmt->execute([(int) $user['id']]);
$totalCases = (int) $stmt->fetchColumn();

jsonOk([
    'id'                   => (int) $user['id'],
    'name'                 => $user['name'],
    'email'                => $user['email'],
    'plan'                 => $user['plan'],
    'analyses_this_month'  => (int) $user['analyses_this_month'],
    'total_cases'          => $totalCases,
    'created_at'           => $user['created_at'],
]);

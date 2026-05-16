<?php
require_once __DIR__ . '/config.php';

// ── CORS ──────────────────────────────────────────────────
function cors(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ── JSON responses ────────────────────────────────────────
function jsonOk(array $data): void {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['detail' => $message]);
    exit;
}

// ── Database (singleton PDO) ──────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        jsonError('Database connection failed. Check XAMPP MySQL is running.', 500);
    }
}

// ── JWT (HS256 — no Composer needed) ─────────────────────
function b64urlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64urlDecode(string $data): string {
    $rem = strlen($data) % 4;
    if ($rem) $data .= str_repeat('=', 4 - $rem);
    return base64_decode(strtr($data, '-_', '+/'));
}

function createJwt(int $userId, string $email): string {
    $header  = b64urlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = b64urlEncode(json_encode([
        'sub'   => (string) $userId,
        'email' => $email,
        'iat'   => time(),
        'exp'   => time() + JWT_EXPIRE,
    ]));
    $sig = b64urlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function verifyJwt(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = b64urlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(b64urlDecode($payload), true);
    if (!$data || empty($data['exp']) || $data['exp'] < time()) return null;
    return $data;
}

// ── Auth guard ────────────────────────────────────────────
function getAuthHeader(): string {
    // Apache often strips Authorization before PHP sees it.
    // Check all the places it might end up.
    if (!empty($_SERVER['HTTP_AUTHORIZATION']))          return $_SERVER['HTTP_AUTHORIZATION'];
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if (function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strtolower($k) === 'authorization') return $v;
        }
    }
    return '';
}

function requireAuth(): array {
    $header = getAuthHeader();
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        jsonError('Missing or invalid Authorization header.', 401);
    }
    $payload = verifyJwt($m[1]);
    if (!$payload) jsonError('Invalid or expired token. Please log in again.', 401);

    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([(int) $payload['sub']]);
    $user = $stmt->fetch();
    if (!$user) jsonError('User not found.', 401);
    return $user;
}

// ── Report ID ─────────────────────────────────────────────
function generateReportId(): string {
    return 'OPG-' . date('Ymd') . '-' . str_pad(mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);
}

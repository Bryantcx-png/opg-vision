<?php
// ── Database (XAMPP defaults) ──────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'opgvision');
define('DB_USER', 'root');
define('DB_PASS', '');          // XAMPP default: empty password

// ── JWT ───────────────────────────────────────────────────
define('JWT_SECRET',  'opg-vision-xampp-secret-CHANGE-IN-PRODUCTION');
define('JWT_EXPIRE',  86400);   // 24 hours in seconds

// ── Plan limits (null = unlimited) ───────────────────────
// No free tier — all registered users get Starter access (100/mo)
// Professional and Enterprise are unlimited
define('PLAN_LIMITS', ['free' => 100, 'starter' => 100, 'pro' => null, 'professional' => null, 'enterprise' => null]);

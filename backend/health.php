<?php
require_once __DIR__ . '/helpers.php';
cors();
jsonOk(['status' => 'ok', 'service' => 'OPG Vision API', 'version' => '2.0', 'runtime' => 'PHP ' . PHP_VERSION]);

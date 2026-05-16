<?php
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Method not allowed.', 405);

$user = requireAuth();

// Single case lookup — GET /api/cases?report_id=XXX
if (isset($_GET['report_id'])) {
    $stmt = db()->prepare(
        'SELECT report_id, case_id, reference_no, officer_name, gender, notes,
                estimated_age, confidence_margin, age_lower, age_upper,
                classification, classification_confidence, is_borderline,
                borderline_warning, model_version, timestamp, created_at
         FROM cases
         WHERE report_id = ? AND user_id = ?'
    );
    $stmt->execute([trim($_GET['report_id']), (int) $user['id']]);
    $case = $stmt->fetch();
    if (!$case) jsonError('Case not found.', 404);
    $case['estimated_age']     = $case['estimated_age']     !== null ? (float) $case['estimated_age']     : null;
    $case['confidence_margin'] = $case['confidence_margin'] !== null ? (float) $case['confidence_margin'] : null;
    $case['age_lower']         = $case['age_lower']         !== null ? (float) $case['age_lower']         : null;
    $case['age_upper']         = $case['age_upper']         !== null ? (float) $case['age_upper']         : null;
    $case['is_borderline']     = (bool) $case['is_borderline'];
    jsonOk($case);
}

$stmt = db()->prepare(
    'SELECT report_id, case_id, reference_no, officer_name, gender,
            estimated_age, classification, is_borderline, timestamp, created_at
     FROM cases
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50'
);
$stmt->execute([(int) $user['id']]);
$cases = $stmt->fetchAll();

// Cast types for JSON output
foreach ($cases as &$c) {
    $c['estimated_age'] = $c['estimated_age'] !== null ? (float) $c['estimated_age'] : null;
    $c['is_borderline'] = (bool) $c['is_borderline'];
}

jsonOk($cases);

<?php
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../mock_model.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed.', 405);

$user = requireAuth();

// Plan limit check
$limits = PLAN_LIMITS;
$limit  = $limits[$user['plan']] ?? 10;
if ($limit !== null && (int) $user['analyses_this_month'] >= $limit) {
    jsonError(
        "Monthly limit of $limit analyses reached on your " . ucfirst($user['plan']) .
        " plan. Please upgrade to continue.",
        429
    );
}

// Required fields
$caseId      = trim($_POST['case_id']      ?? '');
$referenceNo = trim($_POST['reference_no'] ?? '');
$officerName = trim($_POST['officer_name'] ?? '');
$gender      = trim($_POST['gender']       ?? '');
$notes       = trim($_POST['notes']        ?? '');
$demo        = strtolower(trim($_POST['demo'] ?? 'false'));

if (!$caseId)      jsonError('Missing required field: case_id.');
if (!$referenceNo) jsonError('Missing required field: reference_no.');
if (!$officerName) jsonError('Missing required field: officer_name.');
if (!$gender)      jsonError('Missing required field: gender.');

// File validation
if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    jsonError('Image upload failed or missing.');
}

$file     = $_FILES['image'];
$allowed  = ['image/jpeg', 'image/png', 'image/jpg'];
$mimeType = mime_content_type($file['tmp_name']);
$isDcm    = strtolower(substr($file['name'], -4)) === '.dcm';

if (!in_array($mimeType, $allowed, true) && !$isDcm) {
    jsonError('Please upload a JPG, PNG, or DCM file.', 415);
}

if ($file['size'] > 10 * 1024 * 1024) {
    jsonError('File too large. Maximum size is 10MB.', 413);
}

// Run inference
$result   = ($demo === 'true') ? runDemoInference() : runMockInference($gender);
$reportId = generateReportId();

// Save case to DB
$pdo  = db();
$stmt = $pdo->prepare(
    'INSERT INTO cases
       (user_id, report_id, case_id, reference_no, officer_name, gender, notes,
        estimated_age, confidence_margin, age_lower, age_upper,
        classification, classification_confidence, is_borderline, borderline_warning,
        model_version, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    (int) $user['id'],
    $reportId,
    $caseId,
    $referenceNo,
    $officerName,
    $gender,
    $notes,
    $result['estimated_age'],
    $result['confidence_margin'],
    $result['age_lower'],
    $result['age_upper'],
    $result['classification'],
    $result['classification_confidence'],
    $result['is_borderline'] ? 1 : 0,
    $result['borderline_warning'],
    $result['model_version'],
    $result['timestamp'],
]);

// Increment monthly usage
$pdo->prepare('UPDATE users SET analyses_this_month = analyses_this_month + 1 WHERE id = ?')
    ->execute([(int) $user['id']]);

jsonOk(array_merge([
    'report_id'    => $reportId,
    'case_id'      => $caseId,
    'reference_no' => $referenceNo,
    'officer_name' => $officerName,
    'gender'       => $gender,
    'notes'        => $notes,
], $result));

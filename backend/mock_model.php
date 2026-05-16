<?php
function runMockInference(string $gender): array {
    $baseAge    = round(mt_rand(140, 550) / 10, 1);
    $confidence = round(mt_rand(15, 28)  / 10, 1);
    $lower      = round($baseAge - $confidence, 1);
    $upper      = round($baseAge + $confidence, 1);

    if ($baseAge < 17.0) {
        $classification = 'MINOR';
        $isBorderline   = false;
        $warning        = null;
    } elseif ($baseAge <= 19.0) {
        $classification = 'BORDERLINE';
        $isBorderline   = true;
        $warning        = 'Age estimate is within margin of error of the legal threshold (18 years). '
                        . 'Manual specialist review is strongly recommended before legal proceedings.';
    } else {
        $classification = 'ADULT';
        $isBorderline   = false;
        $warning        = null;
    }

    $confidenceLevel = $confidence < 2.0 ? 'High' : ($confidence < 2.5 ? 'Medium' : 'Low');

    return [
        'estimated_age'            => $baseAge,
        'confidence_margin'        => $confidence,
        'age_lower'                => $lower,
        'age_upper'                => $upper,
        'classification'           => $classification,
        'classification_confidence'=> $confidenceLevel,
        'is_borderline'            => $isBorderline,
        'borderline_warning'       => $warning,
        'processing_time_ms'       => mt_rand(1500, 3000),
        'model_version'            => 'ResNeXt-50 v1.0 (mock)',
        'timestamp'                => gmdate('Y-m-d\TH:i:s\Z'),
    ];
}

function runDemoInference(): array {
    return [
        'estimated_age'            => 16.8,
        'confidence_margin'        => 1.9,
        'age_lower'                => 14.9,
        'age_upper'                => 18.7,
        'classification'           => 'BORDERLINE',
        'classification_confidence'=> 'Medium',
        'is_borderline'            => true,
        'borderline_warning'       => 'Age estimate is within margin of error of the legal threshold (18 years). '
                                   . 'Manual specialist review is strongly recommended before legal proceedings.',
        'processing_time_ms'       => 2134,
        'model_version'            => 'ResNeXt-50 v1.0 (mock)',
        'timestamp'                => gmdate('Y-m-d\TH:i:s\Z'),
    ];
}

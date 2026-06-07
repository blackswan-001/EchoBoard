<?php
// api/summary.php — Returns aggregate stats as JSON

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../db/connection.php';

$db = get_db();

$totals = $db->query("
    SELECT
        COUNT(*)                                        AS total_count,
        ROUND(AVG(rating), 2)                           AS avg_rating,
        SUM(CASE WHEN sentiment='positive' THEN 1 END)  AS positive,
        SUM(CASE WHEN sentiment='neutral'  THEN 1 END)  AS neutral,
        SUM(CASE WHEN sentiment='negative' THEN 1 END)  AS negative
    FROM feedback
")->fetch();

$by_category = $db->query("
    SELECT category, COUNT(*) as count, ROUND(AVG(rating),2) as avg_rating
    FROM feedback GROUP BY category ORDER BY count DESC
")->fetchAll();

$by_rating = $db->query("
    SELECT rating, COUNT(*) as count FROM feedback GROUP BY rating ORDER BY rating
")->fetchAll();

$recent = $db->query("
    SELECT id, name, category, rating, sentiment, created_at
    FROM feedback ORDER BY created_at DESC LIMIT 5
")->fetchAll();

echo json_encode([
    'generated_at'  => date('c'),
    'totals'        => $totals,
    'by_category'   => $by_category,
    'by_rating'     => $by_rating,
    'recent'        => $recent,
]);

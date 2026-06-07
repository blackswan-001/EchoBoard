<?php
// api/list.php — Returns paginated feedback as JSON

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../db/connection.php';

$db      = get_db();
$limit   = min((int)($_GET['limit']  ?? 20), 100);
$offset  = max((int)($_GET['offset'] ?? 0), 0);
$cat     = $_GET['category'] ?? '';
$sort    = in_array($_GET['sort'] ?? '', ['asc', 'desc']) ? strtoupper($_GET['sort']) : 'DESC';

$where = $cat ? 'WHERE category = :cat' : '';
$params = $cat ? [':cat' => $cat] : [];

$total = $db->prepare("SELECT COUNT(*) as c FROM feedback $where");
$total->execute($params);
$count = (int)$total->fetch()['c'];

$stmt = $db->prepare("SELECT * FROM feedback $where ORDER BY created_at $sort LIMIT :lim OFFSET :off");
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
$stmt->bindValue(':lim',  $limit,  PDO::PARAM_INT);
$stmt->bindValue(':off',  $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

echo json_encode([
    'total'    => $count,
    'limit'    => $limit,
    'offset'   => $offset,
    'feedback' => $rows,
]);

<?php
// api/submit.php — Accepts POST, stores feedback, returns JSON

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../db/connection.php';

$body = json_decode(file_get_contents('php://input'), true) ?? [];

// Merge JSON body with form-encoded body
$input = array_merge($_POST, $body);

$name     = trim($input['name']     ?? '');
$email    = trim($input['email']    ?? '');
$category = trim($input['category'] ?? 'General');
$rating   = (int)($input['rating']  ?? 0);
$message  = trim($input['message']  ?? '');

// Validate
$errors = [];
if ($name    === '') $errors[] = 'Name is required.';
if ($rating < 1 || $rating > 5) $errors[] = 'Rating must be between 1 and 5.';
if ($message === '') $errors[] = 'Message is required.';

if ($errors) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

$allowed_categories = ['General', 'Product', 'Support', 'Billing', 'Other'];
if (!in_array($category, $allowed_categories)) $category = 'General';

$db   = get_db();
$stmt = $db->prepare('INSERT INTO feedback (name, email, category, rating, message) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$name, $email ?: null, $category, $rating, $message]);
$id = $db->lastInsertId();

// Return the newly created record
$row = $db->query("SELECT * FROM feedback WHERE id = $id")->fetch();

echo json_encode(['success' => true, 'feedback' => $row]);

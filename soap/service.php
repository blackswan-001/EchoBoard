<?php
// soap/service.php — Minimal SOAP-style XML Web Service
// Accepts SOAP envelope or plain GET ?method= for testing

header('Content-Type: text/xml; charset=utf-8');
require_once __DIR__ . '/../db/connection.php';

// ── Helper: wrap in SOAP envelope ───────────────────────────────────────────
function soap_envelope(string $body): string {
    return '<?xml version="1.0" encoding="UTF-8"?>' . "\n" .
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:echo="http://echoboard.local/soap">' . "\n" .
    "  <soapenv:Body>\n" . $body . "\n  </soapenv:Body>\n" .
    '</soapenv:Envelope>';
}

function soap_fault(string $code, string $message): string {
    return soap_envelope("    <soapenv:Fault>
      <faultcode>$code</faultcode>
      <faultstring>" . htmlspecialchars($message) . "</faultstring>
    </soapenv:Fault>");
}

// ── Parse method from SOAP body or GET ─────────────────────────────────────
$method = $_GET['method'] ?? null;

if (!$method && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if (preg_match('/<echo:(\w+)/', $raw, $m)) {
        $method = $m[1];
    }
}

if (!$method) {
    echo soap_fault('Client', 'No method specified. Use ?method=GetSummary | GetFeedbackList | GetCategorySummary');
    exit;
}

$db = get_db();

// ── Methods ─────────────────────────────────────────────────────────────────
switch ($method) {

    // --- GetSummary: overall aggregate stats --------------------------------
    case 'GetSummary':
        $s = $db->query("
            SELECT COUNT(*) as total,
                   ROUND(AVG(rating),2) as avg_rating,
                   SUM(CASE WHEN sentiment='positive' THEN 1 END) as positive,
                   SUM(CASE WHEN sentiment='neutral'  THEN 1 END) as neutral,
                   SUM(CASE WHEN sentiment='negative' THEN 1 END) as negative
            FROM feedback
        ")->fetch();

        $xml = "    <echo:GetSummaryResponse>
      <summary>
        <totalFeedback>{$s['total']}</totalFeedback>
        <averageRating>{$s['avg_rating']}</averageRating>
        <positiveCount>{$s['positive']}</positiveCount>
        <neutralCount>{$s['neutral']}</neutralCount>
        <negativeCount>{$s['negative']}</negativeCount>
        <generatedAt>" . date('c') . "</generatedAt>
      </summary>
    </echo:GetSummaryResponse>";
        echo soap_envelope($xml);
        break;

    // --- GetFeedbackList: recent entries ------------------------------------
    case 'GetFeedbackList':
        $limit = min((int)($_GET['limit'] ?? 10), 50);
        $rows  = $db->query("SELECT id,name,category,rating,sentiment,message,created_at FROM feedback ORDER BY created_at DESC LIMIT $limit")->fetchAll();

        $items = '';
        foreach ($rows as $r) {
            $items .= "        <item>
          <id>{$r['id']}</id>
          <name>" . htmlspecialchars($r['name']) . "</name>
          <category>" . htmlspecialchars($r['category']) . "</category>
          <rating>{$r['rating']}</rating>
          <sentiment>{$r['sentiment']}</sentiment>
          <message>" . htmlspecialchars($r['message']) . "</message>
          <createdAt>{$r['created_at']}</createdAt>
        </item>\n";
        }

        $xml = "    <echo:GetFeedbackListResponse>\n      <feedbackList>\n$items      </feedbackList>\n    </echo:GetFeedbackListResponse>";
        echo soap_envelope($xml);
        break;

    // --- GetCategorySummary: per-category breakdown -------------------------
    case 'GetCategorySummary':
        $rows = $db->query("
            SELECT category, COUNT(*) as count, ROUND(AVG(rating),2) as avg_rating,
                   SUM(CASE WHEN sentiment='positive' THEN 1 END) as positive,
                   SUM(CASE WHEN sentiment='negative' THEN 1 END) as negative
            FROM feedback GROUP BY category ORDER BY count DESC
        ")->fetchAll();

        $cats = '';
        foreach ($rows as $r) {
            $cats .= "        <category>
          <name>" . htmlspecialchars($r['category']) . "</name>
          <count>{$r['count']}</count>
          <avgRating>{$r['avg_rating']}</avgRating>
          <positive>{$r['positive']}</positive>
          <negative>{$r['negative']}</negative>
        </category>\n";
        }

        $xml = "    <echo:GetCategorySummaryResponse>\n      <categories>\n$cats      </categories>\n    </echo:GetCategorySummaryResponse>";
        echo soap_envelope($xml);
        break;

    default:
        echo soap_fault('Client', "Unknown method: $method");
}

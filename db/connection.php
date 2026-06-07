<?php
// db/connection.php — SQLite connection helper

define('DB_PATH', __DIR__ . '/echoboard.sqlite');

function get_db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        // Init schema if fresh DB
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")->fetch();
        if (!$tables) 
        {
                $pdo->exec(file_get_contents(__DIR__ . '/init.sql'));
        }
    }
    return $pdo;
}

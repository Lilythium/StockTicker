<?php
/**
 * Session Clearing Tool
 * Use this to reset your session when debugging
 */
session_start();

$sessionData = $_SESSION;

if (isset($_GET['confirm']) && $_GET['confirm'] === 'yes') {
    session_destroy();
    $cleared = true;
} else {
    $cleared = false;
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Clear Session</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #2c3e50;
            color: white;
            padding: 40px;
            text-align: center;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #34495e;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        }
        h1 {
            color: #3498db;
        }
        .session-data {
            background: #1e1e1e;
            color: #0f0;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
            font-family: monospace;
            max-height: 300px;
            overflow-y: auto;
        }
        .btn {
            display: inline-block;
            padding: 15px 30px;
            margin: 10px;
            border-radius: 5px;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.3s;
        }
        .btn-danger {
            background: #e74c3c;
            color: white;
        }
        .btn-danger:hover {
            background: #c0392b;
        }
        .btn-primary {
            background: #3498db;
            color: white;
        }
        .btn-primary:hover {
            background: #2980b9;
        }
        .success {
            background: #2ecc71;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Session Management</h1>
        
        <?php if ($cleared): ?>
            <div class="success">
                <h2>✅ Session Cleared!</h2>
                <p>Your session has been destroyed. You can now start fresh.</p>
            </div>
            <a href="public/index.php" class="btn btn-primary">Go to Lobby</a>
        <?php else: ?>
            <h2>Current Session Data:</h2>
            
            <?php if (empty($sessionData)): ?>
                <div class="session-data">
                    <p>No active session</p>
                </div>
            <?php else: ?>
                <div class="session-data">
                    <pre><?php print_r($sessionData); ?></pre>
                </div>
            <?php endif; ?>
            
            <h3>What would you like to do?</h3>
            
            <a href="?confirm=yes" class="btn btn-danger">Clear Session</a>
            <a href="public/index.php" class="btn btn-primary">Back to Lobby</a>
            
            <p style="margin-top: 30px; color: #95a5a6; font-size: 14px;">
                Clearing your session will log you out of any active games<br>
                and reset all session data.
            </p>
        <?php endif; ?>
    </div>
</body>
</html>

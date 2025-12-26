<?php
/**
 * Main Configuration File
 * Place this in your project root directory
 */

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Game Engine Connection Settings
const GAME_ENGINE_HOST = '127.0.0.1';
const GAME_ENGINE_PORT = 9999;
const GAME_ENGINE_TIMEOUT = 5;

// Game Settings
const DEFAULT_GAME_ID = 'default_game';
const MAX_PLAYERS = 4;
const MIN_PLAYERS_TO_START = 2;

// Session Settings
const SESSION_TIMEOUT = 3600; // 1 hour in seconds

// Debug Mode
const DEBUG_MODE = true; // Set to false in production

// Error Display (for development only)
if (DEBUG_MODE) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
}
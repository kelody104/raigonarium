<?php
// sheet-proxy.php (FULL REPLACE)

ini_set('display_errors', '0');
error_reporting(E_ALL);
require_once __DIR__ . '/config.php';
$API_TOKEN = GAS_API_TOKEN;

// ===== CORS =====
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allow = ['http://localhost:4200', 'https://mitarashi.link'];

if (in_array($origin, $allow, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header('Vary: Origin');
} else {
  header("Access-Control-Allow-Origin: *");
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

// ★GAS WebアプリURL（/execまで） ※本番は /exec 推奨
$GAS_URL = 'https://script.google.com/macros/s/AKfycbxjt77yQ98yQROYKeA2aYK8X5hWKQjdkPhDi0RLbtf0dPjb3uwLM3jLB0d7U0_A-WjR1A/exec';
//$GAS_URL = 'https://script.google.com/macros/s/AKfycbyGKRaz1BIXUXH--l9BFC_BFhfVIH2NhZXr8Pe1HQwt0jIFIz8MECfOJe8_-go42uetkg/dev';

// ★許可するリダイレクト先（SSRF対策）
$ALLOW_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

// ★proxyが持つトークン（ロリポップ想定：config.phpで管理）
if (!defined('GAS_API_TOKEN') || GAS_API_TOKEN === '') {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'proxy token is not configured',
    'hint' => 'Set GAS_API_TOKEN in config.php',
  ], JSON_UNESCAPED_UNICODE);
  exit;
}
$API_TOKEN = GAS_API_TOKEN;

/**
 * JSONっぽいかの判定（Content-Type優先、ダメなら先頭文字で推測）
 */
function looks_like_json($contentType, $body) {
  $ct = strtolower(trim((string)$contentType));
  if ($ct !== '' && str_contains($ct, 'application/json')) return true;

  $trim = ltrim((string)$body);
  if ($trim === '') return true; // 空はJSON扱い（上流のバグでもここでは通す）
  $c = $trim[0];
  return ($c === '{' || $c === '[');
}

/**
 * proxy core
 * - リダイレクトは自前追跡（最大 $maxHop）
 * - 上流がHTMLを返しても 502 にはしない（ok:false JSONで返す）
 */
function proxy_request($method, $url, $body, $ALLOW_HOSTS) {
  $maxHop = 5;

  $m = strtoupper($method);
  $b = $body;

  for ($i = 0; $i < $maxHop; $i++) {
    $respHeaders = [];
    $ch = curl_init($url);

    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_FOLLOWLOCATION => false, // 自前で追う
      CURLOPT_TIMEOUT => 60,
      CURLOPT_CONNECTTIMEOUT => 10,
      CURLOPT_HTTPHEADER => [
        'Accept: application/json',
        'Content-Type: application/json; charset=utf-8',
        'User-Agent: mitarashi-proxy/1.2',
      ],
      CURLOPT_HEADERFUNCTION => function($ch, $headerLine) use (&$respHeaders) {
        $len = strlen($headerLine);
        $parts = explode(':', $headerLine, 2);
        if (count($parts) === 2) {
          $name = strtolower(trim($parts[0]));
          $value = trim($parts[1]);
          $respHeaders[$name] = $value;
        }
        return $len;
      },
    ]);

    if ($m === 'POST') {
      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $b ?? '');
    } else {
      curl_setopt($ch, CURLOPT_HTTPGET, true);
    }

    $res = curl_exec($ch);
    if ($res === false) {
      $err = curl_error($ch);
      $eno = curl_errno($ch);
      curl_close($ch);

      return [502, json_encode([
        'ok' => false,
        'error' => 'proxy curl failed',
        'errno' => $eno,
        'message' => $err,
      ], JSON_UNESCAPED_UNICODE)];
    }

    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // --- redirect handling ---
    if (in_array($code, [301, 302, 303, 307, 308], true) && isset($respHeaders['location'])) {
      $loc = $respHeaders['location'];

      if (strpos($loc, 'http') !== 0) {
        $p = parse_url($url);
        $scheme = $p['scheme'] ?? 'https';
        $host   = $p['host'] ?? '';
        $loc = $scheme . '://' . $host . $loc;
      }

      $host = parse_url($loc, PHP_URL_HOST) ?? '';
      if (!in_array($host, $ALLOW_HOSTS, true)) {
        return [200, json_encode([
          'ok' => false,
          'error' => 'redirected to disallowed host',
          'httpCode' => $code,
          'location' => $loc,
        ], JSON_UNESCAPED_UNICODE)];
      }

      if ($m === 'POST' && in_array($code, [301, 302, 303], true)) {
        $m = 'GET';
        $b = null;
      }

      $url = $loc;
      continue;
    }

    // --- content-type/json check ---
    $ct = $respHeaders['content-type'] ?? '';

    if (!looks_like_json($ct, $res)) {
      $trim = ltrim($res);
      return [200, json_encode([
        'ok' => false,
        'error' => 'non-JSON response from upstream',
        'httpCode' => $code ?: 0,
        'contentType' => (string)$ct,
        'location' => $respHeaders['location'] ?? '',
        'head' => mb_substr($trim, 0, 400),
      ], JSON_UNESCAPED_UNICODE)];
    }

    return [$code ?: 200, $res];
  }

  return [200, json_encode([
    'ok' => false,
    'error' => 'redirect loop',
  ], JSON_UNESCAPED_UNICODE)];
}

// ===== dispatch =====
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ★ここが肝：query をパースして token を強制付与（クライアントtokenは無視）
$qs = $_SERVER['QUERY_STRING'] ?? '';
$params = [];
if ($qs !== '') {
  parse_str($qs, $params);
}
// 改ざん防止：クライアントから token が来ても捨てる（上書き）
$params['token'] = $API_TOKEN;

// クエリ再構築
$qs2 = http_build_query($params);
$url = $GAS_URL . ($qs2 ? ('?' . $qs2) : '');

if ($method === 'GET') {
  [$code, $res] = proxy_request('GET', $url, null, $ALLOW_HOSTS);
  http_response_code($code);
  echo $res;
  exit;
}

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  [$code, $res] = proxy_request('POST', $url, $raw, $ALLOW_HOSTS);
  http_response_code($code);
  echo $res;
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);

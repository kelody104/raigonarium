<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

// ★GAS WebアプリURL（/execまで）
$GAS_URL = 'https://script.google.com/macros/s/AKfycbxfwssT5BQsGp2beaXmmIRxZtRASEJmj1zDkM1it9rYtRhuUVlT6F139UUWqWKlmd9bvg/exec';

function proxy_request($method, $url, $body = null) {
  $max = 5;
  $lastHeaders = [];

  // ★追加：リダイレクトでメソッドを変えるため可変コピー
  $m = strtoupper($method);
  $b = $body;

  for ($i = 0; $i < $max; $i++) {
    $lastHeaders = [];
    $ch = curl_init($url);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false); // ★自前で追う
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);

curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Accept: application/json',
  'Content-Type: application/json; charset=utf-8',
  'User-Agent: mitarashi-proxy/1.0'
]);

    curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($ch, $header) use (&$lastHeaders) {
      $len = strlen($header);
      $parts = explode(':', $header, 2);
      if (count($parts) === 2) {
        $name = strtolower(trim($parts[0]));
        $value = trim($parts[1]);
        $lastHeaders[$name] = $value;
      }
      return $len;
    });

    if ($m === 'POST') {
      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $b ?? '');
    }

    $res = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($res === false) {
      return [502, json_encode(["ok"=>false,"error"=>"proxy curl failed","detail"=>$err], JSON_UNESCAPED_UNICODE)];
    }

 // リダイレクトなら Location を追う
    // リダイレクトなら Location を追う
    if (in_array($code, [301,302,303,307,308], true) && isset($lastHeaders['location'])) {
      $loc = $lastHeaders['location'];

      // 相対Location対策
      if (strpos($loc, 'http') !== 0) {
        $p = parse_url($url);
        $scheme = $p['scheme'] ?? 'https';
        $host   = $p['host'] ?? '';
        $loc = $scheme . '://' . $host . $loc;
      }

      // ★SSRF対策：Google Apps Script のみ許可
      $host = parse_url($loc, PHP_URL_HOST) ?? '';
      $allowHosts = ['script.google.com', 'script.googleusercontent.com'];
      if (!in_array($host, $allowHosts, true)) {
        return [502, json_encode([
          "ok"=>false,
          "error"=>"redirected to disallowed host",
          "httpCode"=>$code,
          "location"=>$loc
        ], JSON_UNESCAPED_UNICODE)];
      }

      // ★ここが肝：POSTで 301/302/303 が来たら GET に落とす（ブラウザ挙動）
      if ($m === 'POST' && in_array($code, [301,302,303], true)) {
        $m = 'GET';
        $b = null;
      }

      $url = $loc;
      continue;
    }

    // HTMLが返ってきたら原因をJSON化（Drive/ログイン誘導など）
    $trim = ltrim($res);
    if ($trim !== '' && $trim[0] === '<') {
      return [502, json_encode([
        "ok"=>false,
        "error"=>"non-JSON response from upstream",
        "httpCode"=>$code,
        "location"=>$lastHeaders['location'] ?? '',
        "head"=>mb_substr($trim, 0, 200)
      ], JSON_UNESCAPED_UNICODE)];
    }

    return [$code ?: 200, $res];
  }

  return [502, json_encode(["ok"=>false,"error"=>"redirect loop"], JSON_UNESCAPED_UNICODE)];
}

$method = $_SERVER['REQUEST_METHOD'];
$qs = $_SERVER['QUERY_STRING'] ?? '';
$url = $GAS_URL . ($qs ? ('?' . $qs) : '');

if ($method === 'GET') {
  [$code, $res] = proxy_request('GET', $url, null);
  http_response_code($code);
  echo $res;
  exit;
}

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  [$code, $res] = proxy_request('POST', $url, $raw);
  http_response_code($code);
  echo $res;
  exit;
}

http_response_code(405);
echo json_encode(["ok"=>false,"error"=>"Method not allowed"], JSON_UNESCAPED_UNICODE);

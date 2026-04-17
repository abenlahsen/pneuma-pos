<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Sanctum\Sanctum;

$logFile = __DIR__ . '/verify_endpoints_internal.log';
file_put_contents($logFile, '');

$writeLog = function (string $line) use ($logFile): void {
    file_put_contents($logFile, $line . PHP_EOL, FILE_APPEND);
};

$user = User::where('email', 'admin@pneuma.pos')->first() ?? User::first();

if (! $user) {
    $writeLog('NO_USER');
    fwrite(STDOUT, "NO_USER\n");
    exit(1);
}

Sanctum::actingAs($user);

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$endpoints = [
    'brands',
    'accounts',
    'roles',
    'permissions',
    'users',
    'products',
    'purchases',
    'sales',
    'transactions',
    'stocks',
    'stock-movements',
];

foreach ($endpoints as $endpoint) {
    $request = Request::create('/api/' . $endpoint . '?per_page=2', 'GET', [], [], [], [
        'HTTP_ACCEPT' => 'application/json',
    ]);

    $response = $kernel->handle($request);
    $status = $response->getStatusCode();
    $decoded = json_decode($response->getContent(), true);

    if ($status !== 200) {
        $writeLog("ERROR {$endpoint} status={$status}");
        $writeLog($response->getContent());
        echo "ERROR {$endpoint} status={$status}\n";
        echo $response->getContent() . "\n";
        $kernel->terminate($request, $response);
        continue;
    }

    $requiredKeys = ['current_page', 'data', 'last_page', 'per_page', 'total'];
    $keys = is_array($decoded) ? array_keys($decoded) : [];
    $missing = array_values(array_diff($requiredKeys, $keys));
    $dataIsArray = is_array($decoded['data'] ?? null);

    if (empty($missing) && $dataIsArray) {
        $count = count($decoded['data']);
        $line = "PASS {$endpoint} keys=" . implode(',', $keys) . " count={$count}";
        $writeLog($line);
        echo $line . "\n";
    } else {
        $line = "FAIL {$endpoint} missing=" . implode(',', $missing) . " dataArray=" . ($dataIsArray ? 'true' : 'false') . " keys=" . implode(',', $keys);
        $writeLog($line);
        echo $line . "\n";
    }

    $kernel->terminate($request, $response);
}

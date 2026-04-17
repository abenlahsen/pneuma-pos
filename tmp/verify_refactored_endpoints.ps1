$baseUrl = "http://localhost:8888/api"
$email = "admin@pneuma.pos"
$password = "admin123456"

$loginBody = @{
  email = $email
  password = $password
} | ConvertTo-Json

try {
  $loginResponse = Invoke-RestMethod -Uri "$baseUrl/login" -Method Post -ContentType "application/json" -Body $loginBody
} catch {
  Write-Host "LOGIN_FAILED"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    Write-Host $reader.ReadToEnd()
  } else {
    Write-Host $_
  }
  exit 1
}

$token = $loginResponse.token
if (-not $token) {
  Write-Host "TOKEN_MISSING"
  $loginResponse | ConvertTo-Json -Depth 10
  exit 1
}

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/json"
}

$endpoints = @(
  "brands",
  "accounts",
  "roles",
  "permissions",
  "users",
  "products",
  "purchases",
  "sales",
  "transactions",
  "stocks",
  "stock-movements"
)

foreach ($endpoint in $endpoints) {
  try {
    $response = Invoke-RestMethod -Uri "$baseUrl/$endpoint?per_page=2" -Headers $headers -Method Get
    $keys = @($response.PSObject.Properties.Name)
    $requiredKeys = @("current_page","data","last_page","per_page","total")
    $missing = @($requiredKeys | Where-Object { $_ -notin $keys })
    $isDataArray = $response.data -is [System.Array]
    if ($missing.Count -eq 0 -and $isDataArray) {
      Write-Host "PASS $endpoint keys=$($keys -join ',') count=$($response.data.Count)"
    } else {
      Write-Host "FAIL $endpoint missing=$($missing -join ',') dataArray=$isDataArray keys=$($keys -join ',')"
    }
  } catch {
    Write-Host "ERROR $endpoint"
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $reader.BaseStream.Position = 0
      $reader.DiscardBufferedData()
      Write-Host $reader.ReadToEnd()
    } else {
      Write-Host $_
    }
  }
}

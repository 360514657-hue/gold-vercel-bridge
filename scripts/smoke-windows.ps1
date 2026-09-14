$ErrorActionPreference='Stop'
$paths=@{quote='/quote?code=XAUUSD';m5='/bars?code=XAUUSD&tf=M5&count=30';m15='/bars?code=XAUUSD&tf=M15&count=20';calendar='/calendar';gold='/flash?keyword=%E9%BB%84%E9%87%91';fed='/flash?keyword=%E7%BE%8E%E8%81%94%E5%82%A8'}
$payload=@{}
foreach($k in $paths.Keys){try{$payload[$k]=Invoke-RestMethod -Uri ('https://gold.360514657.workers.dev'+$paths[$k]) -TimeoutSec 10}catch{$payload[$k]=$null}}
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$payload|ConvertTo-Json -Depth 50 -Compress|node (Join-Path $PSScriptRoot 'smoke-normalized.js')

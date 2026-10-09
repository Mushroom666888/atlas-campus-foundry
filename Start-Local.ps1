Push-Location $PSScriptRoot
try {
  if (-not (Test-Path -LiteralPath 'node_modules')) { npm.cmd ci; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
  npm.cmd run dev
} finally { Pop-Location }

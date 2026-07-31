#!/usr/bin/env pwsh
# SSH password helper for non-interactive deployment
# Usage: .\deploy\ssh-auth.ps1 <command>

param(
  [Parameter(Mandatory)]$Command
)

$password = "Safari@2024"  # stored securely in .env or vault
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$password`n"))
$env:LC_SSH_PASSWORD = $password
ssh root@192.168.18.50 $Command

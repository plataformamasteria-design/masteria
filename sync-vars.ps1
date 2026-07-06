$env:RAILWAY_TOKEN = "41cc25ca-977d-467d-aab7-5427da65009f"
$envFile = Get-Content -Path ".env.local"

foreach ($line in $envFile) {
    # Skip empty lines and comments
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
        continue
    }

    # Split by first '='
    $splitIndex = $line.IndexOf("=")
    if ($splitIndex -gt 0) {
        $key = $line.Substring(0, $splitIndex).Trim()
        $value = $line.Substring($splitIndex + 1).Trim()

        # Remove surrounding quotes if they exist
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        # Skip RAILWAY_ internal variables to avoid overwriting the new project's config
        if ($key.StartsWith("RAILWAY_")) {
            continue
        }

        # Skip NEXT_PUBLIC_APP_URL, APP_URL because Railway gives us a new one
        if ($key -eq "APP_URL" -or $key -eq "NEXT_PUBLIC_APP_URL" -or $key -eq "NEXT_PUBLIC_BASE_URL" -or $key -eq "NEXT_PUBLIC_CUSTOM_DOMAIN" -or $key -eq "NEXTAUTH_URL") {
            continue
        }
        
        # Skip REDIS_URL if we want to use the Railway native one
        if ($key -eq "REDIS_URL") {
            continue
        }

        Write-Host "Setting $key..."
        railway.exe variables set "$key=$value" --skip-deploys -s masteria
    }
}
Write-Host "Variables sync completed! Now we need to redeploy once."

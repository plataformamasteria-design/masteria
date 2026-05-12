[void][Windows.Security.Credentials.PasswordVault, Windows.Security.Credentials, ContentType = WindowsRuntime]
$vault = New-Object Windows.Security.Credentials.PasswordVault
$creds = $vault.RetrieveAll()
foreach ($c in $creds) {
    if ($c.Resource -like '*github*') {
        $c.RetrievePassword()
        Write-Host "Resource: $($c.Resource)"
        Write-Host "Username: $($c.UserName)"
        Write-Host "Password: $($c.Password)"
        Write-Host "----------------"
    }
}

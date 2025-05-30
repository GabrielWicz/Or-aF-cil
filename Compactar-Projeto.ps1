# Nome do arquivo ZIP de saída
$nomeZip = "meu_projeto_nodejs.zip"

# Diretório atual do projeto
$diretorio = Get-Location

# Caminhos a excluir
$excluir = @("node_modules", ".git")

# Remove ZIP anterior se já existir
if (Test-Path $nomeZip) {
    Remove-Item $nomeZip
}

# Cria um novo ZIP sem as pastas excluídas
Add-Type -AssemblyName 'System.IO.Compression.FileSystem'

function Add-ToZip($zipPath, $sourcePath, $entryName) {
    $zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Update')
    try {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $sourcePath, $entryName)
    } finally {
        $zip.Dispose()
    }
}

# Cria o arquivo ZIP
[System.IO.Compression.ZipFile]::Open($nomeZip, 'Create').Dispose()

Get-ChildItem -Recurse -File | ForEach-Object {
    $filePath = $_.FullName
    $relativePath = $filePath.Substring($diretorio.Path.Length + 1)

    $excluido = $false
    foreach ($pasta in $excluir) {
        if ($relativePath -like "$pasta\*") {
            $excluido = $true
            break
        }
    }

    if (-not $excluido) {
        Add-ToZip $nomeZip $filePath $relativePath
    }
}

Write-Host "Projeto compactado com sucesso em: $nomeZip"
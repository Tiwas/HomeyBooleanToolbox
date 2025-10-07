# PowerShell Script to collect all project files into one text file.
# Filename: create_codebase.ps1

# Define the output file name
$outputFile = "codebase.txt"

# Clear the output file if it already exists
if (Test-Path $outputFile) {
    Clear-Content $outputFile
}

# Add a header to the output file
Add-Content -Path $outputFile -Value "======================================================================="
Add-Content -Path $outputFile -Value "          PROJECT CODEBASE: Homey Boolean Toolbox"
Add-Content -Path $outputFile -Value "======================================================================="
Add-Content -Path $outputFile -Value ""

# Get all relevant files recursively (.json, .js, .svg)
# The -Force flag includes hidden directories like .homeycompose
# The -Exclude flag skips the specified directories
Get-ChildItem -Path . -Recurse -Include *.json, *.js, *.svg -Force -Exclude "node_modules", ".homeybuild" | ForEach-Object {
    # Get the relative path of the file
    $relativePath = $_.FullName.Substring($PSScriptRoot.Length + 1)
    
    # Print a header for the file
    $fileHeader = @"

-----------------------------------------------------------------------
-- File: $relativePath
-----------------------------------------------------------------------

"@
    Add-Content -Path $outputFile -Value $fileHeader
    
    # Get the content of the file and add it to the output
    $fileContent = Get-Content -Path $_.FullName -Raw
    Add-Content -Path $outputFile -Value $fileContent
}

Write-Host "Successfully created '$outputFile' with the complete codebase."
Write-Host "Please upload this file."
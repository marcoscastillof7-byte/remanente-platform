Add-Type -AssemblyName System.Drawing

function Create-Icon($size, $outputPath, $fontSize) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#1e3a5f'))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    $font = New-Object System.Drawing.Font 'Segoe UI Emoji', $fontSize
    $goldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#d4af37'))

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $emoji = [char]::ConvertFromUtf32(0x1F4D6)
    $g.DrawString($emoji, $font, $goldBrush, $rect, $sf)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Created: $outputPath"
}

Create-Icon 192 'public\icon-192.png' 85
Create-Icon 512 'public\icon-512.png' 230
Create-Icon 180 'public\apple-touch-icon.png' 80

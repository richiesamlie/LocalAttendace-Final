# Generates public/icon.ico with multiple resolutions (16x16, 32x32, 48x48, 256x256)
Add-Type -AssemblyName System.Drawing

function New-IconImage {
    param([int]$Size)
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Background rounded rect
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 79, 70, 229)) # #4f46e5
    $corner = [Math]::Max(2, [int]($Size * 0.18))
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $corner * 2, $corner * 2, 180, 90)
    $path.AddArc($Size - $corner * 2, 0, $corner * 2, $corner * 2, 270, 90)
    $path.AddArc($Size - $corner * 2, $Size - $corner * 2, $corner * 2, $corner * 2, 0, 90)
    $path.AddArc(0, $Size - $corner * 2, $corner * 2, $corner * 2, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bgBrush, $path)

    # Foreground white silhouette
    $fgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    
    # Head
    $headR = $Size * 0.13
    $headX = ($Size / 2) - $headR
    $headY = ($Size * 0.25)
    $g.FillEllipse($fgBrush, [float]$headX, [float]$headY, [float]($headR * 2), [float]($headR * 2))

    # Shoulders
    $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bodyW = $Size * 0.62
    $bodyH = $Size * 0.62
    $bodyX = ($Size / 2) - ($bodyW / 2)
    $bodyY = $Size * 0.56
    $bodyPath.AddArc([float]$bodyX, [float]$bodyY, [float]$bodyW, [float]$bodyH, 180, 180)
    $bodyPath.CloseFigure()
    $g.FillPath($fgBrush, $bodyPath)

    $g.Dispose()
    return $bmp
}

$sizes = @(16, 32, 48, 256)
$pngBytesList = @()

foreach ($sz in $sizes) {
    $bmp = New-IconImage -Size $sz
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesList += ,$ms.ToArray()
    $bmp.Dispose()
    $ms.Dispose()
}

# Construct standard ICO file with embedded PNGs
$targetFile = Join-Path $PSScriptRoot "..\public\icon.ico"
$fs = [System.IO.File]::Create($targetFile)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type 1 = Icon
$bw.Write([uint16]$sizes.Count) # Image count

$offset = 6 + (16 * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $data = $pngBytesList[$i]
    $w = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { 0 } else { [byte]$sz }

    # ICONDIRENTRY
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)   # Color count
    $bw.Write([byte]0)   # Reserved
    $bw.Write([uint16]1) # Color planes
    $bw.Write([uint16]32)# Bit count
    $bw.Write([uint32]$data.Length) # Image bytes size
    $bw.Write([uint32]$offset)      # File offset

    $offset += $data.Length
}

foreach ($data in $pngBytesList) {
    $bw.Write($data)
}

$bw.Close()
$fs.Close()

Write-Output "Successfully generated $targetFile"

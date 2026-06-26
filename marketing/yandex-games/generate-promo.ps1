param(
  [string]$OutputDir = "marketing/yandex-games"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path -LiteralPath "."
$out = Join-Path $root $OutputDir
$shots = Join-Path $out "screenshots"
New-Item -ItemType Directory -Force -Path $out | Out-Null
New-Item -ItemType Directory -Force -Path $shots | Out-Null

function New-Bitmap([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Color([int]$hex) {
  return [System.Drawing.Color]::FromArgb(
    255,
    (($hex -shr 16) -band 255),
    (($hex -shr 8) -band 255),
    ($hex -band 255)
  )
}

function ColorA([int]$a, [int]$hex) {
  return [System.Drawing.Color]::FromArgb(
    $a,
    (($hex -shr 16) -band 255),
    (($hex -shr 8) -band 255),
    ($hex -band 255)
  )
}

function Brush([int]$hex) {
  return New-Object System.Drawing.SolidBrush((Color $hex))
}

function BrushA([int]$a, [int]$hex) {
  return New-Object System.Drawing.SolidBrush((ColorA $a $hex))
}

function PenC([int]$hex, [float]$width = 2, [int]$alpha = 255) {
  $pen = New-Object System.Drawing.Pen((ColorA $alpha $hex), $width)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function FontB([float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Bold) {
  return New-Object System.Drawing.Font("Arial", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Save-Png($ctx, [string]$path) {
  $ctx.Graphics.Dispose()
  $ctx.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $ctx.Bitmap.Dispose()
}

function Fill-Background($g, [int]$w, [int]$h) {
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    (Color 0x05070d),
    (Color 0x151b2b),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $g.FillRectangle($bg, $rect)
  $bg.Dispose()

  $gridPen = PenC 0x20f6ff 1 35
  for ($x = -$w; $x -lt ($w * 2); $x += 80) {
    $g.DrawLine($gridPen, $x, $h, $x + $w, [int]($h * 0.42))
  }
  for ($y = [int]($h * 0.45); $y -lt $h; $y += 54) {
    $g.DrawLine($gridPen, 0, $y, $w, $y)
  }
  $gridPen.Dispose()

  $vignette = BrushA 120 0x000000
  $g.FillRectangle($vignette, 0, 0, $w, [int]($h * 0.14))
  $g.FillRectangle($vignette, 0, [int]($h * 0.84), $w, [int]($h * 0.16))
  $vignette.Dispose()
}

function Draw-Arena($g, [int]$w, [int]$h, [float]$scale = 1.0) {
  $platformW = [int]($w * 0.68 * $scale)
  $platformH = [int]($h * 0.22 * $scale)
  $x = [int](($w - $platformW) / 2)
  $y = [int]($h * 0.62)
  $body = BrushA 230 0x101522
  $g.FillPolygon($body, @(
    [System.Drawing.Point]::new($x, $y + $platformH),
    [System.Drawing.Point]::new($x + [int]($platformW * 0.10), $y),
    [System.Drawing.Point]::new($x + [int]($platformW * 0.90), $y),
    [System.Drawing.Point]::new($x + $platformW, $y + $platformH)
  ))
  $body.Dispose()
  $g.DrawLine((PenC 0x20f6ff 8 210), $x + [int]($platformW * 0.08), $y + 8, $x + [int]($platformW * 0.92), $y + 8)
  $g.DrawLine((PenC 0xff4fd8 5 200), $x + [int]($platformW * 0.01), $y + $platformH - 6, $x + $platformW - [int]($platformW * 0.01), $y + $platformH - 6)
}

function Draw-Fighter($g, [int]$x, [int]$y, [float]$scale, [int]$main, [bool]$facingRight = $true, [bool]$slap = $false) {
  $dir = if ($facingRight) { 1 } else { -1 }
  $head = [int](34 * $scale)
  $bodyW = [int](46 * $scale)
  $bodyH = [int](74 * $scale)
  $brush = Brush $main
  $outline = PenC 0xf6fbff ([int](4 * $scale)) 230
  $glow = PenC $main ([int](12 * $scale)) 80

  $g.FillEllipse($brush, $x - $head, $y - [int](118 * $scale), $head * 2, $head * 2)
  $g.DrawEllipse($outline, $x - $head, $y - [int](118 * $scale), $head * 2, $head * 2)
  $g.FillRectangle($brush, $x - [int]($bodyW / 2), $y - [int](76 * $scale), $bodyW, $bodyH)
  $g.DrawRectangle($outline, $x - [int]($bodyW / 2), $y - [int](76 * $scale), $bodyW, $bodyH)

  $armY = $y - [int](56 * $scale)
  $reach = if ($slap) { [int](86 * $scale) } else { [int](50 * $scale) }
  $g.DrawLine($glow, $x, $armY, $x + $dir * $reach, $armY - [int](18 * $scale))
  $g.DrawLine((PenC 0xf6fbff ([int](7 * $scale)) 230), $x, $armY, $x + $dir * $reach, $armY - [int](18 * $scale))
  $g.DrawLine((PenC $main ([int](5 * $scale)) 255), $x, $armY, $x + $dir * $reach, $armY - [int](18 * $scale))
  $g.DrawLine((PenC 0xf6fbff ([int](7 * $scale)) 230), $x - [int](10 * $scale), $y - [int](2 * $scale), $x - [int](34 * $scale), $y + [int](46 * $scale))
  $g.DrawLine((PenC 0xf6fbff ([int](7 * $scale)) 230), $x + [int](10 * $scale), $y - [int](2 * $scale), $x + [int](34 * $scale), $y + [int](46 * $scale))
  $brush.Dispose()
  $outline.Dispose()
  $glow.Dispose()
}

function Draw-HitBurst($g, [int]$x, [int]$y, [float]$scale) {
  $colors = @(0xff5a36, 0xff4fd8, 0xb7ff3c, 0x20f6ff)
  for ($i = 0; $i -lt 18; $i++) {
    $angle = ($i / 18.0) * [Math]::PI * 2
    $len = [int]((34 + ($i % 4) * 12) * $scale)
    $x2 = $x + [int]([Math]::Cos($angle) * $len)
    $y2 = $y + [int]([Math]::Sin($angle) * $len)
    $g.DrawLine((PenC $colors[$i % $colors.Length] ([int](5 * $scale)) 230), $x, $y, $x2, $y2)
  }
}

function Draw-PowerUp($g, [int]$x, [int]$y, [float]$scale, [string]$label = "x2") {
  $r = [int](42 * $scale)
  $g.FillEllipse((BrushA 230 0x101522), $x - $r, $y - $r, $r * 2, $r * 2)
  $g.DrawEllipse((PenC 0xb7ff3c ([int](6 * $scale)) 220), $x - $r, $y - $r, $r * 2, $r * 2)
  $font = FontB ([int](28 * $scale))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $labelRect = [System.Drawing.RectangleF]::new([float]($x - $r), [float]($y - $r), [float]($r * 2), [float]($r * 2))
  $g.DrawString($label, $font, (Brush 0xb7ff3c), $labelRect, $sf)
  $font.Dispose()
}

function Draw-Logo($g, [int]$x, [int]$y, [float]$scale) {
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $font1 = FontB ([int](50 * $scale))
  $font2 = FontB ([int](104 * $scale))
  $g.DrawString("ARENA", $font1, (Brush 0xf6fbff), $x, $y, $sf)
  $g.DrawString("SLAPS", $font2, (Brush 0xff4fd8), $x, $y + [int](38 * $scale), $sf)
  $g.DrawString("SLAPS", $font2, (BrushA 130 0xff5a36), $x + [int](7 * $scale), $y + [int](44 * $scale), $sf)
  $font1.Dispose()
  $font2.Dispose()
}

function Draw-Hud($g, [int]$w, [int]$h) {
  $panel = BrushA 215 0x101522
  $g.FillRectangle($panel, [int]($w * 0.13), 38, [int]($w * 0.74), 86)
  $panel.Dispose()
  $g.DrawRectangle((PenC 0x20f6ff 4 210), [int]($w * 0.13), 38, [int]($w * 0.74), 86)
  $font = FontB 36
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString("PLAYER 2  :  1 BOT", $font, (Brush 0xf6fbff), [int]($w / 2), 60, $sf)
  $g.DrawString("00:42", (FontB 30), (Brush 0xb7ff3c), [int]($w * 0.78), 64, $sf)
  $font.Dispose()
}

function Make-Icon {
  $ctx = New-Bitmap 512 512
  $g = $ctx.Graphics
  Fill-Background $g 512 512
  Draw-Arena $g 512 512 1.15
  Draw-Fighter $g 188 344 1.15 0x20f6ff $true $true
  Draw-Fighter $g 342 330 1.02 0xff4fd8 $false $false
  Draw-HitBurst $g 282 224 1.05
  Draw-PowerUp $g 382 146 0.74 "!"
  $g.DrawEllipse((PenC 0xff5a36 10 210), 38, 38, 436, 436)
  Save-Png $ctx (Join-Path $out "icon-512.png")
}

function Make-Cover([int]$w, [int]$h, [string]$file, [bool]$wide = $false) {
  $ctx = New-Bitmap $w $h
  $g = $ctx.Graphics
  Fill-Background $g $w $h
  Draw-Arena $g $w $h 1.0
  Draw-Fighter $g ([int]($w * 0.38)) ([int]($h * 0.72)) ([Math]::Max(0.72, $w / 1120.0)) 0x20f6ff $true $true
  Draw-Fighter $g ([int]($w * 0.60)) ([int]($h * 0.71)) ([Math]::Max(0.72, $w / 1180.0)) 0xff4fd8 $false $false
  Draw-HitBurst $g ([int]($w * 0.50)) ([int]($h * 0.42)) ([Math]::Max(0.72, $w / 1300.0))
  Draw-PowerUp $g ([int]($w * 0.68)) ([int]($h * 0.34)) ([Math]::Max(0.65, $w / 1700.0)) "x2"
  if ($wide) {
    Draw-Logo $g ([int]($w * 0.50)) ([int]($h * 0.11)) 0.92
  } else {
    Draw-Logo $g ([int]($w * 0.23)) ([int]($h * 0.12)) 0.54
  }
  Save-Png $ctx (Join-Path $out $file)
}

function Make-Screenshot([string]$file, [string]$mode) {
  $w = 1920
  $h = 1080
  $ctx = New-Bitmap $w $h
  $g = $ctx.Graphics
  Fill-Background $g $w $h
  if ($mode -eq "menu") {
    Draw-Arena $g $w $h 1.08
    Draw-Logo $g 960 158 1.15
    $buttons = @("START", "PROFILE", "PROGRESSION", "SHOP")
    for ($i = 0; $i -lt $buttons.Length; $i++) {
      $y = 410 + $i * 112
      $g.FillRectangle((BrushA 230 0x101522), 720, $y, 480, 72)
      $g.DrawRectangle((PenC $(if ($i -eq 0) { 0x20f6ff } else { 0xff4fd8 }) 4 220), 720, $y, 480, 72)
      $sf = New-Object System.Drawing.StringFormat
      $sf.Alignment = [System.Drawing.StringAlignment]::Center
      $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
      $buttonRect = [System.Drawing.RectangleF]::new(720, [float]$y, 480, 72)
      $g.DrawString($buttons[$i], (FontB 34), (Brush 0xf6fbff), $buttonRect, $sf)
    }
  } elseif ($mode -eq "battle") {
    Draw-Hud $g $w $h
    Draw-Arena $g $w $h 1.0
    Draw-Fighter $g 720 750 1.45 0x20f6ff $true $true
    Draw-Fighter $g 1180 760 1.4 0xff4fd8 $false $false
    Draw-HitBurst $g 976 524 1.5
  } elseif ($mode -eq "powerups") {
    Draw-Hud $g $w $h
    Draw-Arena $g $w $h 1.0
    Draw-Fighter $g 670 780 1.35 0x20f6ff $true $false
    Draw-Fighter $g 1250 770 1.35 0xff4fd8 $false $false
    Draw-PowerUp $g 960 470 1.28 "x2"
    Draw-PowerUp $g 1110 610 0.9 "S"
    $titleFormat = New-Object System.Drawing.StringFormat
    $titleFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("POWER-UP READY", (FontB 58), (Brush 0xb7ff3c), 960, 210, $titleFormat)
  } else {
    Draw-Arena $g $w $h 0.9
    Draw-Logo $g 960 112 0.85
    $g.FillRectangle((BrushA 230 0x101522), 500, 310, 920, 480)
    $g.DrawRectangle((PenC 0x20f6ff 5 220), 500, 310, 920, 480)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("VICTORY", (FontB 86), (Brush 0xb7ff3c), 960, 360, $sf)
    $g.DrawString("+240 XP   LEVEL 6", (FontB 56), (Brush 0xf6fbff), 960, 500, $sf)
    $g.DrawString("ACHIEVEMENT UNLOCKED", (FontB 42), (Brush 0xff4fd8), 960, 620, $sf)
  }
  Save-Png $ctx (Join-Path $shots $file)
}

Make-Icon
Make-Cover 800 470 "cover-800x470.png" $false
Make-Cover 1560 520 "showcase-cover-1560x520.png" $true
Make-Screenshot "screenshot-01-main-menu.png" "menu"
Make-Screenshot "screenshot-02-battle.png" "battle"
Make-Screenshot "screenshot-03-powerups.png" "powerups"
Make-Screenshot "screenshot-04-results-or-progression.png" "results"

Write-Host "Generated Yandex Games promo images in $out"

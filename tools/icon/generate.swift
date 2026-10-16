// Deterministic, vector-drawn app icon. Run: swift tools/icon/generate.swift <output-directory>
import AppKit
import CoreGraphics
let output = CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath: output, withIntermediateDirectories: true)
for size in [1024, 180, 167, 152, 120] {
  let space = CGColorSpace(name: CGColorSpace.sRGB)!
  let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  context.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
  let gradient = CGGradient(colorsSpace: space, colors: [CGColor(red: 0.055, green: 0.19, blue: 0.32, alpha: 1), CGColor(red: 0.025, green: 0.075, blue: 0.16, alpha: 1)] as CFArray, locations: [0, 1])!
  context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 1024), end: CGPoint(x: 1024, y: 0), options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
  let white = CGColor(red: 0.94, green: 0.98, blue: 1, alpha: 1)
  let mint = CGColor(red: 0.21, green: 0.90, blue: 0.64, alpha: 1)
  context.setStrokeColor(white); context.setFillColor(white)
  context.setLineWidth(38); context.setLineCap(.round); context.setLineJoin(.round)
  // Front windscreen and roof.
  context.move(to: CGPoint(x: 260, y: 526)); context.addLine(to: CGPoint(x: 316, y: 690))
  context.addQuadCurve(to: CGPoint(x: 373, y: 730), control: CGPoint(x: 330, y: 730))
  context.addLine(to: CGPoint(x: 651, y: 730))
  context.addQuadCurve(to: CGPoint(x: 708, y: 690), control: CGPoint(x: 694, y: 730))
  context.addLine(to: CGPoint(x: 764, y: 526)); context.strokePath()
  // Tyres and body.
  for x in [264, 676] { context.addPath(CGPath(roundedRect: CGRect(x: x, y: 234, width: 84, height: 110), cornerWidth: 25, cornerHeight: 25, transform: nil)); context.fillPath() }
  context.addPath(CGPath(roundedRect: CGRect(x: 230, y: 307, width: 564, height: 246), cornerWidth: 66, cornerHeight: 66, transform: nil)); context.strokePath()
  for x in [296, 660] { context.addPath(CGPath(roundedRect: CGRect(x: x, y: 430, width: 68, height: 40), cornerWidth: 20, cornerHeight: 20, transform: nil)); context.fillPath() }
  // Battery with a lightning cutout.
  context.setFillColor(mint)
  context.addPath(CGPath(roundedRect: CGRect(x: 432, y: 361, width: 160, height: 133), cornerWidth: 22, cornerHeight: 22, transform: nil)); context.fillPath()
  context.fill(CGRect(x: 487, y: 494, width: 50, height: 12))
  context.setFillColor(CGColor(red: 0.035, green: 0.12, blue: 0.22, alpha: 1))
  context.move(to: CGPoint(x: 529, y: 482)); context.addLine(to: CGPoint(x: 475, y: 421)); context.addLine(to: CGPoint(x: 510, y: 421)); context.addLine(to: CGPoint(x: 493, y: 372)); context.addLine(to: CGPoint(x: 550, y: 440)); context.addLine(to: CGPoint(x: 516, y: 440)); context.closePath(); context.fillPath()
  let image = NSBitmapImageRep(cgImage: context.makeImage()!)
  let png = image.representation(using: .png, properties: [:])!
  try png.write(to: URL(fileURLWithPath: output).appendingPathComponent(size == 1024 ? "icon.png" : "AppIcon\(size).png"))
}

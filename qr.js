// QR Code generator — wraps the proven `qrcode-generator` library (v1–40).
// The library is loaded from CDN in index.html / ticket.html and exposes the
// global `qrcode`. Auto-selects the smallest version that fits the payload, so
// full ticket URLs (>53 bytes) encode cleanly. Output: clean SVG string.

window.makeQRSVG = function(text, px) {
  px = px || 200;

  if (typeof qrcode === 'undefined') {
    // Library not loaded (offline / CDN blocked). Avoid emitting a broken code.
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px +
      '" viewBox="0 0 ' + px + ' ' + px + '"><rect width="' + px + '" height="' + px +
      '" fill="white"/><text x="50%" y="50%" text-anchor="middle" font-size="10" fill="#999">QR indisponible</text></svg>';
  }

  // typeNumber 0 = auto-detect smallest fitting version. EC level M.
  var qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();

  var n = qr.getModuleCount();
  var quiet = 4;
  var total = n + quiet * 2;
  var cell = Math.max(1, Math.floor(px / total));
  var side = cell * total;
  var off = quiet * cell;

  var rects = '';
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        rects += '<rect x="' + (off + c * cell) + '" y="' + (off + r * cell) +
          '" width="' + cell + '" height="' + cell + '"/>';
      }
    }
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + side + '" height="' + side +
    '" viewBox="0 0 ' + side + ' ' + side + '" shape-rendering="crispEdges">' +
    '<rect width="' + side + '" height="' + side + '" fill="white"/>' +
    '<g fill="black">' + rects + '</g></svg>';
};

const opentype = require('opentype.js');
const { pngBase64ToSVGPath, scaleSVGPath } = require('./imageProcessor');

/**
 * Construye un archivo de fuente OTF o TTF a partir de un mapa de glifos en base64.
 * @param {Object} glyphs  – { "A": "data:image/png;base64,...", ... }
 * @param {string} fontName
 * @param {string} format  – 'otf' | 'ttf'
 * @returns {Buffer} – Buffer con el archivo de fuente listo para descargar
 */
async function buildFont(glyphs, fontName, format = 'otf') {
  // Glifo .notdef obligatorio
  const notdefPath = new opentype.Path();
  notdefPath.moveTo(50, 0);
  notdefPath.lineTo(450, 0);
  notdefPath.lineTo(450, 700);
  notdefPath.lineTo(50, 700);
  notdefPath.closePath();
  notdefPath.moveTo(100, 50);
  notdefPath.lineTo(100, 650);
  notdefPath.lineTo(400, 650);
  notdefPath.lineTo(400, 50);
  notdefPath.closePath();

  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: 500,
    path: notdefPath,
  });

  const glyphList = [notdefGlyph];
  const errors = [];

  for (const [char, dataUrl] of Object.entries(glyphs)) {
    try {
      const rawPath = await pngBase64ToSVGPath(dataUrl);
      if (!rawPath) {
        errors.push(char);
        continue;
      }

      // Escalar de 400px (potrace) → espacio opentype (600w × 700h) + volteo Y
      const scaledPath = scaleSVGPath(rawPath, 400, 600, 700);

      // Convertir SVG path string → opentype.Path
      const otPath = svgPathToOpentypePath(scaledPath);

      glyphList.push(new opentype.Glyph({
        name: `uni${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
        unicode: char.charCodeAt(0),
        advanceWidth: 600,
        path: otPath,
      }));
    } catch (e) {
      errors.push(char);
      console.warn(`[FONT] Error procesando glifo "${char}":`, e.message);
    }
  }

  if (glyphList.length <= 1) {
    throw new Error('No se pudo procesar ningún glifo. Verifica las imágenes.');
  }

  const font = new opentype.Font({
    familyName: fontName,
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: glyphList,
  });

  // Serializar a ArrayBuffer y convertir a Buffer de Node.js
  // font.download() en algunos entornos no devuelve nada — usamos toArrayBuffer()
  let arrayBuffer;
  try {
    arrayBuffer = font.toArrayBuffer ? font.toArrayBuffer() : font.download();
  } catch (e) {
    // Fallback: serializar manualmente
    arrayBuffer = font.toBuffer ? font.toBuffer() : font.download();
  }

  if (!arrayBuffer) {
    throw new Error('opentype.js no pudo serializar la fuente. Verifica que los glifos tengan trazos visibles.');
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    glyphCount: glyphList.length - 1,
    errors,
  };
}

/**
 * Convierte un string de path SVG ya transformado → opentype.Path.
 * Las coordenadas ya vienen en espacio opentype (volteadas y escaladas).
 */
function svgPathToOpentypePath(d) {
  const path = new opentype.Path();
  if (!d) return path;

  const tokens = d.match(/[MLCQZmlcqz]|[-+]?[0-9]*\.?[0-9]+(?:\.[0-9]+)?/g) || [];
  let i = 0;
  const n = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': path.moveTo(n(), n()); break;
      case 'L': path.lineTo(n(), n()); break;
      case 'C': path.curveTo(n(), n(), n(), n(), n(), n()); break;
      case 'Q': path.quadraticCurveTo(n(), n(), n(), n()); break;
      case 'Z': case 'z': path.closePath(); break;
      default: break;
    }
  }

  return path;
}

module.exports = { buildFont };

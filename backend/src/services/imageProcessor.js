const sharp = require('sharp');
const potrace = require('potrace');
const { promisify } = require('util');

const trace = promisify(potrace.trace);

/**
 * Convierte un PNG en base64 a un path SVG vectorial.
 * FIXES: fondo blanco explícito (evita rellenos), imagen más grande (mejor detalle).
 */
async function pngBase64ToSVGPath(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  const processed = await sharp(buffer)
    .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .grayscale()
    .normalise()
    .threshold(180)
    .png()
    .toBuffer();

  const svgString = await trace(processed, {
    blackOnWhite: true,
    color: 'black',
    background: 'white',
    threshold: 180,
    turdSize: 4,
    optCurve: true,
    optTolerance: 0.3,
    turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
  });

  const match = svgString.match(/\sd="([^"]+)"/);
  return match ? match[1] : '';
}

/**
 * Escala Y VOLTEA el path SVG al espacio de opentype.
 * SVG: Y hacia abajo. OpenType: Y hacia arriba.
 * Sin este flip, las letras salen invertidas en la fuente.
 */
function scaleSVGPath(d, sourceSize = 400, targetW = 600, targetH = 700) {
  if (!d) return '';

  const scaleX = targetW / sourceSize;
  const scaleY = targetH / sourceSize;
  const tokens = d.match(/[MmLlCcQqZz]|[-+]?[0-9]*\.?[0-9]+(?:\.[0-9]+)?/g) || [];
  const out = [];
  let i = 0;
  let cx = 0, cy = 0;

  const nx = () => parseFloat(tokens[i++]);
  const tx = (x) => (x * scaleX).toFixed(2);
  const ty = (y) => ((sourceSize - y) * scaleY).toFixed(2); // ← volteo vertical

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': { const x=nx(),y=nx(); cx=x; cy=y; out.push(`M${tx(x)} ${ty(y)}`); break; }
      case 'L': { const x=nx(),y=nx(); cx=x; cy=y; out.push(`L${tx(x)} ${ty(y)}`); break; }
      case 'C': {
        const x1=nx(),y1=nx(),x2=nx(),y2=nx(),x=nx(),y=nx(); cx=x; cy=y;
        out.push(`C${tx(x1)} ${ty(y1)} ${tx(x2)} ${ty(y2)} ${tx(x)} ${ty(y)}`); break;
      }
      case 'Q': {
        const x1=nx(),y1=nx(),x=nx(),y=nx(); cx=x; cy=y;
        out.push(`Q${tx(x1)} ${ty(y1)} ${tx(x)} ${ty(y)}`); break;
      }
      case 'Z': case 'z': out.push('Z'); break;
      case 'm': { const dx=nx(),dy=nx(); cx+=dx; cy+=dy; out.push(`M${tx(cx)} ${ty(cy)}`); break; }
      case 'l': { const dx=nx(),dy=nx(); cx+=dx; cy+=dy; out.push(`L${tx(cx)} ${ty(cy)}`); break; }
      case 'c': {
        const x1=cx+nx(),y1=cy+nx(),x2=cx+nx(),y2=cy+nx(),x=cx+nx(),y=cy+nx(); cx=x; cy=y;
        out.push(`C${tx(x1)} ${ty(y1)} ${tx(x2)} ${ty(y2)} ${tx(x)} ${ty(y)}`); break;
      }
      default: break;
    }
  }
  return out.join(' ');
}

/**
 * Extrae glifos individuales de una imagen de plantilla escaneada.
 * Usa una grilla fija basada en el layout de la plantilla PDF generada.
 */
async function extractGlyphsFromTemplate(imageBuffer) {
  // Dimensiones reales de la plantilla A4 a 150 DPI
  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const CELL_W = 113;
  const CELL_H = 113;
  const MARGIN_L = 58;
  const MARGIN_TOP = 140;
  const GAP = 12;
  const CHARS_PER_ROW = 9;
  const ROW_GAP = 20;

  const ALL_CHARS = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...'abcdefghijklmnopqrstuvwxyz',
    ...'0123456789',
    ...Array.from('.,;:!?-_()[]@#$%&*+= '),
    ...Array.from('ÁáÉéÍíÓóÚúÜüÑñ'),
  ];

  // Resize a dimensiones conocidas para coordenadas fijas
  const resized = await sharp(imageBuffer)
    .resize(PAGE_W, PAGE_H, { fit: 'fill' })
    .toBuffer();

  const glyphs = {};

  for (let i = 0; i < ALL_CHARS.length; i++) {
    const col = i % CHARS_PER_ROW;
    const row = Math.floor(i / CHARS_PER_ROW);

    const x = MARGIN_L + col * (CELL_W + GAP);
    const y = MARGIN_TOP + row * (CELL_H + ROW_GAP);

    // Margen interior para recortar solo el área de escritura
    const pad = 10;
    try {
      const cell = await sharp(resized)
        .extract({
          left: Math.max(0, x + pad),
          top: Math.max(0, y + pad),
          width: Math.min(CELL_W - pad * 2, PAGE_W - x - pad),
          height: Math.min(CELL_H - pad * 2, PAGE_H - y - pad),
        })
        .toBuffer();

      glyphs[ALL_CHARS[i]] = 'data:image/png;base64,' + cell.toString('base64');
    } catch (e) {
      // Celda fuera de rango, se omite
    }
  }

  return glyphs;
}

module.exports = { pngBase64ToSVGPath, scaleSVGPath, extractGlyphsFromTemplate };

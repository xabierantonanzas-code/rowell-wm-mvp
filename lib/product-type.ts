// ===========================================================================
// Clasificacion de producto: IIC (fondo) vs RV (accion / ETF)
// ===========================================================================
//
// Mapfre no expone un campo product_type en el Excel de posiciones (POS_*).
// El campo "PRODUCTO" SI existe en el registro de operaciones (REG_OP_7) con
// valores IIC / RV, pero no se enlaza a la tabla positions.
//
// Como solucion sin migracion, clasificamos en runtime con la heuristica:
//   - ISIN US**, CA**, BM**, KY**  -> RV (acciones internacionales)
//   - ISIN LU**, IE**              -> IIC (fondos UCITS / offshore)
//   - Resto + nombre con sufijo de
//     empresa cotizada (INC, CORP,
//     MOTORS, LTD, PLC, AG, SA...)  -> RV
//   - Resto                         -> IIC (default fondo)
//
// Cubre los casos reales observados (Aurum-077, MFL-*, etc.). Si en el futuro
// queremos certeza absoluta, conviene anadir una columna product_type a
// positions y poblarla en el parser leyendo REG_OP_7 o un mapping ISIN->tipo.

export type ProductType = "iic" | "rv";

const STOCK_NAME_REGEX =
  /\b(INC|CORP|MOTORS|MOTOR|HOLDINGS?|LTD|PLC|S\.A\.?|N\.?V\.?|AG|SE|ASA|OYJ|CO\.?|GROUP|GRP)\b/i;

const ETF_NAME_REGEX = /\b(ETF|UCITS ETF|ISHARES|VANGUARD|XTRACKERS|LYXOR|INVESCO QQQ)\b/i;

export function classifyProduct(
  isin: string | null | undefined,
  productName: string | null | undefined
): ProductType {
  const code = (isin ?? "").toUpperCase().trim();
  const name = (productName ?? "").trim();
  const prefix = code.slice(0, 2);

  // ETFs van con RV (Edgard pidio "Acciones / ETFs" juntos)
  if (ETF_NAME_REGEX.test(name)) return "rv";

  // Acciones internacionales por prefijo de pais
  if (["US", "CA", "BM", "KY"].includes(prefix)) return "rv";

  // Fondos UCITS / offshore por prefijo
  if (["LU", "IE"].includes(prefix)) return "iic";

  // Heuristica por nombre de empresa cotizada
  if (STOCK_NAME_REGEX.test(name)) return "rv";

  // Default: IIC (fondo)
  return "iic";
}

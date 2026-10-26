// cortecloudExport.js
//
// Turns a designSpec into Cortecloud's parts-list import format. There is no
// direct API integration yet, so the user brings the parts into Cortecloud via
// "Importar peças → Colar dados da planilha ou Excel", which expects these
// columns, in this order, without the header row:
// https://s3.amazonaws.com/ccprod-static-files/xlsxs/importar_do_excel.xls
//
// After pasting, Cortecloud asks the user to link each distinct "Material"
// (chapa) and "Fita" name to a material registered there — which is why
// sheet and edge-band names must be consistent across parts.

export const PART_COLUMNS = [
  "Quantidade",
  "Comprimento",
  "Largura",
  "Função",
  "Fita C1",
  "Fita C2",
  "Fita L1",
  "Fita L2",
  "Material",
  "Complemento",
  "Girar",
];

// Designs saved before parts carried their own sheet only have the
// project-level material.
function fallbackSheetName(spec) {
  return [spec.material, spec.thicknessMm && `${spec.thicknessMm}mm`].filter(Boolean).join(" ");
}

// Tabs or line breaks inside a cell would split the row when pasted.
const cleanCell = (value) =>
  typeof value === "string" ? value.replace(/[\t\r\n]+/g, " ").trim() || null : value;

/** One row per part, in PART_COLUMNS order. Empty cells are null. */
export function partRows(spec) {
  const fallbackSheet = fallbackSheetName(spec) || null;
  return (spec.parts || []).map((part) => {
    const band = part.edgeBand || null;
    const side = (banded) => (banded && band ? band : null);
    return [
      part.quantity ?? 1,
      part.lengthMm ?? null,
      part.widthMm ?? null,
      part.name || null,
      side(part.bandC1),
      side(part.bandC2),
      side(part.bandL1),
      side(part.bandL2),
      part.sheet || fallbackSheet,
      part.notes || null,
      part.canRotate ? "S" : null, // Cortecloud reads "S" or "1" as "ignorar veio"
    ].map(cleanCell);
  });
}

/** Tab-separated rows, the same shape Excel puts on the clipboard. */
export function partsAsTsv(spec) {
  return partRows(spec)
    .map((row) => row.map((value) => value ?? "").join("\t"))
    .join("\n");
}

export async function copyPartsForCortecloud(spec) {
  await navigator.clipboard.writeText(partsAsTsv(spec));
}

function slug(text) {
  return (
    (text || "projeto")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto"
  );
}

const header = (labels) =>
  labels.map((value) => ({ value, fontWeight: "bold", backgroundColor: "#ECE3D6" }));
const widths = (...chars) => chars.map((width) => ({ width }));

export function buildWorkbook(spec, clientName) {
  const dims = [spec.widthMm, spec.heightMm, spec.depthMm].every(Boolean)
    ? `${spec.widthMm} × ${spec.heightMm} × ${spec.depthMm}`
    : null;
  return [
    {
      sheet: "Peças",
      data: [header(PART_COLUMNS), ...partRows(spec)],
      columns: widths(12, 13, 10, 26, 22, 22, 22, 22, 26, 40, 7),
      stickyRowsCount: 1,
    },
    {
      sheet: "Chapas",
      data: [
        header(["Nome", "Tipo", "Especificação (mm)", "Cor", "Faces"]),
        ...(spec.sheets || []).map((s) => [s.name, s.type, s.thicknessMm, s.color, s.faces]),
      ],
      columns: widths(30, 14, 18, 18, 8),
    },
    {
      sheet: "Fitas",
      data: [
        header(["Nome", "Cor", "Espessura (mm)", "Largura (mm)"]),
        ...(spec.edgeBands || []).map((b) => [b.name, b.color, b.thicknessMm, b.widthMm]),
      ],
      columns: widths(30, 18, 16, 14),
    },
    {
      sheet: "Componentes",
      data: [
        header(["Categoria", "Descrição", "Quantidade"]),
        ...(spec.components || []).map((c) => [c.category, c.description, c.quantity]),
      ],
      columns: widths(34, 44, 12),
    },
    {
      sheet: "Cliente",
      data: [
        header(["Nome", "Ambiente", "Projeto", "Medidas L × A × P (mm)"]),
        [clientName || null, spec.environment || null, spec.name || null, dims],
      ],
      columns: widths(30, 22, 30, 24),
    },
  ];
}

/**
 * Builds the .xlsx (parts in Cortecloud's column order + chapas, fitas,
 * componentes and cliente sheets). On phones it opens the share sheet so the
 * file can go straight to WhatsApp, Drive, e-mail...; elsewhere it downloads.
 */
export async function downloadCortecloudSheet(spec, clientName) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const blob = await writeExcelFile(buildWorkbook(spec, clientName)).toBlob();
  const fileName = `cortecloud-${slug(spec.name)}.xlsx`;
  const file = new File([blob], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: spec.name });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // user closed the share sheet
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

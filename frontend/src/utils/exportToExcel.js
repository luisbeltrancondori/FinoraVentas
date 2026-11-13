export async function exportToExcel(data, fileName, sheetName = 'Reporte', options = {}) {
  const { business, title } = options;
  const rows = Array.isArray(data) ? data : [];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  if (!headers.length) throw new Error('No hay datos para exportar.');

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = business?.nombre || 'Finora POS';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Reporte');
  const lastColumn = headers.length;

  worksheet.mergeCells(1, 1, 1, lastColumn);
  worksheet.getCell(1, 1).value = business?.nombre || 'Finora POS';
  worksheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FF064E3B' } };

  const contact = [
    business?.nit ? `NIT: ${business.nit}` : '',
    business?.direccion || '',
    business?.telefono ? `Teléfono: ${business.telefono}` : '',
  ].filter(Boolean).join(' · ');
  if (contact) {
    worksheet.mergeCells(2, 1, 2, lastColumn);
    worksheet.getCell(2, 1).value = contact;
    worksheet.getCell(2, 1).font = { size: 10, color: { argb: 'FF475569' } };
  }
  worksheet.mergeCells(3, 1, 3, lastColumn);
  worksheet.getCell(3, 1).value = title;
  worksheet.getCell(3, 1).font = { bold: true, size: 12 };
  worksheet.mergeCells(4, 1, 4, lastColumn);
  worksheet.getCell(4, 1).value = `Fecha de emisión: ${new Date().toLocaleString('es-BO')}`;
  worksheet.getCell(4, 1).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  worksheet.addRow([]);
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });

  rows.forEach((row) => worksheet.addRow(headers.map((header) => row[header] ?? '—')));
  worksheet.columns = headers.map((header) => ({
    key: header,
    width: Math.min(42, Math.max(14, header.length + 3)),
  }));
  worksheet.views = [{ state: 'frozen', ySplit: 6 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

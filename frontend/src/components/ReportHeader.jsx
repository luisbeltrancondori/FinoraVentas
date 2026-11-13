export default function ReportHeader({ business, title, className = '' }) {
  return (
    <header className={`print-only report-header ${className}`}>
      <h1>{business?.nombre || 'Finora POS'}</h1>
      {business?.nit && <p>NIT: {business.nit}</p>}
      {business?.direccion && <p>{business.direccion}</p>}
      {business?.telefono && <p>Teléfono: {business.telefono}</p>}
      <h2>{title}</h2>
      <p>Fecha de emisión: {new Date().toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })}</p>
    </header>
  );
}

import { cancellationReasons } from '../lib/businessOperations'

export function CancellationFields({ reason, onChange }) {
  return <label>Motivo de cancelacion
    <select required value={reason} onChange={(event) => onChange(event.target.value)}>
      <option value="">Seleccionar motivo</option>
      {cancellationReasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
    </select>
  </label>
}

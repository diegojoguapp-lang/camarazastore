import { formatGs, parseGs } from '../lib/utils'

export function MoneyInput({ label, value, onChange, disabled = false, required = false }) {
  return (
    <label>{label}
      <input
        inputMode="numeric"
        value={formatGs(value)}
        onChange={(event) => onChange(parseGs(event.target.value))}
        disabled={disabled}
        required={required}
      />
    </label>
  )
}

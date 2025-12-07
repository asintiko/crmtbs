const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
})

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

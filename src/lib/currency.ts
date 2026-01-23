export const normalizeCurrencyCode = (input: string) => input.trim().toUpperCase()

export const formatCurrency = (amount: number, currencyCode: string) => {
  const normalized = normalizeCurrencyCode(currencyCode)
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: normalized,
  })
  return `${formatter.format(amount)} ${normalized}`
}

export type AmountIntent = 'income' | 'expense' | 'transfer-in' | 'transfer-out' | 'transfer' | 'other'

type TransferDirectionNormalized = 'in' | 'out' | ''

type AmountMeta = {
  signed: number
  abs: number
  intent: AmountIntent
  displayType: string
  displaySign: '+' | '-' | ''
  direction: TransferDirectionNormalized
}

const normalizeEntryType = (entryType?: string | null): string => {
  return String(entryType ?? '').trim().toLowerCase()
}

const normalizeTransferDirection = (direction?: string | null): TransferDirectionNormalized => {
  const value = String(direction ?? '').trim().toLowerCase()
  if (value === 'in') return 'in'
  if (value === 'out') return 'out'
  return ''
}

export const computeAmountMeta = (
  amountInput: number | string | null | undefined,
  entryType?: string | null,
  transferDirection?: string | null,
): AmountMeta => {
  const rawNumber = Number(amountInput ?? 0)
  const base = Number.isFinite(rawNumber) ? rawNumber : 0
  const type = normalizeEntryType(entryType)
  const direction = normalizeTransferDirection(transferDirection)

  let intent: AmountIntent = 'other'
  let signed = base

  if (type === 'income') {
    signed = Math.abs(base)
    intent = 'income'
  } else if (type === 'expense') {
    signed = -Math.abs(base)
    intent = 'expense'
  } else if (type.startsWith('transfer')) {
    if (direction === 'in') {
      signed = Math.abs(base)
      intent = 'transfer-in'
    } else if (direction === 'out') {
      signed = -Math.abs(base)
      intent = 'transfer-out'
    } else {
      intent = 'transfer'
    }
  } else if (base > 0) {
    intent = 'income'
  } else if (base < 0) {
    intent = 'expense'
  }

  const abs = Math.abs(signed)
  const displaySign: AmountMeta['displaySign'] = signed > 0 ? '+' : signed < 0 ? '-' : ''
  const displayType = intent === 'transfer-in'
    ? 'Transfer In'
    : intent === 'transfer-out'
      ? 'Transfer Out'
      : intent === 'transfer'
        ? 'Transfer'
        : intent === 'income'
          ? 'Income'
          : intent === 'expense'
            ? 'Expense'
            : signed >= 0
              ? 'Income'
              : 'Expense'

  return {
    signed,
    abs,
    intent,
    displayType,
    displaySign,
    direction,
  }
}

export type { AmountMeta, TransferDirectionNormalized as NormalizedTransferDirection }

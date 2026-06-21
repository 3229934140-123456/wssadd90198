import { RuleCheckResult, Member, Transaction, Package } from '../types'

const LARGE_AMOUNT_THRESHOLD = 50000
const LOW_PRICE_RATIO_THRESHOLD = 0.6
const MULTI_PAYER_WINDOW_DAYS = 7

export const maskName = (name: string): string => {
  if (!name || name.length <= 1) return name || ''
  if (name.length === 2) return name.charAt(0) + '*'
  return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1)
}

export const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 7) return phone || ''
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export const formatCurrency = (amount: number): string => {
  return '¥' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export const checkRechargeRules = (
  amount: number,
  pkg: Package | null,
  member: Member,
  recentTransactions: Transaction[],
  currentCashierId: string,
): RuleCheckResult => {
  const warnings: string[] = []
  let requiresApproval = false
  let approvalLevel: 'none' | 'supervisor' | 'manager' = 'none'

  if (amount >= LARGE_AMOUNT_THRESHOLD) {
    warnings.push(`大额储值预警：单笔储值 ${formatCurrency(amount)} 超过阈值 ${formatCurrency(LARGE_AMOUNT_THRESHOLD)}`)
    requiresApproval = true
    approvalLevel = 'manager'
  }

  if (pkg) {
    const actualRatio = (pkg.packagePrice + pkg.giftAmount) / pkg.originalPrice
    if (actualRatio < LOW_PRICE_RATIO_THRESHOLD) {
      warnings.push(`低价囤卡预警：套餐实际优惠率 ${(actualRatio * 100).toFixed(1)}% 低于警戒线`)
      requiresApproval = true
      if (approvalLevel !== 'manager') approvalLevel = 'supervisor'
    }
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - MULTI_PAYER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const recentRecharges = recentTransactions.filter(
    (t) =>
      t.type === 'recharge' &&
      t.status === 'completed' &&
      t.memberId === member.id &&
      new Date(t.createdAt) >= windowStart,
  )
  if (recentRecharges.length >= 3) {
    warnings.push(`同卡高频储值：近7天内已完成 ${recentRecharges.length} 笔储值`)
    requiresApproval = true
    if (approvalLevel !== 'manager') approvalLevel = 'supervisor'
  }

  const otherPayers = new Set(
    recentRecharges.map((t) => t.cashierId).filter((id) => id !== currentCashierId),
  )
  if (otherPayers.size >= 2) {
    warnings.push(`同卡多人代付预警：近7天内有 ${otherPayers.size} 个不同收银操作该卡`)
    requiresApproval = true
    approvalLevel = 'manager'
  }

  const totalRecentAmount = recentRecharges.reduce((sum, t) => sum + t.amount, 0) + amount
  if (totalRecentAmount >= LARGE_AMOUNT_THRESHOLD * 2) {
    warnings.push(`短期累计大额：近7天累计储值 ${formatCurrency(totalRecentAmount)}`)
    requiresApproval = true
    approvalLevel = 'manager'
  }

  return {
    passed: !requiresApproval,
    warnings,
    requiresApproval,
    approvalLevel,
  }
}

export const levelColorMap: Record<string, { bg: string; text: string; label: string }> = {
  normal: { bg: 'bg-gray-100', text: 'text-gray-600', label: '普通会员' },
  silver: { bg: 'bg-slate-100', text: 'text-slate-700', label: '银卡会员' },
  gold: { bg: 'bg-amber-50', text: 'text-amber-700', label: '金卡会员' },
  diamond: { bg: 'bg-purple-50', text: 'text-purple-700', label: '钻石会员' },
}

export const paymentMethodLabels: Record<string, string> = {
  cash: '现金',
  card: '银行卡',
  wechat: '微信支付',
  alipay: '支付宝',
  stored: '储值扣款',
}

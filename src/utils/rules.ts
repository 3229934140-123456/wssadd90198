import { RuleCheckResult, RuleDetail, Member, Transaction, Package, RiskLevel, TransactionItem, DiscountDetail } from '../types'

const LARGE_AMOUNT_THRESHOLD = 50000
const VERY_LARGE_AMOUNT_THRESHOLD = 100000
const LOW_PRICE_RATIO_THRESHOLD = 0.7
const VERY_LOW_PRICE_RATIO_THRESHOLD = 0.5
const MULTI_PAYER_WINDOW_DAYS = 7
const FREQUENT_RECHARGE_THRESHOLD = 3
const SHORT_TERM_CUMULATIVE_THRESHOLD = 100000

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

const combineRiskLevels = (...levels: RiskLevel[]): RiskLevel => {
  const order: RiskLevel[] = ['low', 'medium', 'high', 'critical']
  let max: RiskLevel = 'low'
  for (const l of levels) {
    if (order.indexOf(l) > order.indexOf(max)) max = l
  }
  return max
}

const approvalForRisk = (level: RiskLevel): 'none' | 'supervisor' | 'manager' => {
  if (level === 'critical') return 'manager'
  if (level === 'high') return 'supervisor'
  return 'none'
}

export const riskLevelConfig: Record<RiskLevel, { label: string; bg: string; text: string; dot: string }> = {
  low: { label: '低风险', bg: 'bg-green-50', text: 'text-green-700', dot: '#22c55e' },
  medium: { label: '中风险', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: '#eab308' },
  high: { label: '高风险', bg: 'bg-orange-50', text: 'text-orange-700', dot: '#f97316' },
  critical: { label: '极高风险', bg: 'bg-red-50', text: 'text-red-700', dot: '#ef4444' },
}

export const checkRechargeRules = (
  amount: number,
  pkg: Package | null,
  member: Member,
  recentTransactions: Transaction[],
  currentCashierId: string,
  payerPhone?: string,
  payerName?: string,
): RuleCheckResult => {
  const ruleDetails: RuleDetail[] = []
  const suggestions: string[] = []
  const warnings: string[] = []

  const now = new Date()
  const windowStart = new Date(now.getTime() - MULTI_PAYER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const recentRecharges = recentTransactions.filter(
    (t) =>
      t.type === 'recharge' &&
      t.status === 'completed' &&
      t.memberId === member.id &&
      new Date(t.createdAt) >= windowStart,
  )

  // 规则1：单笔大额储值
  if (amount >= VERY_LARGE_AMOUNT_THRESHOLD) {
    ruleDetails.push({
      key: 'large_amount_critical',
      name: '单笔超大额储值',
      passed: false,
      riskLevel: 'critical',
      message: `单笔储值 ${formatCurrency(amount)}，超过 ${formatCurrency(VERY_LARGE_AMOUNT_THRESHOLD)} 的极高风险阈值`,
      suggestion: '必须由店经理现场授权，建议核实资金来源与客户消费能力',
    })
  } else if (amount >= LARGE_AMOUNT_THRESHOLD) {
    ruleDetails.push({
      key: 'large_amount_high',
      name: '单笔大额储值',
      passed: false,
      riskLevel: 'high',
      message: `单笔储值 ${formatCurrency(amount)}，超过 ${formatCurrency(LARGE_AMOUNT_THRESHOLD)} 的大额阈值`,
      suggestion: '需要主管授权，建议确认客户是否了解储值协议和退款规则',
    })
  } else {
    ruleDetails.push({
      key: 'large_amount',
      name: '单笔金额校验',
      passed: true,
      riskLevel: 'low',
      message: `单笔储值 ${formatCurrency(amount)}，在正常范围内`,
      suggestion: '',
    })
  }

  // 规则2：低价囤卡风险（按实际付款/到账权益比判断）
  if (pkg) {
    const totalValue = pkg.packagePrice + pkg.giftAmount
    const valueRatio = pkg.packagePrice / totalValue
    const catalogRatio = totalValue / pkg.originalPrice
    const effectiveRatio = Math.min(valueRatio, catalogRatio)
    if (effectiveRatio <= VERY_LOW_PRICE_RATIO_THRESHOLD) {
      ruleDetails.push({
        key: 'low_price_critical',
        name: '极低折扣套餐',
        passed: false,
        riskLevel: 'critical',
        message: `「${pkg.name}」实付/到账权益比 = ${(valueRatio * 100).toFixed(1)}%，低于 ${(VERY_LOW_PRICE_RATIO_THRESHOLD * 100).toFixed(0)}% 红线（付${formatCurrency(pkg.packagePrice)}获${formatCurrency(totalValue)}权益）`,
        suggestion: '必须店经理授权，注意是否属于违规促销或刷单行为，建议留存促销审批文件',
      })
    } else if (effectiveRatio <= LOW_PRICE_RATIO_THRESHOLD) {
      ruleDetails.push({
        key: 'low_price_high',
        name: '低折扣套餐',
        passed: false,
        riskLevel: 'high',
        message: `「${pkg.name}」实付/到账权益比 = ${(valueRatio * 100).toFixed(1)}%，低于 ${(LOW_PRICE_RATIO_THRESHOLD * 100).toFixed(0)}% 警戒线（付${formatCurrency(pkg.packagePrice)}获${formatCurrency(totalValue)}权益）`,
        suggestion: '需要主管授权，提醒客户赠金不兑现、不找零、不开票',
      })
    } else {
      ruleDetails.push({
        key: 'low_price',
        name: '套餐折扣校验',
        passed: true,
        riskLevel: 'low',
        message: `「${pkg.name}」权益折扣比 ${(valueRatio * 100).toFixed(1)}%，在正常范围内（付${formatCurrency(pkg.packagePrice)}获${formatCurrency(totalValue)}权益）`,
        suggestion: '',
      })
    }
  }

  // 规则3：短期高频储值
  const countAfterThis = recentRecharges.length + 1
  if (countAfterThis >= FREQUENT_RECHARGE_THRESHOLD + 2) {
    ruleDetails.push({
      key: 'frequent_recharge_critical',
      name: '超高频储值',
      passed: false,
      riskLevel: 'critical',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天内第 ${countAfterThis} 笔储值，远超过正常消费节奏`,
      suggestion: '必须店经理授权，核实是否为员工代充、刷单或套现',
    })
  } else if (countAfterThis >= FREQUENT_RECHARGE_THRESHOLD) {
    ruleDetails.push({
      key: 'frequent_recharge_high',
      name: '高频储值',
      passed: false,
      riskLevel: 'high',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天内第 ${countAfterThis} 笔储值，频率偏高`,
      suggestion: '需要主管授权，确认客户是否为真实消费',
    })
  } else {
    ruleDetails.push({
      key: 'frequent_recharge',
      name: '储值频率校验',
      passed: true,
      riskLevel: 'low',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天已储值 ${recentRecharges.length} 笔，节奏正常`,
      suggestion: '',
    })
  }

  // 规则4：短期累计大额
  const cumulativeAfterThis = recentRecharges.reduce((sum, t) => sum + t.amount, 0) + amount
  if (cumulativeAfterThis >= SHORT_TERM_CUMULATIVE_THRESHOLD * 2) {
    ruleDetails.push({
      key: 'cumulative_large_critical',
      name: '短期累计超大量级',
      passed: false,
      riskLevel: 'critical',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天累计储值将达 ${formatCurrency(cumulativeAfterThis)}，远超正常消费水平`,
      suggestion: '必须店经理授权，建议核实客户身份与资金来源',
    })
  } else if (cumulativeAfterThis >= SHORT_TERM_CUMULATIVE_THRESHOLD) {
    ruleDetails.push({
      key: 'cumulative_large_high',
      name: '短期累计大额',
      passed: false,
      riskLevel: 'high',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天累计储值将达 ${formatCurrency(cumulativeAfterThis)}`,
      suggestion: '需要主管授权，确认客户是否有大项目规划',
    })
  } else {
    ruleDetails.push({
      key: 'cumulative_large',
      name: '累计金额校验',
      passed: true,
      riskLevel: 'low',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天累计储值 ${formatCurrency(cumulativeAfterThis)}，在正常范围`,
      suggestion: '',
    })
  }

  // 规则5：多人代付（基于付款人手机号 + 收银员）
  const recentPayers = new Set<string>()
  const recentCashiers = new Set<string>()
  for (const t of recentRecharges) {
    if (t.payerPhone) recentPayers.add(t.payerPhone)
    recentCashiers.add(t.cashierId)
  }
  if (payerPhone) recentPayers.add(payerPhone)
  recentCashiers.add(currentCashierId)

  const payerCount = recentPayers.size
  if (payerCount >= 3) {
    ruleDetails.push({
      key: 'multi_payer_critical',
      name: '多人代付（手机号维度）',
      passed: false,
      riskLevel: 'critical',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天内该会员卡有 ${payerCount} 个不同付款人手机号`,
      suggestion: '必须店经理授权，核实是否为集资、拼卡或违规代充',
    })
  } else if (payerCount >= 2) {
    ruleDetails.push({
      key: 'multi_payer_high',
      name: '双人代付（手机号维度）',
      passed: false,
      riskLevel: 'high',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天内该会员卡有 ${payerCount} 个不同付款人手机号`,
      suggestion: '需要主管授权，确认代付关系并留存付款人信息',
    })
  } else {
    ruleDetails.push({
      key: 'multi_payer',
      name: '代付人一致性校验',
      passed: true,
      riskLevel: 'low',
      message: payerCount <= 1 ? '付款人一致，无代付风险' : `有 ${payerCount} 个付款人，在允许范围`,
      suggestion: '',
    })
  }

  // 规则6：多收银员操作（侧面反映代付）
  if (recentCashiers.size >= 3) {
    ruleDetails.push({
      key: 'multi_cashier_high',
      name: '多收银员操作',
      passed: false,
      riskLevel: 'medium',
      message: `近 ${MULTI_PAYER_WINDOW_DAYS} 天内该卡由 ${recentCashiers.size} 位收银员操作`,
      suggestion: '关注是否存在代充或员工私下接单情况',
    })
  }

  // 汇总
  const failedRules = ruleDetails.filter((r) => !r.passed)
  const passed = failedRules.length === 0
  const overallRiskLevel = passed ? 'low' : combineRiskLevels(...failedRules.map((r) => r.riskLevel))
  const requiresApproval = !passed && overallRiskLevel !== 'low' && overallRiskLevel !== 'medium'
    ? true
    : overallRiskLevel === 'medium'
      ? false
      : !passed
  const approvalLevel = requiresApproval ? approvalForRisk(overallRiskLevel) : 'none'

  for (const r of failedRules) {
    warnings.push(r.message)
    if (r.suggestion) suggestions.push(r.suggestion)
  }

  return {
    passed,
    overallRiskLevel,
    warnings,
    ruleDetails,
    suggestions: Array.from(new Set(suggestions)),
    requiresApproval,
    approvalLevel,
  }
}

export const checkDiscountRules = (
  originalTotal: number,
  discountTotal: number,
  items: TransactionItem[],
): { passed: boolean; riskLevel: RiskLevel; warnings: string[]; suggestions: string[]; approvalLevel: 'none' | 'supervisor' | 'manager' } => {
  const warnings: string[] = []
  const suggestions: string[] = []
  if (originalTotal <= 0 || discountTotal >= originalTotal) {
    return { passed: true, riskLevel: 'low', warnings: [], suggestions: [], approvalLevel: 'none' }
  }
  const ratio = discountTotal / originalTotal
  let riskLevel: RiskLevel = 'low'

  if (ratio <= 0.5) {
    riskLevel = 'critical'
    warnings.push(`整单折扣低于 5 折（实际 ${(ratio * 100).toFixed(1)}%），属于极高风险折扣`)
    suggestions.push('必须店经理授权，建议登记折扣原因并保留书面凭证')
  } else if (ratio <= 0.7) {
    riskLevel = 'high'
    warnings.push(`整单折扣低于 7 折（实际 ${(ratio * 100).toFixed(1)}%），属于高风险折扣`)
    suggestions.push('需要主管授权，确认是否符合当期促销活动')
  } else if (ratio <= 0.85) {
    riskLevel = 'medium'
    warnings.push(`整单折扣约 ${(ratio * 100).toFixed(1)}%`)
    suggestions.push('建议确认折扣理由，系统自动记录')
  }

  const highDiscountItems = items.filter((i) => i.originalPrice > 0 && i.unitPrice / i.originalPrice <= 0.7)
  if (highDiscountItems.length > 0) {
    warnings.push(`有 ${highDiscountItems.length} 个项目折扣低于 7 折`)
  }

  const approvalLevel =
    riskLevel === 'critical' ? 'manager' : riskLevel === 'high' ? 'supervisor' : 'none'

  return {
    passed: riskLevel === 'low',
    riskLevel,
    warnings,
    suggestions,
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

export const transactionTypeLabels: Record<string, string> = {
  recharge: '储值充值',
  deduct: '项目扣款',
  refund: '退款',
  adjust: '手工调账',
}

export const calcValueDiscountRatio = (
  actualPayment: number,
  totalValue: number,
): number => {
  if (totalValue <= 0) return 1
  return actualPayment / totalValue
}

export const reviewStatusLabels: Record<string, string> = {
  unreviewed: '未复核',
  reviewed: '已复核',
  escalated: '需上报',
}

export const reviewStatusTags: Record<string, { bg: string; text: string }> = {
  unreviewed: { bg: 'bg-red-50', text: 'text-red-700' },
  reviewed: { bg: 'bg-green-50', text: 'text-green-700' },
  escalated: { bg: 'bg-orange-50', text: 'text-orange-700' },
}

export const reviewResultLabels: Record<string, string> = {
  pending: '待处理',
  approved: '同意通过',
  escalated: '上报处理',
  rejected: '驳回申请',
  adjusted: '已调账',
  refunded: '已退款',
}

export const reviewResultTags: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-50', text: 'text-gray-700' },
  approved: { bg: 'bg-green-50', text: 'text-green-700' },
  escalated: { bg: 'bg-orange-50', text: 'text-orange-700' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700' },
  adjusted: { bg: 'bg-blue-50', text: 'text-blue-700' },
  refunded: { bg: 'bg-purple-50', text: 'text-purple-700' },
}

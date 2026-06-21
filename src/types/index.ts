export type PaymentMethod = 'cash' | 'card' | 'wechat' | 'alipay' | 'stored'

export type TransactionType = 'recharge' | 'deduct' | 'refund' | 'adjust'

export type TransactionStatus = 'pending' | 'completed' | 'cancelled' | 'voided'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ReviewStatus = 'unreviewed' | 'reviewed' | 'escalated'

export type ReviewResult = 'pending' | 'approved' | 'escalated' | 'rejected' | 'adjusted' | 'refunded'

export type ApprovalLevel = 'none' | 'supervisor' | 'manager'

export interface Member {
  id: string
  memberCode: string
  name: string
  phone: string
  balance: number
  principal: number
  gift: number
  totalRecharge: number
  totalConsume: number
  createdAt: string
  lastConsumeAt: string | null
  level: 'normal' | 'silver' | 'gold' | 'diamond'
}

export interface TransactionItem {
  id: string
  transactionId: string
  projectId: string
  projectName: string
  doctorId: string
  doctorName: string
  consultantId: string
  consultantName: string
  treatmentNo: string
  originalPrice: number
  unitPrice: number
  quantity: number
  amount: number
  discountAmount: number
  discountRatio: number
  discountApprovalId?: string
}

export interface ApprovalRecord {
  id: string
  transactionId: string
  approverId: string
  approverName: string
  approvalLevel: ApprovalLevel
  approvalType: 'price_adjust' | 'large_recharge' | 'low_price' | 'multi_payer' | 'cancel' | 'other'
  reason: string
  originalValue?: number
  newValue?: number
  timestamp: string
}

export interface DiscountDetail {
  originalAmount: number
  discountAmount: number
  finalAmount: number
  discountRatio: number
  valueDiscountRatio?: number
  authorizationType: 'none' | 'supervisor' | 'manager'
  authorizedById?: string
  authorizedByName?: string
  authorizationReason?: string
}

export interface Transaction {
  id: string
  transactionNo: string
  memberId: string
  memberName: string
  memberCode: string
  type: TransactionType
  amount: number
  paymentMethod: PaymentMethod
  packageId?: string
  packageName?: string
  rechargePrincipal?: number
  rechargeGift?: number
  principalUsed?: number
  giftUsed?: number
  makeUpAmount?: number
  makeUpMethod?: PaymentMethod
  items?: TransactionItem[]
  consultantId?: string
  consultantName?: string
  signature?: string
  status: TransactionStatus
  cashierId: string
  cashierName: string
  remarks?: string
  warningFlags?: string[]
  riskLevel?: RiskLevel
  riskDetails?: string[]
  approvalRecords?: ApprovalRecord[]
  discountDetail?: DiscountDetail
  payerName?: string
  payerPhone?: string
  isThirdPartyPayer?: boolean
  createdAt: string
  updatedAt: string
  cancelledAt?: string
  cancelReason?: string
  cancelApproval?: ApprovalRecord
  receiptPrintCount: number
  manualAdjusted: boolean
  originalAmount?: number
  reviewStatus: ReviewStatus
  reviewer?: string
  reviewNote?: string
  reviewedAt?: string
  riskSuggestions?: string[]
  followSuggestion?: boolean
  reviewResult?: ReviewResult
}

export interface Cashier {
  id: string
  name: string
  code: string
  shift: 'morning' | 'afternoon' | 'night'
}

export interface ShiftSummary {
  id: string
  cashierId: string
  cashierName: string
  shiftDate: string
  shift: 'morning' | 'afternoon' | 'night'
  cashTotal: number
  cardTotal: number
  wechatTotal: number
  alipayTotal: number
  storedDeductTotal: number
  rechargeTotal: number
  refundTotal: number
  makeUpTotal: number
  transactionCount: number
  rechargeCount: number
  deductCount: number
  refundCount: number
  abnormalTransactions: string[]
  approvalCount: number
  thirdPartyPayCount: number
  cashCount: number
  cardCount: number
  wechatCount: number
  alipayCount: number
  startedAt: string
  endedAt?: string
  status: 'active' | 'closed'
}

export interface Project {
  id: string
  name: string
  category: string
  price: number
  isActive: boolean
}

export interface Doctor {
  id: string
  name: string
  department: string
  title: string
}

export interface Consultant {
  id: string
  name: string
  department: string
}

export interface Package {
  id: string
  name: string
  originalPrice: number
  packagePrice: number
  giftAmount: number
  isActive: boolean
}

export interface RuleDetail {
  key: string
  name: string
  passed: boolean
  riskLevel: RiskLevel
  message: string
  suggestion: string
}

export interface RuleCheckResult {
  passed: boolean
  overallRiskLevel: RiskLevel
  warnings: string[]
  ruleDetails: RuleDetail[]
  suggestions: string[]
  requiresApproval: boolean
  approvalLevel: ApprovalLevel
}

export interface AbnormalAlert {
  id: string
  type: 'cancel' | 'reprint' | 'adjust' | 'multi_payer' | 'large_amount' | 'low_price' | 'discount'
  message: string
  transactionId?: string
  cashierId: string
  timestamp: string
  level: 'warning' | 'danger'
}

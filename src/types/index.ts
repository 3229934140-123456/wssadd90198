export type PaymentMethod = 'cash' | 'card' | 'wechat' | 'alipay' | 'stored'

export type TransactionType = 'recharge' | 'deduct' | 'refund' | 'adjust'

export type TransactionStatus = 'pending' | 'completed' | 'cancelled' | 'voided'

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
  unitPrice: number
  quantity: number
  amount: number
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
  items?: TransactionItem[]
  consultantId?: string
  consultantName?: string
  signature?: string
  status: TransactionStatus
  cashierId: string
  cashierName: string
  remarks?: string
  warningFlags?: string[]
  createdAt: string
  updatedAt: string
  cancelledAt?: string
  cancelReason?: string
  receiptPrintCount: number
  manualAdjusted: boolean
  originalAmount?: number
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
  transactionCount: number
  rechargeCount: number
  deductCount: number
  refundCount: number
  abnormalTransactions: string[]
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

export interface RuleCheckResult {
  passed: boolean
  warnings: string[]
  requiresApproval: boolean
  approvalLevel: 'none' | 'supervisor' | 'manager'
}

export interface AbnormalAlert {
  id: string
  type: 'cancel' | 'reprint' | 'adjust' | 'multi_payer' | 'large_amount' | 'low_price'
  message: string
  transactionId?: string
  cashierId: string
  timestamp: string
  level: 'warning' | 'danger'
}

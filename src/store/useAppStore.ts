import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  Member,
  Transaction,
  TransactionItem,
  ShiftSummary,
  AbnormalAlert,
  Cashier,
  PaymentMethod,
  TransactionType,
  ApprovalRecord,
  RiskLevel,
  DiscountDetail,
} from '../types'
import {
  mockMembers,
  mockTransactions,
  mockCurrentShift,
  mockCashiers,
  mockProjects,
  mockDoctors,
  mockConsultants,
  mockPackages,
} from '../data/mockData'

interface CreateTransactionParams {
  type: TransactionType
  memberId: string
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
  remarks?: string
  payerName?: string
  payerPhone?: string
  isThirdPartyPayer?: boolean
  approvalRecords?: Array<Partial<ApprovalRecord> & Pick<ApprovalRecord, 'approverId' | 'approverName' | 'approvalLevel' | 'approvalType' | 'reason'>>
  discountDetail?: DiscountDetail
  riskLevel?: RiskLevel
  riskDetails?: string[]
  warningFlags?: string[]
  makeUpAmount?: number
  makeUpMethod?: PaymentMethod
  principalUsed?: number
  giftUsed?: number
}

interface AppState {
  currentCashier: Cashier
  cashiers: Cashier[]
  members: Member[]
  transactions: Transaction[]
  currentShift: ShiftSummary
  currentMember: Member | null
  abnormalAlerts: AbnormalAlert[]
  projects: typeof mockProjects
  doctors: typeof mockDoctors
  consultants: typeof mockConsultants
  packages: typeof mockPackages
  cancelStreak: Record<string, number>

  setCurrentCashier: (cashier: Cashier) => void
  setCurrentMember: (member: Member | null) => void
  findMemberByCode: (code: string) => Member | null
  clearCurrentMember: () => void

  createTransaction: (data: CreateTransactionParams) => Transaction
  cancelTransaction: (transactionId: string, reason: string, approval?: ApprovalRecord) => void
  incrementReceiptPrint: (transactionId: string) => void
  addApprovalRecord: (transactionId: string, approval: Omit<ApprovalRecord, 'id' | 'transactionId' | 'timestamp'>) => void

  closeShift: () => ShiftSummary
  addAbnormalAlert: (alert: Omit<AbnormalAlert, 'id' | 'timestamp'>) => void
  clearAbnormalAlerts: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 12)
const generateTransactionNo = () => {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `TX${date}${rand}`
}
const nowStr = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentCashier: mockCashiers[0],
      cashiers: mockCashiers,
      members: mockMembers,
      transactions: mockTransactions,
      currentShift: mockCurrentShift,
      currentMember: null,
      abnormalAlerts: [],
      projects: mockProjects,
      doctors: mockDoctors,
      consultants: mockConsultants,
      packages: mockPackages,
      cancelStreak: {},

      setCurrentCashier: (cashier) => set({ currentCashier: cashier }),

      setCurrentMember: (member) => set({ currentMember: member }),

      findMemberByCode: (code) => {
        return get().members.find((m) => m.memberCode === code) || null
      },

      clearCurrentMember: () => set({ currentMember: null }),

      addApprovalRecord: (transactionId, approval) => {
        set((state) => {
          const tx = state.transactions.find((t) => t.id === transactionId)
          if (!tx) return state
          const record: ApprovalRecord = {
            ...approval,
            id: generateId(),
            transactionId,
            timestamp: nowStr(),
          }
          const newTx: Transaction = {
            ...tx,
            approvalRecords: [...(tx.approvalRecords || []), record],
            updatedAt: nowStr(),
          }
          const shift = { ...state.currentShift }
          shift.approvalCount = (shift.approvalCount || 0) + 1
          if (!shift.abnormalTransactions.includes(transactionId)) {
            shift.abnormalTransactions = [...shift.abnormalTransactions, transactionId]
          }
          return {
            transactions: state.transactions.map((t) => (t.id === transactionId ? newTx : t)),
            currentShift: shift,
          }
        })
      },

      createTransaction: (data) => {
        const member = get().members.find((m) => m.id === data.memberId)!
        const cashier = get().currentCashier

        let principalUsed = data.principalUsed
        let giftUsed = data.giftUsed
        if (data.type === 'deduct' && principalUsed === undefined && giftUsed === undefined) {
          let remain = data.amount
          const gift = Math.min(remain, member.gift)
          remain -= gift
          giftUsed = gift
          principalUsed = remain
        }

        const txId = generateId()
        const txNo = generateTransactionNo()
        const now = nowStr()

        const approvalRecords: ApprovalRecord[] = (data.approvalRecords || []).map((appr) => ({
          ...appr,
          id: appr.id || generateId(),
          transactionId: appr.transactionId || txId,
          timestamp: appr.timestamp || now,
        }))

        const tx: Transaction = {
          id: txId,
          transactionNo: txNo,
          memberId: member.id,
          memberName: member.name,
          memberCode: member.memberCode,
          type: data.type,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          packageId: data.packageId,
          packageName: data.packageName,
          rechargePrincipal: data.rechargePrincipal,
          rechargeGift: data.rechargeGift,
          principalUsed,
          giftUsed,
          makeUpAmount: data.makeUpAmount,
          makeUpMethod: data.makeUpMethod,
          items: data.items,
          consultantId: data.consultantId,
          consultantName: data.consultantName,
          signature: data.signature,
          status: 'completed',
          cashierId: cashier.id,
          cashierName: cashier.name,
          remarks: data.remarks,
          warningFlags: data.warningFlags || (data.riskDetails && data.riskDetails.length > 0 ? data.riskDetails : undefined),
          riskLevel: data.riskLevel,
          riskDetails: data.riskDetails,
          approvalRecords,
          discountDetail: data.discountDetail,
          payerName: data.payerName,
          payerPhone: data.payerPhone,
          isThirdPartyPayer: data.isThirdPartyPayer,
          createdAt: now,
          updatedAt: now,
          receiptPrintCount: 0,
          manualAdjusted: !!data.discountDetail && data.discountDetail.discountAmount > 0,
          originalAmount: data.discountDetail?.originalAmount,
        }

        set((state) => {
          const newMembers = state.members.map((m) => {
            if (m.id !== member.id) return m
            if (data.type === 'recharge') {
              const principal = (data.rechargePrincipal || 0) + (data.makeUpAmount || 0)
              return {
                ...m,
                balance: m.balance + principal + (data.rechargeGift || 0),
                principal: m.principal + principal,
                gift: m.gift + (data.rechargeGift || 0),
                totalRecharge: m.totalRecharge + principal,
                lastConsumeAt: nowStr(),
              }
            } else if (data.type === 'deduct') {
              return {
                ...m,
                balance: m.balance - data.amount,
                principal: m.principal - (principalUsed || 0),
                gift: m.gift - (giftUsed || 0),
                totalConsume: m.totalConsume + data.amount,
                lastConsumeAt: nowStr(),
              }
            } else if (data.type === 'refund') {
              return {
                ...m,
                balance: m.balance + data.amount,
                principal: m.principal + data.amount,
              }
            }
            return m
          })

          const shift = { ...state.currentShift }
          shift.transactionCount += 1

          if (data.type === 'recharge') {
            shift.rechargeTotal += data.amount
            shift.rechargeCount += 1
            if (data.makeUpAmount && data.makeUpMethod) {
              shift.makeUpTotal = (shift.makeUpTotal || 0) + data.makeUpAmount
            }
            if (data.paymentMethod === 'cash') { shift.cashTotal += data.amount; shift.cashCount += 1 }
            if (data.paymentMethod === 'card') { shift.cardTotal += data.amount; shift.cardCount += 1 }
            if (data.paymentMethod === 'wechat') { shift.wechatTotal += data.amount; shift.wechatCount += 1 }
            if (data.paymentMethod === 'alipay') { shift.alipayTotal += data.amount; shift.alipayCount += 1 }
          } else if (data.type === 'deduct') {
            shift.deductCount += 1
            if (data.paymentMethod === 'stored') { shift.storedDeductTotal += data.amount }
            if (data.paymentMethod === 'cash') { shift.cashTotal += data.amount; shift.cashCount += 1 }
            if (data.paymentMethod === 'card') { shift.cardTotal += data.amount; shift.cardCount += 1 }
            if (data.paymentMethod === 'wechat') { shift.wechatTotal += data.amount; shift.wechatCount += 1 }
            if (data.paymentMethod === 'alipay') { shift.alipayTotal += data.amount; shift.alipayCount += 1 }
          } else if (data.type === 'refund') {
            shift.refundTotal += data.amount
            shift.refundCount += 1
          }

          if (data.approvalRecords && data.approvalRecords.length > 0) {
            shift.approvalCount = (shift.approvalCount || 0) + data.approvalRecords.length
          }
          if (data.isThirdPartyPayer) {
            shift.thirdPartyPayCount = (shift.thirdPartyPayCount || 0) + 1
          }

          const hasRisk = data.riskLevel && data.riskLevel !== 'low' && data.riskLevel !== 'medium'
          if (hasRisk && !shift.abnormalTransactions.includes(tx.id)) {
            shift.abnormalTransactions = [...shift.abnormalTransactions, tx.id]
          }
          if (data.discountDetail && data.discountDetail.discountAmount > 0 && !shift.abnormalTransactions.includes(tx.id)) {
            shift.abnormalTransactions = [...shift.abnormalTransactions, tx.id]
          }

          const cancelStreak = { ...state.cancelStreak }
          cancelStreak[cashier.id] = 0

          return {
            members: newMembers,
            transactions: [tx, ...state.transactions],
            currentShift: shift,
            currentMember: newMembers.find((m) => m.id === member.id) || null,
            cancelStreak,
          }
        })

        return tx
      },

      cancelTransaction: (transactionId, reason, approval) => {
        const cashier = get().currentCashier
        set((state) => {
          const tx = state.transactions.find((t) => t.id === transactionId)
          if (!tx || tx.status !== 'completed') return state

          const newMembers = state.members.map((m) => {
            if (m.id !== tx.memberId) return m
            if (tx.type === 'recharge') {
              const principal = tx.rechargePrincipal || 0
              const gift = tx.rechargeGift || 0
              return {
                ...m,
                balance: m.balance - principal - gift,
                principal: m.principal - principal,
                gift: m.gift - gift,
                totalRecharge: m.totalRecharge - principal,
              }
            } else if (tx.type === 'deduct') {
              return {
                ...m,
                balance: m.balance + tx.amount,
                principal: m.principal + (tx.principalUsed || tx.amount),
                gift: m.gift + (tx.giftUsed || 0),
                totalConsume: m.totalConsume - tx.amount,
              }
            }
            return m
          })

          const shift = { ...state.currentShift }
          shift.transactionCount -= 1
          if (tx.type === 'recharge') {
            shift.rechargeTotal -= tx.amount
            shift.rechargeCount -= 1
            if (tx.paymentMethod === 'cash') { shift.cashTotal -= tx.amount; shift.cashCount -= 1 }
            if (tx.paymentMethod === 'card') { shift.cardTotal -= tx.amount; shift.cardCount -= 1 }
            if (tx.paymentMethod === 'wechat') { shift.wechatTotal -= tx.amount; shift.wechatCount -= 1 }
            if (tx.paymentMethod === 'alipay') { shift.alipayTotal -= tx.amount; shift.alipayCount -= 1 }
          } else if (tx.type === 'deduct') {
            shift.deductCount -= 1
            if (tx.paymentMethod === 'stored') { shift.storedDeductTotal -= tx.amount }
            if (tx.paymentMethod === 'cash') { shift.cashTotal -= tx.amount; shift.cashCount -= 1 }
            if (tx.paymentMethod === 'card') { shift.cardTotal -= tx.amount; shift.cardCount -= 1 }
            if (tx.paymentMethod === 'wechat') { shift.wechatTotal -= tx.amount; shift.wechatCount -= 1 }
            if (tx.paymentMethod === 'alipay') { shift.alipayTotal -= tx.amount; shift.alipayCount -= 1 }
          }

          const newStreak = (state.cancelStreak[cashier.id] || 0) + 1
          const cancelStreak = { ...state.cancelStreak, [cashier.id]: newStreak }

          const newAlerts: AbnormalAlert[] = [...state.abnormalAlerts]
          if (newStreak >= 2) {
            newAlerts.push({
              id: generateId(),
              type: 'cancel',
              message: `收银员 ${cashier.name} 已连续取消 ${newStreak} 笔交易，请关注`,
              transactionId,
              cashierId: cashier.id,
              timestamp: nowStr(),
              level: newStreak >= 3 ? 'danger' : 'warning',
            })
          }

          const newFlags = [...(tx.warningFlags || [])]
          if (newStreak >= 2 && !newFlags.includes('连续取消交易')) {
            newFlags.push('连续取消交易')
          }

          const newTx: Transaction = {
            ...tx,
            status: 'cancelled',
            cancelledAt: nowStr(),
            cancelReason: reason,
            cancelApproval: approval,
            warningFlags: newFlags,
            updatedAt: nowStr(),
          }

          if ((newStreak >= 2 || (tx.riskLevel && tx.riskLevel !== 'low')) && !shift.abnormalTransactions.includes(transactionId)) {
            shift.abnormalTransactions = [...shift.abnormalTransactions, transactionId]
          }

          return {
            members: newMembers,
            transactions: state.transactions.map((t) => (t.id === transactionId ? newTx : t)),
            currentShift: shift,
            abnormalAlerts: newAlerts,
            cancelStreak,
            currentMember: state.currentMember?.id === tx.memberId
              ? newMembers.find((m) => m.id === tx.memberId) || null
              : state.currentMember,
          }
        })
      },

      incrementReceiptPrint: (transactionId) => {
        const cashier = get().currentCashier
        set((state) => {
          const tx = state.transactions.find((t) => t.id === transactionId)
          if (!tx) return state
          const newCount = tx.receiptPrintCount + 1
          const newFlags = [...(tx.warningFlags || [])]
          if (newCount >= 3 && !newFlags.includes('反复重打小票')) {
            newFlags.push('反复重打小票')
          }

          const newAlerts: AbnormalAlert[] = [...state.abnormalAlerts]
          if (newCount === 3) {
            newAlerts.push({
              id: generateId(),
              type: 'reprint',
              message: `交易 ${tx.transactionNo} 小票已重复打印 ${newCount} 次`,
              transactionId,
              cashierId: cashier.id,
              timestamp: nowStr(),
              level: 'warning',
            })
          }

          const shift = { ...state.currentShift }
          if (newCount >= 3 && !shift.abnormalTransactions.includes(transactionId)) {
            shift.abnormalTransactions = [...shift.abnormalTransactions, transactionId]
          }

          return {
            transactions: state.transactions.map((t) =>
              t.id === transactionId
                ? { ...t, receiptPrintCount: newCount, warningFlags: newFlags, updatedAt: nowStr() }
                : t,
            ),
            abnormalAlerts: newAlerts,
            currentShift: shift,
          }
        })
      },

      closeShift: () => {
        set((state) => {
          const closed: ShiftSummary = {
            ...state.currentShift,
            status: 'closed',
            endedAt: nowStr(),
          }
          return { currentShift: closed }
        })
        return get().currentShift
      },

      addAbnormalAlert: (alert) => {
        set((state) => ({
          abnormalAlerts: [
            { ...alert, id: generateId(), timestamp: nowStr() },
            ...state.abnormalAlerts,
          ],
        }))
      },

      clearAbnormalAlerts: () => set({ abnormalAlerts: [] }),
    }),
    {
      name: 'medical-aesthetic-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        members: state.members,
        transactions: state.transactions,
        currentShift: state.currentShift,
        abnormalAlerts: state.abnormalAlerts,
      }),
    },
  ),
)

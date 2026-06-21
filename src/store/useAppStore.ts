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
  recentTransactions: Transaction[]
  cancelStreak: Record<string, number>
  lastTransactionByMember: Record<string, string | null>

  setCurrentCashier: (cashier: Cashier) => void
  setCurrentMember: (member: Member | null) => void
  findMemberByCode: (code: string) => Member | null
  createTransaction: (data: {
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
  }) => Transaction
  cancelTransaction: (transactionId: string, reason: string) => void
  incrementReceiptPrint: (transactionId: string) => void
  adjustTransactionAmount: (transactionId: string, newAmount: number, reason: string) => void
  closeShift: () => ShiftSummary
  clearCurrentMember: () => void
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
      recentTransactions: [],
      cancelStreak: {},
      lastTransactionByMember: {},

      setCurrentCashier: (cashier) => set({ currentCashier: cashier }),

      setCurrentMember: (member) => set({ currentMember: member }),

      findMemberByCode: (code) => {
        return get().members.find((m) => m.memberCode === code) || null
      },

      clearCurrentMember: () => set({ currentMember: null }),

      createTransaction: (data) => {
        const member = get().members.find((m) => m.id === data.memberId)!
        const cashier = get().currentCashier
        const warnings: string[] = []

        const tx: Transaction = {
          id: generateId(),
          transactionNo: generateTransactionNo(),
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
          items: data.items,
          consultantId: data.consultantId,
          consultantName: data.consultantName,
          signature: data.signature,
          status: 'completed',
          cashierId: cashier.id,
          cashierName: cashier.name,
          remarks: data.remarks,
          warningFlags: warnings.length > 0 ? warnings : undefined,
          createdAt: nowStr(),
          updatedAt: nowStr(),
          receiptPrintCount: 0,
          manualAdjusted: false,
        }

        set((state) => {
          const newMembers = state.members.map((m) => {
            if (m.id !== member.id) return m
            if (data.type === 'recharge') {
              return {
                ...m,
                balance: m.balance + (data.rechargePrincipal || 0) + (data.rechargeGift || 0),
                principal: m.principal + (data.rechargePrincipal || 0),
                gift: m.gift + (data.rechargeGift || 0),
                totalRecharge: m.totalRecharge + (data.rechargePrincipal || 0),
                lastConsumeAt: nowStr(),
              }
            } else if (data.type === 'deduct') {
              let newPrincipal = m.principal
              let newGift = m.gift
              let remain = data.amount
              const giftUsed = Math.min(remain, m.gift)
              remain -= giftUsed
              newGift -= giftUsed
              const principalUsed = Math.min(remain, m.principal)
              newPrincipal -= principalUsed
              return {
                ...m,
                balance: m.balance - data.amount,
                principal: newPrincipal,
                gift: newGift,
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
          if (data.type === 'recharge') {
            shift.rechargeTotal += data.amount
            shift.rechargeCount += 1
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
          shift.transactionCount += 1

          const lastByMember = { ...state.lastTransactionByMember }
          const cancelStreak = { ...state.cancelStreak }
          cancelStreak[cashier.id] = 0

          return {
            members: newMembers,
            transactions: [tx, ...state.transactions],
            currentShift: shift,
            currentMember: newMembers.find((m) => m.id === member.id) || null,
            lastTransactionByMember: lastByMember,
            cancelStreak,
          }
        })

        return tx
      },

      cancelTransaction: (transactionId, reason) => {
        const cashier = get().currentCashier
        set((state) => {
          const tx = state.transactions.find((t) => t.id === transactionId)
          if (!tx || tx.status !== 'completed') return state

          const newMembers = state.members.map((m) => {
            if (m.id !== tx.memberId) return m
            if (tx.type === 'recharge') {
              return {
                ...m,
                balance: m.balance - (tx.rechargePrincipal || 0) - (tx.rechargeGift || 0),
                principal: m.principal - (tx.rechargePrincipal || 0),
                gift: m.gift - (tx.rechargeGift || 0),
                totalRecharge: m.totalRecharge - (tx.rechargePrincipal || 0),
              }
            } else if (tx.type === 'deduct') {
              return {
                ...m,
                balance: m.balance + tx.amount,
                principal: m.principal + tx.amount,
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

          const newTx: Transaction = {
            ...tx,
            status: 'cancelled',
            cancelledAt: nowStr(),
            cancelReason: reason,
            warningFlags: newStreak >= 2 ? [...(tx.warningFlags || []), '连续取消交易'] : tx.warningFlags,
          }

          if (newStreak >= 2 && !shift.abnormalTransactions.includes(transactionId)) {
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
          const newFlags = newCount >= 3
            ? [...(tx.warningFlags || []), '反复重打小票']
            : tx.warningFlags

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

      adjustTransactionAmount: (transactionId, newAmount, reason) => {
        const cashier = get().currentCashier
        set((state) => {
          const tx = state.transactions.find((t) => t.id === transactionId)
          if (!tx || tx.status !== 'completed') return state

          const diff = newAmount - tx.amount

          const newMembers = state.members.map((m) => {
            if (m.id !== tx.memberId) return m
            if (tx.type === 'deduct') {
              return {
                ...m,
                balance: m.balance - diff,
                principal: tx.paymentMethod === 'stored' ? m.principal - diff : m.principal,
                totalConsume: m.totalConsume + diff,
              }
            }
            return m
          })

          const shift = { ...state.currentShift }
          if (tx.type === 'deduct') {
            if (tx.paymentMethod === 'stored') shift.storedDeductTotal += diff
            if (tx.paymentMethod === 'cash') { shift.cashTotal += diff }
          }

          const newAlerts: AbnormalAlert[] = [
            ...state.abnormalAlerts,
            {
              id: generateId(),
              type: 'adjust',
              message: `交易 ${tx.transactionNo} 金额手工调整: ${tx.amount} → ${newAmount}，原因: ${reason}`,
              transactionId,
              cashierId: cashier.id,
              timestamp: nowStr(),
              level: 'danger',
            },
          ]

          if (!shift.abnormalTransactions.includes(transactionId)) {
            shift.abnormalTransactions = [...shift.abnormalTransactions, transactionId]
          }

          const newTx: Transaction = {
            ...tx,
            amount: newAmount,
            manualAdjusted: true,
            originalAmount: tx.originalAmount || tx.amount,
            warningFlags: [...(tx.warningFlags || []), '手工调整金额'],
            remarks: tx.remarks ? `${tx.remarks}; 手工调账: ${reason}` : `手工调账: ${reason}`,
            updatedAt: nowStr(),
          }

          return {
            members: newMembers,
            transactions: state.transactions.map((t) => (t.id === transactionId ? newTx : t)),
            currentShift: shift,
            abnormalAlerts: newAlerts,
            currentMember: state.currentMember?.id === tx.memberId
              ? newMembers.find((m) => m.id === tx.memberId) || null
              : state.currentMember,
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
          return {
            currentShift: closed,
          }
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

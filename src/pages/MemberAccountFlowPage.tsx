import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import {
  maskName,
  maskPhone,
  formatCurrency,
  levelColorMap,
  paymentMethodLabels,
  transactionTypeLabels,
} from '../utils/rules'
import type { Transaction } from '../types'

interface FlowRecord {
  id: string
  transactionId: string
  transactionNo: string
  type: string
  time: string
  principalChange: number
  giftChange: number
  balanceAfter: number
  principalAfter: number
  giftAfter: number
  description: string
  cashierName: string
  transaction: Transaction
}

export default function MemberAccountFlowPage() {
  const navigate = useNavigate()
  const currentMember = useAppStore((s) => s.currentMember)
  const transactions = useAppStore((s) => s.transactions)
  const setCurrentMember = useAppStore((s) => s.clearCurrentMember)
  const currentShift = useAppStore((s) => s.currentShift)

  if (!currentMember) {
    return <Navigate to="/scan" replace />
  }

  const memberTxs = [...transactions]
    .filter((t) => t.memberId === currentMember.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const flowRecords: FlowRecord[] = []

  let runningPrincipal = currentMember.principal
  let runningGift = currentMember.gift

  for (const tx of memberTxs) {
    let principalChange = 0
    let giftChange = 0
    let description = ''

    if (tx.type === 'recharge') {
      const makeUp = tx.makeUpAmount || 0
      const principal = (tx.rechargePrincipal || 0) + makeUp
      const gift = tx.rechargeGift || 0
      principalChange = principal
      giftChange = gift
      if (makeUp > 0) {
        description = `储值充值（含补缴 ${formatCurrency(makeUp)}）`
      } else {
        description = '储值充值'
      }
      if (tx.status === 'cancelled') {
        principalChange = -principal
        giftChange = -gift
        description = `${description}（已取消）`
      }
    } else if (tx.type === 'deduct') {
      const makeUp = tx.makeUpAmount || 0
      const principalUsed = tx.principalUsed || 0
      const giftUsed = tx.giftUsed || 0
      principalChange = makeUp - principalUsed
      giftChange = -giftUsed
      if (makeUp > 0) {
        description = `项目扣款 ${formatCurrency(tx.amount)}（补缴 ${formatCurrency(makeUp)} + 扣本金 ${formatCurrency(principalUsed)} + 赠金抵 ${formatCurrency(giftUsed)}）`
      } else {
        description = `项目扣款 ${formatCurrency(tx.amount)}（扣本金 ${formatCurrency(principalUsed)} + 赠金抵 ${formatCurrency(giftUsed)}）`
      }
      if (tx.status === 'cancelled') {
        principalChange = -(makeUp - principalUsed)
        giftChange = giftUsed
        description = `${description}（已取消回退）`
      }
    } else if (tx.type === 'refund') {
      principalChange = tx.amount
      giftChange = 0
      description = `退款 ${formatCurrency(tx.amount)}（退回本金）`
      if (tx.status === 'cancelled') {
        principalChange = -tx.amount
        description = `${description}（已取消）`
      }
    } else if (tx.type === 'adjust') {
      description = `手工调账 ${formatCurrency(tx.amount)}`
    }

    const principalAfter = runningPrincipal
    const giftAfter = runningGift
    const balanceAfter = runningPrincipal + runningGift

    flowRecords.push({
      id: `${tx.id}-flow`,
      transactionId: tx.id,
      transactionNo: tx.transactionNo,
      type: tx.type,
      time: tx.createdAt,
      principalChange,
      giftChange,
      balanceAfter,
      principalAfter,
      giftAfter,
      description,
      cashierName: tx.cashierName,
      transaction: tx,
    })

    runningPrincipal -= principalChange
    runningGift -= giftChange
  }

  const levelInfo = levelColorMap[currentMember.level]
  const totalIn = flowRecords.reduce((s, r) => s + Math.max(r.principalChange + r.giftChange, 0), 0)
  const totalOut = flowRecords.reduce((s, r) => s + Math.max(-(r.principalChange + r.giftChange), 0), 0)

  const goToShiftDetail = (tx: Transaction) => {
    if (currentShift.abnormalTransactions.includes(tx.id) || currentShift.transactionCount > 0) {
      navigate('/shift', { state: { highlightTxId: tx.id } })
    }
  }

  return (
    <div className="page-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>会员账户流水</h1>
          <p className="page-subtitle">完整追溯每一笔储值、赠金、扣款、补缴、取消回退后的本金和赠金变化</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/member')}>
            ← 返回会员详情
          </button>
        </div>
      </div>

      <div className="member-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="member-avatar" style={{ width: 56, height: 56, fontSize: 22 }}>
            {maskName(currentMember.name).charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="text-bold" style={{ fontSize: 18 }}>{maskName(currentMember.name)}</span>
              <span className={`member-level-tag ${levelInfo.bg} ${levelInfo.text}`}>
                {levelInfo.label}
              </span>
              <span className="text-gray" style={{ fontSize: 13 }}>{currentMember.memberCode}</span>
            </div>
            <div className="text-gray" style={{ fontSize: 13 }}>
              手机号：{maskPhone(currentMember.phone)} · 注册：{currentMember.createdAt.slice(0, 10)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>当前余额</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#db2777' }}>
              {formatCurrency(currentMember.balance)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              本金 {formatCurrency(currentMember.principal)} · 赠金 {formatCurrency(currentMember.gift)}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
          marginTop: 20, paddingTop: 20, borderTop: '1px solid #e5e7eb',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>累计储值</div>
            <div className="text-green text-bold" style={{ fontSize: 18 }}>
              {formatCurrency(currentMember.totalRecharge)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>累计消费</div>
            <div className="text-pink text-bold" style={{ fontSize: 18 }}>
              {formatCurrency(currentMember.totalConsume)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>流水累计入账</div>
            <div className="text-green text-bold" style={{ fontSize: 18 }}>
              +{formatCurrency(totalIn)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>流水累计出账</div>
            <div className="text-pink text-bold" style={{ fontSize: 18 }}>
              -{formatCurrency(totalOut)}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">账户变动明细（按时间倒序）</h3>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          💡 每一行展示变动后的余额状态，点击"查看交班"可追查到交班详情中的这笔交易
        </div>

        {flowRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">该会员暂无账户流水记录</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>序号</th>
                <th>交易时间</th>
                <th>交易单号</th>
                <th>类型</th>
                <th>变动说明</th>
                <th style={{ textAlign: 'right', width: 110 }}>本金变动</th>
                <th style={{ textAlign: 'right', width: 110 }}>赠金变动</th>
                <th style={{ textAlign: 'right', width: 120 }}>变动后本金</th>
                <th style={{ textAlign: 'right', width: 120 }}>变动后赠金</th>
                <th style={{ textAlign: 'right', width: 120 }}>变动后余额</th>
                <th>收银员</th>
                <th style={{ width: 110 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {flowRecords.map((r, idx) => (
                <tr
                  key={r.id}
                  style={{
                    background: r.transaction.status === 'cancelled' ? '#fef2f2' : undefined,
                  }}
                >
                  <td className="text-gray">{idx + 1}</td>
                  <td className="text-gray" style={{ fontSize: 12 }}>{r.time}</td>
                  <td className="text-bold font-mono">{r.transactionNo}</td>
                  <td>
                    {r.transaction.status === 'cancelled' ? (
                      <span className="tag tag-danger">已取消</span>
                    ) : r.type === 'recharge' ? (
                      <span className="tag tag-success">{transactionTypeLabels[r.type]}</span>
                    ) : r.type === 'deduct' ? (
                      <span className="tag tag-info">{transactionTypeLabels[r.type]}</span>
                    ) : (
                      <span className="tag">{transactionTypeLabels[r.type] || r.type}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{r.description}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={r.principalChange >= 0 ? 'text-green' : 'text-pink'}>
                      {r.principalChange >= 0 ? '+' : ''}{formatCurrency(r.principalChange)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={r.giftChange >= 0 ? 'text-green' : 'text-orange'}>
                      {r.giftChange >= 0 ? '+' : ''}{formatCurrency(r.giftChange)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                    {formatCurrency(r.principalAfter)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#f97316' }}>
                    {formatCurrency(r.giftAfter)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#db2777' }}>
                    {formatCurrency(r.balanceAfter)}
                  </td>
                  <td>{r.cashierName}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => goToShiftDetail(r.transaction)}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >
                      🔍 查看交班
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {flowRecords.length > 0 && (
          <div style={{
            marginTop: 16, padding: 16, background: '#f0fdf4',
            border: '1px solid #bbf7d0', borderRadius: 12,
            fontSize: 13, lineHeight: 1.8,
          }}>
            <div className="text-bold text-green-800" style={{ marginBottom: 4 }}>📊 账户平衡校验</div>
            <div>
              期末余额 = {formatCurrency(currentMember.balance)}
              = 期末本金 {formatCurrency(currentMember.principal)} + 期末赠金 {formatCurrency(currentMember.gift)}
              {' '}✓
            </div>
            <div>
              净变动 = 累计入账 +{formatCurrency(totalIn)} - 累计出账 -{formatCurrency(totalOut)}
              = {formatCurrency(totalIn - totalOut)}
            </div>
          </div>
        )}
      </div>

      <div className="action-bar" style={{ marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/member')}>
          ← 返回会员详情
        </button>
        <button className="btn btn-secondary" onClick={() => { setCurrentMember(); navigate('/scan') }}>
          🔄 退出此会员
        </button>
      </div>
    </div>
  )
}

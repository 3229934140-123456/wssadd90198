import { useMemo, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import {
  formatCurrency,
  paymentMethodLabels,
  transactionTypeLabels,
  riskLevelConfig,
  maskPhone,
  maskName,
  reviewStatusLabels,
  reviewStatusTags,
  reviewResultLabels,
  reviewResultTags,
  calcValueDiscountRatio,
} from '../utils/rules'
import type { Transaction, PaymentMethod, RiskLevel, ReviewStatus, ReviewResult } from '../types'

export default function ShiftSummaryPage() {
  const currentShift = useAppStore((s) => s.currentShift)
  const transactions = useAppStore((s) => s.transactions)
  const abnormalAlerts = useAppStore((s) => s.abnormalAlerts)
  const clearAbnormalAlerts = useAppStore((s) => s.clearAbnormalAlerts)
  const cancelTransaction = useAppStore((s) => s.cancelTransaction)
  const incrementReceiptPrint = useAppStore((s) => s.incrementReceiptPrint)
  const closeShift = useAppStore((s) => s.closeShift)
  const members = useAppStore((s) => s.members)
  const reviewTransaction = useAppStore((s) => s.reviewTransaction)
  const location = useLocation()

  const [selectedTx, setSelectedTx] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [signatureTxId, setSignatureTxId] = useState<string | null>(null)
  const [shiftClosed, setShiftClosed] = useState(false)

  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [detailTxId, setDetailTxId] = useState<string | null>(null)

  const [filterMember, setFilterMember] = useState('')
  const [filterPayMethod, setFilterPayMethod] = useState<PaymentMethod | ''>('')
  const [filterAbnormalType, setFilterAbnormalType] = useState('')
  const [filterTxType, setFilterTxType] = useState<string>('')
  const [filterReviewResult, setFilterReviewResult] = useState<string>('')

  const [showReview, setShowReview] = useState(false)
  const [reviewTxId, setReviewTxId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('reviewed')
  const [reviewer, setReviewer] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewResult, setReviewResult] = useState<ReviewResult>('approved')
  const [followSuggestion, setFollowSuggestion] = useState<boolean | undefined>(undefined)

  const [highlightTxId, setHighlightTxId] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { highlightTxId?: string } | null
    if (state?.highlightTxId) {
      setHighlightTxId(state.highlightTxId)
      setDetailTxId(state.highlightTxId)
      setShowDetailDrawer(true)
      window.history.replaceState({}, document.title)
    }
  }, [location])

  const shiftTxs = useMemo(() => {
    const start = new Date(currentShift.startedAt)
    const end = currentShift.endedAt ? new Date(currentShift.endedAt) : new Date('9999-12-31')
    return transactions
      .filter((t) => {
        const d = new Date(t.createdAt)
        return t.cashierId === currentShift.cashierId && d >= start && d <= end
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [transactions, currentShift])

  const abnormalTxs = useMemo(() => {
    return shiftTxs.filter((t) => t.warningFlags && t.warningFlags.length > 0)
  }, [shiftTxs])

  const filteredTxs = useMemo(() => {
    let result = [...shiftTxs]

    if (filterMember) {
      result = result.filter((t) => t.memberId === filterMember)
    }
    if (filterPayMethod) {
      result = result.filter((t) => t.paymentMethod === filterPayMethod)
    }
    if (filterTxType) {
      result = result.filter((t) => t.type === filterTxType)
    }
    if (filterAbnormalType) {
      if (filterAbnormalType === 'has_abnormal') {
        result = result.filter((t) => t.warningFlags && t.warningFlags.length > 0)
      } else if (filterAbnormalType === 'has_discount') {
        result = result.filter((t) => t.discountDetail && t.discountDetail.discountAmount > 0)
      } else if (filterAbnormalType === 'has_third_party') {
        result = result.filter((t) => t.isThirdPartyPayer)
      } else if (filterAbnormalType === 'has_approval') {
        result = result.filter((t) => t.approvalRecords && t.approvalRecords.length > 0)
      } else if (filterAbnormalType === 'cancelled') {
        result = result.filter((t) => t.status === 'cancelled')
      } else if (filterAbnormalType === 'review_unreviewed') {
        result = result.filter((t) => t.reviewStatus === 'unreviewed')
      } else if (filterAbnormalType === 'review_reviewed') {
        result = result.filter((t) => t.reviewStatus === 'reviewed')
      } else if (filterAbnormalType === 'review_escalated') {
        result = result.filter((t) => t.reviewStatus === 'escalated')
      }
    }

    if (filterReviewResult) {
      result = result.filter((t) => t.reviewResult === filterReviewResult)
    }

    return result
  }, [shiftTxs, filterMember, filterPayMethod, filterAbnormalType, filterTxType, filterReviewResult])

  const detailTransaction = useMemo(() => {
    if (!detailTxId) return null
    return transactions.find((t) => t.id === detailTxId) || null
  }, [detailTxId, transactions])

  const abnormalTypeOptions = [
    { value: '', label: '全部交易' },
    { value: 'has_abnormal', label: '有异常标记' },
    { value: 'has_discount', label: '有折扣授权' },
    { value: 'has_third_party', label: '代付交易' },
    { value: 'has_approval', label: '有授权记录' },
    { value: 'cancelled', label: '已取消' },
    { value: 'review_unreviewed', label: '未复核' },
    { value: 'review_reviewed', label: '已复核' },
    { value: 'review_escalated', label: '需上报' },
  ]

  const reviewResultOptions = [
    { value: '', label: '全部处理结果' },
    { value: 'pending', label: '待处理' },
    { value: 'approved', label: '同意通过' },
    { value: 'escalated', label: '上报处理' },
    { value: 'rejected', label: '驳回申请' },
    { value: 'adjusted', label: '已调账' },
    { value: 'refunded', label: '已退款' },
  ]

  const handlePrint = (txId: string) => {
    incrementReceiptPrint(txId)
    alert('模拟打印小票：交易已打印')
  }

  const handleShowSignature = (txId: string) => {
    setSignatureTxId(txId)
    setShowSignature(true)
  }

  const handleShowDetail = (txId: string) => {
    setDetailTxId(txId)
    setShowDetailDrawer(true)
  }

  const handleCloseShift = () => {
    if (!confirm('确认交班？交班后当前班次数据将锁定并生成交班单。')) return
    closeShift()
    setShiftClosed(true)
  }

  const doCancel = () => {
    if (!selectedTx || !cancelReason.trim()) {
      alert('请填写取消原因')
      return
    }
    cancelTransaction(selectedTx, cancelReason)
    setShowCancel(false)
    setCancelReason('')
    setSelectedTx(null)
  }

  const openReview = (txId: string) => {
    setReviewTxId(txId)
    const tx = transactions.find((t) => t.id === txId)
    if (tx) {
      setReviewStatus(tx.reviewStatus === 'unreviewed' ? 'reviewed' : tx.reviewStatus)
      setReviewResult(tx.reviewResult || 'approved')
      setFollowSuggestion(tx.followSuggestion)
    }
    setReviewer('')
    setReviewNote('')
    setShowReview(true)
  }

  const doReview = () => {
    if (!reviewTxId || !reviewer.trim()) {
      alert('请填写复核人')
      return
    }
    reviewTransaction(reviewTxId, reviewStatus, reviewer, reviewNote, reviewResult)
    setShowReview(false)
    setReviewTxId(null)
    setReviewer('')
    setReviewNote('')
    setReviewResult('approved')
    setFollowSuggestion(undefined)
  }

  const shiftLabel =
    currentShift.shift === 'morning'
      ? '早班'
      : currentShift.shift === 'afternoon'
        ? '中班'
        : '晚班'

  const selectedTransaction = signatureTxId
    ? transactions.find((t) => t.id === signatureTxId)
    : null

  const otherPayTotal =
    currentShift.cashTotal +
    currentShift.cardTotal +
    currentShift.wechatTotal +
    currentShift.alipayTotal

  const getRiskBadge = (level?: RiskLevel) => {
    if (!level || level === 'low') return null
    const cfg = riskLevelConfig[level]
    return (
      <span className={`tag ${cfg.bg} ${cfg.text}`} style={{ fontSize: 11 }}>
        {cfg.label}
      </span>
    )
  }

  const getReviewStatusTag = (status: ReviewStatus) => {
    const cfg = reviewStatusTags[status]
    return (
      <span className={`tag ${cfg.bg} ${cfg.text}`} style={{ fontSize: 11 }}>
        {reviewStatusLabels[status]}
      </span>
    )
  }

  const getReviewResultTag = (result?: ReviewResult) => {
    if (!result) return null
    const cfg = reviewResultTags[result]
    return (
      <span className={`tag ${cfg.bg} ${cfg.text}`} style={{ fontSize: 11 }}>
        {reviewResultLabels[result]}
      </span>
    )
  }

  return (
    <div className="page-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>交班汇总</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {currentShift.shiftDate} · {shiftLabel} · 收银员 <span className="text-bold">{currentShift.cashierName}</span>
            {currentShift.status === 'closed' && (
              <span className="tag tag-gray" style={{ marginLeft: 10 }}>已交班</span>
            )}
            {currentShift.status === 'active' && (
              <span className="tag tag-success" style={{ marginLeft: 10 }}>交班中</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {currentShift.status === 'active' && (
            <button className="btn btn-danger" onClick={handleCloseShift}>
              🔒 确认交班
            </button>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">💰 现金</div>
          <div className="stat-value cash">{formatCurrency(currentShift.cashTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.cashCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💳 银行卡</div>
          <div className="stat-value card">{formatCurrency(currentShift.cardTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.cardCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💚 微信</div>
          <div className="stat-value wechat">{formatCurrency(currentShift.wechatTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.wechatCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🅰️ 支付宝</div>
          <div className="stat-value alipay">{formatCurrency(currentShift.alipayTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>{currentShift.alipayCount} 笔</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">💎 储值扣款</div>
          <div className="stat-value stored">{formatCurrency(currentShift.storedDeductTotal)}</div>
          <div className="text-gray" style={{ fontSize: 12, marginTop: 4 }}>
            {currentShift.deductCount} 笔扣 / {currentShift.rechargeCount} 笔充
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">交班统计</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>储值充值总额</div>
            <div className="text-green" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {formatCurrency(currentShift.rechargeTotal)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{currentShift.rechargeCount} 笔</div>
          </div>
          <div style={{ background: '#f9fafb', padding: 16, borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>项目消费总额</div>
            <div className="text-pink" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {formatCurrency(currentShift.storedDeductTotal + (otherPayTotal - currentShift.rechargeTotal > 0 ? otherPayTotal - currentShift.rechargeTotal : 0))}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{currentShift.deductCount} 笔</div>
          </div>
          <div style={{ background: '#fef2f2', padding: 16, borderRadius: 12, border: '1px solid #fecaca' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>退款总额</div>
            <div className="text-red" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {formatCurrency(currentShift.refundTotal)}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{currentShift.refundCount} 笔</div>
          </div>
          <div style={{ background: '#fef3c7', padding: 16, borderRadius: 12, border: '1px solid #fde68a' }}>
            <div className="text-gray" style={{ fontSize: 13 }}>异常/预警</div>
            <div className="text-orange" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
              {abnormalTxs.length} 笔
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {currentShift.approvalCount || 0} 次授权 · {currentShift.thirdPartyPayCount || 0} 笔代付
            </div>
          </div>
        </div>
      </div>

      {abnormalAlerts.length > 0 && (
        <div className="section">
          <h3 className="section-title">
            实时异常提醒
            <button
              className="btn btn-secondary btn-sm"
              onClick={clearAbnormalAlerts}
              style={{ marginLeft: 12, fontSize: 12, padding: '4px 10px' }}
            >
              全部标记已读
            </button>
          </h3>
          {abnormalAlerts.map((a) => (
            <div key={a.id} className={`alert ${a.level === 'danger' ? 'alert-danger' : 'alert-warning'}`}>
              <span className="alert-icon">
                {a.type === 'cancel' ? '🚫' : a.type === 'reprint' ? '🖨️' : a.type === 'adjust' || a.type === 'discount' ? '✏️' : '⚠️'}
              </span>
              <div style={{ flex: 1 }}>
                <div className="text-bold">{a.message}</div>
                <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>
                  {a.timestamp} · {a.level === 'danger' ? '高危' : '一般'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>
            交易明细台账
            <span className="text-gray" style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
              共 {filteredTxs.length} 笔
            </span>
          </h3>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
          gap: 12,
          padding: 14,
          background: '#f9fafb',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          marginBottom: 12,
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">按会员筛选</label>
            <select
              className="form-select"
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
            >
              <option value="">全部会员</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{maskName(m.name)} · {m.memberCode}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">按支付方式</label>
            <select
              className="form-select"
              value={filterPayMethod}
              onChange={(e) => setFilterPayMethod(e.target.value as PaymentMethod | '')}
            >
              <option value="">全部方式</option>
              {Object.entries(paymentMethodLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">按交易类型</label>
            <select
              className="form-select"
              value={filterTxType}
              onChange={(e) => setFilterTxType(e.target.value)}
            >
              <option value="">全部类型</option>
              {Object.entries(transactionTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">按异常/复核</label>
            <select
              className="form-select"
              value={filterAbnormalType}
              onChange={(e) => setFilterAbnormalType(e.target.value)}
            >
              {abnormalTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">按处理结果</label>
            <select
              className="form-select"
              value={filterReviewResult}
              onChange={(e) => setFilterReviewResult(e.target.value)}
            >
              {reviewResultOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredTxs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">暂无符合条件的交易记录</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>交易单号</th>
                <th>会员</th>
                <th>类型</th>
                <th>金额</th>
                <th>支付方式</th>
                <th>状态</th>
                <th>复核状态</th>
                <th>处理结果</th>
                <th>风险/异常</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.map((tx) => (
                <tr
                  key={tx.id}
                  style={{
                    opacity: tx.status === 'cancelled' ? 0.55 : 1,
                    cursor: 'pointer',
                    background: highlightTxId === tx.id ? '#fffbeb' : undefined,
                  }}
                  onClick={() => handleShowDetail(tx.id)}
                >
                  <td className="text-bold">{tx.transactionNo}</td>
                  <td>
                    {tx.memberName}
                    {tx.isThirdPartyPayer && (
                      <div style={{ fontSize: 11, color: '#b45309' }}>代付: {tx.payerName}</div>
                    )}
                  </td>
                  <td>
                    {tx.type === 'recharge' && <span className="tag tag-success">储值充值</span>}
                    {tx.type === 'deduct' && <span className="tag tag-info">项目扣款</span>}
                    {tx.type === 'refund' && <span className="tag tag-warning">退款</span>}
                    {tx.type === 'adjust' && <span className="tag tag-purple">手工调账</span>}
                  </td>
                  <td className={`text-bold ${tx.type === 'recharge' ? 'text-green' : tx.type === 'refund' ? 'text-red' : 'text-pink'}`}>
                    {tx.type === 'recharge' ? '+' : tx.type === 'refund' ? '-' : ''}{formatCurrency(tx.amount)}
                  </td>
                  <td>{paymentMethodLabels[tx.paymentMethod]}</td>
                  <td>
                    <span className={`status-dot ${tx.status}`} />
                    {tx.status === 'completed' && '已完成'}
                    {tx.status === 'pending' && '处理中'}
                    {tx.status === 'cancelled' && '已取消'}
                    {tx.status === 'voided' && '已作废'}
                  </td>
                  <td>{getReviewStatusTag(tx.reviewStatus)}</td>
                  <td>{getReviewResultTag(tx.reviewResult) || <span className="text-gray" style={{ fontSize: 12 }}>未处理</span>}</td>
                  <td>
                    {tx.riskLevel && tx.riskLevel !== 'low' && getRiskBadge(tx.riskLevel)}
                    {tx.discountDetail && tx.discountDetail.discountAmount > 0 && (
                      <span className="tag tag-purple" style={{ fontSize: 11, marginRight: 4 }}>折扣</span>
                    )}
                    {tx.isThirdPartyPayer && (
                      <span className="tag tag-warning" style={{ fontSize: 11 }}>代付</span>
                    )}
                    {tx.warningFlags && tx.warningFlags.length > 0 && (
                      <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                        ⚠ {tx.warningFlags.length} 项异常
                      </div>
                    )}
                  </td>
                  <td className="text-gray" style={{ fontSize: 12 }}>{tx.createdAt.slice(5)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleShowDetail(tx.id)}
                        style={{ padding: '6px 10px', fontSize: 12 }}
                      >
                        📄 详情
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePrint(tx.id)}
                        style={{ padding: '6px 10px', fontSize: 12 }}
                      >
                        🖨️
                      </button>
                      {tx.signature && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleShowSignature(tx.id)}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          ✍️
                        </button>
                      )}
                      {tx.status === 'completed' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openReview(tx.id)}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          🔍 复核
                        </button>
                      )}
                      {tx.status === 'completed' && currentShift.status === 'active' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => { setSelectedTx(tx.id); setShowCancel(true) }}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {shiftClosed && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 36, width: 460, maxWidth: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <h2 style={{ marginBottom: 8 }}>交班成功</h2>
            <p className="text-gray" style={{ marginBottom: 24 }}>
              {currentShift.shiftDate} {shiftLabel}已交班
            </p>
            <div style={{ background: '#f9fafb', padding: 18, borderRadius: 12, marginBottom: 24, textAlign: 'left' }}>
              <div className="summary-row"><span>本班交易总数</span><span>{currentShift.transactionCount} 笔</span></div>
              <div className="summary-row"><span>储值充值</span><span className="text-green">+{formatCurrency(currentShift.rechargeTotal)}</span></div>
              <div className="summary-row"><span>项目扣款</span><span className="text-pink">-{formatCurrency(currentShift.storedDeductTotal)}</span></div>
              <div className="summary-row"><span>现金+刷卡+扫码</span><span>{formatCurrency(otherPayTotal)}</span></div>
              <div className="summary-row"><span>异常单</span><span className="text-orange">{abnormalTxs.length} 笔</span></div>
            </div>
            <button className="btn btn-primary" onClick={() => setShiftClosed(false)}>
              确认
            </button>
          </div>
        </div>
      )}

      {showCancel && selectedTx && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 28, width: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🚫</div>
            <h3 style={{ textAlign: 'center', marginBottom: 4 }}>取消交易</h3>
            <p className="text-gray" style={{ textAlign: 'center', fontSize: 13, marginBottom: 20 }}>
              取消后将回退储值余额，并记录异常
            </p>
            <div className="form-group">
              <label className="form-label">取消原因（必填）</label>
              <select className="form-select" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                <option value="">请选择原因</option>
                <option value="客户取消">客户取消</option>
                <option value="操作失误">操作失误</option>
                <option value="客户改约">客户改约</option>
                <option value="价格错误">价格/项目输入错误</option>
                <option value="其他">其他原因</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowCancel(false); setCancelReason(''); setSelectedTx(null) }}>返回</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={doCancel}>确认取消</button>
            </div>
          </div>
        </div>
      )}

      {showSignature && selectedTransaction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 24, width: 500,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginBottom: 4 }}>顾客签字确认</h3>
            <p className="text-gray" style={{ fontSize: 13, marginBottom: 16 }}>
              交易单号：{selectedTransaction.transactionNo} · {selectedTransaction.memberName}
            </p>
            {selectedTransaction.signature ? (
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden',
                background: '#fafafa',
              }}>
                <img src={selectedTransaction.signature} alt="签字" style={{ width: '100%', display: 'block' }} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                该交易无签字记录
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => { setShowSignature(false); setSignatureTxId(null) }}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {showReview && reviewTxId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 28, width: 460,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🔍</div>
            <h3 style={{ textAlign: 'center', marginBottom: 4 }}>交易复核</h3>
            <p className="text-gray" style={{ textAlign: 'center', fontSize: 13, marginBottom: 20 }}>
              交易单号：{transactions.find((t) => t.id === reviewTxId)?.transactionNo}
            </p>
            <div className="form-group">
              <label className="form-label">复核状态</label>
              <select
                className="form-select"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as ReviewStatus)}
              >
                <option value="reviewed">已复核</option>
                <option value="escalated">需上报</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">处理结果</label>
              <select
                className="form-select"
                value={reviewResult}
                onChange={(e) => setReviewResult(e.target.value as ReviewResult)}
              >
                <option value="approved">同意通过</option>
                <option value="escalated">上报处理</option>
                <option value="rejected">驳回申请</option>
                <option value="adjusted">已调账</option>
                <option value="refunded">已退款</option>
              </select>
            </div>
            {(() => {
              const tx = transactions.find((t) => t.id === reviewTxId)
              if (tx?.riskSuggestions && tx.riskSuggestions.length > 0) {
                return (
                  <div className="form-group">
                    <label className="form-label">是否按系统建议处理</label>
                    <div style={{
                      padding: 12, background: '#fef2f2', borderRadius: 8,
                      border: '1px solid #fecaca', marginBottom: 10, fontSize: 12,
                    }}>
                      <div className="text-bold text-red-800" style={{ marginBottom: 4 }}>系统处理建议：</div>
                      <ul style={{ margin: 0, paddingLeft: 16, color: '#7f1d1d', lineHeight: 1.7 }}>
                        {tx.riskSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={followSuggestion === true}
                        onChange={(e) => setFollowSuggestion(e.target.checked ? true : false)}
                      />
                      收银员已按系统建议处理
                    </label>
                  </div>
                )
              }
              return null
            })()}
            <div className="form-group">
              <label className="form-label">复核人（必填）</label>
              <input
                className="form-input"
                type="text"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="请输入复核人姓名"
              />
            </div>
            <div className="form-group">
              <label className="form-label">复核备注</label>
              <textarea
                className="form-input"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="请输入复核备注（选填）"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => {
                setShowReview(false)
                setReviewTxId(null)
                setReviewer('')
                setReviewNote('')
                setReviewResult('approved')
                setFollowSuggestion(undefined)
              }}>返回</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={doReview}>确认复核</button>
            </div>
          </div>
        </div>
      )}

      {showDetailDrawer && detailTransaction && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        }}>
          <div
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            }}
            onClick={() => setShowDetailDrawer(false)}
          />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 680, maxWidth: '90vw',
            background: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>交易详情</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                  {detailTransaction.transactionNo}
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDetailDrawer(false)}
              >
                ✕ 关闭
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div>
                  <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>交易类型</div>
                  <div className="text-bold" style={{ fontSize: 15 }}>
                    {transactionTypeLabels[detailTransaction.type]}
                  </div>
                </div>
                <div>
                  <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>交易状态</div>
                  <div>
                    <span className={`status-dot ${detailTransaction.status}`} />
                    {detailTransaction.status === 'completed' && '已完成'}
                    {detailTransaction.status === 'pending' && '处理中'}
                    {detailTransaction.status === 'cancelled' && '已取消'}
                    {detailTransaction.status === 'voided' && '已作废'}
                  </div>
                </div>
                <div>
                  <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>交易金额</div>
                  <div className={`text-bold ${detailTransaction.type === 'recharge' ? 'text-green' : 'text-pink'}`} style={{ fontSize: 20 }}>
                    {detailTransaction.type === 'recharge' ? '+' : ''}{formatCurrency(detailTransaction.amount)}
                  </div>
                </div>
                <div>
                  <div className="text-gray" style={{ fontSize: 12, marginBottom: 4 }}>支付方式</div>
                  <div className="text-bold" style={{ fontSize: 15 }}>
                    {paymentMethodLabels[detailTransaction.paymentMethod]}
                  </div>
                </div>
              </div>

              <div style={{
                background: '#f9fafb', padding: 16, borderRadius: 12,
                border: '1px solid #e5e7eb', marginBottom: 20,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>会员信息</div>
                <div className="summary-row"><span>会员姓名</span><span className="text-bold">{detailTransaction.memberName}</span></div>
                <div className="summary-row"><span>会员卡号</span><span>{detailTransaction.memberCode}</span></div>
                <div className="summary-row"><span>收银员</span><span>{detailTransaction.cashierName}</span></div>
                <div className="summary-row"><span>交易时间</span><span>{detailTransaction.createdAt}</span></div>
              </div>

              {(detailTransaction.type === 'recharge') && (
                <div style={{
                  background: '#f0fdf4', padding: 16, borderRadius: 12,
                  border: '1px solid #bbf7d0', marginBottom: 20,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: '#166534' }}>
                    💰 储值明细
                  </div>
                  <div className="summary-row"><span>储值本金</span><span className="text-bold">{formatCurrency(detailTransaction.rechargePrincipal || 0)}</span></div>
                  <div className="summary-row"><span>赠送金额</span><span className="text-green text-bold">+{formatCurrency(detailTransaction.rechargeGift || 0)}</span></div>
                  {detailTransaction.packageName && (
                    <div className="summary-row"><span>套餐名称</span><span>{detailTransaction.packageName}</span></div>
                  )}
                  <div className="summary-row total" style={{ marginTop: 8 }}>
                    <span>本次入账总额</span>
                    <span className="amount">{formatCurrency((detailTransaction.rechargePrincipal || 0) + (detailTransaction.rechargeGift || 0))}</span>
                  </div>
                </div>
              )}

              {detailTransaction.type === 'deduct' && (
                <div style={{
                  background: '#fdf2f8', padding: 16, borderRadius: 12,
                  border: '1px solid #f9a8d4', marginBottom: 20,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: '#9d174d' }}>
                    💆 项目消费明细
                  </div>

                  {detailTransaction.discountDetail && detailTransaction.discountDetail.discountAmount > 0 && (
                    <div style={{
                      background: '#fffbeb', padding: 12, borderRadius: 8,
                      marginBottom: 12, border: '1px solid #fde68a',
                    }}>
                      <div className="summary-row">
                        <span>原价合计</span>
                        <span className="text-gray" style={{ textDecoration: 'line-through' }}>
                          {formatCurrency(detailTransaction.discountDetail.originalAmount)}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>优惠折扣</span>
                        <span className="text-red text-bold">
                          -{formatCurrency(detailTransaction.discountDetail.discountAmount)}
                          <span style={{ fontSize: 12, marginLeft: 4 }}>
                            ({(detailTransaction.discountDetail.discountRatio * 100).toFixed(1)}折)
                          </span>
                        </span>
                      </div>
                      {detailTransaction.discountDetail.valueDiscountRatio != null && (
                        <div className="summary-row">
                          <span>权益折扣比</span>
                          <span className="text-bold">
                            {(calcValueDiscountRatio(
                              detailTransaction.amount,
                              detailTransaction.discountDetail.originalAmount,
                            ) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {detailTransaction.makeUpAmount && detailTransaction.makeUpAmount > 0 ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#9d174d' }}>
                        📊 资金来源拆分
                      </div>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                        padding: 12, background: 'white', borderRadius: 8,
                        border: '1px solid #fbcfe8', marginBottom: 12,
                      }}>
                        <div style={{
                          padding: 8, background: '#fff1f2', borderRadius: 6,
                          border: '1px solid #fecdd3',
                        }}>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
                            补缴来源：{paymentMethodLabels[detailTransaction.makeUpMethod || 'cash']}
                          </div>
                          <div className="text-green text-bold" style={{ fontSize: 16 }}>
                            +{formatCurrency(detailTransaction.makeUpAmount)}
                          </div>
                        </div>
                        <div style={{
                          padding: 8, background: '#fff7ed', borderRadius: 6,
                          border: '1px solid #fed7aa',
                        }}>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
                            储值账户消耗
                          </div>
                          <div className="text-red text-bold" style={{ fontSize: 16 }}>
                            -{formatCurrency(detailTransaction.amount - detailTransaction.makeUpAmount)}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#9d174d' }}>
                        💰 储值消耗拆分
                      </div>
                      <div className="summary-row">
                        <span>补缴金额（{paymentMethodLabels[detailTransaction.makeUpMethod || 'cash']}）</span>
                        <span className="text-green text-bold">+{formatCurrency(detailTransaction.makeUpAmount)}</span>
                      </div>
                      <div className="summary-row">
                        <span>扣原卡本金</span>
                        <span className="text-red text-bold">-{formatCurrency(detailTransaction.principalUsed || 0)}</span>
                      </div>
                      <div className="summary-row">
                        <span>赠金抵扣</span>
                        <span className="text-orange text-bold">-{formatCurrency(detailTransaction.giftUsed || 0)}</span>
                      </div>
                      <div style={{
                        fontSize: 11, color: '#6b7280',
                        padding: '8px 12px', background: '#f9fafb',
                        borderRadius: 6, marginTop: 8, marginBottom: 12,
                      }}>
                        对账公式：补缴 {formatCurrency(detailTransaction.makeUpAmount)} + 本金 {formatCurrency(detailTransaction.principalUsed || 0)} + 赠金 {formatCurrency(detailTransaction.giftUsed || 0)} = 交易金额 {formatCurrency(detailTransaction.amount)} ✓
                        <span style={{ marginLeft: 8 }}>（补缴已合并入本笔交易，仅一笔入账）</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="summary-row"><span>本金扣款</span><span className="text-bold">{formatCurrency(detailTransaction.principalUsed || 0)}</span></div>
                      <div className="summary-row"><span>赠金抵扣</span><span className="text-green text-bold">{formatCurrency(detailTransaction.giftUsed || 0)}</span></div>
                      <div style={{
                        fontSize: 11, color: '#6b7280',
                        padding: '8px 12px', background: '#f9fafb',
                        borderRadius: 6, marginTop: 8, marginBottom: 12,
                      }}>
                        对账公式：本金 {formatCurrency(detailTransaction.principalUsed || 0)} + 赠金 {formatCurrency(detailTransaction.giftUsed || 0)} = 交易金额 {formatCurrency(detailTransaction.amount)} ✓
                      </div>
                    </div>
                  )}

                  <div className="summary-row total" style={{ marginTop: 8 }}>
                    <span>实际扣款总额</span>
                    <span className="amount text-pink">{formatCurrency(detailTransaction.amount)}</span>
                  </div>
                </div>
              )}

              {detailTransaction.items && detailTransaction.items.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>项目明细（{detailTransaction.items.length} 项）</div>
                  <table className="table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>项目名称</th>
                        <th>医生</th>
                        <th>单价</th>
                        <th>数量</th>
                        <th>小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailTransaction.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="text-bold">{item.projectName}</div>
                            {item.treatmentNo && (
                              <div style={{ fontSize: 11, color: '#6b7280' }}>治疗号: {item.treatmentNo}</div>
                            )}
                            {item.originalPrice !== item.unitPrice && (
                              <div style={{ fontSize: 11, color: '#dc2626' }}>
                                原价 {formatCurrency(item.originalPrice)}
                              </div>
                            )}
                          </td>
                          <td>{item.doctorName}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td>{item.quantity}</td>
                          <td className="text-bold">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detailTransaction.consultantName && (
                    <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
                      咨询师：<span className="text-bold">{detailTransaction.consultantName}</span>
                    </div>
                  )}
                </div>
              )}

              {detailTransaction.isThirdPartyPayer && (
                <div style={{
                  background: '#fffbeb', padding: 16, borderRadius: 12,
                  border: '1px solid #fde68a', marginBottom: 20,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: '#92400e' }}>
                    📝 代付人信息
                  </div>
                  <div className="summary-row"><span>代付人姓名</span><span className="text-bold">{detailTransaction.payerName}</span></div>
                  <div className="summary-row"><span>联系电话</span><span>{maskPhone(detailTransaction.payerPhone || '')}</span></div>
                </div>
              )}

              {detailTransaction.approvalRecords && detailTransaction.approvalRecords.length > 0 && (
                <div style={{
                  background: '#f5f3ff', padding: 16, borderRadius: 12,
                  border: '1px solid #ddd6fe', marginBottom: 20,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: '#5b21b6' }}>
                    🔐 授权记录
                  </div>
                  {detailTransaction.approvalRecords.map((appr, idx) => (
                    <div key={idx} style={{
                      padding: '10px 12px',
                      background: 'white',
                      borderRadius: 8,
                      border: '1px solid #e9d5ff',
                      marginBottom: idx < detailTransaction.approvalRecords!.length - 1 ? 8 : 0,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="text-bold">{appr.approverName}</span>
                        <span className="tag tag-purple" style={{ fontSize: 11 }}>
                          {appr.approvalLevel === 'manager' ? '店经理' : '主管'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        授权类型：{appr.approvalType === 'price_adjust' ? '价格调整' : appr.approvalType === 'large_recharge' ? '大额储值' : appr.approvalType}
                      </div>
                      {appr.originalValue !== undefined && appr.newValue !== undefined && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          金额变动：{formatCurrency(appr.originalValue)} → {formatCurrency(appr.newValue)}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        授权原因：{appr.reason}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {appr.timestamp}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{
                background: '#eff6ff', padding: 16, borderRadius: 12,
                border: '1px solid #bfdbfe', marginBottom: 20,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: '#1e40af' }}>
                  🔍 复核信息
                </div>
                <div className="summary-row">
                  <span>复核状态</span>
                  <span>{getReviewStatusTag(detailTransaction.reviewStatus)}</span>
                </div>
                {detailTransaction.reviewResult && (
                  <div className="summary-row">
                    <span>处理结果</span>
                    <span>{getReviewResultTag(detailTransaction.reviewResult)}</span>
                  </div>
                )}
                {detailTransaction.followSuggestion !== undefined && (
                  <div className="summary-row">
                    <span>是否按建议处理</span>
                    <span className={detailTransaction.followSuggestion ? 'text-green text-bold' : 'text-red text-bold'}>
                      {detailTransaction.followSuggestion ? '✓ 已按建议处理' : '✗ 未按建议处理'}
                    </span>
                  </div>
                )}
                {detailTransaction.reviewer && (
                  <div className="summary-row">
                    <span>复核人</span>
                    <span className="text-bold">{detailTransaction.reviewer}</span>
                  </div>
                )}
                {detailTransaction.reviewNote && (
                  <div className="summary-row">
                    <span>复核备注</span>
                    <span>{detailTransaction.reviewNote}</span>
                  </div>
                )}
                {detailTransaction.reviewedAt && (
                  <div className="summary-row">
                    <span>复核时间</span>
                    <span>{detailTransaction.reviewedAt}</span>
                  </div>
                )}
              </div>

              {(detailTransaction.warningFlags && detailTransaction.warningFlags.length > 0) && (
                <div style={{
                  background: '#fef2f2', padding: 16, borderRadius: 12,
                  border: '1px solid #fecaca', marginBottom: 20,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: '#991b1b' }}>
                    ⚠️ 异常标记
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {detailTransaction.warningFlags.map((flag, idx) => (
                      <span key={idx} className="tag tag-danger" style={{ fontSize: 12 }}>
                        {flag}
                      </span>
                    ))}
                  </div>
                  {detailTransaction.riskDetails && detailTransaction.riskDetails.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: '#7f1d1d' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>风险详情：</div>
                      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                        {detailTransaction.riskDetails.map((d, idx) => (
                          <li key={idx}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detailTransaction.riskSuggestions && detailTransaction.riskSuggestions.length > 0 && (
                    <div style={{
                      marginTop: 12, padding: 12,
                      background: '#fff7ed', borderRadius: 8,
                      border: '1px solid #fed7aa',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 6 }}>
                        💡 系统处理建议（提交时已给出）：
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f', lineHeight: 1.8 }}>
                        {detailTransaction.riskSuggestions.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {detailTransaction.cancelReason && (
                <div style={{
                  background: '#fef2f2', padding: 16, borderRadius: 12,
                  border: '1px solid #fecaca', marginBottom: 20,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#991b1b' }}>
                    🚫 取消原因
                  </div>
                  <div style={{ fontSize: 13 }}>{detailTransaction.cancelReason}</div>
                  {detailTransaction.cancelledAt && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                      取消时间：{detailTransaction.cancelledAt}
                    </div>
                  )}
                </div>
              )}

              {detailTransaction.signature && (
                <div style={{
                  background: '#f9fafb', padding: 16, borderRadius: 12,
                  border: '1px solid #e5e7eb',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
                    ✍️ 顾客签字
                  </div>
                  <div style={{
                    border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
                    background: 'white',
                  }}>
                    <img src={detailTransaction.signature} alt="签字" style={{ width: '100%', display: 'block' }} />
                  </div>
                </div>
              )}

              {detailTransaction.remarks && (
                <div style={{
                  background: '#f9fafb', padding: 16, borderRadius: 12,
                  border: '1px solid #e5e7eb', marginTop: 20,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                    📝 备注
                  </div>
                  <div style={{ fontSize: 13 }}>{detailTransaction.remarks}</div>
                </div>
              )}
            </div>

            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
            }}>
              {detailTransaction.status === 'completed' && detailTransaction.reviewStatus === 'unreviewed' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowDetailDrawer(false)
                    openReview(detailTransaction.id)
                  }}
                >
                  🔍 复核
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => handlePrint(detailTransaction.id)}
              >
                🖨️ 打印小票
              </button>
              {detailTransaction.status === 'completed' && currentShift.status === 'active' && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setShowDetailDrawer(false)
                    setSelectedTx(detailTransaction.id)
                    setShowCancel(true)
                  }}
                >
                  🚫 取消交易
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
